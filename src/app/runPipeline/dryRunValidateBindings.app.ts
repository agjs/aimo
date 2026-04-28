/**
 * @file dryRunValidateBindings.app.ts
 * @layer app
 * @description Pure-style validation steps for `aimo run --dry-run` (no process I/O).
 */

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import { resolveDelegatedExecuteForProfile } from '@core/execute/ResolveDelegatedExecute.behavior';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';
import {
  type TPipelineStageName,
  resolvePipelineStageRange,
} from '@core/run/resolvePipelineStageRange.behavior';

import { selectPlanChatPortForRun, selectReviewChatPortForRun } from './runPipelineChats.app';

/** Standard validation result without side effects. */
export type TValidation = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Resolved stage slice flags for dry run and write preflight. */
export type TPipelineSlice = {
  readonly stages: readonly TPipelineStageName[];
  readonly needPlan: boolean;
  readonly needExec: boolean;
  readonly needRev: boolean;
  readonly startsAtPlan: boolean;
};

/** Result of resolving the stage slice. */
export type TSliceResolveResult =
  | { readonly ok: true; readonly slice: TPipelineSlice }
  | { readonly ok: false; readonly message: string };

/**
 * Resolves `--from` / `--to` into an ordered slice and boolean flags.
 * @param fromStage - CLI `--from`.
 * @param toStage - CLI `--to`.
 * @returns Slice flags or an error message.
 */
export function resolvePipelineSliceForRun(
  fromStage: TPipelineStageName,
  toStage: TPipelineStageName,
): TSliceResolveResult {
  const range = resolvePipelineStageRange(fromStage, toStage);

  if (!range.ok) {
    return { ok: false, message: range.message };
  }

  const { stages } = range;
  const slice: TPipelineSlice = {
    stages,
    needPlan: stages.includes('plan'),
    needExec: stages.includes('execute'),
    needRev: stages.includes('review'),
    startsAtPlan: stages[0] === 'plan',
  };
  return { ok: true, slice };
}

/**
 * Ensures task text exists when the slice includes plan.
 * @param needPlan - Whether plan is in the slice.
 * @param task - Raw task string from CLI.
 * @returns Ok or a stderr-ready message.
 */
export function validateTaskRequiredForPlan(needPlan: boolean, task: string): TValidation {
  if (!needPlan) {
    return { ok: true };
  }

  if (task.trim().length === 0) {
    return {
      ok: false,
      message: 'run: task text is empty (required when the slice includes plan)\n',
    };
  }

  return { ok: true };
}

/**
 * Ensures `--run` is present and safe when the slice does not start at plan.
 * @param startsAtPlan - First stage in the slice.
 * @param runId - Optional CLI `--run`.
 * @returns Ok or a stderr-ready message.
 */
export function validateRunIdRequiredUnlessPlanStart(
  startsAtPlan: boolean,
  runId: string | undefined,
): TValidation {
  if (startsAtPlan) {
    return { ok: true };
  }

  const rid = runId?.trim() ?? '';

  if (!isSafeRunDirectoryName(rid)) {
    return {
      ok: false,
      message:
        'run: --run <id> is required when --from is execute or review (use the run id under .aimo/runs/)\n',
    };
  }

  return { ok: true };
}

/**
 * Validates plan stage can resolve and chat port exists for the provider.
 * @param cfg - Merged config.
 * @param profileName - Active profile.
 * @returns Ok or a stderr-ready message.
 */
export function validatePlanStageForRun(cfg: TAimoConfig, profileName: string): TValidation {
  const resolvedPlan = resolvePlanStageForProfile(cfg, profileName);

  if (!resolvedPlan.ok) {
    return { ok: false, message: `${resolvedPlan.message}\n` };
  }

  const planChat = selectPlanChatPortForRun(resolvedPlan.plan.provider);

  if (!planChat) {
    return {
      ok: false,
      message: `run: plan provider "${resolvedPlan.plan.provider}" is not supported yet (use provider: fake for now)\n`,
    };
  }

  return { ok: true };
}

/**
 * Validates delegated execute resolves for the profile.
 * @param cfg - Merged config.
 * @param profileName - Active profile.
 * @returns Ok or a stderr-ready message.
 */
export function validateExecuteStageForRun(cfg: TAimoConfig, profileName: string): TValidation {
  const resolvedExec = resolveDelegatedExecuteForProfile(cfg, profileName);

  if (!resolvedExec.ok) {
    return { ok: false, message: `${resolvedExec.message}\n` };
  }

  return { ok: true };
}

/**
 * Validates review stage resolves and chat port exists for the provider.
 * @param cfg - Merged config.
 * @param profileName - Active profile.
 * @returns Ok or a stderr-ready message.
 */
export function validateReviewStageForRun(cfg: TAimoConfig, profileName: string): TValidation {
  const resolvedReview = resolveReviewStageForProfile(cfg, profileName);

  if (!resolvedReview.ok) {
    return { ok: false, message: `${resolvedReview.message}\n` };
  }

  const reviewChat = selectReviewChatPortForRun(resolvedReview.review.provider);

  if (!reviewChat) {
    return {
      ok: false,
      message: `run: review provider "${resolvedReview.review.provider}" is not supported yet (use provider: fake for now)\n`,
    };
  }

  return { ok: true };
}

/**
 * Runs plan / execute / review binding checks for whichever stages appear in the slice.
 * @param cfg - Merged config.
 * @param profileName - Active profile.
 * @param slice - Resolved slice flags.
 * @returns First failure encountered, or ok.
 */
export function validateBindingsForSlice(
  cfg: TAimoConfig,
  profileName: string,
  slice: TPipelineSlice,
): TValidation {
  if (slice.needPlan) {
    const r = validatePlanStageForRun(cfg, profileName);

    if (!r.ok) {
      return r;
    }
  }

  if (slice.needExec) {
    const r = validateExecuteStageForRun(cfg, profileName);

    if (!r.ok) {
      return r;
    }
  }

  if (slice.needRev) {
    return validateReviewStageForRun(cfg, profileName);
  }

  return { ok: true };
}
