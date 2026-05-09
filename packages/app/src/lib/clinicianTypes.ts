export interface MockSession {
  date: string;
  exercise: string;
  reps: number;
  formScore: number;
  durationMin: number;
  viewMode: string;
  peakAngle?: number;
  flags?: string[];
}

export interface MockPatient {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  dob: string;
  conditions: string[];
  medications: string[];
  goal: string;
  fitnessLevel: string;
  heightCm: number;
  weightKg: number;
  churnRisk: 'low' | 'medium' | 'high';
  adherencePct: number;
  sessions: MockSession[];
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  cptCodes: string[];
  cptDescriptions: string[];
}

export interface HepExercise {
  name: string;
  description: string;
  sets: number;
  reps: string;
  frequency: string;
  cue: string;
}

export const CPT_DESCRIPTIONS: Record<string, string> = {
  '97110': 'Therapeutic Exercise — 1+ body area, 15 min units',
  '97530': 'Therapeutic Activities — functional performance, 15 min',
  '97150': 'Therapeutic Exercises, Group (2+ patients)',
  '97012': 'Mechanical traction therapy',
  '97140': 'Manual therapy techniques — 15 min units',
};
