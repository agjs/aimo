# Code catalog

> **Auto-curated goal:** keep a single index of modules as the tree grows. Until a generator lands, update this file when you add a **new** top-level area under `src/`. **What to build next:** [roadmap.md](./roadmap.md).

## `src/app/`

| Module | Responsibility |
| ------ | ---------------- |
| `cli.ts` | CLI entry (`commander`); calls `assertCompositionWired()` so `wireDefaults` + `features` stay in the dependency graph until real commands land. |
| `commands/doctor.command.ts` | `aimo doctor` / `doctor --json` — runs `loadResolvedAimoConfig`, exit `EXIT_CONFIG_ERROR` on invalid YAML. |
| `commands/init.command.ts` | `aimo init` — writes starter `config.yaml` / `aimo.yaml` (`--global-only`, `--local-only`, `--force`, `--json`). |
| `commands/ping.command.ts` | `aimo ping` / `--json` — one round-trip through `InProcessFakeChatProvider` (CI smoke). |
| `commands/plan.command.ts` | `aimo plan` / `--json` — planner chat, `.aimo/runs/<id>/plan.md` + `manifest.json` (fake provider for now). |
| `commands/execute.command.ts` | `aimo execute --run <id>` — delegated argv, `{plan_path}` substitution, `git diff HEAD` before/after, `execute.result.json` + diff files. |
| `commands/review.command.ts` | `aimo review --run <id>` — reviewer chat, `review.md`, process exit from `VERDICT` (`0` / `2` / `3`). |
| `commands/run.command.ts` | `aimo run` / `--dry-run` / `--json` / `--no-keep-raw` — thin wrapper around `runAimoRunPipeline`. |
| `orchestrateRunPipeline.app.ts` | Re-exports `runPipeline/` (stable import path for `aimo run`). |
| `runPipeline/runPipelineOrchestrator.app.ts` | Sequences plan / execute / review slices; exit codes per `ExitCodes`. |
| `runPipeline/runPipelineTypes.app.ts` | `TRunPipelineOptions` (+ re-exports `TPipelineStageName`). |
| `runPipeline/runPipelinePreflightWrite.app.ts` | Non–dry-run preflight: slice, run id, YAML bindings, artifact paths. |
| `runPipeline/runPipelineRunWritePhases.app.ts` | Plan / execute / review write phases after preflight. |
| `runPipeline/runPipelineLoadStages.app.ts` | Load merged config + resolve plan/execute/review bindings. |
| `runPipeline/runPipelineEmitStderrProgress.app.ts` | `run:` progress lines for `aimo run` (stderr; `--json` keeps stdout JSON-only). |
| `runPipeline/resolveRunIdForPipelineSlice.app.ts` | Resolve or validate `.aimo/runs/<id>/` for a slice. |
| `runPipeline/dryRun/dryRunValidateBindings.app.ts` | Pure slice + binding validators (`validateBindingsForSlice`, etc.). |
| `runPipeline/dryRun/runPipelineDryRun.app.ts` | `--dry-run` validation for `aimo run`. |
| `runPipeline/plan/runPipelineWritePlanStep.app.ts` | Planner chat + `plan.md` / manifest write. |
| `runPipeline/execute/runPipelineWriteExecuteStep.app.ts` | Delegated spawn + diff / execute result artifacts. |
| `runPipeline/execute/runPipelineEmitExecuteFailure.app.ts` | JSON/human output for execute `spawn_fail`. |
| `runPipeline/review/runPipelineWriteReviewStep.app.ts` | Reviewer chat + `review.md`. |
| `runPipeline/review/runPipelineReviewContext.app.ts` | Load diff + transcript for review (prefer `*.shrunk.md`). |
| `runPipeline/shrinkers/runPipelineApplyShrinkers.app.ts` | After execute: run `pipeline.shrinkers` via cheap `IChatCompletionPort`, write `*.shrunk.md`, optional raw delete. |
| `runPipeline/shared/runPipelineChats.app.ts` | Select `IChatCompletionPort` for plan/review/workers (`fake`, `openrouter`, `openai-compat`). |
| `runPipeline/shared/runPipelineBuildSuccessJsonSummary.app.ts` | Builds `aimo run --json` success payload (no I/O). |
| `runPipeline/shared/runPipelineEmitHumanWriteComplete.app.ts` | Human stdout when slice ends (plan-only, execute-only, review). |
| `runPipeline/shared/formatGitDiffHeadError.app.ts` | Merge optional `git diff HEAD` capture errors. |
| `runPipeline/shared/formatStageSliceForHumans.app.ts` | Human-readable `plan → execute` slice label. |
| `wireDefaults.ts` | Composition root — clock, cleanup, env, YAML loaders, `BunHttpPort`, `InProcessFakeChatProvider`, `OpenAiCompatChatProvider` factory, stage `assert*` wiring including `assertRunPipelineWired`. |

## `src/core/`

| Module | Responsibility |
| ------ | ---------------- |
| `contracts/ExitCodes.constants.ts` | Process exit code contract. |
| `contracts/SchemaVersion.constants.ts` | `schema_version` for artifacts. |
| `config/DotEnvParse.behavior.ts` | Pure `.env` text → map parser. |
| `config/EnvPrecedence.behavior.ts` | Pure merge of env maps (process wins over files). |
| `config/deepMergeRecord.behavior.ts` | Deep-merge YAML roots; project `aimo.yaml` overlays user `config.yaml`. |
| `config/AimoConfig.schema.ts` | Zod schema + `safeParseAimoConfig` for merged YAML; `workers`, `pipeline.shrinkers`, `PLAN_PATH_TEMPLATE_TOKEN` for argv + stdin sentinel. |
| `config/AimoInitTemplates.behavior.ts` | Commented starter YAML strings for `aimo init` (validated against schema). |
| `lifecycle/CleanupRegistry.behavior.ts` | Pure LIFO cleanup registration (signals wired in `runtime/`). |
| `chat/ChatCompletion.types.ts` | OpenAI-shaped chat completion request/response types (non-streaming v1). |
| `ports/IClockPort.types.ts` | Time port (example port + contract tests). |
| `ports/IChatCompletionPort.types.ts` | One-shot chat completion port (fake + future HTTP adapters). |
| `ports/IHttpPort.types.ts` | JSON POST port for OpenAI-compatible HTTP providers. |
| `plan/BuildPlanMessages.behavior.ts` | Planner system + user messages from task text. |
| `plan/ResolvePlanStage.behavior.ts` | Resolve `profiles.*.plan` routing from merged config. |
| `review/BuildReviewMessages.behavior.ts` | Reviewer system + user messages (plan, diff, transcript slots). |
| `review/exitCodeForReviewVerdict.behavior.ts` | Map `VERDICT` token to `ExitCodes` review exits. |
| `review/ParseReviewVerdict.behavior.ts` | Parse final `VERDICT:` line from reviewer markdown. |
| `review/ensureVerdictForPersistedReview.behavior.ts` | Append `VERDICT: pass` for `fake` provider when missing; else require parseable verdict. |
| `review/ResolveReviewStage.behavior.ts` | Resolve `profiles.*.review` routing from merged config. |
| `run/resolvePipelineStageRange.behavior.ts` | Parse `--from` / `--to` stage names; inclusive ordered slice (`plan` → `review`). |
| `runs/AimoRunPaths.constants.ts` | Relative `.aimo/runs/<id>/` path helpers (`plan.md`, `review.md`, diff files, …). |
| `runs/RunManifest.types.ts` | Plan-stage `manifest.json` shape. |
| `runs/RunManifestJson.behavior.ts` | Serialize plan manifest to pretty JSON. |
| `runs/isPathInsideRoot.behavior.ts` | Pure check: is `candidate` strictly inside `root` (after both have been resolved/realpathed). |
| `execute/assertPlanPathAnchoredInRepoRoot.behavior.ts` | Reject plan paths that resolve outside repo root. |
| `execute/ExecuteResultJson.behavior.ts` | Serialize `execute.result.json` (exit code + optional git error). |
| `execute/isSafeRunDirectoryName.behavior.ts` | Reject unsafe `.aimo/runs/<id>/` directory names. |
| `execute/ResolveDelegatedExecute.behavior.ts` | Resolve `profiles.*.execute` when `type: delegated`. |
| `execute/substitutePlanPathInArgv.behavior.ts` | Replace `{plan_path}` in argv strings. |
| `contextSources/ContextSource.constants.ts` | Shrinkable source enum (`execute.stdout`, …). |
| `contextSources/ContextSourcePaths.behavior.ts` | Map source id → raw / shrunk basenames under a run dir. |
| `openaiCompat/BuildOpenAiChatPayload.behavior.ts` | Pure OpenAI `chat/completions` JSON body builder. |
| `openaiCompat/ParseOpenAiChatResponse.behavior.ts` | Parse OpenAI-shaped completion JSON into port types. |
| `workers/BuildWorkerMessages.behavior.ts` | Worker shrinker system + user messages (DATA block). |
| `workers/FormatWorkerDataBlock.behavior.ts` | Delimited untrusted blob wrapper for worker prompts. |
| `workers/FirstShrinkerPerSource.behavior.ts` | Deduplicate shrinkers (first row per `source` wins). |
| `workers/ResolveWorker.behavior.ts` | Resolve `workers.<name>` from merged config. |
| `workers/SerializeWorkersSidecar.behavior.ts` | Pretty JSON for `workers.json` sidecar. |
| `workers/TruncateWorkerInput.behavior.ts` | Cap worker prompt input by character length. |

## `src/features/`

| Module | Responsibility |
| ------ | ---------------- |
| `planStage.feature.ts` | `runPlanChat` — one completion via `IChatCompletionPort` + `buildPlanMessages`. |
| `reviewStage.feature.ts` | `runReviewChat` — one completion via `IChatCompletionPort` + `buildReviewMessages`. |
| `workersStage.feature.ts` | `runWorkerChat` — one shrinker completion (truncate in/out, usage metadata). |
| `runPipeline.feature.ts` | Re-exports pipeline stage hooks for composition; full `aimo run` lives under `app/`. |

## `src/providers/`

| Module | Responsibility |
| ------ | ---------------- |
| `fake/InProcessFakeChat.provider.ts` | Deterministic in-process `IChatCompletionPort` (no network). |
| `openaiCompat/OpenAiCompatChat.provider.ts` | `IChatCompletionPort` over `IHttpPort` + OpenAI-compatible JSON. |

## `src/runtime/bun/`

| Module | Responsibility |
| ------ | ---------------- |
| `ClockPort.bun.ts` | `IClockPort` using wall clock (allowed only in runtime). |
| `EnvLoader.bun.ts` | Read `./.env` + `~/.config/ai-model-orchestrator/.env`, merge with `process.env` via `mergeEnvLayers`. |
| `ConfigLoader.bun.ts` | Read user `config.yaml` + `./aimo.yaml`, `mergeConfigRecordLayers`, Zod validate; `loadAimoConfigFromPaths` for tests. |
| `ConfigInitWriter.bun.ts` | `runInitWrites` — mkdir user dir, conditional write / skip / overwrite for init. |
| `HttpPort.bun.ts` | `IHttpPort` via `fetch` + JSON body/parse with default 60s timeout (override via `AIMO_HTTP_TIMEOUT_MS`). |
| `GitDiffHead.bun.ts` | `readGitDiffHeadText` — `git diff HEAD` capture for execute stage. |
| `DelegatedSpawn.bun.ts` | `runDelegatedArgv` — `Bun.spawn` argv-only, optional stdin from `Bun.file`. Inherits full `process.env` (delegated executors are TRUSTED). |
| `RunWorkspace.bun.ts` | `prepareRunArtifactPaths` (mode 0o700 + `realpath` symlink check), `writePlanArtifacts`, `writeExecuteStageArtifacts` (+ stdout/stderr raw), `writeReviewMarkdown`. |
| `RunProgressStderrStyle.bun.ts` | `createRunProgressStderr(mode)` factory + module-default writers — colored `run:` lines on stderr (respects `NO_COLOR`, `--progress-color`, TTY). |
| `WorkersSidecarJson.bun.ts` | Write `.aimo/runs/<id>/workers.json`. |

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
| `e2e/` | Black-box CLI tests (`init`, `doctor`, `ping`, `plan`, `run`, `execute`, `review`, workers/shrinkers, `--version`, failure paths). |
| `e2e/_helpers/isolatedHomeProject.ts` | Fake `$HOME` + project dir for config e2e (no real `~/.config` reads). |
| `unit/` | Fast pure tests (`deepMergeRecord`, `AimoConfig.schema`, `InProcessFakeChat`, …). |
| `integration/` | Filesystem-backed tests (`configLoader`, `envLoader`, `fakeChat`, `openAiCompatChat`, `delegatedExecute`, `runWorkspace`, wiring smoke). |
