import { firstShrinkerWorkerPerSource } from '@core/workers/FirstShrinkerPerSource.behavior';
import { describe, expect, it } from 'bun:test';

describe('firstShrinkerWorkerPerSource', () => {
  it('keeps first row per source', () => {
    const out = firstShrinkerWorkerPerSource([
      { source: 'execute.stdout', worker: 'a' },
      { source: 'execute.stdout', worker: 'b' },
      { source: 'execute.stderr', worker: 'c' },
    ]);
    expect(out).toEqual([
      { source: 'execute.stdout', worker: 'a' },
      { source: 'execute.stderr', worker: 'c' },
    ]);
  });
});
