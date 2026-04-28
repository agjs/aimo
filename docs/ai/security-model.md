# Security model

## Two executor trust levels

| Executor | Trust | v1 scope |
| -------- | ----- | -------- |
| **Builtin** | **Sandboxed** | Read/write files only under repo root; path canonicalization + symlink rules; **no** shell tool in v1. |
| **Delegated** (`aider`, `claude`, `codex`, …) | **Trusted** | Once spawned, the third-party process can do anything the user’s shell account can do in that worktree. We only control **how** we spawn it (argv, stdin, cleanup on signals). |

Document this prominently in PRs that touch execution.

## Delegated command schema (injection surface)

- **`command: string[]`** — argv only; spawned with `shell: false`.
- **Substitution** — the literal substring `{plan_path}` is replaced with a **sanitized absolute path** to the plan file. **No other placeholders.**
- **`stdin_file` (optional)** — if the tool reads the plan from stdin (e.g. `claude -p`), set `stdin_file: "{plan_path}"` and pipe that file’s **contents** to stdin. Plan content **never** appears in `argv`. The path is anchored under the repo root by `assertPlanPathAnchoredInRepoRoot.behavior.ts` before the spawn.
- **Rejected at config parse time** — string `command`, `{plan_inline}`, nested objects inside `argv`, or arbitrary template keys.

## Trust boundary (assumptions)

These items are deliberately inside the trust boundary in v1. An attacker who can already write any of them can already do worse on the host:

- **Project YAML (`./aimo.yaml`)** and **user-global config (`~/.config/aimo/`)** — no allowlist on `base_url`. The user is expected to point `base_url` at trusted endpoints.
- **Subprocess environment** — `runDelegatedArgv` (`runtime/bun/DelegatedSpawn.bun.ts`) inherits the full `process.env` so delegated tools (`aider`, `codex`, …) can locate their own credentials. There is no `--sanitize-env` flag in v1.
- **`./.env` and `~/.config/ai-model-orchestrator/.env`** — readable by the CLI process and forwarded to delegated subprocesses through the inherited env.

## Run directory (path-traversal defense)

`prepareRunArtifactPaths` (`runtime/bun/RunWorkspace.bun.ts`) creates `.aimo/runs/<id>/` with `mode: 0o700` then `realpath`s both the cwd and the run dir. If the resolved run dir does not stay strictly under the resolved cwd (e.g. a pre-created symlink), the call refuses with a clear error before any artifact is written. The pure `isPathInsideRoot.behavior.ts` helper does the comparison.

## Prompt injection

Treat **file contents, diffs, transcripts, and model outputs reused as input** as **untrusted data**. Wrap them with a pure helper (planned: `PromptIsolation.behavior.ts`) so models see delimited **DATA** blocks with explicit instructions not to follow embedded “commands”.

## Secrets

- **Resolved env** for lookups: `loadResolvedEnv(cwd)` in `runtime/bun/EnvLoader.bun.ts` merges `process.env` (wins), then `./.env` under `cwd`, then `~/.config/ai-model-orchestrator/.env`, using pure `mergeEnvLayers` + `parseDotEnvContents` in `core/config/` (never mutates `process.env`).
- **Redaction** before anything is logged or sent upstream: planned `RedactSecrets.behavior.ts`.

## Cross-platform

**v1 is POSIX-first** (macOS + Linux). Windows support is explicitly later unless/until CI adds it.
