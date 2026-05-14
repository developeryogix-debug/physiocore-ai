/**
 * SpecialTestsAgent.ts
 * Phase 2 Assessment Swarm — orthopaedic special test guidance + interpretation.
 *
 * Phase A (selectTests):
 *   Reads jointDatabase for the requested joint, ranks tests by sensitivity
 *   (best screening value), computes likelihood ratios, generates SpeechSynthesis
 *   voice guides, and returns an ordered SelectedSpecialTest list.
 *
 * Phase B (interpretResults):
 *   Takes the clinician's completed test results, runs a Claude Sonnet call with
 *   Bayesian LR reasoning, and returns a SpecialTestsReport with differential
 *   diagnoses, post-test probabilities, and a referral recommendation.
 *
 * Evidence base:
 *   Sensitivity/specificity values sourced from jointDatabase (Hegedus et al. 2008,
 *   Benjaminse et al. 2006, Deville et al. 2000, and per-test primary citations).
 *   Likelihood ratios: Deeks JJ. BMJ. 2004;329(7466):659-660.
 *
 * Model: claude-sonnet-4-20250514 (Phase B interpretation only).
 */

import Anthropic from '@anthropic-ai/sdk';
import { jointDatabase } from '@physiocore/clinical';
import type { SpecialTest, RedFlagDetail } from '@physiocore/clinical';
import type {
  CompletedTest,
  SelectedSpecialTest,
  LikelyDiagnosis,
  SpecialTestsReport,
  EvidenceGrade,
  RedFlagAlert,
} from '../types/findings.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL         = 'claude-sonnet-4-20250514';
const MAX_TOKENS    = 1500;
const DEFAULT_TOP_N = 5;

/** LR thresholds for priority classification (Deeks JJ. BMJ. 2004). */
const LR_HIGH   = 5;   // positiveLR ≥ 5  → "high" — moderately strong evidence
const LR_MEDIUM = 2;   // positiveLR ≥ 2  → "medium" — weak-moderate evidence
// positiveLR < 2 → "low"

// Abbreviation expansions for SpeechSynthesis-friendly text
const ABBR: [RegExp, string][] = [
  [/°/g,             ' degrees'],
  [/\bER\b/g,        'external rotation'],
  [/\bIR\b/g,        'internal rotation'],
  [/\bACL\b/g,       'anterior cruciate ligament'],
  [/\bPCL\b/g,       'posterior cruciate ligament'],
  [/\bMCL\b/g,       'medial collateral ligament'],
  [/\bLCL\b/g,       'lateral collateral ligament'],
  [/\bSLAP\b/g,      'superior labral anterior to posterior lesion'],
  [/\bSI\b/g,        'sacroiliac'],
  [/\bMC&S\b/g,      'culture and sensitivity'],
  [/\bSLR\b/g,       'straight leg raise'],
  [/\bFABER\b/g,     'flexion abduction external rotation'],
  [/\bTUG\b/g,       'timed up and go'],
  [/\bABI\b/g,       'ankle-brachial index'],
  [/\bCRP\b/g,       'C-reactive protein'],
  [/\bESR\b/g,       'erythrocyte sedimentation rate'],
  [/\bVMO\b/g,       'vastus medialis oblique'],
  [/\bITB\b/g,       'iliotibial band'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert procedure text to SpeechSynthesis-friendly voice guide. */
function toVoiceGuide(testName: string, procedure: string): string {
  let text = procedure;
  for (const [pattern, replacement] of ABBR) {
    text = text.replace(pattern, replacement);
  }
  // Capitalise first word if it starts lower-case
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return `${testName}. ${text}`;
}

/**
 * Extract target pathology from procedure text.
 * Most procedures end with "= positive for X" or "= positive; X".
 */
function extractTargetPathology(procedure: string): string {
  const m = procedure.match(/=\s*positive\s+(?:for\s+)?([^;.]+)/i);
  if (m?.[1]) return m[1].trim();
  return 'suspected pathology — see procedure';
}

/** Compute priority from positiveLR. */
function priorityFromLR(positiveLR: number): 'high' | 'medium' | 'low' {
  if (positiveLR >= LR_HIGH)   return 'high';
  if (positiveLR >= LR_MEDIUM) return 'medium';
  return 'low';
}

/**
 * Build a SelectedSpecialTest from a raw SpecialTest + joint context.
 * Computes likelihood ratios and voice guide.
 */
function buildSelected(test: SpecialTest, joint: string): SelectedSpecialTest {
  const { sensitivity: sn, specificity: sp } = test;
  const positiveLR = round2(sn / Math.max(1 - sp, 0.001));
  const negativeLR = round2((1 - sn) / Math.max(sp, 0.001));
  return {
    testId:          test.name,
    testName:        test.name,
    joint,
    targetPathology: extractTargetPathology(test.procedure),
    sensitivity:     sn,
    specificity:     sp,
    positiveLR,
    negativeLR,
    voiceGuide:      toVoiceGuide(test.name, test.procedure),
    procedureText:   test.procedure,
    citation:        test.citation,
    ...(test.needsReview ? { needsReview: true as const } : {}),
    priority:        priorityFromLR(positiveLR),
  };
}

// ─── System prompt (Phase B) ──────────────────────────────────────────────────

const PHASE_B_SYSTEM = `You are a clinical physiotherapist expert in orthopaedic special test interpretation and Bayesian diagnostic reasoning.

You will receive a joint name, a list of orthopaedic special tests with results (positive/negative/unclear) and their published sensitivity, specificity, and pre-computed likelihood ratios.

Your task:
1. IDENTIFY all positive and unclear tests and state their pathological implication.
2. Apply Bayesian reasoning: use the positive and negative likelihood ratios to adjust probability for each suspected diagnosis.
   - Pre-test probability: estimate from the test cluster (30% if not evident from context).
   - Post-test probability (positive): Pre × LR+ / [Pre × LR+ + (1 – Pre)].
   - Post-test probability (negative): Pre × (1 – sn) / [Pre × (1 – sn) + (1 – Pre) × sp].
3. List all likely diagnoses from highest to lowest post-test probability.
4. State if specialist referral is recommended. Referral required if:
   - Post-test probability >70% for a serious structural pathology (complete ligament rupture, fracture, nerve compression), OR
   - Any equivocal results for potentially serious pathology, OR
   - Red flags present in the test results (locking, giving way, gross instability, neurovascular deficit).
5. Write a 3-sentence clinical summary suitable for documentation.

Rules:
- Use ICD-10-CM codes for every diagnosis.
- Express probability as: high (>70%), moderate (40–70%), low (<40%).
- Do not speculate beyond what the test results support.
- Classify evidence grade B (controlled studies, no randomisation) for standard special tests.

Output ONLY valid JSON — no preamble, no markdown:
{
  "findings": ["string — key finding statement"],
  "positiveTests": ["string — test name"],
  "likelyDiagnoses": [
    {
      "name": "string",
      "icd10": "string",
      "probability": "high|moderate|low",
      "postTestProbability": number,
      "supportingTests": ["string"],
      "opposingTests": ["string"]
    }
  ],
  "referralRecommended": boolean,
  "referralReason": "string or null",
  "clinicalSummary": "string — exactly 3 sentences"
}`;

// ─── SpecialTestsAgent ────────────────────────────────────────────────────────

export class SpecialTestsAgent {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  }

  // ── Phase A — Test Selection ───────────────────────────────────────────────

  /**
   * Selects the highest-yield special tests for a joint, sorted by sensitivity
   * (best screening value first). Returns a SpecialTestsReport with phase
   * 'selection' and a populated selectedTests array with voice guides.
   *
   * @param joint   — key matching jointDatabase (e.g. 'knee', 'shoulder')
   * @param topN    — number of tests to return (default 5)
   */
  selectTests(joint: string, topN: number = DEFAULT_TOP_N): SpecialTestsReport {
    const t0 = Date.now();

    const jointData = jointDatabase[joint];
    if (!jointData) {
      throw new Error(
        `Joint '${joint}' not found in jointDatabase. ` +
        `Available joints: ${Object.keys(jointDatabase).join(', ')}`,
      );
    }

    const sorted = [...jointData.specialTests]
      .sort((a, b) => b.sensitivity - a.sensitivity)  // highest sensitivity first
      .slice(0, topN);

    const selectedTests = sorted.map(t => buildSelected(t, joint));

    return {
      agentId:       'special-tests-agent',
      version:       '1.0.0',
      joint,
      phase:         'selection',
      selectedTests,
      evidenceGrade: 'B' as EvidenceGrade,
      processingMs:  Date.now() - t0,
    };
  }

  // ── Phase B — Result Interpretation ──────────────────────────────────────

  /**
   * Interprets a set of completed test results using Claude Sonnet with Bayesian
   * likelihood ratio reasoning. Returns the original report updated to phase
   * 'interpretation' with diagnoses, referral flag, and clinical summary.
   *
   * @param selectionReport  — the SpecialTestsReport from selectTests()
   * @param completedTests   — results recorded by the clinician
   */
  async interpretResults(
    selectionReport: SpecialTestsReport,
    completedTests: CompletedTest[],
  ): Promise<SpecialTestsReport> {
    const t0 = Date.now();

    if (completedTests.length === 0) {
      throw new Error('interpretResults: completedTests must not be empty');
    }

    // Build a structured test-results block for the prompt
    const testLines = completedTests.map(ct => {
      const matched = selectionReport.selectedTests.find(
        st => st.testId === ct.testId || st.testName === ct.testId,
      );
      if (!matched) {
        return `- ${ct.testId}: ${ct.result}${ct.notes ? ` (notes: ${ct.notes})` : ''} [sensitivity/specificity not pre-loaded]`;
      }
      return [
        `- ${matched.testName}:`,
        `  result=${ct.result}`,
        `  sensitivity=${matched.sensitivity} specificity=${matched.specificity}`,
        `  LR+=${matched.positiveLR} LR-=${matched.negativeLR}`,
        `  targetPathology="${matched.targetPathology}"`,
        ct.notes ? `  notes="${ct.notes}"` : '',
      ].filter(Boolean).join('\n');
    });

    const userMsg = [
      `Joint: ${selectionReport.joint}`,
      '',
      'Completed orthopaedic special tests:',
      testLines.join('\n'),
      '',
      'Interpret these results using Bayesian likelihood ratio reasoning and provide the JSON report.',
    ].join('\n');

    const response = await this.client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     PHASE_B_SYSTEM,
      messages:   [{ role: 'user', content: userMsg }],
    });

    const raw = response.content.find(b => b.type === 'text')?.text ?? '';
    const parsed = this.parsePhaseB(raw);

    // Derive referral flags from any red flags in the joint database
    const referralFlags = this.deriveReferralFlags(selectionReport.joint, parsed.referralRecommended);

    return {
      ...selectionReport,
      phase:               'interpretation',
      findings:            parsed.findings,
      positiveTests:       parsed.positiveTests,
      likelyDiagnoses:     parsed.likelyDiagnoses,
      referralRecommended: parsed.referralRecommended,
      referralReason:      parsed.referralReason,
      clinicalSummary:     parsed.clinicalSummary,
      evidenceGrade:       'B' as EvidenceGrade,
      processingMs:        selectionReport.processingMs + (Date.now() - t0),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private parsePhaseB(raw: string): {
    findings:            string[];
    positiveTests:       string[];
    likelyDiagnoses:     LikelyDiagnosis[];
    referralRecommended: boolean;
    referralReason:      string | null;
    clinicalSummary:     string;
  } {
    // Strip markdown fences if present
    const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd   = cleaned.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`SpecialTestsAgent Phase B: no JSON found in response.\nRaw: ${raw.slice(0, 300)}`);
    }
    const obj = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as {
      findings?:            unknown;
      positiveTests?:       unknown;
      likelyDiagnoses?:     unknown;
      referralRecommended?: unknown;
      referralReason?:      unknown;
      clinicalSummary?:     unknown;
    };

    return {
      findings:            Array.isArray(obj.findings)        ? (obj.findings as string[])        : [],
      positiveTests:       Array.isArray(obj.positiveTests)   ? (obj.positiveTests as string[])   : [],
      likelyDiagnoses:     Array.isArray(obj.likelyDiagnoses) ? (obj.likelyDiagnoses as LikelyDiagnosis[]) : [],
      referralRecommended: typeof obj.referralRecommended === 'boolean' ? obj.referralRecommended : false,
      referralReason:      typeof obj.referralReason === 'string' ? obj.referralReason : null,
      clinicalSummary:     typeof obj.clinicalSummary === 'string' ? obj.clinicalSummary : '',
    };
  }

  /** Map any red-flag conditions from the joint database to RedFlagAlert format. */
  private deriveReferralFlags(joint: string, referralRecommended: boolean): RedFlagAlert[] {
    if (!referralRecommended) return [];
    const jointData = jointDatabase[joint];
    if (!jointData) return [];
    return jointData.redFlags.map((rf: RedFlagDetail) => ({
      type:           rf.type,
      description:    rf.description,
      immediateAction: rf.immediateAction,
      emergencyLevel: (rf.immediateAction.startsWith('EMERGENCY') ? 'call_999'
        : rf.immediateAction.startsWith('URGENT')              ? 'urgent_referral'
        : 'monitor') as RedFlagAlert['emergencyLevel'],
    }));
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────

/** Create and return a new SpecialTestsAgent instance. */
export function createSpecialTestsAgent(): SpecialTestsAgent {
  return new SpecialTestsAgent();
}
