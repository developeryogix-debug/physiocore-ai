// ─── Phase 3 Treatment Planning Types ────────────────────────────────────────
// Spec: docs/PHASE3_TREATMENT_PLANNING.md
// SaMD Class II — every exercise recommendation cites primary evidence.

import type { ClinicalAssessmentReport, SessionSummary, SlimUserProfile } from './findings.js';

// ── Shared primitives ─────────────────────────────────────────────────────────

export type LoadingStrategy =
  | 'rest'         // tissue protection — no load
  | 'gentle'       // isometric only, pain-free
  | 'moderate'     // isotonic, controlled ROM, pain <4/10
  | 'progressive'  // full ROM, progressive overload, pain <6/10
  | 'high';        // sport-specific, power, high load

export interface PrescribedExerciseP3 {
  name:               string;
  sets:               number;
  reps:               number | null;
  holdSeconds:        number | null;
  frequencyPerWeek:   number;
  rationale:          string;
  cptCodeSuggestion?: string;
  loadingStrategy?:   LoadingStrategy;
}

export interface TreatmentPhase {
  phaseNumber:         number;
  label:               string;
  durationWeeks:       number;
  loadingStrategy:     LoadingStrategy;
  maxAcceptablePain:   number;          // 0–10 NRS
  exercises:           PrescribedExerciseP3[];
  homeProgram:         PrescribedExerciseP3[];
  progressionTrigger:  string;
  regressionTrigger:   string;
  sessionFrequency:    number;
  sessionDurationMin:  number;
  clinicianNotes:      string;
  citations:           string[];
}

export interface TreatmentPlan {
  agentId:            'conservative-agent' | 'early-mob-agent';
  version:            '1.0.0';
  patientId:          string;
  assessmentId:       string;
  generatedAt:        string;

  philosophy:         string;
  totalDurationWeeks: number;
  phases:             TreatmentPhase[];

  contraindications:  string[];
  redLineConditions:  string[];
  expectedOutcomes:   Array<{ outcome: string; timeframe: string; measure: string }>;
  evidenceBasis:      string[];

  cptCodes:           string[];
  icd10Codes:         string[];
  processingMs:       number;
}

// ── PlanningInput (shared by both ConservativeAgent and EarlyMobAgent) ────────

export interface PlanningInput {
  assessmentId:      string;
  patientId:         string;
  consensusReport:   ClinicalAssessmentReport;
  userProfile:       SlimUserProfile;
  availableExercises: Array<{
    name:               string;
    evidenceGrade?:     string;
    rationale:          string;
    cptCodeSuggestion?: string;
  }>;
  jointNormativeROM?: Record<string, Record<string, { min: number; max: number }>>;
  equipmentAvailable?: string[];
  fitnessLevel?:      'beginner' | 'intermediate' | 'advanced' | 'general';
  currentPainLevel?:  number;   // 0–10 NPRS
  psfsAverage?:       number;   // 0–10
  phq4Score?:         number;   // 0–12
  sessionHistory?:    SessionSummary[];
}

// ── TreatmentArbiterAgent I/O ─────────────────────────────────────────────────

export interface ArbiterInput {
  patientId:    string;
  assessmentId: string;
  conservative: TreatmentPlan;
  earlyMob:     TreatmentPlan;
  userProfile:  SlimUserProfile;
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
}

export interface ArbiterVerdict {
  winner:           'conservative' | 'early_mob' | 'hybrid';
  hybridRationale:  string | null;
  phaseSource:      Array<{ phaseNumber: number; source: 'conservative' | 'early_mob' | 'modified'; modification?: string }>;
  rejectedElements: Array<{ fromPlan: 'conservative' | 'early_mob'; element: string; reason: string; risk: 'safety' | 'evidence' | 'patient_fit' }>;
  safetyOverrides:  string[];
  arbitrationReason: string;
  confidenceScore:  number;
  processingMs:     number;
}

// ── ProgressionAgent I/O ──────────────────────────────────────────────────────

export interface ProgressionInput {
  patientId:         string;
  currentPlan:       FinalTreatmentPlan;
  currentWeek:       number;
  recentSessions:    SessionSummary[];
  recentPainScores:  number[];
  recentPSFS?:       number[];
}

export interface ProgressionOutput {
  action:             'advance' | 'hold' | 'regress' | 'modify';
  targetPhase:        number;
  reasoning:          string;
  progressScore:      number;
  formScoreSlope:     number;
  sessionsTrend:      'improving' | 'plateaued' | 'declining';
  updatedExercises:   PrescribedExerciseP3[];
  newLoadingStrategy: LoadingStrategy;
  flagsForClinician:  string[];
  processingMs:       number;
}

// ── PrescriptionAgent I/O ─────────────────────────────────────────────────────

export interface WeekByWeekSchedule {
  week:               number;
  phase:              number;
  sessionCount:       number;
  sessionDurationMin: number;
  exercises:          PrescribedExerciseP3[];
  homeProgram:        PrescribedExerciseP3[];
  reviewMilestone?:   string;
}

export interface FinalTreatmentPlan {
  agentId:             'prescription-agent';
  version:             '1.0.0';
  patientId:           string;
  assessmentId:        string;
  generatedAt:         string;

  sourcePlan:          ArbiterVerdict['winner'];
  totalDurationWeeks:  number;
  phases:              TreatmentPhase[];
  weeklySchedule:      WeekByWeekSchedule[];

  contraindications:   string[];
  redLineConditions:   string[];
  progressionTriggers: string[];

  cptCodes:            string[];
  icd10Codes:          string[];
  fhirCarePlan:        Record<string, unknown>;

  patientInstructions: string;
  clinicianNotes:      string;
  evidenceBasis:       string[];
  processingMs:        number;
}
