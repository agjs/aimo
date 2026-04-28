/**
 * @file RunProgressStderrStyle.test.ts
 * @description Unit tests for the colored stderr progress helpers (env / argv / TTY precedence).
 */

import {
  setRunProgressColorPreference,
  writeRunProgressErrorLine,
  writeRunProgressLine,
  writeRunProgressWarnLine,
  writeRunStyledMessage,
} from '@runtime/bun/RunProgressStderrStyle.bun';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`);

const COLOR_ENV_VARS = [
  'NO_COLOR',
  'NODE_DISABLE_COLORS',
  'FORCE_COLOR',
  'CLICOLOR_FORCE',
  'CI',
  'TERM',
] as const;

type SnapshotEnv = { [key: string]: string | undefined };

function snapshotEnv(): SnapshotEnv {
  const out: SnapshotEnv = {};

  for (const k of COLOR_ENV_VARS) {
    out[k] = process.env[k];
  }

  return out;
}

function restoreEnv(snap: SnapshotEnv): void {
  for (const k of COLOR_ENV_VARS) {
    const v = snap[k];

    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function clearColorEnv(): void {
  for (const k of COLOR_ENV_VARS) {
    delete process.env[k];
  }
}

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

describe('RunProgressStderrStyle', () => {
  let envSnap: SnapshotEnv;
  let cap: { lines: string[]; restore: () => void };

  beforeEach(() => {
    envSnap = snapshotEnv();
    clearColorEnv();
    setRunProgressColorPreference('auto');
    cap = captureStderr();
  });

  afterEach(() => {
    cap.restore();
    setRunProgressColorPreference('auto');
    restoreEnv(envSnap);
  });

  it('writes the run: prefix and trailing newline', () => {
    setRunProgressColorPreference('never');
    writeRunProgressLine('hello');
    const joined = cap.lines.join('');
    expect(joined).toBe('run: hello\n');
  });

  it('omits ANSI when --progress-color never even with FORCE_COLOR', () => {
    process.env.FORCE_COLOR = '1';
    setRunProgressColorPreference('never');
    writeRunProgressLine('plain');
    expect(ANSI.test(cap.lines.join(''))).toBe(false);
  });

  it('emits ANSI when --progress-color always', () => {
    setRunProgressColorPreference('always');
    writeRunProgressLine('colored');
    expect(ANSI.test(cap.lines.join(''))).toBe(true);
  });

  it('NO_COLOR overrides --progress-color always', () => {
    process.env.NO_COLOR = '1';
    setRunProgressColorPreference('always');
    writeRunProgressLine('plain');
    expect(ANSI.test(cap.lines.join(''))).toBe(false);
  });

  it('NODE_DISABLE_COLORS overrides --progress-color always', () => {
    process.env.NODE_DISABLE_COLORS = '1';
    setRunProgressColorPreference('always');
    writeRunProgressLine('plain');
    expect(ANSI.test(cap.lines.join(''))).toBe(false);
  });

  it('auto + CI on enables color', () => {
    process.env.CI = 'true';
    setRunProgressColorPreference('auto');
    writeRunProgressLine('ci-color');
    expect(ANSI.test(cap.lines.join(''))).toBe(true);
  });

  it('auto + FORCE_COLOR=1 enables color', () => {
    process.env.FORCE_COLOR = '1';
    setRunProgressColorPreference('auto');
    writeRunProgressLine('forced');
    expect(ANSI.test(cap.lines.join(''))).toBe(true);
  });

  it('warn variant uses run: prefix', () => {
    setRunProgressColorPreference('never');
    writeRunProgressWarnLine('careful');
    expect(cap.lines.join('')).toBe('run: careful\n');
  });

  it('error variant uses run: prefix', () => {
    setRunProgressColorPreference('never');
    writeRunProgressErrorLine('bad');
    expect(cap.lines.join('')).toBe('run: bad\n');
  });

  it('writeRunStyledMessage passes through non-run lines unchanged', () => {
    setRunProgressColorPreference('never');
    writeRunStyledMessage('arbitrary log\n');
    expect(cap.lines.join('')).toBe('arbitrary log\n');
  });

  it('writeRunStyledMessage strips run: prefix and re-applies styling', () => {
    setRunProgressColorPreference('never');
    writeRunStyledMessage('run:   spaced body\n', 'warn');
    expect(cap.lines.join('')).toBe('run: spaced body\n');
  });

  it('cache invalidates when preference flips', () => {
    setRunProgressColorPreference('never');
    writeRunProgressLine('x');
    setRunProgressColorPreference('always');
    writeRunProgressLine('y');
    const out = cap.lines.join('');
    const firstSegment = out.split('\n')[0] ?? '';
    const secondSegment = out.split('\n')[1] ?? '';
    expect(ANSI.test(firstSegment)).toBe(false);
    expect(ANSI.test(secondSegment)).toBe(true);
  });
});
