export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface JointAssessment {
  joint: string;
  normalROM: { movement: string; degrees: number; citation: string }[];
  specialTests: SpecialTest[];
  redFlags: string[];
  icdCodes: string[];
  cptCodes: string[];
}

export interface SpecialTest {
  name: string;
  procedure: string;
  sensitivity: number;
  specificity: number;
  citation: string;
  /** Flag when pooled data are sparse or conflicting — review before clinical use */
  needsReview?: true;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  jointActions: string[];
  contraindications: string[];
  progressions: string[];
  regressions: string[];
  evidenceGrade: EvidenceGrade;
  primaryReference: string;
  videoSearchTerms: string[];
  icdCodes: string[];
  cptCodes: string[];
}

export type RedFlag =
  | 'cauda_equina'
  | 'cord_compression'
  | 'atlantoaxial_instability'
  | 'aortic_aneurysm'
  | 'cancer'
  | 'fracture'
  | 'dvt'
  | 'stroke'
  | 'meningitis'
  | 'acute_cardiac'
  | 'safeguarding'
  | 'infection'
  | 'septic_arthritis'
  | 'vascular_injury'
  | 'brachial_neuritis';

// ─── Phase 1a: Joint Assessment Database types ───────────────────────────────

export interface ROMValue {
  min: number;
  max: number;
  unit: 'degrees' | 'cm' | 'mm';
  citation: string;
  /** Flag when published normal ranges conflict — review before clinical use */
  needsReview?: true;
}

export interface Pathology {
  name: string;
  icd10: string;
  description: string;
  commonPresentations: string[];
}

export interface CPTCode {
  code: string;
  description: string;
  notes?: string;
}

export interface RedFlagDetail {
  type: RedFlag;
  description: string;
  signsSymptoms: string[];
  immediateAction: string;
}

export interface JointData {
  joint: string;
  normalROM: Record<string, ROMValue>;
  specialTests: SpecialTest[];
  commonPathologies: Pathology[];
  redFlags: RedFlagDetail[];
  cptCodes: CPTCode[];
}
