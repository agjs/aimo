# Contributing

Thanks for considering a contribution. This repository is **opinionated on purpose**: boundaries, ports, and strict TypeScript exist so humans and AI agents can change the CLI safely.

Read [`AGENTS.md`](./AGENTS.md) first — it is the canonical guide for architecture, file naming, JSDoc, and workflows.

## Local setup

Requirements: [Bun](https://bun.sh/) `>=1.2.0` (see `package.json` / `bunfig.toml`). Husky hooks need a git repo — run `git init` in the clone if you are bootstrapping from scratch.

```sh
bun install
bun run check
bun src/app/cli.ts --help
```

If `bun run check` is not green on a fresh clone, treat that as a bug — open an issue before layering new behavior.

## Git hooks (Husky)

After `bun install`, Husky wires:

| Hook | What runs |
| ---- | --------- |
| **pre-commit** | `lint-staged` (eslint + prettier on staged files), then **`bun run check`** (typecheck, lint all, format check, depcruise, tests). |
| **pre-push** | **`bun run check`** again so a commit made with `git commit --no-verify` still cannot push a broken tree without an explicit second bypass. |

Do **not** use `--no-verify` to skip hooks for routine work — it exists only for emergencies (e.g. while repairing a broken hook). Agents should assume hooks are mandatory.

## Architectural rules (summary)

These are enforced by ESLint (`eslint-plugin-boundaries`), dependency-cruiser, and CI:

1. **`src/core/**` is pure** — no `process`, `Bun`, `fetch`, `Date.now`, `Math.random`, or `new Date()`. Use ports; wire real adapters only from `src/app/`.
2. **`src/features/**` never imports `@runtime/*`** — receive `IFsPort`, `IHttpPort`, etc. from `app/wireDefaults.ts` (tests inject fakes).
3. **`src/runtime/**` never imports `@providers/*`** — HTTP/shell/fs ports stay generic; LLM adapters live in `providers/`.
4. **`src/app/**` is the composition root** — the only place that should construct Bun-backed adapters.
5. **`bun run check` must pass** before a change is considered done.

Full detail: [`AGENTS.md`](./AGENTS.md) and (once authored) `docs/ai/contribution-contract.md`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/). [release-please](https://github.com/googleapis/release-please) consumes them on pushes to `main`.

| Prefix | Effect |
| ------ | ------ |
| `feat:` | minor bump, listed under Features |
| `fix:` | patch bump, Bug Fixes |
| `perf:` | patch bump, Performance |
| `refactor:`, `revert:` | listed in release notes |
| `chore:`, `docs:`, `test:`, `ci:`, `build:` | hidden (no user-facing bump) |

Breaking change: `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer.

### release-please (repo settings)

The [`release-please.yml`](./.github/workflows/release-please.yml) job needs a `GITHUB_TOKEN` that can **open and update PRs**. If you see *“Actions is not permitted to create or approve pull requests”*:

1. **Workflow file** — do not set workflow-wide `permissions: contents: read`; it caps the token so job-level `pull-requests: write` never applies (fixed in this repo).
2. **GitHub UI** — **Settings → Actions → General → Workflow permissions** — choose **Read and write** (or grant **Pull requests: Write** / **Contents: Write** for Actions) if the org default is read-only.

## PR checklist

- [ ] `bun run check` passes locally
- [ ] Tests added or updated for changed behavior (TDD: failing test first when feasible)
- [ ] **CLI / config changes:** add or extend **`tests/e2e/`** subprocess tests; use an isolated `HOME` (see `e2e/_helpers/isolatedHomeProject.ts`) so CI does not depend on a developer’s real `~/.config`.
- [ ] ADR or plan update if you intentionally bend an architectural rule
- [ ] Commit message follows Conventional Commits

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
