/**
 * @file ContextSource.constants.ts
 * @layer core
 * @description Controlled vocabulary for pipeline shrinker inputs (execute outputs, diffs, …).
 */

/** Large context blobs produced by the execute stage (v1). */
export const CONTEXT_SOURCE_VALUES = [
  'execute.stdout',
  'execute.stderr',
  'execute.git_diff_after',
] as const;

/** One shrinkable context source name. */
export type TContextSource = (typeof CONTEXT_SOURCE_VALUES)[number];

/**
 * @param value - Unknown string from config or CLI.
 * @returns True when `value` is a known {@link TContextSource}.
 */
export function isContextSource(value: string): value is TContextSource {
  return (CONTEXT_SOURCE_VALUES as readonly string[]).includes(value);
}
