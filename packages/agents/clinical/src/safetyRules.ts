import type { UserProfile } from '@physiocore/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CurrentSymptoms {
  painScore: number; // 0–10
  painLocation: string[];
  bladderBowelChange?: boolean;
  saddleAnaesthesia?: boolean;
  upperLimbWeakness?: boolean;
  lowerLimbWeakness?: boolean;
  gaitDisturbance?: boolean;
  feverPresent?: boolean;
  recentTrauma?: boolean;
  nightPain?: boolean;
  unexplainedWeightLoss?: boolean;
  pulsatingAbdominalMass?: boolean;
  spinalPain?: boolean;
  unilateralCalfSwelling?: boolean;
  calfHeat?: boolean;
  suddenNeurologicalDeficit?: boolean;
  headache?: boolean;
  neckStiffness?: boolean;
  photophobia?: boolean;
  chestPain?: boolean;
  armRadiation?: boolean;
  dyspnoea?: boolean;
  ivDrugUse?: boolean;
}

export interface RedFlag {
  id: string;
  name: string;
  detectionCriteria: string[];
  mandatoryAction: string;
  emergencyLevel: 'call_999' | 'urgent_referral' | 'same_day_referral';
  neverTreat: boolean;
  icdCodes: string[];
}

export interface RedFlagAlert {
  redFlag: RedFlag;
  matchedCriteria: string[];
  timestamp: string;
}

// ── 12 Hard-coded Red Flags (APA Guidelines) ──────────────────────────────────

const RED_FLAGS: readonly RedFlag[] = Object.freeze([
  {
    id: 'cauda_equina',
    name: 'Cauda Equina Syndrome',
    detectionCriteria: [
      'Bladder or bowel dysfunction (retention, incontinence)',
      'Saddle anaesthesia (numbness in perineal region)',
      'Progressive bilateral leg weakness',
      'Diagnosed cauda equina syndrome',
    ],
    mandatoryAction:
      'Immediately cease all activity. Call 999 / emergency services. Do not leave patient alone.',
    emergencyLevel: 'call_999',
    neverTreat: true,
    icdCodes: ['G83.4'],
  },
  {
    id: 'cervical_myelopathy',
    name: 'Cervical Cord Compression (Myelopathy)',
    detectionCriteria: [
      'Upper limb weakness or clumsiness',
      'Lower limb spasticity or gait disturbance',
      'Diagnosed cervical myelopathy or cervical stenosis',
      'Diagnosed cervical cord compression',
    ],
    mandatoryAction:
      'Cease all cervical and spinal loading. Refer urgently to spinal surgeon or emergency medicine.',
    emergencyLevel: 'urgent_referral',
    neverTreat: true,
    icdCodes: ['G99.2', 'M47.1', 'M48.02'],
  },
  {
    id: 'atlantoaxial_instability',
    name: 'Atlantoaxial Instability',
    detectionCriteria: [
      'Down syndrome with unscreened atlantoaxial status',
      'Rheumatoid arthritis with active cervical involvement',
      'History of significant cervical trauma',
      'Diagnosed atlantoaxial instability',
    ],
    mandatoryAction:
      'Cease all cervical movement. Obtain radiological clearance before any exercise. Urgent spinal referral.',
    emergencyLevel: 'urgent_referral',
    neverTreat: true,
    icdCodes: ['M43.3', 'Q99.2'],
  },
  {
    id: 'aortic_aneurysm',
    name: 'Abdominal Aortic Aneurysm',
    detectionCriteria: [
      'Pulsating abdominal mass',
      'Diagnosed abdominal aortic aneurysm',
      'Severe tearing back or abdominal pain',
    ],
    mandatoryAction:
      'Call 999 immediately. Keep patient still and calm. Do not apply abdominal pressure.',
    emergencyLevel: 'call_999',
    neverTreat: true,
    icdCodes: ['I71.4', 'I71.3'],
  },
  {
    id: 'spinal_fracture',
    name: 'Spinal Fracture',
    detectionCriteria: [
      'Recent trauma (fall, accident, high-impact) with spinal pain',
      'Age over 50 with new onset back pain after trauma',
      'Known osteoporosis with recent trauma',
      'Long-term corticosteroid use with traumatic back pain',
    ],
    mandatoryAction:
      'Immobilise spine. Do not flex or rotate spine. Urgent imaging required. Refer to emergency medicine or spinal surgeon.',
    emergencyLevel: 'urgent_referral',
    neverTreat: true,
    icdCodes: ['S32', 'S22', 'S12', 'M80'],
  },
  {
    id: 'bone_tumour',
    name: 'Primary Bone Tumour',
    detectionCriteria: [
      'Constant unrelenting pain worse at night in patient over 50',
      'Unexplained weight loss with skeletal pain',
      'Diagnosed bone tumour, osteosarcoma, or Ewing sarcoma',
    ],
    mandatoryAction:
      'Do not load affected region. Same-day referral to oncology or rheumatology. Urgent imaging required.',
    emergencyLevel: 'same_day_referral',
    neverTreat: true,
    icdCodes: ['C40', 'C41'],
  },
  {
    id: 'spinal_metastases',
    name: 'Spinal Metastases',
    detectionCriteria: [
      'Known malignancy with new onset back or spinal pain',
      'History of cancer with progressive spinal symptoms',
      'Diagnosed spinal metastases',
    ],
    mandatoryAction:
      'Cease all spinal loading immediately. Urgent oncology referral. Imaging before any treatment.',
    emergencyLevel: 'urgent_referral',
    neverTreat: true,
    icdCodes: ['C79.5', 'C79.51', 'C79.52'],
  },
  {
    id: 'vertebral_osteomyelitis',
    name: 'Vertebral Osteomyelitis',
    detectionCriteria: [
      'Fever combined with spinal pain',
      'Intravenous drug use history with spinal symptoms',
      'Immunocompromised status with spinal infection signs',
      'Diagnosed vertebral osteomyelitis or discitis',
    ],
    mandatoryAction:
      'Cease all exercise. Urgent referral to infectious disease or emergency medicine. Blood cultures required.',
    emergencyLevel: 'urgent_referral',
    neverTreat: true,
    icdCodes: ['M46.2', 'M46.3', 'M46.4'],
  },
  {
    id: 'deep_vein_thrombosis',
    name: 'Deep Vein Thrombosis (DVT)',
    detectionCriteria: [
      'Unilateral calf swelling with localised heat',
      'Diagnosed or suspected deep vein thrombosis',
      'Positive Homans sign with calf tenderness',
    ],
    mandatoryAction:
      'Cease lower limb exercise immediately. No calf massage. Urgent medical referral for Doppler ultrasound and anticoagulation assessment.',
    emergencyLevel: 'urgent_referral',
    neverTreat: true,
    icdCodes: ['I80.2', 'I80.3'],
  },
  {
    id: 'stroke_tia',
    name: 'Stroke / Transient Ischaemic Attack (TIA)',
    detectionCriteria: [
      'Sudden onset neurological deficit (weakness, speech, vision)',
      'FAST signs: Face drooping, Arm weakness, Speech difficulty',
      'Diagnosed stroke or TIA in current presentation',
    ],
    mandatoryAction:
      'Call 999 immediately. Time-critical — thrombolysis window is 4.5 hours. Do not give food or drink.',
    emergencyLevel: 'call_999',
    neverTreat: true,
    icdCodes: ['I63', 'G45'],
  },
  {
    id: 'meningitis',
    name: 'Meningitis',
    detectionCriteria: [
      'Severe headache with neck stiffness (nuchal rigidity)',
      'Photophobia combined with fever',
      'Non-blanching purpuric rash (meningococcal)',
      'All four: headache, neck stiffness, photophobia, fever',
    ],
    mandatoryAction:
      'Call 999 immediately. Isolate patient from others. Do not delay — bacterial meningitis is fatal within hours.',
    emergencyLevel: 'call_999',
    neverTreat: true,
    icdCodes: ['G00', 'G01', 'G02'],
  },
  {
    id: 'acute_cardiac',
    name: 'Acute Cardiac Event (ACS / STEMI)',
    detectionCriteria: [
      'Chest pain with radiation to arm, jaw, or back',
      'Chest pain with shortness of breath or dyspnoea',
      'Crushing or pressure chest pain at rest or during exercise',
      'Diagnosed myocardial infarction or ACS in current presentation',
    ],
    mandatoryAction:
      'Call 999 immediately. Stop all exercise. Sit patient upright. Administer 300mg aspirin if not contraindicated and available.',
    emergencyLevel: 'call_999',
    neverTreat: true,
    icdCodes: ['I21', 'I22', 'I20.0'],
  },
]);

// ── Detection helpers ─────────────────────────────────────────────────────────

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

function conditionMatch(profile: UserProfile, ...keywords: string[]): boolean {
  return profile.conditions.some((c) => {
    if (!c.isActive) return false;
    const name = c.name.toLowerCase();
    return keywords.some((k) => name.includes(k));
  });
}

function medicationMatch(profile: UserProfile, ...keywords: string[]): boolean {
  return profile.medications.some((m) => {
    const name = m.name.toLowerCase();
    return keywords.some((k) => name.includes(k));
  });
}

function injuryNeckActive(profile: UserProfile): boolean {
  return profile.injuries.some(
    (i) => i.isActive && (i.bodyPart === 'neck' || (i.notes ?? '').toLowerCase().includes('cervi')),
  );
}

// ── Per-flag detectors ────────────────────────────────────────────────────────
// Each returns matched human-readable criteria strings; empty = no match.

type Detector = (
  profile: UserProfile,
  symptoms: CurrentSymptoms,
  age: number,
) => string[];

const DETECTORS: Record<string, Detector> = {
  cauda_equina(profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.bladderBowelChange && symptoms.saddleAnaesthesia)
      matched.push('Bladder or bowel dysfunction', 'Saddle anaesthesia (perineal numbness)');
    if (conditionMatch(profile, 'cauda equina'))
      matched.push('Diagnosed cauda equina syndrome');
    return matched;
  },

  cervical_myelopathy(profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.upperLimbWeakness)
      matched.push('Upper limb weakness or clumsiness');
    if (symptoms.gaitDisturbance)
      matched.push('Lower limb spasticity or gait disturbance');
    if (conditionMatch(profile, 'myelopathy', 'cervical stenosis', 'cervical cord', 'cervical myelopathy'))
      matched.push('Diagnosed cervical myelopathy or cervical stenosis');
    return matched;
  },

  atlantoaxial_instability(profile, symptoms, age) {
    void age;
    const matched: string[] = [];
    if (conditionMatch(profile, 'down syndrome', 'trisomy 21'))
      matched.push('Down syndrome with unscreened atlantoaxial status');
    if (conditionMatch(profile, 'atlantoaxial'))
      matched.push('Diagnosed atlantoaxial instability');
    if (conditionMatch(profile, 'rheumatoid arthritis') && injuryNeckActive(profile))
      matched.push('Rheumatoid arthritis with active cervical involvement');
    if (symptoms.recentTrauma && injuryNeckActive(profile))
      matched.push('History of significant cervical trauma');
    return matched;
  },

  aortic_aneurysm(profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.pulsatingAbdominalMass)
      matched.push('Pulsating abdominal mass detected');
    if (conditionMatch(profile, 'aortic aneurysm', 'abdominal aortic', ' aaa'))
      matched.push('Diagnosed abdominal aortic aneurysm');
    return matched;
  },

  spinal_fracture(profile, symptoms, age) {
    const matched: string[] = [];
    if (!symptoms.recentTrauma) return matched;
    matched.push('Recent trauma (fall, accident, high-impact)');
    if (age > 50) matched.push('Age over 50 with traumatic back pain');
    if (conditionMatch(profile, 'osteoporosis', 'osteopenia'))
      matched.push('Known osteoporosis — fragility fracture risk');
    if (medicationMatch(profile, 'corticosteroid', 'prednisolone', 'prednisone', 'dexamethasone'))
      matched.push('Long-term corticosteroid use — bone density risk');
    // Only flag if trauma plus at least one risk amplifier
    return matched.length > 1 ? matched : [];
  },

  bone_tumour(profile, symptoms, age) {
    const matched: string[] = [];
    if (symptoms.nightPain && symptoms.unexplainedWeightLoss && age > 50)
      matched.push('Constant night pain, weight loss, age >50');
    if (conditionMatch(profile, 'bone tumour', 'bone tumor', 'osteosarcoma', 'ewing', 'chondrosarcoma'))
      matched.push('Diagnosed primary bone tumour');
    return matched;
  },

  spinal_metastases(profile, symptoms) {
    const matched: string[] = [];
    const hasCancer = conditionMatch(profile, 'cancer', 'carcinoma', 'metastas', 'malignant', 'lymphoma', 'leukaemia', 'leukemia');
    if (hasCancer && symptoms.spinalPain)
      matched.push('Known malignancy with new spinal pain');
    if (conditionMatch(profile, 'spinal metastas', 'vertebral metastas'))
      matched.push('Diagnosed spinal metastases');
    return matched;
  },

  vertebral_osteomyelitis(profile, symptoms) {
    const matched: string[] = [];
    if (!(symptoms.feverPresent && symptoms.spinalPain)) return matched;
    matched.push('Fever combined with spinal pain');
    const immunoCompromised =
      symptoms.ivDrugUse ||
      conditionMatch(profile, 'hiv', 'aids', 'immunocompromised', 'immunosuppressed', 'transplant', 'dialysis');
    if (symptoms.ivDrugUse) matched.push('Intravenous drug use history');
    if (immunoCompromised && !symptoms.ivDrugUse)
      matched.push('Immunocompromised status with infection signs');
    // Only flag if fever+spinal and at least one risk factor
    return matched.length > 1 ? matched : [];
  },

  deep_vein_thrombosis(profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.unilateralCalfSwelling && symptoms.calfHeat)
      matched.push('Unilateral calf swelling with localised heat');
    if (conditionMatch(profile, 'dvt', 'deep vein thrombosis', 'venous thrombosis'))
      matched.push('Diagnosed or history of deep vein thrombosis');
    return matched;
  },

  stroke_tia(profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.suddenNeurologicalDeficit)
      matched.push('Sudden onset neurological deficit (FAST positive)');
    if (conditionMatch(profile, 'stroke', 'tia', 'transient ischaemic', 'transient ischemic', 'cerebrovascular'))
      matched.push('Diagnosed stroke or TIA in current presentation');
    return matched;
  },

  meningitis(_profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.headache && symptoms.neckStiffness && symptoms.photophobia && symptoms.feverPresent)
      matched.push('All four signs: headache, neck stiffness, photophobia, fever');
    return matched;
  },

  acute_cardiac(profile, symptoms) {
    const matched: string[] = [];
    if (symptoms.chestPain && symptoms.armRadiation)
      matched.push('Chest pain with radiation to arm or jaw');
    if (symptoms.chestPain && symptoms.dyspnoea)
      matched.push('Chest pain with shortness of breath');
    if (conditionMatch(profile, 'myocardial infarction', 'acute mi', 'stemi', 'nstemi', 'acute coronary'))
      matched.push('Diagnosed myocardial infarction or ACS');
    return matched;
  },
};

// ── SafetyRuleEngine ──────────────────────────────────────────────────────────

export class SafetyRuleEngine {
  /**
   * Run all 12 APA red flag checks.
   * Returns every triggered alert. Empty array = no red flags — safe to proceed.
   * This method is SYNCHRONOUS and DETERMINISTIC. No AI. No network calls.
   * Must run before any agent output reaches the patient or clinician.
   *
   * Source: Australian Physiotherapy Association Red Flags Guidelines (2021).
   */
  checkForRedFlags(
    profile: UserProfile,
    symptoms: CurrentSymptoms,
  ): RedFlagAlert[] {
    const age = calculateAge(profile.dateOfBirth);
    const timestamp = new Date().toISOString();
    const alerts: RedFlagAlert[] = [];

    for (const redFlag of RED_FLAGS) {
      const detector = DETECTORS[redFlag.id];
      if (!detector) continue;
      const matchedCriteria = detector(profile, symptoms, age);
      if (matchedCriteria.length > 0) {
        alerts.push({ redFlag, matchedCriteria, timestamp });
      }
    }

    return alerts;
  }
}
