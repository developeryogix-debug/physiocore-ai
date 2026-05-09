export interface PoseAgentConfig {
  modelAssetPath: string;
  runningMode: 'IMAGE' | 'VIDEO';
  numPoses: number;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
}

export interface JointAngleCalculation {
  joint: string;
  pointA: string;
  pointB: string;
  pointC: string;
}

// MediaPipe landmark names (33 points)
export type LandmarkName =
  | 'nose' | 'left_eye_inner' | 'left_eye' | 'left_eye_outer'
  | 'right_eye_inner' | 'right_eye' | 'right_eye_outer'
  | 'left_ear' | 'right_ear' | 'mouth_left' | 'mouth_right'
  | 'left_shoulder' | 'right_shoulder' | 'left_elbow' | 'right_elbow'
  | 'left_wrist' | 'right_wrist' | 'left_pinky' | 'right_pinky'
  | 'left_index' | 'right_index' | 'left_thumb' | 'right_thumb'
  | 'left_hip' | 'right_hip' | 'left_knee' | 'right_knee'
  | 'left_ankle' | 'right_ankle' | 'left_heel' | 'right_heel'
  | 'left_foot_index' | 'right_foot_index';

export const LANDMARK_INDEX: Record<LandmarkName, number> = {
  nose: 0, left_eye_inner: 1, left_eye: 2, left_eye_outer: 3,
  right_eye_inner: 4, right_eye: 5, right_eye_outer: 6,
  left_ear: 7, right_ear: 8, mouth_left: 9, mouth_right: 10,
  left_shoulder: 11, right_shoulder: 12, left_elbow: 13, right_elbow: 14,
  left_wrist: 15, right_wrist: 16, left_pinky: 17, right_pinky: 18,
  left_index: 19, right_index: 20, left_thumb: 21, right_thumb: 22,
  left_hip: 23, right_hip: 24, left_knee: 25, right_knee: 26,
  left_ankle: 27, right_ankle: 28, left_heel: 29, right_heel: 30,
  left_foot_index: 31, right_foot_index: 32,
};

// Reference joint angle ranges per exercise, per joint
export interface ExerciseAngleRange {
  min: number;
  max: number;
  correction: string;
}

export type ExerciseReferenceAngles = Record<string, ExerciseAngleRange>;

export const EXERCISE_REFERENCE_ANGLES: Record<string, ExerciseReferenceAngles> = {
  squat: {
    left_knee: { min: 70, max: 110, correction: 'Keep knees at 90° at the bottom of the squat' },
    right_knee: { min: 70, max: 110, correction: 'Keep knees at 90° at the bottom of the squat' },
    left_hip: { min: 70, max: 110, correction: 'Hinge hips back, aim for parallel thighs' },
    right_hip: { min: 70, max: 110, correction: 'Hinge hips back, aim for parallel thighs' },
    left_shoulder: { min: 160, max: 200, correction: 'Keep torso upright, shoulders back' },
    right_shoulder: { min: 160, max: 200, correction: 'Keep torso upright, shoulders back' },
  },
  deadlift: {
    left_hip: { min: 45, max: 90, correction: 'Hinge at the hips, keep the bar close to the body' },
    right_hip: { min: 45, max: 90, correction: 'Hinge at the hips, keep the bar close to the body' },
    left_knee: { min: 140, max: 170, correction: 'Slight bend in the knees at setup' },
    right_knee: { min: 140, max: 170, correction: 'Slight bend in the knees at setup' },
    left_shoulder: { min: 170, max: 190, correction: 'Pull shoulders back and down, no rounding' },
    right_shoulder: { min: 170, max: 190, correction: 'Pull shoulders back and down, no rounding' },
  },
  pushup: {
    left_elbow: { min: 80, max: 100, correction: 'Lower until elbows reach 90°' },
    right_elbow: { min: 80, max: 100, correction: 'Lower until elbows reach 90°' },
    left_shoulder: { min: 40, max: 60, correction: 'Keep shoulders directly over wrists' },
    right_shoulder: { min: 40, max: 60, correction: 'Keep shoulders directly over wrists' },
    left_hip: { min: 170, max: 190, correction: 'Maintain a straight plank position, no sagging hips' },
    right_hip: { min: 170, max: 190, correction: 'Maintain a straight plank position, no sagging hips' },
  },
  lunge: {
    left_knee: { min: 80, max: 100, correction: 'Front knee should be at 90° directly above the ankle' },
    right_knee: { min: 80, max: 100, correction: 'Front knee should be at 90° directly above the ankle' },
    left_hip: { min: 80, max: 100, correction: 'Keep hips level and squared to the front' },
    right_hip: { min: 80, max: 100, correction: 'Keep hips level and squared to the front' },
    left_shoulder: { min: 165, max: 195, correction: 'Keep torso upright throughout the lunge' },
    right_shoulder: { min: 165, max: 195, correction: 'Keep torso upright throughout the lunge' },
  },
  shoulder_press: {
    left_elbow: { min: 80, max: 100, correction: 'Start with elbows at 90° at shoulder height' },
    right_elbow: { min: 80, max: 100, correction: 'Start with elbows at 90° at shoulder height' },
    left_shoulder: { min: 80, max: 100, correction: 'Keep shoulders depressed and packed throughout' },
    right_shoulder: { min: 80, max: 100, correction: 'Keep shoulders depressed and packed throughout' },
  },
};
