/**
 * @file runPipelineWriteExecuteStep.app.ts
 * @layer app
 * @description Delegated execute + diff artifacts for `aimo run`.
 */

import { join } from 'node:path';

import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { assertPlanPathAnchoredInRepoRoot } from '@core/execute/assertPlanPathAnchoredInRepoRoot.behavior';
import { serializeExecuteResultJson } from '@core/execute/ExecuteResultJson.behavior';
import type { TResolvedDelegatedExecute } from '@core/execute/ResolveDelegatedExecute.behavior';
import { substitutePlanPathInArgv } from '@core/execute/substitutePlanPathInArgv.behavior';
import {
  GIT_DIFF_AFTER_BASENAME,
  GIT_DIFF_BEFORE_BASENAME,
  PLAN_MD_FILENAME,
  EXECUTE_RESULT_JSON_BASENAME,
} from '@core/runs/AimoRunPaths.constants';
import { runDelegatedArgv } from '@runtime/bun/DelegatedSpawn.bun';
import { readGitDiffHeadText } from '@runtime/bun/GitDiffHead.bun';
import {
  writeRunProgressWarnLine,
  writeRunStyledMessage,
} from '@runtime/bun/RunProgressStderrStyle.bun';
import { writeExecuteStageArtifacts } from '@runtime/bun/RunWorkspace.bun';

import { formatGitDiffHeadError } from '../shared/formatGitDiffHeadError.app';

/**
 * Result of a successful delegated execute (spawn exit 0).
 */
export type TRunPipelineExecuteOk = {
  readonly argvResolved: readonly string[];
  readonly gitDiffHeadError: string | null;
  readonly spawnedExit: number;
  readonly spawnedStdout: string;
  readonly spawnedStderr: string;
};

/**
 * Discriminated outcome after execute artifacts are written.
 */
export type TRunPipelineExecuteStepResult =
  | { readonly kind: 'ok'; readonly data: TRunPipelineExecuteOk }
  | { readonly kind: 'missing_plan' }
  | { readonly kind: 'anchor_fail' }
  | {
      readonly kind: 'spawn_fail';
      readonly spawnedExit: number;
      readonly argvResolved: readonly string[];
      readonly gitDiffHeadError: string | null;
      readonly spawnedStdout: string;
      readonly spawnedStderr: string;
    };

/**
 * Runs delegated argv for an existing `plan.md`, writes diff + execute result files.
 * @param input - Cwd, run dir, and resolved delegated argv template.
 * @param input.cwd - Repository root.
 * @param input.runDir - Absolute `.aimo/runs/<id>/` directory.
 * @param input.runId - Run id (for serialized execute record).
 * @param input.execCfg - Resolved delegated argv + stdin policy.
 * @returns Discriminated outcome after artifacts are written.
 */
export async function writeRunPipelineExecuteStep(input: {
  readonly cwd: string;
  readonly runDir: string;
  readonly runId: string;
  readonly execCfg: TResolvedDelegatedExecute;
}): Promise<TRunPipelineExecuteStepResult> {
  const planPath = join(input.runDir, PLAN_MD_FILENAME);
  const planExists = await Bun.file(planPath).exists();

  if (!planExists) {
    writeRunProgressWarnLine(
      `plan file missing at ${planPath} (run a slice that includes plan first, or \`aimo plan\`)`,
    );
    return { kind: 'missing_plan' };
  }

  const anchored = assertPlanPathAnchoredInRepoRoot({ repoRoot: input.cwd, planPath });

  if (!anchored.ok) {
    writeRunStyledMessage(`${anchored.message}\n`, 'warn');
    return { kind: 'anchor_fail' };
  }

  const argvResolved = substitutePlanPathInArgv(input.execCfg.command, anchored.planPathResolved);
  const stdinPath = input.execCfg.pipePlanToStdin ? anchored.planPathResolved : undefined;

  const beforeDiff = await readGitDiffHeadText(input.cwd);

  const spawned =
    stdinPath !== undefined
      ? await runDelegatedArgv({
          cwd: input.cwd,
          argv: [...argvResolved],
          stdinPlanFilePath: stdinPath,
          streamProgressToStderr: true,
        })
      : await runDelegatedArgv({
          cwd: input.cwd,
          argv: [...argvResolved],
          streamProgressToStderr: true,
        });

  const afterDiff = await readGitDiffHeadText(input.cwd);

  const gitDiffHeadError = formatGitDiffHeadError(beforeDiff, afterDiff);

  const executeRecord = {
    schema_version: CURRENT_SCHEMA_VERSION,
    run_id: input.runId,
    stage: 'execute' as const,
    exit_code: spawned.exitCode,
    git_diff_head_error: gitDiffHeadError,
  };

  await writeExecuteStageArtifacts(input.runDir, {
    gitDiffBefore: beforeDiff.ok ? beforeDiff.text : '',
    gitDiffAfter: afterDiff.ok ? afterDiff.text : '',
    executeResultJson: serializeExecuteResultJson(executeRecord),
    executeStdout: spawned.stdout,
    executeStderr: spawned.stderr,
  });

  if (spawned.exitCode !== 0) {
    return {
      kind: 'spawn_fail',
      spawnedExit: spawned.exitCode,
      argvResolved,
      gitDiffHeadError,
      spawnedStdout: spawned.stdout,
      spawnedStderr: spawned.stderr,
    };
  }

  return {
    kind: 'ok',
    data: {
      argvResolved,
      gitDiffHeadError,
      spawnedExit: spawned.exitCode,
      spawnedStdout: spawned.stdout,
      spawnedStderr: spawned.stderr,
    },
  };
}

/**
 * Artifact paths referenced in JSON summaries (execute failure or success).
 * @param runDir - Absolute `.aimo/runs/<id>/` directory.
 * @returns Absolute paths for diff + execute result basenames.
 */
export function runPipelineExecuteArtifactPaths(runDir: string): {
  readonly git_diff_before: string;
  readonly git_diff_after: string;
  readonly execute_result: string;
} {
  return {
    git_diff_before: join(runDir, GIT_DIFF_BEFORE_BASENAME),
    git_diff_after: join(runDir, GIT_DIFF_AFTER_BASENAME),
    execute_result: join(runDir, EXECUTE_RESULT_JSON_BASENAME),
  };
}
