/**
 * @file execute.command.ts
 * @layer app
 * @description Registers `aimo execute` — delegated argv spawn, `{plan_path}` substitution, git diff snapshots.
 */

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
import {
  EXECUTE_RESULT_JSON_BASENAME,
  GIT_DIFF_AFTER_BASENAME,
  GIT_DIFF_BEFORE_BASENAME,
  PLAN_MD_FILENAME,
} from '@core/runs/AimoRunPaths.constants';
import { runDelegatedArgv } from '@runtime/bun/DelegatedSpawn.bun';
import { readGitDiffHeadText } from '@runtime/bun/GitDiffHead.bun';
import { prepareRunArtifactPaths, writeExecuteStageArtifacts } from '@runtime/bun/RunWorkspace.bun';
import type { Command } from 'commander';

import { loadResolvedAimoConfig } from '../wireDefaults';

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
 * Runs one delegated execute for an existing run directory (plan.md must exist).
 * @param options - Commander options after parsing.
 * @param options.run - Run id (same as `aimo plan` output).
 * @param options.profile - Optional profile override.
 * @param options.json - Machine-readable stdout when true.
 */
/* eslint-disable complexity -- sequential CLI steps (config → paths → git → spawn → artifacts); split if this grows. */
async function runExecuteDelegatedOnce(options: {
  readonly run: string;
  readonly profile?: string;
  readonly json?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const runId = options.run.trim();
  if (!isSafeRunDirectoryName(runId)) {
    process.stderr.write('execute: invalid --run id (use a UUID with no path separators)\n');
    process.exit(EXIT_OPERATIONAL_ERROR);
    return;
  }
  const loaded = await loadResolvedAimoConfig(cwd);
  if (!loaded.ok) {
    for (const m of loaded.messages) {
      process.stderr.write(`${m}\n`);
    }
    process.exit(EXIT_CONFIG_ERROR);
    return;
  }
  const cfg = loaded.config;
  const profileName = options.profile ?? cfg.default_profile;
  const resolvedExec = resolveDelegatedExecuteForProfile(cfg, profileName);
  if (!resolvedExec.ok) {
    process.stderr.write(`${resolvedExec.message}\n`);
    process.exit(EXIT_CONFIG_ERROR);
    return;
  }
  const paths = await prepareRunArtifactPaths(cwd, runId);
  const planPath = join(paths.runDir, PLAN_MD_FILENAME);
  const planFile = Bun.file(planPath);
  const planExists = await planFile.exists();
  if (!planExists) {
    process.stderr.write(`execute: plan file missing at ${planPath} (run \`aimo plan\` first)\n`);
    process.exit(EXIT_OPERATIONAL_ERROR);
    return;
  }
  const anchored = assertPlanPathAnchoredInRepoRoot({ repoRoot: cwd, planPath });
  if (!anchored.ok) {
    process.stderr.write(`${anchored.message}\n`);
    process.exit(EXIT_CONFIG_ERROR);
    return;
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
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        run_id: runId,
        run_dir: paths.runDir,
        argv_resolved: argvResolved,
        exit_code: spawned.exitCode,
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
      process.stdout.write(spawned.stdout);
    }
  }
  process.exit(spawned.exitCode === 0 ? EXIT_SUCCESS : spawned.exitCode);
}
/* eslint-enable complexity */

/**
 * Registers `execute` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerExecuteCommand(program: Command): void {
  program
    .command('execute')
    .description(
      'run delegated execute stage for an existing run (spawn argv, capture git diff HEAD before/after)',
    )
    .requiredOption('--run <id>', 'run id under .aimo/runs/<id>/ (same id as `aimo plan`)')
    .option('--profile <name>', 'profile name (defaults to config default_profile)')
    .option('--json', 'print machine-readable summary on stdout')
    .action(async (options: { run: string; profile?: string; json?: boolean }): Promise<void> => {
      await runExecuteDelegatedOnce(options);
    });
}
