/**
 * @file orchestrateRunPipeline.app.ts
 * @layer app
 * @description `aimo run` — plan → delegated execute → review in one process (no subprocess per stage).
 */

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import {
  EXIT_CONFIG_ERROR,
  EXIT_OPERATIONAL_ERROR,
  EXIT_SUCCESS,
} from '@core/contracts/ExitCodes.constants';
import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { assertPlanPathAnchoredInRepoRoot } from '@core/execute/assertPlanPathAnchoredInRepoRoot.behavior';
import { serializeExecuteResultJson } from '@core/execute/ExecuteResultJson.behavior';
import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import { resolveDelegatedExecuteForProfile } from '@core/execute/ResolveDelegatedExecute.behavior';
import { substitutePlanPathInArgv } from '@core/execute/substitutePlanPathInArgv.behavior';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { ensureVerdictForPersistedReview } from '@core/review/ensureVerdictForPersistedReview.behavior';
import { exitCodeForReviewVerdict } from '@core/review/exitCodeForReviewVerdict.behavior';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';
import {
  EXECUTE_RESULT_JSON_BASENAME,
  GIT_DIFF_AFTER_BASENAME,
  GIT_DIFF_BEFORE_BASENAME,
  PLAN_MD_FILENAME,
  REVIEW_MD_FILENAME,
} from '@core/runs/AimoRunPaths.constants';
import { serializePlanManifestJson } from '@core/runs/RunManifestJson.behavior';
import { runPlanChat } from '@features/planStage.feature';
import { runReviewChat } from '@features/reviewStage.feature';
import { runDelegatedArgv } from '@runtime/bun/DelegatedSpawn.bun';
import { readGitDiffHeadText } from '@runtime/bun/GitDiffHead.bun';
import {
  prepareRunArtifactPaths,
  writeExecuteStageArtifacts,
  writePlanArtifacts,
  writeReviewMarkdown,
} from '@runtime/bun/RunWorkspace.bun';

import {
  createDefaultClockPort,
  createInProcessFakeChatPort,
  loadResolvedAimoConfig,
} from './wireDefaults';

type TGitDiffCapture = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Combines optional `git diff HEAD` failures into one nullable error string.
 * @param before - Capture before delegated spawn.
 * @param after - Capture after delegated spawn.
 * @returns Human-readable combined error, or `null` when both succeeded.
 */
function formatGitDiffHeadError(before: TGitDiffCapture, after: TGitDiffCapture): string | null {
  if (before.ok && after.ok) {
    return null;
  }
  if (before.ok === false && after.ok === false) {
    return `before: ${before.reason}; after: ${after.reason}`;
  }
  if (before.ok === false) {
    return `before: ${before.reason}`;
  }
  if (after.ok === false) {
    return `after: ${after.reason}`;
  }
  return null;
}

/**
 * Selects a chat backend for the plan stage (extend when HTTP providers land).
 * @param provider - Value from YAML `profiles.*.plan.provider`.
 * @returns Port instance or `null` when unsupported.
 */
function selectPlanChatPort(provider: string): IChatCompletionPort | null {
  if (provider === 'fake') {
    return createInProcessFakeChatPort();
  }
  return null;
}

/**
 * Selects chat backend for the review stage (extend when HTTP providers land).
 * @param provider - Value from YAML `profiles.*.review.provider`.
 * @returns Port instance or `null` when unsupported.
 */
function selectReviewChatPort(provider: string): IChatCompletionPort | null {
  if (provider === 'fake') {
    return createInProcessFakeChatPort();
  }
  return null;
}

/**
 * Validates merged config and stage wiring for `aimo run` without writing run artifacts or calling providers.
 * @param options - Same task/profile context as a real run.
 * @param options.cwd - Repository root.
 * @param options.task - Planner task text.
 * @param options.profile - Optional profile override.
 * @param options.json - When true, print one JSON summary line on stdout.
 * @returns Exit code (`EXIT_SUCCESS` or `EXIT_CONFIG_ERROR`).
 */
async function runDryRunPipeline(options: {
  readonly cwd: string;
  readonly task: string;
  readonly profile?: string;
  readonly json: boolean;
}): Promise<number> {
  const loaded = await loadResolvedAimoConfig(options.cwd);
  if (!loaded.ok) {
    for (const m of loaded.messages) {
      process.stderr.write(`${m}\n`);
    }
    return EXIT_CONFIG_ERROR;
  }
  const cfg = loaded.config;
  const profileName = options.profile ?? cfg.default_profile;
  const task = options.task.trim();
  if (task.length === 0) {
    process.stderr.write('run: task text is empty\n');
    return EXIT_CONFIG_ERROR;
  }
  const resolvedPlan = resolvePlanStageForProfile(cfg, profileName);
  if (!resolvedPlan.ok) {
    process.stderr.write(`${resolvedPlan.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const planChat = selectPlanChatPort(resolvedPlan.plan.provider);
  if (!planChat) {
    process.stderr.write(
      `run: plan provider "${resolvedPlan.plan.provider}" is not supported yet (use provider: fake for now)\n`,
    );
    return EXIT_CONFIG_ERROR;
  }
  const resolvedExec = resolveDelegatedExecuteForProfile(cfg, profileName);
  if (!resolvedExec.ok) {
    process.stderr.write(`${resolvedExec.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const resolvedReview = resolveReviewStageForProfile(cfg, profileName);
  if (!resolvedReview.ok) {
    process.stderr.write(`${resolvedReview.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const reviewChat = selectReviewChatPort(resolvedReview.review.provider);
  if (!reviewChat) {
    process.stderr.write(
      `run: review provider "${resolvedReview.review.provider}" is not supported yet (use provider: fake for now)\n`,
    );
    return EXIT_CONFIG_ERROR;
  }
  void planChat;
  void reviewChat;
  void resolvedExec;
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        dry_run: true,
        ok: true,
        profile: profileName,
        task,
        stages: [{ name: 'plan' }, { name: 'execute' }, { name: 'review' }],
      })}\n`,
    );
  } else {
    process.stderr.write(
      `Dry run OK — would run plan → execute → review for profile "${profileName}" (task length ${task.length} chars).\n`,
    );
  }
  return EXIT_SUCCESS;
}

/**
 * Inputs for {@link runAimoRunPipeline} (CLI flags mapped to structured fields).
 */
export type TRunPipelineOptions = {
  /** Repository root (process cwd for the CLI). */
  readonly cwd: string;
  /** Planner task text. */
  readonly task: string;
  /** Optional profile override (defaults to config `default_profile`). */
  readonly profile?: string;
  /** Emit one JSON summary line on stdout when true. */
  readonly json: boolean;
  /** When true, validate config and stages only (no artifacts, no LLM, no spawn). */
  readonly dryRun: boolean;
};

/**
 * Plan → execute → review for one run id (not dry-run).
 * @param options - Parsed CLI options (`dryRun` must be false; field ignored if callers guarantee).
 * @param options.cwd - Repository root.
 * @param options.task - Planner task text.
 * @param options.profile - Optional profile override.
 * @param options.json - Machine-readable stdout when true.
 * @param options.dryRun - Ignored here; {@link runAimoRunPipeline} routes dry runs separately.
 * @returns Process exit code.
 */
/* eslint-disable complexity -- sequential stages plus JSON/human branches. */
async function runFullPipelineWriteArtifacts(options: TRunPipelineOptions): Promise<number> {
  const cwd = options.cwd;
  const loaded = await loadResolvedAimoConfig(cwd);
  if (!loaded.ok) {
    for (const m of loaded.messages) {
      process.stderr.write(`${m}\n`);
    }
    return EXIT_CONFIG_ERROR;
  }
  const cfg = loaded.config;
  const profileName = options.profile ?? cfg.default_profile;
  const task = options.task.trim();
  if (task.length === 0) {
    process.stderr.write('run: task text is empty\n');
    return EXIT_CONFIG_ERROR;
  }
  const resolvedPlan = resolvePlanStageForProfile(cfg, profileName);
  if (!resolvedPlan.ok) {
    process.stderr.write(`${resolvedPlan.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const { provider: planProvider, model: planModel } = resolvedPlan.plan;
  const planChat = selectPlanChatPort(planProvider);
  if (!planChat) {
    process.stderr.write(
      `run: plan provider "${planProvider}" is not supported yet (use provider: fake for now)\n`,
    );
    return EXIT_CONFIG_ERROR;
  }
  const resolvedExec = resolveDelegatedExecuteForProfile(cfg, profileName);
  if (!resolvedExec.ok) {
    process.stderr.write(`${resolvedExec.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const resolvedReview = resolveReviewStageForProfile(cfg, profileName);
  if (!resolvedReview.ok) {
    process.stderr.write(`${resolvedReview.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const { provider: reviewProvider, model: reviewModel } = resolvedReview.review;
  const reviewChat = selectReviewChatPort(reviewProvider);
  if (!reviewChat) {
    process.stderr.write(
      `run: review provider "${reviewProvider}" is not supported yet (use provider: fake for now)\n`,
    );
    return EXIT_CONFIG_ERROR;
  }

  const runId = randomUUID();
  if (!isSafeRunDirectoryName(runId)) {
    process.stderr.write('run: internal error — generated run id was rejected\n');
    return EXIT_OPERATIONAL_ERROR;
  }
  const paths = await prepareRunArtifactPaths(cwd, runId);
  const { markdown: planMarkdown } = await runPlanChat({ task, model: planModel, chat: planChat });
  const clock = createDefaultClockPort();
  const manifest = {
    schema_version: CURRENT_SCHEMA_VERSION,
    run_id: runId,
    stage: 'plan' as const,
    created_at_ms: clock.nowMs(),
    profile: profileName,
    provider: planProvider,
    model: planModel,
  };
  await writePlanArtifacts(
    { planPath: paths.planPath, manifestPath: paths.manifestPath },
    { manifestJson: serializePlanManifestJson(manifest), planMarkdown: `${planMarkdown}\n` },
  );

  const planPath = join(paths.runDir, PLAN_MD_FILENAME);
  const anchored = assertPlanPathAnchoredInRepoRoot({ repoRoot: cwd, planPath });
  if (!anchored.ok) {
    process.stderr.write(`${anchored.message}\n`);
    return EXIT_CONFIG_ERROR;
  }
  const argvResolved = substitutePlanPathInArgv(
    resolvedExec.execute.command,
    anchored.planPathResolved,
  );
  const stdinPath = resolvedExec.execute.pipePlanToStdin ? anchored.planPathResolved : undefined;
  const beforeDiff = await readGitDiffHeadText(cwd);
  const spawned =
    stdinPath !== undefined
      ? await runDelegatedArgv({ cwd, argv: argvResolved, stdinPlanFilePath: stdinPath })
      : await runDelegatedArgv({ cwd, argv: argvResolved });
  const afterDiff = await readGitDiffHeadText(cwd);
  const gitDiffHeadError = formatGitDiffHeadError(beforeDiff, afterDiff);
  const executeRecord = {
    schema_version: CURRENT_SCHEMA_VERSION,
    run_id: runId,
    stage: 'execute' as const,
    exit_code: spawned.exitCode,
    git_diff_head_error: gitDiffHeadError,
  };
  await writeExecuteStageArtifacts(paths.runDir, {
    gitDiffBefore: beforeDiff.ok ? beforeDiff.text : '',
    gitDiffAfter: afterDiff.ok ? afterDiff.text : '',
    executeResultJson: serializeExecuteResultJson(executeRecord),
  });

  if (spawned.exitCode !== 0) {
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          run_id: runId,
          failed_at: 'execute',
          execute_exit_code: spawned.exitCode,
          argv_resolved: argvResolved,
          git_diff_head_error: gitDiffHeadError,
          artifacts: {
            git_diff_before: join(paths.runDir, GIT_DIFF_BEFORE_BASENAME),
            git_diff_after: join(paths.runDir, GIT_DIFF_AFTER_BASENAME),
            execute_result: join(paths.runDir, EXECUTE_RESULT_JSON_BASENAME),
          },
        })}\n`,
      );
    } else {
      if (spawned.stderr.length > 0) {
        process.stderr.write(spawned.stderr);
      }
      if (spawned.stdout.length > 0) {
        process.stderr.write(spawned.stdout);
      }
      process.stderr.write(`run: execute stage exited with code ${String(spawned.exitCode)}\n`);
    }
    return EXIT_OPERATIONAL_ERROR;
  }

  const planFile = Bun.file(paths.planPath);
  const planText = await planFile.text();
  const diffPath = join(paths.runDir, GIT_DIFF_AFTER_BASENAME);
  const diffFile = Bun.file(diffPath);
  const diffMarkdown = (await diffFile.exists()) ? await diffFile.text() : '';
  const { markdown: reviewRaw } = await runReviewChat({
    model: reviewModel,
    chat: reviewChat,
    planMarkdown: planText,
    diffMarkdown,
    transcriptMarkdown: '',
  });
  const ensured = ensureVerdictForPersistedReview(reviewRaw, reviewProvider);
  if (!ensured.ok) {
    process.stderr.write(`${ensured.message}\n`);
    return EXIT_OPERATIONAL_ERROR;
  }
  const reviewExit = exitCodeForReviewVerdict(ensured.verdict);
  await writeReviewMarkdown(paths.runDir, ensured.markdownOut);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        run_id: runId,
        plan: {
          plan_path: paths.planPath,
          manifest_path: paths.manifestPath,
        },
        execute: {
          exit_code: spawned.exitCode,
          argv_resolved: argvResolved,
          git_diff_head_error: gitDiffHeadError,
          artifacts: {
            git_diff_before: join(paths.runDir, GIT_DIFF_BEFORE_BASENAME),
            git_diff_after: join(paths.runDir, GIT_DIFF_AFTER_BASENAME),
            execute_result: join(paths.runDir, EXECUTE_RESULT_JSON_BASENAME),
          },
        },
        review: {
          verdict: ensured.verdict,
          exit_code: reviewExit,
          review_path: join(paths.runDir, REVIEW_MD_FILENAME),
        },
      })}\n`,
    );
  } else {
    process.stderr.write(`run: finished run ${runId} (plan → execute → review)\n`);
    if (spawned.stderr.length > 0) {
      process.stderr.write(spawned.stderr);
    }
    if (spawned.stdout.length > 0) {
      process.stdout.write(spawned.stdout);
    }
    process.stdout.write(ensured.markdownOut);
    if (!ensured.markdownOut.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
  return reviewExit;
}
/* eslint-enable complexity */

/**
 * Executes `aimo run` end-to-end or performs a config-only dry run.
 * @param options - Parsed CLI options.
 * @param options.cwd - Repository root.
 * @param options.task - Planner task text.
 * @param options.profile - Optional profile override.
 * @param options.json - Machine-readable stdout when true.
 * @param options.dryRun - When true, only {@link runDryRunPipeline} runs.
 * @returns Process exit code per {@link EXIT_SUCCESS}, {@link EXIT_CONFIG_ERROR}, {@link EXIT_OPERATIONAL_ERROR}, or review verdict codes.
 */
export async function runAimoRunPipeline(options: TRunPipelineOptions): Promise<number> {
  if (options.dryRun) {
    return runDryRunPipeline(options);
  }
  return runFullPipelineWriteArtifacts(options);
}
