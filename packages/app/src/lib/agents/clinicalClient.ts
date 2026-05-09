import type { UserProfile, ClinicalAssessment, RiskFactor, FHIRPatient } from '@physiocore/types';
import { callClaude, extractJson } from './anthropicClient.js';

function calculateAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function assessRiskFactors(profile: UserProfile): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const age = calculateAge(profile.dateOfBirth);

  if (profile.bmi > 35)
    risks.push({ name: 'Obesity (Class II+)', severity: 'high', description: `BMI ${profile.bmi.toFixed(1)} — increases joint load and cardiovascular risk` });
  else if (profile.bmi > 30)
    risks.push({ name: 'Obesity (Class I)', severity: 'moderate', description: `BMI ${profile.bmi.toFixed(1)}` });
  else if (profile.bmi < 18.5)
    risks.push({ name: 'Underweight', severity: 'moderate', description: `BMI ${profile.bmi.toFixed(1)} — may indicate nutritional deficiency` });

  if (age >= 65)
    risks.push({ name: 'Advanced age', severity: 'moderate', description: 'Increased fall risk and recovery time; exercise prescription should be conservative' });

  const severeInjuries = profile.injuries.filter((i) => i.isActive && i.severity >= 4);
  for (const inj of severeInjuries)
    risks.push({ name: `Severe active injury: ${inj.bodyPart}`, severity: inj.severity === 5 ? 'critical' : 'high', description: `${inj.type} injury, severity ${inj.severity}/5` });

  const dangerousConditions = ['diabetes', 'hypertension', 'cardiac', 'heart', 'osteoporosis', 'copd', 'asthma'];
  for (const cond of profile.conditions.filter((c) => c.isActive)) {
    const name = cond.name.toLowerCase();
    if (dangerousConditions.some((d) => name.includes(d)))
      risks.push({ name: cond.name, severity: 'moderate', description: 'Requires exercise modification and medical clearance' });
  }

  return risks;
}

function buildFHIRPatient(profile: UserProfile): FHIRPatient {
  const nameParts = profile.name.trim().split(' ');
  const given = nameParts.slice(0, -1);
  const family = nameParts.at(-1) ?? profile.name;
  const genderMap: Record<UserProfile['gender'], FHIRPatient['gender']> = {
    male: 'male', female: 'female', non_binary: 'other', prefer_not_to_say: 'unknown',
  };
  return {
    resourceType: 'Patient',
    id: profile.id,
    identifier: [{ system: 'https://physiocore.ai/users', value: profile.id }],
    name: [{ use: 'official', family, given: given.length > 0 ? given : [profile.name] }],
    birthDate: profile.dateOfBirth,
    gender: genderMap[profile.gender],
  };
}

export async function assessPatient(userProfile: UserProfile): Promise<ClinicalAssessment> {
  const riskFactors = assessRiskFactors(userProfile);
  const age = calculateAge(userProfile.dateOfBirth);

  const conditionList = userProfile.conditions.filter((c) => c.isActive).map((c) => c.name).join(', ') || 'none';
  const medList = userProfile.medications.map((m) => `${m.name} ${m.dosage}`).join(', ') || 'none';
  const injuryList = userProfile.injuries.filter((i) => i.isActive).map((i) => `${i.bodyPart} (${i.type}, severity ${i.severity}/5)`).join(', ') || 'none';
  const riskSummary = riskFactors.map((r) => `${r.name} [${r.severity}]: ${r.description}`).join('\n') || 'No significant risk factors identified';

  const system = `You are a clinical exercise physiologist and physiotherapist with expertise in FHIR R4.
Provide evidence-based clinical recommendations. Flag any contraindications clearly.
Respond ONLY with valid JSON:
{
  "clinicalRecommendations": [{ "category": "exercise"|"medication"|"referral"|"lifestyle"|"monitoring", "recommendation": string, "urgency": "routine"|"urgent"|"emergent", "evidenceBasis": string }],
  "referralNeeded": boolean,
  "referralReason": string|null
}`;

  const userMsg = `Patient: ${userProfile.name}, age ${age}, BMI ${userProfile.bmi.toFixed(1)}, fitness level: ${userProfile.fitnessLevel}.
Primary goal: ${userProfile.primaryGoal}.
Active conditions: ${conditionList}
Medications: ${medList}
Active injuries: ${injuryList}
Risk factors identified:
${riskSummary}

Provide clinical recommendations and determine if specialist referral is needed.`;

  const text = await callClaude({ system, messages: [{ role: 'user', content: userMsg }], maxTokens: 1500 });
  const parsed = extractJson<{ clinicalRecommendations: ClinicalAssessment['clinicalRecommendations']; referralNeeded: boolean; referralReason?: string }>(text);

  return {
    patient: buildFHIRPatient(userProfile),
    observations: [],
    riskFactors,
    clinicalRecommendations: parsed.clinicalRecommendations,
    referralNeeded: parsed.referralNeeded,
    referralReason: parsed.referralReason,
  };
}
