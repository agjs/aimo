/**
 * @file ExitCodes.constants.ts
 * @layer core
 * @description Canonical CLI exit codes — every command and e2e test must use these values.
 */

/** Successful completion, including review verdict **pass**. */
export const EXIT_SUCCESS = 0 as const;

/** Operational error (I/O, network, unexpected exception, internal bug). */
export const EXIT_OPERATIONAL_ERROR = 1 as const;

/** Review verdict **changes_requested**. */
export const EXIT_REVIEW_CHANGES_REQUESTED = 2 as const;

/** Review verdict **fail**. */
export const EXIT_REVIEW_FAIL = 3 as const;

/** Budget exceeded (per-run or compare aggregate). */
export const EXIT_BUDGET_EXCEEDED = 4 as const;

/** Invalid or missing configuration / required env. */
export const EXIT_CONFIG_ERROR = 5 as const;

/** Dirty working tree when a clean tree is required (e.g. compare without `--allow-dirty`). */
export const EXIT_DIRTY_WORKTREE = 6 as const;

/** User cancelled via SIGINT (POSIX convention). */
export const EXIT_SIGINT = 130 as const;

/** Union of all known exit codes for typing switch exhaustiveness in the CLI. */
export type TExitCode =
  | typeof EXIT_SUCCESS
  | typeof EXIT_OPERATIONAL_ERROR
  | typeof EXIT_REVIEW_CHANGES_REQUESTED
  | typeof EXIT_REVIEW_FAIL
  | typeof EXIT_BUDGET_EXCEEDED
  | typeof EXIT_CONFIG_ERROR
  | typeof EXIT_DIRTY_WORKTREE
  | typeof EXIT_SIGINT;

/**
 * Human-readable label for logs, tests, and debugging.
 * @param code - Numeric exit code produced by the CLI.
 * @returns Short English description.
 */
export function describeExitCode(code: number): string {
  switch (code) {
    case EXIT_SUCCESS:
      return 'success';
    case EXIT_OPERATIONAL_ERROR:
      return 'operational_error';
    case EXIT_REVIEW_CHANGES_REQUESTED:
      return 'review_changes_requested';
    case EXIT_REVIEW_FAIL:
      return 'review_fail';
    case EXIT_BUDGET_EXCEEDED:
      return 'budget_exceeded';
    case EXIT_CONFIG_ERROR:
      return 'config_error';
    case EXIT_DIRTY_WORKTREE:
      return 'dirty_worktree';
    case EXIT_SIGINT:
      return 'sigint';
    default:
      return 'unknown';
  }
}
