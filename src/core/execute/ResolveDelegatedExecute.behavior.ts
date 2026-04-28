/**
 * @file ResolveDelegatedExecute.behavior.ts
 * @layer core
 * @description Resolve delegated `execute` stage from a merged profile (Milestone A6).
 */

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import { PLAN_PATH_TEMPLATE_TOKEN } from '@core/config/AimoConfig.schema';

/**
 * Delegated execute routing from YAML: argv-only `command` and optional plan-on-stdin policy.
 */
export type TResolvedDelegatedExecute = {
  readonly command: readonly string[];
  readonly pipePlanToStdin: boolean;
};

/**
 * Looks up `profiles[name].execute` when it is `type: delegated`.
 * @param config - Merged validated configuration.
 * @param profileName - Profile key (usually `default_profile`).
 * @returns Delegated argv + stdin policy, or a human-readable error.
 */
export function resolveDelegatedExecuteForProfile(
  config: TAimoConfig,
  profileName: string,
): { ok: true; execute: TResolvedDelegatedExecute } | { ok: false; message: string } {
  const profile = config.profiles[profileName];
  const ex = profile?.execute;

  if (!ex) {
    return {
      ok: false,
      message: `profile "${profileName}" has no execute stage (add profiles.${profileName}.execute in YAML)`,
    };
  }

  if (ex.type !== 'delegated') {
    return {
      ok: false,
      message: `execute stage is type "${ex.type}" — aimo execute only supports delegated in Milestone A6`,
    };
  }

  const pipePlanToStdin = ex.stdin_file === PLAN_PATH_TEMPLATE_TOKEN;
  return {
    ok: true,
    execute: { command: ex.command, pipePlanToStdin },
  };
}
