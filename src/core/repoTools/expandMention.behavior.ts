/**
 * @file expandMention.behavior.ts
 * @layer core
 * @description Pure parser for `@`-mentions in free-text session turns (no I/O). See spec §3 D1.
 */

/** Run-scoped artifact a bare or named mention can resolve to. */
export type TRunArtifact = 'plan' | 'diff' | 'review';

/** Discriminated descriptor for one parsed `@`-mention. */
export type TMentionDescriptor =
  /** `@plan` / `@diff` / `@review` — eager, resolves against `state.boundRunId`. */
  | { readonly kind: 'eager_run_artifact'; readonly artifact: TRunArtifact }
  /** `@run:<id>` — eager, resolves against `<id>` after `isSafeRunDirectoryName` check. */
  | {
      readonly kind: 'eager_run_artifact_named';
      readonly artifact: TRunArtifact;
      readonly runId: string;
    }
  /** `@src/foo.ts` — deferred to Phase 6 model tool-calling (lazy by spec D1). */
  | { readonly kind: 'lazy_path'; readonly path: string }
  /** `@src/dir/` — deferred to Phase 6 (lazy by spec D1). */
  | { readonly kind: 'lazy_dir'; readonly path: string }
  /** `@grep:<pat>` — deferred to Phase 6 (lazy by spec D1). */
  | { readonly kind: 'lazy_grep'; readonly pattern: string }
  /** Unrecognized mention shape; preserved verbatim by the orchestrator. */
  | { readonly kind: 'unknown'; readonly raw: string };

/** Verbatim run of non-mention text. */
export interface IMentionTextToken {
  readonly kind: 'text';
  readonly value: string;
}

/** One `@`-mention in tokenization order with its parsed descriptor. */
export interface IMentionMatchToken {
  readonly kind: 'mention';
  /** Original text including the leading `@`. */
  readonly raw: string;
  readonly descriptor: TMentionDescriptor;
}

/** Tokens returned by {@link tokenizeMentions} (text vs mention, in input order). */
export type TMentionToken = IMentionTextToken | IMentionMatchToken;

function isWhitespace(ch: string | undefined): boolean {
  if (ch === undefined) {
    return false;
  }

  return /\s/.test(ch);
}

function startsAtBoundary(line: string, idx: number): boolean {
  if (idx === 0) {
    return true;
  }

  return isWhitespace(line[idx - 1]);
}

/**
 * Splits a free-text line into ordered text/mention tokens. Pure (no I/O).
 * Mentions begin at `@` only when the previous char is whitespace or the line start; they end at
 * the next whitespace. `\@` is a literal `@`. A bare `@` followed by whitespace stays as text.
 * @param line - The raw user-typed line (already trimmed by the caller is fine).
 * @returns Ordered tokens — concatenating their `value`/`raw` reproduces the input minus `\@` escapes (which collapse to `@`).
 */
export function tokenizeMentions(line: string): readonly TMentionToken[] {
  const tokens: TMentionToken[] = [];
  let buf = '';
  let i = 0;

  while (i < line.length) {
    if (line[i] === '\\' && line[i + 1] === '@') {
      buf += '@';
      i += 2;
      continue;
    }

    if (line[i] === '@' && startsAtBoundary(line, i)) {
      let j = i + 1;

      while (j < line.length && !isWhitespace(line[j])) {
        j += 1;
      }

      const raw = line.slice(i, j);

      if (raw.length === 1) {
        buf += raw;
        i = j;
        continue;
      }

      if (buf.length > 0) {
        tokens.push({ kind: 'text', value: buf });
        buf = '';
      }

      tokens.push({ kind: 'mention', raw, descriptor: parseMention(raw) });
      i = j;
      continue;
    }

    buf += line[i] ?? '';
    i += 1;
  }

  if (buf.length > 0) {
    tokens.push({ kind: 'text', value: buf });
  }

  return tokens;
}

function asRunArtifact(body: string): TRunArtifact | null {
  if (body === 'plan' || body === 'diff' || body === 'review') {
    return body;
  }

  return null;
}

/**
 * Classifies a single mention token (e.g. `@plan`, `@run:abc`, `@src/foo.ts`).
 * @param raw - Mention text including the leading `@`.
 * @returns Discriminated descriptor; `unknown` for shapes we don't recognize.
 */
export function parseMention(raw: string): TMentionDescriptor {
  if (!raw.startsWith('@') || raw.length < 2) {
    return { kind: 'unknown', raw };
  }

  const body = raw.slice(1);
  const bare = asRunArtifact(body);

  if (bare !== null) {
    return { kind: 'eager_run_artifact', artifact: bare };
  }

  if (body.startsWith('run:')) {
    const runId = body.slice('run:'.length);

    if (runId.length === 0) {
      return { kind: 'unknown', raw };
    }

    return { kind: 'eager_run_artifact_named', artifact: 'plan', runId };
  }

  if (body.startsWith('grep:')) {
    const pattern = body.slice('grep:'.length);

    if (pattern.length === 0) {
      return { kind: 'unknown', raw };
    }

    return { kind: 'lazy_grep', pattern };
  }

  if (body.endsWith('/')) {
    return { kind: 'lazy_dir', path: body };
  }

  if (body.includes('/') || body.includes('.')) {
    return { kind: 'lazy_path', path: body };
  }

  return { kind: 'unknown', raw };
}
