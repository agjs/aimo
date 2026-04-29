/**
 * @file AimoSessionPaths.constants.ts
 * @layer core
 * @description Relative paths under the repo root for `.aimo/sessions/<id>/` (no `path` module).
 */

import { AIMO_RELATIVE_DIR } from '@core/runs/AimoRunPaths.constants';

/** Sessions live under `.aimo/sessions/<session_id>/`. */
export const SESSIONS_RELATIVE_DIR = 'sessions' as const;

/** Append-only JSONL event stream (source of truth). */
export const SESSION_EVENTS_JSONL = 'events.jsonl' as const;

/** Derived snapshot rewritten on quiescence. */
export const SESSION_JSON_FILENAME = 'session.json' as const;

/** Large event bodies spill under this directory with `blobs/<hash>.<ext>`. */
export const SESSION_BLOBS_DIR = 'blobs' as const;

/** Advisory lock file for exclusive resume/append. */
export const SESSION_LOCK_FILENAME = '.lock' as const;

/**
 * Relative directory for one session (POSIX slashes).
 * @param sessionId - Opaque session identifier (e.g. UUID).
 * @returns Path like `.aimo/sessions/<sessionId>`.
 */
export function relativeSessionDirectoryPath(sessionId: string): string {
  return `${AIMO_RELATIVE_DIR}/${SESSIONS_RELATIVE_DIR}/${sessionId}`;
}

/**
 * Relative path to `events.jsonl` for a session.
 * @param sessionId - Session identifier.
 * @returns Path like `.aimo/sessions/<sessionId>/events.jsonl`.
 */
export function relativeSessionEventsJsonlPath(sessionId: string): string {
  return `${relativeSessionDirectoryPath(sessionId)}/${SESSION_EVENTS_JSONL}`;
}

/**
 * Relative path to `session.json` for a session.
 * @param sessionId - Session identifier.
 * @returns Path like `.aimo/sessions/<sessionId>/session.json`.
 */
export function relativeSessionJsonPath(sessionId: string): string {
  return `${relativeSessionDirectoryPath(sessionId)}/${SESSION_JSON_FILENAME}`;
}

/**
 * Relative path to the session lock file.
 * @param sessionId - Session identifier.
 * @returns Path like `.aimo/sessions/<sessionId>/.lock`.
 */
export function relativeSessionLockPath(sessionId: string): string {
  return `${relativeSessionDirectoryPath(sessionId)}/${SESSION_LOCK_FILENAME}`;
}

/**
 * Relative path prefix for spilled blobs (`…/blobs/`).
 * @param sessionId - Session identifier.
 * @returns Path like `.aimo/sessions/<sessionId>/blobs/`.
 */
export function relativeSessionBlobsDirPath(sessionId: string): string {
  return `${relativeSessionDirectoryPath(sessionId)}/${SESSION_BLOBS_DIR}`;
}
