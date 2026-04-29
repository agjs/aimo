/**
 * @file wireDefaults.ts
 * @layer app
 * @description Composition root — construct Bun-backed ports and registries here (expand in Milestone A).
 */

import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import {
  getGlobalStarterConfigYaml,
  getLocalStarterAimoYaml,
} from '@core/config/AimoInitTemplates.behavior';
import { mergeConfigRecordLayers } from '@core/config/deepMergeRecord.behavior';
import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { assertPlanPathAnchoredInRepoRoot } from '@core/execute/assertPlanPathAnchoredInRepoRoot.behavior';
import { serializeExecuteResultJson } from '@core/execute/ExecuteResultJson.behavior';
import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import { resolveDelegatedExecuteForProfile } from '@core/execute/ResolveDelegatedExecute.behavior';
import { substitutePlanPathInArgv } from '@core/execute/substitutePlanPathInArgv.behavior';
import { CleanupRegistry } from '@core/lifecycle/CleanupRegistry.behavior';
import { buildPlanMessages } from '@core/plan/BuildPlanMessages.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { IClockPort } from '@core/ports/IClockPort.types';
import type { IHttpPort } from '@core/ports/IHttpPort.types';
import { buildReviewMessages } from '@core/review/BuildReviewMessages.behavior';
import { ensureVerdictForPersistedReview } from '@core/review/ensureVerdictForPersistedReview.behavior';
import { exitCodeForReviewVerdict } from '@core/review/exitCodeForReviewVerdict.behavior';
import { parseReviewVerdictFromMarkdown } from '@core/review/ParseReviewVerdict.behavior';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';
import { resolvePipelineStageRange } from '@core/run/resolvePipelineStageRange.behavior';
import { relativePlanMdPath, relativeReviewMdPath } from '@core/runs/AimoRunPaths.constants';
import { serializePlanManifestJson } from '@core/runs/RunManifestJson.behavior';
import { runPlanChat } from '@features/planStage.feature';
import { runReviewChat } from '@features/reviewStage.feature';
import { runSessionLoop } from '@features/sessionLoop.feature';
import { runWorkerChat } from '@features/workersStage.feature';
import { InProcessFakeChatProvider } from '@providers/fake/InProcessFakeChat.provider';
import { OpenAiCompatChatProvider } from '@providers/openaiCompat/OpenAiCompatChat.provider';
import { BunClockPort } from '@runtime/bun/ClockPort.bun';
import { runInitWrites } from '@runtime/bun/ConfigInitWriter.bun';
import { loadAimoConfigFromPaths, loadResolvedAimoConfig } from '@runtime/bun/ConfigLoader.bun';
import { runDelegatedArgv } from '@runtime/bun/DelegatedSpawn.bun';
import { readGitDiffHeadText } from '@runtime/bun/GitDiffHead.bun';
import { BunHttpPort } from '@runtime/bun/HttpPort.bun';
import { BunRepoTools } from '@runtime/bun/RepoTools.bun';
import { runRepoGitDiff } from '@runtime/bun/runRepoGitDiff.bun';
import { runRepoGitStatus } from '@runtime/bun/runRepoGitStatus.bun';
import { runRepoGrep } from '@runtime/bun/runRepoGrep.bun';
import { runRepoListTree } from '@runtime/bun/runRepoListTree.bun';
import { runRepoShowArtifact } from '@runtime/bun/runRepoShowArtifact.bun';
import {
  prepareRunArtifactPaths,
  writeExecuteStageArtifacts,
  writeReviewMarkdown,
} from '@runtime/bun/RunWorkspace.bun';
/**
 * Creates the default wall-clock port for production-style runs.
 * @returns Bun-backed {@link IClockPort}.
 */
export function createDefaultClockPort(): IClockPort {
  return new BunClockPort();
}

/**
 * Exposes the artifact schema version constant for early wiring checks.
 * @returns Current `schema_version` written to manifests and scorecards.
 */
export function getCurrentSchemaVersion(): typeof CURRENT_SCHEMA_VERSION {
  return CURRENT_SCHEMA_VERSION;
}

/**
 * Factory for an empty {@link CleanupRegistry} (runtime will attach signal draining later).
 * @returns Fresh registry instance.
 */
export function createCleanupRegistry(): CleanupRegistry {
  return new CleanupRegistry();
}

/**
 * Default JSON HTTP client for future OpenAI-compatible adapters.
 * @returns Bun `fetch`-backed {@link IHttpPort}.
 */
export function createDefaultHttpPort(): IHttpPort {
  return new BunHttpPort();
}

/**
 * In-process fake chat backend for CI and dry runs (no network).
 * @returns as {@link IChatCompletionPort}.
 */
export function createInProcessFakeChatPort(): IChatCompletionPort {
  return new InProcessFakeChatProvider();
}

/**
 * OpenAI-compatible chat port for `openrouter` / `openai-compat` YAML providers.
 * Reads API keys from the environment (`OPENROUTER_API_KEY` / `OPENAI_API_KEY`).
 * @param stage - Provider id plus model and optional `base_url` override.
 * @param stage.provider - `openrouter` or `openai-compat`.
 * @param stage.model - Model id for the JSON request body.
 * @param stage.base_url - Optional API base override (no trailing slash).
 * @returns HTTP-backed port, or `null` when provider is not HTTP-shaped or keys are missing.
 */
export function createOpenAiCompatChatPortFromStage(stage: {
  readonly provider: string;
  readonly model: string;
  readonly base_url?: string | undefined;
}): IChatCompletionPort | null {
  if (stage.provider !== 'openrouter' && stage.provider !== 'openai-compat') {
    return null;
  }

  const apiKey =
    stage.provider === 'openrouter'
      ? (process.env.OPENROUTER_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim() ?? '')
      : (process.env.OPENAI_API_KEY?.trim() ?? process.env.OPENROUTER_API_KEY?.trim() ?? '');

  if (apiKey.length === 0) {
    return null;
  }

  const defaultBase =
    stage.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
  const baseUrl = (stage.base_url ?? defaultBase).replace(/\/+$/, '');

  return new OpenAiCompatChatProvider({
    http: createDefaultHttpPort(),
    baseUrl,
    apiKey,
  });
}

/**
 * Keeps provider + HTTP port types in the build graph until stages call them.
 */
export function assertProviderPortsWired(): void {
  void createDefaultHttpPort;
  void createInProcessFakeChatPort;
  void createOpenAiCompatChatPortFromStage;
  void OpenAiCompatChatProvider;
}

/**
 * Keeps YAML merge + Zod config wiring in the dependency graph until commands call the loaders.
 */
export function assertAimoConfigWiring(): void {
  void mergeConfigRecordLayers([{ schema_version: 1 }, {}]);
  void safeParseAimoConfig({});
  void getGlobalStarterConfigYaml();
  void getLocalStarterAimoYaml();
  void loadAimoConfigFromPaths;
  void loadResolvedAimoConfig;
  void runInitWrites;
}

/**
 * Keeps delegated execute + git diff wiring in the dependency graph for `aimo execute`.
 */
export function assertExecuteStageWired(): void {
  void substitutePlanPathInArgv(['cat', '{plan_path}'], '/repo/plan.md');
  void assertPlanPathAnchoredInRepoRoot({ repoRoot: '/repo', planPath: '/repo/sub/plan.md' });
  void isSafeRunDirectoryName('00000000-0000-0000-0000-000000000000');
  const execCfg = safeParseAimoConfig({
    schema_version: 1,
    default_profile: 'default',
    profiles: {
      default: { execute: { type: 'delegated', command: ['true'] } },
    },
  });

  if (execCfg.ok) {
    void resolveDelegatedExecuteForProfile(execCfg.data, 'default');
  }

  void serializeExecuteResultJson({
    schema_version: CURRENT_SCHEMA_VERSION,
    run_id: 'wire',
    stage: 'execute',
    exit_code: 0,
    git_diff_head_error: null,
  });
  void readGitDiffHeadText;
  void runDelegatedArgv;
  void writeExecuteStageArtifacts;
}

/**
 * Keeps plan-stage core + feature + run workspace wiring in the dependency graph until `aimo plan` ships.
 */
export function assertPlanStageWired(): void {
  void buildPlanMessages('wire');
  void relativePlanMdPath('00000000-0000-0000-0000-000000000000');
  void serializePlanManifestJson({
    schema_version: CURRENT_SCHEMA_VERSION,
    run_id: 'wire',
    stage: 'plan',
    created_at_ms: 0,
    profile: 'default',
    provider: 'fake',
    model: 'stub',
  });
  void runPlanChat;
  void prepareRunArtifactPaths;
}

/**
 * Keeps review-stage core + feature + run workspace wiring in the dependency graph for `aimo review`.
 */
export function assertReviewStageWired(): void {
  void buildReviewMessages({ planMarkdown: 'p', diffMarkdown: 'd', transcriptMarkdown: '' });
  void parseReviewVerdictFromMarkdown('summary\n\nVERDICT: pass');
  void exitCodeForReviewVerdict('pass');
  void relativeReviewMdPath('00000000-0000-0000-0000-000000000000');
  const revCfg = safeParseAimoConfig({
    schema_version: 1,
    default_profile: 'default',
    profiles: {
      default: { review: { provider: 'fake', model: 'stub' } },
    },
  });

  if (revCfg.ok) {
    void resolveReviewStageForProfile(revCfg.data, 'default');
  }

  void runReviewChat;
  void writeReviewMarkdown;
}

/**
 * Keeps `aimo run` orchestration imports in the graph until the command ships.
 */
export function assertRunPipelineWired(): void {
  void ensureVerdictForPersistedReview('wire\n\nVERDICT: pass\n', 'openai');
  void resolvePipelineStageRange('plan', 'review');
  void runWorkerChat;
}

/**
 * Keeps interactive session loop wiring in the dependency graph for `aimo session`.
 */
export function assertSessionLoopWired(): void {
  void runSessionLoop;
  void BunRepoTools;
  void runRepoGrep;
  void runRepoListTree;
  void runRepoGitStatus;
  void runRepoGitDiff;
  void runRepoShowArtifact;
}

export { loadResolvedEnv } from '@runtime/bun/EnvLoader.bun';
export { loadAimoConfigFromPaths, loadResolvedAimoConfig } from '@runtime/bun/ConfigLoader.bun';
