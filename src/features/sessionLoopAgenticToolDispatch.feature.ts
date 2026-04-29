/**
 * @file sessionLoopAgenticToolDispatch.feature.ts
 * @layer features
 * @description One model-issued repo tool: approvals, `IRepoToolsPort`, and `tool_call` / `tool_result` events.
 */

import { randomUUID } from 'node:crypto';

import type { IChatMessage, IChatToolCall } from '@core/chat/ChatCompletion.types';
import type {
  IGitDiffParams,
  IGitStatusParams,
  IGrepParams,
  IGrepResult,
  IListTreeParams,
  IListTreeResult,
  IReadFileParams,
  IShowArtifactParams,
} from '@core/ports/IRepoToolsPort.types';
import type { TToolName } from '@core/repoTools/RepoToolNames.constants';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import type { ISessionState } from '@core/session/SessionState.types';

import { maybePromptForAsk } from './sessionLoopAskPrompt.feature';
import type { ISessionLoopDeps } from './sessionLoopDeps.types';
import {
  appendEventAndFold,
  nextEventSeq,
  persistSessionSnapshot,
  sessionEventAtIso,
} from './sessionLoopShared.feature';
import { normalizeToolCallArgumentsWithWorker } from './sessionLoopToolArgNormalize.feature';
import { condenseToolResultForMainLlmIfConfigured } from './sessionLoopToolResultAggregate.feature';

const DISPATCHABLE: ReadonlySet<TToolName> = new Set([
  'read_file',
  'grep',
  'list_tree',
  'git_status',
  'git_diff',
  'show_artifact',
]);

function isDispatchableRepoToolName(name: string): name is TToolName {
  return DISPATCHABLE.has(name as TToolName);
}

function formatReadLikeForModel(
  content: string,
  truncated: boolean,
  totalLines: number | null,
): string {
  let out = content;

  if (truncated) {
    out += totalLines === null ? '\n[read truncated: unknown line count]' : '\n[read truncated]';
  } else if (totalLines !== null) {
    out += `\n[${String(totalLines)} line(s)]`;
  }

  return out;
}

function formatGrepForModel(r: IGrepResult): string {
  const lines: string[] = [];

  for (const m of r.matches) {
    const sep = m.is_context_line === true ? '-' : ':';
    lines.push(`${m.path}${sep}${String(m.line)}${sep}${m.text}`);
  }

  const hitCount = r.matches.filter((m) => m.is_context_line !== true).length;
  const note = [
    `${String(hitCount)} match(es) in ${String(r.files_scanned)} file(s)`,
    r.truncated_matches ? '(match cap)' : '',
    r.truncated_output ? '(output cap)' : '',
  ]
    .filter((s) => s.length > 0)
    .join(' ');

  if (lines.length > 0) {
    return `${lines.join('\n')}\n${note}\n`;
  }

  return `${note}\n`;
}

function formatListTreeForModel(r: IListTreeResult): string {
  const head = r.lines.join('\n');
  const extra = [r.truncated_entries ? '(entry cap)' : '', r.truncated_output ? '(output cap)' : '']
    .filter((s) => s.length > 0)
    .join(' ');

  return extra.length > 0 ? `${head}\n${extra}\n` : `${head}\n`;
}

function formatGitForModel(
  r: { readonly output: string; readonly exit_code: number; readonly truncated: boolean },
  label: string,
): string {
  if (r.exit_code !== 0) {
    return `error: ${label} failed (exit ${String(r.exit_code)})\n${r.output}`;
  }

  return r.truncated ? `${r.output}\n[output truncated]\n` : r.output;
}

type TParse = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

function tryParseJsonArgs(raw: string): TParse {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * One model-issued `function` call: approval gate, `tool_call` / `tool_result` events, tool reply string.
 * @param deps - Session loop ports and cwd.
 * @param state - State before this tool response.
 * @param call - Item from the assistant’s `tool_calls` array.
 * @returns New state and the `role: "tool"` message for the next completion.
 */
// eslint-disable-next-line complexity -- exhaustive switch on dispatchable `TToolName` tools
export async function dispatchRepoToolCall(
  deps: ISessionLoopDeps,
  state: ISessionState,
  call: IChatToolCall,
): Promise<{ readonly state: ISessionState; readonly toolMessage: IChatMessage }> {
  const { log, clock, repoTools, cwd, writeStderr, existsRunDir } = deps;
  const name = call.function.name;
  const toolCallId = call.id.length > 0 ? call.id : randomUUID();

  async function appendPair(
    from: ISessionState,
    tool: string,
    args: unknown,
    ok: boolean,
    content: string,
    summary: string,
  ): Promise<{ readonly state: ISessionState; readonly toolMessage: IChatMessage }> {
    const callEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(from),
      at: sessionEventAtIso(clock),
      kind: 'tool_call',
      payload: { tool, args, tool_call_id: toolCallId },
    };
    let nextS = await appendEventAndFold(log, from, callEv);
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(nextS),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok, summary },
    };
    nextS = await appendEventAndFold(log, nextS, resEv);
    await persistSessionSnapshot(log, nextS);

    if (!ok) {
      writeStderr(`session: tool ${content}\n`);
    }

    return {
      state: nextS,
      toolMessage: {
        role: 'tool',
        content,
        tool_call_id: toolCallId,
        name: tool,
      },
    };
  }

  if (!isDispatchableRepoToolName(name)) {
    return appendPair(
      state,
      name,
      { _error: 'unknown', name },
      false,
      `error: unknown or unsupported tool "${name}"`,
      'unknown tool',
    );
  }

  const tool: TToolName = name;
  let parsed: TParse;

  if (deps.toolParseChat !== null && deps.toolParseModel !== null) {
    const n = await normalizeToolCallArgumentsWithWorker(
      deps.toolParseChat,
      deps.toolParseModel,
      tool,
      call.function.arguments,
      deps.writeStderr,
    );
    parsed = n !== null ? { ok: true, value: n } : tryParseJsonArgs(call.function.arguments);
  } else {
    parsed = tryParseJsonArgs(call.function.arguments);
  }

  if (!parsed.ok) {
    return appendPair(
      state,
      tool,
      { _error: 'invalid_json', input: call.function.arguments },
      false,
      'error: invalid JSON args',
      'invalid JSON args',
    );
  }

  if (typeof parsed.value !== 'object' || parsed.value === null) {
    return appendPair(
      state,
      tool,
      { _error: 'not_object' },
      false,
      'error: tool arguments must be a JSON object',
      'invalid args',
    );
  }

  const o = parsed.value as Record<string, unknown>;
  let working = state;
  const gate = working.approvals[tool];

  if (gate === 'deny' || gate === 'never') {
    return appendPair(working, tool, o, false, 'error: denied by config', 'denied by config');
  }

  if (gate === 'ask') {
    const rAsk = await maybePromptForAsk(deps, working, tool, `model ${name}`);
    working = rAsk.state;
    if (!rAsk.proceed) {
      return appendPair(working, tool, o, false, 'error: denied by user', 'denied by user');
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    return appendPair(working, tool, o, false, 'error: denied by config', 'denied by config');
  }

  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(working),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: { tool, args: o, tool_call_id: toolCallId },
  };
  const nextS = await appendEventAndFold(log, working, callEv);

  async function appendPostCall(
    afterCall: ISessionState,
    ok: boolean,
    body: string,
    summary: string,
  ): Promise<{ readonly state: ISessionState; readonly toolMessage: IChatMessage }> {
    const toMainLlm = await condenseToolResultForMainLlmIfConfigured(deps, tool, body, ok);
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(afterCall),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok, summary },
    };
    const s = await appendEventAndFold(log, afterCall, resEv);
    await persistSessionSnapshot(log, s);

    if (!ok) {
      writeStderr(`session: tool ${body}\n`);
    }

    return {
      state: s,
      toolMessage: {
        role: 'tool',
        content: toMainLlm,
        tool_call_id: toolCallId,
        name: tool,
      },
    };
  }

  try {
    if (tool === 'read_file') {
      const path = typeof o.path === 'string' ? o.path : '';

      if (path.length === 0) {
        return appendPostCall(nextS, false, 'error: path required', 'missing path');
      }

      const params: IReadFileParams = {
        path,
        ...(typeof o.max_bytes === 'number' && o.max_bytes > 0 ? { max_bytes: o.max_bytes } : {}),
      };
      const r = await repoTools.readFile(cwd, params);
      const body = formatReadLikeForModel(r.content, r.truncated, r.total_lines);
      const summary = r.truncated
        ? `truncated (${String(r.content.length)} bytes returned)`
        : `${String(r.total_lines ?? 0)} line(s)`;
      return appendPostCall(nextS, true, body, summary);
    }

    if (tool === 'grep') {
      const pattern = typeof o.pattern === 'string' ? o.pattern : '';

      if (pattern.length === 0) {
        return appendPostCall(nextS, false, 'error: pattern required', 'missing pattern');
      }

      const params: IGrepParams = {
        pattern: pattern.trim(),
        ...(typeof o.glob === 'string' ? { glob: o.glob } : {}),
        ...(typeof o.max_matches === 'number' ? { max_matches: o.max_matches } : {}),
        ...(typeof o.max_files_scanned === 'number'
          ? { max_files_scanned: o.max_files_scanned }
          : {}),
        ...(typeof o.max_output_bytes === 'number' ? { max_output_bytes: o.max_output_bytes } : {}),
        ...(typeof o.context_lines === 'number' ? { context_lines: o.context_lines } : {}),
      };
      const r = await repoTools.grep(cwd, params);
      const body = formatGrepForModel(r);
      const hitCount = r.matches.filter((m) => m.is_context_line !== true).length;
      const summary = [
        String(hitCount),
        r.truncated_matches || r.truncated_output ? 'truncated' : '',
      ]
        .join(' ')
        .trim();
      return appendPostCall(nextS, true, body, summary || '0 matches');
    }

    if (tool === 'list_tree') {
      const params: IListTreeParams = {
        ...(typeof o.root === 'string' ? { root: o.root } : {}),
        ...(typeof o.max_depth === 'number' ? { max_depth: o.max_depth } : {}),
        ...(typeof o.max_entries === 'number' ? { max_entries: o.max_entries } : {}),
        ...(typeof o.max_output_bytes === 'number' ? { max_output_bytes: o.max_output_bytes } : {}),
      };
      const r = await repoTools.listTree(cwd, params);
      return appendPostCall(
        nextS,
        true,
        formatListTreeForModel(r),
        `${String(r.lines.length)} path(s)`,
      );
    }

    if (tool === 'git_status') {
      const params: IGitStatusParams = {
        ...(typeof o.max_output_bytes === 'number' ? { max_output_bytes: o.max_output_bytes } : {}),
      };
      const r = await repoTools.gitStatus(cwd, params);
      return appendPostCall(
        nextS,
        r.exit_code === 0,
        formatGitForModel(r, 'git status'),
        r.exit_code === 0 ? 'ok' : `exit ${String(r.exit_code)}`,
      );
    }

    if (tool === 'git_diff') {
      const params: IGitDiffParams = {
        ...(typeof o.staged === 'boolean' ? { staged: o.staged } : {}),
        ...(typeof o.max_output_bytes === 'number' ? { max_output_bytes: o.max_output_bytes } : {}),
      };
      const r = await repoTools.gitDiff(cwd, params);
      return appendPostCall(
        nextS,
        r.exit_code === 0,
        formatGitForModel(r, 'git diff'),
        r.exit_code === 0 ? 'ok' : `exit ${String(r.exit_code)}`,
      );
    }

    if (tool === 'show_artifact') {
      const runId = typeof o.run_id === 'string' ? o.run_id : '';
      const p = typeof o.path === 'string' ? o.path : '';

      if (runId.length === 0 || p.length === 0) {
        return appendPostCall(
          nextS,
          false,
          'error: run_id and path required',
          'missing run_id or path',
        );
      }

      if (!(await existsRunDir(runId))) {
        return appendPostCall(
          nextS,
          false,
          `error: run directory not found for id "${runId}"`,
          'no run dir',
        );
      }

      const params: IShowArtifactParams = {
        run_id: runId,
        path: p,
        ...(typeof o.max_bytes === 'number' && o.max_bytes > 0 ? { max_bytes: o.max_bytes } : {}),
      };
      const r = await repoTools.showArtifact(cwd, params);
      const body = formatReadLikeForModel(r.content, r.truncated, r.total_lines);
      const summary = r.truncated
        ? `truncated (${String(r.content.length)} bytes returned)`
        : `${String(r.total_lines ?? 0)} line(s)`;
      return appendPostCall(nextS, true, body, summary);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return appendPostCall(nextS, false, `error: ${message}`, message);
  }

  return appendPostCall(nextS, false, 'error: internal dispatch gap', 'unreachable');
}
