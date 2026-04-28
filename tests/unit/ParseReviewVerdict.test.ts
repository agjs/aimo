/**
 * @file ParseReviewVerdict.test.ts
 */

import { parseReviewVerdictFromMarkdown } from '@core/review/ParseReviewVerdict.behavior';
import { describe, expect, it } from 'bun:test';

describe('parseReviewVerdictFromMarkdown', () => {
  it('parses the last non-empty VERDICT line', () => {
    const r = parseReviewVerdictFromMarkdown('ok\n\nVERDICT: changes_requested\n');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.verdict).toBe('changes_requested');
  });

  it('errors when last non-empty line is not a verdict', () => {
    const r = parseReviewVerdictFromMarkdown('no verdict here\n');
    expect(r.ok).toBe(false);
  });
});
