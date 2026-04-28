/**
 * @file deepMergeRecord.behavior.ts
 * @layer core
 * @description Pure deep-merge for JSON-like config maps (later layers override earlier ones per key path).
 */

/**
 * Deep-merges plain objects so **later** layers win on key conflicts. Arrays and scalars from the
 * overlay replace the base value entirely (arrays are not concatenated).
 *
 * **Config precedence (aimo YAML):** call with `[userGlobalParsed, projectParsed]` so
 * `./aimo.yaml` overrides `~/.config/ai-model-orchestrator/config.yaml` on overlaps.
 * @param layers - Parsed YAML roots as plain objects; skip empty layers with `{}`.
 * @returns A new mutable object tree.
 */
export function mergeConfigRecordLayers(
  layers: ReadonlyArray<Readonly<Record<string, unknown>>>,
): Record<string, unknown> {
  if (layers.length === 0) {
    return {};
  }
  let acc: Record<string, unknown> = { ...layers[0] };
  for (const layer of layers.slice(1)) {
    acc = deepMergeWithOverlay(acc, layer);
  }
  return acc;
}

/**
 * Merges `overlay` onto `base`, returning a new object.
 * @param base - Lower-precedence map.
 * @param overlay - Higher-precedence map.
 * @returns New object tree; does not mutate inputs.
 */
function deepMergeWithOverlay(
  base: Readonly<Record<string, unknown>>,
  overlay: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      out[key] = deepMergeWithOverlay(baseValue, overlayValue);
    } else {
      out[key] = overlayValue;
    }
  }
  return out;
}

/**
 * @param value - Any parsed YAML value.
 * @returns True if `value` is a non-null object and not an array.
 */
function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
