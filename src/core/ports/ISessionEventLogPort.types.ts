/**
 * @file ISessionEventLogPort.types.ts
 * @layer core
 * @description Port for append-only session `events.jsonl`, snapshot write, and advisory lock.
 */

import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';

/**
 * Result of reading and normalizing persisted events for reducer replay.
 */
export interface ISessionEventReplayResult {
  /** Events in `seq` order with spills expanded (never `event_body_spill` in this list). */
  readonly events: readonly TSessionEventEnvelope[];
  /** Non-fatal parse or integrity notes (e.g. torn trailing line dropped). */
  readonly warnings: readonly string[];
}

/**
 * Append-only session event log plus derived `session.json` and exclusive lock.
 */
export interface ISessionEventLogPort {
  /**
   * Appends one JSONL line (`\\n`-terminated). Applies size cap / blob spill when needed.
   * @param event - Fully formed envelope including `seq` and `at`.
   */
  appendEvent(event: TSessionEventEnvelope): Promise<void>;

  /**
   * Reads `events.jsonl`, drops a torn final line with warning, validates `seq` gaps, expands spills.
   */
  readEventsForReplay(): Promise<ISessionEventReplayResult>;

  /**
   * Writes `session.json` (pretty-printed JSON text).
   * @param jsonText - Serialized snapshot (caller builds JSON string).
   */
  writeSessionSnapshot(jsonText: string): Promise<void>;

  /**
   * Acquires the session `.lock` exclusively (non-blocking); throws if already held.
   */
  acquireLock(): Promise<void>;

  /**
   * Releases the advisory lock and closes the lock fd.
   * @returns Promise that settles when the lock is released.
   */
  releaseLock(): Promise<void>;
}
