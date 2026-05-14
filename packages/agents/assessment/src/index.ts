export { AssessmentOrchestrator } from './orchestrator/AssessmentOrchestrator.js';
export type {
  AssessmentInput,
  FullAssessmentResult,
  AgentReports,
  ClinicalAssessmentReport,
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
} from './types/findings.js';
