/**
 * @file expandMention.test.ts
 * @description Parser tests for `@`-mentions (pure; no I/O).
 */

import {
  parseMention,
  tokenizeMentions,
  type IMentionMatchToken,
  type IMentionTextToken,
  type TMentionToken,
} from '@core/repoTools/expandMention.behavior';
import { describe, expect, it } from 'bun:test';

function mentionsOnly(tokens: readonly TMentionToken[]): readonly IMentionMatchToken[] {
  return tokens.filter((t): t is IMentionMatchToken => t.kind === 'mention');
}

function textsOnly(tokens: readonly TMentionToken[]): readonly IMentionTextToken[] {
  return tokens.filter((t): t is IMentionTextToken => t.kind === 'text');
}

describe('tokenizeMentions', () => {
  it('returns a single text token for a line with no mentions', () => {
    const tokens = tokenizeMentions('hello world');
    expect(tokens.length).toBe(1);
    expect(textsOnly(tokens).map((t) => t.value)).toEqual(['hello world']);
  });

  it('extracts a bare @plan at line start', () => {
    const tokens = tokenizeMentions('@plan summarize');
    const mentions = mentionsOnly(tokens);
    expect(mentions.length).toBe(1);
    expect(mentions[0]?.raw).toBe('@plan');
    expect(mentions[0]?.descriptor).toEqual({ kind: 'eager_run_artifact', artifact: 'plan' });
  });

  it('extracts a mid-line @diff after whitespace', () => {
    const tokens = tokenizeMentions('look at @diff please');
    const mentions = mentionsOnly(tokens);
    expect(mentions.length).toBe(1);
    expect(mentions[0]?.raw).toBe('@diff');
  });

  it('does NOT treat @ inside a word as a mention boundary', () => {
    const tokens = tokenizeMentions('user@example.com');
    expect(mentionsOnly(tokens).length).toBe(0);
  });

  it('honors \\@ as a literal @', () => {
    const tokens = tokenizeMentions('use the \\@plan literal');
    expect(mentionsOnly(tokens).length).toBe(0);
    expect(
      textsOnly(tokens)
        .map((t) => t.value)
        .join(''),
    ).toBe('use the @plan literal');
  });

  it('treats a bare @ followed by whitespace as text', () => {
    const tokens = tokenizeMentions('a @ b');
    expect(mentionsOnly(tokens).length).toBe(0);
  });

  it('extracts multiple mentions in order', () => {
    const tokens = tokenizeMentions('@plan and then @diff and @review');
    const mentions = mentionsOnly(tokens);
    expect(mentions.map((m) => m.raw)).toEqual(['@plan', '@diff', '@review']);
  });

  it('parses @run:<id> as eager named with the id', () => {
    const tokens = tokenizeMentions('@run:abc123 explain');
    const mentions = mentionsOnly(tokens);
    expect(mentions[0]?.descriptor).toEqual({
      kind: 'eager_run_artifact_named',
      artifact: 'plan',
      runId: 'abc123',
    });
  });

  it('parses @src/foo.ts as a lazy path', () => {
    const tokens = tokenizeMentions('@src/foo.ts what does this do');
    const mentions = mentionsOnly(tokens);
    expect(mentions[0]?.descriptor).toEqual({ kind: 'lazy_path', path: 'src/foo.ts' });
  });

  it('parses @src/dir/ as a lazy dir', () => {
    const tokens = tokenizeMentions('@src/dir/ summarize');
    const mentions = mentionsOnly(tokens);
    expect(mentions[0]?.descriptor).toEqual({ kind: 'lazy_dir', path: 'src/dir/' });
  });

  it('parses @grep:<pat> as a lazy grep', () => {
    const tokens = tokenizeMentions('@grep:TODO list them');
    const mentions = mentionsOnly(tokens);
    expect(mentions[0]?.descriptor).toEqual({ kind: 'lazy_grep', pattern: 'TODO' });
  });

  it('returns unknown for empty body after @run: or @grep:', () => {
    const tokens = tokenizeMentions('@run: stuff');
    const mentions = mentionsOnly(tokens);
    expect(mentions[0]?.descriptor.kind).toBe('unknown');
  });
});

describe('parseMention', () => {
  it('handles bare keywords', () => {
    expect(parseMention('@plan')).toEqual({ kind: 'eager_run_artifact', artifact: 'plan' });
    expect(parseMention('@diff')).toEqual({ kind: 'eager_run_artifact', artifact: 'diff' });
    expect(parseMention('@review')).toEqual({ kind: 'eager_run_artifact', artifact: 'review' });
  });

  it('returns unknown for an unrecognized bare token', () => {
    expect(parseMention('@nope').kind).toBe('unknown');
  });

  it('treats names with dots/slashes as paths even without an extension', () => {
    expect(parseMention('@src/lib/util').kind).toBe('lazy_path');
    expect(parseMention('@README.md').kind).toBe('lazy_path');
  });

  it('returns unknown for an empty or `@`-only string', () => {
    expect(parseMention('@').kind).toBe('unknown');
    expect(parseMention('').kind).toBe('unknown');
  });
});
