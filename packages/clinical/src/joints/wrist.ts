import type { JointData } from '../types.js';

const NORKIN_2016  = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';
const MAGEE_7TH    = 'Magee DJ. Orthopedic Physical Assessment. 7th ed. Elsevier; 2021';
const MACDERMD2004 = 'MacDermid JC, Wessel J. J Hand Ther. 2004;17(3):309-319';

export const wrist: JointData = {
  joint: 'wrist',

  normalROM: {
    flexion:       { min: 0, max: 80, unit: 'degrees', citation: NORKIN_2016 },
    extension:     { min: 0, max: 70, unit: 'degrees', citation: NORKIN_2016 },
    radialDeviation: { min: 0, max: 20, unit: 'degrees', citation: NORKIN_2016 },
    ulnarDeviation:  { min: 0, max: 30, unit: 'degrees', citation: NORKIN_2016 },
    pronation:     { min: 0, max: 80, unit: 'degrees', citation: NORKIN_2016 },
    supination:    { min: 0, max: 80, unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'Phalen\'s Test (Carpal Tunnel)',
      procedure: 'Full wrist flexion sustained 60 s; paraesthesia in median nerve distribution (thumb, index, middle, radial ring) = positive for carpal tunnel syndrome',
      sensitivity: 0.68,
      specificity: 0.73,
      citation: MACDERMD2004,
    },
    {
      name: 'Tinel\'s Sign at Wrist (Carpal Tunnel)',
      procedure: 'Percuss over carpal tunnel at wrist crease; distal paraesthesia in median distribution = positive',
      sensitivity: 0.50,
      specificity: 0.77,
      citation: MACDERMD2004,
    },
    {
      name: 'Finkelstein Test (de Quervain\'s Tenosynovitis)',
      procedure: 'Patient makes fist with thumb inside fingers; examiner ulnar-deviates wrist; pain over 1st dorsal compartment (APL + EPB) = positive',
      sensitivity: 0.89,
      specificity: 0.14,
      citation: `NEEDS_CLINICAL_REVIEW — high sensitivity but very low specificity; procedure: Finkelstein H. J Bone Joint Surg. 1930;12:509-540; values from ${MAGEE_7TH}`,
      needsReview: true,
    },
    {
      name: 'Watson Shift Test (Scapholunate Instability)',
      procedure: 'Examiner presses scaphoid tubercle while moving wrist from ulnar to radial deviation; clunk or pain = positive for scapholunate ligament injury',
      sensitivity: 0.69,
      specificity: 0.66,
      citation: `NEEDS_CLINICAL_REVIEW — values variable; procedure from ${MAGEE_7TH}; Watson HK et al. J Hand Surg Am. 1988;13(5):657-660`,
      needsReview: true,
    },
    {
      name: 'Piano Key Test (DRUJ Instability)',
      procedure: 'Stabilise radius; press ulnar head posteriorly; excessive movement or pain = positive for distal radioulnar joint instability',
      sensitivity: 0.60,
      specificity: 0.70,
      citation: `NEEDS_CLINICAL_REVIEW — limited diagnostic accuracy data; procedure from ${MAGEE_7TH}`,
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'Carpal Tunnel Syndrome',
      icd10: 'G56.0',
      description: 'Median nerve compression at the carpal tunnel; most common peripheral nerve entrapment; female > male, age 40–60',
      commonPresentations: ['nocturnal paraesthesia thumb/index/middle', 'positive Phalen\'s and Tinel\'s', 'thenar atrophy late sign', 'aggravated by sustained grip or flexion'],
    },
    {
      name: 'de Quervain\'s Tenosynovitis',
      icd10: 'M65.4',
      description: 'Stenosing tenosynovitis of APL and EPB tendons in 1st dorsal extensor compartment; common postpartum and in racket sports',
      commonPresentations: ['radial wrist pain', 'positive Finkelstein test', 'tender over radial styloid', 'new mothers with infant-lifting mechanism'],
    },
    {
      name: 'Scaphoid Fracture',
      icd10: 'S62.001A',
      description: 'Most commonly fractured carpal bone; waist fractures risk AVN of proximal pole if missed; X-ray may be normal initially',
      commonPresentations: ['FOOSH mechanism', 'anatomical snuffbox tenderness', 'scaphoid compression test positive', 'normal initial X-ray does not exclude fracture'],
    },
    {
      name: 'TFCC Tear',
      icd10: 'S63.5',
      description: 'Triangular fibrocartilage complex injury; central disc tears (Type IA), peripheral tears (Type IB) with DRUJ instability; acute or degenerative',
      commonPresentations: ['ulnar-sided wrist pain', 'positive piano key test', 'pain with forearm rotation under load', 'positive fovea sign'],
    },
    {
      name: 'Wrist Ganglion Cyst',
      icd10: 'M67.44',
      description: 'Most common wrist mass; dorsal (60–70%) or volar (20–25%); arises from joint or tendon sheath',
      commonPresentations: ['smooth fluctuant mass', 'transilluminates', 'variable pain with activity', 'may resolve spontaneously'],
    },
    {
      name: 'Wrist Osteoarthritis',
      icd10: 'M19.039',
      description: 'Post-traumatic (scaphoid non-union → SNAC wrist; scapholunate → SLAC wrist) or primary OA',
      commonPresentations: ['diffuse wrist pain and stiffness', 'crepitus', 'loss of extension first', 'history of scaphoid fracture or ligament injury'],
    },
  ],

  redFlags: [
    {
      type: 'fracture',
      description: 'Scaphoid fracture risk of avascular necrosis — missed diagnosis leads to wrist collapse (SNAC wrist). Also distal radius fracture.',
      signsSymptoms: ['FOOSH mechanism', 'anatomical snuffbox tenderness', 'scaphoid pole tenderness', 'normal X-ray does NOT exclude scaphoid fracture'],
      immediateAction: 'URGENT: X-ray + if snuffbox tenderness persists → MRI or CT wrist at 1 week; immobilise in thumb spica splint; orthopaedic referral',
    },
    {
      type: 'infection',
      description: 'Septic tenosynovitis (Kanavel\'s signs) — surgical emergency; can progress to tendon necrosis within hours',
      signsSymptoms: ['Kanavel\'s 4 signs: finger held in flexion, fusiform swelling, tenderness along tendon sheath, pain with passive extension', 'fever', 'recent puncture wound'],
      immediateAction: 'EMERGENCY: immediate hand surgery; IV antibiotics; surgical irrigation',
    },
    {
      type: 'vascular_injury',
      description: 'Acute hand ischaemia after wrist fracture or dislocation; radial or ulnar artery injury',
      signsSymptoms: ['absent radial/ulnar pulse', 'pale cold hand', 'abnormal Allen test', 'following high-energy wrist trauma'],
      immediateAction: 'EMERGENCY: vascular surgery immediately',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — wrist flexor/extensor strengthening, nerve gliding for CTS' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — grip strengthening, functional hand tasks' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — carpal mobilisation, soft tissue' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — de Quervain\'s, carpal tunnel' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — pain modulation' },
    { code: '97750', description: 'Physical performance test or measurement', notes: 'Per 15 min — grip dynamometry, functional assessment' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — hand therapy class' },
  ],
};
