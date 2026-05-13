import type { JointData } from '../types.js';

// SI joint motion is 1–4° and cannot be measured with standard goniometry.
// ROM values below reflect the functional pelvis assessment measures used clinically.
// Source: Lee D. The Pelvic Girdle. 4th ed. Elsevier; 2011.
const LEE_2011     = 'Lee D. The Pelvic Girdle. 4th ed. Elsevier; 2011';
const LASLETT_2005 = 'Laslett M et al. Man Ther. 2005;10(3):207-218';

export const si: JointData = {
  joint: 'si',

  normalROM: {
    // SI joint has <4° true ROM — clinical assessment uses pain provocation, not goniometry
    nutation:          { min: 0, max: 4, unit: 'degrees', citation: LEE_2011, needsReview: true },
    counternutation:   { min: 0, max: 4, unit: 'degrees', citation: LEE_2011, needsReview: true },
    // Innominate rotation (anterior/posterior tilt relative to sacrum)
    innominateRotation:{ min: 0, max: 5, unit: 'degrees', citation: LEE_2011, needsReview: true },
  },

  specialTests: [
    {
      name: 'Posterior Shear / Thigh Thrust Test',
      procedure: 'Supine; hip flexed to 90° on test side; apply posterior-to-anterior shear through femur (axial load); posterior SI pain = positive; highest diagnostic value of individual SI tests',
      sensitivity: 0.88,
      specificity: 0.69,
      citation: LASLETT_2005,
    },
    {
      name: 'Compression Test (Lateral Pelvic Compression)',
      procedure: 'Sidelying; apply medial pressure through iliac crest toward the table; posterior SI pain = positive',
      sensitivity: 0.69,
      specificity: 0.69,
      citation: LASLETT_2005,
    },
    {
      name: 'Distraction Test (Anterior Pelvic Gapping)',
      procedure: 'Supine; apply bilateral anterior pressure through ASIS; posterior SI pain = positive',
      sensitivity: 0.60,
      specificity: 0.81,
      citation: LASLETT_2005,
    },
    {
      name: 'Sacral Thrust Test',
      procedure: 'Prone; apply direct PA pressure over sacrum; posterior SI pain = positive',
      sensitivity: 0.53,
      specificity: 0.76,
      citation: LASLETT_2005,
    },
    {
      name: 'Active Straight Leg Raise (ASLR)',
      procedure: 'Supine; raise straight leg 20 cm without bending knee; posterior pelvic girdle pain or report of heaviness = positive; then test with manual pelvic compression to assess form closure',
      sensitivity: 0.87,
      specificity: 0.94,
      citation: 'Mens JM et al. Spine. 2001;26(10):1167-1171',
    },
    {
      name: 'Laslett SI Cluster (≥3 of 5 provocation tests positive)',
      procedure: 'Score positive if ≥3 of: Distraction, Compression, Thigh Thrust, Sacral Thrust, Gaenslen\'s; cluster has better diagnostic value than any single test',
      sensitivity: 0.91,
      specificity: 0.78,
      citation: LASLETT_2005,
    },
  ],

  commonPathologies: [
    {
      name: 'Sacroiliac Joint Pain / Dysfunction',
      icd10: 'M53.3',
      description: 'Posterior pelvic pain from the SI joint; confirmed by cluster of ≥3 provocation tests and response to diagnostic injection; accounts for ~15–30% of low back pain',
      commonPresentations: ['posterior pelvic pain below PSIS', 'buttock pain', 'positive Laslett cluster', 'no neurological deficit', 'worsens with unilateral loading (stairs, single leg stance)'],
    },
    {
      name: 'Sacroiliitis',
      icd10: 'M46.1',
      description: 'Inflammatory sacroiliac joint disease; bilateral = spondyloarthropathy (AS, psoriatic, reactive); unilateral = infection or crystal arthropathy',
      commonPresentations: ['bilateral: young male, morning stiffness >1 h, buttock pain alternating sides', 'HLA-B27 positive', 'X-ray/MRI: erosions, sclerosis', 'elevated ESR/CRP'],
    },
    {
      name: 'Posterior Pelvic Girdle Pain (Pregnancy-Related)',
      icd10: 'O26.71',
      description: 'SI-related pelvic girdle pain during or after pregnancy; distinct from lumbar pain; positive ASLR; impaired load transfer',
      commonPresentations: ['posterior pelvic pain from 2nd trimester', 'positive ASLR', 'positive P4 test', 'pain with rolling in bed and single leg activities', 'persists postpartum in ~10%'],
    },
    {
      name: 'Ankylosing Spondylitis',
      icd10: 'M45.1',
      description: 'Seronegative spondyloarthropathy starting at sacroiliac joints; progressive ankylosis; HLA-B27 90%',
      commonPresentations: ['age <40', 'bilateral buttock pain alternating sides', 'morning stiffness >1 h', 'reduced chest expansion', 'bamboo spine late finding', 'elevated CRP/ESR'],
    },
    {
      name: 'Osteitis Condensans Ilii',
      icd10: 'M85.38',
      description: 'Benign sclerosis of inferior ilium adjacent to SI joint; common in multiparous women; triangular sclerosis on X-ray; usually resolves',
      commonPresentations: ['young parous women', 'low back + buttock pain', 'bilateral triangular sclerotic area on ilium', 'joints not eroded (differentiates from AS)', 'usually self-limiting'],
    },
  ],

  redFlags: [
    {
      type: 'infection',
      description: 'Septic sacroiliitis; rare but serious; haematogenous or via IV drug use; unilateral sacroiliac joint infection',
      signsSymptoms: ['fever + unilateral buttock pain', 'unable to weight bear', 'markedly elevated CRP/WBC', 'IV drug use', 'immunosuppression', 'recent urinary/pelvic procedure'],
      immediateAction: 'URGENT: immediate hospital; MRI sacroiliac joints; blood cultures; IV antibiotics; orthopaedic review',
    },
    {
      type: 'cancer',
      description: 'Sacral tumours (giant cell tumour, chordoma, metastases); may mimic SI joint dysfunction',
      signsSymptoms: ['night pain', 'unexplained weight loss', 'palpable sacral mass', 'bladder/bowel dysfunction', 'age >50', 'progressive neurological deficit'],
      immediateAction: 'URGENT: MRI pelvis and sacrum; bloods; oncology referral',
    },
    {
      type: 'fracture',
      description: 'Sacral stress fracture (insufficiency fracture in osteoporotic patients or female athletes) or traumatic sacral fracture',
      signsSymptoms: ['elderly osteoporotic patient with buttock/sacral pain', 'female distance runner with sacral pain', 'trauma', 'H-pattern signal on bone scan / MRI'],
      immediateAction: 'URGENT: MRI or bone scan (X-ray often normal); activity modification; orthopaedic review',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — pelvic floor, gluteal, core stabilisation (form + force closure)' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — load transfer training, gait correction' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — SI joint mobilisation, MET, pelvic girdle manipulation' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — pelvic distraction' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — sacrotuberous ligament, posterior SI joint' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — gluteal activation, pain modulation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — pelvic girdle pain group (postpartum)' },
  ],
};
