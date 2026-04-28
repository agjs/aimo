# Spec — Cheap workers & pipeline shrinkers

**Status:** Implemented in `main` (Phase F slice 1).  
**Purpose:** Route **large, untrusted** execute outputs (stdout, stderr, `git diff`) through **cheap chat completions** before an expensive plan/review model reads them. Keeps token spend predictable and audit trail on disk.

---

## Acceptance criteria

1. **YAML** — Top-level `workers:` maps names to `{ provider, model, base_url?, max_chars_in, max_chars_out }`. Top-level `pipeline.keep_raw` (default `true`) and `pipeline.shrinkers: [{ source, worker }]` where `source` is one of `execute.stdout`, `execute.stderr`, `execute.git_diff_after`, and `worker` references a key in `workers:`.
2. **Raw artifacts** — After delegated execute, the run dir contains `execute.stdout.txt`, `execute.stderr.txt`, and existing `git.diff.*.txt` / `execute.result.json` (unchanged contract).
3. **Shrunk artifacts** — For each shrinker row (first row per `source` wins), `aimo` writes `*.shrunk.md` next to the raw logical file (`execute.git_diff_after.shrunk.md` for diff).
4. **Review inputs** — Reviewer chat prefers `*.shrunk.md` when present; otherwise falls back to raw diff / empty transcript.
5. **`workers.json`** — After shrinkers run, `.aimo/runs/<id>/workers.json` records `schema_version: 1`, `run_id`, and `calls[]` with usage and `truncated_in`.
6. **CLI** — `aimo run --no-keep-raw` sets effective `keep_raw` to `false` for that run (deletes raw context source files after successful shrink writes).
7. **Dry-run** — `aimo run --dry-run` validates shrinker `worker` names and, when the slice includes **execute**, that each referenced worker has a resolvable chat port (e.g. `fake` or HTTP keys for `openrouter` / `openai-compat`).
8. **Security** — Worker prompts wrap raw bytes in a `DATA` / `END DATA` block marked **untrusted**; caps enforced in core before HTTP.

---

## OpenAI-compatible providers

- **`openrouter`** — Default base `https://openrouter.ai/api/v1`. API key: `OPENROUTER_API_KEY`, then fallback `OPENAI_API_KEY`.
- **`openai-compat`** — Default base `https://api.openai.com/v1`. API key: `OPENAI_API_KEY`, then fallback `OPENROUTER_API_KEY`.

Both use `POST {base}/chat/completions` via `IHttpPort` (`BunHttpPort`).

---

## Related docs

- Roadmap context: [`plan-token-local-optimization.md`](./plan-token-local-optimization.md) (Phase F).
- End-user guide: [`../../USAGE.md`](../../USAGE.md).
