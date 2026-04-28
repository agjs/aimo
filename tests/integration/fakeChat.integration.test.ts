import { createInProcessFakeChatPort } from '@app/wireDefaults';
import { describe, expect, it } from 'bun:test';

describe('fake chat wiring', () => {
  it('exposes factory from composition root', async () => {
    const port = createInProcessFakeChatPort();
    const res = await port.complete({
      model: 'stub',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(res.choices[0]?.message.content).toContain('ping');
  });
});
