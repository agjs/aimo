/**
 * @file sessionReducer.test.ts
 * @description Unit tests for session event replay / reducer.
 */

import { deriveSessionSnapshot } from '@core/session/deriveSessionSnapshot.behavior';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';
import {
  createInitialSessionState,
  reduceSessionState,
  replaySessionEvents,
} from '@core/session/sessionReducer.behavior';
import { describe, expect, it } from 'bun:test';

describe('sessionReducer', () => {
  it('throws when seq is not head+1', () => {
    const s0 = createInitialSessionState('s1');
    const ev = {
      schema_version: 1 as const,
      seq: 2,
      at: '2026-01-01T00:00:00.000Z',
      kind: 'session_start' as const,
      payload: { cli_version: '0', cwd: '/', profile_name: 'default' },
    } satisfies TSessionEventEnvelope;
    expect(() => reduceSessionState(s0, ev)).toThrow(/expected seq 1/);
  });

  it('replays session_start then user and assistant', () => {
    const events: TSessionEventEnvelope[] = [
      {
        schema_version: 1,
        seq: 1,
        at: '2026-01-01T00:00:00.000Z',
        kind: 'session_start',
        payload: { cli_version: '1.0.0', cwd: '/repo', profile_name: 'dev' },
      },
      {
        schema_version: 1,
        seq: 2,
        at: '2026-01-01T00:00:01.000Z',
        kind: 'user_turn',
        payload: { text: 'hello' },
      },
      {
        schema_version: 1,
        seq: 3,
        at: '2026-01-01T00:00:02.000Z',
        kind: 'assistant_turn',
        payload: {
          markdown: 'hi',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      },
    ];
    const st = replaySessionEvents('sid', events);
    expect(st.head).toBe(3);
    expect(st.profileName).toBe('dev');
    expect(st.history).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
    expect(st.usageTotal).toEqual({ prompt_tokens: 10, completion_tokens: 5, calls: 1 });
  });

  it('applies approval and run_bound', () => {
    const events: TSessionEventEnvelope[] = [
      {
        schema_version: 1,
        seq: 1,
        at: '2026-01-01T00:00:00.000Z',
        kind: 'session_start',
        payload: { cli_version: '0', cwd: '/', profile_name: 'default' },
      },
      {
        schema_version: 1,
        seq: 2,
        at: '2026-01-01T00:00:01.000Z',
        kind: 'run_bound',
        payload: { run_id: 'r-1' },
      },
      {
        schema_version: 1,
        seq: 3,
        at: '2026-01-01T00:00:02.000Z',
        kind: 'approval',
        payload: { tool: 'read_file', decision: 'allow' },
      },
    ];
    const st = replaySessionEvents('sid', events);
    expect(st.boundRunId).toBe('r-1');
    expect(st.approvals.read_file).toBe('allow');
    const snap = deriveSessionSnapshot(st);
    expect(snap.bound_run_id).toBe('r-1');
  });

  it('ask_initiated sets pendingApproval, approval clears it and updates approvals', () => {
    let st = createInitialSessionState('sid');
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 1,
      at: 't',
      kind: 'session_start',
      payload: { cli_version: '0', cwd: '/', profile_name: 'd' },
    });
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 2,
      at: 't',
      kind: 'ask_initiated',
      payload: { tool: 'read_file', reason: 'read foo.txt' },
    });
    expect(st.pendingApproval).toEqual({ tool: 'read_file', reason: 'read foo.txt' });
    expect(st.approvals.read_file).toBe('deny');

    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 3,
      at: 't',
      kind: 'approval',
      payload: { tool: 'read_file', decision: 'session' },
    });
    expect(st.pendingApproval).toBeNull();
    expect(st.approvals.read_file).toBe('session');
  });

  it('cancelled clears pendingApproval defensively', () => {
    let st = createInitialSessionState('sid');
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 1,
      at: 't',
      kind: 'session_start',
      payload: { cli_version: '0', cwd: '/', profile_name: 'd' },
    });
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 2,
      at: 't',
      kind: 'ask_initiated',
      payload: { tool: 'grep', reason: 'grep foo' },
    });
    expect(st.pendingApproval).not.toBeNull();
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 3,
      at: 't',
      kind: 'cancelled',
      payload: {},
    });
    expect(st.pendingApproval).toBeNull();
  });

  it('stage_transition and cancelled set mode', () => {
    let st = createInitialSessionState('sid');
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 1,
      at: 't',
      kind: 'session_start',
      payload: { cli_version: '0', cwd: '/', profile_name: 'd' },
    });
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 2,
      at: 't',
      kind: 'stage_transition',
      payload: { from: 'idle', to: 'streaming' },
    });
    expect(st.mode).toBe('streaming');
    st = reduceSessionState(st, {
      schema_version: 1,
      seq: 3,
      at: 't',
      kind: 'cancelled',
      payload: {},
    });
    expect(st.mode).toBe('idle');
  });
});
