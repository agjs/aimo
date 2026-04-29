/**
 * @file AimoInitTemplates.behavior.ts
 * @layer core
 * @description Commented starter YAML for `aimo init` (no I/O; must pass {@link safeParseAimoConfig} when parsed).
 */

/**
 * User-global starter written to `~/.config/ai-model-orchestrator/config.yaml`.
 * Uses `fake` / `stub` for plan and review so Milestone A pipelines work without API keys.
 * @returns Full YAML document including header comments.
 */
export function getGlobalStarterConfigYaml(): string {
  return `# ai-model-orchestrator — user defaults (YAML)
# Merged with ./aimo.yaml in each project; project keys win per-key (deep merge).
# See docs/ai/roadmap.md and AGENTS.md in the aimo repository.

schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
`;
}

/**
 * Project-local starter written to `./aimo.yaml` (optional overrides only).
 * @returns Minimal valid YAML (empty profiles until you uncomment overrides).
 */
export function getLocalStarterAimoYaml(): string {
  return `# ./aimo.yaml — optional overrides for this repository only.
# Uncomment keys to override matching paths in your user config.

schema_version: 1
default_profile: default
profiles: {}
# session:
#   tools:
#     read_file: allow
#     grep: allow
#     list_tree: allow
#     git_status: allow
#     git_diff: allow
#     show_artifact: allow
#     # apply_patch / run_shell / web_search — not session-wired in v1
#     # allow | deny | ask | never | session — see docs/ai/spec-session.md
`;
}
