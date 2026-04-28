/**
 * @file reviewStage.feature.ts
 * @layer features
 * @description Orchestrate one review-stage chat completion (no filesystem; app/runtime writes `review.md`).
 */

import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { buildReviewMessages } from '@core/review/BuildReviewMessages.behavior';

/**
 * Runs the reviewer chat once and returns assistant markdown.
 * @param input - Review invocation bundle.
 * @param input.model - Model id for the completion request.
 * @param input.chat - Chat completion port (e.g. fake or HTTP adapter).
 * @param input.planMarkdown - Contents of `plan.md`.
 * @param input.diffMarkdown - Post-execute diff text (may be empty).
 * @param input.transcriptMarkdown - Executor transcript when captured (v1 often empty).
 * @returns Markdown body from the first assistant choice (empty string if missing).
 */
export async function runReviewChat(input: {
  readonly model: string;
  readonly chat: IChatCompletionPort;
  readonly planMarkdown: string;
  readonly diffMarkdown: string;
  readonly transcriptMarkdown: string;
}): Promise<{ readonly markdown: string }> {
  const res = await input.chat.complete({
    model: input.model,
    messages: buildReviewMessages({
      planMarkdown: input.planMarkdown,
      diffMarkdown: input.diffMarkdown,
      transcriptMarkdown: input.transcriptMarkdown,
    }),
  });
  const markdown = res.choices[0]?.message.content ?? '';
  return { markdown };
}
