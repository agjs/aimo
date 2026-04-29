/**
 * @file sessionReducer.behavior.ts
 * @layer core
 * @description Pure `(state, event) => state` fold for session replay (spec §6).
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';
import { REPO_TOOL_NAMES, type TToolName } from '@core/repoTools/RepoToolNames.constants';
import type { TSessionEventEnvelope, TSessionEventKind } from '@core/session/SessionEvents.types';
import type {
  ISessionState,
  TSessionMode,
  TToolApprovalLevel,
} from '@core/session/SessionState.types';

/**
 * Builds default per-tool approvals (Phase 1: deny all until `approval` events).
 * @returns Fresh map with every {@link REPO_TOOL_NAMES} entry set to `deny`.
 */
export function createDefaultToolApprovals(): Record<TToolName, TToolApprovalLevel> {
  const out = {} as Record<TToolName, TToolApprovalLevel>;

  for (const name of REPO_TOOL_NAMES) {
    out[name] = 'deny';
  }

  return out;
}

/**
 * Fresh session state before any events are applied.
 * @param sessionId - Session directory id (UUID).
 * @returns Initial reducer seed (`head === 0`).
 */
export function createInitialSessionState(sessionId: string): ISessionState {
  return {
    sessionId,
    mode: 'idle',
    head: 0,
    labels: {},
    branches: {},
    boundRunId: null,
    history: [],
    approvals: createDefaultToolApprovals(),
    todos: [],
    usageTotal: { prompt_tokens: 0, completion_tokens: 0, calls: 0 },
    pendingApproval: null,
    profileName: null,
    cwd: null,
    cliVersion: null,
  };
}

function assertSeq(state: ISessionState, event: TSessionEventEnvelope): void {
  if (event.seq !== state.head + 1) {
    throw new Error(
      `session reducer: expected seq ${String(state.head + 1)}, got ${String(event.seq)}`,
    );
  }
}

function reduceHeadOnly(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (
    event.kind !== 'tool_call' &&
    event.kind !== 'tool_result' &&
    event.kind !== 'artifact_write'
  ) {
    throw new Error(
      'session reducer invariant: expected tool_call, tool_result, or artifact_write',
    );
  }

  return { ...state, head: nextHead };
}

function reduceSessionStart(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'session_start') {
    throw new Error('session reducer invariant: expected session_start');
  }

  return {
    ...state,
    head: nextHead,
    profileName: event.payload.profile_name,
    cwd: event.payload.cwd,
    cliVersion: event.payload.cli_version,
  };
}

function reduceUserTurn(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'user_turn') {
    throw new Error('session reducer invariant: expected user_turn');
  }

  const nextMsg: IChatMessage = { role: 'user', content: event.payload.text };
  return {
    ...state,
    head: nextHead,
    history: [...state.history, nextMsg],
  };
}

function reduceAssistantTurn(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'assistant_turn') {
    throw new Error('session reducer invariant: expected assistant_turn');
  }

  const nextMsg: IChatMessage = { role: 'assistant', content: event.payload.markdown };
  const u = event.payload.usage;
  const addPrompt = u?.prompt_tokens ?? 0;
  const addCompletion = u?.completion_tokens ?? 0;
  return {
    ...state,
    head: nextHead,
    history: [...state.history, nextMsg],
    usageTotal: {
      prompt_tokens: state.usageTotal.prompt_tokens + addPrompt,
      completion_tokens: state.usageTotal.completion_tokens + addCompletion,
      calls: state.usageTotal.calls + 1,
    },
  };
}

function reduceRunBound(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'run_bound') {
    throw new Error('session reducer invariant: expected run_bound');
  }

  return {
    ...state,
    head: nextHead,
    boundRunId: event.payload.run_id,
  };
}

function reduceApproval(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'approval') {
    throw new Error('session reducer invariant: expected approval');
  }

  return {
    ...state,
    head: nextHead,
    approvals: { ...state.approvals, [event.payload.tool]: event.payload.decision },
    pendingApproval: null,
  };
}

function reduceAskInitiated(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'ask_initiated') {
    throw new Error('session reducer invariant: expected ask_initiated');
  }

  return {
    ...state,
    head: nextHead,
    pendingApproval: { tool: event.payload.tool, reason: event.payload.reason },
  };
}

function reduceStageTransition(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'stage_transition') {
    throw new Error('session reducer invariant: expected stage_transition');
  }

  return {
    ...state,
    head: nextHead,
    mode: event.payload.to,
  };
}

function reduceCancelled(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'cancelled') {
    throw new Error('session reducer invariant: expected cancelled');
  }

  const mode: TSessionMode = 'idle';
  return {
    ...state,
    head: nextHead,
    mode,
    pendingApproval: null,
  };
}

function reduceError(
  state: ISessionState,
  event: TSessionEventEnvelope,
  nextHead: number,
): ISessionState {
  if (event.kind !== 'error') {
    throw new Error('session reducer invariant: expected error');
  }

  return { ...state, head: nextHead };
}

function reduceEventBodySpill(
  _state: ISessionState,
  _event: TSessionEventEnvelope,
  _nextHead: number,
): ISessionState {
  throw new Error('session reducer: event_body_spill must be expanded before replay');
}

const SESSION_EVENT_REDUCERS: Record<
  TSessionEventKind,
  (state: ISessionState, event: TSessionEventEnvelope, nextHead: number) => ISessionState
> = {
  session_start: reduceSessionStart,
  user_turn: reduceUserTurn,
  assistant_turn: reduceAssistantTurn,
  run_bound: reduceRunBound,
  tool_call: reduceHeadOnly,
  tool_result: reduceHeadOnly,
  artifact_write: reduceHeadOnly,
  approval: reduceApproval,
  ask_initiated: reduceAskInitiated,
  stage_transition: reduceStageTransition,
  cancelled: reduceCancelled,
  error: reduceError,
  event_body_spill: reduceEventBodySpill,
};

/**
 * Applies one append-only event to session state.
 * @param state - State after the prior event (or {@link createInitialSessionState}).
 * @param event - Next event; `event.seq` must equal `state.head + 1`.
 * @returns New immutable state.
 * @throws {Error} When `seq` is not strictly the successor of `state.head`, or on invariant / spill misuse.
 */
export function reduceSessionState(
  state: ISessionState,
  event: TSessionEventEnvelope,
): ISessionState {
  assertSeq(state, event);
  const nextHead = event.seq;
  const apply = SESSION_EVENT_REDUCERS[event.kind];

  return apply(state, event, nextHead);
}

/**
 * Folds an ordered event list into session state.
 * @param sessionId - Session id for the seed state.
 * @param events - Strictly increasing `seq` starting at 1, no gaps.
 * @returns Final state.
 */
export function replaySessionEvents(
  sessionId: string,
  events: readonly TSessionEventEnvelope[],
): ISessionState {
  let state = createInitialSessionState(sessionId);

  for (const ev of events) {
    state = reduceSessionState(state, ev);
  }

  return state;
}
