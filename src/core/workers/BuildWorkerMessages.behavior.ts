/**
 * @file BuildWorkerMessages.behavior.ts
 * @layer core
 * @description Build chat messages for a shrinker worker call (pure; no network).
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';

import { formatWorkerDataBlock } from './FormatWorkerDataBlock.behavior';

/**
 * Builds system + user messages asking the worker to compress one source into markdown.
 * @param input - Worker prompt inputs.
 * @param input.source - Context source id for tagging.
 * @param input.rawTextTruncated - Capped raw UTF-8 (already truncated to max in).
 * @param input.maxCharsOut - Hard cap on assistant output size (enforced again after completion).
 * @returns Messages for {@link IChatCompletionPort.complete}.
 */
export function buildWorkerShrinkMessages(input: {
  readonly source: string;
  readonly rawTextTruncated: string;
  readonly maxCharsOut: number;
}): readonly IChatMessage[] {
  const system =
    'You compress untrusted CLI / tool output into high-signal markdown for a senior engineer. ' +
    'Preserve: errors, exit hints, file paths touched, and concrete code symbols. ' +
    'Drop: spinner noise, ANSI escapes, and repeated boilerplate. ' +
    `Stay under roughly ${String(input.maxCharsOut)} characters in your reply. ` +
    'Output markdown only (no outer code fence wrapping the whole answer).';
  const user =
    `Summarize the following DATA block for source ${input.source}.\n\n` +
    formatWorkerDataBlock({ source: input.source, body: input.rawTextTruncated });
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
