/**
 * @file resolveSessionExecutionLlm.behavior.ts
 * @layer core
 * @description Resolve which OpenAI-compatible stage `aimo session` should use for free-text + tool rounds.
 */

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import { extractModelIdFromDelegatedArgv } from '@core/execute/extractModelIdFromDelegatedArgv.behavior';

/**
 * LLM routing for session (same shape as plan / review in YAML).
 */
export type TSessionExecutionLlmStage = {
  readonly provider: string;
  readonly model: string;
  readonly base_url?: string;
};

export type TSessionExecutionLlmSource = 'execution_llm' | 'delegated_argv' | 'plan';

/**
 * Picks the session chat model: explicit execution_llm, else model id after --model in delegated execute
 * (reusing plan provider and base_url for the API), else plan.
 * @param config - Merged config.
 * @param profileName - Active profile.
 * @returns Resolved stage and provenance, or an error when plan is missing.
 */
export function resolveSessionExecutionLlmForProfile(
  config: TAimoConfig,
  profileName: string,
):
  | { ok: true; stage: TSessionExecutionLlmStage; source: TSessionExecutionLlmSource }
  | { ok: false; message: string } {
  const p = config.profiles[profileName];
  const plan = p?.plan;

  if (!plan) {
    return {
      ok: false,
      message: `profile "${profileName}" has no plan stage (required for session API routing)`,
    };
  }

  if (p?.execution_llm) {
    const s = p.execution_llm;
    return {
      ok: true,
      stage: {
        provider: s.provider,
        model: s.model,
        ...(s.base_url !== undefined ? { base_url: s.base_url } : {}),
      },
      source: 'execution_llm',
    };
  }

  if (p?.execute?.type === 'delegated') {
    const mid = extractModelIdFromDelegatedArgv(p.execute.command);

    if (mid !== null) {
      return {
        ok: true,
        stage: {
          provider: plan.provider,
          model: mid,
          ...(plan.base_url !== undefined ? { base_url: plan.base_url } : {}),
        },
        source: 'delegated_argv',
      };
    }
  }

  return {
    ok: true,
    stage: {
      provider: plan.provider,
      model: plan.model,
      ...(plan.base_url !== undefined ? { base_url: plan.base_url } : {}),
    },
    source: 'plan',
  };
}
