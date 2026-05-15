export { AssessmentOrchestrator } from './orchestrator/AssessmentOrchestrator.js';
export type {
  AssessmentInput,
  FullAssessmentResult,
  AgentReports,
  PostureCapture,
  FunctionalAnswers,
  AvailableData,
  StoredSession,
} from './orchestrator/AssessmentOrchestrator.js';

export { GaitAgent }         from './gait/GaitAgent.js';
export { ROMAgent }          from './rom/ROMAgent.js';
export { FunctionalAgent }   from './functional/FunctionalAgent.js';
export { runPainMapAgent }   from './pain/painMapAgent.js';
export { AdversarialAgent }  from './adversarial/AdversarialAgent.js';
export { ConsensusAgent }    from './consensus/ConsensusAgent.js';
export type { PainMapInput, PainMapReport, PainRegion, PainQuality, PainBehaviour } from './pain/painMapAgent.js';
export { SpecialTestsAgent, createSpecialTestsAgent } from './specialTests/SpecialTestsAgent.js';

// Phase 3 — Treatment Planning
export { ConservativeAgent }      from './treatment/ConservativeAgent.js';
export { EarlyMobAgent }          from './treatment/EarlyMobAgent.js';
export { TreatmentArbiterAgent }  from './treatment/TreatmentArbiterAgent.js';
export { ProgressionAgent }       from './treatment/ProgressionAgent.js';
export { PrescriptionAgent }      from './treatment/PrescriptionAgent.js';
export type { PrescriptionAgentInput, FilterableExercise } from './treatment/PrescriptionAgent.js';
export { TreatmentOrchestrator }  from './treatment/TreatmentOrchestrator.js';
export type { TreatmentOrchestratorInput, TreatmentOrchestratorResult } from './treatment/TreatmentOrchestrator.js';
export type {
  LoadingStrategy,
  TreatmentPlan,
  TreatmentPhase,
  PlanningInput,
  ArbiterInput,
  ArbiterVerdict,
  ProgressionInput,
  ProgressionOutput,
  FinalTreatmentPlan,
  WeekByWeekSchedule,
  PrescribedExerciseP3,
} from './types/phase3.js';
export type {
  FrameData,
  GaitReport,
  GaitDeviation,
  GaitMetrics,
  NormalizedLandmark,
  RedFlagAlert,
  EvidenceGrade,
  SessionSummary,
  JointROM,
  Asymmetry,
  Trend,
  ROMReport,
  FunctionalAgentInput,
  FunctionalReport,
  CompletedTest,
  SelectedSpecialTest,
  LikelyDiagnosis,
  SpecialTestsReport,
  PostureReport,
  AdversarialInput,
  AdversarialReport,
  Critique,
  SlimUserProfile,
  PainMapOutput,
  ConsensusInput,
  DiagnosticHypothesis,
  TreatmentPriority,
  PrescribedExercise,
  EvidenceCitation,
  ClinicalAssessmentReport,
} from './types/findings.js';
