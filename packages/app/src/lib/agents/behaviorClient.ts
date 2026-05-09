import type { BehaviorProfile, ChurnRisk, EngagementPattern, RetentionIntervention, MotivationStyle } from '@physiocore/types';

export interface SessionSummary {
  completedAt: string;
  durationMinutes: number;
  completed: boolean;
}

export interface BehaviorInput {
  sessionHistory: SessionSummary[];
  currentStreak: number;
  totalSessions: number;
  averageDurationMin: number;
  userId: string;
}

export interface BehaviorResult {
  profile: BehaviorProfile;
  interventions: RetentionIntervention[];
}

function detectEngagementPatterns(history: SessionSummary[]): EngagementPattern[] {
  const map = new Map<string, { count: number; completed: number }>();
  for (const s of history) {
    const d = new Date(s.completedAt);
    const key = `${d.getDay()}_${d.getHours()}`;
    const prev = map.get(key) ?? { count: 0, completed: 0 };
    map.set(key, { count: prev.count + 1, completed: prev.completed + (s.completed ? 1 : 0) });
  }
  return [...map.entries()]
    .map(([k, v]) => {
      const [day, hour] = k.split('_').map(Number);
      return { dayOfWeek: day ?? 0, hourOfDay: hour ?? 0, sessionCount: v.count, completionRate: v.count > 0 ? v.completed / v.count : 0 };
    })
    .sort((a, b) => b.sessionCount - a.sessionCount);
}

function calculateChurnRisk(adherenceScore: number, currentStreak: number, history: SessionSummary[]): ChurnRisk {
  const factors: string[] = [];
  let score = 0;

  // Adherence (weight 0.35)
  if (adherenceScore < 40) { score += 0.35; factors.push('Low adherence score'); }
  else if (adherenceScore < 70) { score += 0.15; factors.push('Below-average adherence'); }

  // Days since last session (weight 0.30)
  const lastSession = history.at(0);
  if (lastSession) {
    const daysSince = (Date.now() - new Date(lastSession.completedAt).getTime()) / (1000 * 3600 * 24);
    if (daysSince > 14) { score += 0.30; factors.push(`${Math.floor(daysSince)} days since last session`); }
    else if (daysSince > 7) { score += 0.20; factors.push(`${Math.floor(daysSince)} days inactive`); }
    else if (daysSince > 3) { score += 0.08; }
  } else {
    score += 0.30; factors.push('No session history');
  }

  // Streak (weight 0.20)
  if (currentStreak === 0) { score += 0.20; factors.push('No active streak'); }
  else if (currentStreak < 3) { score += 0.10; }

  // Completion rate (weight 0.15)
  if (history.length > 0) {
    const rate = history.filter((s) => s.completed).length / history.length;
    if (rate < 0.5) { score += 0.15; factors.push(`Low session completion rate (${Math.round(rate * 100)}%)`); }
    else if (rate < 0.7) { score += 0.07; }
  }

  const clamped = Math.min(1, Math.max(0, score));
  const level: ChurnRisk['level'] = clamped >= 0.8 ? 'critical' : clamped >= 0.6 ? 'high' : clamped >= 0.35 ? 'medium' : 'low';
  const predictedChurnDate = clamped > 0.6
    ? new Date(Date.now() + Math.round((1 - clamped) * 30) * 24 * 3600 * 1000).toISOString()
    : undefined;

  return { score: Math.round(clamped * 100) / 100, level, factors, predictedChurnDate };
}

function detectMotivationStyle(adherence: number, completionRate: number): MotivationStyle {
  if (adherence > 80 && completionRate > 0.85) return 'achievement';
  if (completionRate > 0.8) return 'mastery';
  if (adherence > 60) return 'purpose';
  if (adherence < 40) return 'autonomy';
  return 'social';
}

function buildInterventions(churnRisk: ChurnRisk, motivationStyle: MotivationStyle): RetentionIntervention[] {
  const items: RetentionIntervention[] = [];

  const styleMessages: Record<MotivationStyle, string> = {
    achievement: 'You\'re close to a new milestone — keep the streak alive!',
    social: 'Your training community is cheering for you — see their updates.',
    mastery: 'Unlock the next technique level — one session away.',
    purpose: 'Every session brings you closer to your recovery goal.',
    autonomy: 'Train on your terms — pick any exercise today.',
  };

  if (churnRisk.level === 'critical' || churnRisk.level === 'high') {
    items.push({ type: 'notification', message: styleMessages[motivationStyle] ?? 'We miss you!', triggerCondition: 'churn_risk_high', priority: 1 });
    items.push({ type: 'incentive', message: 'Complete today\'s session to earn a bonus achievement.', triggerCondition: 'churn_risk_high', priority: 2 });
  } else if (churnRisk.level === 'medium') {
    items.push({ type: 'content', message: 'New exercise variation added — try it in your next session!', triggerCondition: 'churn_risk_medium', priority: 2 });
  }

  return items;
}

export function analyzeBehavior(input: BehaviorInput): BehaviorResult {
  const { sessionHistory, currentStreak, totalSessions, averageDurationMin, userId } = input;
  const completionRate = sessionHistory.length > 0
    ? sessionHistory.filter((s) => s.completed).length / sessionHistory.length
    : 0;
  const adherenceScore = Math.min(100, Math.round(completionRate * 80 + Math.min(currentStreak * 2, 20)));
  const patterns = detectEngagementPatterns(sessionHistory);
  const motivationStyle = detectMotivationStyle(adherenceScore, completionRate);
  const churnRisk = calculateChurnRisk(adherenceScore, currentStreak, sessionHistory);

  const profile: BehaviorProfile = {
    userId,
    adherenceScore,
    streakDays: currentStreak,
    longestStreakDays: currentStreak,
    totalSessionsCompleted: totalSessions,
    averageSessionDurationMin: averageDurationMin,
    churnRisk,
    motivationStyle,
    engagementPatterns: patterns,
  };

  return { profile, interventions: buildInterventions(churnRisk, motivationStyle) };
}
