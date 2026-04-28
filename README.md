# ai-model-orchestrator (`aimo`)

Bun + TypeScript CLI for **plan → execute → review** workflows with **different models per stage**, plus a future **lab bench** for comparing profiles.

> **Status:** Phase 0 tooling and scaffold. **Backlog and order of work:** [`docs/ai/roadmap.md`](./docs/ai/roadmap.md).

## Requirements

- [Bun](https://bun.sh/) `>=1.2.0`

## Quick start

```sh
bun install
bun run check
bun src/app/cli.ts init --json   # optional: write starter ~/.config/.../config.yaml + ./aimo.yaml
bun src/app/cli.ts doctor --json # validate merged config
bun src/app/cli.ts --help
```

**Config (YAML):** user defaults live in `~/.config/ai-model-orchestrator/config.yaml`; the repo-local `./aimo.yaml` **overrides** on a per-key deep merge. See [`docs/ai/roadmap.md`](./docs/ai/roadmap.md) (Milestone A) and runtime `ConfigLoader.bun.ts` JSDoc.

**Check setup:** `bun src/app/cli.ts doctor` (human summary) or `bun src/app/cli.ts doctor --json` (machine-readable, exit `5` on invalid config per `ExitCodes`).

## Docs for contributors

- [`AGENTS.md`](./AGENTS.md) — architecture, boundaries, JSDoc, anti-patterns, workflows
- [`CLAUDE.md`](./CLAUDE.md) — quick pointer + same rules for Claude Code sessions
- [`docs/ai/`](./docs/ai/) — roadmap, architecture, contribution contract, conventions, security model, catalog
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — short contribution guide

API reference (early scaffold): run `bun run docs` → HTML in `dist/docs/` (ignored by git).

## License

MIT — see [`LICENSE`](./LICENSE).
