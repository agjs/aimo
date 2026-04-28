/**
 * @file runPipelineOrchestrator.app.ts
 * @layer app
 * @description Sequences plan / execute / review stage writes for `aimo run`.
 */

import { EXIT_OPERATIONAL_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import type { TReviewVerdict } from '@core/review/ParseReviewVerdict.behavior';

import { buildSuccessfulRunJsonSummary } from './runPipelineBuildSuccessJsonSummary.app';
import { runDryRunPipeline } from './runPipelineDryRun.app';
import { emitExecuteSpawnFailure } from './runPipelineEmitExecuteFailure.app';
import {
  emitHumanExecuteOnlyComplete,
  emitHumanPlanOnlyComplete,
  emitHumanReviewComplete,
} from './runPipelineEmitHumanWriteComplete.app';
import {
  preflightRunPipelineWrite,
  type TWritePreflightContext,
} from './runPipelinePreflightWrite.app';
import {
  type TExecuteWritePhaseResult,
  type TReviewWritePhaseResult,
  runPipelineExecuteWritePhase,
  runPipelinePlanWritePhase,
  runPipelineReviewWritePhase,
} from './runPipelineRunWritePhases.app';
import type { TRunPipelineOptions } from './runPipelineTypes.app';
import type { TRunPipelineExecuteOk } from './runPipelineWriteExecuteStep.app';

export type { TRunPipelineOptions } from './runPipelineTypes.app';

/**
 * Executes `aimo run` end-to-end or performs a config-only dry run.
 * @param options - Parsed CLI options.
 * @returns Process exit code per `ExitCodes` and review verdict mapping.
 */
export async function runAimoRunPipeline(options: TRunPipelineOptions): Promise<number> {
  if (options.dryRun) {
    return runDryRunPipeline(options);
  }

  return runPipelineStagesWrite(options);
}

/**
 * Runs the requested stage slice (non–dry-run).
 * @param options - Parsed CLI options.
 * @returns Process exit code for the slice.
 */
async function runPipelineStagesWrite(options: TRunPipelineOptions): Promise<number> {
  const pre = await preflightRunPipelineWrite(options);

  if (!pre.ok) {
    return pre.exitCode;
  }

  const { ctx } = pre;
  const { slice } = ctx;

  const { planMarkdown } = await runPipelinePlanWritePhase(ctx, options.task.trim());

  const execResult = await runPipelineExecuteWritePhase(ctx);

  if (execResult.outcome === 'config_or_io') {
    return execResult.exitCode;
  }

  if (execResult.outcome === 'spawn_fail') {
    emitExecuteSpawnFailure({
      json: options.json,
      runId: ctx.runId,
      fromStage: options.fromStage,
      toStage: options.toStage,
      runDir: ctx.paths.runDir,
      failure: execResult.failure,
    });
    return EXIT_OPERATIONAL_ERROR;
  }

  const executeForHumanAndJson = execResult.outcome === 'ok' ? execResult.execute : null;

  const revResult = await runPipelineReviewWritePhase(ctx);

  if (revResult.outcome === 'exit') {
    return revResult.exitCode;
  }

  const reviewForJson =
    revResult.outcome === 'ok'
      ? { verdict: revResult.verdict, exitCode: revResult.exitCode }
      : null;

  emitRunPipelineSliceSuccessOutput({
    json: options.json,
    ctx,
    options,
    slice,
    planMarkdown,
    executeForHumanAndJson,
    execResult,
    revResult,
    reviewForJson,
  });

  if (revResult.outcome === 'ok') {
    return revResult.exitCode;
  }

  return EXIT_SUCCESS;
}

/**
 * Writes JSON summary or human completion lines after a successful slice.
 * @param input - JSON vs human mode, preflight context, slice, stage outputs, and review summary for JSON.
 * @param input.json - Emit `--json` success line on stdout instead of human emitters.
 * @param input.ctx - Preflight paths, run id, and loaded bindings.
 * @param input.options - CLI `from` / `to` (for JSON payload).
 * @param input.slice - Stage flags and ordered stage names.
 * @param input.planMarkdown - Planner markdown when plan ran.
 * @param input.executeForHumanAndJson - Execute capture when execute completed, else null.
 * @param input.execResult - Execute phase outcome (for execute-only human branch).
 * @param input.revResult - Review phase outcome (for review human branch).
 * @param input.reviewForJson - Verdict + exit for JSON when review completed, else null.
 */
function emitRunPipelineSliceSuccessOutput(
  input: Readonly<{
    readonly json: boolean;
    readonly ctx: TWritePreflightContext;
    readonly options: TRunPipelineOptions;
    readonly slice: TWritePreflightContext['slice'];
    readonly planMarkdown: string;
    readonly executeForHumanAndJson: TRunPipelineExecuteOk | null;
    readonly execResult: TExecuteWritePhaseResult;
    readonly revResult: TReviewWritePhaseResult;
    readonly reviewForJson: { readonly verdict: TReviewVerdict; readonly exitCode: number } | null;
  }>,
): void {
  const {
    json,
    ctx,
    options,
    slice,
    planMarkdown,
    executeForHumanAndJson,
    execResult,
    revResult,
    reviewForJson,
  } = input;

  if (json) {
    const summary = buildSuccessfulRunJsonSummary({
      runId: ctx.runId,
      fromStage: options.fromStage,
      toStage: options.toStage,
      needPlan: slice.needPlan,
      needExec: slice.needExec,
      needRev: slice.needRev,
      planPath: ctx.paths.planPath,
      manifestPath: ctx.paths.manifestPath,
      runDir: ctx.paths.runDir,
      planMarkdown,
      execute: executeForHumanAndJson,
      review: reviewForJson,
    });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return;
  }

  if (revResult.outcome === 'ok') {
    emitHumanReviewComplete({
      runId: ctx.runId,
      stages: slice.stages,
      needExec: slice.needExec,
      execute: executeForHumanAndJson,
      reviewMarkdownOut: revResult.markdownOut,
    });
    return;
  }

  if (slice.needPlan && !slice.needExec && !slice.needRev) {
    emitHumanPlanOnlyComplete({
      runId: ctx.runId,
      stages: slice.stages,
      planMarkdown,
    });
    return;
  }

  if (slice.needExec && !slice.needRev && execResult.outcome === 'ok') {
    emitHumanExecuteOnlyComplete({
      runId: ctx.runId,
      stages: slice.stages,
      execute: execResult.execute,
    });
  }
}
