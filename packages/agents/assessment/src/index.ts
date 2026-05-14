export { GaitAgent }         from './gait/GaitAgent.js';
export { ROMAgent }          from './rom/ROMAgent.js';
export { FunctionalAgent }   from './functional/FunctionalAgent.js';
export { runPainMapAgent }   from './pain/painMapAgent.js';
export { AdversarialAgent }  from './adversarial/AdversarialAgent.js';
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
} from './types/findings.js';
