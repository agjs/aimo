/**
 * @file mergeSessionToolsFromConfig.behavior.ts
 * @layer core
 * @description Merge `session.tools` from merged YAML into per-tool approval levels (defaults deny).
 */

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import { REPO_TOOL_NAMES, type TToolName } from '@core/repoTools/RepoToolNames.constants';
import { createDefaultToolApprovals } from '@core/session/sessionReducer.behavior';
import type { TToolApprovalLevel } from '@core/session/SessionState.types';

/** Values allowed in YAML under `session.tools.<tool>`. */
export type TYamlSessionToolLevel = 'allow' | 'deny' | 'ask' | 'never' | 'session';

/**
 * Maps YAML policy strings to reducer `approval` decision levels.
 * @param level - Value from `session.tools` in YAML.
 * @returns Reducer `TToolApprovalLevel` for `approval` events.
 */
export function mapYamlSessionToolLevelToApproval(
  level: TYamlSessionToolLevel,
): TToolApprovalLevel {
  const table: Record<TYamlSessionToolLevel, TToolApprovalLevel> = {
    allow: 'allow',
    deny: 'deny',
    ask: 'ask',
    never: 'never',
    session: 'session',
  };

  return table[level];
}

/**
 * Effective per-tool levels: defaults deny all, then YAML `session.tools` overlay.
 * @param cfg - Merged validated aimo config.
 * @returns Mutable map of every {@link REPO_TOOL_NAMES} entry.
 */
export function mergeSessionToolsFromConfig(
  cfg: TAimoConfig,
): Record<TToolName, TToolApprovalLevel> {
  const out: Record<TToolName, TToolApprovalLevel> = { ...createDefaultToolApprovals() };
  const tools = cfg.session?.tools;

  if (tools === undefined) {
    return out;
  }

  for (const [key, raw] of Object.entries(tools)) {
    if ((REPO_TOOL_NAMES as readonly string[]).includes(key)) {
      out[key as TToolName] = mapYamlSessionToolLevelToApproval(raw);
    }
  }

  return out;
}
