/**
 * @file RunManifest.types.ts
 * @layer core
 * @description Minimal `manifest.json` written at the start of the plan stage.
 */

import type { TSchemaVersion } from '@core/contracts/SchemaVersion.constants';

/**
 * v1 manifest persisted next to `plan.md` after a successful plan stage.
 * Fields mirror merged config routing plus clock-derived `created_at_ms` (see {@link IClockPort}).
 */
export interface IRunManifestPlan {
  readonly schema_version: TSchemaVersion;
  readonly run_id: string;
  readonly stage: 'plan';
  readonly created_at_ms: number;
  readonly profile: string;
  readonly provider: string;
  readonly model: string;
}
