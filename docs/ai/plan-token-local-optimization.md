# Plan — Token budget & local context (`aimo`)

**Status:** Draft backlog (execute phases only when explicitly requested off plan mode).  
**Purpose:** One ordered strategy for using **the user’s machine** to **shrink what reaches cloud LLMs**, **reuse local tools**, and keep `aimo` aligned with **ports + runtime + app** layering. This is **not** vector RAG unless a phase explicitly says so.

**Canonical doc:** this file. *(Former standalone fetch plan is folded in as **Phase A**.)*

---

## Principles

1. **Local first for bulk:** fetch, parse, grep, lint, diff, format — do deterministic work locally; send **summaries or slices** upstream.
2. **Core stays pure:** URL rules, truncation math, message shaping live in `src/core/`; I/O in `src/runtime/bun/`; CLI in `src/app/`.
3. **Heavy deps load lazily** where it matters (e.g. jsdom only on commands that need it).
4. **Security defaults:** caps, timeouts, scheme allowlists; document SSRF limits until hardened.
5. **Orthogonal to the editor:** Cursor MCP and similar remain separate; `aimo` focuses on **CLI pipeline** and **delegated/builtin executors**.
6. **Economy tier (optional):** some subtasks are **API-bound completions** on the cheapest suitable model (e.g. via OpenRouter); treat their outputs like **untrusted tool results** when fed back to a “smart” primary model.

---

## Phase A — Web ingest (`aimo fetch`) *(detailed; first implementation slice)*

**Goal:** **`aimo fetch <url>`** — bounded GET → **Mozilla Readability** (JSDOM) → optional fallback → **max-chars** truncation; **`--json`** for scripts.

### Non-goals (Phase A)

- Embeddings, vector DBs, chunking as a product (“RAG”).
- Tool-calling loops inside plan/review (defer to Phase E unless reprioritized).
- Bundling third-party MCP servers inside `aimo`.

### Layering (Phase A)

| Layer | Responsibility |
| ----- | -------------- |
| **`src/core/**`** | Pure: HTTP(S) URL validation; truncate string with explicit `truncated` flag. |
| **`src/runtime/bun/**`** | Stream-capped GET; UTF-8 v1 decode; JSDOM + `@mozilla/readability`; fallback if `parse()` is null. |
| **`src/app/commands/**`** | `registerFetchCommand`; **lazy `import()`** of runtime module so other subcommands avoid jsdom cold start. |
| **Exit codes** | `EXIT_SUCCESS` / `EXIT_OPERATIONAL_ERROR`. |

### CLI (Phase A)

```text
aimo fetch <url> [--json] [--max-bytes <n>] [--max-chars <n>] [--timeout-ms <n>]
```

Suggested defaults: ~1 MiB raw body, ~48k output chars, ~15s timeout. No merged YAML required for v1.

### Dependencies (Phase A)

- `@mozilla/readability`, `jsdom`, `@types/jsdom` (dev if needed).

### Security (Phase A)

- Reject non-`http:`/`https:` schemes.
- Document incomplete private-IP / DNS SSRF story for v1.
- User-Agent: `aimo/<version>`.

### Tests (Phase A)

- Unit: URL gate, truncation.
- Integration: fixture HTML → expected title/text substring; **no** live network in CI.

### Wiring checklist (Phase A)

1. Dependencies + implementation + `cli.ts` registration.
2. [`docs/ai/catalog.md`](./catalog.md) row.
3. [`docs/ai/roadmap.md`](./roadmap.md) note: **web ingest / readability**, not vector RAG.
4. `bun run check` green.

### Open decisions (Phase A)

- Charset beyond UTF-8 in v1 vs deferred.
- Readability `null`: aggressive `body` fallback vs fail-fast.

---

## Phase B — Repo-local context (no vectors)

**Intent:** Same “minimum signal” idea as fetch, for **the workspace**.

| Idea | Local work | Shrink for model |
| ----- | ----------- | ---------------- |
| **Scoped grep** | `rg` / `git grep` with path + line limits | Paste **hits + snippets**, not whole files |
| **Structure / symbols** | tree-sitter, ctags, or `tsc --listFilesOnly`-style flows | **Signatures + call sites** |
| **Diagnostics JSON** | `eslint -f json`, `tsc` errors | **Structured issues** only |
| **Diff-first** | Already used in review; extend patterns | Prefer **unified diff** over full file dumps |

**Delivery shape (when scheduled):** new command(s) or flags (e.g. `aimo context` / `--attach-grep`) + ports for spawn/read; pure builders in `core` for “format grep hits into a DATA block.”

**Non-goals (Phase B):** embedding indexes, Pinecone, etc.

---

## Phase C — Deterministic transforms & cache

| Idea | Role |
| ----- | ----- |
| **Format / codegen** | Run prettier, generators locally; model only for decisions. |
| **Disk cache** | Cache fetch URL → extracted text (and optional grep key) to skip repeat tokens. |
| **Local token estimate** | Optional tiktoken-style budget before send. |

**Non-goals:** replacing cloud models for planning; this is **preprocessing**.

---

## Phase D — Small **local** model (optional)

**Intent:** Local CPU/GPU for **summarize / classify / route** long logs or oversized blobs before one cloud call (no upstream spend for that hop).

**Dependencies:** process boundary (e.g. Ollama HTTP) or WASM; config for endpoint and caps.

**Risk / cost:** packaging, quality drift, ops — **after** Phases A–C prove value with deterministic steps.

**Contrast:** Phase **F** is **remote** but **cheap** worker models; Phase D stays **on-machine** inference.

---

## Phase E — Orchestrated tool loop (larger)

**Intent:** For plan/review (or builtin executor), support **tool calls** where the **runtime** executes `fetch_page`, `rg`, `read_file_slice`, etc., and only **tool results** grow context in a controlled way.

**Touches:** chat types, providers, fake provider, config for allowed tools — **separate** from Phase A surface.

**Relation to roadmap:** aligns with Milestone **C** (builtin executor) and future provider work; sequence explicitly after smaller wins.

---

## Phase F — Tiered models: **cheap worker completions** as tools *(config-driven)*

**Intent:** User config names **roles** (e.g. `grep_planner`, `json_fixer`, `log_squeezer`) mapped to **provider + model** profiles tuned for **minimum cost** (e.g. smallest / cheapest routes on OpenRouter or another gateway). The **primary** (“smart”) model drives the task; `aimo` **orchestrates** one or more **worker** chat completions on bounded prompts, takes **worker stdout / structured result**, and **injects** it back into the primary thread (same pattern as tool results: compact, capped, delimited).

**User-facing story:** “The smart model uses super cheap models as tools” — implemented as **explicit orchestration** (our loop + manifests), not magic inside a single provider call.

### Config shape (sketch — ADR before implementation)

- **Named worker profiles** in YAML (reuse or extend existing `profiles` / stage routing), e.g. `workers.grep_agent: { provider, model, max_tokens, temperature }`, or `subagents.*` referencing a profile by name.
- **Allowlist** which stages or which tool kinds may spawn workers (avoid accidental spend).
- **Budget hooks** (ties to `EXIT_BUDGET_EXCEEDED` / future cost fields): max worker calls per run, max tokens per worker call.

### Runtime behavior (sketch)

1. Primary completion returns structured **delegate-to-worker** request (requires **Phase E** tool schema or a narrower v0 “orchestrator-only” contract).
2. `aimo` builds a **small** worker prompt (includes only slices: grep hits, fetch excerpt, etc. — **Phase A/B** shrink the input first when possible).
3. Worker `complete()` via existing **HTTP provider path**; capture text + usage.
4. Append result to primary context as **`DATA` / tool** block; primary continues until stop.

### Why not only “grep locally”?

- Deterministic **grep** (Phase B) is still preferred when the task is literal search.
- Workers help when the step is **judgment under constraints** (“pick the three most relevant symbols from this list”) at **lower $** than the primary.

### Risks / design obligations

- **Latency:** N serial worker calls vs one big model call — need caps and parallel policy later.
- **Quality:** cheap models mis-summarize; primary must tolerate or re-ask; log artifacts for replay.
- **Security:** worker output is **untrusted** for the primary (same as tool results) — prompt isolation + redaction.
- **Observability:** extend run manifest / sidecar JSON with **per-worker** usage rows for compare / cost work (Milestone B).

### Sequencing

- **Depends on:** HTTP providers wired for real completions (beyond `fake`), plus **Phase E** (or a thin v0 orchestrator that only allows one hard-coded worker role to prove the pattern).
- **Parallel track:** Phase D (local) and Phase F (remote cheap) can coexist; config chooses per role.

---

## Cross-cutting (all phases)

| Concern | Note |
| ------- | ---- |
| **Redaction** | Planned `RedactSecrets` / env shapes — saves tokens **and** prevents leaks. |
| **Prompt isolation** | DATA blocks for untrusted blobs (security-model). |
| **Delegated execute** | Already the main “full local power” path (`aider`, `codex`, …); keep argv/stdin contract strict. |
| **Naming** | Call web/readability work **“web ingest”**, not RAG, in roadmap text. |
| **Worker → primary** | Treat cheap-model outputs like **tool payloads**: delimited, size-capped, never blindly executed as shell. |

---

## Roadmap alignment

- **Milestone A–C** in [`roadmap.md`](./roadmap.md) stay the spine; **Phase A** can land as a small addition once approved.
- Vector **RAG** remains **out of scope** as written until an ADR promotes it.
- **Milestone C** builtin executor **amplifies** Phase B/E (sandboxed read/write).
- **Phase F** aligns with **multi-profile** story already in the product vision; needs **Zod config** + **ADR** for `workers` / `subagents` shape before coding.

---

## Execution gate

Do **not** implement until plan mode is off and you give an explicit go (e.g. “Implement **Phase A** per `docs/ai/plan-token-local-optimization.md`”). Later phases get separate execution calls unless you scope “through Phase B” in one PR.
