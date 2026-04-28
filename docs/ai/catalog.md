# Code catalog

> **Auto-curated goal:** keep a single index of modules as the tree grows. Until a generator lands, update this file when you add a **new** top-level area under `src/`. **What to build next:** [roadmap.md](./roadmap.md).

## `src/app/`

| Module | Responsibility |
| ------ | ---------------- |
| `cli.ts` | CLI entry (`commander`); calls `assertCompositionWired()` so `wireDefaults` + `features` stay in the dependency graph until real commands land. |
| `commands/doctor.command.ts` | `aimo doctor` / `doctor --json` — runs `loadResolvedAimoConfig`, exit `EXIT_CONFIG_ERROR` on invalid YAML. |
| `commands/init.command.ts` | `aimo init` — writes starter `config.yaml` / `aimo.yaml` (`--global-only`, `--local-only`, `--force`, `--json`). |
| `wireDefaults.ts` | Composition root — clock, schema version, cleanup, env + YAML config loaders (`loadResolvedAimoConfig`). |

## `src/core/`

| Module | Responsibility |
| ------ | ---------------- |
| `contracts/ExitCodes.constants.ts` | Process exit code contract. |
| `contracts/SchemaVersion.constants.ts` | `schema_version` for artifacts. |
| `config/DotEnvParse.behavior.ts` | Pure `.env` text → map parser. |
| `config/EnvPrecedence.behavior.ts` | Pure merge of env maps (process wins over files). |
| `config/deepMergeRecord.behavior.ts` | Deep-merge YAML roots; project `aimo.yaml` overlays user `config.yaml`. |
| `config/AimoConfig.schema.ts` | Zod schema + `safeParseAimoConfig` for merged YAML (delegated execute rules). |
| `config/AimoInitTemplates.behavior.ts` | Commented starter YAML strings for `aimo init` (validated against schema). |
| `lifecycle/CleanupRegistry.behavior.ts` | Pure LIFO cleanup registration (signals wired in `runtime/`). |
| `ports/IClockPort.types.ts` | Time port (example port + contract tests). |

## `src/runtime/bun/`

| Module | Responsibility |
| ------ | ---------------- |
| `ClockPort.bun.ts` | `IClockPort` using wall clock (allowed only in runtime). |
| `EnvLoader.bun.ts` | Read `./.env` + `~/.config/ai-model-orchestrator/.env`, merge with `process.env` via `mergeEnvLayers`. |
| `ConfigLoader.bun.ts` | Read user `config.yaml` + `./aimo.yaml`, `mergeConfigRecordLayers`, Zod validate; `loadAimoConfigFromPaths` for tests. |
| `ConfigInitWriter.bun.ts` | `runInitWrites` — mkdir user dir, conditional write / skip / overwrite for init. |

## `src/shared/`

| Module | Responsibility |
| ------ | ---------------- |
| `constants/Version.constants.ts` | Package version string. |
| `test-fakes/FakeClockPort.fake.ts` | Deterministic clock for tests. |

## `tests/`

| Area | Responsibility |
| ---- | ---------------- |
| `_helpers/spawnCli.ts` | Subprocess CLI runner: **absolute** `cli.ts` path so e2e `cwd` can be isolated fixture dirs. |
| `_contracts/` | Port contract tests (Bun vs fake implementations). |
| `e2e/` | Black-box CLI tests (`init`, `doctor`, `--version`, failure paths). |
| `e2e/_helpers/isolatedHomeProject.ts` | Fake `$HOME` + project dir for config e2e (no real `~/.config` reads). |
| `unit/` | Fast pure tests (`deepMergeRecord`, `AimoConfig.schema`, …). |
| `integration/` | Filesystem-backed tests (`configLoader`, `envLoader`, wiring smoke). |
