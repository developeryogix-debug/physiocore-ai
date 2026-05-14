export { GaitAgent }      from './gait/GaitAgent.js';
export { ROMAgent }       from './rom/ROMAgent.js';
export { runPainMapAgent } from './pain/painMapAgent.js';
export type { PainMapInput, PainMapReport, PainRegion, PainQuality, PainBehaviour } from './pain/painMapAgent.js';
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
} from './types/findings.js';
