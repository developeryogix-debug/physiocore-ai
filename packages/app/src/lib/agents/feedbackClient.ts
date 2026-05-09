import type { UserProfile, PoseAnalysis, PoseFrame, FeedbackResponse } from '@physiocore/types';
import { callClaude, extractJson } from './anthropicClient.js';

function angleFromLandmarks(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.sqrt((abx ** 2 + aby ** 2) * (cbx ** 2 + cby ** 2));
  return mag === 0 ? 0 : (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

interface JointStats { avg: number; min: number; max: number }

function extractJointStats(frames: PoseFrame[]): Record<string, JointStats> {
  if (frames.length === 0) return {};

  const buckets: Record<string, number[]> = {};

  for (const frame of frames) {
    const lm = frame.landmarks;
    const g = (name: string) => lm.find(l => l.name === name);

    const pairs: Array<[string, string, string, string]> = [
      ['left_knee',  'left_hip',      'left_knee',  'left_ankle'],
      ['right_knee', 'right_hip',     'right_knee', 'right_ankle'],
      ['left_hip',   'left_shoulder', 'left_hip',   'left_knee'],
      ['right_hip',  'right_shoulder','right_hip',  'right_knee'],
    ];

    for (const [key, an, bn, cn] of pairs) {
      const a = g(an), b = g(bn), c = g(cn);
      if (!a || !b || !c) continue;
      if (!buckets[key]) buckets[key] = [];
      buckets[key]!.push(angleFromLandmarks(a, b, c));
    }
  }

  const stats: Record<string, JointStats> = {};
  for (const [joint, values] of Object.entries(buckets)) {
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    stats[joint] = {
      avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
      min: Math.round(sorted[0] ?? 0),
      max: Math.round(sorted[sorted.length - 1] ?? 0),
    };
  }
  return stats;
}

export async function generateFeedback(
  poseAnalysis: PoseAnalysis,
  exerciseName: string,
  userProfile: UserProfile
): Promise<FeedbackResponse> {
  const activeInjuries = userProfile.injuries
    .filter(i => i.isActive)
    .map(i => `${i.bodyPart}(sev${i.severity})`)
    .join(',') || 'none';

  // Compact system prompt — under 300 tokens
  const system = `Physiotherapist. User:${userProfile.name},${userProfile.fitnessLevel},goal:${userProfile.primaryGoal},injuries:${activeInjuries}. Safety-first. Respond ONLY valid JSON:{"summary":string,"formCorrections":[{"bodyPart":string,"issue":string,"instruction":string,"priority":"low"|"medium"|"high"|"stop"}],"motivationalMessage":string,"nextSteps":string[],"safetyWarnings":string[]}`;

  // Extract compact angle stats from raw frames
  const jointStats = extractJointStats(poseAnalysis.frames);
  const statsLines = Object.entries(jointStats)
    .map(([j, s]) => `${j}:avg${s.avg}°,min${s.min}°,max${s.max}°`)
    .join('; ');

  // Worst and best deviations
  const sortedDev = [...poseAnalysis.deviations].sort((a, b) =>
    Math.abs(a.actualAngle - a.expectedAngle) > Math.abs(b.actualAngle - b.expectedAngle) ? -1 : 1
  );
  const worstDev = sortedDev[0];
  const worstLine = worstDev
    ? `worstDev:${worstDev.joint} ${worstDev.actualAngle}°(target ${worstDev.expectedAngle}°,${worstDev.severity})`
    : 'worstDev:none';

  const userMsg = `Ex:${exerciseName} reps:${poseAnalysis.repCount} score:${poseAnalysis.formScore}/100 ${worstLine}${statsLines ? ' joints:' + statsLines : ''} Feedback JSON:`;

  const text = await callClaude({ model: 'claude-haiku-4-5-20251001', system, messages: [{ role: 'user', content: userMsg }], maxTokens: 600 });
  return extractJson<FeedbackResponse>(text);
}
