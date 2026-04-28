# ai-model-orchestrator (`aimo`)

Bun + TypeScript CLI for **plan → execute → review** workflows with **different models per stage**, plus a future **lab bench** for comparing profiles.

> **Status:** Phase 0 tooling and scaffold. Milestone A (core vertical slice) is tracked in the project plan.

## Requirements

- [Bun](https://bun.sh/) `>=1.2.0`

## Quick start

```sh
bun install
bun run check
bun src/app/cli.ts --help
```

## Docs for contributors

- [`AGENTS.md`](./AGENTS.md) — architecture, boundaries, JSDoc, anti-patterns, workflows
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — short contribution guide

## License

MIT — see [`LICENSE`](./LICENSE).
