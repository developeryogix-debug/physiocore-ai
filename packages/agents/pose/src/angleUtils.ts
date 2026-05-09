import type { PoseLandmark } from '@physiocore/types';
import { LANDMARK_INDEX } from './types.js';
import type { LandmarkName } from './types.js';

/**
 * Calculates the interior angle (in degrees) at vertex b, formed by the vectors ba and bc.
 * Uses the dot-product formula: θ = arccos( (ba · bc) / (|ba| * |bc|) )
 */
export function calculateAngle(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
): number {
  const baX = a.x - b.x;
  const baY = a.y - b.y;
  const baZ = a.z - b.z;

  const bcX = c.x - b.x;
  const bcY = c.y - b.y;
  const bcZ = c.z - b.z;

  const dot = baX * bcX + baY * bcY + baZ * bcZ;
  const magBA = Math.sqrt(baX * baX + baY * baY + baZ * baZ);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY + bcZ * bcZ);

  if (magBA === 0 || magBC === 0) {
    return 0;
  }

  // Clamp to [-1, 1] to guard against floating-point errors in arccos
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Retrieves a landmark by name from the landmarks array.
 * Throws if the index is out of bounds (guards noUncheckedIndexedAccess).
 */
export function getLandmark(landmarks: PoseLandmark[], name: LandmarkName): PoseLandmark {
  const index = LANDMARK_INDEX[name];
  const lm = landmarks[index];
  if (lm === undefined) {
    throw new Error(`Landmark "${name}" (index ${index}) not present in landmarks array of length ${landmarks.length}`);
  }
  return lm;
}

/**
 * Computes the key joint angles from a landmarks array.
 * Returns a record of joint name -> angle in degrees.
 */
export function calculateJointAngles(landmarks: PoseLandmark[]): Record<string, number> {
  if (landmarks.length < 33) {
    return {};
  }

  const angles: Record<string, number> = {};

  try {
    const leftShoulder = getLandmark(landmarks, 'left_shoulder');
    const leftElbow = getLandmark(landmarks, 'left_elbow');
    const leftWrist = getLandmark(landmarks, 'left_wrist');
    angles['left_elbow'] = calculateAngle(leftShoulder, leftElbow, leftWrist);
  } catch {
    // Landmark not available; skip
  }

  try {
    const rightShoulder = getLandmark(landmarks, 'right_shoulder');
    const rightElbow = getLandmark(landmarks, 'right_elbow');
    const rightWrist = getLandmark(landmarks, 'right_wrist');
    angles['right_elbow'] = calculateAngle(rightShoulder, rightElbow, rightWrist);
  } catch {
    // Landmark not available; skip
  }

  try {
    const leftHip = getLandmark(landmarks, 'left_hip');
    const leftKnee = getLandmark(landmarks, 'left_knee');
    const leftAnkle = getLandmark(landmarks, 'left_ankle');
    angles['left_knee'] = calculateAngle(leftHip, leftKnee, leftAnkle);
  } catch {
    // Landmark not available; skip
  }

  try {
    const rightHip = getLandmark(landmarks, 'right_hip');
    const rightKnee = getLandmark(landmarks, 'right_knee');
    const rightAnkle = getLandmark(landmarks, 'right_ankle');
    angles['right_knee'] = calculateAngle(rightHip, rightKnee, rightAnkle);
  } catch {
    // Landmark not available; skip
  }

  try {
    const leftElbow = getLandmark(landmarks, 'left_elbow');
    const leftShoulder = getLandmark(landmarks, 'left_shoulder');
    const leftHip = getLandmark(landmarks, 'left_hip');
    angles['left_shoulder'] = calculateAngle(leftElbow, leftShoulder, leftHip);
  } catch {
    // Landmark not available; skip
  }

  try {
    const rightElbow = getLandmark(landmarks, 'right_elbow');
    const rightShoulder = getLandmark(landmarks, 'right_shoulder');
    const rightHip = getLandmark(landmarks, 'right_hip');
    angles['right_shoulder'] = calculateAngle(rightElbow, rightShoulder, rightHip);
  } catch {
    // Landmark not available; skip
  }

  try {
    const leftShoulder = getLandmark(landmarks, 'left_shoulder');
    const leftHip = getLandmark(landmarks, 'left_hip');
    const leftKnee = getLandmark(landmarks, 'left_knee');
    angles['left_hip'] = calculateAngle(leftShoulder, leftHip, leftKnee);
  } catch {
    // Landmark not available; skip
  }

  try {
    const rightShoulder = getLandmark(landmarks, 'right_shoulder');
    const rightHip = getLandmark(landmarks, 'right_hip');
    const rightKnee = getLandmark(landmarks, 'right_knee');
    angles['right_hip'] = calculateAngle(rightShoulder, rightHip, rightKnee);
  } catch {
    // Landmark not available; skip
  }

  return angles;
}
