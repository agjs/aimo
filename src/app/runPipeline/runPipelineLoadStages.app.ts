/**
 * @file runPipelineLoadStages.app.ts
 * @layer app
 * @description Load merged YAML and resolve plan / execute / review bindings for `aimo run`.
 */

import { EXIT_CONFIG_ERROR } from '@core/contracts/ExitCodes.constants';
import type { TResolvedDelegatedExecute } from '@core/execute/ResolveDelegatedExecute.behavior';
import { resolveDelegatedExecuteForProfile } from '@core/execute/ResolveDelegatedExecute.behavior';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';

import { loadResolvedAimoConfig } from '../wireDefaults';
import { selectPlanChatPortForRun, selectReviewChatPortForRun } from './runPipelineChats.app';

/**
 * Resolved ports and models for each stage requested in the slice.
 */
export type TRunPipelineLoaded = {
  readonly profileName: string;
  readonly planProvider: string;
  readonly planModel: string;
  readonly planChat: IChatCompletionPort | null;
  readonly execCfg: TResolvedDelegatedExecute | null;
  readonly reviewProvider: string;
  readonly reviewModel: string;
  readonly reviewChat: IChatCompletionPort | null;
};

/**
 * Loads config and resolves stage bindings for the requested slice.
 * @param cwd - Repository root.
 * @param profileOverride - Optional CLI `--profile`.
 * @param needPlan - Slice includes plan.
 * @param needExec - Slice includes execute.
 * @param needRev - Slice includes review.
 * @returns `{ ok: true, data }` on success, or `{ ok: false, exitCode }` with `EXIT_CONFIG_ERROR` when YAML or providers are invalid.
 */
export async function loadRunPipelineStageBindings(
  cwd: string,
  profileOverride: string | undefined,
  needPlan: boolean,
  needExec: boolean,
  needRev: boolean,
): Promise<
  { ok: false; readonly exitCode: number } | { ok: true; readonly data: TRunPipelineLoaded }
> {
  const loaded = await loadResolvedAimoConfig(cwd);

  if (!loaded.ok) {
    for (const m of loaded.messages) {
      process.stderr.write(`${m}\n`);
    }

    return { ok: false, exitCode: EXIT_CONFIG_ERROR };
  }

  const cfg = loaded.config;
  const profileName = profileOverride ?? cfg.default_profile;

  let planProvider = '';
  let planModel = '';
  let planChat: IChatCompletionPort | null = null;

  if (needPlan) {
    const resolvedPlan = resolvePlanStageForProfile(cfg, profileName);

    if (!resolvedPlan.ok) {
      process.stderr.write(`${resolvedPlan.message}\n`);
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }

    planProvider = resolvedPlan.plan.provider;
    planModel = resolvedPlan.plan.model;
    planChat = selectPlanChatPortForRun(planProvider);
    if (!planChat) {
      process.stderr.write(
        `run: plan provider "${planProvider}" is not supported yet (use provider: fake for now)\n`,
      );
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }
  }

  let execCfg: TResolvedDelegatedExecute | null = null;

  if (needExec) {
    const r = resolveDelegatedExecuteForProfile(cfg, profileName);

    if (!r.ok) {
      process.stderr.write(`${r.message}\n`);
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }

    execCfg = r.execute;
  }

  let reviewProvider = '';
  let reviewModel = '';
  let reviewChat: IChatCompletionPort | null = null;

  if (needRev) {
    const resolvedReview = resolveReviewStageForProfile(cfg, profileName);

    if (!resolvedReview.ok) {
      process.stderr.write(`${resolvedReview.message}\n`);
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }

    reviewProvider = resolvedReview.review.provider;
    reviewModel = resolvedReview.review.model;
    reviewChat = selectReviewChatPortForRun(reviewProvider);
    if (!reviewChat) {
      process.stderr.write(
        `run: review provider "${reviewProvider}" is not supported yet (use provider: fake for now)\n`,
      );
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }
  }

  return {
    ok: true,
    data: {
      profileName,
      planProvider,
      planModel,
      planChat,
      execCfg,
      reviewProvider,
      reviewModel,
      reviewChat,
    },
  };
}
