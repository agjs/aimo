/**
 * @file ResolveWorker.behavior.ts
 * @layer core
 * @description Look up a named worker profile from merged config.
 */

import type { TAimoConfig, TWorkerProfile } from '@core/config/AimoConfig.schema';

/**
 * @param config - Merged validated configuration.
 * @param workerName - Key under top-level `workers:`.
 * @returns Profile or error message.
 */
export function resolveWorkerProfile(
  config: TAimoConfig,
  workerName: string,
): { ok: true; profile: TWorkerProfile } | { ok: false; message: string } {
  const profile = config.workers[workerName];

  if (profile === undefined) {
    return { ok: false, message: `worker "${workerName}" is not defined in workers` };
  }

  return { ok: true, profile };
}
