/**
 * @file runPipelineWriteReviewStep.app.ts
 * @layer app
 * @description Reviewer chat + `review.md` for `aimo run`.
 */

import { join } from 'node:path';

import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { ensureVerdictForPersistedReview } from '@core/review/ensureVerdictForPersistedReview.behavior';
import { exitCodeForReviewVerdict } from '@core/review/exitCodeForReviewVerdict.behavior';
import type { TReviewVerdict } from '@core/review/ParseReviewVerdict.behavior';
import { PLAN_MD_FILENAME, REVIEW_MD_FILENAME } from '@core/runs/AimoRunPaths.constants';
import { runReviewChat } from '@features/reviewStage.feature';
import { writeReviewMarkdown } from '@runtime/bun/RunWorkspace.bun';

import { loadReviewDiffAndTranscriptFromRunDir } from './runPipelineReviewContext.app';

/**
 * Outcome of the review stage (persisted markdown + verdict exit mapping).
 */
export type TRunPipelineReviewOk = {
  readonly verdict: TReviewVerdict;
  readonly exitCode: number;
  readonly markdownOut: string;
};

/**
 * Runs reviewer chat and writes `review.md`.
 * @param input - Run directory, resolved review routing, and chat port.
 * @param input.runDir - Absolute `.aimo/runs/<id>/` directory.
 * @param input.reviewModel - YAML review model id.
 * @param input.reviewProvider - YAML review provider id.
 * @param input.reviewChat - Chat port for the review stage.
 * @returns `{ ok: true, data }` with verdict + markdown, or `{ ok: false }` when plan is missing or output cannot be normalized.
 */
export async function writeRunPipelineReviewStep(input: {
  readonly runDir: string;
  readonly reviewModel: string;
  readonly reviewProvider: string;
  readonly reviewChat: IChatCompletionPort;
}): Promise<{ ok: true; readonly data: TRunPipelineReviewOk } | { ok: false }> {
  const planPath = join(input.runDir, PLAN_MD_FILENAME);
  const planFile = Bun.file(planPath);

  if (!(await planFile.exists())) {
    process.stderr.write(`run: plan file missing at ${planPath}\n`);
    return { ok: false };
  }

  const planText = await planFile.text();
  const { diffMarkdown, transcriptMarkdown } = await loadReviewDiffAndTranscriptFromRunDir(
    input.runDir,
  );
  const { markdown: reviewRaw } = await runReviewChat({
    model: input.reviewModel,
    chat: input.reviewChat,
    planMarkdown: planText,
    diffMarkdown,
    transcriptMarkdown,
  });
  const ensured = ensureVerdictForPersistedReview(reviewRaw, input.reviewProvider);

  if (!ensured.ok) {
    process.stderr.write(`${ensured.message}\n`);
    return { ok: false };
  }

  const exitCode = exitCodeForReviewVerdict(ensured.verdict);
  await writeReviewMarkdown(input.runDir, ensured.markdownOut);
  return {
    ok: true,
    data: { verdict: ensured.verdict, exitCode, markdownOut: ensured.markdownOut },
  };
}

/**
 * Absolute path to `review.md` for JSON summaries.
 * @param runDir - Absolute `.aimo/runs/<id>/` directory.
 * @returns Absolute `review.md` path.
 */
export function runPipelineReviewMdPath(runDir: string): string {
  return join(runDir, REVIEW_MD_FILENAME);
}
