/**
 * @file exitCodeForReviewVerdict.test.ts
 */

import {
  EXIT_REVIEW_CHANGES_REQUESTED,
  EXIT_REVIEW_FAIL,
  EXIT_SUCCESS,
} from '@core/contracts/ExitCodes.constants';
import { exitCodeForReviewVerdict } from '@core/review/exitCodeForReviewVerdict.behavior';
import { describe, expect, it } from 'bun:test';

describe('exitCodeForReviewVerdict', () => {
  it('maps verdicts to exit codes', () => {
    expect(exitCodeForReviewVerdict('pass')).toBe(EXIT_SUCCESS);
    expect(exitCodeForReviewVerdict('changes_requested')).toBe(EXIT_REVIEW_CHANGES_REQUESTED);
    expect(exitCodeForReviewVerdict('fail')).toBe(EXIT_REVIEW_FAIL);
  });
});
