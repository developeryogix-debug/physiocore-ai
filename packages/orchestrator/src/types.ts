import type {
  AgentResult,
  PoseAnalysis,
  FeedbackResponse,
  NutritionPlan,
  ClinicalAssessment,
  BehaviorProfile,
  RetentionIntervention,
} from '@physiocore/types';

export interface OrchestratorConfig {
  anthropicApiKey: string | undefined;
}

export interface ExerciseSessionResult {
  sessionId: string;
  exerciseName: string;
  poseAnalysis: AgentResult<PoseAnalysis>;
  feedback: AgentResult<FeedbackResponse>;
  durationMs: number;
}

export interface FullAssessmentResult {
  assessmentId: string;
  clinicalAssessment: AgentResult<ClinicalAssessment>;
  nutritionPlan: AgentResult<NutritionPlan>;
  behaviorProfile: AgentResult<BehaviorProfile>;
  interventions: RetentionIntervention[];
  durationMs: number;
}
