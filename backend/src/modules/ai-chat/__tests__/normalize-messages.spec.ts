import { normalizeMessages } from '../ai-chat.service';

describe('normalizeMessages', () => {
  it('merges the consecutive user turns the browser agent produces', () => {
    // assistant -> user -> user is what BrowserAgent sends from iteration 2 onward:
    // an "Action completed" note followed by the next task/elements message.
    const result = normalizeMessages([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      { role: 'assistant', content: 'ACTION: click(16)' },
      { role: 'user', content: 'Action completed: click(16)' },
      { role: 'user', content: 'Task: next step' },
    ]);

    expect(result.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(result[3].content).toBe('Action completed: click(16)\n\nTask: next step');
  });

  it('drops empty and whitespace-only messages', () => {
    const result = normalizeMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '   ' },
      { role: 'user', content: '' },
      { role: 'assistant', content: 'ok' },
    ]);

    expect(result).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'ok' },
    ]);
  });

  it("does not mutate the caller's messages", () => {
    const input = [
      { role: 'user' as const, content: 'a' },
      { role: 'user' as const, content: 'b' },
    ];
    normalizeMessages(input);

    expect(input[0].content).toBe('a');
  });
});
