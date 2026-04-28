# AGENTS.md — ai-model-orchestrator

## Project Overview

- what aimo is, two jobs (orchestrator + lab bench), Bun runtime, why TS strict

## AI Assistant Instructions

- "you are an expert Bun/TS CLI engineer specializing in LLM orchestration..."
- golden rule: one obvious home per concern, ports for all I/O
- always run `bun run check` before declaring done

## Project Architecture

- layer map (app / features / runtime / providers / core / shared)
- allowed-imports table (matches eslint + dep-cruise)
- path aliases (@app, @features, @runtime, @providers, @core, @shared)

## File Structure Standards

- file-suffix vocabulary table:
  .behavior.ts | pure functions
  .model.ts | data shape + factory
  .types.ts | type-only exports
  .constants.ts| constants (separate file even when 4 lines)
  .test.ts | colocated tests
  .command.ts | CLI command handler (in src/app/commands/)
  .feature.ts | orchestrator (in src/features/)
  .provider.ts | LLM adapter (in src/providers/)
  .port.ts | interface (in core/ports/, name e.g. FsPort.port.ts)
  .bun.ts | Bun-backed port impl (in runtime/bun/)
  .fake.ts | in-memory port impl (in shared/test-fakes/)
- barrel `index.ts` per module
- tiny single-purpose files (constants/types/behavior in their own file)
- tests colocated; tests/e2e/ only for subprocess CLI tests

## Documentation Standards

- JSDoc on every exported function/type/const/class
  - @param, @returns, @throws, @example where useful
  - @category for TypeDoc grouping
- file-level header comment template:
  /\*\*
  - @file Router.behavior.ts
  - @layer core
  - @description Pure model-selection logic for a given (stage, profile).
  -              No I/O, no clock, no randomness.
  - @see {@link FsPort} for the port pattern
    \*/
- `bun run docs` produces dist/docs/ via TypeDoc
- eslint-plugin-jsdoc enforces completeness

## TypeScript Standards

- strict rules table:
  - no `any` (use `unknown` + narrow)
  - interface `I` prefix
  - no `as` casts (use type guards / discriminated unions)
  - explicit return types on every exported function
  - strict null checks
  - exhaustive switches via @typescript-eslint/switch-exhaustiveness-check
- error-handling pattern:
  catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  ...
  }

## Step-by-Step Guides (the heart of the doc)

- "How to add a new CLI command" (8-step guide w/ full skeleton)
- "How to add a new provider" (8-step guide w/ full skeleton)
- "How to add a new executor (delegated)" (6-step guide w/ full skeleton)
- "How to add a new port" (7-step guide w/ full skeleton)
- "How to add a new profile" (3-step guide)
- "How to add a new observation compressor"(5-step guide w/ full skeleton)

## Anti-Patterns to Avoid

- ❌ `any` type
- ❌ `console.log` in `core/` / `features/` / `providers/` (prefer `ITerminalPort` from `app/`; `no-console` is relaxed only for the minimal bootstrap in `src/app/` until logging is wired)
- ❌ Direct fs/spawn/fetch in core/\* (use a port)
- ❌ Math.random / Date.now in core/\* (use ports)
- ❌ Including .env contents in any string sent to a model
- ❌ Writing outside the repo root from the builtin executor
- ❌ Default exports outside entrypoints
- ❌ Cross-layer imports that violate the boundary table
- ❌ Logic in CLI command files (delegate to a feature)
- ❌ Mixing planner context with .env contents in any flow
- ❌ Blocking stdout with status messages (status -> stderr)

## Quality Checklists (one per component type)

- "Adding a CLI command — checklist" (12 items)
- "Adding a provider — checklist" (10 items)
- "Adding an executor — checklist" (8 items)
- "Adding a port — checklist" (9 items, includes contract test)
- "General feature checklist" (15 items, mirrors your API's)

## Development Workflow

- bun install
- bun run dev (watch + run)
- write failing test FIRST (TDD)
- implement
- bun run check (typecheck + lint + format:check + depcruise + test)
- commit (commitlint enforces conventional commits)

## Remember

- consistency over cleverness
- tests first, always
- .env never enters a prompt
- one obvious home per concern
