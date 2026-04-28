import { InProcessFakeChatProvider } from '@providers/fake/InProcessFakeChat.provider';
import { describe, expect, it } from 'bun:test';

describe('InProcessFakeChatProvider', () => {
  it('echoes the last user message with a fake prefix', async () => {
    const fake = new InProcessFakeChatProvider();
    const res = await fake.complete({
      model: 'stub',
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'hello' },
      ],
    });
    expect(res.choices[0]?.message.content).toBe('[fake:stub] hello');
    expect(res.id).toBe('fake-1');
  });

  it('increments ids across calls', async () => {
    const fake = new InProcessFakeChatProvider();
    const a = await fake.complete({ model: 'm', messages: [{ role: 'user', content: 'a' }] });
    const b = await fake.complete({ model: 'm', messages: [{ role: 'user', content: 'b' }] });
    expect(a.id).toBe('fake-1');
    expect(b.id).toBe('fake-2');
  });
});
