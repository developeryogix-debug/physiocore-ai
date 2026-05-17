/**
 * generate-soap.ts — POST /api/generate-soap
 * Generates a SOAP clinical note via claude-sonnet-4-20250514.
 * SaMD Class II — output is decision support only, not autonomous clinical action.
 * Max 1000 tokens, JSON-only response.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callClaude, extractJson } from './_lib/claude.js';

export interface SOAPInput {
  patientId: string;
  sessionCount: number;
  avgFormScore: number;
  dateRange: string;          // e.g. "last 7 days"
  nprs?: number;              // 0–10 pain scale, optional
  exercises: string[];
  postureFindings?: string[];
  romFindings?: string[];
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const SYSTEM = `You are a senior physiotherapist writing a structured SOAP clinical note for a rehabilitation app.
Return ONLY valid JSON with exactly these keys: subjective, objective, assessment, plan.
Rules:
- Each section: 2–3 sentences max, precise clinical language
- objective: include form scores, pain rating if provided, ROM/posture findings if available
- assessment: summarise progress trend, note any concerns
- plan: concrete next steps and frequency
- No preamble, no markdown, no extra keys
Output ONLY the JSON object.`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const input = req.body as SOAPInput;

  if (!input?.patientId) {
    res.status(400).json({ error: 'patientId required' });
    return;
  }

  const exerciseList = (input.exercises ?? []).slice(0, 10).join(', ') || 'unspecified';
  const postureText  = (input.postureFindings ?? []).join('; ') || 'none recorded';
  const romText      = (input.romFindings ?? []).join('; ') || 'none recorded';

  const userMsg = `Generate a SOAP note for the following patient data:
- Date range: ${input.dateRange}
- Sessions completed: ${input.sessionCount}
- Average form score: ${input.avgFormScore}/100
- Exercises performed: ${exerciseList}
- NPRS pain score: ${input.nprs != null ? `${input.nprs}/10` : 'not assessed'}
- Posture findings: ${postureText}
- ROM findings: ${romText}

Return JSON only.`;

  try {
    const raw  = await callClaude({
      system:      SYSTEM,
      userMessage: userMsg,
      maxTokens:   1000,
      model:       'claude-sonnet-4-20250514',
    });
    const note = extractJson<SOAPNote>(raw);
    res.status(200).json(note);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `SOAP generation failed: ${msg}` });
  }
}
