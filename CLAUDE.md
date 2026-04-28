# CLAUDE.md

## Start here

Read **[`AGENTS.md`](./AGENTS.md)** end-to-end before writing code. It is the source of truth for layers, exit codes, security boundaries, naming, JSDoc, and step-by-step guides.

Supporting docs:

- [`docs/ai/roadmap.md`](./docs/ai/roadmap.md) — ordered backlog + status (what to build next)
- [`docs/ai/architecture.md`](./docs/ai/architecture.md) — layer diagram + milestones
- [`docs/ai/contribution-contract.md`](./docs/ai/contribution-contract.md) — ten non‑negotiables
- [`docs/ai/conventions.md`](./docs/ai/conventions.md) — suffix vocabulary + import style
- [`docs/ai/security-model.md`](./docs/ai/security-model.md) — delegated vs builtin trust + argv/`stdin_file` rules
- [`docs/ai/catalog.md`](./docs/ai/catalog.md) — living module index

## Quick workflow

1. Read **`docs/ai/roadmap.md`** for the current milestone item; stay inside scope.
2. Add or update **tests** first when behavior is specified.
3. Implement in **`core` (pure)** → **`features` (orchestrate)** → **`app` (wire)** → **`runtime` / `providers` (adapters)**.
4. Run **`bun run check`**.
5. Commit with **Conventional Commits** (`feat:`, `fix:`, `chore:`, …).

## Product intent (one paragraph)

`aimo` routes **plan**, **execute**, and **review** stages to **different models** per profile, writes **artifacts** under `.aimo/runs/`, and (later) compares profiles in parallel for **token/cost/latency** experiments — with **fake** providers for CI and **POSIX-first** runtime assumptions in v1.
