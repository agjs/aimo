/**
 * @file sessionLoop.integration.test.ts
 * @description In-memory session loop with fake log + fake chat.
 */

import {
  createDefaultToolApprovals,
  replaySessionEvents,
} from '@core/session/sessionReducer.behavior';
import { runSessionLoop, SessionTurnAbort } from '@features/sessionLoop.feature';
import { InProcessFakeChatProvider } from '@providers/fake/InProcessFakeChat.provider';
import { BunClockPort } from '@runtime/bun/ClockPort.bun';
import { FakeRepoTools } from '@shared/test-fakes/RepoTools.fake';
import { FakeSessionEventLog } from '@shared/test-fakes/SessionEventLog.fake';
import { describe, expect, it } from 'bun:test';

describe('sessionLoop (integration)', () => {
  it('persists session_start, user chat, and assistant_turn', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['hello', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-id',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: createDefaultToolApprovals(),
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('session_start');
    expect(kinds).toContain('user_turn');
    expect(kinds).toContain('assistant_turn');
    expect(kinds).toContain('stage_transition');
    const snap = log.getLastSnapshot();
    expect(snap).toContain('test-session-id');
    expect(snap).toContain('"calls": 1');
  });

  it('agentic free text: one model tool_call then one assistant_turn', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['tool: read note.txt', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), read_file: 'allow' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-agentic-tool',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: 'file body', truncated: false, total_lines: 2 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('tool_call');
    expect(kinds).toContain('tool_result');
    const assistantTurns = events.filter((e) => e.kind === 'assistant_turn');
    expect(assistantTurns).toHaveLength(1);
    const st = replaySessionEvents('test-agentic-tool', events);
    expect(st.history.length).toBe(2);
    expect(st.history[0]?.role).toBe('user');
    expect(st.history[1]?.role).toBe('assistant');
  });

  it('persists tool_call and tool_result for /read when read_file is allowed', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/read note.txt', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), read_file: 'allow' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-tools',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: 'x', truncated: false, total_lines: 1 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('approval');
    expect(kinds).toContain('tool_call');
    expect(kinds).toContain('tool_result');
  });

  it('persists tool_call for grep when grep is allowed', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/grep const', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), grep: 'allow' as const };
    const grepResult = {
      matches: [{ path: 'a.ts', line: 3, text: 'const x = 1' }],
      truncated_matches: false,
      truncated_output: false,
      files_scanned: 2,
    };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-grep',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
          grep: grepResult,
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const grepCall = events.find((e) => e.kind === 'tool_call' && e.payload.tool === 'grep');
    expect(grepCall).toBeDefined();
    if (grepCall?.kind !== 'tool_call') {
      return;
    }

    expect(grepCall.payload.args).toEqual({ pattern: 'const' });
  });

  it('persists tool_call for list_tree when list_tree is allowed', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/tree', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), list_tree: 'allow' as const };
    const listTreeResult = {
      lines: ['a/', 'a/b.txt'],
      truncated_entries: false,
      truncated_output: false,
      dirs_visited: 2,
    };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-tree',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
          listTree: listTreeResult,
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const treeCall = events.find((e) => e.kind === 'tool_call' && e.payload.tool === 'list_tree');
    expect(treeCall).toBeDefined();
    if (treeCall?.kind !== 'tool_call') {
      return;
    }

    expect(treeCall.payload.args).toEqual({});
  });

  it('persists tool_call for git_status when git_status is allowed', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/git-status', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), git_status: 'allow' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-git-status',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
          gitStatus: { output: '## main\n', truncated: false, exit_code: 0 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const call = events.find((e) => e.kind === 'tool_call' && e.payload.tool === 'git_status');
    expect(call).toBeDefined();
    if (call?.kind !== 'tool_call') {
      return;
    }

    expect(call.payload.args).toEqual({});
  });

  it('persists tool_call for git_diff when git_diff is allowed', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/git-diff staged', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), git_diff: 'allow' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-git-diff',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
          gitDiff: { output: 'diff --git a/x b/x\n', truncated: false, exit_code: 0 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const call = events.find((e) => e.kind === 'tool_call' && e.payload.tool === 'git_diff');
    expect(call).toBeDefined();
    if (call?.kind !== 'tool_call') {
      return;
    }

    expect(call.payload.args).toEqual({ staged: true });
  });

  it('persists tool_call for show_artifact when show_artifact is allowed and run is bound', async () => {
    const log = new FakeSessionEventLog();
    const runId = 'bound-run-1';
    const lines = [`/use ${runId}`, '/show out.txt', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), show_artifact: 'allow' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-show',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
          showArtifact: { content: 'x', truncated: false, total_lines: 1 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: (id) => Promise.resolve(id === runId),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const showCall = events.find(
      (e) => e.kind === 'tool_call' && e.payload.tool === 'show_artifact',
    );
    expect(showCall).toBeDefined();
    if (showCall?.kind !== 'tool_call') {
      return;
    }

    expect(showCall.payload.args).toEqual({ run_id: runId, path: 'out.txt' });
  });

  it('expands @plan: emits show_artifact tool events and augments the chat message', async () => {
    const log = new FakeSessionEventLog();
    const runId = 'mention-run-1';
    const lines = [`/use ${runId}`, '@plan summarize', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), show_artifact: 'allow' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-mention-plan',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
          showArtifact: { content: 'PLAN BODY', truncated: false, total_lines: 1 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: (id) => Promise.resolve(id === runId),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();

    const userTurn = events.find((e) => e.kind === 'user_turn');
    expect(userTurn?.kind).toBe('user_turn');
    if (userTurn?.kind === 'user_turn') {
      expect(userTurn.payload.text).toBe('@plan summarize');
    }

    const showCall = events.find(
      (e) => e.kind === 'tool_call' && e.payload.tool === 'show_artifact',
    );
    expect(showCall?.kind).toBe('tool_call');
    if (showCall?.kind === 'tool_call') {
      expect(showCall.payload.args).toEqual({ run_id: runId, path: 'plan.md' });
    }

    const assistant = events.find((e) => e.kind === 'assistant_turn');
    expect(assistant?.kind).toBe('assistant_turn');
    if (assistant?.kind === 'assistant_turn') {
      expect(assistant.payload.markdown).toContain('<CONTEXT name="@plan">');
      expect(assistant.payload.markdown).toContain('PLAN BODY');
    }
  });

  it('keeps @plan literal and writes a stderr note when no run is bound', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['@plan summarize', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), show_artifact: 'allow' as const };
    const stderrLines: string[] = [];

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-mention-unbound',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
        }),
        writeStderr: (t) => {
          stderrLines.push(t);
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const showCall = events.find(
      (e) => e.kind === 'tool_call' && e.payload.tool === 'show_artifact',
    );
    expect(showCall).toBeUndefined();
    expect(stderrLines.join('')).toContain('@plan');
    expect(stderrLines.join('')).toContain('no run bound');

    const assistant = events.find((e) => e.kind === 'assistant_turn');

    if (assistant?.kind === 'assistant_turn') {
      expect(assistant.payload.markdown).not.toContain('<CONTEXT name="@plan">');
      expect(assistant.payload.markdown).toContain('@plan summarize');
    }
  });

  it("interactive ask: 'a' lets the tool run once and gate stays at 'ask' for next time", async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/read note.txt', 'a', '/read note.txt', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), read_file: 'ask' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-ask-allow-once',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: 'one', truncated: false, total_lines: 1 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const askInits = events.filter((e) => e.kind === 'ask_initiated');
    expect(askInits.length).toBe(2);
    const approvals = events.filter((e) => e.kind === 'approval' && e.payload.tool === 'read_file');
    expect(approvals.length).toBeGreaterThanOrEqual(2);
    for (const a of approvals) {
      if (a.kind === 'approval') {
        expect(a.payload.decision).toBe('ask');
      }
    }

    const toolCalls = events.filter(
      (e) => e.kind === 'tool_call' && e.payload.tool === 'read_file',
    );
    expect(toolCalls.length).toBe(1);
  });

  it("interactive ask: 's' grants for the rest of the session", async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/read note.txt', 's', '/read note.txt', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), read_file: 'ask' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-ask-session',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: 'one', truncated: false, total_lines: 1 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const askInits = events.filter((e) => e.kind === 'ask_initiated');
    expect(askInits.length).toBe(1);
    const toolCalls = events.filter(
      (e) => e.kind === 'tool_call' && e.payload.tool === 'read_file',
    );
    expect(toolCalls.length).toBe(2);
    const lastApproval = events
      .filter((e) => e.kind === 'approval' && e.payload.tool === 'read_file')
      .at(-1);

    if (lastApproval?.kind === 'approval') {
      expect(lastApproval.payload.decision).toBe('session');
    }
  });

  it("interactive ask: 'n' denies and persists 'deny'", async () => {
    const log = new FakeSessionEventLog();
    const lines = ['/read note.txt', 'n', '/read note.txt', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const merged = { ...createDefaultToolApprovals(), read_file: 'ask' as const };

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-ask-never',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: merged,
        repoTools: new FakeRepoTools({
          readFile: { content: 'one', truncated: false, total_lines: 1 },
        }),
        writeStderr: () => {
          /* discard */
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    const { events } = await log.readEventsForReplay();
    const toolCalls = events.filter(
      (e) => e.kind === 'tool_call' && e.payload.tool === 'read_file',
    );
    expect(toolCalls.length).toBe(0);
    const lastApproval = events
      .filter((e) => e.kind === 'approval' && e.payload.tool === 'read_file')
      .at(-1);

    if (lastApproval?.kind === 'approval') {
      expect(lastApproval.payload.decision).toBe('deny');
    }
  });

  it('strips lazy @<path> mentions and writes a stderr advisory', async () => {
    const log = new FakeSessionEventLog();
    const lines = ['look at @src/foo.ts please', '/exit'];
    let i = 0;

    const readLine = (): Promise<string | null> => {
      const v = lines[i];
      i += 1;
      return Promise.resolve(v ?? null);
    };

    const turnAbort = new SessionTurnAbort();
    const stderrLines: string[] = [];

    await runSessionLoop(
      {
        cwd: '/tmp',
        sessionId: 'test-session-mention-lazy-path',
        profileName: 'default',
        cliVersion: '0.0.0-test',
        executionModel: 'stub',
        executionChat: new InProcessFakeChatProvider(),
        toolParseChat: null,
        toolParseModel: null,
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
        log,
        clock: new BunClockPort(),
        mergedSessionTools: createDefaultToolApprovals(),
        repoTools: new FakeRepoTools({
          readFile: { content: '', truncated: false, total_lines: 0 },
        }),
        writeStderr: (t) => {
          stderrLines.push(t);
        },
        readLine,
        existsRunDir: () => Promise.resolve(false),
      },
      turnAbort,
    );

    expect(stderrLines.join('')).toContain('@src/foo.ts');
    expect(stderrLines.join('')).toContain('Phase 6');

    const { events } = await log.readEventsForReplay();
    const userTurn = events.find((e) => e.kind === 'user_turn');

    if (userTurn?.kind === 'user_turn') {
      expect(userTurn.payload.text).toBe('look at @src/foo.ts please');
    }

    const assistant = events.find((e) => e.kind === 'assistant_turn');

    if (assistant?.kind === 'assistant_turn') {
      expect(assistant.payload.markdown).not.toContain('@src/foo.ts');
    }
  });
});
