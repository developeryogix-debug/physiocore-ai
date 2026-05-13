import type { JointData } from '../types.js';

const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';
const MAGEE_7TH   = 'Magee DJ. Orthopedic Physical Assessment. 7th ed. Elsevier; 2021';

export const elbow: JointData = {
  joint: 'elbow',

  normalROM: {
    flexion:     { min: 0, max: 145, unit: 'degrees', citation: NORKIN_2016 },
    extension:   { min: 0, max: 0,   unit: 'degrees', citation: NORKIN_2016 },
    pronation:   { min: 0, max: 80,  unit: 'degrees', citation: NORKIN_2016 },
    supination:  { min: 0, max: 80,  unit: 'degrees', citation: NORKIN_2016 },
    // Hyperextension common in females / hypermobile individuals
    hyperextension: { min: 0, max: 10, unit: 'degrees', citation: NORKIN_2016, needsReview: true },
  },

  specialTests: [
    {
      name: 'Cozen\'s Test (Lateral Epicondylalgia)',
      procedure: 'Elbow slightly flexed, forearm pronated; resist wrist extension and radial deviation with fist clenched; pain over lateral epicondyle = positive',
      sensitivity: 0.84,
      specificity: 0.65,
      citation: 'Smidt N et al. J Clin Epidemiol. 2002;55(11):1067-1077',
      needsReview: true,
    },
    {
      name: 'Mill\'s Test (Lateral Epicondylalgia)',
      procedure: 'Elbow extended, wrist fully flexed; passively pronate forearm; pain over lateral epicondyle = positive',
      sensitivity: 0.53,
      specificity: 0.72,
      citation: `NEEDS_CLINICAL_REVIEW — pooled data limited; procedure from ${MAGEE_7TH}`,
      needsReview: true,
    },
    {
      name: 'Moving Valgus Stress Test (UCL Insufficiency)',
      procedure: 'Shoulder abducted 90°; elbow rapidly flexed 120° to 70° while valgus torque maintained; medial elbow pain between 70–120° = positive for UCL tear',
      sensitivity: 1.00,
      specificity: 0.75,
      citation: "O'Driscoll SW, Lawton RL, Smith AM. Am J Sports Med. 2005;33(2):231-239",
      needsReview: true, // single surgical study, n=21
    },
    {
      name: 'Elbow Flexion Test (Cubital Tunnel)',
      procedure: 'Full elbow flexion sustained for 3–5 min with wrist neutral; paraesthesia in ulnar distribution (ring + little finger) = positive for cubital tunnel syndrome',
      sensitivity: 0.75,
      specificity: 0.60,
      citation: `NEEDS_CLINICAL_REVIEW — values variable across studies; procedure from ${MAGEE_7TH}`,
      needsReview: true,
    },
    {
      name: 'Valgus Stress Test (MCL)',
      procedure: 'Elbow at 25–30° flexion; apply valgus force; medial pain or laxity = positive for medial collateral ligament (UCL) insufficiency',
      sensitivity: 0.65,
      specificity: 0.60,
      citation: `NEEDS_CLINICAL_REVIEW — limited pooled data; procedure from ${MAGEE_7TH}`,
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'Lateral Epicondylalgia (Tennis Elbow)',
      icd10: 'M77.1',
      description: 'Tendinopathy of the common extensor origin; overuse-related degenerative tendinopathy, not true inflammation',
      commonPresentations: ['lateral elbow pain with grip', 'positive Cozen\'s and Mill\'s', 'tenderness 1cm distal to lateral epicondyle', 'aggravated by keyboard/gripping'],
    },
    {
      name: 'Medial Epicondylalgia (Golfer\'s Elbow)',
      icd10: 'M77.0',
      description: 'Tendinopathy of the common flexor-pronator origin at medial epicondyle',
      commonPresentations: ['medial elbow pain', 'tenderness at medial epicondyle', 'aggravated by wrist flexion under load', 'may coexist with ulnar neuropathy'],
    },
    {
      name: 'Cubital Tunnel Syndrome',
      icd10: 'G56.2',
      description: 'Ulnar nerve compression at the medial elbow (most common site for ulnar neuropathy)',
      commonPresentations: ['paraesthesia ring + little fingers', 'positive elbow flexion test', 'intrinsic hand weakness', 'Froment\'s sign'],
    },
    {
      name: 'UCL Sprain / Insufficiency',
      icd10: 'S53.4',
      description: 'Medial collateral ligament injury; spectrum from sprain to full rupture; common in overhead-throwing athletes',
      commonPresentations: ['medial elbow pain', 'positive valgus stress', 'positive moving valgus test', 'overhead throwing athlete'],
    },
    {
      name: 'Olecranon Bursitis',
      icd10: 'M70.2',
      description: 'Inflammation of the olecranon bursa; traumatic, chronic pressure, or septic',
      commonPresentations: ['posterior elbow swelling', 'fluctuant mass over olecranon', 'minimal pain unless septic', 'consider septic if hot/red/fever'],
    },
    {
      name: 'Elbow Osteoarthritis',
      icd10: 'M19.029',
      description: 'Primary or post-traumatic OA of the elbow; less common than hip/knee OA',
      commonPresentations: ['extension deficit (usually first lost)', 'crepitus', 'osteophytes on imaging', 'pain at end range'],
    },
    {
      name: 'Radial Tunnel Syndrome / PIN Compression',
      icd10: 'G56.3',
      description: 'Posterior interosseous nerve (deep branch of radial nerve) compression at the radial tunnel; mimics lateral epicondylalgia',
      commonPresentations: ['lateral elbow pain 4cm distal to epicondyle', 'no true weakness', 'pain with resisted middle finger extension', 'negative Cozen\'s'],
    },
  ],

  redFlags: [
    {
      type: 'fracture',
      description: 'Radial head fracture (most common elbow fracture in adults) or supracondylar fracture; risk of neurovascular injury',
      signsSymptoms: ['fall on outstretched hand', 'lateral elbow swelling and tenderness', 'restricted forearm rotation', 'fat pad sign on X-ray'],
      immediateAction: 'URGENT: X-ray immediately (AP + lateral + radial head views); non-weight-bearing; orthopaedic referral',
    },
    {
      type: 'vascular_injury',
      description: 'Brachial artery injury with supracondylar fracture in children or elbow dislocation; risk of Volkmann\'s ischaemic contracture',
      signsSymptoms: ['elbow trauma/dislocation', 'absent radial pulse', 'pale cold hand', 'severe forearm pain with passive finger extension', '5 Ps: Pain, Pallor, Pulselessness, Paraesthesia, Paralysis'],
      immediateAction: 'EMERGENCY: vascular surgery immediately; do NOT delay; compartment pressure measurement',
    },
    {
      type: 'infection',
      description: 'Septic olecranon bursitis or septic arthritis of the elbow',
      signsSymptoms: ['fever + hot erythematous swelling', 'systemically unwell', 'inability to move elbow', 'penetrating wound or immunosuppression'],
      immediateAction: 'EMERGENCY: immediate hospital; joint aspiration for MC&S; IV antibiotics',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — eccentric wrist extension for tendinopathy, elbow flexor/extensor strengthening' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — functional gripping, throwing mechanics' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — radiohumeral mobilisation, soft tissue' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — lateral epicondyle, olecranon tendon' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for pain modulation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — work hardening/ergonomics group' },
  ],
};
