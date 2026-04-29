/**
 * @file deriveSessionSnapshot.behavior.ts
 * @layer core
 * @description Pure JSON snapshot shape for `session.json` (derived; spec §4).
 */

import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import type { ISessionState } from '@core/session/SessionState.types';

/**
 * Serializable snapshot written beside `events.jsonl`.
 * @see docs/ai/spec-session.md §4
 */
export interface ISessionJsonSnapshot {
  readonly schema_version: typeof CURRENT_SCHEMA_VERSION;
  readonly session_id: string;
  readonly mode: ISessionState['mode'];
  readonly head: number;
  readonly bound_run_id: string | null;
  readonly profile_name: string | null;
  readonly cwd: string | null;
  readonly cli_version: string | null;
  readonly usage_total: ISessionState['usageTotal'];
  readonly pending_approval: ISessionState['pendingApproval'];
}

/**
 * Maps folded session state to the on-disk `session.json` object.
 * @param state - Current reducer output.
 * @returns Plain object suitable for `JSON.stringify`.
 */
export function deriveSessionSnapshot(state: ISessionState): ISessionJsonSnapshot {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    session_id: state.sessionId,
    mode: state.mode,
    head: state.head,
    bound_run_id: state.boundRunId,
    profile_name: state.profileName,
    cwd: state.cwd,
    cli_version: state.cliVersion,
    usage_total: state.usageTotal,
    pending_approval: state.pendingApproval,
  };
}
