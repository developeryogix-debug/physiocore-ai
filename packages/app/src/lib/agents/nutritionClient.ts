import type { UserProfile, NutritionPlan } from '@physiocore/types';
import { callClaude, extractJson } from './anthropicClient.js';

function calculateAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function calculateTDEE(profile: UserProfile): number {
  const age = calculateAge(profile.dateOfBirth);
  const bmr = profile.gender === 'male'
    ? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age + 5
    : 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age - 161;
  const multipliers: Record<UserProfile['fitnessLevel'], number> = {
    beginner: 1.375, intermediate: 1.55, advanced: 1.725, athlete: 1.9,
  };
  return Math.round(bmr * (multipliers[profile.fitnessLevel] ?? 1.55));
}

export interface NutritionRequest {
  goal: 'recovery' | 'performance' | 'weight_loss' | 'muscle_gain';
  dietaryRestrictions: string[];
}

export async function generateNutritionPlan(
  request: NutritionRequest,
  userProfile: UserProfile
): Promise<NutritionPlan> {
  const tdee = calculateTDEE(userProfile);
  const conditions = userProfile.conditions.filter((c) => c.isActive).map((c) => c.name).join(', ') || 'none';
  const meds = userProfile.medications.map((m) => m.name).join(', ') || 'none';
  const restrictions = request.dietaryRestrictions.length > 0 ? request.dietaryRestrictions.join(', ') : 'none';

  const system = `You are a registered dietitian and sports nutritionist.
User: ${userProfile.name}, ${calculateAge(userProfile.dateOfBirth)}yo, ${userProfile.weightKg}kg, ${userProfile.heightCm}cm.
Active conditions: ${conditions}. Medications: ${meds}.
Dietary restrictions: ${restrictions}.
Goal: ${request.goal}. Estimated TDEE: ${tdee} kcal/day.
Flag any nutritional contraindications with conditions/medications.
Respond ONLY with valid JSON matching this schema:
{
  "dailyCalorieTarget": number,
  "macros": { "proteinG": number, "carbsG": number, "fatG": number },
  "mealPlan": [{ "meal": "breakfast"|"lunch"|"dinner"|"snack", "name": string, "ingredients": string[], "calories": number, "macros": { "proteinG": number, "carbsG": number, "fatG": number }, "prepTimeMinutes": number }],
  "supplements": [{ "name": string, "dosage": string, "timing": string, "rationale": string, "evidenceLevel": "strong"|"moderate"|"limited" }],
  "hydrationGoalMl": number,
  "notes": string
}`;

  const text = await callClaude({
    system,
    messages: [{ role: 'user', content: `Generate a complete daily nutrition plan for goal: ${request.goal}. Include 3 meals and 1-2 snacks.` }],
    maxTokens: 2048,
  });

  return extractJson<NutritionPlan>(text);
}
