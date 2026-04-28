/**
 * @file runPipelineChats.app.ts
 * @layer app
 * @description Pick `IChatCompletionPort` for plan/review from YAML provider ids (`aimo run`).
 */

import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';

import { createInProcessFakeChatPort } from '../wireDefaults';

/**
 * Selects a chat backend for the plan stage (extend when HTTP providers land).
 * @param provider - Value from YAML `profiles.*.plan.provider`.
 * @returns Port instance or `null` when unsupported.
 */
export function selectPlanChatPortForRun(provider: string): IChatCompletionPort | null {
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
export function selectReviewChatPortForRun(provider: string): IChatCompletionPort | null {
  if (provider === 'fake') {
    return createInProcessFakeChatPort();
  }

  return null;
}
