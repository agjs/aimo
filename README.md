<p align="center">
  <img src="assets/aimo-logo.png" alt="aimo — AI model orchestrator" width="480" />
</p>

# aimo — AI model orchestrator

## The problem

Tools like **Claude Code** (and similar agent stacks) are expensive in large part because **one big model** ends up seeing **everything**: huge context windows, noisy tool output, and work-in-progress that does not all need the same reasoning depth. More tokens in and out means more cost, often for signal that could have been handled by a smaller or cheaper model—or never shown to a frontier model at all.

## The solution

**aimo** runs your task as a **pipeline** — **plan** → **execute** → **review** — and lets you **assign different models (and providers / base URLs) per stage**. You use a capable model where it matters and a lighter or cheaper one where it does not, so spend tracks **what each step actually needs**, not “one size fits all” for the whole session.

You declare that routing in YAML: merged **user** config (`~/.config/ai-model-orchestrator/config.yaml`) plus **project** `aimo.yaml` (project wins on conflicts). Optional **workers** can summarize long stdout/stderr or diffs before the next stage sees them, so downstream models are not burning tokens on raw noise.

Each run writes a folder under `.aimo/runs/<id>/` (planner output, execution capture, diffs, reviewer output, manifest, and related files).

**[USAGE.md](./USAGE.md)** — commands, full config reference, workers / shrinkers, exit codes, recipes.

## Install

Needs **curl** or **wget**. Default path: `~/.local/bin/aimo` (`AIMO_INSTALL_DIR` to change). Env: `AIMO_VERSION`, `AIMO_REPO`, `AIMO_BIN_NAME`.

```sh
curl -fsSL https://raw.githubusercontent.com/agjs/ai-model-orchestrator/main/scripts/install-aimo.sh | bash
```

```sh
wget -qO- https://raw.githubusercontent.com/agjs/ai-model-orchestrator/main/scripts/install-aimo.sh | bash
```

If the download **404s**, the [release](https://github.com/agjs/ai-model-orchestrator/releases) has no binary for your platform yet — run [**release-binaries**](https://github.com/agjs/ai-model-orchestrator/actions/workflows/release-binaries.yml) for that tag (workflow_dispatch).

**Changing this codebase** (tests, CI, compiling locally): [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev toolchain is [Bun](https://bun.sh/); end users do not install it.

## Quick start

```sh
aimo init --json
aimo doctor --json
aimo run "your task" --json
aimo run "your task" --dry-run --json
aimo --help
```

Commands that support **`--json`** print one JSON object on stdout; pipe through **`jq`** when you want it formatted (e.g. `aimo doctor --json | jq .`).

## Repo

- [`AGENTS.md`](./AGENTS.md) — layout and conventions for changes here  
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)  
- API HTML: `bun run docs` → `dist/docs/` (gitignored)

## License

MIT — [`LICENSE`](./LICENSE).
