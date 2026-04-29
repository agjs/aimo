/**
 * @file sessionLoopAgenticTurn.feature.ts
 * @layer features
 * @description Model tool-calling round for a single user turn: bounded inner completion loop.
 */

import type {
  IChatCompletionRequest,
  IChatCompletionUsage,
  IChatMessage,
  IChatTool,
  IChatToolCall,
} from '@core/chat/ChatCompletion.types';
import { buildRepoToolDescriptorsForModel } from '@core/repoTools/RepoToolSchemas.behavior';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import type { ISessionState } from '@core/session/SessionState.types';

import { dispatchRepoToolCall } from './sessionLoopAgenticToolDispatch.feature';
import type { ISessionLoopDeps } from './sessionLoopDeps.types';
import {
  abortWhenSignaled,
  appendEventAndFold,
  nextEventSeq,
  sessionEventAtIso,
} from './sessionLoopShared.feature';

export { dispatchRepoToolCall } from './sessionLoopAgenticToolDispatch.feature';

/**
 * Safety guard: max `chat.complete` calls for one free-text line. Real reviews can need many
 * back-and-forth tool rounds; this only stops runaway loops. If you hit the limit, send
 * another user message to continue.
 */
export const MAX_TOOL_ITERATIONS = 128;

/**
 * @param e - Caught `chat.complete` error.
 * @returns True when the message looks like an HTTP 400.
 */
function isLikelyHttp400Error(e: unknown): boolean {
  if (e instanceof Error) {
    return e.message.includes('400');
  }

  return String(e).includes('400');
}

async function completeWithToolFallback(
  deps: ISessionLoopDeps,
  request: IChatCompletionRequest,
): Promise<Awaited<ReturnType<typeof deps.executionChat.complete>>> {
  const { executionChat, writeStderr } = deps;
  const hasTools = (request.tools?.length ?? 0) > 0;

  try {
    return await executionChat.complete(request);
  } catch (e: unknown) {
    if (hasTools && isLikelyHttp400Error(e)) {
      writeStderr('session: tools unsupported by model; retrying without tools\n');
      const noTools: IChatCompletionRequest = {
        model: request.model,
        messages: request.messages,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      };
      return await executionChat.complete(noTools);
    }

    throw e;
  }
}

function mergeUsage(
  a: IChatCompletionUsage | undefined,
  b: IChatCompletionUsage | undefined,
): IChatCompletionUsage | undefined {
  if (a === undefined) {
    return b;
  }

  if (b === undefined) {
    return a;
  }

  return {
    prompt_tokens: a.prompt_tokens + b.prompt_tokens,
    completion_tokens: a.completion_tokens + b.completion_tokens,
    total_tokens: a.total_tokens + b.total_tokens,
  };
}

function toolIterationLimitUserText(): string {
  return `Session: hit the per-line tool limit (${String(
    MAX_TOOL_ITERATIONS,
  )} model API round-trips max for one user message). Send a new line to keep going, or use smaller asks. (This guard only blocks infinite tool loops — not a target for normal work.)`;
}

type TAgenticTurnResult = {
  readonly state: ISessionState;
  readonly finalText: string;
  readonly finalUsage: IChatCompletionUsage | undefined;
};

async function returnAfterErrorEvent(
  logClock: Pick<ISessionLoopDeps, 'log' | 'clock'>,
  accState: ISessionState,
  payload: { readonly code: string; readonly message: string },
  finalText: string,
  finalUsage: IChatCompletionUsage | undefined,
): Promise<TAgenticTurnResult> {
  const { log, clock } = logClock;
  const errEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(accState),
    at: sessionEventAtIso(clock),
    kind: 'error',
    payload,
  };
  const next = await appendEventAndFold(log, accState, errEv);
  return { state: next, finalText, finalUsage };
}

function resultToolIterationLimit(
  logClock: Pick<ISessionLoopDeps, 'log' | 'clock'>,
  accState: ISessionState,
  usage: IChatCompletionUsage | undefined,
): Promise<TAgenticTurnResult> {
  const msg = toolIterationLimitUserText();
  return returnAfterErrorEvent(
    logClock,
    accState,
    { code: 'tool_iteration_limit', message: msg },
    msg,
    usage,
  );
}

function resultNoAssistantInChoice(
  logClock: Pick<ISessionLoopDeps, 'log' | 'clock'>,
  accState: ISessionState,
  usage: IChatCompletionUsage | undefined,
): Promise<TAgenticTurnResult> {
  return returnAfterErrorEvent(
    logClock,
    accState,
    { code: 'chat_completion', message: 'no assistant message' },
    '',
    usage,
  );
}

async function runOneCompletion(
  deps: ISessionLoopDeps,
  chatModel: string,
  messages: IChatMessage[],
  toolDescriptors: readonly IChatTool[],
  signal: AbortSignal,
): Promise<Awaited<ReturnType<typeof deps.executionChat.complete>>> {
  const hasTools = toolDescriptors.length > 0;
  const req: IChatCompletionRequest = {
    model: chatModel,
    messages,
    ...(hasTools
      ? {
          tools: [...toolDescriptors],
          tool_choice: 'auto' as const,
        }
      : {}),
  };
  return Promise.race([
    hasTools
      ? completeWithToolFallback(deps, req)
      : deps.executionChat.complete({ model: chatModel, messages }),
    abortWhenSignaled(signal),
  ]);
}

async function applyAssistantToolRound(
  deps: ISessionLoopDeps,
  accState: ISessionState,
  messages: IChatMessage[],
  tCalls: readonly IChatToolCall[],
  content: string,
): Promise<ISessionState> {
  let s = accState;
  messages.push({ role: 'assistant', content, tool_calls: tCalls });
  for (const c of tCalls) {
    const d = await dispatchRepoToolCall(deps, s, c);
    s = d.state;
    messages.push(d.toolMessage);
  }

  return s;
}

/**
 * One user turn: optional function tools + bounded inner completion loop.
 * @param deps - Loop ports.
 * @param state - State after `user_turn` and `stage_transition` to streaming.
 * @param messagesForChat - Transcript to send the provider (ends with the user line).
 * @param signal - Cancellation for each inner `chat.complete` (use `Promise.race` with {@link abortWhenSignaled}).
 * @returns State after the last appended event, final assistant text, merged usage.
 */
export async function runAgenticTurnRound(
  deps: ISessionLoopDeps,
  state: ISessionState,
  messagesForChat: IChatMessage[],
  signal: AbortSignal,
): Promise<TAgenticTurnResult> {
  const { executionModel, log, clock } = deps;
  const logClock = { log, clock } as const;
  const toolDescriptors: readonly IChatTool[] = buildRepoToolDescriptorsForModel(state.approvals);
  let accState = state;
  let usage: IChatCompletionUsage | undefined;
  const messages: IChatMessage[] = [...messagesForChat];
  let nComplete = 0;

  while (true) {
    if (nComplete >= MAX_TOOL_ITERATIONS) {
      return resultToolIterationLimit(logClock, accState, usage);
    }

    const reply = await runOneCompletion(deps, executionModel, messages, toolDescriptors, signal);
    nComplete += 1;
    usage = mergeUsage(usage, reply.usage);
    const message = reply.choices[0]?.message;

    if (message === undefined) {
      return resultNoAssistantInChoice(logClock, accState, usage);
    }

    const tCalls = message.tool_calls;

    if (tCalls === undefined || tCalls.length === 0) {
      return { state: accState, finalText: message.content ?? '', finalUsage: usage };
    }

    accState = await applyAssistantToolRound(
      deps,
      accState,
      messages,
      tCalls,
      message.content ?? '',
    );
    if (nComplete >= MAX_TOOL_ITERATIONS) {
      return resultToolIterationLimit(logClock, accState, usage);
    }
  }
}
