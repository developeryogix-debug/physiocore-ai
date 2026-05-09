import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext,
  AgentResult,
  ClinicalAssessment,
  ClinicalRecommendation,
  RiskFactor,
  UserProfile,
  FHIRPatient,
  FHIRObservation,
} from '@physiocore/types';
import { FHIRClient } from './fhirClient.js';
import {
  assessRiskFactors,
  mapProfileToFHIRPatient,
  createExerciseObservation,
  LOINC_CODES,
} from './riskAssessment.js';

const CRITICAL_BMI_LOW = 16;
const CRITICAL_BMI_HIGH = 40;

export class ClinicalAgent {
  private readonly agentId = 'clinical-agent';
  private readonly version = '1.0.0';
  private readonly fhirClient: FHIRClient;
  private readonly anthropicClient: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(fhirBaseUrl?: string, anthropicApiKey?: string) {
    this.fhirClient = new FHIRClient(fhirBaseUrl);
    this.anthropicClient = new Anthropic({
      apiKey: anthropicApiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  /**
   * Perform a full clinical assessment for a patient:
   * 1. Upsert FHIR Patient record
   * 2. Fetch existing Observations
   * 3. Assess risk factors
   * 4. Generate Claude-backed clinical recommendations
   * 5. Determine referral need
   */
  async assessPatient(
    context: AgentContext,
  ): Promise<AgentResult<ClinicalAssessment>> {
    const startTime = Date.now();
    const { userProfile } = context;

    try {
      // 1. Upsert patient on the FHIR server
      const fhirPatient = await this.upsertFHIRPatient(userProfile);

      // 2. Fetch existing observations (weight + BMI as starting point)
      const observations = await this.fhirClient.getObservations(
        fhirPatient.id,
        [LOINC_CODES.BODY_WEIGHT, LOINC_CODES.BMI, LOINC_CODES.FUNCTIONAL_STATUS],
      );

      // 3. Assess risk factors
      const riskFactors = assessRiskFactors(userProfile);

      // 4. Generate clinical recommendations via Claude
      const clinicalRecommendations =
        await this.generateClinicalRecommendations(userProfile, riskFactors);

      // 5. Determine referral need
      const { referralNeeded, referralReason } = this.evaluateReferralNeed(
        riskFactors,
        userProfile,
      );

      const assessment: ClinicalAssessment = {
        patient: fhirPatient,
        observations,
        riskFactors,
        clinicalRecommendations,
        referralNeeded,
        ...(referralReason !== undefined ? { referralReason } : {}),
      };

      return this.buildResult(assessment, startTime);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown clinical assessment error';
      const isRetryable =
        message.includes('overloaded') || message.includes('rate_limit');

      return {
        success: false,
        data: undefined as unknown as ClinicalAssessment,
        error: {
          code: isRetryable ? 'RATE_LIMIT' : 'ASSESSMENT_FAILED',
          message,
          retryable: isRetryable,
        },
        metadata: {
          agentId: this.agentId,
          agentVersion: this.version,
          processingMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Record a completed exercise session as a FHIR Observation.
   */
  async recordSession(
    context: AgentContext,
    exerciseName: string,
    formScore: number,
    repCount: number,
  ): Promise<AgentResult<{ observationId: string }>> {
    const startTime = Date.now();
    const { userProfile } = context;

    try {
      const fhirPatient = await this.upsertFHIRPatient(userProfile);

      const observationBody = createExerciseObservation(
        fhirPatient.id,
        exerciseName,
        formScore,
        repCount,
      );

      const created = await this.fhirClient.createObservation(observationBody);

      return this.buildResult({ observationId: created.id }, startTime);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error recording session';
      return {
        success: false,
        data: undefined as unknown as { observationId: string },
        error: {
          code: 'RECORD_SESSION_FAILED',
          message,
          retryable: false,
        },
        metadata: {
          agentId: this.agentId,
          agentVersion: this.version,
          processingMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Use Claude to generate evidence-based clinical recommendations
   * for the patient based on their profile and assessed risk factors.
   */
  private async generateClinicalRecommendations(
    profile: UserProfile,
    riskFactors: RiskFactor[],
  ): Promise<ClinicalRecommendation[]> {
    const riskList =
      riskFactors.length > 0
        ? riskFactors
            .map((r) => `  - [${r.severity}] ${r.name}: ${r.description}`)
            .join('\n')
        : '  None identified';

    const conditionsList =
      profile.conditions.filter((c) => c.isActive).length > 0
        ? profile.conditions
            .filter((c) => c.isActive)
            .map((c) => `  - ${c.name}`)
            .join('\n')
        : '  None';

    const medicationsList =
      profile.medications.length > 0
        ? profile.medications.map((m) => `  - ${m.name} ${m.dosage}`).join('\n')
        : '  None';

    const systemPrompt = `You are an expert physiotherapist and clinical exercise specialist with extensive experience in evidence-based rehabilitation. Generate clinical recommendations for the patient described. Return ONLY valid JSON — an array of ClinicalRecommendation objects matching this schema:
[
  {
    "category": "exercise" | "medication" | "referral" | "lifestyle" | "monitoring",
    "recommendation": string,
    "urgency": "routine" | "urgent" | "emergent",
    "evidenceBasis": string
  }
]
Do NOT include any text outside the JSON array.`;

    const userPrompt = `Patient profile:
- Fitness level: ${profile.fitnessLevel}
- Primary goal: ${profile.primaryGoal}
- BMI: ${profile.bmi.toFixed(1)}
- Active conditions:
${conditionsList}
- Medications:
${medicationsList}

Assessed risk factors:
${riskList}

Generate 3–6 evidence-based clinical recommendations covering exercise modification, monitoring, lifestyle, and any referral needs. Base evidence on current clinical guidelines (e.g., ACSM, NICE, WHO).`;

    const response = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    if (textBlock === undefined) {
      throw new Error('Claude returned no text content for clinical recommendations');
    }

    return this.parseRecommendations(textBlock.text);
  }

  private parseRecommendations(content: string): ClinicalRecommendation[] {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch !== null ? jsonMatch[1] ?? content : content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      throw new Error(
        `Failed to parse ClinicalRecommendation JSON: ${raw.slice(0, 200)}`,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Expected ClinicalRecommendation JSON to be an array');
    }

    return parsed as ClinicalRecommendation[];
  }

  /**
   * Try to look up the patient by their PhysioCore id; create if not found.
   */
  private async upsertFHIRPatient(profile: UserProfile): Promise<FHIRPatient> {
    const existing = await this.fhirClient.searchPatients({
      identifier: `https://physiocore.ai/identifiers|${profile.id}`,
    });

    if (existing.length > 0 && existing[0] !== undefined) {
      return existing[0];
    }

    const patientBody = mapProfileToFHIRPatient(profile);
    return this.fhirClient.createPatient(patientBody);
  }

  private evaluateReferralNeed(
    riskFactors: RiskFactor[],
    profile: UserProfile,
  ): { referralNeeded: boolean; referralReason?: string } {
    const criticalRisks = riskFactors.filter((r) => r.severity === 'critical');
    if (criticalRisks.length > 0) {
      return {
        referralNeeded: true,
        referralReason: `Critical risk factors identified: ${criticalRisks.map((r) => r.name).join(', ')}. Immediate medical review required.`,
      };
    }

    if (profile.bmi < CRITICAL_BMI_LOW) {
      return {
        referralNeeded: true,
        referralReason: `Severely low BMI (${profile.bmi.toFixed(1)}) — refer to physician and registered dietitian before commencing exercise program.`,
      };
    }

    if (profile.bmi > CRITICAL_BMI_HIGH) {
      return {
        referralNeeded: true,
        referralReason: `BMI exceeds ${CRITICAL_BMI_HIGH} (${profile.bmi.toFixed(1)}) — medical clearance and supervised exercise program recommended.`,
      };
    }

    const highRisks = riskFactors.filter((r) => r.severity === 'high');
    const severeInjuries = profile.injuries.filter(
      (inj) => inj.isActive && inj.severity === 5,
    );

    if (highRisks.length >= 2 || severeInjuries.length > 0) {
      return {
        referralNeeded: true,
        referralReason: `Multiple high-severity risk factors or severe active injuries — physiotherapist referral recommended for supervised rehabilitation.`,
      };
    }

    return { referralNeeded: false };
  }

  private buildResult<T>(data: T, startTime: number): AgentResult<T> {
    return {
      success: true,
      data,
      metadata: {
        agentId: this.agentId,
        agentVersion: this.version,
        processingMs: Date.now() - startTime,
      },
    };
  }

  /** Expose the FHIR client for direct use by callers that need it. */
  get fhir(): FHIRClient {
    return this.fhirClient;
  }
}

// Re-export FHIR observation helper for callers that want to build observations manually
export { createExerciseObservation } from './riskAssessment.js';
