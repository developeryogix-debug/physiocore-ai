import type { JointData } from '../types.js';

// ROM source: Maitland GD. Vertebral Manipulation. 8th ed. Butterworth-Heinemann; 2013.
// Also: Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016.
const MAITLAND_8TH = 'Maitland GD. Vertebral Manipulation. 8th ed. Butterworth-Heinemann; 2013';
const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';

export const lumbar: JointData = {
  joint: 'lumbar',

  normalROM: {
    flexion:              { min: 0, max: 60,  unit: 'degrees', citation: `${MAITLAND_8TH}; ${NORKIN_2016}` },
    extension:            { min: 0, max: 25,  unit: 'degrees', citation: NORKIN_2016 },
    leftLateralFlexion:   { min: 0, max: 25,  unit: 'degrees', citation: NORKIN_2016 },
    rightLateralFlexion:  { min: 0, max: 25,  unit: 'degrees', citation: NORKIN_2016 },
    leftRotation:         { min: 0, max: 30,  unit: 'degrees', citation: NORKIN_2016 },
    rightRotation:        { min: 0, max: 30,  unit: 'degrees', citation: NORKIN_2016 },
    // Schober test: ≥5 cm increase from S1 + 10 cm mark with full flexion
    schober:              { min: 5,  max: 5,   unit: 'cm',     citation: MAITLAND_8TH, needsReview: true },
  },

  specialTests: [
    {
      name: 'Straight Leg Raise (Lasègue Sign)',
      procedure: 'Supine; passively raise extended leg; sciatica reproduced at <70° hip flexion = positive for lumbar disc herniation/nerve root compression at L4–S1',
      sensitivity: 0.91,
      specificity: 0.26,
      citation: 'Deville WL et al. Spine. 2000;25(9):1140-1147',
    },
    {
      name: 'Crossed Straight Leg Raise',
      procedure: 'Raise the UNAFFECTED leg; reproduction of pain in the OPPOSITE (symptomatic) leg = positive; high specificity for disc herniation',
      sensitivity: 0.29,
      specificity: 0.88,
      citation: 'Deville WL et al. Spine. 2000;25(9):1140-1147',
    },
    {
      name: 'Slump Test',
      procedure: 'Sitting; full spinal flexion, neck flexion, knee extension, then dorsiflexion; reproduction of radicular symptoms relieved by neck extension = positive for neural tension',
      sensitivity: 0.84,
      specificity: 0.83,
      citation: 'Majlesi J et al. J Clin Rheumatol. 2008;14(2):87-91',
    },
    {
      name: 'FABER (Patrick\'s) Test',
      procedure: 'Supine; Figure-4 position (hip flex/abd/ER, ankle on opposite knee); apply downward pressure on knee; anterior groin or posterior SI pain = positive; screens hip and SI joint',
      sensitivity: 0.77,
      specificity: 0.40,
      citation: 'Dreyfuss P et al. Spine. 1996;21(22):2594-2602',
      needsReview: true,
    },
    {
      name: 'Femoral Nerve Tension Test (Prone Knee Bend)',
      procedure: 'Prone; passively flex knee toward buttock; anterior thigh pain reproduced = positive for L2–L4 nerve root compression',
      sensitivity: 0.84,
      specificity: 0.54,
      citation: 'NEEDS_CLINICAL_REVIEW — sensitivity/specificity data limited; test procedure from Maitland 8th ed',
      needsReview: true,
    },
    {
      name: 'Sacral Thrust Test',
      procedure: 'Prone; apply direct posterior-to-anterior pressure over sacrum; posterior SI pain = positive for sacroiliac joint pathology (most accurate single SI provocation test)',
      sensitivity: 0.53,
      specificity: 0.76,
      citation: 'Laslett M et al. Man Ther. 2005;10(3):207-218',
    },
  ],

  commonPathologies: [
    {
      name: 'Non-specific Low Back Pain',
      icd10: 'M54.50',
      description: 'Mechanical LBP without specific structural diagnosis; accounts for ~90% of LBP presentations',
      commonPresentations: ['pain worse with movement, better with rest', 'no neurological signs', 'age 20–55', 'self-limiting in most cases'],
    },
    {
      name: 'Lumbar Disc Herniation with Radiculopathy',
      icd10: 'M51.16',
      description: 'Nucleus pulposus prolapse causing nerve root compression; L4–5 and L5–S1 most common levels',
      commonPresentations: ['dermatomal leg pain > back pain', 'positive SLR <60°', 'neurological deficit (sensation, reflex, power)', 'sneezing/Valsalva aggravates'],
    },
    {
      name: 'Lumbar Spondylosis with Radiculopathy',
      icd10: 'M47.816',
      description: 'Degenerative osteophytic changes causing foraminal stenosis; predominantly age >50',
      commonPresentations: ['insidious onset', 'age >50', 'multilevel stiffness', 'episodic radiculopathy', 'X-ray/CT confirms'],
    },
    {
      name: 'Lumbar Spinal Stenosis',
      icd10: 'M48.06',
      description: 'Central or lateral canal narrowing causing neurogenic claudication; most common >60 years',
      commonPresentations: ['bilateral leg pain with walking (neurogenic claudication)', 'relieved by sitting or lumbar flexion', 'improved walking uphill vs downhill', 'shopping trolley sign'],
    },
    {
      name: 'Spondylolisthesis',
      icd10: 'M43.16',
      description: 'Forward slip of one vertebral body on the next; L4–5 and L5–S1 most common; graded I–IV (Meyerding)',
      commonPresentations: ['step deformity on palpation', 'buttock and leg pain', 'hamstring tightness', 'young athletes (isthmic) or elderly (degenerative)'],
    },
    {
      name: 'Lumbar Sciatica',
      icd10: 'M54.4',
      description: 'Radicular pain along sciatic nerve distribution (L4–S1); caused by disc, osteophyte, or piriformis (extra-spinal)',
      commonPresentations: ['shooting pain below knee', 'dermatomal pattern', 'positive SLR', 'numbness or paraesthesia'],
    },
    {
      name: 'Sacroiliac Joint Dysfunction',
      icd10: 'M53.3',
      description: 'Pain arising from the sacroiliac joint; diagnosis by cluster of ≥3 provocation tests positive',
      commonPresentations: ['posterior pelvic pain below PSIS', 'positive FABER, thigh thrust, sacral thrust cluster', 'often post-partum or post-trauma', 'no neurological deficit'],
    },
    {
      name: 'Cauda Equina Syndrome',
      icd10: 'G83.4',
      description: 'Compression of the cauda equina nerve roots below L1; surgical emergency — permanent deficit if delayed >48 h',
      commonPresentations: ['saddle anaesthesia', 'bladder/bowel dysfunction', 'bilateral leg weakness', 'sexual dysfunction', 'may have reduced perianal tone'],
    },
  ],

  redFlags: [
    {
      type: 'cauda_equina',
      description: 'Cauda equina syndrome from large central disc herniation or tumour mass; decompression must occur within 48 h to prevent permanent deficit',
      signsSymptoms: ['saddle anaesthesia (perineum, inner thighs)', 'urinary retention or incontinence', 'faecal incontinence', 'bilateral leg weakness', 'reduced anal tone'],
      immediateAction: 'EMERGENCY: immediate 999/hospital transfer; MRI lumbar spine stat; urgent spinal surgery referral — do NOT delay',
    },
    {
      type: 'cancer',
      description: 'Spinal metastases or primary spinal tumour (most common: breast, prostate, lung, kidney, myeloma)',
      signsSymptoms: ['age >50', 'prior cancer history', 'unexplained weight loss >4.5 kg in 6 months', 'constant non-mechanical pain', 'severe night pain unrelieved by any position', 'thoracic spine pain'],
      immediateAction: 'URGENT: same-day medical referral; bloods (FBC, ESR, CRP, PSA, LFT, calcium); MRI spine if bloods abnormal',
    },
    {
      type: 'fracture',
      description: 'Vertebral compression fracture; risk: trauma, osteoporosis, prolonged corticosteroid use, age >70',
      signsSymptoms: ['significant trauma (MVA, fall from height)', 'minor trauma + osteoporosis risk', 'age >70', 'long-term corticosteroid use', 'acute onset thoracolumbar pain'],
      immediateAction: 'URGENT: plain X-ray immediately; non-weight-bearing position; orthopaedic or spinal referral',
    },
    {
      type: 'infection',
      description: 'Spinal discitis or epidural abscess; risk: IV drug use, diabetes, immunosuppression, recent spinal procedure',
      signsSymptoms: ['fever + constant LBP unrelieved by rest', 'IV drug use', 'recent spinal injection', 'immunosuppressed', 'markedly elevated CRP/ESR', 'progressive neurological deficit'],
      immediateAction: 'URGENT: immediate medical referral; FBC + CRP + blood cultures + ESR; MRI spine with gadolinium; IV antibiotics',
    },
    {
      type: 'aortic_aneurysm',
      description: 'Abdominal aortic aneurysm (AAA) expanding or dissecting; may mimic lumbar spine pain',
      signsSymptoms: ['age >60, male, smoker', 'tearing or ripping abdominal-back pain', 'pulsatile abdominal mass', 'pain not relieved by position', 'haemodynamic compromise'],
      immediateAction: 'EMERGENCY: immediate 999; do NOT palpate abdomen; haemodynamic monitoring; vascular surgery emergency',
    },
    {
      type: 'cord_compression',
      description: 'Spinal cord compression (above L1 — technically conus or thoracic); upper motor neuron signs distinguish from cauda equina',
      signsSymptoms: ['bilateral leg weakness', 'hyper-reflexia (as opposed to hyporeflexia in cauda equina)', 'extensor plantar response (Babinski)', 'clonus', 'gait ataxia'],
      immediateAction: 'EMERGENCY: immediate 999/hospital; MRI full spine stat; neurosurgical referral',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — core stabilisation, McKenzie exercises, neural mobilisation' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — functional movement training, lifting technique' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — lumbar mobilisation/manipulation, soft tissue, MWM' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — lumbar decompression for disc herniation / stenosis' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — paraspinal soft tissue' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for pain, NMES for multifidus activation' },
    { code: '97018', description: 'Paraffin bath', notes: 'Per day — lumbar heat pre-mobilisation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — back school / group LBP programme' },
  ],
};
