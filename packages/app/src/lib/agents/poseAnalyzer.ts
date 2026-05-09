import type { PoseFrame, PoseAnalysis, PoseDeviation } from '@physiocore/types';

const REFERENCE_ANGLES: Record<string, Record<string, [number, number]>> = {
  squat:          { left_knee: [70, 100], right_knee: [70, 100], left_hip: [70, 110], right_hip: [70, 110] },
  deadlift:       { left_knee: [150, 175], right_knee: [150, 175], left_hip: [80, 140], right_hip: [80, 140] },
  pushup:         { left_elbow: [60, 100], right_elbow: [60, 100], left_shoulder: [40, 70], right_shoulder: [40, 70] },
  lunge:          { left_knee: [80, 100], right_knee: [80, 100] },
  shoulder_press: { left_elbow: [85, 100], right_elbow: [85, 100] },
};

function vec(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function angleDeg(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const ab = vec(a, b);
  const cb = vec(c, b);
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2) * (cb.x ** 2 + cb.y ** 2));
  return mag === 0 ? 0 : (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function landmarkPos(frame: PoseFrame, name: string): { x: number; y: number } | null {
  const lm = frame.landmarks.find((l) => l.name === name);
  return lm ?? null;
}

function frameAngles(frame: PoseFrame): Record<string, number> {
  const g = (name: string) => landmarkPos(frame, name);
  const angles: Record<string, number> = {};

  const ls = g('left_shoulder'), le = g('left_elbow'), lw = g('left_wrist');
  const rs = g('right_shoulder'), re = g('right_elbow'), rw = g('right_wrist');
  const lh = g('left_hip'), lk = g('left_knee'), la = g('left_ankle');
  const rh = g('right_hip'), rk = g('right_knee'), ra = g('right_ankle');

  if (ls && le && lw) angles['left_elbow'] = angleDeg(ls, le, lw);
  if (rs && re && rw) angles['right_elbow'] = angleDeg(rs, re, rw);
  if (lh && lk && la) angles['left_knee'] = angleDeg(lh, lk, la);
  if (rh && rk && ra) angles['right_knee'] = angleDeg(rh, rk, ra);
  if (ls && lh && lk) angles['left_hip'] = angleDeg(ls, lh, lk);
  if (rs && rh && rk) angles['right_hip'] = angleDeg(rs, rh, rk);
  if (le && ls && lh) angles['left_shoulder'] = angleDeg(le, ls, lh);
  if (re && rs && rh) angles['right_shoulder'] = angleDeg(re, rs, rh);

  return angles;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

export function analyzeFrames(frames: PoseFrame[], exerciseName: string): PoseAnalysis {
  if (frames.length === 0) {
    return { frames, exerciseDetected: exerciseName, repCount: 0, formScore: 0, jointAngles: {}, deviations: [] };
  }

  const allAngles = frames.map(frameAngles);
  const joints = Object.keys(allAngles[0] ?? {});
  const avgAngles: Record<string, number> = {};
  for (const joint of joints) {
    avgAngles[joint] = average(allAngles.map((a) => a[joint] ?? 0).filter((v) => v > 0));
  }

  const refs = REFERENCE_ANGLES[exerciseName] ?? {};
  const deviations: PoseDeviation[] = [];
  let penaltyTotal = 0;

  for (const [joint, [lo, hi]] of Object.entries(refs)) {
    const actual = avgAngles[joint];
    if (actual === undefined) continue;
    const midpoint = (lo + hi) / 2;
    const range = (hi - lo) / 2;
    const deviation = Math.max(0, Math.abs(actual - midpoint) - range);
    if (deviation > 5) {
      const severity: PoseDeviation['severity'] = deviation > 20 ? 'severe' : deviation > 10 ? 'moderate' : 'minor';
      penaltyTotal += deviation;
      deviations.push({
        joint,
        expectedAngle: Math.round(midpoint),
        actualAngle: Math.round(actual),
        severity,
        recommendation: `Adjust ${joint.replace('_', ' ')} — target ${lo}°–${hi}°, currently ${Math.round(actual)}°`,
      });
    }
  }

  const formScore = Math.max(0, Math.min(100, Math.round(100 - penaltyTotal / (Object.keys(refs).length || 1))));

  // Simple rep counter: count times any knee angle crosses below 100°
  let repCount = 0;
  let wasUp = true;
  for (const angles of allAngles) {
    const knee = ((angles['left_knee'] ?? 180) + (angles['right_knee'] ?? 180)) / 2;
    if (wasUp && knee < 100) { repCount++; wasUp = false; }
    else if (!wasUp && knee > 140) wasUp = true;
  }

  return { frames, exerciseDetected: exerciseName, repCount, formScore, jointAngles: avgAngles, deviations };
}
