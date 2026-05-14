import Anthropic from '@anthropic-ai/sdk';
import type {
  FunctionalAgentInput,
  FunctionalReport,
  RedFlagAlert,
  EvidenceGrade,
} from '../types/findings.js';

// ── 30s Chair Stand norms ─────────────────────────────────────────────────────
// Source: Jones CJ, Rikli RE, Beam WC. Res Q Exerc Sport. 1999;70(2):113-119.

interface ChairNorm { min: number; max: number }

const CHAIR_NORMS_MALE: Array<{ ageMin: number; ageMax: number; norm: ChairNorm }> = [
  { ageMin: 60, ageMax: 64, norm: { min: 14, max: 19 } },
  { ageMin: 65, ageMax: 69, norm: { min: 12, max: 18 } },
  { ageMin: 70, ageMax: 74, norm: { min: 12, max: 17 } },
  { ageMin: 75, ageMax: 79, norm: { min: 11, max: 17 } },
  { ageMin: 80, ageMax: 84, norm: { min: 10, max: 15 } },
  { ageMin: 85, ageMax: 89, norm: { min:  8, max: 14 } },
  { ageMin: 90, ageMax: 999, norm: { min:  7, max: 12 } },
];

const CHAIR_NORMS_FEMALE: Array<{ ageMin: number; ageMax: number; norm: ChairNorm }> = [
  { ageMin: 60, ageMax: 64, norm: { min: 12, max: 17 } },
  { ageMin: 65, ageMax: 69, norm: { min: 11, max: 16 } },
  { ageMin: 70, ageMax: 74, norm: { min: 10, max: 15 } },
  { ageMin: 75, ageMax: 79, norm: { min: 10, max: 15 } },
  { ageMin: 80, ageMax: 84, norm: { min:  9, max: 14 } },
  { ageMin: 85, ageMax: 89, norm: { min:  8, max: 13 } },
  { ageMin: 90, ageMax: 999, norm: { min:  4, max: 11 } },
];

// ── PSFS scoring ──────────────────────────────────────────────────────────────

interface PSFSResult {
  average: number;
  changeFromBaseline: number;
  mcidMet: boolean;
  interpretation: string;
}

function scorePSFS(
  activities: FunctionalAgentInput['psfsActivities'],
): PSFSResult {
  if (activities.length === 0) {
    return { average: 0, changeFromBaseline: 0, mcidMet: false, interpretation: 'No PSFS activities recorded.' };
  }

  const currentMean  = activities.reduce((sum, a) => sum + a.current,  0) / activities.length;
  const baselineMean = activities.reduce((sum, a) => sum + a.baseline, 0) / activities.length;
  const change       = currentMean - baselineMean;
  const mcidMet      = change >= 2.0; // Stratford PW et al. Physiother Can. 1995

  let interpretation: string;
  if (change >= 2.0)       interpretation = `Clinically meaningful improvement (+${change.toFixed(1)} pts, MCID ≥ 2.0 met).`;
  else if (change > 0)     interpretation = `Improvement of ${change.toFixed(1)} pts — below MCID threshold of 2.0.`;
  else if (change === 0)   interpretation = 'No change from baseline.';
  else                     interpretation = `Decline of ${Math.abs(change).toFixed(1)} pts from baseline. Review treatment plan.`;

  return {
    average:            Math.round(currentMean  * 10) / 10,
    changeFromBaseline: Math.round(change        * 10) / 10,
    mcidMet,
    interpretation,
  };
}

// ── TUG scoring ───────────────────────────────────────────────────────────────
// Source: Podsiadlo D, Richardson S. J Am Geriatr Soc. 1991;39(2):142-148.

type TUGCategory = 'low' | 'moderate' | 'high' | 'not_tested';

function scoreTUG(seconds: number | null): TUGCategory {
  if (seconds === null) return 'not_tested';
  if (seconds < 12)    return 'low';
  if (seconds <= 20)   return 'moderate';
  return 'high';
}

// ── 30s Chair Stand scoring ───────────────────────────────────────────────────

interface ChairResult {
  normative: string;
  withinNorm: boolean | null; // null when age/sex unavailable
}

function scoreChairStand(
  count: number | null,
  ageYears?: number,
  sex?: 'male' | 'female',
): ChairResult {
  if (count === null) {
    return { normative: 'Not tested', withinNorm: null };
  }

  if (ageYears === undefined || sex === undefined) {
    return { normative: `${count} reps recorded (normative comparison requires age and sex)`, withinNorm: null };
  }

  if (ageYears < 60) {
    const threshold = sex === 'male' ? 15 : 13;
    const withinNorm = count >= threshold;
    return {
      normative: withinNorm
        ? `${count} reps — within expected range for adults under 60.`
        : `${count} reps — below expected minimum of ${threshold} for adults under 60.`,
      withinNorm,
    };
  }

  const table = sex === 'male' ? CHAIR_NORMS_MALE : CHAIR_NORMS_FEMALE;
  const row   = table.find(r => ageYears >= r.ageMin && ageYears <= r.ageMax);

  if (!row) {
    return { normative: `${count} reps (no normative data for age ${ageYears})`, withinNorm: null };
  }

  const ageLabel  = row.ageMax === 999 ? `${row.ageMin}+` : `${row.ageMin}–${row.ageMax}`;
  const sexLabel  = sex === 'male' ? 'male' : 'female';
  const withinNorm = count >= row.norm.min && count <= row.norm.max;
  const below      = count < row.norm.min;

  const position = withinNorm ? 'Within norm' : (below ? 'Below norm' : 'Above norm');

  return {
    normative: `${position} for age ${ageLabel} ${sexLabel} (norm: ${row.norm.min}–${row.norm.max}). Recorded: ${count} reps.`,
    withinNorm,
  };
}

// ── GROC interpretation ───────────────────────────────────────────────────────

function interpretGROC(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 5)  return `GROC +${score}: Large meaningful improvement reported by patient.`;
  if (score >= 3)  return `GROC +${score}: Moderate improvement reported.`;
  if (score >= 1)  return `GROC +${score}: Small improvement reported.`;
  if (score === 0) return 'GROC 0: No change reported.';
  if (score >= -2) return `GROC ${score}: Small deterioration reported.`;
  return `GROC ${score}: Significant deterioration reported. Review treatment.`;
}

// ── Overall function level ─────────────────────────────────────────────────────

type FunctionLevel = FunctionalReport['overallFunctionLevel'];

function computeFunctionLevel(
  psfs: PSFSResult,
  tug: TUGCategory,
  chair: ChairResult,
): FunctionLevel {
  const chairPoor = chair.withinNorm === false;

  if (psfs.average < 3 || tug === 'high') return 'severely_impaired';
  if (psfs.average < 5 || chairPoor)      return 'moderately_impaired';
  if (psfs.average < 7 || tug === 'moderate') return 'mildly_impaired';
  return 'normal';
}

// ── Goal progress composite ───────────────────────────────────────────────────
// Weighted composite: PSFS (50%), TUG (30%), Chair Stand (20%)

function computeGoalProgress(
  psfs: PSFSResult,
  tug: TUGCategory,
  chair: ChairResult,
): number {
  const psfsScore = (psfs.average / 10) * 100;

  const tugScore =
    tug === 'low'       ? 100 :
    tug === 'moderate'  ? 60  :
    tug === 'high'      ? 20  : 75; // not_tested → neutral

  const chairScore =
    chair.withinNorm === true  ? 100 :
    chair.withinNorm === false ? 40  : 70; // null → neutral

  return Math.round(psfsScore * 0.50 + tugScore * 0.30 + chairScore * 0.20);
}

// ── Referral flags ─────────────────────────────────────────────────────────────

function buildReferralFlags(
  tug: TUGCategory,
  level: FunctionLevel,
): RedFlagAlert[] {
  const flags: RedFlagAlert[] = [];

  if (tug === 'high') {
    flags.push({
      type: 'high_fall_risk',
      description: 'TUG > 20s indicates high fall risk. Urgent falls prevention referral required.',
      immediateAction: 'Refer to falls prevention programme. Assess home hazards. Prescribe balance exercises.',
      emergencyLevel: 'urgent_referral',
    });
  }

  if (level === 'severely_impaired') {
    flags.push({
      type: 'severe_functional_impairment',
      description: 'Severe functional impairment detected across outcome measures.',
      immediateAction: 'Urgent multidisciplinary review. Consider OT home assessment. Reassess goals.',
      emergencyLevel: 'urgent_referral',
    });
  }

  return flags;
}

// ── Haiku summary ─────────────────────────────────────────────────────────────

async function generateSummary(
  client: Anthropic,
  model: string,
  input: FunctionalAgentInput,
  psfs: PSFSResult,
  tug: TUGCategory,
  chair: ChairResult,
  level: FunctionLevel,
): Promise<string> {
  const context = JSON.stringify({
    psfsAverage: psfs.average,
    psfsChange: psfs.changeFromBaseline,
    mcidMet: psfs.mcidMet,
    tugSeconds: input.tugSeconds,
    tugRisk: tug,
    chairStand: input.thirtySecChairStandCount,
    chairNormative: chair.normative,
    overallLevel: level,
    adherence: input.adherencePercent,
    sessions: input.sessionCount,
  });

  const msg = await client.messages.create({
    model,
    max_tokens: 400,
    system:
      'You are a physiotherapy clinical assistant. Write a concise 3-sentence functional assessment summary for a clinician. ' +
      'Be factual and cite specific scores. Note fall risk if TUG indicates high risk. Use professional clinical language.',
    messages: [{ role: 'user', content: `Functional assessment data: ${context}` }],
  });

  const block = msg.content[0];
  return block?.type === 'text' ? block.text.trim() : buildFallbackSummary(psfs, tug, chair, level);
}

function buildFallbackSummary(
  psfs: PSFSResult,
  tug: TUGCategory,
  chair: ChairResult,
  level: FunctionLevel,
): string {
  const parts: string[] = [
    `PSFS average ${psfs.average}/10 (${psfs.interpretation})`,
    tug !== 'not_tested' ? `TUG fall risk: ${tug}.` : 'TUG not tested.',
    `Overall function: ${level.replace(/_/g, ' ')}. ${chair.normative}`,
  ];
  return parts.join(' ');
}

// ── FunctionalAgent class ─────────────────────────────────────────────────────

export class FunctionalAgent {
  private readonly client: Anthropic;
  private readonly model = 'claude-haiku-4-5-20251001';

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async run(input: FunctionalAgentInput): Promise<FunctionalReport> {
    const t0 = Date.now();

    const psfs  = scorePSFS(input.psfsActivities);
    const tug   = scoreTUG(input.tugSeconds);
    const chair = scoreChairStand(input.thirtySecChairStandCount, input.ageYears, input.sex);
    const groc  = interpretGROC(input.grocScore);
    const level = computeFunctionLevel(psfs, tug, chair);
    const goal  = computeGoalProgress(psfs, tug, chair);
    const flags = buildReferralFlags(tug, level);

    let clinicalSummary: string;
    try {
      clinicalSummary = await generateSummary(
        this.client, this.model, input, psfs, tug, chair, level,
      );
    } catch {
      clinicalSummary = buildFallbackSummary(psfs, tug, chair, level);
    }

    const evidenceGrade: EvidenceGrade = 'A';

    return {
      agentId:   'functional-agent',
      version:   '1.0.0',
      patientId: input.patientId,
      generatedAt: new Date().toISOString(),

      psfsAverage:            psfs.average,
      psfsChangeFromBaseline: psfs.changeFromBaseline,
      psfsInterpretation:     psfs.interpretation,
      psfsMcidMet:            psfs.mcidMet,

      tugSeconds:     input.tugSeconds,
      tugRiskCategory: tug,

      thirtySecChairStand: input.thirtySecChairStandCount,
      thirtySecNormative:  chair.normative,

      overallFunctionLevel: level,
      goalProgressPercent:  goal,
      grocInterpretation:   groc,

      referralFlags:   flags,
      clinicalSummary,

      evidenceGrade,
      citations: [
        'Hawker GA et al. Measures of adult pain. Arthritis Care Res. 2011;63(S11):S240-252.',
        'Stratford PW et al. Assessing disability and change on individual patients. Physiother Can. 1995;47:258-263.',
        'Podsiadlo D, Richardson S. The timed "Up & Go". J Am Geriatr Soc. 1991;39(2):142-148.',
        'Jones CJ, Rikli RE, Beam WC. A 30-s chair-stand test as a measure of lower body strength. Res Q Exerc Sport. 1999;70(2):113-119.',
      ],
      processingMs: Date.now() - t0,
    };
  }
}
