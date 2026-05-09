import type { UserProfile } from './user.js';

// Base context injected into every agent call
export interface AgentContext {
  userProfile: UserProfile;
  sessionId: string;
  timestamp: string;
  requestId: string;
}

// Base result shape all agents return
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AgentError;
  metadata: AgentMetadata;
}

export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AgentMetadata {
  agentId: string;
  agentVersion: string;
  processingMs: number;
  tokensUsed?: number;
}

// PoseAgent types
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  name: string;
}

export interface PoseFrame {
  landmarks: PoseLandmark[];
  timestamp: number;
  worldLandmarks?: PoseLandmark[];
}

export interface PoseAnalysis {
  frames: PoseFrame[];
  exerciseDetected: string | null;
  repCount: number;
  formScore: number; // 0-100
  jointAngles: Record<string, number>;
  deviations: PoseDeviation[];
}

export interface PoseDeviation {
  joint: string;
  expectedAngle: number;
  actualAngle: number;
  severity: 'minor' | 'moderate' | 'severe';
  recommendation: string;
}

// FeedbackAgent types
export interface FeedbackRequest {
  userProfile: import('./user.js').UserProfile;
  poseAnalysis: PoseAnalysis;
  exerciseName: string;
  targetReps?: number;
  sessionNotes?: string;
}

export interface FeedbackResponse {
  summary: string;
  formCorrections: FormCorrection[];
  motivationalMessage: string;
  nextSteps: string[];
  safetyWarnings: string[];
}

export interface FormCorrection {
  bodyPart: string;
  issue: string;
  instruction: string;
  priority: 'low' | 'medium' | 'high' | 'stop';
}

// NutritionAgent types
export interface NutritionRequest {
  goal: 'recovery' | 'performance' | 'weight_loss' | 'muscle_gain';
  dietaryRestrictions: string[];
  currentMeals?: string;
}

export interface NutritionPlan {
  dailyCalorieTarget: number;
  macros: Macros;
  mealPlan: MealSuggestion[];
  supplements: SupplementRecommendation[];
  hydrationGoalMl: number;
  notes: string;
}

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealSuggestion {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  ingredients: string[];
  calories: number;
  macros: Macros;
  prepTimeMinutes: number;
}

export interface SupplementRecommendation {
  name: string;
  dosage: string;
  timing: string;
  rationale: string;
  evidenceLevel: 'strong' | 'moderate' | 'limited';
}

// ClinicalAgent types (FHIR R4)
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier: FHIRIdentifier[];
  name: FHIRHumanName[];
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  address?: FHIRAddress[];
}

export interface FHIRIdentifier {
  system: string;
  value: string;
}

export interface FHIRHumanName {
  use: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  family?: string;
  given?: string[];
}

export interface FHIRAddress {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  effectiveDateTime?: string;
  valueQuantity?: FHIRQuantity;
  component?: FHIRObservationComponent[];
}

export interface FHIRCodeableConcept {
  coding: FHIRCoding[];
  text?: string;
}

export interface FHIRCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FHIRReference {
  reference: string;
  display?: string;
}

export interface FHIRQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FHIRObservationComponent {
  code: FHIRCodeableConcept;
  valueQuantity?: FHIRQuantity;
}

export interface ClinicalAssessment {
  patient: FHIRPatient;
  observations: FHIRObservation[];
  riskFactors: RiskFactor[];
  clinicalRecommendations: ClinicalRecommendation[];
  referralNeeded: boolean;
  referralReason?: string;
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
  loincCode?: string;
}

export interface ClinicalRecommendation {
  category: 'exercise' | 'medication' | 'referral' | 'lifestyle' | 'monitoring';
  recommendation: string;
  urgency: 'routine' | 'urgent' | 'emergent';
  evidenceBasis: string;
}

// BehaviorAgent types
export interface BehaviorProfile {
  userId: string;
  adherenceScore: number; // 0-100
  streakDays: number;
  longestStreakDays: number;
  totalSessionsCompleted: number;
  averageSessionDurationMin: number;
  churnRisk: ChurnRisk;
  motivationStyle: MotivationStyle;
  engagementPatterns: EngagementPattern[];
}

export interface ChurnRisk {
  score: number; // 0-1
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  predictedChurnDate?: string;
}

export type MotivationStyle =
  | 'achievement' | 'social' | 'mastery' | 'purpose' | 'autonomy';

export interface EngagementPattern {
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  sessionCount: number;
  completionRate: number;
}

export interface RetentionIntervention {
  type: 'notification' | 'incentive' | 'content' | 'social' | 'difficulty_adjustment';
  message: string;
  triggerCondition: string;
  scheduledAt?: string;
  priority: 1 | 2 | 3;
}
