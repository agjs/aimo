/**
 * @file formatStageSliceForHumans.app.ts
 * @layer app
 * @description Human-readable pipeline slice label (`plan → execute`).
 */

import type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';

/**
 * Human-readable label for a stage slice (stderr hints).
 * @param stages - Ordered slice from {@link resolvePipelineStageRange}.
 * @returns Joined stage names with arrows.
 */
export function formatStageSliceForHumans(stages: readonly TPipelineStageName[]): string {
  return stages.join(' → ');
}
