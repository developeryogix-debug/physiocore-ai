/**
 * assessmentClient.ts
 * Browser-safe clinical assessment client.
 * Consolidates posture, session, pain and functional context into a
 * single Claude Sonnet call with MiroFish adversarial reasoning baked
 * into the system prompt. Mirrors the Phase 2 Assessment Swarm logic
 * for execution in the browser environment.
 *
 * Evidence base: PHASE2_ASSESSMENT_SWARM.md, Kendall et al. Muscles
 * Testing and Function, 5th Ed., APA Red Flags Guidelines 2021.
 */

import { callClaude, extractJson } from './anthropicClient.js';

// ─── Context passed in from the Assessment page ───────────────────────────────

export interface DataContext {
  hasPosture:    boolean;
  hasSessions:   boolean;
  hasPain:       boolean;
  hasFunctional: boolean;
  hasGait:       boolean;
  postureScore?:     number;    // 0-100
  sessionCount?:     number;
  lastPostureDate?:  string;
  lastSessionDate?:  string;
  lastPainDate?:     string;
  lastFunctionalDate?: string;
  painScore?:        number;    // NPRS 0-10
  postureFindings?:  string;    // JSON string from posture_assessments
  conditions?:       string[];  // from user profile
  ageYears?:         number;
  gender?:           string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AssessmentFinding {
  text:          string;
  evidenceGrade: 'A' | 'B' | 'C' | 'D';
}

export interface TreatmentPriority {
  exercise: string;
  sets:     string;
  focus:    string;
}

export interface AssessmentOutput {
  overallScore:          number;           // 0-100
  safetyAlerts:          string[];         // red-flag messages
  findings:              AssessmentFinding[];  // max 5 clinical findings
  treatmentPriorities:   TreatmentPriority[]; // exactly 3
  patientSummary:        string;           // plain-English for patient
  clinicianSoap:         string;           // SOAP note for clinician tab
  differentialDiagnoses: string[];
  referralRecommended:   boolean;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical physiotherapy AI running a Phase 2 Assessment Swarm.
You receive a summary of available patient data and must produce a comprehensive clinical report.

PHASE 1 — Safety gate: Before any recommendation, check for red flags:
- Unexplained weight loss, night pain, systemic symptoms → possible malignancy
- Bilateral symptoms, saddle anaesthesia, bladder/bowel dysfunction → cauda equina
- Post-trauma with bony tenderness → possible fracture
- Rapidly worsening neurological deficit → urgent imaging
- Cardiovascular symptoms during exercise → cardiac referral
If ANY red flag is present: populate safetyAlerts and set referralRecommended = true.

PHASE 2 — Biomechanical analysis: Use available posture, session, and pain data to derive:
- Postural alignment deviations (Grade B evidence — Kendall et al.)
- Movement pattern quality from session history
- Pain behaviour and pattern classification

PHASE 3 — Adversarial review: Challenge your own findings. Ask:
- Could this be non-musculoskeletal? Is the data sufficient to rule out serious pathology?
- Is the proposed treatment appropriate for the patient's conditions?

PHASE 4 — Consensus: Synthesise to an overall score and ranked differential.

Evidence grades:
- Grade A: systematic review or RCT
- Grade B: controlled study, no randomisation
- Grade C: case series or expert opinion
- Grade D: insufficient evidence

Output ONLY valid JSON — no preamble, no markdown fences:
{
  "overallScore": number (0-100),
  "safetyAlerts": ["string — each is one red-flag sentence"],
  "findings": [
    { "text": "string", "evidenceGrade": "A"|"B"|"C"|"D" }
  ],
  "treatmentPriorities": [
    { "exercise": "string", "sets": "e.g. 3×12", "focus": "string — 1 sentence cue" }
  ],
  "patientSummary": "string — plain English, 2–3 sentences for patient",
  "clinicianSoap": "string — SOAP note format, 4 paragraphs labelled S/O/A/P",
  "differentialDiagnoses": ["string — ranked from most to least likely, include ICD-10"],
  "referralRecommended": boolean
}

Rules:
- findings: max 5 items, most clinically significant first
- treatmentPriorities: exactly 3 items
- overallScore: 100 = perfect alignment + no pain + full function; deduct for each deviation
- If data is insufficient, say so explicitly in patientSummary and base score on what is available`;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runFullAssessment(ctx: DataContext): Promise<AssessmentOutput> {
  const lines: string[] = [];

  if (ctx.ageYears)  lines.push(`Patient age: ${ctx.ageYears} years`);
  if (ctx.gender)    lines.push(`Gender: ${ctx.gender}`);
  if (ctx.conditions?.length) lines.push(`Known conditions: ${ctx.conditions.join(', ')}`);

  lines.push('');
  lines.push('Available data sources:');

  if (ctx.hasPosture) {
    lines.push(`✅ Posture assessment (${ctx.lastPostureDate ?? 'date unknown'})`);
    if (ctx.postureScore != null) lines.push(`   Overall posture score: ${ctx.postureScore}/100`);
    if (ctx.postureFindings) {
      try {
        const pf = JSON.parse(ctx.postureFindings) as { findings?: Array<{ name: string; severity: string }> };
        if (Array.isArray(pf.findings)) {
          lines.push(`   Findings: ${pf.findings.map(f => `${f.name} (${f.severity})`).join('; ')}`);
        }
      } catch { /* use raw */ }
    }
  } else {
    lines.push('⬜ Posture assessment — not completed');
  }

  if (ctx.hasSessions) {
    lines.push(`✅ Session history — ${ctx.sessionCount ?? 0} sessions (last: ${ctx.lastSessionDate ?? 'unknown'})`);
  } else {
    lines.push('⬜ Session history — no sessions recorded');
  }

  if (ctx.hasPain) {
    lines.push(`✅ Pain questionnaire (${ctx.lastPainDate ?? 'date unknown'})`);
    if (ctx.painScore != null) lines.push(`   NPRS score: ${ctx.painScore}/10`);
  } else {
    lines.push('⬜ Pain data — not recorded');
  }

  if (ctx.hasFunctional) {
    lines.push(`✅ Functional outcomes (${ctx.lastFunctionalDate ?? 'date unknown'})`);
  } else {
    lines.push('⬜ Functional assessment — not completed');
  }

  if (ctx.hasGait) {
    lines.push('✅ Gait data available');
  } else {
    lines.push('⬜ Walking analysis — not performed');
  }

  const userMsg = [
    'Run a full Phase 2 clinical assessment swarm on this patient.',
    '',
    ...lines,
    '',
    'Generate the complete assessment JSON report.',
  ].join('\n');

  const raw = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 2000,
  });

  const parsed = extractJson(raw) as Partial<AssessmentOutput>;

  return {
    overallScore:          typeof parsed.overallScore === 'number' ? parsed.overallScore : 50,
    safetyAlerts:          Array.isArray(parsed.safetyAlerts)   ? parsed.safetyAlerts   : [],
    findings:              Array.isArray(parsed.findings)        ? parsed.findings        : [],
    treatmentPriorities:   Array.isArray(parsed.treatmentPriorities) ? parsed.treatmentPriorities : [],
    patientSummary:        typeof parsed.patientSummary === 'string' ? parsed.patientSummary : '',
    clinicianSoap:         typeof parsed.clinicianSoap === 'string'  ? parsed.clinicianSoap  : '',
    differentialDiagnoses: Array.isArray(parsed.differentialDiagnoses) ? parsed.differentialDiagnoses : [],
    referralRecommended:   typeof parsed.referralRecommended === 'boolean' ? parsed.referralRecommended : false,
  };
}

// ─── Gait analysis (browser-safe, Claude Sonnet via fetch) ───────────────────

export interface GaitMetricsSummary {
  cadence:        number;
  stepSymmetry:   number;
  trunkSway:      'normal'|'mild'|'moderate'|'severe';
  armSwing:       'symmetrical'|'reduced_right'|'reduced_left'|'absent';
  trendelenburg:  'absent'|'positive_left'|'positive_right';
  heelStrike:     'normal'|'flat_foot'|'toe_strike'|'antalgic';
  antalgic:       boolean;
  antalgicSide:   'left'|'right'|null;
  dataQuality:    'good'|'acceptable'|'poor'|'insufficient';
  framesAnalysed: number;
}

export interface GaitFlag {
  name: string; phase: string; severity: string; likelyCause: string;
}
export interface GaitReferralFlag {
  type: string; description: string; immediateAction: string; emergencyLevel: string;
}
export interface GaitAnalysisOutput {
  flags:           string[];
  gaitDeviations:  GaitFlag[];
  referralFlags:   GaitReferralFlag[];
  clinicalSummary: string;
}

export async function runGaitAnalysis(m: GaitMetricsSummary): Promise<GaitAnalysisOutput> {
  const key = (import.meta.env as Record<string,string|undefined>)['VITE_ANTHROPIC_KEY'] ?? '';
  const prompt =
`You are a clinical physiotherapist interpreting observational gait analysis.
Evidence basis: Krebs DE et al. Phys Ther. 1985;65(7):1027-1033 (Grade B).

METRICS:
- Cadence: ${m.cadence.toFixed(1)} steps/min (normal 90–130)
- Step symmetry: ${m.stepSymmetry.toFixed(1)}% (100=perfect; normal ≥90%)
- Trunk sway: ${m.trunkSway}
- Arm swing: ${m.armSwing}
- Trendelenburg: ${m.trendelenburg}
- Heel strike: ${m.heelStrike}
- Antalgic gait: ${m.antalgic ? `YES — ${m.antalgicSide} side` : 'NO'}
- Data quality: ${m.dataQuality} (${m.framesAnalysed} frames)

Return ONLY valid JSON:
{"flags":["string"],"gaitDeviations":[{"name":"string","phase":"stance|swing|overall","severity":"mild|moderate|severe","likelyCause":"string"}],"referralFlags":[{"type":"string","description":"string","immediateAction":"string","emergencyLevel":"monitor|urgent_referral|call_999"}],"clinicalSummary":"2–3 sentences max"}
Rules: flag referral only for positive Trendelenburg, cadence <60, severe antalgic, or neurological pattern. Poor/insufficient data → state in summary, keep flags minimal.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key':key, 'anthropic-version':'2023-06-01', 'content-type':'application/json', 'anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:600, messages:[{role:'user',content:prompt}] }),
    });
    const j = await resp.json() as { content?:{type:string;text:string}[] };
    const txt = j.content?.[0]?.text ?? '{}';
    const p = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Partial<GaitAnalysisOutput>;
    return {
      flags:          Array.isArray(p.flags)          ? p.flags          : [],
      gaitDeviations: Array.isArray(p.gaitDeviations) ? p.gaitDeviations : [],
      referralFlags:  Array.isArray(p.referralFlags)  ? p.referralFlags  : [],
      clinicalSummary: typeof p.clinicalSummary === 'string' ? p.clinicalSummary : 'Gait analysis complete.',
    };
  } catch {
    return { flags:[], gaitDeviations:[], referralFlags:[], clinicalSummary:'Gait analysis complete. Manual review recommended.' };
  }
}
