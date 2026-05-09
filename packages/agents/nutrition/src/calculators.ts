import type { UserProfile } from '@physiocore/types';

/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 * Male:   (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
 * Female: (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161
 */
export function calculateBMR(profile: UserProfile): number {
  const age = calculateAge(profile.dateOfBirth);
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age;

  if (profile.gender === 'male') {
    return base + 5;
  }
  // female / non_binary / prefer_not_to_say → use female formula as conservative default
  return base - 161;
}

/**
 * Calculate Total Daily Energy Expenditure by applying an activity multiplier to BMR.
 * beginner=1.375, intermediate=1.55, advanced=1.725, athlete=1.9
 */
export function calculateTDEE(
  bmr: number,
  fitnessLevel: UserProfile['fitnessLevel'],
): number {
  const multipliers: Record<UserProfile['fitnessLevel'], number> = {
    beginner: 1.375,
    intermediate: 1.55,
    advanced: 1.725,
    athlete: 1.9,
  };
  return Math.round(bmr * multipliers[fitnessLevel]);
}

/**
 * Break TDEE calories into protein / carbs / fat grams based on goal.
 *
 * rehabilitation / recovery : 30 % protein, 45 % carbs, 25 % fat
 * muscle_gain               : 35 % protein, 40 % carbs, 25 % fat
 * weight_loss               : 35 % protein, 35 % carbs, 30 % fat
 * performance               : 25 % protein, 55 % carbs, 20 % fat
 */
export function calculateMacros(
  tdee: number,
  goal: string,
): { proteinG: number; carbsG: number; fatG: number } {
  const ratios = getMacroRatios(goal);
  // protein and carbs yield 4 kcal/g; fat yields 9 kcal/g
  return {
    proteinG: Math.round((tdee * ratios.protein) / 4),
    carbsG: Math.round((tdee * ratios.carbs) / 4),
    fatG: Math.round((tdee * ratios.fat) / 9),
  };
}

function getMacroRatios(goal: string): {
  protein: number;
  carbs: number;
  fat: number;
} {
  switch (goal) {
    case 'muscle_gain':
      return { protein: 0.35, carbs: 0.4, fat: 0.25 };
    case 'weight_loss':
      return { protein: 0.35, carbs: 0.35, fat: 0.3 };
    case 'performance':
      return { protein: 0.25, carbs: 0.55, fat: 0.2 };
    case 'rehabilitation':
    case 'recovery':
    default:
      return { protein: 0.3, carbs: 0.45, fat: 0.25 };
  }
}

/**
 * Calculate age in whole years from an ISO 8601 date-of-birth string.
 */
export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}
