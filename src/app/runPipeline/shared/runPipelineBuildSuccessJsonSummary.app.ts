/**
 * @file runPipelineBuildSuccessJsonSummary.app.ts
 * @layer app
 * @description Pure construction of the `aimo run --json` success payload (no I/O).
 */

import type { TReviewVerdict } from '@core/review/ParseReviewVerdict.behavior';
import type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';

import {
  runPipelineExecuteArtifactPaths,
  type TRunPipelineExecuteOk,
} from '../execute/runPipelineWriteExecuteStep.app';
import { runPipelineReviewMdPath } from '../review/runPipelineWriteReviewStep.app';

/**
 * Builds the JSON object written after a successful slice (all requested stages completed).
 * @param input - Paths, flags, and per-stage outputs (omit fields when that stage was not in the slice).
 * @returns Serializable summary object for `aimo run --json`.
 */
export function buildSuccessfulRunJsonSummary(
  input: Readonly<{
    readonly runId: string;
    readonly fromStage: TPipelineStageName;
    readonly toStage: TPipelineStageName;
    readonly needPlan: boolean;
    readonly needExec: boolean;
    readonly needRev: boolean;
    readonly planPath: string;
    readonly manifestPath: string;
    readonly runDir: string;
    readonly planMarkdown: string;
    readonly execute: TRunPipelineExecuteOk | null;
    readonly review: { readonly verdict: TReviewVerdict; readonly exitCode: number } | null;
  }>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    ok: true,
    run_id: input.runId,
    from: input.fromStage,
    to: input.toStage,
  };

  if (input.needPlan) {
    summary.plan = {
      plan_path: input.planPath,
      manifest_path: input.manifestPath,
      markdown: input.planMarkdown,
    };
  }

  if (input.needExec && input.execute !== null) {
    summary.execute = {
      exit_code: input.execute.spawnedExit,
      argv_resolved: input.execute.argvResolved,
      git_diff_head_error: input.execute.gitDiffHeadError,
      artifacts: runPipelineExecuteArtifactPaths(input.runDir),
    };
  }

  if (input.needRev && input.review !== null) {
    summary.review = {
      verdict: input.review.verdict,
      exit_code: input.review.exitCode,
      review_path: runPipelineReviewMdPath(input.runDir),
    };
  }

  return summary;
}
