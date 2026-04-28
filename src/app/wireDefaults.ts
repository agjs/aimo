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
import type { IClockPort } from '@core/ports/IClockPort.types';
import { BunClockPort } from '@runtime/bun/ClockPort.bun';
import { runInitWrites } from '@runtime/bun/ConfigInitWriter.bun';
import { loadAimoConfigFromPaths, loadResolvedAimoConfig } from '@runtime/bun/ConfigLoader.bun';

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

export { loadResolvedEnv } from '@runtime/bun/EnvLoader.bun';
export { loadAimoConfigFromPaths, loadResolvedAimoConfig } from '@runtime/bun/ConfigLoader.bun';
