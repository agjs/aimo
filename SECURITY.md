# Security Policy

## Reporting a vulnerability

**Please do not file public issues for security vulnerabilities.**

Use GitHub private vulnerability reporting:

1. Open the **Security** tab of this repository.
2. Choose **Report a vulnerability**.
3. Include reproduction steps and impact.

This is a CLI tool, not a hosted service — response times are best-effort.

## Scope

**In scope**

- Code in this repository (`src/`, `tests/`, configs, workflows)
- Default configs or docs that could mislead users into unsafe setups (API keys in prompts, unsafe executor templates, etc.)

**Out of scope (report upstream)**

- [Bun](https://github.com/oven-sh/bun), TypeScript, ESLint, Commander, Zod, and other dependencies
- Third-party coding agents spawned as delegated executors (`aider`, `claude`, `codex`, …) once launched — they are **trusted** with respect to the user’s repo; we document that boundary in `AGENTS.md`
- Issues that require prior compromise of the developer machine
- Social engineering

## Supply-chain hygiene

This repo aims to ship with:

- Pinned dependency versions in `package.json`
- CodeQL (`security-and-quality`) on default branch and PRs
- OpenSSF Scorecard workflow (SARIF to the Security tab)
- Dependabot weekly updates

Forks that remove these controls inherit the risk.

## Disclosure

When a vulnerability is confirmed and fixed, the fix should land with a conventional commit that release-please can pick up (`fix!:` / `feat!:` as appropriate) and a short **Security** section in the release notes.

Thank you for helping keep `aimo` safe to run in real repositories.
