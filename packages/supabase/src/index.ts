// Supabase client
export { supabase } from './client.js';
export type { Database } from './client.js';

// Schema types — user_profiles
export type {
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
} from './schema.js';

// Schema types — sessions
export type {
  SessionRow,
  SessionInsert,
  SessionUpdate,
} from './schema.js';

// Schema types — pose_recordings
export type {
  PoseRecordingRow,
  PoseRecordingInsert,
  PoseRecordingUpdate,
} from './schema.js';

// Schema types — nutrition_plans
export type {
  NutritionPlanRow,
  NutritionPlanInsert,
  NutritionPlanUpdate,
} from './schema.js';

// Schema types — clinical_records
export type {
  ClinicalRecordRow,
  ClinicalRecordInsert,
  ClinicalRecordUpdate,
} from './schema.js';

// Schema types — behavior_profiles
export type {
  BehaviorProfileRow,
  BehaviorProfileInsert,
  BehaviorProfileUpdate,
} from './schema.js';

// Schema types — interventions
export type {
  InterventionRow,
  InterventionInsert,
  InterventionUpdate,
} from './schema.js';

// Repositories — user_profiles
export {
  getUserById,
  upsertUser,
  updateUserProfile,
} from './repositories/userRepository.js';

// Repositories — sessions
export {
  createSession,
  completeSession,
  getSessionsByUserId,
  getSessionById,
} from './repositories/sessionRepository.js';
