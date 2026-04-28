/**
 * @file EnvPrecedence.behavior.ts
 * @layer core
 * @description Pure merge rules for environment variable precedence (no `process.env` reads here).
 */

/**
 * Merges several env maps so **earlier** layers win over **later** ones for each key.
 *
 * Typical call order: `[processSnapshot, projectDotEnv, userGlobalDotEnv]` — process wins on conflicts;
 * project fills only keys missing from process; user fills only keys still missing.
 * @param layers - Highest-precedence map first; empty strings and `undefined` values are skipped.
 * @returns Merged key/value map with only defined non-empty string values.
 */
export function mergeEnvLayers(
  layers: ReadonlyArray<Readonly<Record<string, string | undefined>>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === '') {
        continue;
      }
      if (!(key in out)) {
        out[key] = value;
      }
    }
  }
  return out;
}
