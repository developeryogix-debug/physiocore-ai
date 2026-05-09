const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallOptions {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  model?: string;
}

async function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export async function callClaude(options: CallOptions): Promise<string> {
  const apiKey = import.meta.env['VITE_ANTHROPIC_API_KEY'] as string | undefined;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set');

  const body = JSON.stringify({
    model: options.model ?? MODEL,
    max_tokens: options.maxTokens ?? 2048,
    system: options.system,
    messages: options.messages,
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body,
    });

    if (response.status === 429) {
      if (attempt < 2) {
        await sleep(3000);
        continue;
      }
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => response.statusText);
      throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('No text content in Anthropic response');
    return text;
  }

  throw new Error('Rate limit (429) — retried 3 times. Try again shortly.');
}

export function extractJson<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const raw = match ? (match[1] ?? match[0]) : text;
  return JSON.parse(raw.trim()) as T;
}
