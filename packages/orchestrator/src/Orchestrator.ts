import type {
  UserProfile,
  AgentContext,
  AgentResult,
  PoseFrame,
  FeedbackRequest,
  FeedbackResponse,
  PoseAnalysis,
  NutritionRequest,
  NutritionPlan,
  ClinicalAssessment,
  BehaviorProfile,
  RetentionIntervention,
} from '@physiocore/types';
import { PoseAgent } from '@physiocore/pose-agent';
import { FeedbackAgent } from '@physiocore/feedback-agent';
import { NutritionAgent } from '@physiocore/nutrition-agent';
import { ClinicalAgent } from '@physiocore/clinical-agent';
import { BehaviorAgent, type BehaviorAgentInput } from '@physiocore/behavior-agent';
import {
  createAgentContext,
  type OrchestratorConfig,
  defaultOrchestratorConfig,
} from './context.js';

export interface SessionOrchestratorResult {
  sessionId: string;
  poseAnalysis?: AgentResult<PoseAnalysis>;
  feedback?: AgentResult<FeedbackResponse>;
  requestId: string;
  completedAt: string;
}

export interface FullAssessmentResult {
  sessionId: string;
  clinical?: AgentResult<ClinicalAssessment>;
  nutrition?: AgentResult<NutritionPlan>;
  behavior?: AgentResult<{ profile: BehaviorProfile; interventions: RetentionIntervention[] }>;
  requestId: string;
  completedAt: string;
}

export class AgentOrchestrator {
  private readonly poseAgent: PoseAgent;
  private readonly feedbackAgent: FeedbackAgent;
  private readonly nutritionAgent: NutritionAgent;
  private readonly clinicalAgent: ClinicalAgent;
  private readonly behaviorAgent: BehaviorAgent;
  private readonly config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      ...defaultOrchestratorConfig,
      ...config,
      enabledAgents: {
        ...defaultOrchestratorConfig.enabledAgents,
        ...config.enabledAgents,
      },
    };
    const apiKey = this.config.anthropicApiKey;
    this.poseAgent = new PoseAgent();
    this.feedbackAgent = new FeedbackAgent(apiKey);
    this.nutritionAgent = new NutritionAgent(apiKey);
    this.clinicalAgent = new ClinicalAgent(this.config.fhirBaseUrl, apiKey);
    this.behaviorAgent = new BehaviorAgent(apiKey);
  }

  /**
   * Creates a shared AgentContext with UserProfile injected, ensuring all agents
   * have access to the same user context for this session.
   */
  createContext(userProfile: UserProfile, sessionId?: string): AgentContext {
    return createAgentContext(userProfile, sessionId);
  }

  /**
   * Initialise underlying agents that require async setup (e.g. MediaPipe model download).
   * Must be called before runExerciseSession when pose analysis is enabled.
   */
  async initialize(): Promise<void> {
    if (this.config.enabledAgents.pose) {
      await this.poseAgent.initialize();
    }
  }

  /**
   * Run a live exercise session: analyze pose frames, then generate feedback.
   * PoseAgent and FeedbackAgent run sequentially because feedback depends on pose output.
   */
  async runExerciseSession(
    frames: PoseFrame[],
    exerciseName: string,
    context: AgentContext,
  ): Promise<SessionOrchestratorResult> {
    const result: SessionOrchestratorResult = {
      sessionId: context.sessionId,
      requestId: context.requestId,
      completedAt: '',
    };

    // 1. PoseAgent: analyze all frames
    if (this.config.enabledAgents.pose) {
      result.poseAnalysis = await this.poseAgent.analyzeSession(frames, exerciseName, context);
    }

    // 2. FeedbackAgent: generate feedback from pose analysis (sequential dependency)
    if (
      this.config.enabledAgents.feedback &&
      result.poseAnalysis?.success === true &&
      result.poseAnalysis.data !== undefined
    ) {
      const feedbackRequest: FeedbackRequest = {
        poseAnalysis: result.poseAnalysis.data,
        exerciseName,
        targetReps: undefined,
      };
      result.feedback = await this.feedbackAgent.generateFeedback(feedbackRequest, context);
    }

    result.completedAt = new Date().toISOString();
    return result;
  }

  /**
   * Run full assessment: clinical + nutrition + behavior agents in parallel.
   * Individual failures are captured without failing the entire assessment.
   */
  async runFullAssessment(
    userProfile: UserProfile,
    nutritionRequest: NutritionRequest,
    behaviorInput: BehaviorAgentInput,
    sessionId?: string,
  ): Promise<FullAssessmentResult> {
    const context = this.createContext(userProfile, sessionId);

    const [clinicalOutcome, nutritionOutcome, behaviorOutcome] = await Promise.allSettled([
      this.config.enabledAgents.clinical
        ? this.clinicalAgent.assessPatient(context)
        : Promise.resolve(undefined),
      this.config.enabledAgents.nutrition
        ? this.nutritionAgent.generateNutritionPlan(nutritionRequest, context)
        : Promise.resolve(undefined),
      this.config.enabledAgents.behavior
        ? this.behaviorAgent.analyzeAndRetain(behaviorInput, context)
        : Promise.resolve(undefined),
    ]);

    return {
      sessionId: context.sessionId,
      clinical:
        clinicalOutcome.status === 'fulfilled' ? clinicalOutcome.value : undefined,
      nutrition:
        nutritionOutcome.status === 'fulfilled' ? nutritionOutcome.value : undefined,
      behavior:
        behaviorOutcome.status === 'fulfilled' ? behaviorOutcome.value : undefined,
      requestId: context.requestId,
      completedAt: new Date().toISOString(),
    };
  }
}
