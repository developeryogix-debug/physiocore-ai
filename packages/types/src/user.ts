export interface UserProfile {
  id: string;
  email: string;
  name: string;
  dateOfBirth: string; // ISO 8601
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  heightCm: number;
  weightKg: number;
  bmi: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | 'athlete';
  primaryGoal: 'rehabilitation' | 'strengthening' | 'flexibility' | 'pain_management' | 'performance';
  injuries: Injury[];
  conditions: MedicalCondition[];
  medications: Medication[];
  preferences: UserPreferences;
  subscription: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
}

export interface Injury {
  id: string;
  bodyPart: BodyPart;
  type: 'acute' | 'chronic' | 'overuse';
  severity: 1 | 2 | 3 | 4 | 5;
  dateOfInjury?: string;
  isActive: boolean;
  notes?: string;
}

export interface MedicalCondition {
  id: string;
  name: string;
  icdCode?: string; // ICD-10 code
  diagnosedAt?: string;
  isActive: boolean;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate?: string;
}

export interface UserPreferences {
  sessionDurationMinutes: number;
  preferredIntensity: 'low' | 'moderate' | 'high';
  equipmentAvailable: Equipment[];
  notificationsEnabled: boolean;
  language: string;
  timezone: string;
}

export type BodyPart =
  | 'neck' | 'shoulder_left' | 'shoulder_right'
  | 'elbow_left' | 'elbow_right' | 'wrist_left' | 'wrist_right'
  | 'upper_back' | 'lower_back' | 'hip_left' | 'hip_right'
  | 'knee_left' | 'knee_right' | 'ankle_left' | 'ankle_right'
  | 'foot_left' | 'foot_right' | 'core' | 'full_body';

export type Equipment =
  | 'none' | 'resistance_bands' | 'dumbbells' | 'barbell'
  | 'pull_up_bar' | 'foam_roller' | 'yoga_mat' | 'kettlebell'
  | 'cable_machine' | 'treadmill' | 'stationary_bike';

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'clinical';
