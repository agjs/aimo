/**
 * @file resolvePipelineStageRange.behavior.ts
 * @layer core
 * @description Parse and validate `aimo run --from/--to` stage slices (plan → execute → review).
 */

/** Ordered pipeline stage names for Milestone A. */
export type TPipelineStageName = 'plan' | 'execute' | 'review';

const STAGE_ORDER: Record<TPipelineStageName, number> = {
  plan: 0,
  execute: 1,
  review: 2,
};

/**
 * Parses a single stage token from CLI flags.
 * @param raw - Lowercased or mixed-case token from `--from` / `--to`.
 * @returns Parsed stage or a human-readable error.
 */
export function parsePipelineStageName(
  raw: string,
): { ok: true; readonly stage: TPipelineStageName } | { ok: false; readonly message: string } {
  const s = raw.trim().toLowerCase();

  if (s === 'plan' || s === 'execute' || s === 'review') {
    return { ok: true, stage: s };
  }

  return {
    ok: false,
    message: `invalid stage "${raw.trim()}" (expected plan, execute, or review)`,
  };
}

/**
 * Builds the inclusive ordered list of stages between `--from` and `--to`.
 * @param from - First stage to run.
 * @param to - Last stage to run (must not precede `from` in the pipeline).
 * @returns Contiguous stage list or an error when `from` comes after `to`.
 */
export function resolvePipelineStageRange(
  from: TPipelineStageName,
  to: TPipelineStageName,
):
  | { ok: true; readonly stages: readonly TPipelineStageName[] }
  | { ok: false; readonly message: string } {
  const a = STAGE_ORDER[from];
  const b = STAGE_ORDER[to];

  if (a > b) {
    return {
      ok: false,
      message: `run: --from ${from} cannot be after --to ${to} (pipeline order is plan → execute → review)`,
    };
  }

  const all: readonly TPipelineStageName[] = ['plan', 'execute', 'review'];
  const stages = all.filter((name) => STAGE_ORDER[name] >= a && STAGE_ORDER[name] <= b);

  return { ok: true, stages };
}
