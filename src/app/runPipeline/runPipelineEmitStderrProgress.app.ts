/**
 * @file runPipelineEmitStderrProgress.app.ts
 * @layer app
 * @description stderr progress lines for `aimo run` (stdout may stay JSON-only with `--json`).
 */

import { writeRunProgressLine } from '@runtime/bun/RunProgressStderrStyle.bun';

import type { TWritePreflightContext } from './runPipelinePreflightWrite.app';
import type { TExecuteWritePhaseResult } from './runPipelineRunWritePhases.app';
import { formatStageSliceForHumans } from './shared/formatStageSliceForHumans.app';

/**
 * Announces run id and stage slice (stderr).
 * @param ctx - Preflight context.
 */
export function emitRunStderrStarting(ctx: TWritePreflightContext): void {
  writeRunProgressLine(`starting ${ctx.runId} (${formatStageSliceForHumans(ctx.slice.stages)})`);
}

/**
 * Before planner HTTP / fake chat (stderr).
 * @param ctx - Preflight context.
 */
export function emitRunStderrPlanBefore(ctx: TWritePreflightContext): void {
  const { slice, loaded } = ctx;

  if (slice.needPlan && loaded.planChat !== null) {
    writeRunProgressLine(`plan (${loaded.planProvider} / ${loaded.planModel})…`);
  }
}

/**
 * After plan artifacts are written (stderr).
 * @param ctx - Preflight context.
 */
export function emitRunStderrPlanAfter(ctx: TWritePreflightContext): void {
  const { slice, loaded, paths } = ctx;

  if (slice.needPlan && loaded.planChat !== null) {
    writeRunProgressLine(`plan done → ${paths.planPath}`);
  }
}

/**
 * Before delegated execute (stderr).
 * @param ctx - Preflight context.
 */
export function emitRunStderrExecuteBefore(ctx: TWritePreflightContext): void {
  const { slice, loaded } = ctx;

  if (slice.needExec && loaded.execCfg !== null) {
    const exe0 = loaded.execCfg.command[0] ?? 'execute';
    writeRunProgressLine(`execute (${exe0})… (delegated output on stderr)`);
  }
}

/**
 * After delegated execute completes successfully (stderr).
 * @param slice - Resolved stage slice.
 * @param execResult - Execute phase outcome.
 */
export function emitRunStderrExecuteAfter(
  slice: TWritePreflightContext['slice'],
  execResult: TExecuteWritePhaseResult,
): void {
  if (execResult.outcome === 'ok' && slice.needExec) {
    writeRunProgressLine(`execute finished (exit ${String(execResult.execute.spawnedExit)})`);
  }
}

/**
 * Before shrinker worker calls (stderr).
 * @param shrinkerCount - Number of shrinker rows.
 */
export function emitRunStderrShrinkersBefore(shrinkerCount: number): void {
  writeRunProgressLine(`shrinkers (${String(shrinkerCount)} step(s))…`);
}

/** After shrinkers + sidecar write (stderr). */
export function emitRunStderrShrinkersAfter(): void {
  writeRunProgressLine('shrinkers done');
}

/**
 * Before reviewer chat (stderr).
 * @param ctx - Preflight context.
 */
export function emitRunStderrReviewBefore(ctx: TWritePreflightContext): void {
  const { slice, loaded } = ctx;

  if (slice.needRev && loaded.reviewChat !== null) {
    writeRunProgressLine(`review (${loaded.reviewProvider} / ${loaded.reviewModel})…`);
  }
}
