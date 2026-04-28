/**
 * @file runPipelineChats.app.ts
 * @layer app
 * @description Pick `IChatCompletionPort` for plan / review / workers from YAML (`aimo run`).
 */

import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';

import {
  createInProcessFakeChatPort,
  createOpenAiCompatChatPortFromStage,
} from '../../wireDefaults';

/**
 * YAML LLM routing shape shared by plan, review, and worker profiles.
 */
export type TYamlLlmStageRouting = {
  readonly provider: string;
  readonly model: string;
  readonly base_url?: string | undefined;
};

/**
 * Selects a chat backend for a stage or worker profile (`fake`, `openrouter`, `openai-compat`).
 * @param stage - Provider + model (+ optional base URL) from merged YAML.
 * @returns Port instance or `null` when unsupported or HTTP key missing.
 */
export function selectChatPortForYamlLlmStage(
  stage: TYamlLlmStageRouting,
): IChatCompletionPort | null {
  if (stage.provider === 'fake') {
    return createInProcessFakeChatPort();
  }

  return createOpenAiCompatChatPortFromStage(stage);
}

/**
 * @param stage - Value from YAML `profiles.*.plan`.
 * @returns Port instance or `null` when unsupported.
 */
export function selectPlanChatPortForRun(stage: TYamlLlmStageRouting): IChatCompletionPort | null {
  return selectChatPortForYamlLlmStage(stage);
}

/**
 * @param stage - Value from YAML `profiles.*.review`.
 * @returns Port instance or `null` when unsupported.
 */
export function selectReviewChatPortForRun(
  stage: TYamlLlmStageRouting,
): IChatCompletionPort | null {
  return selectChatPortForYamlLlmStage(stage);
}

/**
 * @param stage - Value from YAML `workers.*`.
 * @returns Port instance or `null` when unsupported.
 */
export function selectWorkerChatPortForRun(
  stage: TYamlLlmStageRouting,
): IChatCompletionPort | null {
  return selectChatPortForYamlLlmStage(stage);
}
