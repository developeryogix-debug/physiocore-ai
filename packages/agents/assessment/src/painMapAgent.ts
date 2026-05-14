// packages/agents/assessment/src/painMapAgent.ts
// PhysioCore AI — PainMapAgent v1
// Phase 2 Assessment Swarm
// Citation: Melzack R. Pain. 1975;1(3):277-299 (McGill Pain Questionnaire)
// Citation: Hawker GA et al. Arthritis Care Res. 2011;63(S11):S240-S252
// SaMD Class II — do not modify pain thresholds without clinical review

import Anthropic from '@anthropic-ai/sdk';

// ── Types ─────────────────────────────────────────────────────

export type PainQuality =
  | 'sharp' | 'dull' | 'burning' | 'aching' | 'throbbing'
  | 'stabbing' | 'cramping' | 'shooting' | 'tingling' | 'numbness';

export type PainBehaviour =
  | 'constant' | 'intermittent' | 'on_movement' | 'at_rest'
  | 'worse_morning' | 'worse_evening' | 'worse_activity' | 'better_rest'
  | 'better_heat' | 'better_cold';

export interface PainRegion {
  id: string;                     // e.g. 'lumbar_right', 'knee_left'
  label: string;                  // human label
  bodyPart: string;               // ICD-10 body region
  side: 'left' | 'right' | 'bilateral' | 'central';
  nprs: number;                   // 0-10 Numeric Pain Rating Scale
  qualities: PainQuality[];
  behaviours: PainBehaviour[];
  onsetWeeks: number;             // 0 = acute (<6wks), >12 = chronic
  radiates: boolean;
  radiatesToRegion?: string;
}

export interface PainMapInput {
  userId: string;
  sessionId: string;
  regions: PainRegion[];
  globalNprs: number;             // worst pain in last 24h, 0-10
  functionalLimitation: string;   // free text: what can't you do?
  previousSessions?: PainRegion[][]; // last 3 session pain maps for trend
}

export interface PainMapOutput {
  agentId: 'PainMapAgent';
  version: '1.0';
  timestamp: string;
  input: PainMapInput;
  // ── Algorithmic layer ──────────────────────────────────────
  riskLevel: 'low' | 'moderate' | 'high' | 'red_flag';
  redFlags: string[];             // APA red flag list triggers
  chronicPainRegions: string[];   // onset > 12 weeks
  bilateralRegions: string[];
  neuropathicIndicators: string[]; // burning + tingling + shooting
  painTrend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  // ── Claude Sonnet clinical layer ──────────────────────────
  clinicalSummary: string;
  differentialHypotheses: string[];   // 2-3 plausible mechanisms
  treatmentPriorityOrder: string[];   // ordered regions to treat first
  clinicianNotes: string;             // flags for clinician attention
  safeToExercise: boolean;
  exerciseModifications: string[];
  // ── Metadata ──────────────────────────────────────────────
  icd10Codes: string[];
  dataSource: 'patient_self_report';
  citation: string;
}

// ── Red flag triggers (APA guidelines) ──────────────────────
// These cannot be overridden — see safetyRules.ts
const RED_FLAG_TRIGGERS: Array<{ condition: (r: PainRegion) => boolean; flag: string }> = [
  {
    condition: r => r.nprs >= 8 && r.behaviours.includes('at_rest'),
    flag: 'Severe rest pain (NPRS ≥8) — rule out inflammatory arthritis, infection, malignancy',
  },
  {
    condition: r => r.qualities.includes('numbness') && r.radiates,
    flag: 'Radiating numbness — possible nerve root compression or peripheral neuropathy',
  },
  {
    condition: r => r.bodyPart === 'cervical' && r.qualities.includes('shooting') && r.radiates,
    flag: 'Cervical radiculopathy pattern — upper limb neurology screen required',
  },
  {
    condition: r => r.bodyPart === 'lumbar' && r.radiates && r.qualities.includes('tingling'),
    flag: 'Lumbar radiculopathy pattern — lower limb SLR / neurological exam required',
  },
  {
    condition: r => r.bodyPart === 'thoracic' && r.behaviours.includes('constant') && r.nprs >= 6,
    flag: 'Constant thoracic pain ≥6 — red flag: spinal tumour / compression fracture screen',
  },
  {
    condition: r => r.side === 'bilateral' && r.qualities.includes('numbness'),
    flag: 'Bilateral numbness — possible cauda equina or myelopathy — urgent referral',
  },
];

// ── ICD-10 pain code mapping ─────────────────────────────────
const PAIN_ICD10: Record<string, string> = {
  lumbar:    'M54.5',   // Low back pain
  cervical:  'M54.2',   // Cervicalgia
  thoracic:  'M54.6',   // Pain in thoracic spine
  shoulder:  'M75.1',   // Rotator cuff syndrome
  knee:      'M25.561', // Pain in right knee / M25.562 left
  hip:       'M25.551', // Pain in right hip
  ankle:     'M25.571', // Pain in right ankle
  wrist:     'M25.531', // Pain in right wrist
  elbow:     'M25.521', // Pain in right elbow
  foot:      'M79.671', // Pain in right foot
  general:   'M79.3',   // Panniculitis
};

// ── Stage 1: Algorithmic analysis ───────────────────────────

function algorithmicAnalysis(input: PainMapInput): {
  riskLevel: PainMapOutput['riskLevel'];
  redFlags: string[];
  chronicPainRegions: string[];
  bilateralRegions: string[];
  neuropathicIndicators: string[];
  painTrend: PainMapOutput['painTrend'];
  icd10Codes: string[];
} {
  const redFlags: string[] = [];
  const chronicPainRegions: string[] = [];
  const bilateralRegions: string[] = [];
  const neuropathicIndicators: string[] = [];
  const icd10Codes: string[] = [];

  for (const region of input.regions) {
    // Red flags
    for (const trigger of RED_FLAG_TRIGGERS) {
      if (trigger.condition(region)) redFlags.push(trigger.flag);
    }

    // Chronic pain (>12 weeks onset)
    if (region.onsetWeeks > 12) chronicPainRegions.push(region.label);

    // Bilateral
    if (region.side === 'bilateral') bilateralRegions.push(region.label);

    // Neuropathic indicators (Dworkin RH et al. 2007)
    const neuroQualities: PainQuality[] = ['burning', 'tingling', 'shooting', 'numbness'];
    const hasNeuro = neuroQualities.some(q => region.qualities.includes(q));
    if (hasNeuro) {
      neuropathicIndicators.push(
        `${region.label}: ${region.qualities.filter(q => neuroQualities.includes(q)).join(', ')}`
      );
    }

    // ICD-10
    const code = PAIN_ICD10[region.bodyPart] ?? PAIN_ICD10['general']!;
    if (!icd10Codes.includes(code)) icd10Codes.push(code);
  }

  // Risk level
  let riskLevel: PainMapOutput['riskLevel'] = 'low';
  if (redFlags.length > 0) {
    riskLevel = 'red_flag';
  } else if (input.globalNprs >= 7 || neuropathicIndicators.length >= 2 || chronicPainRegions.length >= 2) {
    riskLevel = 'high';
  } else if (input.globalNprs >= 4 || chronicPainRegions.length === 1 || bilateralRegions.length > 0) {
    riskLevel = 'moderate';
  }

  // Pain trend over last 3 sessions
  let painTrend: PainMapOutput['painTrend'] = 'insufficient_data';
  if (input.previousSessions && input.previousSessions.length >= 2) {
    const prevAvg = (sessions: PainRegion[]) =>
      sessions.reduce((s, r) => s + r.nprs, 0) / (sessions.length || 1);
    const scores = [...input.previousSessions.map(prevAvg), prevAvg(input.regions)];
    const first = scores[0] ?? 0;
    const last  = scores[scores.length - 1] ?? 0;
    const delta = last - first;
    painTrend = delta <= -1.5 ? 'improving' : delta >= 1.5 ? 'worsening' : 'stable';
  }

  return { riskLevel, redFlags, chronicPainRegions, bilateralRegions, neuropathicIndicators, painTrend, icd10Codes };
}

// ── Stage 2: Claude Sonnet clinical analysis ─────────────────

async function clinicalAnalysis(
  input: PainMapInput,
  algo: ReturnType<typeof algorithmicAnalysis>,
  apiKey: string,
): Promise<{
  clinicalSummary: string;
  differentialHypotheses: string[];
  treatmentPriorityOrder: string[];
  clinicianNotes: string;
  safeToExercise: boolean;
  exerciseModifications: string[];
}> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const regionDescriptions = input.regions.map(r =>
    `${r.label} (${r.side}, NPRS ${r.nprs}/10): ${r.qualities.join(', ')} | ` +
    `behaviour: ${r.behaviours.join(', ')} | onset: ${r.onsetWeeks}w | radiates: ${r.radiates}`
  ).join('\n');

  const prompt = `You are PainMapAgent in PhysioCore AI, a regulated SaMD Class II clinical physiotherapy platform.

PATIENT PAIN REPORT:
Global NPRS (worst 24h): ${input.globalNprs}/10
Functional limitation: "${input.functionalLimitation}"

PAIN REGIONS:
${regionDescriptions}

ALGORITHMIC FLAGS:
- Risk level: ${algo.riskLevel}
- Red flags: ${algo.redFlags.join(' | ') || 'none'}
- Chronic regions (>12wk): ${algo.chronicPainRegions.join(', ') || 'none'}
- Neuropathic indicators: ${algo.neuropathicIndicators.join(' | ') || 'none'}
- Pain trend: ${algo.painTrend}

Respond ONLY in this exact JSON format (no markdown, no preamble):
{
  "clinicalSummary": "2-3 sentence clinical picture",
  "differentialHypotheses": ["hypothesis 1 with mechanism", "hypothesis 2", "hypothesis 3"],
  "treatmentPriorityOrder": ["region to treat first (reason)", "region 2", "region 3"],
  "clinicianNotes": "specific flags the treating clinician must review",
  "safeToExercise": true or false,
  "exerciseModifications": ["modification 1", "modification 2"]
}

Rules:
- If red_flag risk: safeToExercise = false, clinicianNotes must mention urgent review
- Every hypothesis must name a plausible anatomical/physiological mechanism
- Differential hypotheses are NOT diagnoses — frame as "consistent with"
- This is patient self-report only — do not overstate certainty`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  try {
    return JSON.parse(text) as {
      clinicalSummary: string;
      differentialHypotheses: string[];
      treatmentPriorityOrder: string[];
      clinicianNotes: string;
      safeToExercise: boolean;
      exerciseModifications: string[];
    };
  } catch {
    // Graceful fallback — never crash on parse failure
    return {
      clinicalSummary: text.slice(0, 300),
      differentialHypotheses: ['Analysis unavailable — JSON parse error'],
      treatmentPriorityOrder: input.regions.map(r => r.label),
      clinicianNotes: 'AI analysis failed — manual review required',
      safeToExercise: algo.riskLevel === 'low',
      exerciseModifications: ['Proceed with caution pending manual review'],
    };
  }
}

// ── Main export ───────────────────────────────────────────────

export async function runPainMapAgent(
  input: PainMapInput,
  apiKey: string,
): Promise<PainMapOutput> {
  const algo     = algorithmicAnalysis(input);
  const clinical = await clinicalAnalysis(input, algo, apiKey);

  return {
    agentId: 'PainMapAgent',
    version: '1.0',
    timestamp: new Date().toISOString(),
    input,
    ...algo,
    ...clinical,
    dataSource: 'patient_self_report',
    citation: 'Melzack R. Pain. 1975;1(3):277-299 | Hawker GA et al. Arthritis Care Res. 2011;63(S11):S240-S252',
  };
}
