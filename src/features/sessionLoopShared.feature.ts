/**
 * @file sessionLoopShared.feature.ts
 * @layer features
 * @description Shared helpers for session loop event append and timing (used by slash + main loop).
 */

import type { IClockPort } from '@core/ports/IClockPort.types';
import type { ISessionEventLogPort } from '@core/ports/ISessionEventLogPort.types';
import { deriveSessionSnapshot } from '@core/session/deriveSessionSnapshot.behavior';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import { reduceSessionState } from '@core/session/sessionReducer.behavior';
import type { ISessionState } from '@core/session/SessionState.types';
import { formatEpochMsToIsoUtc } from '@shared/formatEpochMsToIsoUtc.behavior';

/**
 * @param log - Session log port.
 * @param state - Current folded state.
 * @returns Resolves when the snapshot file is written.
 */
export async function persistSessionSnapshot(
  log: ISessionEventLogPort,
  state: ISessionState,
): Promise<void> {
  const snap = deriveSessionSnapshot(state);
  await log.writeSessionSnapshot(`${JSON.stringify(snap, null, 2)}\n`);
}

/**
 * Appends one event and folds it into state.
 * @param log - Session log port.
 * @param state - State before the event.
 * @param event - Next envelope (`seq` must equal `state.head + 1`).
 * @returns Folded state after the event.
 */
export async function appendEventAndFold(
  log: ISessionEventLogPort,
  state: ISessionState,
  event: TSessionEventEnvelope,
): Promise<ISessionState> {
  await log.appendEvent(event);
  return reduceSessionState(state, event);
}

/**
 * Next strictly monotonic `seq` for an outgoing event.
 * @param state - Current state.
 * @returns `state.head + 1`.
 */
export function nextEventSeq(state: ISessionState): number {
  return state.head + 1;
}

/**
 * ISO-8601 UTC timestamp string from the clock port.
 * @param clock - Wall clock.
 * @returns ISO-8601 UTC string.
 */
export function sessionEventAtIso(clock: IClockPort): string {
  return formatEpochMsToIsoUtc(clock.nowMs());
}

/**
 * Rejects when `signal` aborts (matches chat `Promise.race` branch).
 * @param signal - Turn abort signal.
 * @returns Never fulfills; rejects with `Error('aborted')` on abort.
 */
export function abortWhenSignaled(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }

    signal.addEventListener(
      'abort',
      () => {
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}
