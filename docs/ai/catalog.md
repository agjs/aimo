# Code catalog

> **Auto-curated goal:** keep a single index of modules as the tree grows. Until a generator lands, update this file when you add a **new** top-level area under `src/`.

## `src/app/`

| Module | Responsibility |
| ------ | ---------------- |
| `cli.ts` | CLI entry (`commander`); calls `assertCompositionWired()` so `wireDefaults` + `features` stay in the dependency graph until real commands land. |
| `wireDefaults.ts` | Composition root — clock port, schema version, cleanup registry factory (expand with providers in Milestone A). |

## `src/core/`

| Module | Responsibility |
| ------ | ---------------- |
| `contracts/ExitCodes.constants.ts` | Process exit code contract. |
| `contracts/SchemaVersion.constants.ts` | `schema_version` for artifacts. |
| `config/DotEnvParse.behavior.ts` | Pure `.env` text → map parser. |
| `config/EnvPrecedence.behavior.ts` | Pure merge of env maps (process wins over files). |
| `lifecycle/CleanupRegistry.behavior.ts` | Pure LIFO cleanup registration (signals wired in `runtime/`). |
| `ports/IClockPort.types.ts` | Time port (example port + contract tests). |

## `src/runtime/bun/`

| Module | Responsibility |
| ------ | ---------------- |
| `ClockPort.bun.ts` | `IClockPort` using wall clock (allowed only in runtime). |
| `EnvLoader.bun.ts` | Read `./.env` + `~/.config/ai-model-orchestrator/.env`, merge with `process.env` via `mergeEnvLayers`. |

## `src/shared/`

| Module | Responsibility |
| ------ | ---------------- |
| `constants/Version.constants.ts` | Package version string. |
| `test-fakes/FakeClockPort.fake.ts` | Deterministic clock for tests. |

## `tests/`

| Area | Responsibility |
| ---- | ---------------- |
| `_helpers/spawnCli.ts` | Subprocess CLI runner for e2e. |
| `_contracts/` | Port contract tests (Bun vs fake implementations). |
| `e2e/` | Black-box CLI tests. |
| `unit/` | Fast pure tests. |
