/**
 * @file sessionLoopAskPrompt.feature.ts
 * @layer features
 * @description Interactive `ask` prompt for tools gated at level `'ask'` (spec Slice 2).
 * Reuses the loop's `readLine` port; emits `ask_initiated` then `approval` events.
 */

import type { TToolName } from '@core/repoTools/RepoToolNames.constants';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import type { ISessionState, TToolApprovalLevel } from '@core/session/SessionState.types';

import type { ISessionLoopDeps } from './sessionLoopDeps.types';
import {
  appendEventAndFold,
  nextEventSeq,
  persistSessionSnapshot,
  sessionEventAtIso,
} from './sessionLoopShared.feature';

/** Outcome of {@link maybePromptForAsk}. */
export interface IAskPromptResult {
  readonly state: ISessionState;
  /** True when the caller should run the gated tool; false on `never` / `deny` / pending-conflict. */
  readonly proceed: boolean;
}

type TAskAnswer =
  /** Allow this turn only; gate stays at `ask` for next time. */
  | 'allow_once'
  /** Allow now and for the rest of the session. */
  | 'session'
  /** Never allow again (persists as `deny`). */
  | 'never'
  /** Deny this turn; gate stays at `ask` for next time. */
  | 'deny_once';

function parseAskAnswer(raw: string | null): TAskAnswer {
  if (raw === null) {
    return 'deny_once';
  }

  const c = raw.trim().toLowerCase();

  if (c === 'a' || c === 'allow') {
    return 'allow_once';
  }

  if (c === 's' || c === 'session') {
    return 'session';
  }

  if (c === 'n' || c === 'never') {
    return 'never';
  }

  return 'deny_once';
}

function persistedDecisionFor(answer: TAskAnswer): TToolApprovalLevel {
  if (answer === 'session') {
    return 'session';
  }

  if (answer === 'never') {
    return 'deny';
  }

  return 'ask';
}

function shouldProceedFor(answer: TAskAnswer): boolean {
  return answer === 'allow_once' || answer === 'session';
}

/**
 * Prompts for permission when a tool is gated at `'ask'`. Refuses to start a new prompt while
 * another approval is already pending. Persists `ask_initiated` then `approval` events so the
 * decision is recoverable from the event log alone.
 * @param deps - Session loop dependencies (uses `log`, `clock`, `readLine`, `writeStderr`).
 * @param state - State at the moment the gated tool tried to run.
 * @param tool - Tool name being requested.
 * @param reason - One-line context for the prompt body (e.g. `read src/foo.ts`).
 * @returns Updated state plus whether the caller should proceed with the tool.
 */
export async function maybePromptForAsk(
  deps: ISessionLoopDeps,
  state: ISessionState,
  tool: TToolName,
  reason: string,
): Promise<IAskPromptResult> {
  const { log, clock, readLine, writeStderr } = deps;

  if (state.pendingApproval !== null) {
    writeStderr(
      `session: another approval is pending (${state.pendingApproval.tool}); answer it first\n`,
    );
    return { state, proceed: false };
  }

  const initEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(state),
    at: sessionEventAtIso(clock),
    kind: 'ask_initiated',
    payload: { tool, reason },
  };
  let next = await appendEventAndFold(log, state, initEv);

  writeStderr(
    `session: tool "${tool}" requires approval (${reason}) [a]llow once / [s]ession / [n]ever / [d]eny once: `,
  );

  const answer = parseAskAnswer(await readLine());
  const decision = persistedDecisionFor(answer);

  const approvalEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(next),
    at: sessionEventAtIso(clock),
    kind: 'approval',
    payload: { tool, decision },
  };
  next = await appendEventAndFold(log, next, approvalEv);
  await persistSessionSnapshot(log, next);

  if (shouldProceedFor(answer)) {
    return { state: next, proceed: true };
  }

  writeStderr(`session: ${tool} denied (${answer})\n`);
  return { state: next, proceed: false };
}
