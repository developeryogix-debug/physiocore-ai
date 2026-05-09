import type { UserProfile, NutritionRequest } from '@physiocore/types';

/**
 * Build the system prompt for the nutrition agent.
 * Sets the Claude role and injects safety-relevant profile context.
 */
export function buildNutritionSystemPrompt(profile: UserProfile): string {
  const conditionsList =
    profile.conditions.length > 0
      ? profile.conditions
          .filter((c) => c.isActive)
          .map((c) => `  - ${c.name}${c.icdCode !== undefined ? ` (ICD-10: ${c.icdCode})` : ''}`)
          .join('\n')
      : '  None reported';

  const medicationsList =
    profile.medications.length > 0
      ? profile.medications
          .map((m) => `  - ${m.name} ${m.dosage} ${m.frequency}`)
          .join('\n')
      : '  None reported';

  return `You are a registered dietitian and certified sports nutritionist specialising in rehabilitation and performance nutrition.

## Patient Profile
- Name: ${profile.name}
- Gender: ${profile.gender}
- Fitness level: ${profile.fitnessLevel}
- Primary goal: ${profile.primaryGoal}
- Height: ${profile.heightCm} cm  |  Weight: ${profile.weightKg} kg  |  BMI: ${profile.bmi.toFixed(1)}

## Active Medical Conditions
${conditionsList}

## Current Medications
${medicationsList}

## Safety Guidelines
- ALWAYS check for nutritional contraindications with the patient's conditions and medications.
- Flag potential interactions (e.g., grapefruit with statins, vitamin K with warfarin, high-potassium foods with ACE inhibitors).
- If any condition or medication creates a HIGH-RISK nutritional situation, include a safetyWarning in your notes and recommend consulting a medical professional.
- Never recommend supplements that are contraindicated with listed medications.

## Output Format
Respond ONLY with valid JSON that exactly matches the NutritionPlan schema:
{
  "dailyCalorieTarget": number,
  "macros": { "proteinG": number, "carbsG": number, "fatG": number },
  "mealPlan": [
    {
      "meal": "breakfast" | "lunch" | "dinner" | "snack",
      "name": string,
      "ingredients": string[],
      "calories": number,
      "macros": { "proteinG": number, "carbsG": number, "fatG": number },
      "prepTimeMinutes": number
    }
  ],
  "supplements": [
    {
      "name": string,
      "dosage": string,
      "timing": string,
      "rationale": string,
      "evidenceLevel": "strong" | "moderate" | "limited"
    }
  ],
  "hydrationGoalMl": number,
  "notes": string
}

Do NOT include any text outside the JSON object.`;
}

/**
 * Build the user-turn prompt, embedding calculated TDEE, macros, and request details.
 */
export function buildNutritionUserPrompt(
  request: NutritionRequest,
  tdee: number,
  macros: { proteinG: number; carbsG: number; fatG: number },
): string {
  const restrictionsList =
    request.dietaryRestrictions.length > 0
      ? request.dietaryRestrictions.join(', ')
      : 'None';

  const currentMealsSection =
    request.currentMeals !== undefined && request.currentMeals.trim().length > 0
      ? `\n## Current Eating Habits\n${request.currentMeals}`
      : '';

  return `Please create a personalised nutrition plan for this patient.

## Goal
${request.goal}

## Calculated Targets
- Total Daily Energy Expenditure (TDEE): ${tdee} kcal/day
- Target macros:
  - Protein: ${macros.proteinG} g/day
  - Carbohydrates: ${macros.carbsG} g/day
  - Fat: ${macros.fatG} g/day

## Dietary Restrictions
${restrictionsList}
${currentMealsSection}

## Requirements
- Include exactly 3 main meals (breakfast, lunch, dinner) and 1–2 snacks.
- Each meal should include realistic ingredients, estimated calories, and per-meal macros.
- Total meal calories should be close to the TDEE target.
- Recommend supplements with evidence levels; skip any contraindicated with the patient's medications.
- Set hydration goal based on weight and activity level.
- Add any safety notes or warnings in the "notes" field.

Return ONLY valid JSON matching the NutritionPlan schema.`;
}
