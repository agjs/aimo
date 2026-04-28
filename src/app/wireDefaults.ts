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
import { CleanupRegistry } from '@core/lifecycle/CleanupRegistry.behavior';
import { buildPlanMessages } from '@core/plan/BuildPlanMessages.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { IClockPort } from '@core/ports/IClockPort.types';
import type { IHttpPort } from '@core/ports/IHttpPort.types';
import { relativePlanMdPath } from '@core/runs/AimoRunPaths.constants';
import { serializePlanManifestJson } from '@core/runs/RunManifestJson.behavior';
import { runPlanChat } from '@features/planStage.feature';
import { InProcessFakeChatProvider } from '@providers/fake/InProcessFakeChat.provider';
import { BunClockPort } from '@runtime/bun/ClockPort.bun';
import { runInitWrites } from '@runtime/bun/ConfigInitWriter.bun';
import { loadAimoConfigFromPaths, loadResolvedAimoConfig } from '@runtime/bun/ConfigLoader.bun';
import { BunHttpPort } from '@runtime/bun/HttpPort.bun';
import { prepareRunArtifactPaths } from '@runtime/bun/RunWorkspace.bun';

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
 * Keeps provider + HTTP port types in the build graph until stages call them.
 */
export function assertProviderPortsWired(): void {
  void createDefaultHttpPort;
  void createInProcessFakeChatPort;
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

export { loadResolvedEnv } from '@runtime/bun/EnvLoader.bun';
export { loadAimoConfigFromPaths, loadResolvedAimoConfig } from '@runtime/bun/ConfigLoader.bun';
