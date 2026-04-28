/**
 * @file BuildPlanMessages.behavior.ts
 * @layer core
 * @description Build chat messages for the planner model (pure; no network).
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';

/**
 * Builds a minimal two-turn planner prompt from the user task string.
 * @param task - High-level task description for the repository / change.
 * @returns Messages suitable for {@link IChatCompletionPort.complete}.
 */
export function buildPlanMessages(task: string): readonly IChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a planning assistant. Respond with a concise markdown plan: goals, steps, risks, and open questions. No preamble.',
    },
    { role: 'user', content: task },
  ];
}
