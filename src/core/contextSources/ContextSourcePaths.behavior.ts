/**
 * @file ContextSourcePaths.behavior.ts
 * @layer core
 * @description Map {@link TContextSource} to run-directory basenames (raw + shrunk).
 */

import {
  EXECUTE_STDERR_TXT_BASENAME,
  EXECUTE_STDOUT_TXT_BASENAME,
  GIT_DIFF_AFTER_BASENAME,
} from '@core/runs/AimoRunPaths.constants';

import type { TContextSource } from './ContextSource.constants';

/**
 * UTF-8 text file holding delegated executor stdout (raw, pre-shrink).
 * @param source - Must be `execute.stdout`.
 * @returns Basename under `.aimo/runs/<id>/`.
 */
export function rawBasenameForContextSource(source: TContextSource): string {
  switch (source) {
    case 'execute.stdout':
      return EXECUTE_STDOUT_TXT_BASENAME;
    case 'execute.stderr':
      return EXECUTE_STDERR_TXT_BASENAME;
    case 'execute.git_diff_after':
      return GIT_DIFF_AFTER_BASENAME;
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

/**
 * Worker-produced markdown for this source (trusted path for expensive models).
 * @param source - Context source id.
 * @returns Basename under `.aimo/runs/<id>/`.
 */
export function shrunkBasenameForContextSource(source: TContextSource): string {
  switch (source) {
    case 'execute.stdout':
      return 'execute.stdout.shrunk.md';
    case 'execute.stderr':
      return 'execute.stderr.shrunk.md';
    case 'execute.git_diff_after':
      return 'execute.git_diff_after.shrunk.md';
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}
