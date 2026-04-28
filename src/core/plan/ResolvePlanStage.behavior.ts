/**
 * @file ResolvePlanStage.behavior.ts
 * @layer core
 * @description Resolve `plan` stage routing from a merged {@link TAimoConfig} profile.
 */

import type { TAimoConfig } from '@core/config/AimoConfig.schema';

/**
 * Plan-stage routing extracted from YAML: `provider`, `model`, and optional `base_url`.
 */
export type TResolvedPlanStage = {
  readonly provider: string;
  readonly model: string;
  readonly base_url?: string;
};

/**
 * Looks up `profiles[name].plan` when present.
 * @param config - Merged validated configuration.
 * @param profileName - Profile key (usually `default_profile`).
 * @returns Plan routing or a human-readable error.
 */
export function resolvePlanStageForProfile(
  config: TAimoConfig,
  profileName: string,
): { ok: true; plan: TResolvedPlanStage } | { ok: false; message: string } {
  const profile = config.profiles[profileName];

  if (!profile?.plan) {
    return {
      ok: false,
      message: `profile "${profileName}" has no plan stage (add profiles.${profileName}.plan in YAML)`,
    };
  }

  const plan: TResolvedPlanStage = {
    provider: profile.plan.provider,
    model: profile.plan.model,
    ...(profile.plan.base_url !== undefined ? { base_url: profile.plan.base_url } : {}),
  };

  return { ok: true, plan };
}
