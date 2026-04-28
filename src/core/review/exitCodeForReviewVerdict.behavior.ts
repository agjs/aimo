/**
 * @file exitCodeForReviewVerdict.behavior.ts
 * @layer core
 * @description Map parsed review verdict to process exit codes (see ExitCodes.constants).
 */

import {
  EXIT_REVIEW_CHANGES_REQUESTED,
  EXIT_REVIEW_FAIL,
  EXIT_SUCCESS,
} from '@core/contracts/ExitCodes.constants';

import type { TReviewVerdict } from './ParseReviewVerdict.behavior';

/**
 * Maps a review verdict to the CLI exit code contract.
 * @param verdict - Parsed `VERDICT` token.
 * @returns `EXIT_SUCCESS`, `EXIT_REVIEW_CHANGES_REQUESTED`, or `EXIT_REVIEW_FAIL`.
 */
export function exitCodeForReviewVerdict(
  verdict: TReviewVerdict,
): typeof EXIT_SUCCESS | typeof EXIT_REVIEW_CHANGES_REQUESTED | typeof EXIT_REVIEW_FAIL {
  switch (verdict) {
    case 'pass':
      return EXIT_SUCCESS;
    case 'changes_requested':
      return EXIT_REVIEW_CHANGES_REQUESTED;
    case 'fail':
      return EXIT_REVIEW_FAIL;
  }
}
