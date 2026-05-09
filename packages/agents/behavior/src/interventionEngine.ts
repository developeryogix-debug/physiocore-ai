import type { BehaviorProfile, RetentionIntervention, MotivationStyle } from '@physiocore/types';

export function selectInterventions(
  profile: BehaviorProfile,
  maxInterventions: number = 3,
): RetentionIntervention[] {
  const interventions: RetentionIntervention[] = [];
  const { churnRisk, motivationStyle } = profile;

  // Motivation-style based interventions
  switch (motivationStyle) {
    case 'achievement':
      interventions.push({
        type: 'notification',
        message: 'You are close to your next milestone — keep going!',
        triggerCondition: 'milestone_proximity',
        priority: 2,
      });
      interventions.push({
        type: 'content',
        message: 'Challenge unlocked: recover your streak with 3 sessions this week.',
        triggerCondition: 'streak_broken',
        priority: 3,
      });
      break;

    case 'social':
      interventions.push({
        type: 'social',
        message: 'Join this week\'s community challenge and see how you rank!',
        triggerCondition: 'low_engagement',
        priority: 2,
      });
      interventions.push({
        type: 'notification',
        message: 'Share your progress — your community is cheering for you.',
        triggerCondition: 'session_completed',
        priority: 3,
      });
      break;

    case 'mastery':
      interventions.push({
        type: 'content',
        message: 'New technique tip: refine your form with this advanced variation.',
        triggerCondition: 'low_engagement',
        priority: 2,
      });
      interventions.push({
        type: 'content',
        message: 'You\'ve built a solid foundation — try this progression today.',
        triggerCondition: 'session_gap',
        priority: 3,
      });
      break;

    case 'purpose':
      interventions.push({
        type: 'notification',
        message: 'You started this journey with a goal. Here\'s how far you\'ve come.',
        triggerCondition: 'low_engagement',
        priority: 2,
      });
      interventions.push({
        type: 'content',
        message: 'Reminder: each session moves you closer to your stated outcome.',
        triggerCondition: 'session_gap',
        priority: 3,
      });
      break;

    case 'autonomy':
      interventions.push({
        type: 'content',
        message: 'Pick your session for today — you choose the exercise and duration.',
        triggerCondition: 'low_engagement',
        priority: 2,
      });
      interventions.push({
        type: 'notification',
        message: 'Flexible scheduling available: your next session, on your terms.',
        triggerCondition: 'session_gap',
        priority: 3,
      });
      break;
  }

  // Churn-level escalation
  if (churnRisk.level === 'critical') {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    interventions.unshift({
      type: 'notification',
      message: 'We miss you! Come back today and we\'ll unlock a special reward.',
      triggerCondition: 'critical_churn_risk',
      scheduledAt: now.toISOString(),
      priority: 1,
    });
    interventions.push({
      type: 'incentive',
      message: 'Exclusive offer: resume your program now and get a free coaching session.',
      triggerCondition: 'critical_churn_risk',
      priority: 1,
    });
  } else if (churnRisk.level === 'high') {
    interventions.unshift({
      type: 'content',
      message: 'Your program has been personalized based on your recent activity.',
      triggerCondition: 'high_churn_risk',
      priority: 1,
    });
    interventions.push({
      type: 'difficulty_adjustment',
      message: 'We\'ve adjusted today\'s session to fit your current pace — easier entry point ready.',
      triggerCondition: 'high_churn_risk',
      priority: 2,
    });
  } else if (churnRisk.level === 'medium') {
    interventions.push({
      type: 'notification',
      message: 'Just checking in — your next session is ready whenever you are.',
      triggerCondition: 'medium_churn_risk',
      priority: 3,
    });
  }

  // Deduplicate by type+triggerCondition, preserving order
  const seen = new Set<string>();
  const deduped: RetentionIntervention[] = [];
  for (const iv of interventions) {
    const key = `${iv.type}:${iv.triggerCondition}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(iv);
    }
  }

  return deduped.slice(0, maxInterventions);
}

export function detectMotivationStyle(profile: BehaviorProfile): MotivationStyle {
  const { adherenceScore, engagementPatterns, churnRisk } = profile;

  // Social: high adherence + varied day-of-week spread (social schedulers vary days)
  const uniqueDays = new Set(engagementPatterns.map(p => p.dayOfWeek)).size;
  if (adherenceScore >= 70 && uniqueDays >= 4) {
    return 'social';
  }

  // Mastery: consistently high completion rate across patterns
  if (engagementPatterns.length > 0) {
    const avgCompletion =
      engagementPatterns.reduce((sum, p) => sum + p.completionRate, 0) /
      engagementPatterns.length;
    if (avgCompletion >= 0.85 && adherenceScore >= 60) {
      return 'mastery';
    }
  }

  // Purpose: goal-directed, low churn risk despite moderate adherence
  if (churnRisk.level === 'low' && adherenceScore >= 50 && adherenceScore < 70) {
    return 'purpose';
  }

  // Autonomy: irregular patterns, low day-count but continues anyway
  if (uniqueDays <= 2 && adherenceScore >= 40) {
    return 'autonomy';
  }

  // Achievement: default for high-adherence users not matching above
  if (adherenceScore >= 60) {
    return 'achievement';
  }

  // Fallback
  return 'purpose';
}
