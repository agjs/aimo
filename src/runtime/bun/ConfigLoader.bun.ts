/**
 * @file ConfigLoader.bun.ts
 * @layer runtime
 * @description Load `~/.config/ai-model-orchestrator/config.yaml` and `./aimo.yaml`, merge, validate.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import { mergeConfigRecordLayers } from '@core/config/deepMergeRecord.behavior';
import { parse as parseYaml } from 'yaml';

import { USER_CONFIG_DIR } from './EnvLoader.bun';

/** Filename under {@link USER_CONFIG_DIR} for the user-global YAML config. */
export const USER_CONFIG_YAML_BASENAME = 'config.yaml' as const;

/** Project-local override file (repository root). */
export const PROJECT_AIMO_YAML_BASENAME = 'aimo.yaml' as const;

/**
 * Absolute directory `~/.config/ai-model-orchestrator/` (created by `aimo init`).
 * @returns Normalized path for the current OS user.
 */
export function getUserGlobalConfigDir(): string {
  return join(homedir(), '.config', USER_CONFIG_DIR);
}

/**
 * Absolute path to `~/.config/ai-model-orchestrator/config.yaml`.
 * @returns Normalized path for the current OS user.
 */
export function getUserGlobalConfigYamlPath(): string {
  return join(getUserGlobalConfigDir(), USER_CONFIG_YAML_BASENAME);
}

/**
 * Absolute path to `./aimo.yaml` under the given working directory.
 * @param cwd - Project root (typically `process.cwd()`).
 * @returns Joined absolute path to the project override file.
 */
export function getProjectAimoYamlPath(cwd: string): string {
  return join(cwd, PROJECT_AIMO_YAML_BASENAME);
}

export type TResolvedConfigPaths = {
  readonly userYamlPath: string;
  readonly projectYamlPath: string;
  readonly userYamlPresent: boolean;
  readonly projectYamlPresent: boolean;
};

export type TLoadAimoConfigResult =
  | { ok: true; config: TAimoConfig; paths: TResolvedConfigPaths }
  | { ok: false; messages: readonly string[]; paths: TResolvedConfigPaths };

/**
 * Reads YAML from disk if the file exists; returns `{}` when missing.
 * @param absolutePath - Full path to a `.yaml` / `.yml` file.
 * @returns Parsed mapping, missing-file sentinel, or a read/parse failure.
 */
async function tryReadYamlObject(
  absolutePath: string,
): Promise<
  | { ok: true; existed: boolean; data: Record<string, unknown> }
  | { ok: false; existed: true; message: string }
> {
  try {
    const file = Bun.file(absolutePath);
    const exists = await file.exists();
    if (!exists) {
      return { ok: true, existed: false, data: {} };
    }
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = parseYaml(text);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, existed: true, message: `invalid YAML (${detail})` };
    }
    const root = normalizeYamlMapping(parsed);
    if (root === null) {
      return {
        ok: false,
        existed: true,
        message: 'config root must be a YAML mapping (object), not a list or scalar',
      };
    }
    return { ok: true, existed: true, data: root };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, existed: true, message: `failed to read file (${detail})` };
  }
}

/**
 * Coerces YAML `null` / empty document to `{}` and rejects non-object roots.
 * @param value - Root value returned by the YAML parser.
 * @returns Plain object root, or `null` if the document is a list or scalar.
 */
function normalizeYamlMapping(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return {};
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Loads two YAML files by absolute path, **deep-merges** (`project` wins), then validates with Zod.
 * Intended for tests; production code uses {@link loadResolvedAimoConfig}.
 * @param filePaths - Absolute paths to the two YAML layers (missing files → `{}`).
 * @param filePaths.userYamlPath - User-global `config.yaml` path.
 * @param filePaths.projectYamlPath - Project-local `aimo.yaml` path.
 * @returns Validated config or error messages plus path metadata.
 */
export async function loadAimoConfigFromPaths(filePaths: {
  readonly userYamlPath: string;
  readonly projectYamlPath: string;
}): Promise<TLoadAimoConfigResult> {
  const { userYamlPath, projectYamlPath } = filePaths;

  const [userRead, projectRead] = await Promise.all([
    tryReadYamlObject(userYamlPath),
    tryReadYamlObject(projectYamlPath),
  ]);

  const resolvedPaths: TResolvedConfigPaths = {
    userYamlPath,
    projectYamlPath,
    userYamlPresent: userRead.ok ? userRead.existed : true,
    projectYamlPresent: projectRead.ok ? projectRead.existed : true,
  };

  if (!userRead.ok) {
    return {
      ok: false,
      messages: [`${userYamlPath}: ${userRead.message}`],
      paths: resolvedPaths,
    };
  }

  if (!projectRead.ok) {
    return {
      ok: false,
      messages: [`${projectYamlPath}: ${projectRead.message}`],
      paths: resolvedPaths,
    };
  }

  const merged = mergeConfigRecordLayers([userRead.data, projectRead.data]);
  const parsed = safeParseAimoConfig(merged);

  if (!parsed.ok) {
    return { ok: false, messages: parsed.messages, paths: resolvedPaths };
  }

  return { ok: true, config: parsed.data, paths: resolvedPaths };
}

/**
 * Loads user-global + project YAML, **deep-merges** (project wins), then validates with Zod.
 *
 * **Precedence:** `./aimo.yaml` overlays `~/.config/ai-model-orchestrator/config.yaml` per key path.
 * Missing files are treated as empty mappings before merge.
 * @param cwd - Directory used to resolve `./aimo.yaml`.
 * @returns Same shape as {@link loadAimoConfigFromPaths}.
 */
export async function loadResolvedAimoConfig(cwd: string): Promise<TLoadAimoConfigResult> {
  return loadAimoConfigFromPaths({
    userYamlPath: getUserGlobalConfigYamlPath(),
    projectYamlPath: getProjectAimoYamlPath(cwd),
  });
}
