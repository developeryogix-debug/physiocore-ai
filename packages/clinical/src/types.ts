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
  | 'infection';
