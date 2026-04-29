/**
 * @file SessionEvents.types.ts
 * @layer core
 * @description Discriminated session event envelope + Phase 1 payload shapes (spec §5).
 */

import type { IChatCompletionUsage } from '@core/chat/ChatCompletion.types';
import type { TToolName } from '@core/repoTools/RepoToolNames.constants';
import type { TSessionMode, TToolApprovalLevel } from '@core/session/SessionState.types';

/**
 * Wire envelope shared by every persisted session event line.
 * @template TKind - Event discriminator.
 * @template TPayload - Payload for this `kind`.
 */
export interface IEventEnvelope<TKind extends string, TPayload> {
  readonly schema_version: 1;
  readonly seq: number;
  /** ISO 8601 UTC timestamp for the event. */
  readonly at: string;
  readonly kind: TKind;
  /** Reserved for future hash chain (optional in v1). */
  readonly prev_hash?: string | undefined;
  readonly payload: TPayload;
}

/** Payload for `session_start`. */
export interface ISessionStartPayload {
  readonly cli_version: string;
  readonly cwd: string;
  readonly profile_name: string;
}

/** Payload for `user_turn`. */
export interface IUserTurnPayload {
  readonly text: string;
}

/** Payload for `assistant_turn`. */
export interface IAssistantTurnPayload {
  readonly markdown: string;
  readonly usage?: IChatCompletionUsage | undefined;
}

/** Payload for `tool_call`. */
export interface IToolCallPayload {
  readonly tool: string;
  readonly args: unknown;
  readonly tool_call_id: string;
}

/** Inline or spilled tool result body reference. */
export interface IToolResultBodyRef {
  readonly body_ref: string;
  readonly body_bytes: number;
}

/** Payload for `tool_result`. */
export interface IToolResultPayload {
  readonly tool_call_id: string;
  readonly ok: boolean;
  /** Short summary or error text when not spilled. */
  readonly summary?: string | undefined;
  /** Present when the full body was spilled to `blobs/`. */
  readonly spill?: IToolResultBodyRef | undefined;
}

/** Payload for `approval`. */
export interface IApprovalPayload {
  readonly tool: TToolName;
  readonly decision: TToolApprovalLevel;
}

/**
 * Payload for `ask_initiated` — recorded right before an interactive `ask` prompt opens.
 * The reducer stores `{ tool, reason }` on `state.pendingApproval` until the user's
 * `approval` event clears it. Cancelled prompts also clear via `cancelled`.
 * @see docs/ai/spec-session.md §3 (D2 / Slice 2)
 */
export interface IAskInitiatedPayload {
  readonly tool: TToolName;
  readonly reason: string;
}

/** Payload for `stage_transition`. */
export interface IStageTransitionPayload {
  readonly from: TSessionMode;
  readonly to: TSessionMode;
}

/** Payload for `artifact_write`. */
export interface IArtifactWritePayload {
  readonly run_id: string;
  readonly relative_path: string;
}

/** Payload for `cancelled`. */
export interface ICancelledPayload {
  readonly reason?: string | undefined;
}

/** Payload for `error`. */
export interface IErrorPayload {
  readonly code: string;
  readonly message: string;
}

/**
 * Payload for `run_bound` — session bound to `.aimo/runs/<run_id>/` via `/use` (Phase 1).
 * @see docs/ai/spec-session.md §4 (bound run)
 */
export interface IRunBoundPayload {
  readonly run_id: string;
}

/**
 * Wrapper when a full serialized event exceeds the JSONL line cap; blob holds the original JSON line.
 * @see docs/ai/spec-session.md §5.3
 */
export interface IEventBodySpillPayload {
  readonly body_ref: string;
  readonly body_bytes: number;
}

/** Discriminated union of Phase 1 event kinds + payloads. */
export type TSessionEventEnvelope =
  | IEventEnvelope<'session_start', ISessionStartPayload>
  | IEventEnvelope<'user_turn', IUserTurnPayload>
  | IEventEnvelope<'assistant_turn', IAssistantTurnPayload>
  | IEventEnvelope<'tool_call', IToolCallPayload>
  | IEventEnvelope<'tool_result', IToolResultPayload>
  | IEventEnvelope<'approval', IApprovalPayload>
  | IEventEnvelope<'ask_initiated', IAskInitiatedPayload>
  | IEventEnvelope<'stage_transition', IStageTransitionPayload>
  | IEventEnvelope<'artifact_write', IArtifactWritePayload>
  | IEventEnvelope<'cancelled', ICancelledPayload>
  | IEventEnvelope<'error', IErrorPayload>
  | IEventEnvelope<'run_bound', IRunBoundPayload>
  | IEventEnvelope<'event_body_spill', IEventBodySpillPayload>;

/**
 * Discriminant field for exhaustive switches over {@link TSessionEventEnvelope}.
 */
export type TSessionEventKind = TSessionEventEnvelope['kind'];
