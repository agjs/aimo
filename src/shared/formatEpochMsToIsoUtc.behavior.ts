/**
 * @file formatEpochMsToIsoUtc.behavior.ts
 * @layer shared
 * @description ISO 8601 UTC string from epoch ms (caller supplies wall time via {@link IClockPort}).
 */

/**
 * Formats epoch milliseconds as ISO 8601 UTC (e.g. `2026-04-28T12:00:00.000Z`).
 * @param epochMs - Milliseconds since Unix epoch.
 * @returns ISO string suitable for event `at` fields.
 */
export function formatEpochMsToIsoUtc(epochMs: number): string {
  return new Date(epochMs).toISOString();
}
