/**
 * @file planStage.feature.ts
 * @layer features
 * @description Orchestrate one plan-stage chat completion (no filesystem; app/runtime writes artifacts).
 */

import { buildPlanMessages } from '@core/plan/BuildPlanMessages.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';

/**
 * Runs the planner chat once and returns assistant markdown.
 * @param input - Planner invocation bundle.
 * @param input.task - Task text.
 * @param input.model - Model id for the completion request.
 * @param input.chat - Chat completion port (e.g. fake or HTTP adapter).
 * @returns Markdown body from the first assistant choice (empty string if missing).
 */
export async function runPlanChat(input: {
  readonly task: string;
  readonly model: string;
  readonly chat: IChatCompletionPort;
}): Promise<{ readonly markdown: string }> {
  const res = await input.chat.complete({
    model: input.model,
    messages: buildPlanMessages(input.task),
  });
  const markdown = res.choices[0]?.message.content ?? '';
  return { markdown };
}
