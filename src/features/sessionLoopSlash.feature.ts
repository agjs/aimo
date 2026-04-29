/**
 * @file sessionLoopSlash.feature.ts
 * @layer features
 * @description Slash-command dispatch and cold-start YAML approval snapshot for the session loop.
 */

import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import type { IClockPort } from '@core/ports/IClockPort.types';
import type { ISessionEventLogPort } from '@core/ports/ISessionEventLogPort.types';
import { REPO_TOOL_NAMES, type TToolName } from '@core/repoTools/RepoToolNames.constants';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import { replaySessionEvents } from '@core/session/sessionReducer.behavior';
import type { ISessionState, TToolApprovalLevel } from '@core/session/SessionState.types';

import type { ISessionLoopDeps } from './sessionLoopDeps.types';
import {
  appendEventAndFold,
  nextEventSeq,
  persistSessionSnapshot,
  sessionEventAtIso,
} from './sessionLoopShared.feature';
import { slashGitDiff, slashGitStatus, slashShowArtifact } from './sessionLoopSlashGitShow.feature';
import { slashGrep, slashListTree, slashReadFile } from './sessionLoopSlashRepoTools.feature';
import type { SessionTurnAbort } from './sessionTurnAbort.feature';

/**
 * Parses `/cmd rest…` from a trimmed line that starts with `/`.
 * @param trimmedLine - Non-empty trimmed user input starting with `/`.
 * @returns Lowercased command token and remainder of the line.
 */
export function parseSlashParts(trimmedLine: string): {
  readonly cmd: string;
  readonly rest: string;
} {
  const body = trimmedLine.slice(1);
  const [cmdRaw, ...restParts] = body.split(/\s+/);
  const cmd = (cmdRaw ?? '').toLowerCase();
  const rest = restParts.join(' ').trim();

  return { cmd, rest };
}

function writeHelpLines(writeStderr: (t: string) => void, topic: string): void {
  const lines = [
    'Commands: /help [cmd], /status, /use <runId>, /read <path>, /grep <pattern> [glob] [-C<n>], /tree [path], /git-status, /git-diff [staged], /show <path>, /approvals, /cancel, /exit, /resume',
    'Free text runs one chat completion (profile execution LLM — see execution_llm / execute --model) and logs turns.',
    'Repo tools: session.tools.read_file / grep / list_tree / git_status / git_diff / show_artifact (allow|deny|ask|never|session) in aimo.yaml.',
  ];

  if (topic.length === 0) {
    writeStderr(`${lines.join('\n')}\n`);
    return;
  }

  const hit = lines.filter((l) => l.toLowerCase().includes(topic));
  writeStderr(`${hit.length > 0 ? hit.join('\n') : '(no match)'}\n`);
}

function writeStatusLines(
  writeStderr: (t: string) => void,
  sessionId: string,
  state: ISessionState,
): void {
  writeStderr(
    [
      `session: ${sessionId}`,
      `mode: ${state.mode}`,
      `bound run: ${state.boundRunId ?? '—'}`,
      `last checkpoint: —`,
      `usage: prompt=${String(state.usageTotal.prompt_tokens)} completion=${String(state.usageTotal.completion_tokens)} calls=${String(state.usageTotal.calls)}`,
      `pending approval: ${state.pendingApproval ? `${state.pendingApproval.tool} (${state.pendingApproval.reason})` : '—'}`,
    ].join('\n') + '\n',
  );
}

async function slashBindRun(
  log: ISessionEventLogPort,
  clock: IClockPort,
  state: ISessionState,
  runId: string,
  existsRunDir: (id: string) => Promise<boolean>,
  writeStderr: (t: string) => void,
): Promise<ISessionState> {
  if (!isSafeRunDirectoryName(runId)) {
    writeStderr('session: /use: invalid run id\n');
    return state;
  }

  if (!(await existsRunDir(runId))) {
    writeStderr(`session: /use: run directory not found for id "${runId}"\n`);
    return state;
  }

  const ev: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(state),
    at: sessionEventAtIso(clock),
    kind: 'run_bound',
    payload: { run_id: runId },
  };
  const next = await appendEventAndFold(log, state, ev);
  await persistSessionSnapshot(log, next);
  writeStderr(`session: bound to run ${runId}\n`);
  return next;
}

async function slashCancel(
  log: ISessionEventLogPort,
  clock: IClockPort,
  state: ISessionState,
  turnAbort: SessionTurnAbort,
  writeStderr: (t: string) => void,
): Promise<ISessionState> {
  turnAbort.abort();
  const ev: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(state),
    at: sessionEventAtIso(clock),
    kind: 'cancelled',
    payload: { reason: 'slash_cancel' },
  };
  const next = await appendEventAndFold(log, state, ev);
  await persistSessionSnapshot(log, next);
  writeStderr('session: cancel requested\n');
  return next;
}

async function slashResume(
  log: ISessionEventLogPort,
  sessionId: string,
  writeStderr: (t: string) => void,
): Promise<ISessionState> {
  const again = await log.readEventsForReplay();

  for (const w of again.warnings) {
    writeStderr(`${w}\n`);
  }

  const next = replaySessionEvents(sessionId, again.events);
  await persistSessionSnapshot(log, next);
  writeStderr(`session: replayed ${String(next.head)} event(s)\n`);
  return next;
}

function writeApprovalsLines(writeStderr: (t: string) => void, state: ISessionState): void {
  const rows = REPO_TOOL_NAMES.map((name) => `${name}: ${state.approvals[name]}`).join('\n');
  writeStderr(`${rows}\n`);
}

/**
 * Persists initial `approval` events from merged YAML on a brand-new session (cold start).
 * @param log - Session log.
 * @param clock - Clock for `at` timestamps.
 * @param state - State after `session_start`.
 * @param merged - Effective per-tool levels from config.
 * @returns State after appending zero or more `approval` events.
 */
export async function emitColdStartYamlApprovals(
  log: ISessionEventLogPort,
  clock: IClockPort,
  state: ISessionState,
  merged: Readonly<Record<TToolName, TToolApprovalLevel>>,
): Promise<ISessionState> {
  let next = state;

  for (const tool of REPO_TOOL_NAMES) {
    const level = merged[tool];

    if (level === 'deny') {
      continue;
    }

    const ev: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'approval',
      payload: { tool, decision: level },
    };
    next = await appendEventAndFold(log, next, ev);
  }

  await persistSessionSnapshot(log, next);
  return next;
}

type TSlashDispatchResult =
  | { readonly kind: 'exit' }
  | { readonly kind: 'continue'; readonly state: ISessionState };

/**
 * Handles one slash command line (without the leading context of the main read loop).
 * @param deps - Session ports and callbacks.
 * @param turnAbort - Shared abort handle for `/cancel`.
 * @param state - Current reducer state.
 * @param cmd - Lowercased command name after `/`.
 * @param rest - Remainder of the line after the command token.
 * @returns Exit vs continue plus updated state when continuing.
 */
export async function dispatchSlashLine(
  deps: ISessionLoopDeps,
  turnAbort: SessionTurnAbort,
  state: ISessionState,
  cmd: string,
  rest: string,
): Promise<TSlashDispatchResult> {
  const { sessionId, log, clock, writeStderr, existsRunDir } = deps;

  if (cmd === 'exit' || cmd === 'quit') {
    return { kind: 'exit' };
  }

  if (cmd === 'help') {
    writeHelpLines(writeStderr, rest.toLowerCase());
    return { kind: 'continue', state };
  }

  if (cmd === 'status') {
    writeStatusLines(writeStderr, sessionId, state);
    return { kind: 'continue', state };
  }

  if (cmd === 'use') {
    const next = await slashBindRun(log, clock, state, rest.trim(), existsRunDir, writeStderr);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'cancel') {
    const next = await slashCancel(log, clock, state, turnAbort, writeStderr);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'resume') {
    const next = await slashResume(log, sessionId, writeStderr);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'read') {
    const next = await slashReadFile(deps, state, rest);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'grep') {
    const next = await slashGrep(deps, state, rest);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'tree') {
    const next = await slashListTree(deps, state, rest);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'git-status') {
    const next = await slashGitStatus(deps, state, rest);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'git-diff') {
    const next = await slashGitDiff(deps, state, rest);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'show') {
    const next = await slashShowArtifact(deps, state, rest);
    return { kind: 'continue', state: next };
  }

  if (cmd === 'approvals') {
    writeApprovalsLines(writeStderr, state);
    return { kind: 'continue', state };
  }

  writeStderr(`session: unknown command /${cmd} (try /help)\n`);
  return { kind: 'continue', state };
}
