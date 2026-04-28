/**
 * @file ExitCodes.test.ts
 * @description Sanity checks for exit code metadata.
 */

import {
  EXIT_BUDGET_EXCEEDED,
  EXIT_CONFIG_ERROR,
  EXIT_DIRTY_WORKTREE,
  EXIT_OPERATIONAL_ERROR,
  EXIT_REVIEW_CHANGES_REQUESTED,
  EXIT_REVIEW_FAIL,
  EXIT_SIGINT,
  EXIT_SUCCESS,
  describeExitCode,
} from '@core/contracts/ExitCodes.constants';
import { describe, expect, it } from 'bun:test';

describe('ExitCodes', () => {
  it('describeExitCode maps known codes', () => {
    expect(describeExitCode(EXIT_SUCCESS)).toBe('success');
    expect(describeExitCode(EXIT_OPERATIONAL_ERROR)).toBe('operational_error');
    expect(describeExitCode(EXIT_REVIEW_CHANGES_REQUESTED)).toBe('review_changes_requested');
    expect(describeExitCode(EXIT_REVIEW_FAIL)).toBe('review_fail');
    expect(describeExitCode(EXIT_BUDGET_EXCEEDED)).toBe('budget_exceeded');
    expect(describeExitCode(EXIT_CONFIG_ERROR)).toBe('config_error');
    expect(describeExitCode(EXIT_DIRTY_WORKTREE)).toBe('dirty_worktree');
    expect(describeExitCode(EXIT_SIGINT)).toBe('sigint');
    expect(describeExitCode(999)).toBe('unknown');
  });
});
