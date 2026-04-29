import { extractModelIdFromDelegatedArgv } from '@core/execute/extractModelIdFromDelegatedArgv.behavior';
import { describe, expect, it } from 'bun:test';

describe('extractModelIdFromDelegatedArgv', () => {
  it('returns id after --model', () => {
    expect(
      extractModelIdFromDelegatedArgv([
        'aider',
        '--model',
        'openrouter/foo',
        '--message-file',
        'x',
      ]),
    ).toBe('openrouter/foo');
  });

  it('returns id after -m', () => {
    expect(extractModelIdFromDelegatedArgv(['tool', '-m', 'm1'])).toBe('m1');
  });

  it('returns null when flag missing', () => {
    expect(extractModelIdFromDelegatedArgv(['aider', '--yes'])).toBe(null);
  });
});
