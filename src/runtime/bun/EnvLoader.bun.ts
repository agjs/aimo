/**
 * @file EnvLoader.bun.ts
 * @layer runtime
 * @description Load `.env` files from disk and merge with `process.env` using {@link mergeEnvLayers}.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

import { parseDotEnvContents } from '@core/config/DotEnvParse.behavior';
import { mergeEnvLayers } from '@core/config/EnvPrecedence.behavior';

/** Directory name under `~/.config/` for user-global aimo files. */
export const USER_CONFIG_DIR = 'ai-model-orchestrator' as const;

/**
 * Absolute path to the user-global `.env` (`~/.config/ai-model-orchestrator/.env`).
 * @returns Normalized path for the current OS user.
 */
export function getUserGlobalDotEnvPath(): string {
  return join(homedir(), '.config', USER_CONFIG_DIR, '.env');
}

/**
 * Reads a `.env` file if it exists; returns `{}` on missing file or read errors.
 * @param absolutePath - Full path to the env file.
 * @returns Parsed variables only from that file.
 */
export async function tryReadDotEnvFile(absolutePath: string): Promise<Record<string, string>> {
  try {
    const file = Bun.file(absolutePath);
    if (!(await file.exists())) {
      return {};
    }
    const text = await file.text();
    return parseDotEnvContents(text);
  } catch {
    return {};
  }
}

/**
 * Resolves the effective environment for the CLI: `process.env` wins, then project `./.env`, then user global.
 * @param cwd - Project root used to resolve `./.env` (defaults to `process.cwd()`).
 * @returns Merged map suitable for lookups (never mutates `process.env`).
 */
export async function loadResolvedEnv(
  cwd: string = process.cwd(),
): Promise<Record<string, string>> {
  const processLayer: Record<string, string | undefined> = { ...process.env };
  const projectLayer = await tryReadDotEnvFile(join(cwd, '.env'));
  const userLayer = await tryReadDotEnvFile(getUserGlobalDotEnvPath());
  return mergeEnvLayers([processLayer, projectLayer, userLayer]);
}
