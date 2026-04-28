# Conventions

## Path aliases (`tsconfig.json`)

| Alias | Path |
| ----- | ---- |
| `@app/*` | `src/app/*` |
| `@features/*` | `src/features/*` |
| `@runtime/*` | `src/runtime/*` |
| `@providers/*` | `src/providers/*` |
| `@core/*` | `src/core/*` |
| `@shared/*` | `src/shared/*` |

## File suffix vocabulary

| Suffix | Use |
| ------ | --- |
| `*.behavior.ts` | Pure functions / small orchestration with **no** I/O |
| `*.model.ts` | Data shapes + factories |
| `*.types.ts` | **Type-only** exports (`interface`, `type`) |
| `*.constants.ts` | Constants (even a single line — keep separate when it aids clarity) |
| `*.port.ts` | Port interface definitions under `src/core/ports/` |
| `*.bun.ts` | Bun-backed port implementations under `src/runtime/bun/` |
| `*.fake.ts` | In-memory fakes under `src/shared/test-fakes/` |
| `*.command.ts` | Thin CLI command wiring under `src/app/commands/` (future) |
| `*.feature.ts` | Feature orchestrators under `src/features/` (optional suffix when clarity helps) |
| `*.provider.ts` | Provider adapter modules under `src/providers/` |
| `*.test.ts` | Tests next to source **or** under `tests/{unit,integration,e2e,_contracts}/` |

## TypeScript

- **`I` prefix** for interfaces intended for implementation (`IClockPort`, `IFsPort`, …).
- **Explicit return types** on every **exported** function and public class method.
- **`unknown` in `catch`** — narrow with `instanceof Error` before using `.message`.
- **No `any`**; avoid unsafe `as`; **no non-null assertion** (`!`) in product code.
- **`verbatimModuleSyntax`** — use `import type` for type-only imports.

## Imports

- ESLint **`import/order`**: builtins → externals → **internals** (`@app` … `@shared`) with blank lines between groups, alphabetical within a group.
- **No default exports** except allowlisted entry/config files (see `eslint.config.js`).

## JSDoc

- Every **exported** symbol gets a JSDoc block with `@param` / `@returns` / `@throws` where applicable.
- File headers use **`@file`**, **`@layer`**, **`@description`** (see `AGENTS.md` template).
- **`@category`** tags group TypeDoc output (once modules exist).

## CLI UX

- **Primary user output** for pipeable content → **stdout**.
- **Status / progress / warnings** → **stderr** so shells can pipe `plan.md` cleanly.
