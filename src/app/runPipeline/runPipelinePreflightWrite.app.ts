/**
 * @file runPipelinePreflightWrite.app.ts
 * @layer app
 * @description Resolve slice, run id, config bindings, and artifact paths before stage writes.
 */

import { EXIT_CONFIG_ERROR } from '@core/contracts/ExitCodes.constants';
import { prepareRunArtifactPaths } from '@runtime/bun/RunWorkspace.bun';

import {
  type TPipelineSlice,
  resolvePipelineSliceForRun,
  validateTaskRequiredForPlan,
} from './dryRunValidateBindings.app';
import { resolveRunIdForPipelineSlice } from './resolveRunIdForPipelineSlice.app';
import { loadRunPipelineStageBindings, type TRunPipelineLoaded } from './runPipelineLoadStages.app';
import type { TRunPipelineOptions } from './runPipelineTypes.app';

/**
 * Immutable context produced after preflight succeeds.
 */
export type TWritePreflightContext = {
  readonly cwd: string;
  readonly slice: TPipelineSlice;
  readonly runId: string;
  readonly paths: Awaited<ReturnType<typeof prepareRunArtifactPaths>>;
  readonly loaded: TRunPipelineLoaded;
};

/**
 * Validates options and builds filesystem paths for a non–dry-run slice.
 * @param options - Parsed CLI options (`dryRun` must be false).
 * @returns Preflight context or an exit code to return.
 */
export async function preflightRunPipelineWrite(
  options: TRunPipelineOptions,
): Promise<
  | { readonly ok: false; readonly exitCode: number }
  | { readonly ok: true; readonly ctx: TWritePreflightContext }
> {
  const sliceRes = resolvePipelineSliceForRun(options.fromStage, options.toStage);

  if (!sliceRes.ok) {
    process.stderr.write(`${sliceRes.message}\n`);
    return { ok: false, exitCode: EXIT_CONFIG_ERROR };
  }

  const { slice } = sliceRes;

  const taskCheck = validateTaskRequiredForPlan(slice.needPlan, options.task);

  if (!taskCheck.ok) {
    process.stderr.write(taskCheck.message);
    return { ok: false, exitCode: EXIT_CONFIG_ERROR };
  }

  const runIdRes = resolveRunIdForPipelineSlice(slice.startsAtPlan, options.runId);

  if (!runIdRes.ok) {
    return { ok: false, exitCode: runIdRes.exitCode };
  }

  const runId = runIdRes.runId;

  const pipelineOpts: { readonly keepRaw?: boolean } =
    options.keepRaw === undefined ? {} : { keepRaw: options.keepRaw };

  const loaded = await loadRunPipelineStageBindings(
    options.cwd,
    options.profile,
    slice.needPlan,
    slice.needExec,
    slice.needRev,
    pipelineOpts,
  );

  if (!loaded.ok) {
    return { ok: false, exitCode: loaded.exitCode };
  }

  const paths = await prepareRunArtifactPaths(options.cwd, runId);
  return {
    ok: true,
    ctx: { cwd: options.cwd, slice, runId, paths, loaded: loaded.data },
  };
}
