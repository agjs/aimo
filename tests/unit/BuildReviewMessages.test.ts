/**
 * @file BuildReviewMessages.test.ts
 */

import { buildReviewMessages } from '@core/review/BuildReviewMessages.behavior';
import { describe, expect, it } from 'bun:test';

describe('buildReviewMessages', () => {
  it('includes plan, diff, and transcript placeholder in user turn', () => {
    const msgs = buildReviewMessages({
      planMarkdown: '# P',
      diffMarkdown: 'diff',
      transcriptMarkdown: '',
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[1]?.role).toBe('user');
    expect(msgs[1]?.content).toContain('# P');
    expect(msgs[1]?.content).toContain('diff');
    expect(msgs[0]?.content).toContain('VERDICT');
  });
});
