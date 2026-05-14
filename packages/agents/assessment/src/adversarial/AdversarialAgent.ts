import Anthropic from '@anthropic-ai/sdk';
import type {
  AdversarialInput,
  AdversarialReport,
  Critique,
} from '../types/findings.js';

// ─── Model config ─────────────────────────────────────────────────────────────
// Only place in the codebase that uses Opus.
// Cost estimate: ~$0.08–0.15 per full assessment (1500 tokens max output).
const MODEL   = 'claude-opus-4-6' as const;
const MAX_TOK = 1500;

// ─── Report serialiser — converts agent outputs to terse JSON for the prompt ──

function serialiseInput(input: AdversarialInput): string {
  const sections: string[] = [];

  if (input.postureReport) {
    const p = input.postureReport;
    sections.push(`POSTURE_AGENT:\n${JSON.stringify({
      headForwardCm:       p.headForwardPostureCm,
      thoracicKyphosisDeg: p.thoracicKyphosisDeg,
      lumbarLordosisDeg:   p.lumbarLordosisDeg,
      pelvicTiltDeg:       p.pelvicTiltDeg,
      shoulderDiffCm:      p.shoulderHeightDiffCm,
      spinalDeviationDeg:  p.spinalDeviationDeg,
      kneeValgusR:         p.kneeValgusRightDeg,
      kneeValgusL:         p.kneeValgusLeftDeg,
      flags:               p.flags,
      summary:             p.clinicalSummary,
      evidenceGrade:       p.evidenceGrade,
    }, null, 2)}`);
  }

  if (input.gaitReport) {
    const g = input.gaitReport;
    sections.push(`GAIT_AGENT:\n${JSON.stringify({
      stepSymmetry:      g.stepSymmetry,
      cadence:           g.cadence,
      trunkSway:         g.trunkSway,
      armSwing:          g.armSwing,
      heelStrike:        g.heelStrikePattern,
      trendelenburg:     g.trendelenburgSign,
      antalgic:          g.antalgicPattern,
      antalgicSide:      g.antalgicSide,
      dataQuality:       g.dataQuality,
      confidence:        g.confidence,
      framesAnalysed:    g.framesAnalysed,
      flags:             g.flags,
      deviations:        g.gaitDeviations,
      summary:           g.clinicalSummary,
      evidenceGrade:     g.evidenceGrade,
    }, null, 2)}`);
  }

  if (input.romReport) {
    const r = input.romReport;
    sections.push(`ROM_AGENT:\n${JSON.stringify({
      overallMobility:   r.overallMobility,
      dataCompleteness:  r.dataCompleteness,
      sessionsAnalysed:  r.sessionsAnalysed,
      dataSource:        'session_score_proxy',
      significantJoints: Object.values(r.joints)
        .filter(j => j.clinicallySignificant)
        .map(j => ({ joint: j.joint, movement: j.movement, deficit: j.deficitPercent, confidence: j.confidence })),
      asymmetries:       r.asymmetries.filter(a => a.clinicallySignificant),
      trends:            r.trends,
      summary:           r.clinicalSummary,
      evidenceGrade:     r.evidenceGrade,
    }, null, 2)}`);
  }

  if (input.painMapOutput) {
    const pm = input.painMapOutput;
    sections.push(`PAIN_MAP_AGENT:\n${JSON.stringify({
      riskLevel:       pm.riskLevel,
      painTrend:       pm.painTrend,
      redFlags:        pm.redFlags,
      safeToExercise:  pm.safeToExercise,
      hypotheses:      pm.differentialHypotheses,
      icd10:           pm.icd10Codes,
      summary:         pm.clinicalSummary,
    }, null, 2)}`);
  }

  if (input.functionalReport) {
    const f = input.functionalReport;
    sections.push(`FUNCTIONAL_AGENT:\n${JSON.stringify({
      psfsAverage:       f.psfsAverage,
      psfsChange:        f.psfsChangeFromBaseline,
      mcidMet:           f.psfsMcidMet,
      tugSeconds:        f.tugSeconds,
      tugRisk:           f.tugRiskCategory,
      chairStand:        f.thirtySecChairStand,
      chairNormative:    f.thirtySecNormative,
      functionLevel:     f.overallFunctionLevel,
      goalProgress:      f.goalProgressPercent,
      referralFlags:     f.referralFlags,
      summary:           f.clinicalSummary,
      evidenceGrade:     f.evidenceGrade,
    }, null, 2)}`);
  }

  if (input.specialTestsReport) {
    const s = input.specialTestsReport;
    sections.push(`SPECIAL_TESTS_AGENT:\n${JSON.stringify({
      joint:           s.joint,
      phase:           s.phase,
      positiveTests:   s.positiveTests ?? [],
      likelyDiagnoses: s.likelyDiagnoses ?? [],
      referral:        s.referralRecommended ?? false,
      referralReason:  s.referralReason ?? null,
      summary:         s.clinicalSummary ?? null,
      evidenceGrade:   s.evidenceGrade,
    }, null, 2)}`);
  }

  const p = input.userProfile;
  sections.push(`PATIENT_PROFILE:\n${JSON.stringify({
    ageYears:       p.ageYears,
    sex:            p.sex,
    primaryGoal:    p.primaryGoal,
    activeInjuries: p.activeInjuries,
    conditions:     p.conditions,
    medications:    p.medications,
  }, null, 2)}`);

  return sections.join('\n\n---\n\n');
}

// ─── Opus prompt ──────────────────────────────────────────────────────────────

function buildPrompt(serialised: string): string {
  return `You are the AdversarialAgent in a clinical AI physiotherapy system.
Your role: find flaws, contradictions, and safety gaps in these assessment reports.
Act as a malpractice auditor reviewing the work of specialist AI agents.

For each report provided, identify:
1. Contradictions between reports (e.g. gait shows antalgic left but pain map shows only right knee)
2. Missing information that changes the clinical picture
3. Overconfident conclusions given data quality or sample size
4. Safety concerns not flagged by individual agents
5. Alternative explanations not considered
6. Data quality issues that undermine conclusions (e.g. ROM from score proxy with low session count)

Be specific and cite which agent made the error. Use the exact agentId keys:
posture-agent, gait-agent, rom-agent, pain-map-agent, functional-agent, special-tests-agent

ASSESSMENT DATA:
${serialised}

Respond ONLY with this exact JSON structure (no markdown, no preamble):
{
  "critiques": [
    {
      "targetAgent": "<agentId>",
      "finding": "<specific flaw — one sentence>",
      "severity": "minor|moderate|critical",
      "recommendation": "<what should have been flagged or done differently>"
    }
  ],
  "overallConfidence": "high|medium|low",
  "safetyGapsFound": ["<gap 1>", "<gap 2>"],
  "recommendAdditionalAssessment": ["<assessment 1>", "<assessment 2>"]
}

Severity rules:
- critical: patient safety risk, missed red flag, or fundamentally wrong conclusion
- moderate: significant omission or overconfident claim affecting treatment
- minor: incomplete differential, citation weakness, or low-priority gap

If no flaws found for an agent, omit it from critiques entirely.
If data is genuinely complete and coherent, return empty critiques array.`;
}

// ─── Parse Opus JSON output ───────────────────────────────────────────────────

interface OpusRaw {
  critiques:                     Critique[];
  overallConfidence:             'high' | 'medium' | 'low';
  safetyGapsFound:               string[];
  recommendAdditionalAssessment: string[];
}

function parseOpusOutput(raw: string): OpusRaw {
  // Strip potential markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as OpusRaw;
    return {
      critiques:                     Array.isArray(parsed.critiques) ? parsed.critiques : [],
      overallConfidence:             parsed.overallConfidence ?? 'low',
      safetyGapsFound:               Array.isArray(parsed.safetyGapsFound) ? parsed.safetyGapsFound : [],
      recommendAdditionalAssessment: Array.isArray(parsed.recommendAdditionalAssessment) ? parsed.recommendAdditionalAssessment : [],
    };
  } catch {
    // JSON parse failed — return conservative fallback that blocks consensus
    return {
      critiques: [{
        targetAgent:    'adversarial-agent-self',
        finding:        'AdversarialAgent failed to parse its own output — review manually',
        severity:       'critical',
        recommendation: 'Re-run adversarial review or conduct manual clinical audit',
      }],
      overallConfidence:             'low',
      safetyGapsFound:               ['AdversarialAgent output unparseable — manual review required'],
      recommendAdditionalAssessment: ['Full manual clinical audit by qualified physiotherapist'],
    };
  }
}

// ─── AdversarialAgent ─────────────────────────────────────────────────────────

export class AdversarialAgent {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async critique(input: AdversarialInput, patientId: string): Promise<AdversarialReport> {
    const t0 = Date.now();

    const serialised = serialiseInput(input);
    const prompt     = buildPrompt(serialised);

    const msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOK,
      messages:   [{ role: 'user', content: prompt }],
    });

    const first = msg.content[0];
    const rawText = (first && first.type === 'text') ? first.text.trim() : '';

    const parsed = parseOpusOutput(rawText);

    // approvedForConsensus = false if any critique is critical
    const hasCritical = parsed.critiques.some(c => c.severity === 'critical');

    return {
      agentId:                       'adversarial-agent',
      version:                       '1.0.0',
      patientId,
      generatedAt:                   new Date().toISOString(),
      critiques:                     parsed.critiques,
      overallConfidence:             parsed.overallConfidence,
      safetyGapsFound:               parsed.safetyGapsFound,
      recommendAdditionalAssessment: parsed.recommendAdditionalAssessment,
      approvedForConsensus:          !hasCritical,
      processingMs:                  Date.now() - t0,
    };
  }
}
