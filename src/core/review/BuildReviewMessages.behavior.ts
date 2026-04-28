/**
 * @file BuildReviewMessages.behavior.ts
 * @layer core
 * @description Build chat messages for the reviewer model (pure; no network).
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';

/**
 * Builds reviewer system + user messages from plan, diff, and optional executor transcript.
 * @param input - Context blobs (markdown / unified diff text).
 * @param input.planMarkdown - Contents of `plan.md`.
 * @param input.diffMarkdown - Post-execute `git diff HEAD` text (may be empty).
 * @param input.transcriptMarkdown - Executor stdout log when present (v1 often empty).
 * @returns Messages suitable for {@link IChatCompletionPort.complete}.
 */
export function buildReviewMessages(input: {
  readonly planMarkdown: string;
  readonly diffMarkdown: string;
  readonly transcriptMarkdown: string;
}): readonly IChatMessage[] {
  const system =
    'You are a senior code reviewer. Write concise markdown: summary, findings, risks. ' +
    'End with exactly one final line (no text after it) of the form VERDICT: pass OR VERDICT: changes_requested OR VERDICT: fail (lowercase tokens after the colon).';
  const transcript =
    input.transcriptMarkdown.trim().length > 0
      ? input.transcriptMarkdown
      : '(none — delegated executor did not capture a transcript yet.)';
  const user = `## Plan\n\n${input.planMarkdown}\n\n## Diff (after execute)\n\n${input.diffMarkdown}\n\n## Transcript\n\n${transcript}\n`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
