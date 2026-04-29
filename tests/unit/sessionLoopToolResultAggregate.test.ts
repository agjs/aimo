import { condenseToolResultForMainLlmIfConfigured } from '@features/sessionLoopToolResultAggregate.feature';
import { describe, expect, it } from 'bun:test';

describe('condenseToolResultForMainLlmIfConfigured', () => {
  it('returns raw body when aggregate worker is unset (even if large)', async () => {
    const body = 'x'.repeat(20_000);
    const r = await condenseToolResultForMainLlmIfConfigured(
      {
        writeStderr: () => {
          /* no-op */
        },
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 12_000,
        toolResultAggregateMaxInputChars: 200_000,
      },
      'grep',
      body,
      true,
    );
    expect(r).toBe(body);
  });

  it('skips on tool failure', async () => {
    const r = await condenseToolResultForMainLlmIfConfigured(
      {
        writeStderr: () => {
          /* no-op */
        },
        toolResultAggregateChat: null,
        toolResultAggregateModel: null,
        toolResultAggregateMinTriggerChars: 0,
        toolResultAggregateMaxInputChars: 200_000,
      },
      'read_file',
      'error: nope',
      false,
    );
    expect(r).toBe('error: nope');
  });
});
