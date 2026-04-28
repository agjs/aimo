/**
 * @file RunManifestJson.behavior.ts
 * @layer core
 * @description Serialize run manifest objects to stable JSON text (no I/O).
 */

import type { IRunManifestPlan } from './RunManifest.types';

/**
 * Pretty-prints a plan-stage manifest for writing to `manifest.json`.
 * @param manifest - Structured manifest fields.
 * @returns UTF-8 JSON with trailing newline.
 */
export function serializePlanManifestJson(manifest: IRunManifestPlan): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
