import type {
  UserProfile,
  AgentResult,
  PoseFrame,
  PoseAnalysis,
  PoseDeviation,
  FeedbackResponse,
  FormCorrection,
  NutritionPlan,
  ClinicalAssessment,
  BehaviorProfile,
  RetentionIntervention,
  AgentMetadata,
  FHIRPatient,
  ChurnRisk,
} from '@physiocore/types';
import type {
  OrchestratorConfig,
  ExerciseSessionResult,
  FullAssessmentResult,
} from './types.js';

function makeMetadata(agentId: string, startMs: number): AgentMetadata {
  return {
    agentId,
    agentVersion: '1.0.0',
    processingMs: Date.now() - startMs,
  };
}

function makeSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class AgentOrchestrator {
  private readonly config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  /**
   * Runs a complete exercise session: pose analysis + feedback generation.
   * When an Anthropic API key is present the feedback step would call the
   * real FeedbackAgent; for now both steps produce deterministic mock data
   * so the UI can run without credentials.
   */
  async runExerciseSession(
    userProfile: UserProfile,
    exerciseName: string,
    frames: PoseFrame[],
  ): Promise<ExerciseSessionResult> {
    const sessionId = makeSessionId();
    const wallStart = Date.now();

    const poseAnalysis = await this.analyzePose(frames, exerciseName);
    const feedback = await this.generateFeedback(
      userProfile,
      exerciseName,
      poseAnalysis,
    );

    return {
      sessionId,
      exerciseName,
      poseAnalysis,
      feedback,
      durationMs: Date.now() - wallStart,
    };
  }

  /**
   * Runs a full multi-agent assessment: clinical + nutrition + behavior.
   */
  async runFullAssessment(
    userProfile: UserProfile,
  ): Promise<FullAssessmentResult> {
    const assessmentId = makeSessionId().replace('session_', 'assessment_');
    const wallStart = Date.now();

    const [clinicalAssessment, nutritionPlan, behaviorProfile] =
      await Promise.all([
        this.runClinicalAssessment(userProfile),
        this.runNutritionPlanning(userProfile),
        this.runBehaviorAnalysis(userProfile),
      ]);

    const interventions = this.buildInterventions(behaviorProfile);

    return {
      assessmentId,
      clinicalAssessment,
      nutritionPlan,
      behaviorProfile,
      interventions,
      durationMs: Date.now() - wallStart,
    };
  }

  // ---------------------------------------------------------------------------
  // Private agent steps
  // ---------------------------------------------------------------------------

  private async analyzePose(
    frames: PoseFrame[],
    exerciseName: string,
  ): Promise<AgentResult<PoseAnalysis>> {
    const start = Date.now();
    await delay(120);

    const deviations: PoseDeviation[] = [
      {
        joint: 'left_knee',
        expectedAngle: 90,
        actualAngle: 75,
        severity: 'minor',
        recommendation: 'Lower slightly to reach full depth',
      },
    ];

    const data: PoseAnalysis = {
      frames,
      exerciseDetected: exerciseName,
      repCount: Math.max(1, Math.floor(frames.length / 3)),
      formScore: 78,
      jointAngles: {
        left_knee: 75,
        right_knee: 80,
        left_hip: 95,
        right_hip: 98,
        left_shoulder: 175,
        right_shoulder: 178,
      },
      deviations,
    };

    return { success: true, data, metadata: makeMetadata('pose-agent', start) };
  }

  private async generateFeedback(
    _userProfile: UserProfile,
    exerciseName: string,
    poseResult: AgentResult<PoseAnalysis>,
  ): Promise<AgentResult<FeedbackResponse>> {
    const start = Date.now();
    await delay(200);

    if (!poseResult.success || !poseResult.data) {
      return {
        success: false,
        error: {
          code: 'POSE_UNAVAILABLE',
          message: 'Cannot generate feedback without pose data',
          retryable: false,
        },
        metadata: makeMetadata('feedback-agent', start),
      };
    }

    const formCorrections: FormCorrection[] = poseResult.data.deviations.map(
      (d) => ({
        bodyPart: d.joint,
        issue: `Angle ${d.actualAngle}° vs expected ${d.expectedAngle}°`,
        instruction: d.recommendation,
        priority: d.severity === 'severe' ? 'stop' : d.severity === 'moderate' ? 'high' : 'medium',
      }),
    );

    const score = poseResult.data.formScore;
    const data: FeedbackResponse = {
      summary: `Good effort on your ${exerciseName}! Form score: ${score}/100. ${score >= 80 ? 'Excellent technique.' : 'A few adjustments will make a big difference.'}`,
      formCorrections,
      motivationalMessage:
        score >= 80
          ? 'Outstanding form — keep pushing!'
          : 'Small tweaks now build safe habits. You\'ve got this!',
      nextSteps: [
        'Focus on controlled descent',
        'Engage core throughout the movement',
        'Breathe out on the exertion phase',
      ],
      safetyWarnings:
        score < 60
          ? ['Reduce weight until form improves to avoid injury']
          : [],
    };

    return {
      success: true,
      data,
      metadata: makeMetadata('feedback-agent', start),
    };
  }

  private async runClinicalAssessment(
    userProfile: UserProfile,
  ): Promise<AgentResult<ClinicalAssessment>> {
    const start = Date.now();
    await delay(350);

    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: userProfile.id,
      identifier: [{ system: 'physiocore', value: userProfile.id }],
      name: [{ use: 'official', given: [userProfile.name], family: '' }],
      birthDate: userProfile.dateOfBirth,
      gender:
        userProfile.gender === 'non_binary' || userProfile.gender === 'prefer_not_to_say'
          ? 'other'
          : userProfile.gender,
    };

    const data: ClinicalAssessment = {
      patient,
      observations: [],
      riskFactors:
        userProfile.injuries.length > 0
          ? [
              {
                name: 'Active injury present',
                severity: 'moderate',
                description: `Patient reports ${userProfile.injuries.length} active injury(ies)`,
              },
            ]
          : [],
      clinicalRecommendations: [
        {
          category: 'exercise',
          recommendation: `Start with ${userProfile.fitnessLevel === 'beginner' ? 'low-impact' : 'progressive'} loading`,
          urgency: 'routine',
          evidenceBasis: 'ACSM exercise prescription guidelines',
        },
        {
          category: 'monitoring',
          recommendation: 'Track pain levels using a 0-10 NRS scale each session',
          urgency: 'routine',
          evidenceBasis: 'Clinical pain assessment standards',
        },
      ],
      referralNeeded: userProfile.injuries.some((i) => i.severity >= 4),
      referralReason:
        userProfile.injuries.some((i) => i.severity >= 4)
          ? 'High-severity injury warrants specialist evaluation'
          : undefined,
    };

    return {
      success: true,
      data,
      metadata: makeMetadata('clinical-agent', start),
    };
  }

  private async runNutritionPlanning(
    userProfile: UserProfile,
  ): Promise<AgentResult<NutritionPlan>> {
    const start = Date.now();
    await delay(280);

    const bmr = 10 * userProfile.weightKg + 6.25 * userProfile.heightCm - 5 * 30;
    const tdee = Math.round(bmr * 1.55);
    const proteinG = Math.round(userProfile.weightKg * 1.8);
    const fatG = Math.round((tdee * 0.25) / 9);
    const carbsG = Math.round((tdee - proteinG * 4 - fatG * 9) / 4);

    const data: NutritionPlan = {
      dailyCalorieTarget: tdee,
      macros: { proteinG, carbsG, fatG },
      mealPlan: [
        {
          meal: 'breakfast',
          name: 'Greek Yogurt Protein Bowl',
          ingredients: ['Greek yogurt', 'Berries', 'Granola', 'Honey'],
          calories: Math.round(tdee * 0.25),
          macros: {
            proteinG: Math.round(proteinG * 0.3),
            carbsG: Math.round(carbsG * 0.25),
            fatG: Math.round(fatG * 0.2),
          },
          prepTimeMinutes: 5,
        },
        {
          meal: 'lunch',
          name: 'Grilled Chicken & Quinoa Bowl',
          ingredients: ['Chicken breast', 'Quinoa', 'Spinach', 'Olive oil', 'Lemon'],
          calories: Math.round(tdee * 0.35),
          macros: {
            proteinG: Math.round(proteinG * 0.4),
            carbsG: Math.round(carbsG * 0.35),
            fatG: Math.round(fatG * 0.3),
          },
          prepTimeMinutes: 20,
        },
        {
          meal: 'dinner',
          name: 'Salmon with Sweet Potato',
          ingredients: ['Salmon fillet', 'Sweet potato', 'Broccoli', 'Olive oil'],
          calories: Math.round(tdee * 0.35),
          macros: {
            proteinG: Math.round(proteinG * 0.3),
            carbsG: Math.round(carbsG * 0.3),
            fatG: Math.round(fatG * 0.35),
          },
          prepTimeMinutes: 25,
        },
      ],
      supplements: [
        {
          name: 'Creatine Monohydrate',
          dosage: '5g',
          timing: 'Post-workout',
          rationale: 'Improves strength and muscle recovery',
          evidenceLevel: 'strong',
        },
        {
          name: 'Vitamin D3',
          dosage: '2000 IU',
          timing: 'With breakfast',
          rationale: 'Supports bone health and immune function',
          evidenceLevel: 'strong',
        },
      ],
      hydrationGoalMl: Math.round(userProfile.weightKg * 35),
      notes: `Calorie target based on estimated TDEE. Adjust by ±200 kcal based on ${userProfile.primaryGoal === 'rehabilitation' ? 'recovery progress' : 'performance goals'}.`,
    };

    return {
      success: true,
      data,
      metadata: makeMetadata('nutrition-agent', start),
    };
  }

  private async runBehaviorAnalysis(
    userProfile: UserProfile,
  ): Promise<AgentResult<BehaviorProfile>> {
    const start = Date.now();
    await delay(180);

    const adherenceScore = userProfile.fitnessLevel === 'athlete' ? 88
      : userProfile.fitnessLevel === 'advanced' ? 75
      : userProfile.fitnessLevel === 'intermediate' ? 62
      : 45;

    const churnScore = 1 - adherenceScore / 100;
    const churnLevel: ChurnRisk['level'] =
      churnScore < 0.2 ? 'low'
      : churnScore < 0.4 ? 'medium'
      : churnScore < 0.7 ? 'high'
      : 'critical';

    const data: BehaviorProfile = {
      userId: userProfile.id,
      adherenceScore,
      streakDays: Math.floor(adherenceScore / 10),
      longestStreakDays: Math.floor(adherenceScore / 6),
      totalSessionsCompleted: Math.floor(adherenceScore * 0.8),
      averageSessionDurationMin: userProfile.preferences.sessionDurationMinutes,
      churnRisk: {
        score: churnScore,
        level: churnLevel,
        factors:
          adherenceScore < 60
            ? ['Low session frequency', 'Short average duration']
            : ['Consistent engagement'],
        predictedChurnDate:
          churnLevel === 'critical'
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
      },
      motivationStyle: 'mastery',
      engagementPatterns: [
        { dayOfWeek: 1, hourOfDay: 7, sessionCount: 12, completionRate: 0.9 },
        { dayOfWeek: 3, hourOfDay: 18, sessionCount: 8, completionRate: 0.75 },
        { dayOfWeek: 6, hourOfDay: 9, sessionCount: 10, completionRate: 0.85 },
      ],
    };

    return {
      success: true,
      data,
      metadata: makeMetadata('behavior-agent', start),
    };
  }

  private buildInterventions(
    behaviorResult: AgentResult<BehaviorProfile>,
  ): RetentionIntervention[] {
    if (!behaviorResult.success || !behaviorResult.data) return [];

    const { churnRisk } = behaviorResult.data;
    const interventions: RetentionIntervention[] = [];

    if (churnRisk.level === 'critical' || churnRisk.level === 'high') {
      interventions.push({
        type: 'notification',
        message: "We miss you! Your body will thank you for getting back on track today.",
        triggerCondition: 'churn_risk_high',
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        priority: 1,
      });
    }

    if (churnRisk.level !== 'low') {
      interventions.push({
        type: 'difficulty_adjustment',
        message: 'Shorter, more frequent sessions may improve adherence',
        triggerCondition: 'adherence_drop',
        priority: 2,
      });
    }

    return interventions;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
