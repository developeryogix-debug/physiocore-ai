/**
 * modelRouter.ts — Phase 5 Multi-model Router
 *
 * Routes AI calls to the best available model.
 * Claude 529 (overloaded) → fallback to GPT-4o-mini for non-clinical calls.
 * Clinical calls (SaMD Class II constraint): NEVER fallback — throw instead.
 *
 * Works in Node.js (Vercel API functions). Browser imports are safe:
 *   OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are non-VITE vars → undefined in browser,
 *   causing fallback/log to silently no-op. No key exposure risk.
 *
 * SaMD Class II: clinical=true calls refuse to route to non-Claude models.
 * safetyRules.ts IMMUTABLE — this module does not touch it.
 */

import { createClient } from '@supabase/supabase-js';

// ── Model constants ────────────────────────────────────────────────────────────

const CLAUDE_MODELS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
  opus:   'claude-opus-4-6',
} as const;

const OPENAI_FALLBACK = 'gpt-4o-mini';
const ANTHROPIC_API   = 'https://api.anthropic.com/v1/messages';
const OPENAI_API      = 'https://api.openai.com/v1/chat/completions';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouterOptions {
  tier:         'haiku' | 'sonnet' | 'opus';
  clinical:     boolean;   // if true: Claude only, never fallback
  maxTokens:    number;
  systemPrompt?: string;
}

export interface RouterResult {
  text:     string;
  model:    string;
  fallback: boolean;
}

interface ClaudeAttempt {
  text:   string | null;
  status: number;
}

// ── Claude call ────────────────────────────────────────────────────────────────

async function callClaude(
  prompt:  string,
  options: RouterOptions,
): Promise<ClaudeAttempt> {
  const apiKey = process.env['VITE_ANTHROPIC_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) return { text: null, status: 401 };

  const model = CLAUDE_MODELS[options.tier];
  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens,
    messages:   [{ role: 'user', content: prompt }],
  };
  if (options.systemPrompt) body['system'] = options.systemPrompt;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    // 529 = overloaded — caller decides whether to fallback
    if (res.status === 529) return { text: null, status: 529 };
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content.find(b => b.type === 'text')?.text ?? '';
    return { text, status: res.status };

  } catch (e) {
    // fetch() may throw an error whose message contains the HTTP status
    const msg = String(e);
    if (msg.includes('529')) return { text: null, status: 529 };
    throw e;
  }
}

// ── OpenAI GPT-4o-mini fallback ────────────────────────────────────────────────

async function callOpenAI(
  prompt:  string,
  options: RouterOptions,
): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'] ?? '';
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured — GPT-4o-mini fallback unavailable');

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(OPENAI_API, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body:   JSON.stringify({ model: OPENAI_FALLBACK, max_tokens: options.maxTokens, messages }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? '';
}

// ── Fallback audit log (cost_log) ─────────────────────────────────────────────

async function logFallback(claudeModel: string): Promise<void> {
  const url = process.env['VITE_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !key) return; // silently skip in browser / missing env

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const date = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('cost_log').insert({
      date,
      daily_spend_usd:       0,
      session_count:         0,
      avg_cost_per_session:  0,
      fallback_from:         claudeModel,
      fallback_to:           OPENAI_FALLBACK,
    });
  } catch { /* non-fatal — cost_log schema may not have fallback columns */ }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function routedFetch(
  prompt:  string,
  options: RouterOptions,
): Promise<RouterResult> {
  const claudeModel = CLAUDE_MODELS[options.tier];

  // Primary: Claude
  const attempt = await callClaude(prompt, options);

  // Success
  if (attempt.text !== null) {
    return { text: attempt.text, model: claudeModel, fallback: false };
  }

  // Claude overloaded (529)
  if (attempt.status === 529) {
    if (options.clinical) {
      // SaMD Class II constraint: clinical calls MUST use Claude — never route to GPT
      throw new Error(
        `[modelRouter] Claude ${claudeModel} overloaded (529). ` +
        `Clinical call refused fallback per SaMD Class II constraint.`,
      );
    }

    // Non-clinical: fallback to GPT-4o-mini
    console.warn(`[modelRouter] Claude 529 → falling back to ${OPENAI_FALLBACK}`);
    const text = await callOpenAI(prompt, options);
    void logFallback(claudeModel); // fire-and-forget
    return { text, model: OPENAI_FALLBACK, fallback: true };
  }

  // Other non-success (401, 400, etc.) — propagate
  throw new Error(`[modelRouter] Claude ${claudeModel} failed with status ${attempt.status}`);
}
