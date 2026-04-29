/**
 * @file SessionState.types.ts
 * @layer core
 * @description In-memory session state reduced from append-only events (spec §6).
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';
import type { TToolName } from '@core/repoTools/RepoToolNames.constants';

/**
 * High-level session mode (REPL + future plan/review stages).
 */
export type TSessionMode = 'idle' | 'plan' | 'review' | 'free' | 'streaming';

/**
 * User approval level for a tool (maps from `approval` events; D2).
 * `ask` triggers an interactive prompt before the tool runs (Slice 2).
 */
export type TToolApprovalLevel = 'allow' | 'session' | 'never' | 'deny' | 'ask';

/**
 * One persisted todo item (Phase 4 expands slash commands).
 */
export interface ISessionTodoItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

/**
 * Aggregated token usage across the session.
 */
export interface ISessionUsageTotal {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  /** Number of model completion calls completed (not cancelled mid-flight). */
  readonly calls: number;
}

/**
 * Folded view of a session after replaying `events.jsonl`.
 * @see docs/ai/spec-session.md §6
 */
export interface ISessionState {
  readonly sessionId: string;
  readonly mode: TSessionMode;
  /**
   * Last applied event `seq` (0 before any event).
   * Spec `head` — advanced by `/undo` in Phase 4; Phase 1 tracks last seq only.
   */
  readonly head: number;
  readonly labels: Readonly<Record<string, number>>;
  readonly branches: Readonly<Record<string, number>>;
  readonly boundRunId: string | null;
  readonly history: readonly IChatMessage[];
  readonly approvals: Readonly<Record<TToolName, TToolApprovalLevel>>;
  readonly todos: readonly ISessionTodoItem[];
  readonly usageTotal: ISessionUsageTotal;
  readonly pendingApproval: { readonly tool: TToolName; readonly reason: string } | null;
  /** Filled from the first `session_start` event (for `/status`). */
  readonly profileName: string | null;
  /** Filled from the first `session_start` event. */
  readonly cwd: string | null;
  /** Filled from the first `session_start` event. */
  readonly cliVersion: string | null;
}
