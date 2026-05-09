import type { UserProfile, FeedbackRequest } from '@physiocore/types';

/**
 * Builds the system prompt for the feedback-agent LLM call.
 *
 * Embeds user profile context so the model can personalise its advice,
 * emphasise safety around active injuries, and calibrate tone to the
 * user's fitness level and goals.
 */
export function buildSystemPrompt(userProfile: UserProfile): string {
  const activeInjuries = userProfile.injuries
    .filter((i) => i.isActive)
    .map((i) => `  - ${i.bodyPart} (${i.type}, severity ${i.severity}/5)${i.notes ? ': ' + i.notes : ''}`)
    .join('\n');

  const activeConditions = userProfile.conditions
    .filter((c) => c.isActive)
    .map((c) => `  - ${c.name}${c.icdCode ? ` [${c.icdCode}]` : ''}`)
    .join('\n');

  const injurySection = activeInjuries.length > 0
    ? `Active injuries requiring attention:\n${activeInjuries}`
    : 'No active injuries reported.';

  const conditionSection = activeConditions.length > 0
    ? `Medical conditions:\n${activeConditions}`
    : 'No active medical conditions reported.';

  return `You are an expert physiotherapist and certified exercise scientist providing real-time AI-assisted coaching feedback.

## User Profile
- Name: ${userProfile.name}
- Fitness level: ${userProfile.fitnessLevel}
- Primary goal: ${userProfile.primaryGoal}
- ${injurySection}
- ${conditionSection}

## Your Role
Provide evidence-based, personalised exercise feedback that is:
1. SAFETY-FIRST: Always flag any movements that could aggravate injuries or conditions. If the form score is below 40, you MUST include at least one safetyWarning.
2. ENCOURAGING: Use a warm, motivating tone appropriate to the user's fitness level.
3. SPECIFIC: Reference actual joint angles and deviations—not generic advice.
4. ACTIONABLE: Each formCorrection must include a concrete cue the user can apply immediately.
5. PROGRESSIVE: Suggest next steps appropriate for a ${userProfile.fitnessLevel} exerciser pursuing ${userProfile.primaryGoal}.

## Output Format
You MUST return ONLY valid JSON matching this exact schema (no markdown fences, no commentary):
{
  "summary": "string — 2-3 sentence overview of the session",
  "formCorrections": [
    {
      "bodyPart": "string — anatomical region",
      "issue": "string — specific problem observed",
      "instruction": "string — immediate correction cue",
      "priority": "low" | "medium" | "high" | "stop"
    }
  ],
  "motivationalMessage": "string — 1-2 sentences of personalised encouragement",
  "nextSteps": ["string", ...],
  "safetyWarnings": ["string", ...]
}

Priority guide:
- "stop": cease the exercise immediately (risk of injury)
- "high": correct before the next set
- "medium": work on this over the next few sessions
- "low": a minor refinement for long-term improvement`;
}

/**
 * Builds the user turn prompt for the feedback-agent LLM call.
 *
 * Encodes all quantitative session data so the model can make grounded,
 * data-driven corrections rather than speculative ones.
 */
export function buildUserPrompt(request: FeedbackRequest): string {
  const { poseAnalysis } = request;

  const deviationLines = poseAnalysis.deviations.length > 0
    ? poseAnalysis.deviations
        .map(
          (d) =>
            `  - ${d.joint}: actual ${d.actualAngle.toFixed(1)}°, expected ~${d.expectedAngle.toFixed(1)}° (severity: ${d.severity}) — ${d.recommendation}`,
        )
        .join('\n')
    : '  None detected.';

  const angleLines = Object.entries(poseAnalysis.jointAngles)
    .map(([joint, angle]) => `  - ${joint}: ${angle.toFixed(1)}°`)
    .join('\n');

  const sessionNotes = request.sessionNotes
    ? `\nSession notes from athlete: ${request.sessionNotes}`
    : '';

  return `Please analyse this exercise session and provide coaching feedback.

## Session Data
- Exercise: ${request.exerciseName}
- Reps completed: ${poseAnalysis.repCount}
- Form score: ${poseAnalysis.formScore}/100
- Frames analysed: ${poseAnalysis.frames.length}

## Average Joint Angles
${angleLines.length > 0 ? angleLines : '  No angle data available.'}

## Form Deviations Detected
${deviationLines}${sessionNotes}

Return ONLY the JSON object as specified in the system prompt.`;
}
