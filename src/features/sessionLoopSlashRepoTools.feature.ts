/**
 * @file sessionLoopSlashRepoTools.feature.ts
 * @layer features
 * @description Slash handlers that invoke {@link IRepoToolsPort} (`/read`, `/grep`, `/tree`). See `sessionLoopSlashGitShow.feature.ts` for git and `/show`.
 */

import { randomUUID } from 'node:crypto';

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

/**
 * `/read <path>` — append `tool_call` / `tool_result`, print file bytes on stderr.
 * @param deps - Session loop dependencies.
 * @param state - Current reducer state.
 * @param rest - Path argument (trimmed from the slash line).
 * @returns Updated state after logging.
 */
export async function slashReadFile(
  deps: ISessionLoopDeps,
  state: ISessionState,
  rest: string,
): Promise<ISessionState> {
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const rel = rest.trim();

  if (rel.length === 0) {
    writeStderr('session: /read: usage /read <path>\n');
    return state;
  }

  const gate = state.approvals.read_file;
  let active = state;

  if (gate === 'ask') {
    const r = await maybePromptForAsk(deps, active, 'read_file', `read ${rel}`);
    active = r.state;

    if (!r.proceed) {
      return active;
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    writeStderr(`session: /read: read_file not permitted (current level: ${gate})\n`);
    return active;
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(active),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: { tool: 'read_file', args: { path: rel }, tool_call_id: toolCallId },
  };
  let next = await appendEventAndFold(log, active, callEv);

  try {
    const r = await repoTools.readFile(cwd, { path: rel });
    const summary = r.truncated
      ? `truncated (${String(r.content.length)} bytes returned)`
      : `${String(r.total_lines ?? 0)} line(s)`;
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: true, summary },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);
    const lineHint = r.truncated ? ' (truncated)' : '';
    writeStderr(`--- ${rel}${lineHint} ---\n`);
    writeStderr(r.content);
    writeStderr(r.content.endsWith('\n') ? '' : '\n');
    return next;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: false, summary: message },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);
    writeStderr(`session: /read: ${message}\n`);
    return next;
  }
}

/**
 * Parses `/grep <pattern> [glob] ...` with optional trailing `-C<n>` / `-C <n>` / `--context <n>` (glob may contain spaces).
 * @param rest - Text after `/grep`.
 * @returns Pattern, optional glob, and optional context line count.
 */
function parseGrepArgs(rest: string): {
  readonly pattern: string;
  readonly glob: string | undefined;
  readonly context_lines: number | undefined;
} {
  let t = rest.trim();
  let context_lines: number | undefined;
  const ctxTail = /\s+(?:--context|-C)\s*(\d+)\s*$/i.exec(t);

  if (ctxTail?.[1] !== undefined) {
    const n = Number.parseInt(ctxTail[1], 10);

    if (!Number.isNaN(n) && n >= 0) {
      context_lines = n;
    }

    t = t.slice(0, ctxTail.index).trim();
  }

  const parts = t.split(/\s+/).filter((p) => p.length > 0);
  const pattern = parts[0] ?? '';
  const glob = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

  return { pattern, glob, context_lines };
}

/**
 * `/grep <pattern> [glob] [-C<n>|--context <n>]` — bounded regex search under cwd.
 * @param deps - Session loop dependencies.
 * @param state - Current reducer state.
 * @param rest - Pattern, optional glob, optional context suffix.
 * @returns Updated state after logging.
 */
export async function slashGrep(
  deps: ISessionLoopDeps,
  state: ISessionState,
  rest: string,
): Promise<ISessionState> {
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const { pattern, glob, context_lines } = parseGrepArgs(rest);

  if (pattern.length === 0) {
    writeStderr('session: /grep: usage /grep <pattern> [glob] [--context <n>|-C<n>]\n');
    return state;
  }

  const gate = state.approvals.grep;
  let active = state;

  if (gate === 'ask') {
    const r = await maybePromptForAsk(deps, active, 'grep', `grep ${pattern}`);
    active = r.state;

    if (!r.proceed) {
      return active;
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    writeStderr(`session: /grep: grep not permitted (current level: ${gate})\n`);
    return active;
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(active),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: {
      tool: 'grep',
      args: {
        pattern,
        ...(glob !== undefined ? { glob } : {}),
        ...(context_lines !== undefined ? { context_lines } : {}),
      },
      tool_call_id: toolCallId,
    },
  };
  let next = await appendEventAndFold(log, active, callEv);

  try {
    const r = await repoTools.grep(cwd, {
      pattern,
      glob,
      ...(context_lines !== undefined ? { context_lines } : {}),
    });
    const hitCount = r.matches.filter((m) => m.is_context_line !== true).length;
    const parts: string[] = [
      `${String(hitCount)} match(es) in ${String(r.files_scanned)} file(s) scanned`,
    ];

    if (r.truncated_matches) {
      parts.push('(match cap)');
    }

    if (r.truncated_output) {
      parts.push('(output cap)');
    }

    const summary = parts.join(' ');
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: true, summary },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);

    for (const m of r.matches) {
      const sep = m.is_context_line === true ? '-' : ':';
      writeStderr(`${m.path}${sep}${String(m.line)}${sep}${m.text}\n`);
    }

    writeStderr(`${summary}\n`);
    return next;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: false, summary: message },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);
    writeStderr(`session: /grep: ${message}\n`);
    return next;
  }
}

/**
 * `/tree [path]` — bounded directory listing under cwd (optional relative root).
 * @param deps - Session loop dependencies.
 * @param state - Current reducer state.
 * @param rest - Optional subdirectory relative to repo root.
 * @returns Updated state after logging.
 */
export async function slashListTree(
  deps: ISessionLoopDeps,
  state: ISessionState,
  rest: string,
): Promise<ISessionState> {
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const rootArg = rest.trim();
  const gate = state.approvals.list_tree;
  let active = state;

  if (gate === 'ask') {
    const r = await maybePromptForAsk(
      deps,
      active,
      'list_tree',
      `list ${rootArg.length > 0 ? rootArg : '.'}`,
    );
    active = r.state;

    if (!r.proceed) {
      return active;
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    writeStderr(`session: /tree: list_tree not permitted (current level: ${gate})\n`);
    return active;
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(active),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: {
      tool: 'list_tree',
      args: { ...(rootArg.length > 0 ? { root: rootArg } : {}) },
      tool_call_id: toolCallId,
    },
  };
  let next = await appendEventAndFold(log, active, callEv);

  try {
    const r = await repoTools.listTree(cwd, { ...(rootArg.length > 0 ? { root: rootArg } : {}) });
    const parts: string[] = [
      `${String(r.lines.length)} path(s) in ${String(r.dirs_visited)} dir(s)`,
    ];

    if (r.truncated_entries) {
      parts.push('(entry cap)');
    }

    if (r.truncated_output) {
      parts.push('(output cap)');
    }

    const summary = parts.join(' ');
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: true, summary },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);

    for (const line of r.lines) {
      writeStderr(`${line}\n`);
    }

    writeStderr(`${summary}\n`);
    return next;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: false, summary: message },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);
    writeStderr(`session: /tree: ${message}\n`);
    return next;
  }
}
