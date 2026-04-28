/**
 * @file runPipelineEmitExecuteFailure.app.ts
 * @layer app
 * @description Stdout/stderr emission when delegated execute returns non-zero exit.
 */

import type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';
import { writeRunProgressErrorLine } from '@runtime/bun/RunProgressStderrStyle.bun';

import {
  runPipelineExecuteArtifactPaths,
  type TRunPipelineExecuteStepResult,
} from './runPipelineWriteExecuteStep.app';

/**
 * Writes JSON or human diagnostics for a failed execute step (after artifacts exist).
 * @param input - CLI mode, ids, run directory, and execute failure payload.
 * @param input.json - When true, one JSON error line on stdout; otherwise stderr diagnostics.
 * @param input.runId - Run directory id.
 * @param input.fromStage - Slice start stage (JSON field `from`).
 * @param input.toStage - Slice end stage (JSON field `to`).
 * @param input.runDir - Absolute `.aimo/runs/<id>/` (artifact paths in JSON).
 * @param input.failure - `spawn_fail` branch from {@link writeRunPipelineExecuteStep}.
 */
export function emitExecuteSpawnFailure(
  input: Readonly<{
    readonly json: boolean;
    readonly runId: string;
    readonly fromStage: TPipelineStageName;
    readonly toStage: TPipelineStageName;
    readonly runDir: string;
    readonly failure: Extract<TRunPipelineExecuteStepResult, { kind: 'spawn_fail' }>;
  }>,
): void {
  const art = runPipelineExecuteArtifactPaths(input.runDir);

  if (input.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        run_id: input.runId,
        from: input.fromStage,
        to: input.toStage,
        failed_at: 'execute',
        execute_exit_code: input.failure.spawnedExit,
        argv_resolved: input.failure.argvResolved,
        git_diff_head_error: input.failure.gitDiffHeadError,
        artifacts: art,
      })}\n`,
    );
    return;
  }

  if (input.failure.spawnedStderr.length > 0) {
    process.stderr.write(input.failure.spawnedStderr);
  }

  if (input.failure.spawnedStdout.length > 0) {
    process.stderr.write(input.failure.spawnedStdout);
  }

  writeRunProgressErrorLine(`execute stage exited with code ${String(input.failure.spawnedExit)}`);
}
