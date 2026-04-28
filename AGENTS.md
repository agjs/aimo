# AGENTS.md — ai-model-orchestrator (`aimo`)

## Project overview

**ai-model-orchestrator** is a Bun + TypeScript CLI (`aimo`) that does two jobs:

1. **Orchestrator** — Run **plan → execute → review**, assigning **different models per stage** via named **profiles** (YAML + `.env` for secrets).
2. **Lab bench** — Run the same task across profiles in isolation (e.g. git worktrees) and emit **metrics-only** scorecards for cheap experimentation.

**Why Bun + strict TS:** fast cold start, native `bun test` / `Bun.spawn`, single toolchain. Strictness (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, no `any`) catches integration bugs early.

**Milestones:** **A** = smallest vertical slice (init, fake provider, plan, delegated execute, review, `run` / `--dry-run`, doctor). **B** = compare / models / cost / clean. **C** = builtin executor hardening + coverage sweep.

---

## AI assistant instructions

You are an expert **Bun / TypeScript CLI** engineer focused on **LLM orchestration**, **token-aware context**, and **safe execution boundaries**.

**Golden rules**

1. **One obvious home per concern** — if unsure, read [docs/ai/architecture.md](./docs/ai/architecture.md) and update [docs/ai/catalog.md](./docs/ai/catalog.md).
2. **Ports for all I/O** — `core/` never opens files, shells, or network; it receives ports or pure inputs.
3. **Composition root** — only `src/app/**` wires concrete Bun adapters (`runtime/bun/*`) into features.
4. **Tests first** when behavior is specified (`bun test`); then implement until green.
5. **Always run `bun run check`** before claiming a task is done.

---

## Architecture (layers + imports)

| Layer       | Path               | Responsibility | Allowed imports |
| ----------- | ------------------ | ---------------- | --------------- |
| `app`       | `src/app/`         | CLI entry, command registration, **wires** ports + providers + features. **Only layer that imports `@runtime/*`.** | `app`, `features`, `runtime`, `providers`, `core`, `shared` |
| `features`  | `src/features/`    | Orchestrators (`runPipeline`, stages, compare). **Receives ports via parameters** — no Bun imports. | `features`, `core`, `providers`, `shared` |
| `runtime`   | `src/runtime/`     | Bun I/O: fs, shell, http, clock, env loader, signals, atomic write, git. | `runtime`, `core`, `shared` |
| `providers` | `src/providers/`   | LLM adapters; use `IHttpPort`; declare capabilities. | `providers`, `core`, `shared` (prefer `core/ports` + small types only) |
| `core`      | `src/core/`        | **Pure** domain: router, contracts, security, observations, manifest math, prompt **templates**. | `core`, `shared` |
| `shared`    | `src/shared/`      | Shared types, errors, constants, **test fakes** under `shared/test-fakes/`. | `shared`, `core` (fakes implement `@core/ports`) |

Path aliases: `@app/*`, `@features/*`, `@runtime/*`, `@providers/*`, `@core/*`, `@shared/*` (see `tsconfig.json`).

---

## Boring contracts (do not hand-wave)

### Exit codes (`@core/contracts/ExitCodes.constants.ts`)

| Code | Meaning |
| ---: | ------- |
| `0` | Success / review **pass** |
| `1` | Operational error (I/O, network, unexpected) |
| `2` | Review **changes_requested** |
| `3` | Review **fail** |
| `4` | Budget exceeded |
| `5` | Config error |
| `6` | Dirty working tree (e.g. compare without `--allow-dirty`) |
| `130` | User cancelled (SIGINT) |

CLI commands and e2e tests **must** use these constants — no magic numbers in product code.

### Schema version

Every persisted artifact carries `schema_version: 1` (see `@core/contracts/SchemaVersion.constants.ts`) until a migration bumps it.

### Cleanup

`CleanupRegistry` in `core/` is **pure**; `runtime/bun/SignalHandler` (future) registers SIGINT/SIGTERM and drains callbacks (worktrees, child processes, temp files).

---

## File naming (suffix vocabulary)

| Suffix | Meaning |
| ------ | ------- |
| `*.behavior.ts` | Pure logic / transforms |
| `*.model.ts` | Data + factories |
| `*.types.ts` | Type-only exports |
| `*.constants.ts` | Constants |
| `*.port.ts` | Port interfaces (`src/core/ports/`) |
| `*.bun.ts` | Bun port adapters (`src/runtime/bun/`) |
| `*.fake.ts` | In-memory fakes (`src/shared/test-fakes/`) |
| `*.command.ts` | CLI command wiring (`src/app/commands/` when added) |
| `*.provider.ts` | LLM provider modules |

Use **barrel `index.ts`** only when it improves clarity (avoid deep barrel cycles).

**Tests:** colocate `*.test.ts` next to small modules **or** place under `tests/unit`, `tests/integration`, `tests/e2e`, `tests/_contracts`.

---

## JSDoc (required)

- Every **exported** function, class, interface field (where non-obvious), and **exported const** must have JSDoc.
- Use `@param`, `@returns`, `@throws`, `@example` when they add signal.
- Use `@category` for TypeDoc grouping once the API surface grows.

**File header template**

```ts
/**
 * @file Example.behavior.ts
 * @layer core
 * @description One-line summary. Optional extra sentences.
 * @see {@link IClockPort} when linking to a port type
 */
```

Run **`bun run docs`** (TypeDoc) after public API changes; CI may gate `treatWarningsAsErrors` later.

---

## TypeScript standards

- No `any` — use `unknown` + narrowing.
- **`I` prefix** on interfaces meant to be implemented.
- Avoid `as` / non-null `!` in product code.
- **Exhaustive `switch`** on discriminated unions (`@typescript-eslint/switch-exhaustiveness-check`).
- **`catch (error: unknown)`** then narrow:

```ts
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // ...
}
```

---

## Step-by-step guides

### How to add a new CLI command

1. Add `src/app/commands/<Name>.command.ts` (thin): parse flags → call a **feature** function.
2. Register the subcommand in `src/app/cli.ts` (or a dedicated `registerCommands.ts` if the file grows).
3. Add **e2e** coverage in `tests/e2e/` using `spawnCli` from `tests/_helpers/spawnCli.ts`.
4. If the command persists artifacts, bump / honor **`schema_version`** and **`ExitCodes`**.
5. Document flags in `README.md` when the command is user-visible.
6. Run `bun run check`.

### How to add a new provider

1. Add adapter under `src/providers/<Name>.provider.ts` (or folder) implementing the shared chat boundary (types TBD in Milestone A).
2. Declare **`IProviderCapabilities`** (when the type lands) — router must refuse impossible combos early.
3. Register in the provider registry wired from `src/app/wireDefaults.ts`.
4. Add **unit tests** with `FakeHttpPort` (once it exists) and golden HTTP fixtures.
5. Run `bun run check`.

### How to add a delegated executor

1. Extend YAML schema: **`command: string[]`** + optional **`stdin_file`**. Never add shell strings or `{plan_inline}`.
2. Implement spawn via **`IShellPort`** with `shell: false`; pipe stdin when `stdin_file` is set.
3. Register cleanup on **`CleanupRegistry`** for SIGINT.
4. Document trust boundary in PR + [docs/ai/security-model.md](./docs/ai/security-model.md).
5. Run `bun run check`.

### How to add a new port

1. Define `IYourPort` in `src/core/ports/YourPort.types.ts` (type-only file).
2. Add **`FakeYourPort`** in `src/shared/test-fakes/YourPort.fake.ts`.
3. Add **`BunYourPort`** in `src/runtime/bun/YourPort.bun.ts`.
4. Add **`tests/_contracts/YourPort.contract.test.ts`** asserting identical behavior for fake vs real where applicable.
5. Wire the Bun implementation in `src/app/wireDefaults.ts` only.
6. Run `bun run check`.

### How to add a new profile knob

1. Update the zod schema (when config module lands) under `src/core/config/`.
2. Extend `aimo init` template / docs.
3. Add a focused **unit test** for profile resolution / defaults.
4. Run `bun run check`.

### How to add an observation compressor

1. Add pure function in `src/core/observations/<Name>.behavior.ts`.
2. Add **golden snapshot** tests under `tests/unit/`.
3. Wire into planner/reviewer prompts only through the compressor (no raw `ls -R` dumps).
4. Run `bun run check`.

---

## Anti-patterns

- `any`, unchecked `as`, or `!` in product code.
- `console.log` in `core/`, `features/`, or `providers/` (prefer structured logging / `ITerminalPort` from `app/` once wired; `src/app/` may stay pragmatic until then).
- **Direct** `fs` / `child_process` / `fetch` / `Bun.*` I/O inside `core/**`.
- `Math.random`, `Date.now`, `new Date()` inside `core/**`.
- Putting **API keys** or `.env` contents into prompts, logs, or manifests.
- **Default exports** outside allowlisted entry/config files.
- **Cross-layer imports** that violate the table above.
- Fat logic inside CLI files — **delegate** to `features/`.
- **stdout** for status spam — send progress to **stderr**; keep stdout pipeable.

---

## Checklists

### New CLI command

- [ ] Thin `*.command.ts` + feature entrypoint
- [ ] Uses **`ExitCodes`**
- [ ] E2E subprocess test (`spawnCli`)
- [ ] Docs / `--help` strings
- [ ] `bun run check`

### New provider

- [ ] Capability object accurate
- [ ] Tests with fake HTTP
- [ ] Secrets never logged
- [ ] `bun run check`

### New executor path

- [ ] Argv-only + optional `stdin_file`
- [ ] Cleanup on signals
- [ ] Trust boundary documented
- [ ] `bun run check`

### New port

- [ ] Interface in `core/ports`
- [ ] Fake + Bun impl
- [ ] Contract test
- [ ] Wired only from `app/`
- [ ] `bun run check`

### General PR

- [ ] Scope matches milestone
- [ ] Tests / docs updated in same PR when behavior changes
- [ ] No accidental `runtime` import from `features`
- [ ] `bun run check` green

---

## Development workflow

```sh
bun install
bun run dev          # watch CLI help entry
bun test             # unit + integration + e2e
bun run docs         # TypeDoc → dist/docs (local)
bun run check        # typecheck + lint + format + depcruise + test
```

Husky runs **`bun run check` on every `git commit` and again on `git push`** (see `CONTRIBUTING.md`). Do not merge or push if hooks are red.

Conventional commits (`feat:`, `fix:`, `chore:`, …) — enforced by Husky + commitlint; **release-please** reads `main`.

---

## Remember

- **Consistency over cleverness**
- **Tests first** when the behavior is known
- **`.env` never enters a prompt`**
- **One obvious home per concern**
