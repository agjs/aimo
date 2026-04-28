/**
 * @file runPipelineRunWritePhases.app.ts
 * @layer app
 * @description Plan / execute / review write phases for `aimo run` (after preflight).
 */

import { EXIT_CONFIG_ERROR, EXIT_OPERATIONAL_ERROR } from '@core/contracts/ExitCodes.constants';
import type { TReviewVerdict } from '@core/review/ParseReviewVerdict.behavior';
import { writeRunProgressErrorLine } from '@runtime/bun/RunProgressStderrStyle.bun';

import {
  type TRunPipelineExecuteOk,
  type TRunPipelineExecuteStepResult,
  writeRunPipelineExecuteStep,
} from './execute/runPipelineWriteExecuteStep.app';
import { writeRunPipelinePlanStep } from './plan/runPipelineWritePlanStep.app';
import { writeRunPipelineReviewStep } from './review/runPipelineWriteReviewStep.app';
import type { TWritePreflightContext } from './runPipelinePreflightWrite.app';

/**
 * Markdown from the plan stage (empty string when plan was not in the slice).
 * @param ctx - Preflight context.
 * @param task - Trimmed planner task.
 * @returns Plan markdown (possibly empty).
 */
export async function runPipelinePlanWritePhase(
  ctx: TWritePreflightContext,
  task: string,
): Promise<{ readonly planMarkdown: string }> {
  const { slice, paths, loaded: L, runId } = ctx;

  if (!slice.needPlan || L.planChat === null) {
    return { planMarkdown: '' };
  }

  const { markdown } = await writeRunPipelinePlanStep({
    planPath: paths.planPath,
    manifestPath: paths.manifestPath,
    runId,
    task,
    profileName: L.profileName,
    planProvider: L.planProvider,
    planModel: L.planModel,
    planChat: L.planChat,
  });
  return { planMarkdown: markdown };
}

/** Outcome of the execute write phase. */
export type TExecuteWritePhaseResult =
  | { readonly outcome: 'skipped' }
  | { readonly outcome: 'config_or_io'; readonly exitCode: number }
  | {
      readonly outcome: 'spawn_fail';
      readonly failure: Extract<TRunPipelineExecuteStepResult, { kind: 'spawn_fail' }>;
    }
  | { readonly outcome: 'ok'; readonly execute: TRunPipelineExecuteOk };

/**
 * Runs delegated execute when the slice includes it.
 * @param ctx - Preflight context.
 * @returns Skipped, config/I/O failure, spawn failure, or successful execute payload.
 */
export async function runPipelineExecuteWritePhase(
  ctx: TWritePreflightContext,
): Promise<TExecuteWritePhaseResult> {
  const { cwd, slice, paths, runId, loaded: L } = ctx;

  if (!slice.needExec) {
    return { outcome: 'skipped' };
  }

  if (L.execCfg === null) {
    writeRunProgressErrorLine('internal error — execute stage configuration missing');
    return { outcome: 'config_or_io', exitCode: EXIT_OPERATIONAL_ERROR };
  }

  const ex = await writeRunPipelineExecuteStep({
    cwd,
    runDir: paths.runDir,
    runId,
    execCfg: L.execCfg,
  });

  if (ex.kind === 'missing_plan') {
    return { outcome: 'config_or_io', exitCode: EXIT_OPERATIONAL_ERROR };
  }

  if (ex.kind === 'anchor_fail') {
    return { outcome: 'config_or_io', exitCode: EXIT_CONFIG_ERROR };
  }

  if (ex.kind === 'spawn_fail') {
    return { outcome: 'spawn_fail', failure: ex };
  }

  return { outcome: 'ok', execute: ex.data };
}

/** Outcome of the review write phase. */
export type TReviewWritePhaseResult =
  | { readonly outcome: 'skipped' }
  | { readonly outcome: 'exit'; readonly exitCode: number }
  | {
      readonly outcome: 'ok';
      readonly verdict: TReviewVerdict;
      readonly exitCode: number;
      readonly markdownOut: string;
    };

/**
 * Runs reviewer chat when the slice includes review.
 * @param ctx - Preflight context.
 * @returns Skipped, early exit, or review verdict and markdown.
 */
export async function runPipelineReviewWritePhase(
  ctx: TWritePreflightContext,
): Promise<TReviewWritePhaseResult> {
  const { slice, paths, loaded: L } = ctx;

  if (!slice.needRev || L.reviewChat === null) {
    return { outcome: 'skipped' };
  }

  const rev = await writeRunPipelineReviewStep({
    runDir: paths.runDir,
    reviewModel: L.reviewModel,
    reviewProvider: L.reviewProvider,
    reviewChat: L.reviewChat,
  });

  if (!rev.ok) {
    return { outcome: 'exit', exitCode: EXIT_OPERATIONAL_ERROR };
  }

  return {
    outcome: 'ok',
    verdict: rev.data.verdict,
    exitCode: rev.data.exitCode,
    markdownOut: rev.data.markdownOut,
  };
}
