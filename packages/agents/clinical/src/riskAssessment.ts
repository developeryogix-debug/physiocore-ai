import type {
  UserProfile,
  RiskFactor,
  FHIRPatient,
  FHIRObservation,
  FHIRIdentifier,
  FHIRHumanName,
} from '@physiocore/types';

// LOINC codes for common observations used throughout the clinical agent
export const LOINC_CODES = {
  BODY_WEIGHT: '29463-7',
  BMI: '39156-5',
  PAIN_SEVERITY: '72514-3',
  FUNCTIONAL_STATUS: '89574-8',
  FALL_RISK: '57032-2',
} as const;

const LOINC_SYSTEM = 'http://loinc.org';
const PHYSIOCORE_SYSTEM = 'https://physiocore.ai/identifiers';

/**
 * Derive a list of clinical risk factors from a user profile.
 * Checks BMI ranges, age-related risks, active injury severity,
 * relevant medical conditions, and exercise-interacting medications.
 */
export function assessRiskFactors(profile: UserProfile): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // --- BMI risks ---
  if (profile.bmi < 18.5) {
    risks.push({
      name: 'Underweight BMI',
      severity: 'moderate',
      description: `BMI ${profile.bmi.toFixed(1)} is below the healthy range (<18.5). Increased fracture and muscle-loss risk during exercise.`,
      loincCode: LOINC_CODES.BMI,
    });
  } else if (profile.bmi >= 30 && profile.bmi < 35) {
    risks.push({
      name: 'Obese BMI (Class I)',
      severity: 'moderate',
      description: `BMI ${profile.bmi.toFixed(1)} — increased cardiovascular and joint loading risk.`,
      loincCode: LOINC_CODES.BMI,
    });
  } else if (profile.bmi >= 35) {
    risks.push({
      name: 'Obese BMI (Class II+)',
      severity: 'high',
      description: `BMI ${profile.bmi.toFixed(1)} — high cardiovascular risk and severe joint loading. Medical clearance recommended.`,
      loincCode: LOINC_CODES.BMI,
    });
  }

  // --- Age-related risks ---
  const age = calculateAge(profile.dateOfBirth);
  if (age >= 65) {
    risks.push({
      name: 'Older Adult',
      severity: 'moderate',
      description: `Patient is ${age} years old. Increased fall, fracture, and cardiovascular risk. Exercise intensity should be progressive.`,
      loincCode: LOINC_CODES.FALL_RISK,
    });
  }

  // --- High-severity active injuries ---
  const severeInjuries = profile.injuries.filter(
    (inj) => inj.isActive && inj.severity >= 4,
  );
  for (const injury of severeInjuries) {
    risks.push({
      name: `Severe Active Injury — ${injury.bodyPart}`,
      severity: injury.severity === 5 ? 'critical' : 'high',
      description: `Active ${injury.type} injury (severity ${injury.severity}/5) to ${injury.bodyPart}. Restrict loading of this region until cleared.`,
      loincCode: LOINC_CODES.PAIN_SEVERITY,
    });
  }

  // --- Relevant medical conditions ---
  const conditionRiskMap: Record<string, RiskFactor['severity']> = {
    diabetes: 'moderate',
    hypertension: 'moderate',
    osteoporosis: 'high',
    'heart disease': 'high',
    'cardiac arrhythmia': 'high',
    epilepsy: 'high',
    osteopenia: 'moderate',
    copd: 'moderate',
    asthma: 'low',
  };

  for (const condition of profile.conditions) {
    if (!condition.isActive) continue;
    const lowerName = condition.name.toLowerCase();
    for (const [keyword, severity] of Object.entries(conditionRiskMap)) {
      if (lowerName.includes(keyword)) {
        risks.push({
          name: `Condition: ${condition.name}`,
          severity,
          description: `Active condition "${condition.name}" requires exercise program modification and monitoring.`,
        });
        break;
      }
    }
  }

  // --- Medications that interact with exercise ---
  const exerciseMedKeywords: Array<{
    keyword: string;
    risk: string;
    severity: RiskFactor['severity'];
  }> = [
    {
      keyword: 'beta-blocker',
      risk: 'blunts heart-rate response; use RPE instead of HR targets',
      severity: 'moderate',
    },
    {
      keyword: 'metoprolol',
      risk: 'blunts heart-rate response; use RPE instead of HR targets',
      severity: 'moderate',
    },
    {
      keyword: 'atenolol',
      risk: 'blunts heart-rate response; use RPE instead of HR targets',
      severity: 'moderate',
    },
    {
      keyword: 'warfarin',
      risk: 'increased bleeding risk; avoid high-impact and contact activities',
      severity: 'high',
    },
    {
      keyword: 'insulin',
      risk: 'hypoglycaemia risk during exercise; monitor blood glucose',
      severity: 'moderate',
    },
    {
      keyword: 'diuretic',
      risk: 'dehydration risk; emphasise hydration during exercise',
      severity: 'low',
    },
    {
      keyword: 'corticosteroid',
      risk: 'long-term use increases fracture and tendon-rupture risk',
      severity: 'moderate',
    },
    {
      keyword: 'anticoagulant',
      risk: 'increased bleeding risk; avoid high-impact activities',
      severity: 'high',
    },
  ];

  for (const medication of profile.medications) {
    const lowerMed = medication.name.toLowerCase();
    for (const { keyword, risk, severity } of exerciseMedKeywords) {
      if (lowerMed.includes(keyword)) {
        risks.push({
          name: `Medication Interaction: ${medication.name}`,
          severity,
          description: `Patient taking ${medication.name} ${medication.dosage} — ${risk}.`,
        });
        break;
      }
    }
  }

  return risks;
}

/**
 * Map a UserProfile to a FHIR R4 Patient resource (without server-assigned id).
 */
export function mapProfileToFHIRPatient(
  profile: UserProfile,
): Omit<FHIRPatient, 'id'> {
  const identifiers: FHIRIdentifier[] = [
    { system: PHYSIOCORE_SYSTEM, value: profile.id },
    { system: `${PHYSIOCORE_SYSTEM}/email`, value: profile.email },
  ];

  const nameParts = profile.name.trim().split(/\s+/);
  const givenNames = nameParts.slice(0, -1);
  const familyName = nameParts[nameParts.length - 1] ?? profile.name;

  const humanName: FHIRHumanName = {
    use: 'official',
    family: familyName,
    ...(givenNames.length > 0 ? { given: givenNames } : {}),
  };

  const genderMap: Record<UserProfile['gender'], FHIRPatient['gender']> = {
    male: 'male',
    female: 'female',
    non_binary: 'other',
    prefer_not_to_say: 'unknown',
  };

  return {
    resourceType: 'Patient',
    identifier: identifiers,
    name: [humanName],
    birthDate: profile.dateOfBirth.split('T')[0] ?? profile.dateOfBirth,
    gender: genderMap[profile.gender] ?? 'unknown',
  };
}

/**
 * Create a FHIR R4 Observation resource capturing a single exercise session.
 * The observation is structured as a panel with formScore and repCount components.
 */
export function createExerciseObservation(
  patientId: string,
  exerciseName: string,
  formScore: number,
  repCount: number,
): Omit<FHIRObservation, 'id'> {
  const now = new Date().toISOString();

  return {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [
        {
          system: LOINC_SYSTEM,
          code: LOINC_CODES.FUNCTIONAL_STATUS,
          display: 'Functional Status',
        },
        {
          system: PHYSIOCORE_SYSTEM,
          code: 'exercise-session',
          display: exerciseName,
        },
      ],
      text: `Exercise session: ${exerciseName}`,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    effectiveDateTime: now,
    component: [
      {
        code: {
          coding: [
            {
              system: PHYSIOCORE_SYSTEM,
              code: 'form-score',
              display: 'Form Score (0–100)',
            },
          ],
          text: 'Form Score',
        },
        valueQuantity: {
          value: formScore,
          unit: 'score',
          system: PHYSIOCORE_SYSTEM,
          code: 'form-score',
        },
      },
      {
        code: {
          coding: [
            {
              system: PHYSIOCORE_SYSTEM,
              code: 'rep-count',
              display: 'Repetition Count',
            },
          ],
          text: 'Repetition Count',
        },
        valueQuantity: {
          value: repCount,
          unit: 'reps',
          system: PHYSIOCORE_SYSTEM,
          code: 'rep-count',
        },
      },
    ],
  };
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}
