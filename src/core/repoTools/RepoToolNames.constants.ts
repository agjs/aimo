/**
 * @file RepoToolNames.constants.ts
 * @layer core
 * @description Typed union of repo tool names (Phase 2 YAML); Phase 1 uses this only for session approvals typing (D4).
 */

/** Ordered list of every repo tool id (must match spec Phase 2 `session.tools` keys). */
export const REPO_TOOL_NAMES = [
  'read_file',
  'list_tree',
  'grep',
  'git_status',
  'git_diff',
  'show_artifact',
  'apply_patch',
  'run_shell',
  'web_search',
] as const;

/**
 * Tool name union for permissions and tool-calling (no free strings for tagged values).
 */
export type TToolName = (typeof REPO_TOOL_NAMES)[number];
