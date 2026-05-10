import type {
  Injury,
  MedicalCondition,
  Medication,
  UserPreferences,
  BodyPart,
  Equipment,
  SubscriptionTier,
  PoseFrame,
  NutritionPlan,
  FHIRPatient,
  FHIRObservation,
  ClinicalAssessment,
  BehaviorProfile,
  RetentionIntervention,
  AgentResult,
} from '@physiocore/types';

// ─── user_profiles ───────────────────────────────────────────────────────────

export interface UserProfileRow {
  id: string;
  email: string;
  name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  height_cm: number;
  weight_kg: number;
  bmi: number;
  fitness_level: 'beginner' | 'intermediate' | 'advanced' | 'athlete';
  primary_goal: 'rehabilitation' | 'strengthening' | 'flexibility' | 'pain_management' | 'performance';
  injuries: Injury[];
  conditions: MedicalCondition[];
  medications: Medication[];
  preferences: UserPreferences;
  subscription: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

export interface UserProfileInsert {
  id?: string;
  email: string;
  name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  height_cm: number;
  weight_kg: number;
  bmi: number;
  fitness_level: 'beginner' | 'intermediate' | 'advanced' | 'athlete';
  primary_goal: 'rehabilitation' | 'strengthening' | 'flexibility' | 'pain_management' | 'performance';
  injuries?: Injury[];
  conditions?: MedicalCondition[];
  medications?: Medication[];
  preferences: UserPreferences;
  subscription?: SubscriptionTier;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfileUpdate {
  email?: string;
  name?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  height_cm?: number;
  weight_kg?: number;
  bmi?: number;
  fitness_level?: 'beginner' | 'intermediate' | 'advanced' | 'athlete';
  primary_goal?: 'rehabilitation' | 'strengthening' | 'flexibility' | 'pain_management' | 'performance';
  injuries?: Injury[];
  conditions?: MedicalCondition[];
  medications?: Medication[];
  preferences?: UserPreferences;
  subscription?: SubscriptionTier;
  updated_at?: string;
}

// ─── sessions ────────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  exercise_name: string | null;
  form_score: number | null;
  rep_count: number | null;
  agent_results: Record<string, AgentResult> | null;
}

export interface SessionInsert {
  id?: string;
  user_id: string;
  started_at?: string;
  ended_at?: string | null;
  exercise_name?: string | null;
  form_score?: number | null;
  rep_count?: number | null;
  agent_results?: Record<string, AgentResult> | null;
}

export interface SessionUpdate {
  ended_at?: string | null;
  exercise_name?: string | null;
  form_score?: number | null;
  rep_count?: number | null;
  agent_results?: Record<string, AgentResult> | null;
}

// ─── pose_recordings ─────────────────────────────────────────────────────────

export interface PoseRecordingRow {
  id: string;
  session_id: string;
  user_id: string;
  landmarks: PoseFrame[];
  recorded_at: string;
}

export interface PoseRecordingInsert {
  id?: string;
  session_id: string;
  user_id: string;
  landmarks: PoseFrame[];
  recorded_at?: string;
}

export interface PoseRecordingUpdate {
  landmarks?: PoseFrame[];
}

// ─── nutrition_plans ─────────────────────────────────────────────────────────

export interface NutritionPlanRow {
  id: string;
  user_id: string;
  plan: NutritionPlan;
  valid_from: string;
  valid_to: string | null;
}

export interface NutritionPlanInsert {
  id?: string;
  user_id: string;
  plan: NutritionPlan;
  valid_from: string;
  valid_to?: string | null;
}

export interface NutritionPlanUpdate {
  plan?: NutritionPlan;
  valid_from?: string;
  valid_to?: string | null;
}

// ─── clinical_records ────────────────────────────────────────────────────────

export interface ClinicalRecordRow {
  id: string;
  user_id: string;
  fhir_patient: FHIRPatient;
  observations: FHIRObservation[];
  assessment: ClinicalAssessment;
  created_at: string;
}

export interface ClinicalRecordInsert {
  id?: string;
  user_id: string;
  fhir_patient: FHIRPatient;
  observations: FHIRObservation[];
  assessment: ClinicalAssessment;
  created_at?: string;
}

export interface ClinicalRecordUpdate {
  fhir_patient?: FHIRPatient;
  observations?: FHIRObservation[];
  assessment?: ClinicalAssessment;
}

// ─── behavior_profiles ───────────────────────────────────────────────────────

export interface BehaviorProfileRow {
  id: string;
  user_id: string;
  profile: BehaviorProfile;
  updated_at: string;
}

export interface BehaviorProfileInsert {
  id?: string;
  user_id: string;
  profile: BehaviorProfile;
  updated_at?: string;
}

export interface BehaviorProfileUpdate {
  profile?: BehaviorProfile;
  updated_at?: string;
}

// ─── interventions ───────────────────────────────────────────────────────────

export interface InterventionRow {
  id: string;
  user_id: string;
  intervention: RetentionIntervention;
  sent_at: string;
  responded: boolean;
}

export interface InterventionInsert {
  id?: string;
  user_id: string;
  intervention: RetentionIntervention;
  sent_at?: string;
  responded?: boolean;
}

export interface InterventionUpdate {
  responded?: boolean;
}

// ─── profiles ────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  role: 'patient' | 'clinician' | 'admin';
  created_at: string;
}

export interface ProfileInsert {
  id?: string;
  user_id: string;
  full_name: string;
  role?: 'patient' | 'clinician' | 'admin';
  created_at?: string;
}

export interface ProfileUpdate {
  full_name?: string;
  role?: 'patient' | 'clinician' | 'admin';
}

// ─── outcomes ────────────────────────────────────────────────────────────────

export interface OutcomeRow {
  id: string;
  user_id: string;
  type: 'psfs' | 'nprs' | 'groc' | 'phq4';
  score: number;
  metadata: Record<string, unknown> | null;
  recorded_at: string;
}

export interface OutcomeInsert {
  id?: string;
  user_id: string;
  type: 'psfs' | 'nprs' | 'groc' | 'phq4';
  score: number;
  metadata?: Record<string, unknown> | null;
  recorded_at?: string;
}

export interface OutcomeUpdate {
  score?: number;
  metadata?: Record<string, unknown> | null;
}

// ─── consents ────────────────────────────────────────────────────────────────

export interface ConsentRow {
  id: string;
  user_id: string;
  version: string;
  full_name: string;
  signed_at: string;
  ip_hash: string | null;
}

export interface ConsentInsert {
  id?: string;
  user_id: string;
  version?: string;
  full_name: string;
  signed_at?: string;
  ip_hash?: string | null;
}

export interface ConsentUpdate {
  full_name?: string;
  ip_hash?: string | null;
}

// ─── Database generic type ───────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
      };
      sessions: {
        Row: SessionRow;
        Insert: SessionInsert;
        Update: SessionUpdate;
      };
      pose_recordings: {
        Row: PoseRecordingRow;
        Insert: PoseRecordingInsert;
        Update: PoseRecordingUpdate;
      };
      nutrition_plans: {
        Row: NutritionPlanRow;
        Insert: NutritionPlanInsert;
        Update: NutritionPlanUpdate;
      };
      clinical_records: {
        Row: ClinicalRecordRow;
        Insert: ClinicalRecordInsert;
        Update: ClinicalRecordUpdate;
      };
      behavior_profiles: {
        Row: BehaviorProfileRow;
        Insert: BehaviorProfileInsert;
        Update: BehaviorProfileUpdate;
      };
      interventions: {
        Row: InterventionRow;
        Insert: InterventionInsert;
        Update: InterventionUpdate;
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      outcomes: {
        Row: OutcomeRow;
        Insert: OutcomeInsert;
        Update: OutcomeUpdate;
      };
      consents: {
        Row: ConsentRow;
        Insert: ConsentInsert;
        Update: ConsentUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      gender_type: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
      fitness_level_type: 'beginner' | 'intermediate' | 'advanced' | 'athlete';
      primary_goal_type: 'rehabilitation' | 'strengthening' | 'flexibility' | 'pain_management' | 'performance';
      subscription_tier_type: SubscriptionTier;
      body_part_type: BodyPart;
      equipment_type: Equipment;
    };
  };
}
