/**
 * @file sessionLoopSlashGitShow.feature.ts
 * @layer features
 * @description Slash handlers for git output and run-bound artifacts (`/git-status`, `/git-diff`, `/show`).
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
 * `/git-status` — `git status --short -b` under cwd (does not replace session `/status`).
 * @param deps - Session loop dependencies.
 * @param state - Current reducer state.
 * @param _rest - Reserved for future flags (ignored).
 * @returns Updated state after logging.
 */
export async function slashGitStatus(
  deps: ISessionLoopDeps,
  state: ISessionState,
  _rest: string,
): Promise<ISessionState> {
  void _rest;
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const gate = state.approvals.git_status;
  let active = state;

  if (gate === 'ask') {
    const r = await maybePromptForAsk(deps, active, 'git_status', 'git status');
    active = r.state;

    if (!r.proceed) {
      return active;
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    writeStderr(`session: /git-status: git_status not permitted (current level: ${gate})\n`);
    return active;
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(active),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: { tool: 'git_status', args: {}, tool_call_id: toolCallId },
  };
  let next = await appendEventAndFold(log, active, callEv);

  try {
    const r = await repoTools.gitStatus(cwd, {});
    const lines = r.output.length === 0 ? 0 : r.output.split('\n').length;
    const parts: string[] = [`exit ${String(r.exit_code)}, ${String(lines)} line(s)`];

    if (r.truncated) {
      parts.push('(output cap)');
    }

    const summary = parts.join(' ');
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: r.exit_code === 0, summary },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);
    writeStderr('--- git status --short -b ---\n');
    writeStderr(r.output);
    writeStderr(r.output.endsWith('\n') ? '' : '\n');
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
    writeStderr(`session: /git-status: ${message}\n`);
    return next;
  }
}

/**
 * Parses optional `staged` token after `/git-diff`.
 * @param rest - Text after `/git-diff`.
 * @returns Whether `staged` was requested and whether the remainder is valid.
 */
function parseGitDiffArgs(rest: string): { readonly staged: boolean; readonly ok: boolean } {
  const t = rest.trim().toLowerCase();

  if (t.length === 0) {
    return { staged: false, ok: true };
  }

  if (t === 'staged') {
    return { staged: true, ok: true };
  }

  return { staged: false, ok: false };
}

/**
 * `/git-diff [staged]` — bounded `git diff HEAD` or `git diff --cached` under cwd.
 * @param deps - Session loop dependencies.
 * @param state - Current reducer state.
 * @param rest - Optional word `staged` for index vs `HEAD` diff.
 * @returns Updated state after logging.
 */
export async function slashGitDiff(
  deps: ISessionLoopDeps,
  state: ISessionState,
  rest: string,
): Promise<ISessionState> {
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const parsed = parseGitDiffArgs(rest);

  if (!parsed.ok) {
    writeStderr('session: /git-diff: usage /git-diff [staged]\n');
    return state;
  }

  const gate = state.approvals.git_diff;
  let active = state;

  if (gate === 'ask') {
    const r = await maybePromptForAsk(
      deps,
      active,
      'git_diff',
      parsed.staged ? 'git diff --cached' : 'git diff HEAD',
    );
    active = r.state;

    if (!r.proceed) {
      return active;
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    writeStderr(`session: /git-diff: git_diff not permitted (current level: ${gate})\n`);
    return active;
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(active),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: {
      tool: 'git_diff',
      args: { ...(parsed.staged ? { staged: true } : {}) },
      tool_call_id: toolCallId,
    },
  };
  let next = await appendEventAndFold(log, active, callEv);

  try {
    const r = await repoTools.gitDiff(cwd, { ...(parsed.staged ? { staged: true } : {}) });
    const lines = r.output.length === 0 ? 0 : r.output.split('\n').length;
    const parts: string[] = [`exit ${String(r.exit_code)}, ${String(lines)} line(s)`];

    if (r.truncated) {
      parts.push('(output cap)');
    }

    const summary = parts.join(' ');
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok: r.exit_code === 0, summary },
    };
    next = await appendEventAndFold(log, next, resEv);
    await persistSessionSnapshot(log, next);
    const label = parsed.staged ? 'git diff --cached' : 'git diff HEAD';
    writeStderr(`--- ${label} ---\n`);
    writeStderr(r.output);
    writeStderr(r.output.endsWith('\n') ? '' : '\n');
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
    writeStderr(`session: /git-diff: ${message}\n`);
    return next;
  }
}

/**
 * `/show <path>` — read a file under the bound run's `.aimo/runs/<id>/` (requires `/use` first).
 * @param deps - Session loop dependencies.
 * @param state - Current reducer state.
 * @param rest - Path relative to the run directory.
 * @returns Updated state after logging.
 */
export async function slashShowArtifact(
  deps: ISessionLoopDeps,
  state: ISessionState,
  rest: string,
): Promise<ISessionState> {
  const { log, clock, repoTools, cwd, writeStderr, existsRunDir } = deps;
  const rel = rest.trim();

  if (rel.length === 0) {
    writeStderr('session: /show: usage /show <path>\n');
    return state;
  }

  const runId = state.boundRunId;

  if (runId === null) {
    writeStderr('session: /show: bind a run first with /use <runId>\n');
    return state;
  }

  if (!(await existsRunDir(runId))) {
    writeStderr(`session: /show: run directory not found for id "${runId}"\n`);
    return state;
  }

  const gate = state.approvals.show_artifact;
  let active = state;

  if (gate === 'ask') {
    const r = await maybePromptForAsk(deps, active, 'show_artifact', `show ${runId}/${rel}`);
    active = r.state;

    if (!r.proceed) {
      return active;
    }
  } else if (gate !== 'allow' && gate !== 'session') {
    writeStderr(`session: /show: show_artifact not permitted (current level: ${gate})\n`);
    return active;
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(active),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: {
      tool: 'show_artifact',
      args: { run_id: runId, path: rel },
      tool_call_id: toolCallId,
    },
  };
  let next = await appendEventAndFold(log, active, callEv);

  try {
    const r = await repoTools.showArtifact(cwd, { run_id: runId, path: rel });
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
    writeStderr(`--- ${runId}/${rel}${lineHint} ---\n`);
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
    writeStderr(`session: /show: ${message}\n`);
    return next;
  }
}
