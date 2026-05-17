/**
 * api/nutrition-insight.ts — POST /api/nutrition-insight
 * Returns a short clinical insight for a nutrient in a given recovery phase.
 * LLM (Haiku): motivational/educational text ONLY — not clinical dosing advice.
 * SaMD Class II: output is decision support, never autonomous clinical action.
 *
 * Body: { nutrient: string, phase: string, condition?: string }
 * Returns: { insight: string, pmid: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_KEY = process.env['VITE_ANTHROPIC_KEY'] ?? '';

const PMID_MAP: Record<string, string> = {
  'omega-3':             '28965053',
  'curcumin':            '27533649',
  'vitamin c':           '23736884',
  'collagen peptides':   '28174772',
  'zinc bisglycinate':   '28629136',
  'magnesium glycinate': '23853635',
  'creatine monohydrate':'28609972',
  'bromelain':           '22454684',
};

function lookupPmid(nutrient: string): string {
  const key = nutrient.toLowerCase();
  for (const [k, v] of Object.entries(PMID_MAP)) {
    if (key.includes(k)) return v;
  }
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nutrient, phase, condition } = req.body as {
    nutrient?: string;
    phase?: string;
    condition?: string;
  };

  if (!nutrient || !phase) {
    return res.status(400).json({ error: 'nutrient and phase are required' });
  }

  const pmid = lookupPmid(nutrient);

  if (!ANTHROPIC_KEY) {
    return res.status(200).json({
      insight: `${nutrient} supports recovery in the ${phase} phase. Consult a registered dietitian for personalised dosing.`,
      pmid,
    });
  }

  try {
    const conditionText = condition ? `, ${condition.replace(/_/g, ' ')}` : '';

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `Nutrient: ${nutrient}. Recovery phase: ${phase}${conditionText}. ` +
            'Write one evidence-informed sentence (max 28 words) explaining why this nutrient is relevant now. ' +
            'Clinical tone. No dosing numbers. No brand names. No exclamation marks.',
        }],
      }),
    });

    if (!resp.ok) throw new Error(`Anthropic ${resp.status}`);
    const data = await resp.json() as { content: Array<{ type: string; text: string }> };
    const block = data.content[0];
    const insight = block?.type === 'text'
      ? block.text.replace(/^["']|["']$/g, '').trim()
      : '';

    return res.status(200).json({ insight, pmid });
  } catch {
    return res.status(200).json({
      insight: `${nutrient} plays a key role in ${phase} phase recovery. Consult your healthcare provider for guidance.`,
      pmid,
    });
  }
}
