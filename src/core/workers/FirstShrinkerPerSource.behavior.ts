/**
 * @file FirstShrinkerPerSource.behavior.ts
 * @layer core
 * @description Deduplicate shrinker rows so each {@link TContextSource} runs at most once (first wins).
 */

import type { TContextSource } from '@core/contextSources/ContextSource.constants';

/**
 * @param shrinkers - Ordered list from YAML `pipeline.shrinkers`.
 * @returns First entry per distinct `source` (stable order of first appearance).
 */
export function firstShrinkerWorkerPerSource(
  shrinkers: ReadonlyArray<{ readonly source: TContextSource; readonly worker: string }>,
): ReadonlyArray<{ readonly source: TContextSource; readonly worker: string }> {
  const seen = new Set<TContextSource>();
  const out: { readonly source: TContextSource; readonly worker: string }[] = [];

  for (const row of shrinkers) {
    if (seen.has(row.source)) {
      continue;
    }

    seen.add(row.source);
    out.push(row);
  }

  return out;
}
