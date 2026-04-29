/**
 * @file RepoWalkSkipDirs.constants.ts
 * @layer core
 * @description Directory names skipped when walking the repo for `grep`, `list_tree`, and similar tools.
 */

/**
 * Basenames (not paths) omitted from recursive repo walks.
 * Keeps session tools fast and avoids churning through dependencies and VCS metadata.
 */
export const REPO_WALK_SKIP_DIRECTORY_NAMES = new Set<string>([
  '.git',
  'node_modules',
  '.aimo',
  'dist',
  'coverage',
  '.husky',
  '.cursor',
  'vendor',
]);
