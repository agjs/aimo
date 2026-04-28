/**
 * @file SchemaVersion.constants.ts
 * @layer core
 * @description Single source of truth for persisted artifact schema versions (`manifest.json`, scorecards, caches).
 */

/**
 * Current schema version written to all v1 artifacts.
 * Bump only when introducing a breaking layout change; add migrations under `src/core/migrations/` when that happens.
 */
export const CURRENT_SCHEMA_VERSION = 1 as const;

/** Type alias for fields that mirror persisted `schema_version`. */
export type TSchemaVersion = typeof CURRENT_SCHEMA_VERSION;
