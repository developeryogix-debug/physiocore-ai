/**
 * TreatmentArbiterAgent.ts
 * Receives conservative + early-mob plans, arbitrates on 6 clinical axes,
 * returns winner ('conservative' | 'early_mob' | 'hybrid').
 * Parse failure → conservative (safety-first).
 * Spec: docs/PHASE3_TREATMENT_PLANNING.md §1 (Debate pattern)
 * Model: claude-opus-4-6 — sole Opus call in Phase 3.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ArbiterInput, ArbiterVerdict, TreatmentPlan } from '../types/phase3.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const MODEL      = 'claude-opus-4-6';
const MAX_TOKENS = 1200;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior physiotherapy clinical arbiter evaluating two competing treatment plans.
Compare on 6 axes (priority order — higher axes override lower):

1. PAIN SAFETY — maxAcceptablePain at each phase vs NPRS baseline. Conservative passes this gate.
2. EVIDENCE STRENGTH — Grade A/B exercises preferred over C/D.
3. PATIENT TOLERANCE — loading strategy vs PHQ-4 score, age, fitness level, injury severity.
4. TISSUE HEALING TIMELINE — Acute (<3 wks): rest/gentle only. Subacute (3–12 wks): moderate. Chronic (>12 wks): progressive.
5. FUNCTIONAL GOALS — Which plan targets the patient's stated goal more directly?
6. CONTRAINDICATION COMPLIANCE — Any exercise matching active injury contraindications is rejected.

Decision rules:
- Any early_mob exercise overlapping contraindications → add to rejectedElements (risk: safety)
- PHQ-4 ≥ 6 → prefer conservative unless early_mob explicitly addresses psychological load
- urgencyLevel = urgent + early_mob phase 1 maxAcceptablePain > 5 → override phase 1 source to conservative
- hybrid: assign each phase independently to whichever plan scores higher on axes 1–3 for that phase
- confidenceScore 0–1: 1.0 = decisive winner, 0.5 = evenly matched

Output ONLY valid JSON — no preamble, no trailing text:
{
  "winner": "conservative|early_mob|hybrid",
  "hybridRationale": "string — null if not hybrid",
  "phaseSource": [
    { "phaseNumber": 1, "source": "conservative|early_mob|modified", "modification": "optional string" }
  ],
  "rejectedElements": [
    { "fromPlan": "conservative|early_mob", "element": "exercise or element name", "reason": "string", "risk": "safety|evidence|patient_fit" }
  ],
  "safetyOverrides": ["string — each safety gate triggered"],
  "arbitrationReason": "string — 2–3 sentences citing axis scores",
  "confidenceScore": 0.85
}`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function summarisePlan(plan: TreatmentPlan): string {
  const phases = plan.phases.map(p => {
    const exNames = p.exercises.map(e => e.name).join(', ');
    return (
      `  Phase ${p.phaseNumber} (${p.label}, ${p.durationWeeks}w): ` +
      `strategy=${p.loadingStrategy}, maxPain=${p.maxAcceptablePain}/10, ` +
      `freq=${p.sessionFrequency}×/wk, dur=${p.sessionDurationMin}min\n` +
      `    Exercises: ${exNames || 'none'}\n` +
      `    Advance when: ${p.progressionTrigger}\n` +
      `    Regress when: ${p.regressionTrigger}`
    );
  }).join('\n');

  const evidence = plan.evidenceBasis.slice(0, 3).join('; ');
  const contra   = plan.contraindications.join(', ') || 'none listed';

  return `[${plan.agentId}]
Philosophy: ${plan.philosophy}
Duration: ${plan.totalDurationWeeks} weeks, ${plan.phases.length} phase(s)
Contraindications: ${contra}
Evidence: ${evidence}
${phases}`;
}

function buildPrompt(input: ArbiterInput): string {
  const injuries = input.userProfile.activeInjuries
    .map(i => `${i.bodyPart} ${i.type} (severity ${i.severity}/10)`)
    .join(', ') || 'none';

  const conditions = input.userProfile.conditions.map(c => c.name).join(', ') || 'none';
  const meds       = input.userProfile.medications.map(m => m.name).join(', ') || 'none';

  return `PATIENT PROFILE
Age: ${input.userProfile.ageYears} | Sex: ${input.userProfile.sex} | Goal: ${input.userProfile.primaryGoal}
Active injuries: ${injuries}
Conditions: ${conditions}
Medications: ${meds}
Urgency: ${input.urgencyLevel}

CONSERVATIVE PLAN
${summarisePlan(input.conservative)}

EARLY MOBILISATION PLAN
${summarisePlan(input.earlyMob)}

Arbitrate on the 6 axes. Return the verdict JSON.`;
}

function conservativeFallback(input: ArbiterInput, ms: number, reason: string): ArbiterVerdict {
  return {
    winner:           'conservative',
    hybridRationale:  null,
    phaseSource:      input.conservative.phases.map(p => ({
      phaseNumber: p.phaseNumber,
      source:      'conservative' as const,
    })),
    rejectedElements: [],
    safetyOverrides:  [reason],
    arbitrationReason: reason,
    confidenceScore:  0.5,
    processingMs:     ms,
  };
}

function parseVerdict(raw: string, input: ArbiterInput, ms: number): ArbiterVerdict {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON block');

    const p = JSON.parse(m[0]) as Record<string, unknown>;

    const winner = p['winner'];
    if (winner !== 'conservative' && winner !== 'early_mob' && winner !== 'hybrid') {
      throw new Error(`invalid winner: ${String(winner)}`);
    }

    const defaultPhaseSource = (
      winner === 'early_mob' ? input.earlyMob : input.conservative
    ).phases.map(ph => ({ phaseNumber: ph.phaseNumber, source: winner === 'early_mob' ? 'early_mob' as const : 'conservative' as const }));

    return {
      winner,
      hybridRationale:   typeof p['hybridRationale'] === 'string' ? p['hybridRationale'] : null,
      phaseSource:        Array.isArray(p['phaseSource'])    ? (p['phaseSource'] as ArbiterVerdict['phaseSource'])    : defaultPhaseSource,
      rejectedElements:   Array.isArray(p['rejectedElements']) ? (p['rejectedElements'] as ArbiterVerdict['rejectedElements']) : [],
      safetyOverrides:    Array.isArray(p['safetyOverrides'])  ? (p['safetyOverrides'] as string[]) : [],
      arbitrationReason:  typeof p['arbitrationReason'] === 'string' ? p['arbitrationReason'] : '',
      confidenceScore:    typeof p['confidenceScore'] === 'number'
        ? Math.min(1, Math.max(0, p['confidenceScore']))
        : 0.7,
      processingMs:       ms,
    };
  } catch {
    return conservativeFallback(input, ms, 'Arbiter parse failure — defaulted to conservative (safety-first).');
  }
}

// ── Pre-flight safety checks (deterministic, no LLM) ─────────────────────────

function preflightCheck(input: ArbiterInput): string | null {
  // Emergency urgency → skip Opus, return conservative immediately
  if (input.urgencyLevel === 'emergency') {
    return 'Emergency urgency level — conservative plan mandatory without AI arbitration.';
  }

  // Severe active injury (severity ≥ 9) → conservative
  const criticalInjury = input.userProfile.activeInjuries.find(i => i.severity >= 9);
  if (criticalInjury) {
    return `Critical injury severity (${criticalInjury.bodyPart} ${criticalInjury.type}, ${criticalInjury.severity}/10) — conservative plan selected without arbitration.`;
  }

  return null; // proceed to LLM
}

// ── Agent class ────────────────────────────────────────────────────────────────

export class TreatmentArbiterAgent {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: ArbiterInput): Promise<ArbiterVerdict> {
    const t0 = Date.now();

    // Deterministic safety gate — skip LLM if needed
    const preflightReason = preflightCheck(input);
    if (preflightReason) {
      return conservativeFallback(input, Date.now() - t0, preflightReason);
    }

    const message = await this.client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: buildPrompt(input) }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return parseVerdict(raw, input, Date.now() - t0);
  }
}
