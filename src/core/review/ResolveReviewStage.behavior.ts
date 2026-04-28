/**
 * @file ResolveReviewStage.behavior.ts
 * @layer core
 * @description Resolve `review` stage routing from a merged {@link TAimoConfig} profile.
 */

import type { TAimoConfig } from '@core/config/AimoConfig.schema';

/**
 * Review-stage routing extracted from YAML: `provider`, `model`, and optional `base_url`.
 */
export type TResolvedReviewStage = {
  readonly provider: string;
  readonly model: string;
  readonly base_url?: string;
};

/**
 * Looks up `profiles[name].review` when present.
 * @param config - Merged validated configuration.
 * @param profileName - Profile key (usually `default_profile`).
 * @returns Review routing or a human-readable error.
 */
export function resolveReviewStageForProfile(
  config: TAimoConfig,
  profileName: string,
): { ok: true; review: TResolvedReviewStage } | { ok: false; message: string } {
  const profile = config.profiles[profileName];
  if (!profile?.review) {
    return {
      ok: false,
      message: `profile "${profileName}" has no review stage (add profiles.${profileName}.review in YAML)`,
    };
  }
  const review: TResolvedReviewStage = {
    provider: profile.review.provider,
    model: profile.review.model,
    ...(profile.review.base_url !== undefined ? { base_url: profile.review.base_url } : {}),
  };
  return { ok: true, review };
}
