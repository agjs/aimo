/**
 * @file runPipelineEmitHumanWriteComplete.app.ts
 * @layer app
 * @description Human-mode stderr/stdout after successful non-JSON `aimo run` slices.
 */

import type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';
import { writeRunProgressLine } from '@runtime/bun/RunProgressStderrStyle.bun';

import { formatStageSliceForHumans } from './formatStageSliceForHumans.app';

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
  writeRunProgressLine(
    `wrote plan for run ${input.runId} (${formatStageSliceForHumans(input.stages)})`,
  );
  process.stdout.write(`${input.planMarkdown}\n`);
}

/**
 * Emits execute-only human output (delegated child stdio was streamed live during `run`).
 * @param input - Run id and slice label.
 * @param input.runId - Run directory id.
 * @param input.stages - Ordered slice (for stderr label).
 */
export function emitHumanExecuteOnlyComplete(
  input: Readonly<{
    readonly runId: string;
    readonly stages: readonly TPipelineStageName[];
  }>,
): void {
  writeRunProgressLine(`finished run ${input.runId} (${formatStageSliceForHumans(input.stages)})`);
}

/**
 * Emits review path human output (summary line and persisted review markdown).
 * @param input - Run id, slice, and persisted review markdown (execute stdio was streamed live).
 * @param input.runId - Run directory id.
 * @param input.stages - Ordered slice (for stderr label).
 * @param input.reviewMarkdownOut - Persisted review markdown on stdout (newline ensured).
 */
export function emitHumanReviewComplete(
  input: Readonly<{
    readonly runId: string;
    readonly stages: readonly TPipelineStageName[];
    readonly reviewMarkdownOut: string;
  }>,
): void {
  writeRunProgressLine(`finished run ${input.runId} (${formatStageSliceForHumans(input.stages)})`);

  process.stdout.write(input.reviewMarkdownOut);
  if (!input.reviewMarkdownOut.endsWith('\n')) {
    process.stdout.write('\n');
  }
}
