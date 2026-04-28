/**
 * @file workersStage.feature.ts
 * @layer features
 * @description One shrinker worker chat completion (no filesystem).
 */

import type { TWorkerProfile } from '@core/config/AimoConfig.schema';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { buildWorkerShrinkMessages } from '@core/workers/BuildWorkerMessages.behavior';
import { truncateWorkerInputText } from '@core/workers/TruncateWorkerInput.behavior';

/**
 * Result of {@link runWorkerChat} including accounting for the sidecar.
 */
export type TRunWorkerChatResult = {
  readonly markdown: string;
  readonly charsIn: number;
  readonly charsOut: number;
  readonly truncatedIn: boolean;
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
};

/**
 * Runs one worker completion over capped raw text.
 * @param input - Worker invocation bundle.
 * @param input.worker - Resolved worker profile (model, caps).
 * @param input.chat - Chat port (fake or HTTP).
 * @param input.sourceName - Context source id for the prompt tag.
 * @param input.rawText - Full raw UTF-8 (truncated to `max_chars_in` before the call).
 * @returns Assistant markdown (truncated to `max_chars_out`) plus usage metadata when present.
 */
export async function runWorkerChat(input: {
  readonly worker: TWorkerProfile;
  readonly chat: IChatCompletionPort;
  readonly sourceName: string;
  readonly rawText: string;
}): Promise<TRunWorkerChatResult> {
  const capped = truncateWorkerInputText(input.rawText, input.worker.max_chars_in);
  const messages = buildWorkerShrinkMessages({
    source: input.sourceName,
    rawTextTruncated: capped.text,
    maxCharsOut: input.worker.max_chars_out,
  });
  const res = await input.chat.complete({
    model: input.worker.model,
    messages,
  });
  let markdown = res.choices[0]?.message.content ?? '';

  if (markdown.length > input.worker.max_chars_out) {
    markdown = markdown.slice(0, input.worker.max_chars_out);
  }

  const usage =
    res.usage !== undefined
      ? {
          prompt_tokens: res.usage.prompt_tokens,
          completion_tokens: res.usage.completion_tokens,
          total_tokens: res.usage.total_tokens,
        }
      : undefined;

  return {
    markdown,
    charsIn: capped.text.length,
    charsOut: markdown.length,
    truncatedIn: capped.truncated,
    ...(usage !== undefined ? { usage } : {}),
  };
}
