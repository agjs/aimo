/**
 * @file runPipelineEmitHumanWriteComplete.app.ts
 * @layer app
 * @description Human-mode stderr/stdout after successful non-JSON `aimo run` slices.
 */

import type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';

import { formatStageSliceForHumans } from './formatStageSliceForHumans.app';
import type { TRunPipelineExecuteOk } from './runPipelineWriteExecuteStep.app';

/**
 * Emits plan-only human output (planner markdown on stdout).
 * @param input - Run id, ordered stages, and planner markdown.
 * @param input.runId - Run directory id.
 * @param input.stages - Ordered slice (for stderr label).
 * @param input.planMarkdown - Planner body written to stdout with trailing newline.
 */
export function emitHumanPlanOnlyComplete(
  input: Readonly<{
    readonly runId: string;
    readonly stages: readonly TPipelineStageName[];
    readonly planMarkdown: string;
  }>,
): void {
  process.stderr.write(
    `run: wrote plan for run ${input.runId} (${formatStageSliceForHumans(input.stages)})\n`,
  );
  process.stdout.write(`${input.planMarkdown}\n`);
}

/**
 * Emits execute-only human output (delegated child streams).
 * @param input - Run id, slice label, and successful execute capture.
 * @param input.runId - Run directory id.
 * @param input.stages - Ordered slice (for stderr label).
 * @param input.execute - Spawn result (stdio echoed to stderr/stdout when non-empty).
 */
export function emitHumanExecuteOnlyComplete(
  input: Readonly<{
    readonly runId: string;
    readonly stages: readonly TPipelineStageName[];
    readonly execute: TRunPipelineExecuteOk;
  }>,
): void {
  process.stderr.write(
    `run: finished run ${input.runId} (${formatStageSliceForHumans(input.stages)})\n`,
  );
  if (input.execute.spawnedStderr.length > 0) {
    process.stderr.write(input.execute.spawnedStderr);
  }

  if (input.execute.spawnedStdout.length > 0) {
    process.stdout.write(input.execute.spawnedStdout);
  }
}

/**
 * Emits review path human output (summary line, optional execute stdio, review body).
 * @param input - Run id, slice, optional execute replay, and persisted review markdown.
 * @param input.runId - Run directory id.
 * @param input.stages - Ordered slice (for stderr label).
 * @param input.needExec - When true and `execute` is set, replay child stdio before review body.
 * @param input.execute - Successful execute capture, or null when execute was not in the slice.
 * @param input.reviewMarkdownOut - Persisted review markdown on stdout (newline ensured).
 */
export function emitHumanReviewComplete(
  input: Readonly<{
    readonly runId: string;
    readonly stages: readonly TPipelineStageName[];
    readonly needExec: boolean;
    readonly execute: TRunPipelineExecuteOk | null;
    readonly reviewMarkdownOut: string;
  }>,
): void {
  process.stderr.write(
    `run: finished run ${input.runId} (${formatStageSliceForHumans(input.stages)})\n`,
  );
  if (input.needExec && input.execute !== null && input.execute.spawnedStderr.length > 0) {
    process.stderr.write(input.execute.spawnedStderr);
  }

  if (input.needExec && input.execute !== null && input.execute.spawnedStdout.length > 0) {
    process.stdout.write(input.execute.spawnedStdout);
  }

  process.stdout.write(input.reviewMarkdownOut);
  if (!input.reviewMarkdownOut.endsWith('\n')) {
    process.stdout.write('\n');
  }
}
