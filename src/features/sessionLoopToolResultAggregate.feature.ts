/**
 * @file sessionLoopToolResultAggregate.feature.ts
 * @layer features
 * @description Optional cheap-model pass on large *tool results* so the main (execution) model sees
 * a condensed view — same cost rationale as `sessionLoopToolArgNormalize.feature.ts` (cheap shapes
 * data; expensive model reasons on a smaller aggregate).
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';
import type { TToolName } from '@core/repoTools/RepoToolNames.constants';

import type { ISessionLoopDeps } from './sessionLoopDeps.types';

const SYS = `You prepare repository tool output for a downstream, more expensive model. Compress and structure: keep file paths, line numbers, error lines, and grep hit lines; drop redundant boilerplate. Output plain text only (no JSON, no markdown fences). If already short, return it almost unchanged.`;

/**
 * When configured, runs a cheap completion to aggregate large tool output before it is appended
 * to the main model’s context.
 * @param deps - Session loop deps; uses optional aggregate worker fields.
 * @param toolName - Tool that produced `body`.
 * @param body - Formatted tool output (read/grep/…).
 * @param toolOk - When false, returns `body` unchanged.
 * @returns String passed as the tool role message to the main LLM.
 */
export async function condenseToolResultForMainLlmIfConfigured(
  deps: Pick<
    ISessionLoopDeps,
    | 'writeStderr'
    | 'toolResultAggregateChat'
    | 'toolResultAggregateModel'
    | 'toolResultAggregateMinTriggerChars'
    | 'toolResultAggregateMaxInputChars'
  >,
  toolName: TToolName,
  body: string,
  toolOk: boolean,
): Promise<string> {
  if (!toolOk) {
    return body;
  }

  const { toolResultAggregateChat, toolResultAggregateModel, writeStderr } = deps;

  if (toolResultAggregateChat === null || toolResultAggregateModel === null) {
    return body;
  }

  if (body.length < deps.toolResultAggregateMinTriggerChars) {
    return body;
  }

  const maxIn = deps.toolResultAggregateMaxInputChars;
  const user = `Tool: ${toolName}\n-----\n${
    maxIn < body.length ? `${body.slice(0, maxIn)}\n[…truncated for aggregate input…]` : body
  }\n-----`;

  const messages: IChatMessage[] = [
    { role: 'system', content: SYS },
    { role: 'user', content: user },
  ];

  try {
    const r = await toolResultAggregateChat.complete({
      model: toolResultAggregateModel,
      messages,
    });
    const t = (r.choices[0]?.message?.content ?? '').trim();

    if (t.length === 0) {
      writeStderr('session: tool result aggregate returned empty; using raw tool output\n');
      return body;
    }

    return `${t}\n[aggregated for main model; original was ${String(body.length)} character(s)]\n`;
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e);
    writeStderr(`session: tool result aggregate failed (${m}); using raw tool output\n`);
    return body;
  }
}
