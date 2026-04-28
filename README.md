# ai-model-orchestrator (`aimo`)

Bun + TypeScript CLI for **plan → execute → review** workflows with **different models per stage**, plus a future **lab bench** for comparing profiles.

> **Status:** Phase 0 tooling and scaffold. **Backlog and order of work:** [`docs/ai/roadmap.md`](./docs/ai/roadmap.md).

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
- [`CLAUDE.md`](./CLAUDE.md) — quick pointer + same rules for Claude Code sessions
- [`docs/ai/`](./docs/ai/) — roadmap, architecture, contribution contract, conventions, security model, catalog
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — short contribution guide

API reference (early scaffold): run `bun run docs` → HTML in `dist/docs/` (ignored by git).

## License

MIT — see [`LICENSE`](./LICENSE).
