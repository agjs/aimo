/**
 * @file runPipelineEmitStderrProgress.test.ts
 * @description Unit tests for the stderr progress emit helpers used by `aimo run`.
 */

import {
  emitRunStderrExecuteAfter,
  emitRunStderrExecuteBefore,
  emitRunStderrPlanAfter,
  emitRunStderrPlanBefore,
  emitRunStderrReviewBefore,
  emitRunStderrShrinkersAfter,
  emitRunStderrShrinkersBefore,
  emitRunStderrStarting,
} from '@app/runPipeline/runPipelineEmitStderrProgress.app';
import type { TWritePreflightContext } from '@app/runPipeline/runPipelinePreflightWrite.app';
import type { TExecuteWritePhaseResult } from '@app/runPipeline/runPipelineRunWritePhases.app';
import { setRunProgressColorPreference } from '@runtime/bun/RunProgressStderrStyle.bun';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

type StderrWriter = typeof process.stderr.write;
type StderrPatchTarget = { write: StderrWriter };

function captureStderr(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const target = process.stderr as unknown as StderrPatchTarget;
  const original: StderrWriter = target.write.bind(process.stderr);
  const writer = mock((chunk: string | Uint8Array): boolean => {
    const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    lines.push(text);
    return true;
  });
  target.write = writer;
  return {
    lines,
    restore: (): void => {
      target.write = original;
    },
  };
}

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

function makeContext(overrides: {
  runId?: string;
  needPlan?: boolean;
  needExec?: boolean;
  needRev?: boolean;
  planChat?: unknown;
  reviewChat?: unknown;
  execCommandFirst?: string;
  planPath?: string;
}): TWritePreflightContext {
  const ctx = {
    cwd: '/tmp/cwd',
    runId: overrides.runId ?? 'run-1',
    slice: {
      stages: ['plan', 'execute', 'review'],
      needPlan: overrides.needPlan ?? false,
      needExec: overrides.needExec ?? false,
      needRev: overrides.needRev ?? false,
      startsAtPlan: true,
    },
    paths: {
      runDir: '/tmp/cwd/.aimo/runs/run-1',
      planPath: overrides.planPath ?? '/tmp/cwd/.aimo/runs/run-1/plan.md',
      manifestPath: '/tmp/cwd/.aimo/runs/run-1/manifest.json',
    },
    loaded: {
      profileName: 'default',
      planProvider: 'fake',
      planModel: 'stub',
      planChat: overrides.planChat ?? null,
      execCfg:
        overrides.execCommandFirst === undefined
          ? null
          : {
              command: [overrides.execCommandFirst],
              pipePlanToStdin: false,
            },
      reviewProvider: 'fake',
      reviewModel: 'stub',
      reviewChat: overrides.reviewChat ?? null,
      keepRaw: true,
      shrinkers: [],
      workers: {},
      aimoConfig: {},
    },
  } satisfies Mutable<unknown> as unknown as TWritePreflightContext;

  return ctx;
}

describe('runPipelineEmitStderrProgress', () => {
  let cap: { lines: string[]; restore: () => void };

  beforeEach(() => {
    setRunProgressColorPreference('never');
    cap = captureStderr();
  });

  afterEach(() => {
    cap.restore();
    setRunProgressColorPreference('auto');
  });

  it('starting emits run id and slice', () => {
    emitRunStderrStarting(makeContext({ runId: 'abc' }));
    expect(cap.lines.join('')).toContain('run: starting abc');
  });

  it('planBefore stays silent when needPlan is false', () => {
    emitRunStderrPlanBefore(makeContext({ needPlan: false }));
    expect(cap.lines.length).toBe(0);
  });

  it('planBefore stays silent when planChat is null', () => {
    emitRunStderrPlanBefore(makeContext({ needPlan: true, planChat: null }));
    expect(cap.lines.length).toBe(0);
  });

  it('planBefore writes one line when needPlan and planChat is present', () => {
    emitRunStderrPlanBefore(makeContext({ needPlan: true, planChat: {} }));
    const out = cap.lines.join('');
    expect(out).toContain('run: plan (fake / stub)');
  });

  it('planAfter mentions the plan path', () => {
    emitRunStderrPlanAfter(makeContext({ needPlan: true, planChat: {}, planPath: '/abs/plan.md' }));
    expect(cap.lines.join('')).toContain('plan done → /abs/plan.md');
  });

  it('executeBefore mentions the executor argv[0]', () => {
    emitRunStderrExecuteBefore(makeContext({ needExec: true, execCommandFirst: 'aider' }));
    expect(cap.lines.join('')).toContain('execute (aider)');
  });

  it('executeBefore is silent when execCfg is null', () => {
    emitRunStderrExecuteBefore(makeContext({ needExec: true }));
    expect(cap.lines.length).toBe(0);
  });

  it('executeAfter only fires on outcome=ok', () => {
    const ctx = makeContext({ needExec: true });

    const skipped: TExecuteWritePhaseResult = { outcome: 'skipped' };
    emitRunStderrExecuteAfter(ctx.slice, skipped);
    expect(cap.lines.length).toBe(0);

    const ok: TExecuteWritePhaseResult = {
      outcome: 'ok',
      execute: {
        argvResolved: ['true'],
        gitDiffHeadError: null,
        spawnedExit: 0,
        spawnedStdout: '',
        spawnedStderr: '',
      },
    };
    emitRunStderrExecuteAfter(ctx.slice, ok);
    expect(cap.lines.join('')).toContain('execute finished (exit 0)');
  });

  it('shrinkers before/after each emit one line', () => {
    emitRunStderrShrinkersBefore(3);
    emitRunStderrShrinkersAfter();
    const joined = cap.lines.join('');
    expect(joined).toContain('shrinkers (3 step(s))');
    expect(joined).toContain('shrinkers done');
  });

  it('reviewBefore is silent when needRev is false', () => {
    emitRunStderrReviewBefore(makeContext({ needRev: false }));
    expect(cap.lines.length).toBe(0);
  });

  it('reviewBefore writes one line when needRev with reviewChat', () => {
    emitRunStderrReviewBefore(makeContext({ needRev: true, reviewChat: {} }));
    expect(cap.lines.join('')).toContain('review (fake / stub)');
  });
});
