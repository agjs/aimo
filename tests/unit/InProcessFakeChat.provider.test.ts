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

  it('returns empty echo when no user message is present', async () => {
    const fake = new InProcessFakeChatProvider();
    const res = await fake.complete({
      model: 'm',
      messages: [{ role: 'system', content: 'sys-only' }],
    });
    expect(res.choices[0]?.message.content).toBe('[fake:m] ');
  });

  it('echoes only the last user message when several are present', async () => {
    const fake = new InProcessFakeChatProvider();
    const res = await fake.complete({
      model: 'm',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'mid' },
        { role: 'user', content: 'last' },
      ],
    });
    expect(res.choices[0]?.message.content).toBe('[fake:m] last');
  });

  it('returns a deterministic schema-shaped response with empty messages[]', async () => {
    const fake = new InProcessFakeChatProvider();
    const res = await fake.complete({ model: 'm', messages: [] });
    expect(res.id).toBe('fake-1');
    expect(res.model).toBe('m');
    expect(res.choices.length).toBe(1);
    expect(res.choices[0]?.message.role).toBe('assistant');
    expect(res.choices[0]?.finish_reason).toBe('stop');
    expect(res.usage).toEqual({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
  });
});
