/**
 * @file sessionLoopMentions.feature.ts
 * @layer features
 * @description Eager `@plan` / `@diff` / `@review` / `@run:<id>` expansion for free-text turns
 * (spec D1: only run-artifact mentions resolve eagerly; path/dir/grep mentions are deferred).
 */

import { randomUUID } from 'node:crypto';

import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import {
  parseMention as _parseMention,
  tokenizeMentions,
  type TMentionDescriptor,
  type TRunArtifact,
} from '@core/repoTools/expandMention.behavior';
import {
  GIT_DIFF_AFTER_BASENAME,
  PLAN_MD_FILENAME,
  REVIEW_MD_FILENAME,
} from '@core/runs/AimoRunPaths.constants';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import type { ISessionState, TToolApprovalLevel } from '@core/session/SessionState.types';

import type { ISessionLoopDeps } from './sessionLoopDeps.types';
import { appendEventAndFold, nextEventSeq, sessionEventAtIso } from './sessionLoopShared.feature';

// re-export for ergonomic callers (avoids a separate import line in the loop)
export { _parseMention as parseMention };

/** Result of expanding `@`-mentions for one free-text turn. */
export interface IExpandMentionsResult {
  /** State after appending any `tool_call` / `tool_result` events. */
  readonly state: ISessionState;
  /** Text the chat should see for the *current* turn (event log keeps the raw user line). */
  readonly augmentedText: string;
}

function isPermissive(level: TToolApprovalLevel): boolean {
  return level === 'allow' || level === 'session';
}

function artifactBasename(artifact: TRunArtifact): string {
  if (artifact === 'plan') {
    return PLAN_MD_FILENAME;
  }

  if (artifact === 'review') {
    return REVIEW_MD_FILENAME;
  }

  return GIT_DIFF_AFTER_BASENAME;
}

function contextBlock(name: string, body: string): string {
  return `<CONTEXT name="${name}">\n${body}\n</CONTEXT>`;
}

type TEagerDescriptor = Extract<
  TMentionDescriptor,
  { kind: 'eager_run_artifact' | 'eager_run_artifact_named' }
>;

interface ITryEagerResult {
  readonly state: ISessionState;
  readonly contextBody: string | null;
}

/**
 * Expands `@`-mentions in a free-text turn line (spec D1).
 * `@plan` / `@review` resolve via `show_artifact` against the bound run; `@diff` calls `git_diff`
 * (working tree, not run-scoped); `@run:<id>` resolves `show_artifact` against the named id;
 * `@<path>` / `@<dir>/` / `@grep:<pat>` are stripped with one stderr advisory each (Phase 6 lazy);
 * `@<unknown>` is kept literal. Resolved eagers append `<CONTEXT>` blocks to the chat text and
 * emit one `tool_call` + `tool_result` event pair each.
 * @param deps - Session loop dependencies (port + writers + clock + log).
 * @param state - State after the `user_turn` event for this turn has been folded.
 * @param rawText - The raw user line (already trimmed by the caller).
 * @returns Updated state plus the augmented text to send to the chat for this turn only.
 */
export async function expandMentionsForFreeTextTurn(
  deps: ISessionLoopDeps,
  state: ISessionState,
  rawText: string,
): Promise<IExpandMentionsResult> {
  const { writeStderr } = deps;
  const tokens = tokenizeMentions(rawText);

  let next = state;
  const outParts: string[] = [];
  const contextBlocks: string[] = [];

  for (const tok of tokens) {
    if (tok.kind === 'text') {
      outParts.push(tok.value);
      continue;
    }

    const d = tok.descriptor;

    if (d.kind === 'lazy_path' || d.kind === 'lazy_dir') {
      writeStderr(
        `session: ${tok.raw} — @-path mentions land in Phase 6; use /read or /tree for now\n`,
      );
      continue;
    }

    if (d.kind === 'lazy_grep') {
      writeStderr(`session: ${tok.raw} — @-grep mentions land in Phase 6; use /grep for now\n`);
      continue;
    }

    if (d.kind === 'unknown') {
      writeStderr(`session: ${tok.raw} — unknown mention; leaving token literal\n`);
      outParts.push(tok.raw);
      continue;
    }

    const result = await tryEagerMention(deps, next, tok.raw, d);
    next = result.state;
    outParts.push(tok.raw);

    if (result.contextBody !== null) {
      contextBlocks.push(contextBlock(tok.raw, result.contextBody));
    }
  }

  const base = outParts.join('');
  const augmentedText =
    contextBlocks.length === 0 ? base : `${base}\n\n${contextBlocks.join('\n\n')}`;

  return { state: next, augmentedText };
}

async function tryEagerMention(
  deps: ISessionLoopDeps,
  state: ISessionState,
  raw: string,
  descriptor: TEagerDescriptor,
): Promise<ITryEagerResult> {
  if (descriptor.kind === 'eager_run_artifact' && descriptor.artifact === 'diff') {
    return tryEagerWorkingDiff(deps, state, raw);
  }

  return tryEagerRunArtifact(deps, state, raw, descriptor);
}

async function tryEagerWorkingDiff(
  deps: ISessionLoopDeps,
  state: ISessionState,
  raw: string,
): Promise<ITryEagerResult> {
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const gate = state.approvals.git_diff;

  if (!isPermissive(gate)) {
    writeStderr(
      `session: ${raw} — git_diff not permitted (current level: ${gate}); leaving token literal\n`,
    );
    return { state, contextBody: null };
  }

  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(state),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: { tool: 'git_diff', args: { staged: false }, tool_call_id: toolCallId },
  };
  let next = await appendEventAndFold(log, state, callEv);

  try {
    const r = await repoTools.gitDiff(cwd, { staged: false });
    const ok = r.exit_code === 0;
    const summary = ok
      ? `git diff (${String(r.output.length)} bytes${r.truncated ? ', truncated' : ''})`
      : `git diff exit ${String(r.exit_code)}`;
    const resEv: TSessionEventEnvelope = {
      schema_version: 1,
      seq: nextEventSeq(next),
      at: sessionEventAtIso(clock),
      kind: 'tool_result',
      payload: { tool_call_id: toolCallId, ok, summary },
    };
    next = await appendEventAndFold(log, next, resEv);

    if (!ok) {
      writeStderr(
        `session: ${raw} — git diff failed (exit ${String(r.exit_code)}); leaving token literal\n`,
      );
      return { state: next, contextBody: null };
    }

    return { state: next, contextBody: r.output };
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
    writeStderr(`session: ${raw} — git diff error: ${message}; leaving token literal\n`);
    return { state: next, contextBody: null };
  }
}

async function tryEagerRunArtifact(
  deps: ISessionLoopDeps,
  state: ISessionState,
  raw: string,
  descriptor: TEagerDescriptor,
): Promise<ITryEagerResult> {
  const { log, clock, repoTools, cwd, writeStderr } = deps;
  const gate = state.approvals.show_artifact;

  if (!isPermissive(gate)) {
    writeStderr(
      `session: ${raw} — show_artifact not permitted (current level: ${gate}); leaving token literal\n`,
    );
    return { state, contextBody: null };
  }

  let runId: string | null;

  if (descriptor.kind === 'eager_run_artifact') {
    runId = state.boundRunId;

    if (runId === null) {
      writeStderr(`session: ${raw} — no run bound; use /use <id> first\n`);
      return { state, contextBody: null };
    }
  } else {
    runId = descriptor.runId;

    if (!isSafeRunDirectoryName(runId)) {
      writeStderr(`session: ${raw} — invalid run id\n`);
      return { state, contextBody: null };
    }
  }

  const path = artifactBasename(descriptor.artifact);
  const toolCallId = randomUUID();
  const callEv: TSessionEventEnvelope = {
    schema_version: 1,
    seq: nextEventSeq(state),
    at: sessionEventAtIso(clock),
    kind: 'tool_call',
    payload: {
      tool: 'show_artifact',
      args: { run_id: runId, path },
      tool_call_id: toolCallId,
    },
  };
  let next = await appendEventAndFold(log, state, callEv);

  try {
    const r = await repoTools.showArtifact(cwd, { run_id: runId, path });
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
    return { state: next, contextBody: r.content };
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
    writeStderr(`session: ${raw} — ${message}; leaving token literal\n`);
    return { state: next, contextBody: null };
  }
}
