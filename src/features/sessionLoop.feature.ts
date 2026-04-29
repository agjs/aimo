/**
 * @file sessionLoop.feature.ts
 * @layer features
 * @description Readline-driven session loop: event replay, slash dispatch, optional chat completion.
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import { replaySessionEvents } from '@core/session/sessionReducer.behavior';
import type { ISessionState } from '@core/session/SessionState.types';

import { runAgenticTurnRound } from './sessionLoopAgenticTurn.feature';
import type { ISessionLoopDeps } from './sessionLoopDeps.types';
import { expandMentionsForFreeTextTurn } from './sessionLoopMentions.feature';
import {
  appendEventAndFold,
  nextEventSeq,
  persistSessionSnapshot,
  sessionEventAtIso,
} from './sessionLoopShared.feature';
import {
  dispatchSlashLine,
  emitColdStartYamlApprovals,
  parseSlashParts,
} from './sessionLoopSlash.feature';
import type { SessionTurnAbort } from './sessionTurnAbort.feature';

export type { ISessionLoopDeps } from './sessionLoopDeps.types';
export { SessionTurnAbort } from './sessionTurnAbort.feature';

async function runFreeTextTurn(
  deps: ISessionLoopDeps,
  state: ISessionState,
  trimmed: string,
  signal: AbortSignal,
): Promise<ISessionState> {
  const { log, clock, writeStderr } = deps;

  const userEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(state),
    at: sessionEventAtIso(clock),
    kind: 'user_turn',
    payload: { text: trimmed },
  };
  let next = await appendEventAndFold(log, state, userEv);

  const expanded = await expandMentionsForFreeTextTurn(deps, next, trimmed);
  next = expanded.state;

  const toStream: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(next),
    at: sessionEventAtIso(clock),
    kind: 'stage_transition',
    payload: { from: next.mode, to: 'streaming' },
  };
  next = await appendEventAndFold(log, next, toStream);

  const messagesForChat: IChatMessage[] =
    expanded.augmentedText === trimmed
      ? [...next.history]
      : [...next.history.slice(0, -1), { role: 'user', content: expanded.augmentedText }];

  try {
    const {
      state: afterAgentic,
      finalText,
      finalUsage,
    } = await runAgenticTurnRound(deps, next, messagesForChat, signal);
    next = afterAgentic;
    const text = finalText;
    const usage = finalUsage;

    const assistantEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'assistant_turn',
      payload: { markdown: text, ...(usage !== undefined ? { usage } : {}) },
    };
    next = await appendEventAndFold(log, next, assistantEv);

    const toIdle: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'stage_transition',
      payload: { from: 'streaming', to: 'idle' },
    };
    next = await appendEventAndFold(log, next, toIdle);
    await persistSessionSnapshot(log, next);
    writeStderr(`${text}\n`);
    return next;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'aborted') {
      const cancelEv: TSessionEventEnvelope = {
        schema_version: 1,
        seq: nextEventSeq(next),
        at: sessionEventAtIso(clock),
        kind: 'cancelled',
        payload: { reason: 'abort' },
      };
      next = await appendEventAndFold(log, next, cancelEv);
      await persistSessionSnapshot(log, next);
      writeStderr('session: cancelled\n');
      return next;
    }

    const errEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'error',
      payload: { code: 'chat_completion', message },
    };
    next = await appendEventAndFold(log, next, errEv);
    const toIdle: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'stage_transition',
      payload: { from: 'streaming', to: 'idle' },
    };
    next = await appendEventAndFold(log, next, toIdle);
    await persistSessionSnapshot(log, next);
    writeStderr(`session: error: ${message}\n`);
    return next;
  }
}

async function ensureSessionStarted(
  deps: ISessionLoopDeps,
  state: ISessionState,
): Promise<ISessionState> {
  if (state.head !== 0) {
    return state;
  }

  const { cwd, profileName, cliVersion, log, clock } = deps;
  const ev: TSessionEventEnvelope = {
    schema_version: 1,
    seq: 1,
    at: sessionEventAtIso(clock),
    kind: 'session_start',
    payload: { cli_version: cliVersion, cwd, profile_name: profileName },
  };
  const next = await appendEventAndFold(log, state, ev);
  await persistSessionSnapshot(log, next);
  return next;
}

/**
 * Runs the interactive session until `/exit` or stdin EOF.
 * @param deps - Ports and callbacks (no direct `fs` / `Bun` here).
 * @param turnAbort - Shared with the REPL for `/cancel` + SIGINT.
 */
export async function runSessionLoop(
  deps: ISessionLoopDeps,
  turnAbort: SessionTurnAbort,
): Promise<void> {
  const { log, writeStderr, readLine } = deps;
  const replayed = await log.readEventsForReplay();

  for (const w of replayed.warnings) {
    writeStderr(`${w}\n`);
  }

  let state = replaySessionEvents(deps.sessionId, replayed.events);
  const coldStart = replayed.events.length === 0;
  state = await ensureSessionStarted(deps, state);

  if (coldStart) {
    state = await emitColdStartYamlApprovals(deps.log, deps.clock, state, deps.mergedSessionTools);
  }

  while (true) {
    const line = await readLine();

    if (line === null) {
      break;
    }

    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const signal = turnAbort.reset();

    if (trimmed.startsWith('/')) {
      const { cmd, rest } = parseSlashParts(trimmed);
      const slashResult = await dispatchSlashLine(deps, turnAbort, state, cmd, rest);

      if (slashResult.kind === 'exit') {
        break;
      }

      state = slashResult.state;
      continue;
    }

    if (state.mode === 'streaming') {
      writeStderr('session: command ignored while streaming (use /cancel first)\n');
      continue;
    }

    state = await runFreeTextTurn(deps, state, trimmed, signal);
  }
}
