/**
 * treatmentArbiterAgent.ts — Phase 3 Treatment Arbiter (Opus)
 *
 * 3-round structured debate between ConservativeProtocol and EarlyMobProtocol.
 *   Round 1 — Conservative advocate argues its protocol.
 *   Round 2 — EarlyMob advocate rebuts + argues its protocol.
 *   Round 3 — Opus arbiter synthesises → winner OR blend.
 *
 * ONLY Phase 3 agent using claude-opus-4-6.
 * Safety gate: checks consensusReport.referralFlags BEFORE returning verdict.
 * If call_999 flag OR emergency referral → winner forced to 'conservative'.
 *
 * SaMD Class II — all output is decision support only, never autonomous clinical action.
 * DO NOT modify safetyRules.ts or any Phase 2 agent.
 *
 * Model: claude-opus-4-6  |  Max tokens: 600 (rounds 1–2), 800 (round 3)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ConservativeProtocol }  from './conservativeAgent.js';
import type { EarlyMobProtocol }      from './earlyMobAgent.js';
import type { PlanningInput }         from '../types/phase3.js';
import type { EvidenceCitation }      from './conservativeAgent.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArbiterWinner    = 'conservative' | 'early_mob' | 'blended';
export type Phase3EvidGrade  = 'A' | 'B' | 'C' | 'D';

export interface Phase3ArbiterInput {
  conservative:   ConservativeProtocol;
  earlyMob:       EarlyMobProtocol;
  patientContext: PlanningInput;
}

export interface Phase3ArbiterVerdict {
  agentId:          'treatment-arbiter-phase3';
  version:          '1.0.0';
  patientId:        string;
  assessmentId:     string;
  generatedAt:      string;

  winner:           ArbiterWinner;
  confidence:       number;                        // 0–1
  primaryProtocol:  'conservative' | 'early_mob'; // base protocol; blend = winner + modifications
  modifications:    string[];                      // elements cherry-picked from losing protocol
  clinicalRationale: string;                       // Opus synthesis reasoning (2–4 sentences)
  contraindications: string[];                     // unified from both protocols + safety gate
  reviewTriggers:   string[];                      // conditions that must trigger reassessment
  evidenceGrade:    Phase3EvidGrade;

  // Debate transcript (for audit trail)
  debateTranscript: {
    round1ConservativeArgument: string;
    round2EarlyMobRebuttal:     string;
    round3SynthesisRaw:         string;
  };

  safetyOverride:         boolean;   // true if safety gate forced winner → conservative
  safetyOverrideReasons:  string[];
  evidenceCitations:      EvidenceCitation[];
  processingMs:           number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL            = 'claude-opus-4-6';
const TOKENS_ROUND_1_2 = 600;
const TOKENS_ROUND_3   = 800;

// ── Safety gate ───────────────────────────────────────────────────────────────

interface SafetyCheck { forceConservative: boolean; reasons: string[] }

function runSafetyGate(input: Phase3ArbiterInput): SafetyCheck {
  const { earlyMob, patientContext } = input;
  const reasons: string[] = [];

  // 1. Emergency referral flags in consensus report
  for (const flag of patientContext.consensusReport.referralFlags) {
    if (flag.emergencyLevel === 'call_999') {
      reasons.push(`Emergency flag: ${flag.type} — ${flag.description}`);
    }
  }

  // 2. Emergency referral urgency from consensus
  if (patientContext.consensusReport.referralUrgency === 'emergency') {
    reasons.push('Consensus report: emergency referral urgency — conservative protocol mandatory');
  }

  // 3. Early mob contraindications matched against patient conditions/injuries
  const conditionNames = patientContext.userProfile.conditions.map(c => c.name.toLowerCase());
  const injuryParts    = patientContext.userProfile.activeInjuries.map(i => i.bodyPart.toLowerCase());

  for (const contra of earlyMob.contraindicationsToEarlyMob) {
    const lc = contra.toLowerCase();
    const matched = conditionNames.some(c => lc.includes(c) || c.includes(lc.slice(0, 8)))
      || injuryParts.some(i => lc.includes(i));
    if (matched) {
      reasons.push(`EarlyMob contraindication present: ${contra}`);
    }
  }

  // 4. High pain + early mob's fear category is low (patient may not actually be fear-avoidant)
  //    No safety override needed — this is a weighting concern, not a red flag.

  return { forceConservative: reasons.length > 0, reasons };
}

// ── System prompts (per round) ────────────────────────────────────────────────

const SYSTEM_CONSERVATIVE_ADVOCATE = `You are a conservative physiotherapy specialist defending a conservative treatment protocol in a clinical debate.
Your role: make the strongest evidence-based case for the conservative approach.
Be concise (≤5 sentences). Cite at least one specific evidence point from the protocol.
Acknowledge the patient's pain level and fear-avoidance profile.
SaMD Class II context — patient safety is paramount.`;

const SYSTEM_EARLYMOB_ADVOCATE = `You are an early mobilisation and pain psychology specialist defending a graded exposure protocol in a clinical debate.
Your role: rebut the conservative argument then make the strongest evidence-based case for early mobilisation.
Be concise (≤6 sentences). Cite Vlaeyen 2000, Moseley 2003, or George 2011 specifically.
Acknowledge where the conservative approach has merit.
SaMD Class II context — graded exposure must not exceed safe SUDS levels.`;

const SYSTEM_ARBITER = `You are a senior physiotherapy clinical arbiter synthesising a 3-round treatment debate.
You have read arguments from both conservative and early-mobilisation advocates.

Arbitration axes (priority order, higher overrides lower):
1. SAFETY — red flags present → conservative mandatory.
2. FEAR-AVOIDANCE — TSK proxy ≥37 (moderate/high) → early_mob OR blended preferred.
3. TISSUE STAGE — acute (<3 wks): conservative; subacute (3–12 wks): either; chronic (>12 wks): early_mob.
4. EVIDENCE GRADE — prefer Grade A/B protocols.
5. PATIENT GOALS — which protocol addresses stated goal more directly?
6. CONTRAINDICATIONS — reject any element conflicting with active injury/conditions.

Output ONLY valid JSON:
{
  "winner": "conservative|early_mob|blended",
  "confidence": 0.82,
  "primaryProtocol": "conservative|early_mob",
  "modifications": ["element from losing protocol to incorporate — string per item, max 5"],
  "clinicalRationale": "2–4 sentences citing axis scores and key deciding factors",
  "contraindications": ["unified list from both protocols — strings"],
  "reviewTriggers": ["measurable conditions requiring protocol reassessment — strings"],
  "evidenceGrade": "A|B|C|D"
}`;

// ── Prompt builders ───────────────────────────────────────────────────────────

function round1Prompt(conservative: ConservativeProtocol, patient: PlanningInput): string {
  const dx    = patient.consensusReport.primaryDiagnosis?.name ?? 'unspecified diagnosis';
  const nprs  = patient.currentPainLevel ?? 'unknown';
  const tsk   = '(not yet profiled — assume moderate)';
  const phase1 = conservative.expectedTimeline;

  return `PATIENT: ${patient.userProfile.ageYears}y ${patient.userProfile.sex}, NPRS ${nprs}/10, fear-avoidance ${tsk}.
Diagnosis: ${dx}.
McKenzie syndrome: ${conservative.mckenzieClassification.syndrome} — preferred direction: ${conservative.mckenzieClassification.preferredMovementDirection ?? 'none'}.
Protocol timeline: ${phase1.acuteWeeks}w acute + ${phase1.subacuteWeeks}w subacute + ${phase1.rehabilitationWeeks}w rehab = ${phase1.totalWeeks}w total.
Manual therapy grades: ${conservative.manualTherapy.map(t => `${t.name} (Grade ${t.maitlandGrade})`).join(', ') || 'none'}.
Top McKenzie exercises: ${conservative.mckenzieExercises.slice(0, 2).map(e => e.name).join(', ') || 'none'}.

You are the CONSERVATIVE ADVOCATE. Argue why this protocol is optimal for this patient.`;
}

function round2Prompt(
  earlyMob: EarlyMobProtocol,
  round1Response: string,
  patient: PlanningInput,
): string {
  const tskCat = earlyMob.fearAvoidanceProfile.fearAvoidanceCategory;
  const tskVal = earlyMob.fearAvoidanceProfile.tskScoreProxy;
  const ladder = earlyMob.fearLadder.slice(0, 2).map(s => `Step ${s.step}: "${s.activity}" (SUDS ${s.fearRating})`).join('; ');
  const pne    = earlyMob.painNeuroscienceEducation.slice(0, 1).map(p => p.concept).join('');

  return `CONSERVATIVE ADVOCATE ARGUED:
"${round1Response.slice(0, 400)}"

PATIENT CONTEXT:
Fear-Avoidance: ${tskCat} (TSK proxy ${tskVal}/68).
Fear ladder (low end): ${ladder || 'not defined'}.
PNE concept: "${pne}".
PHQ-4: ${patient.phq4Score ?? 'not assessed'}/12.

You are the EARLY MOB ADVOCATE. First rebut the conservative argument, then argue why graded exposure / early mobilisation is superior for this patient.`;
}

function round3Prompt(round1: string, round2: string, conservative: ConservativeProtocol, earlyMob: EarlyMobProtocol): string {
  const cContra = conservative.manualTherapy.flatMap(t => t.absoluteContra).slice(0, 3).join('; ');
  const eContra = earlyMob.contraindicationsToEarlyMob.slice(0, 3).join('; ');

  return `ROUND 1 — CONSERVATIVE ADVOCATE:
"${round1.slice(0, 350)}"

ROUND 2 — EARLY MOB ADVOCATE:
"${round2.slice(0, 400)}"

PROTOCOL CONTRAINDICATIONS:
Conservative absolute: ${cContra || 'none stated'}
EarlyMob contraindications: ${eContra || 'none stated'}

Conservative evidence basis: ${conservative.evidenceCitations.slice(0, 2).map(c => c.citation).join('; ')}
EarlyMob evidence basis: ${earlyMob.evidenceCitations.slice(0, 2).map(c => c.citation).join('; ')}

You are the SENIOR ARBITER. Synthesise both arguments and return your verdict as JSON.`;
}

// ── Response parser ───────────────────────────────────────────────────────────

interface SynthesisJSON {
  winner:            ArbiterWinner;
  confidence:        number;
  primaryProtocol:   'conservative' | 'early_mob';
  modifications:     string[];
  clinicalRationale: string;
  contraindications: string[];
  reviewTriggers:    string[];
  evidenceGrade:     Phase3EvidGrade;
}

function parseSynthesis(raw: string): SynthesisJSON {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('TreatmentArbiterAgent: no JSON in round 3 response');
  return JSON.parse(match[0]) as SynthesisJSON;
}

function buildCitations(conservative: ConservativeProtocol, earlyMob: EarlyMobProtocol): EvidenceCitation[] {
  const seen = new Set<string>();
  const out: EvidenceCitation[] = [];
  for (const c of [...conservative.evidenceCitations, ...earlyMob.evidenceCitations]) {
    if (!seen.has(c.citation)) { seen.add(c.citation); out.push(c); }
  }
  return out.slice(0, 8);
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export class TreatmentArbiterPhase3Agent {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: Phase3ArbiterInput): Promise<Phase3ArbiterVerdict> {
    const t0 = Date.now();
    const { conservative, earlyMob, patientContext } = input;

    // ── Safety gate (deterministic, before any LLM call) ──────────────────
    const safety = runSafetyGate(input);

    // ── Round 1: Conservative advocate ────────────────────────────────────
    const r1Msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: TOKENS_ROUND_1_2,
      system:     SYSTEM_CONSERVATIVE_ADVOCATE,
      messages:   [{ role: 'user', content: round1Prompt(conservative, patientContext) }],
    });
    const round1 = r1Msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('');

    // ── Round 2: EarlyMob advocate rebuttal ───────────────────────────────
    const r2Msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: TOKENS_ROUND_1_2,
      system:     SYSTEM_EARLYMOB_ADVOCATE,
      messages:   [{ role: 'user', content: round2Prompt(earlyMob, round1, patientContext) }],
    });
    const round2 = r2Msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('');

    // ── Round 3: Opus synthesis ────────────────────────────────────────────
    const r3Msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: TOKENS_ROUND_3,
      system:     SYSTEM_ARBITER,
      messages:   [{ role: 'user', content: round3Prompt(round1, round2, conservative, earlyMob) }],
    });
    const round3Raw = r3Msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('');

    // ── Parse synthesis ────────────────────────────────────────────────────
    let synthesis: SynthesisJSON;
    try {
      synthesis = parseSynthesis(round3Raw);
    } catch {
      // Parse failure → conservative (safety-first)
      synthesis = {
        winner: 'conservative', confidence: 0.5, primaryProtocol: 'conservative',
        modifications: [], clinicalRationale: 'Parse failure — defaulted to conservative per safety-first rule.',
        contraindications: conservative.redFlags, reviewTriggers: ['Re-run arbiter after correcting protocol data.'],
        evidenceGrade: 'C',
      };
    }

    // ── Apply safety override ──────────────────────────────────────────────
    const safetyOverride = safety.forceConservative;
    if (safetyOverride) {
      synthesis.winner          = 'conservative';
      synthesis.primaryProtocol = 'conservative';
      synthesis.confidence      = 1.0;
      synthesis.clinicalRationale = `Safety gate triggered — conservative protocol mandatory. ${synthesis.clinicalRationale}`;
    }

    // ── Merge contraindications ────────────────────────────────────────────
    const contraSet = new Set([
      ...conservative.redFlags,
      ...earlyMob.redFlags,
      ...earlyMob.contraindicationsToEarlyMob,
      ...(synthesis.contraindications ?? []),
      ...safety.reasons,
    ]);

    return {
      agentId:           'treatment-arbiter-phase3',
      version:           '1.0.0',
      patientId:         patientContext.patientId,
      assessmentId:      patientContext.assessmentId,
      generatedAt:       new Date().toISOString(),

      winner:            synthesis.winner,
      confidence:        synthesis.confidence ?? 0.5,
      primaryProtocol:   synthesis.primaryProtocol ?? 'conservative',
      modifications:     synthesis.modifications   ?? [],
      clinicalRationale: synthesis.clinicalRationale,
      contraindications: [...contraSet].slice(0, 12),
      reviewTriggers:    synthesis.reviewTriggers ?? [],
      evidenceGrade:     synthesis.evidenceGrade  ?? 'B',

      debateTranscript: {
        round1ConservativeArgument: round1,
        round2EarlyMobRebuttal:     round2,
        round3SynthesisRaw:         round3Raw,
      },

      safetyOverride,
      safetyOverrideReasons:  safety.reasons,
      evidenceCitations:      buildCitations(conservative, earlyMob),
      processingMs:           Date.now() - t0,
    };
  }
}
