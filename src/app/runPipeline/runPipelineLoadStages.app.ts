/**
 * @file runPipelineLoadStages.app.ts
 * @layer app
 * @description Load merged YAML and resolve plan / execute / review bindings for `aimo run`.
 */

import type { TAimoConfig, TWorkerProfile } from '@core/config/AimoConfig.schema';
import type { TContextSource } from '@core/contextSources/ContextSource.constants';
import { EXIT_CONFIG_ERROR } from '@core/contracts/ExitCodes.constants';
import type { TResolvedDelegatedExecute } from '@core/execute/ResolveDelegatedExecute.behavior';
import { resolveDelegatedExecuteForProfile } from '@core/execute/ResolveDelegatedExecute.behavior';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';
import { firstShrinkerWorkerPerSource } from '@core/workers/FirstShrinkerPerSource.behavior';
import {
  writeRunProgressWarnLine,
  writeRunStyledMessage,
} from '@runtime/bun/RunProgressStderrStyle.bun';

import { loadResolvedAimoConfig } from '../wireDefaults';
import {
  selectPlanChatPortForRun,
  selectReviewChatPortForRun,
} from './shared/runPipelineChats.app';

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
  /** Effective raw-artifact retention (`--no-keep-raw` overrides YAML `pipeline.keep_raw`). */
  readonly keepRaw: boolean;
  /** Deduplicated shrinker rows (first wins per `source`). */
  readonly shrinkers: ReadonlyArray<{ readonly source: TContextSource; readonly worker: string }>;
  /** Top-level `workers:` map from merged config. */
  readonly workers: Readonly<Record<string, TWorkerProfile>>;
  /** Full merged config for shrinker runner (read-only). */
  readonly aimoConfig: TAimoConfig;
};

/**
 * Loads config and resolves stage bindings for the requested slice.
 * @param cwd - Repository root.
 * @param profileOverride - Optional CLI `--profile`.
 * @param needPlan - Slice includes plan.
 * @param needExec - Slice includes execute.
 * @param needRev - Slice includes review.
 * @param pipelineOpts - Optional pipeline CLI overrides.
 * @param pipelineOpts.keepRaw - When `false`, raw context files are deleted after shrinking (`--no-keep-raw`).
 * @returns `{ ok: true, data }` on success, or `{ ok: false, exitCode }` with `EXIT_CONFIG_ERROR` when YAML or providers are invalid.
 */
export async function loadRunPipelineStageBindings(
  cwd: string,
  profileOverride: string | undefined,
  needPlan: boolean,
  needExec: boolean,
  needRev: boolean,
  pipelineOpts: { readonly keepRaw?: boolean } = {},
): Promise<
  { ok: false; readonly exitCode: number } | { ok: true; readonly data: TRunPipelineLoaded }
> {
  const loaded = await loadResolvedAimoConfig(cwd);

  if (!loaded.ok) {
    for (const m of loaded.messages) {
      writeRunStyledMessage(`${m}\n`, 'warn');
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
      writeRunStyledMessage(`${resolvedPlan.message}\n`, 'warn');
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }

    planProvider = resolvedPlan.plan.provider;
    planModel = resolvedPlan.plan.model;
    planChat = selectPlanChatPortForRun(resolvedPlan.plan);
    if (!planChat) {
      writeRunProgressWarnLine(
        `plan provider "${planProvider}" is not supported yet (use provider: fake for now)`,
      );
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }
  }

  let execCfg: TResolvedDelegatedExecute | null = null;

  if (needExec) {
    const r = resolveDelegatedExecuteForProfile(cfg, profileName);

    if (!r.ok) {
      writeRunStyledMessage(`${r.message}\n`, 'warn');
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
      writeRunStyledMessage(`${resolvedReview.message}\n`, 'warn');
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }

    reviewProvider = resolvedReview.review.provider;
    reviewModel = resolvedReview.review.model;
    reviewChat = selectReviewChatPortForRun(resolvedReview.review);
    if (!reviewChat) {
      writeRunProgressWarnLine(
        `review provider "${reviewProvider}" is not supported yet (use provider: fake for now)`,
      );
      return { ok: false, exitCode: EXIT_CONFIG_ERROR };
    }
  }

  const keepRaw = pipelineOpts.keepRaw === false ? false : cfg.pipeline.keep_raw;

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
      keepRaw,
      shrinkers: firstShrinkerWorkerPerSource(cfg.pipeline.shrinkers),
      workers: cfg.workers,
      aimoConfig: cfg,
    },
  };
}
