import type { JointData } from '../types.js';

// ROM source: Norkin CC, White DJ. Measurement of Joint Motion: A Guide to Goniometry. 5th ed. FA Davis; 2016.
// Also: AAOS. Joint Motion: Method of Measuring and Recording. 1965.
const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';

// Special test meta-analysis source: Hegedus EJ et al. Br J Sports Med. 2008;42(2):80-92 and 2012;46(14):964-978

export const shoulder: JointData = {
  joint: 'shoulder',

  normalROM: {
    flexion:              { min: 0, max: 180, unit: 'degrees', citation: NORKIN_2016 },
    extension:            { min: 0, max: 60,  unit: 'degrees', citation: NORKIN_2016 },
    abduction:            { min: 0, max: 180, unit: 'degrees', citation: NORKIN_2016 },
    internalRotation:     { min: 0, max: 70,  unit: 'degrees', citation: NORKIN_2016 },
    externalRotation:     { min: 0, max: 90,  unit: 'degrees', citation: NORKIN_2016 },
    horizontalAdduction:  { min: 0, max: 135, unit: 'degrees', citation: NORKIN_2016 },
    horizontalAbduction:  { min: 0, max: 90,  unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'Neer Impingement Sign',
      procedure: 'Stabilise scapula; passively flex arm in scapular plane with elbow extended and forearm pronated; pain in arc 70–120° = positive',
      sensitivity: 0.72,
      specificity: 0.66,
      citation: 'Hegedus EJ et al. Br J Sports Med. 2008;42(2):80-92',
    },
    {
      name: 'Hawkins–Kennedy Test',
      procedure: 'Shoulder and elbow at 90°; internally rotate shoulder; reproduction of subacromial pain = positive',
      sensitivity: 0.79,
      specificity: 0.59,
      citation: 'Hegedus EJ et al. Br J Sports Med. 2008;42(2):80-92',
    },
    {
      name: 'Empty Can Test (Jobe)',
      procedure: 'Shoulder at 90° abduction in scapular plane, fully internally rotated (thumb down); resist downward force; pain or weakness = positive for supraspinatus involvement',
      sensitivity: 0.69,
      specificity: 0.66,
      citation: 'Hegedus EJ et al. Br J Sports Med. 2012;46(14):964-978',
    },
    {
      name: 'Speed\'s Test',
      procedure: 'Elbow extended, forearm supinated, shoulder flexed to 90°; resist further flexion; pain in bicipital groove = positive for bicipital tendinopathy',
      sensitivity: 0.32,
      specificity: 0.61,
      citation: 'Holtby R, Razmjou H. J Shoulder Elbow Surg. 2004;13(5):525-529',
    },
    {
      name: 'Apprehension Test',
      procedure: 'Supine; shoulder at 90° abduction, externally rotate to end range; patient apprehension (not just pain) = positive for anterior glenohumeral instability',
      sensitivity: 0.72,
      specificity: 0.96,
      citation: 'Lo IK et al. J Bone Joint Surg Am. 2004;86(1):167-174',
    },
    {
      name: 'O\'Brien Active Compression Test (SLAP)',
      procedure: 'Shoulder at 90° flexion and 10–15° adduction; full internal rotation (thumb down), resist downward force; repeat with forearm supinated; pain in IR > ER = positive for SLAP',
      sensitivity: 0.63,
      specificity: 0.73,
      citation: 'Hegedus EJ et al. Br J Sports Med. 2008;42(2):80-92',
    },
  ],

  commonPathologies: [
    {
      name: 'Rotator Cuff Syndrome / Tear',
      icd10: 'M75.1',
      description: 'Partial or full-thickness tear of supraspinatus, infraspinatus, or subscapularis tendons',
      commonPresentations: ['night pain', 'painful arc 60–120°', 'weakness in abduction or ER', 'positive empty can'],
    },
    {
      name: 'Adhesive Capsulitis (Frozen Shoulder)',
      icd10: 'M75.0',
      description: 'Progressive fibrosis and contracture of glenohumeral joint capsule; three phases: freezing, frozen, thawing',
      commonPresentations: ['global ROM restriction (ER > Abd > IR)', 'insidious onset', 'night pain', 'diabetic patients at higher risk'],
    },
    {
      name: 'Bicipital Tendinopathy',
      icd10: 'M75.2',
      description: 'Tendinopathy or tenosynovitis of the long head of biceps brachii in the intertubercular groove',
      commonPresentations: ['anterior shoulder pain', 'positive Speed\'s test', 'pain with overhead activity'],
    },
    {
      name: 'Calcific Tendinitis',
      icd10: 'M75.3',
      description: 'Calcium hydroxyapatite deposition within the rotator cuff tendons; acute phase extremely painful',
      commonPresentations: ['sudden severe shoulder pain', 'restricted all planes', 'calcification visible on X-ray'],
    },
    {
      name: 'Subacromial Bursitis',
      icd10: 'M75.5',
      description: 'Inflammation of the subacromial bursa; often secondary to impingement or rotator cuff pathology',
      commonPresentations: ['diffuse subacromial pain', 'positive Neer and Hawkins', 'painful arc'],
    },
    {
      name: 'Acromioclavicular Joint Sprain',
      icd10: 'S43.40xA',
      description: 'Sprain of AC ligament complex; graded I–VI by Rockwood classification',
      commonPresentations: ['direct fall on outstretched hand or AC joint', 'step deformity (Grade III+)', 'point tenderness over AC joint'],
    },
    {
      name: 'SLAP Lesion',
      icd10: 'M75.8',
      description: 'Superior labrum tear from anterior to posterior; Types I–IV (Snyder classification)',
      commonPresentations: ['overhead throwing athlete', 'deep ache', 'positive O\'Brien test', 'clicking or catching'],
    },
  ],

  redFlags: [
    {
      type: 'acute_cardiac',
      description: 'Left shoulder pain may indicate acute myocardial infarction or unstable angina (Kehr\'s sign variant)',
      signsSymptoms: ['left shoulder + chest pain at rest', 'diaphoresis', 'dyspnoea', 'nausea', 'pain radiating to jaw or arm'],
      immediateAction: 'EMERGENCY: call emergency services immediately; do not proceed with musculoskeletal assessment',
    },
    {
      type: 'cancer',
      description: 'Pancoast tumour (apex lung) or metastatic disease can present as shoulder pain',
      signsSymptoms: ['unexplained weight loss', 'night pain unrelieved by rest', 'age >50', 'prior cancer history', 'Horner syndrome (ptosis, miosis, anhidrosis)'],
      immediateAction: 'URGENT: same-day medical referral; chest X-ray and bloods required',
    },
    {
      type: 'brachial_neuritis',
      description: 'Parsonage–Turner syndrome: acute brachial plexus neuritis; can mimic shoulder pathology',
      signsSymptoms: ['acute severe shoulder girdle pain (hours)', 'rapid progression to weakness without pain', 'no mechanical pattern', 'often post-viral or post-surgical'],
      immediateAction: 'URGENT: neurology referral within 48 h; MRI brachial plexus',
    },
    {
      type: 'infection',
      description: 'Septic arthritis of the glenohumeral joint; orthopaedic emergency',
      signsSymptoms: ['fever >38°C', 'hot swollen joint', 'markedly restricted all planes', 'systemically unwell', 'IV drug use or immunosuppression'],
      immediateAction: 'EMERGENCY: immediate hospital admission; joint aspiration + IV antibiotics',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — rotator cuff strengthening, scapular stabilisation' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — functional overhead tasks, proprioception' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — joint mobilisation, MWM, soft tissue' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — cervical if cervicogenic component' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — calcific tendinitis, soft tissue healing' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for pain modulation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — shoulder class/group rehab' },
  ],
};
