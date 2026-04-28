# Contribution contract (non‑negotiables)

These rules exist so humans and agents can change the CLI **safely** and **predictably**. CI and lint encode most of them; the rest is review discipline.

1. **`bun run check` must be green** before a change is considered done (`typecheck`, `eslint`, `prettier`, `depcruise`, `bun test`).
2. **`src/core/**` stays pure** — no `process`, `Bun`, `fetch`, `Date.now`, `Math.random`, or `new Date()`. Inject `IClockPort`, `IRandomPort`, `IHttpPort`, etc.; wire real implementations only from `src/app/`.
3. **`src/features/**` never imports `@runtime/*`** — features receive ports from `wireDefaults` (tests inject fakes).
4. **`src/runtime/**` never imports `@providers/*`** — HTTP is a generic primitive; LLM adapters consume the port, not the reverse.
5. **`src/app/**` is the only composition root** — searching for `from '@runtime/bun'` outside `src/app/` should return **zero** hits (once fully wired).
6. **TDD by default** — add or update a **failing test first** when behavior is specified; trivial doc-only changes are exempt.
7. **Conventional commits** — `feat:`, `fix:`, `chore:`, etc., per `commitlint.config.js` (release-please reads `main`).
8. **Secrets never reach model prompts** — redact `.env` shapes and configured `api_key_env` values before any string is sent to a provider (enforced in `core/security` once implemented).
9. **Delegated executors are argv + optional `stdin_file` only** — no shell strings, no `{plan_inline}`; plan **content** never enters `argv` (see [security-model.md](./security-model.md)).
10. **Exit codes and `schema_version` are contracts** — use `ExitCodes` and `CURRENT_SCHEMA_VERSION` from `@core/contracts`; do not invent ad hoc exit values for user-visible outcomes.

If you need to break a rule, write an **ADR** under `docs/adr/` (add the folder when the first ADR exists) and get explicit agreement in the PR description.
