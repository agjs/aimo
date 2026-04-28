/**
 * @file runPipelineTypes.app.ts
 * @layer app
 * @description Public options type for `aimo run` / {@link runAimoRunPipeline}.
 */

import type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';

export type { TPipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';

/**
 * Inputs for {@link runAimoRunPipeline} (CLI flags mapped to structured fields).
 */
export type TRunPipelineOptions = {
  /** Repository root (process cwd for the CLI). */
  readonly cwd: string;
  /** Planner task text (required when the slice includes `plan`). */
  readonly task: string;
  /** Optional profile override (defaults to config `default_profile`). */
  readonly profile?: string;
  /** First pipeline stage to run. */
  readonly fromStage: TPipelineStageName;
  /** Last pipeline stage to run (inclusive). */
  readonly toStage: TPipelineStageName;
  /**
   * When starting at `plan`: optional fixed run id (must be safe directory name).
   * When starting at `execute` or `review`: required existing run id.
   */
  readonly runId?: string;
  /** Emit one JSON summary line on stdout when true. */
  readonly json: boolean;
  /** When true, validate config and stages only (no artifacts, no LLM, no spawn). */
  readonly dryRun: boolean;
};
