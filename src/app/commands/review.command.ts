/**
 * @file review.command.ts
 * @layer app
 * @description Registers `aimo review` — reviewer chat, `review.md`, exit code from `VERDICT`.
 */

import { join } from 'node:path';

import { EXIT_CONFIG_ERROR, EXIT_OPERATIONAL_ERROR } from '@core/contracts/ExitCodes.constants';
import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { exitCodeForReviewVerdict } from '@core/review/exitCodeForReviewVerdict.behavior';
import { parseReviewVerdictFromMarkdown } from '@core/review/ParseReviewVerdict.behavior';
import type { TReviewVerdict } from '@core/review/ParseReviewVerdict.behavior';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';
import { GIT_DIFF_AFTER_BASENAME, REVIEW_MD_FILENAME } from '@core/runs/AimoRunPaths.constants';
import { runReviewChat } from '@features/reviewStage.feature';
import { prepareRunArtifactPaths, writeReviewMarkdown } from '@runtime/bun/RunWorkspace.bun';
import type { Command } from 'commander';

import { createInProcessFakeChatPort, loadResolvedAimoConfig } from '../wireDefaults';

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
 * When the in-process fake echoes the user blob without a verdict line, treat review as **pass**
 * for CI and append the required trailing line to persisted markdown.
 * @param markdown - Raw assistant markdown.
 * @param provider - Config provider id.
 * @returns Markdown to persist and verdict, or a parse error for non-fake providers.
 */
function ensureVerdictForPersistedReview(
  markdown: string,
  provider: string,
):
  | { ok: true; readonly markdownOut: string; readonly verdict: TReviewVerdict }
  | { ok: false; readonly message: string } {
  const parsed = parseReviewVerdictFromMarkdown(markdown);
  if (parsed.ok) {
    return { ok: true, markdownOut: markdown, verdict: parsed.verdict };
  }
  if (provider === 'fake') {
    const suffix = '\n\nVERDICT: pass\n';
    return {
      ok: true,
      markdownOut: `${markdown.replace(/\s+$/u, '')}${suffix}`,
      verdict: 'pass',
    };
  }
  return { ok: false, message: parsed.message };
}

/**
 * Runs one review for an existing run (requires `plan.md` under `.aimo/runs/<id>/`).
 * @param options - Parsed CLI options.
 * @param options.run - Run id (same as `aimo plan` output).
 * @param options.profile - Optional profile override.
 * @param options.json - Machine-readable stdout when true.
 */
async function runReviewOnce(options: {
  readonly run: string;
  readonly profile?: string;
  readonly json?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const runId = options.run.trim();
  if (!isSafeRunDirectoryName(runId)) {
    process.stderr.write('review: invalid --run id (use a UUID with no path separators)\n');
    process.exit(EXIT_OPERATIONAL_ERROR);
  }
  const loaded = await loadResolvedAimoConfig(cwd);
  if (!loaded.ok) {
    for (const m of loaded.messages) {
      process.stderr.write(`${m}\n`);
    }
    process.exit(EXIT_CONFIG_ERROR);
  }
  const cfg = loaded.config;
  const profileName = options.profile ?? cfg.default_profile;
  const resolved = resolveReviewStageForProfile(cfg, profileName);
  if (!resolved.ok) {
    process.stderr.write(`${resolved.message}\n`);
    process.exit(EXIT_CONFIG_ERROR);
  }
  const { provider, model } = resolved.review;
  const chat = selectReviewChatPort(provider);
  if (!chat) {
    process.stderr.write(
      `review stage: provider "${provider}" is not supported yet (use provider: fake for now)\n`,
    );
    process.exit(EXIT_CONFIG_ERROR);
  }
  const paths = await prepareRunArtifactPaths(cwd, runId);
  const planPath = paths.planPath;
  const planFile = Bun.file(planPath);
  if (!(await planFile.exists())) {
    process.stderr.write(`review: plan file missing at ${planPath} (run \`aimo plan\` first)\n`);
    process.exit(EXIT_OPERATIONAL_ERROR);
  }
  const planMarkdown = await planFile.text();
  const diffPath = join(paths.runDir, GIT_DIFF_AFTER_BASENAME);
  const diffFile = Bun.file(diffPath);
  const diffMarkdown = (await diffFile.exists()) ? await diffFile.text() : '';
  const { markdown } = await runReviewChat({
    model,
    chat,
    planMarkdown,
    diffMarkdown,
    transcriptMarkdown: '',
  });
  const ensured = ensureVerdictForPersistedReview(markdown, provider);
  if (!ensured.ok) {
    process.stderr.write(`${ensured.message}\n`);
    process.exit(EXIT_OPERATIONAL_ERROR);
  }
  const exitCode = exitCodeForReviewVerdict(ensured.verdict);
  await writeReviewMarkdown(paths.runDir, ensured.markdownOut);
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        run_id: runId,
        verdict: ensured.verdict,
        exit_code: exitCode,
        review_path: join(paths.runDir, REVIEW_MD_FILENAME),
      })}\n`,
    );
  } else {
    process.stdout.write(ensured.markdownOut);
    if (!ensured.markdownOut.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
  process.exit(exitCode);
}

/**
 * Registers `review` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerReviewCommand(program: Command): void {
  program
    .command('review')
    .description(
      'run reviewer stage: write .aimo/runs/<id>/review.md (VERDICT line sets exit code)',
    )
    .requiredOption('--run <id>', 'run id under .aimo/runs/<id>/ (same id as `aimo plan`)')
    .option('--profile <name>', 'profile name (defaults to config default_profile)')
    .option('--json', 'print machine-readable summary on stdout')
    .action(async (options: { run: string; profile?: string; json?: boolean }): Promise<void> => {
      await runReviewOnce(options);
    });
}
