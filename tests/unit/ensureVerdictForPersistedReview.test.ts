/**
 * @file ensureVerdictForPersistedReview.test.ts
 */

import { ensureVerdictForPersistedReview } from '@core/review/ensureVerdictForPersistedReview.behavior';
import { describe, expect, it } from 'bun:test';

describe('ensureVerdictForPersistedReview', () => {
  it('passes through markdown that already contains VERDICT', () => {
    const md = 'ok\n\nVERDICT: pass\n';
    const r = ensureVerdictForPersistedReview(md, 'openai');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.markdownOut).toBe(md);
      expect(r.verdict).toBe('pass');
    }
  });

  it('appends VERDICT for fake provider when missing', () => {
    const r = ensureVerdictForPersistedReview('echo only', 'fake');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.markdownOut).toContain('VERDICT: pass');
      expect(r.verdict).toBe('pass');
    }
  });

  it('errors for non-fake when verdict missing', () => {
    const r = ensureVerdictForPersistedReview('no verdict', 'openai');
    expect(r.ok).toBe(false);
  });
});
