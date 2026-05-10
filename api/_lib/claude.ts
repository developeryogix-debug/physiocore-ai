const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

interface CallOptions {
  system: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
}

export async function callClaude(opts: CallOptions): Promise<string> {
  const apiKey = process.env['VITE_ANTHROPIC_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) throw new Error('Missing Anthropic API key');

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model ?? 'claude-haiku-4-5-20251001',
      max_tokens: opts.maxTokens ?? 300,
      system: opts.system,
      messages: [{ role: 'user', content: opts.userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content.find(b => b.type === 'text')?.text ?? '';
}

export function extractJson<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = match ? (match[1] ?? match[0]) : text;
  return JSON.parse(raw.trim()) as T;
}
