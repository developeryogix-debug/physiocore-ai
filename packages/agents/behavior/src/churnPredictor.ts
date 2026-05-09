import type { BehaviorProfile, ChurnRisk, EngagementPattern } from '@physiocore/types';

export interface SessionSummary {
  completedAt: string; // ISO 8601
  durationMinutes: number;
  completed: boolean;
}

export function calculateChurnRisk(profile: BehaviorProfile): ChurnRisk {
  let score = 0;
  const factors: string[] = [];

  // Factor 1: Adherence score (weight: 0.35)
  if (profile.adherenceScore < 40) {
    score += 0.35;
    factors.push('Low adherence score');
  } else if (profile.adherenceScore < 70) {
    score += 0.35 * 0.5;
    factors.push('Moderate adherence score');
  }

  // Factor 2: Days since last session (weight: 0.30)
  const daysSinceLast = daysSinceLastSession(profile.engagementPatterns);
  if (daysSinceLast > 14) {
    score += 0.30;
    factors.push('No session in over 14 days');
  } else if (daysSinceLast > 7) {
    score += 0.30 * 0.75;
    factors.push('No session in over 7 days');
  } else if (daysSinceLast > 3) {
    score += 0.30 * 0.4;
    factors.push('No session in over 3 days');
  }

  // Factor 3: Streak pattern (weight: 0.20)
  if (profile.streakDays === 0 && profile.longestStreakDays > 3) {
    score += 0.20 * 0.75;
    factors.push('Broken streak after consistent pattern');
  } else if (profile.streakDays === 0) {
    score += 0.20 * 0.15;
  }

  // Factor 4: Session completion rate (weight: 0.15)
  const completionRate = profile.totalSessionsCompleted > 0
    ? profile.totalSessionsCompleted / Math.max(profile.totalSessionsCompleted + estimateMissed(profile), 1)
    : 0;
  if (completionRate < 0.5) {
    score += 0.15;
    factors.push('Session completion rate below 50%');
  } else if (completionRate < 0.7) {
    score += 0.15 * 0.5;
    factors.push('Session completion rate below 70%');
  }

  const clampedScore = Math.min(1, Math.max(0, score));
  const level = classifyChurnLevel(clampedScore);

  const predictedChurnDate =
    clampedScore > 0.6
      ? predictChurnDate(clampedScore)
      : undefined;

  return {
    score: Math.round(clampedScore * 100) / 100,
    level,
    factors,
    ...(predictedChurnDate !== undefined ? { predictedChurnDate } : {}),
  };
}

export function detectEngagementPatterns(sessionHistory: SessionSummary[]): EngagementPattern[] {
  // Aggregate by (dayOfWeek, hourOfDay)
  const buckets = new Map<string, { dayOfWeek: number; hourOfDay: number; total: number; completed: number }>();

  for (const session of sessionHistory) {
    const date = new Date(session.completedAt);
    const dayOfWeek = date.getUTCDay();
    const hourOfDay = date.getUTCHours();
    const key = `${dayOfWeek}:${hourOfDay}`;

    const existing = buckets.get(key);
    if (existing !== undefined) {
      existing.total += 1;
      if (session.completed) existing.completed += 1;
    } else {
      buckets.set(key, {
        dayOfWeek,
        hourOfDay,
        total: 1,
        completed: session.completed ? 1 : 0,
      });
    }
  }

  const patterns: EngagementPattern[] = [];
  for (const bucket of buckets.values()) {
    patterns.push({
      dayOfWeek: bucket.dayOfWeek,
      hourOfDay: bucket.hourOfDay,
      sessionCount: bucket.total,
      completionRate: bucket.total > 0 ? bucket.completed / bucket.total : 0,
    });
  }

  // Sort descending by sessionCount
  patterns.sort((a, b) => b.sessionCount - a.sessionCount);
  return patterns;
}

function classifyChurnLevel(score: number): ChurnRisk['level'] {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

function daysSinceLastSession(patterns: EngagementPattern[]): number {
  // Without real timestamps on patterns, approximate from session count absence.
  // If no patterns at all, treat as very stale.
  if (patterns.length === 0) return 21;
  // If patterns exist, return a nominal small value — real implementations
  // would use actual last-session timestamps stored on the profile.
  return 2;
}

function estimateMissed(profile: BehaviorProfile): number {
  // Rough estimate: sessions missed = days since start minus total sessions
  // We use streak data as a proxy for activity window
  const windowDays = Math.max(profile.longestStreakDays * 1.5, profile.totalSessionsCompleted);
  return Math.max(0, Math.round(windowDays) - profile.totalSessionsCompleted);
}

function predictChurnDate(score: number): string {
  // Higher score = sooner churn; score of 1.0 → ~3 days, 0.6 → ~21 days
  const daysUntilChurn = Math.round(3 + (1 - score) * 45);
  const churnDate = new Date();
  churnDate.setDate(churnDate.getDate() + daysUntilChurn);
  return churnDate.toISOString().split('T')[0] ?? churnDate.toISOString();
}
