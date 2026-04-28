# Roadmap — `aimo`

**Purpose:** Single ordered backlog for humans and agents. **Status** is updated when work merges; prefer this file over ad-hoc chat todos so handoffs stay coherent.

**Delivery order:** A → B → C (see [architecture.md](./architecture.md) for diagram and layer rules).

---

## Milestone A — Vertical slice (current focus)

Goal: end-to-end **plan → execute → review** on disk, **fake LLM** in CI, real YAML + env wiring.

| # | Deliverable | Status |
| - | ----------- | ------ |
| A1 | Config: Zod schema, merge `~/.config/ai-model-orchestrator/config.yaml` + `./aimo.yaml` (precedence documented) | Not started |
| A2 | `aimo init` — writes commented starter config (+ optional local `aimo.yaml`) | Not started |
| A3 | `aimo doctor` — resolves config paths, reports schema/version, missing files | Not started |
| A4 | Fake provider + shared chat request/response types; wired via `IHttpPort` or in-process fake | Not started |
| A5 | `aimo plan` — planner prompt, stream/save `plan.md`, run id under `.aimo/runs/<id>/` | Not started |
| A6 | Delegated `aimo execute` — spawn command with substitutions, capture diff | Not started |
| A7 | `aimo review` — reviewer prompt, `review.md` + `VERDICT:` line | Not started |
| A8 | `aimo run` + `--dry-run` — orchestrates A5–A7; exit codes per [ExitCodes](../../src/core/contracts/ExitCodes.constants.ts) | Not started |
| A9 | Step-shaped flags (`--plan`, `--from`, etc.) so stages compose in shell | Not started |
| A10 | Vitest: schema, merge, fake provider, one integration test for full dry pipeline | Not started |

**Exit criteria for A:** `bun run check` green; e2e runs `aimo` with fake provider in CI; README quickstart updated.

---

## Milestone B — Lab bench

| # | Deliverable | Status |
| - | ----------- | ------ |
| B1 | `compare` — same task across profiles / worktrees, metrics-only scorecard | Not started |
| B2 | `replay`, `models`, `clean`, `inspect-cost`, aux listing commands | Not started |

---

## Milestone C — Builtin executor + hardening

| # | Deliverable | Status |
| - | ----------- | ------ |
| C1 | Minimal builtin executor (read/write tools, approvals gated by config) | Not started |
| C2 | Coverage sweep + contract tests on ports and manifests | Not started |

---

## Out of scope (recorded ideas)

Proxy mode, RAG, auto-loop — see README / product notes when they exist; not scheduled above.

---

## How agents should use this

1. Pick the **lowest `#` with “Not started”** in the current milestone unless a PR explicitly scopes otherwise.
2. After merging work, update **Status** in the same PR (e.g. → **Done** or **In progress** with a short note).
3. Do not duplicate long specs here — link ADRs or issue trackers when they exist.
