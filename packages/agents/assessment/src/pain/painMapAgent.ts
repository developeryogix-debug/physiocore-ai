import Anthropic from '@anthropic-ai/sdk';

// ─── Public types ─────────────────────────────────────────────────────────────

export type PainQuality =
  | 'sharp' | 'dull' | 'burning' | 'aching' | 'throbbing'
  | 'stabbing' | 'cramping' | 'shooting' | 'tingling' | 'numbness';

export type PainBehaviour =
  | 'constant' | 'intermittent' | 'on_movement' | 'at_rest'
  | 'worse_morning' | 'worse_evening' | 'better_rest' | 'better_heat' | 'better_cold';

export interface PainRegion {
  id:          string;
  label:       string;
  bodyPart:    string;
  side:        'left' | 'right' | 'central';
  nprs:        number;        // 0–10
  qualities:   PainQuality[];
  behaviours:  PainBehaviour[];
  onsetWeeks:  number;
  radiates:    boolean;
}

export interface PainMapInput {
  userId:              string;
  sessionId:           string;
  regions:             PainRegion[];   // only those with nprs > 0
  globalNprs:          number;         // worst pain last 24h
  functionalLimitation: string;
}

export interface PainMapReport {
  riskLevel:              'green' | 'moderate' | 'high' | 'red_flag';
  painTrend:              'acute' | 'sub_acute' | 'chronic' | 'chronic_acute_flare';
  redFlags:               string[];
  clinicalSummary:        string;
  differentialHypotheses: string[];
  safeToExercise:         boolean;
  exerciseModifications:  string[];
  clinicianNotes:         string;
  icd10Codes:             string[];
  citation:               string;
  processingMs:           number;
}

// ─── ICD-10 mapping by body part ─────────────────────────────────────────────

const BODY_PART_ICD10: Record<string, string> = {
  cervical:  'M54.2',
  thoracic:  'M54.6',
  lumbar:    'M54.5',
  shoulder:  'M75.1',
  elbow:     'M77.1',
  wrist:     'M79.3',
  hip:       'M25.551',
  knee:      'M25.561',
  ankle:     'M25.571',
  si:        'M53.3',
};

// ─── Red flag pattern detection ───────────────────────────────────────────────
// Ref: Greenhalgh S, Selfe J. Red Flags II. Churchill Livingstone; 2010.

function detectRedFlags(input: PainMapInput): string[] {
  const flags: string[] = [];
  const { regions, globalNprs } = input;

  // Constant severe pain at rest (NPRS ≥8) — possible serious pathology
  const severePainAtRest = regions.find(
    r => r.nprs >= 8 && r.behaviours.includes('at_rest') && r.behaviours.includes('constant'),
  );
  if (severePainAtRest) {
    flags.push(`Severe constant rest pain in ${severePainAtRest.label} (NPRS ${severePainAtRest.nprs}/10) — rule out serious pathology`);
  }

  // Global NPRS ≥9
  if (globalNprs >= 9) {
    flags.push('Worst pain ≥9/10 in last 24h — consider urgent assessment');
  }

  // Bilateral limb symptoms (possible cord/nerve root compromise)
  const leftLimb  = regions.filter(r => r.side === 'left'  && ['hip','knee','ankle'].includes(r.bodyPart));
  const rightLimb = regions.filter(r => r.side === 'right' && ['hip','knee','ankle'].includes(r.bodyPart));
  if (leftLimb.length > 0 && rightLimb.length > 0) {
    flags.push('Bilateral lower limb symptoms — consider lumbar canal stenosis or central disc herniation');
  }

  // Numbness/tingling radiating from spine
  const spinePain  = regions.filter(r => ['cervical','thoracic','lumbar'].includes(r.bodyPart));
  const hasNeuroPain = spinePain.some(r => r.qualities.some(q => ['tingling','numbness','shooting'].includes(q)) && r.radiates);
  if (hasNeuroPain) {
    flags.push('Radiating neurological symptoms from spine — consider nerve root compression');
  }

  // Thoracic pain with burning/constant qualities (cardiac/visceral referral)
  const thoracicBurning = regions.find(
    r => r.bodyPart === 'thoracic' && r.qualities.includes('burning') && r.behaviours.includes('constant'),
  );
  if (thoracicBurning) {
    flags.push('Constant burning thoracic pain — exclude visceral or cardiac referral');
  }

  // Onset <2 weeks with severe pain (NPRS ≥7) and not movement-related
  const acuteSevere = regions.find(
    r => r.onsetWeeks <= 2 && r.nprs >= 7 && !r.behaviours.includes('on_movement'),
  );
  if (acuteSevere) {
    flags.push(`Acute severe pain (${acuteSevere.label}, onset ≤2 weeks, NPRS ${acuteSevere.nprs}/10) not provoked by movement`);
  }

  return flags;
}

// ─── Pain trend classification ────────────────────────────────────────────────

function classifyPainTrend(regions: PainRegion[]): PainMapReport['painTrend'] {
  const onsets = regions.map(r => r.onsetWeeks);
  const minOnset = Math.min(...onsets);

  if (minOnset <= 6) {
    const hasChronicBase = regions.some(r => r.onsetWeeks > 12);
    return hasChronicBase ? 'chronic_acute_flare' : 'acute';
  }
  if (minOnset <= 12) return 'sub_acute';
  return 'chronic';
}

// ─── Risk level ───────────────────────────────────────────────────────────────

function computeRiskLevel(
  redFlags: string[],
  regions:  PainRegion[],
  globalNprs: number,
): PainMapReport['riskLevel'] {
  if (redFlags.length > 0) return 'red_flag';

  const maxNprs = Math.max(globalNprs, ...regions.map(r => r.nprs));
  const regionCount = regions.length;

  if (maxNprs >= 7 || regionCount >= 4) return 'high';
  if (maxNprs >= 4 || regionCount >= 2) return 'moderate';
  return 'green';
}

// ─── ICD-10 codes from affected body parts ────────────────────────────────────

function buildICD10Codes(regions: PainRegion[]): string[] {
  const codes = new Set<string>();
  for (const r of regions) {
    const code = BODY_PART_ICD10[r.bodyPart];
    if (code) codes.add(code);
  }
  // Generic musculoskeletal pain if nothing mapped
  if (codes.size === 0) codes.add('M79.3');
  return [...codes];
}

// ─── Claude Haiku interpretation ──────────────────────────────────────────────

interface HaikuOutput {
  clinicalSummary:        string;
  differentialHypotheses: string[];
  exerciseModifications:  string[];
  clinicianNotes:         string;
}

async function interpretWithHaiku(
  input:    PainMapInput,
  redFlags: string[],
  trend:    PainMapReport['painTrend'],
  client:   Anthropic,
): Promise<HaikuOutput> {
  const regionSummary = input.regions.map(r =>
    `${r.label} (NPRS ${r.nprs}/10, ${r.onsetWeeks}wk onset): ` +
    `qualities=[${r.qualities.join(',')}] behaviour=[${r.behaviours.join(',')}]` +
    (r.radiates ? ' [radiates]' : ''),
  ).join('\n');

  const prompt = `You are a musculoskeletal physiotherapy AI. Analyse this pain presentation and respond in strict JSON.

Pain regions:
${regionSummary}

Global worst NPRS: ${input.globalNprs}/10
Functional limitation: "${input.functionalLimitation || 'not specified'}"
Pain trend: ${trend}
Red flags detected: ${redFlags.length > 0 ? redFlags.join('; ') : 'none'}

Respond ONLY with this JSON (no markdown, no preamble):
{
  "clinicalSummary": "<2-3 sentence clinical narrative>",
  "differentialHypotheses": ["<hypothesis 1>", "<hypothesis 2>", "<hypothesis 3 max>"],
  "exerciseModifications": ["<modification 1>", "<modification 2>"],
  "clinicianNotes": "<1 sentence note for treating physiotherapist>"
}`;

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  });

  const first = msg.content[0];
  const raw = (first && first.type === 'text') ? first.text.trim() : '{}';

  try {
    return JSON.parse(raw) as HaikuOutput;
  } catch {
    return {
      clinicalSummary:        'Clinical analysis based on reported pain map data.',
      differentialHypotheses: ['Musculoskeletal pain — further assessment required'],
      exerciseModifications:  ['Avoid high-impact loading until further assessment'],
      clinicianNotes:         'Subjective pain map only — objective examination required.',
    };
  }
}

// ─── Safe-to-exercise logic ───────────────────────────────────────────────────

function isSafeToExercise(riskLevel: PainMapReport['riskLevel'], regions: PainRegion[]): boolean {
  if (riskLevel === 'red_flag') return false;
  // Constant rest pain ≥7 = hold exercise
  const constantSevere = regions.some(
    r => r.nprs >= 7 && r.behaviours.includes('constant') && r.behaviours.includes('at_rest'),
  );
  return !constantSevere;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runPainMapAgent(
  input:  PainMapInput,
  apiKey?: string,
): Promise<PainMapReport> {
  const t0     = Date.now();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const redFlags  = detectRedFlags(input);
  const trend     = classifyPainTrend(input.regions);
  const riskLevel = computeRiskLevel(redFlags, input.regions, input.globalNprs);
  const icd10Codes = buildICD10Codes(input.regions);

  let haikuResult: HaikuOutput;
  try {
    haikuResult = await interpretWithHaiku(input, redFlags, trend, client);
  } catch {
    haikuResult = {
      clinicalSummary:        'Pain map recorded. Clinical interpretation unavailable — please review manually.',
      differentialHypotheses: ['Musculoskeletal pain pattern — further assessment required'],
      exerciseModifications:  ['Modify load based on pain response', 'Avoid positions that reproduce symptoms'],
      clinicianNotes:         'AI interpretation failed — manual review required.',
    };
  }

  return {
    riskLevel,
    painTrend:   trend,
    redFlags,
    clinicalSummary:        haikuResult.clinicalSummary,
    differentialHypotheses: haikuResult.differentialHypotheses,
    safeToExercise:         isSafeToExercise(riskLevel, input.regions),
    exerciseModifications:  haikuResult.exerciseModifications,
    clinicianNotes:         haikuResult.clinicianNotes,
    icd10Codes,
    citation: 'Greenhalgh S, Selfe J. Red Flags II. Churchill Livingstone; 2010. IASP Pain Taxonomy 2020.',
    processingMs: Date.now() - t0,
  };
}
