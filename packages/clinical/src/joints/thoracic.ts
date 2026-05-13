import type { JointData } from '../types.js';

const MAITLAND_8TH = 'Maitland GD. Vertebral Manipulation. 8th ed. Butterworth-Heinemann; 2013';
const NORKIN_2016  = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';
const MAGEE_7TH    = 'Magee DJ. Orthopedic Physical Assessment. 7th ed. Elsevier; 2021';

export const thoracic: JointData = {
  joint: 'thoracic',

  normalROM: {
    flexion:            { min: 0, max: 45, unit: 'degrees', citation: NORKIN_2016 },
    extension:          { min: 0, max: 25, unit: 'degrees', citation: NORKIN_2016 },
    leftLateralFlexion: { min: 0, max: 25, unit: 'degrees', citation: NORKIN_2016 },
    rightLateralFlexion:{ min: 0, max: 25, unit: 'degrees', citation: NORKIN_2016 },
    // Thoracic spine has greatest rotation of all spinal segments
    leftRotation:       { min: 0, max: 40, unit: 'degrees', citation: NORKIN_2016 },
    rightRotation:      { min: 0, max: 40, unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'Adam\'s Forward Bend Test (Scoliosis Screen)',
      procedure: 'Patient bends forward to 90° hip flexion; examiner views spine from behind; rib hump >5° on scoliometer = positive for structural scoliosis requiring further investigation',
      sensitivity: 0.83,
      specificity: 0.97,
      citation: 'Bunnell WP. Spine. 1984;9(4):376-380; scoliometer cut-off 5° from Raso VJ et al. J Pediatr Orthop. 2002',
      needsReview: true,
    },
    {
      name: 'Thoracic Passive Accessory Intervertebral Movement (PAIVM)',
      procedure: 'Prone; apply central PA pressure through spinous process or unilateral PA through transverse process; reproduction of local or referred pain + stiffness = positive for thoracic joint dysfunction (Maitland)',
      sensitivity: 0.60,
      specificity: 0.65,
      citation: `NEEDS_CLINICAL_REVIEW — no high-quality diagnostic accuracy trials; standard Maitland assessment technique from ${MAITLAND_8TH}`,
      needsReview: true,
    },
    {
      name: 'Rib Spring Test',
      procedure: 'Prone; apply AP pressure directly over posterior rib angles; reproduction of local or referred anterior chest pain = positive for costovertebral joint dysfunction or rib fracture',
      sensitivity: 0.65,
      specificity: 0.55,
      citation: `NEEDS_CLINICAL_REVIEW — limited diagnostic data; procedure from ${MAGEE_7TH}`,
      needsReview: true,
    },
    {
      name: 'Slump Test (Neural Tension — Thoracic Component)',
      procedure: 'Sitting; full spinal flexion + neck flexion + knee extension + dorsiflexion; mid-thoracic or thoracic dermatomal pain relieved by neck extension = positive for thoracic neural tension',
      sensitivity: 0.84,
      specificity: 0.83,
      citation: 'Majlesi J et al. J Clin Rheumatol. 2008;14(2):87-91',
      needsReview: true, // original study was lumbar-focused; thoracic component inferred
    },
    {
      name: 'First Rib Mobility Test',
      procedure: 'Supine; palpate first rib posterior to clavicle; resistance on inhalation or asymmetric elevation = positive for first rib restriction; may contribute to thoracic outlet symptoms',
      sensitivity: 0.55,
      specificity: 0.60,
      citation: `NEEDS_CLINICAL_REVIEW — limited data; procedure from ${MAITLAND_8TH}`,
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'Non-Specific Thoracic Pain',
      icd10: 'M54.6',
      description: 'Mechanical thoracic pain without specific structural cause; common in desk workers and adolescents; often responds to manual therapy',
      commonPresentations: ['central or paravertebral thoracic pain', 'aggravated by sustained posture', 'improved with movement', 'tenderness on PA palpation'],
    },
    {
      name: 'Scheuermann\'s Kyphosis',
      icd10: 'M42.0',
      description: 'Juvenile osteochondrosis of thoracic spine; ≥3 adjacent vertebrae with >5° anterior wedging; structural thoracic kyphosis',
      commonPresentations: ['adolescent male', 'thoracic kyphosis >40°', 'non-reducible on hyperextension', 'Schmorl\'s nodes on imaging', 'pain with prolonged sitting'],
    },
    {
      name: 'Thoracic Disc Herniation',
      icd10: 'M51.14',
      description: 'Rare (<1% of all disc herniations); risk of cord compression due to small canal; mid-thoracic most common; may mimic cardiac or GI pathology',
      commonPresentations: ['thoracic radicular pain (girdle pain)', 'bilateral leg symptoms', 'myelopathy signs if cord compressed', 'often incidental on MRI'],
    },
    {
      name: 'Osteoporotic Vertebral Compression Fracture',
      icd10: 'M80.08',
      description: 'T6–T12 most common; may occur with minimal or no trauma in severe osteoporosis; acute or chronic',
      commonPresentations: ['acute onset thoracic back pain', 'elderly female', 'height loss', 'postural kyphosis', 'may be painless and found incidentally'],
    },
    {
      name: 'Idiopathic Scoliosis',
      icd10: 'M41.1',
      description: 'Adolescent idiopathic scoliosis (AIS) most common; Cobb angle >10° defines scoliosis; >25° warrants bracing, >40–50° surgical consideration',
      commonPresentations: ['rib hump on Adam\'s test', 'unequal shoulder/hip height', 'adolescent female', 'usually painless; pain warrants investigation for secondary cause'],
    },
    {
      name: 'Ankylosing Spondylitis',
      icd10: 'M45.6',
      description: 'Seronegative spondyloarthropathy; progressive thoracolumbar ankylosis; HLA-B27 positive in 90%; bamboo spine on X-ray',
      commonPresentations: ['young male <40', 'morning stiffness >1 h improving with exercise', 'bilateral sacroiliitis', 'reduced chest expansion', 'positive BASDAI'],
    },
    {
      name: 'Costovertebral Joint Dysfunction',
      icd10: 'M99.04',
      description: 'Restricted or hypermobile costovertebral joint; sharp thoracic pain aggravated by deep breathing or rotation',
      commonPresentations: ['unilateral thoracic pain with breathing', 'tenderness at rib angle', 'positive rib spring test', 'responds to manipulation'],
    },
  ],

  redFlags: [
    {
      type: 'cancer',
      description: 'Thoracic spine metastases: most common site for spinal mets (breast, lung, prostate); thoracic pain in patient with cancer history is red flag until proven otherwise',
      signsSymptoms: ['prior cancer history', 'age >50', 'night pain', 'unexplained weight loss', 'thoracic pain (more sinister than lumbar)', 'constant non-mechanical pain'],
      immediateAction: 'URGENT: same-day medical referral; bloods (FBC, ESR, CRP, calcium, PSA/CA-125 as relevant); MRI thoracic spine',
    },
    {
      type: 'cord_compression',
      description: 'Thoracic myelopathy from cord compression (disc, tumour, fracture); UMN signs below lesion level',
      signsSymptoms: ['bilateral leg weakness or spasticity', 'hyperreflexia in legs', 'extensor plantar response', 'sensory level on trunk', 'bladder/bowel dysfunction'],
      immediateAction: 'EMERGENCY: MRI thoracic spine stat; neurosurgical referral immediately; no manual therapy',
    },
    {
      type: 'fracture',
      description: 'Thoracic compression fracture; osteoporosis risk especially post-menopausal women; also high-energy trauma',
      signsSymptoms: ['acute onset thoracic pain after minimal trauma', 'age >65 or known osteoporosis', 'prolonged corticosteroid use', 'point tenderness over vertebral body'],
      immediateAction: 'URGENT: X-ray thoracic spine immediately; DEXA scan if not recent; osteoporosis management; orthopaedic review',
    },
    {
      type: 'aortic_aneurysm',
      description: 'Thoracic aortic dissection presenting as severe tearing thoracic back pain; life-threatening emergency',
      signsSymptoms: ['sudden tearing or ripping thoracic back pain', 'pain radiates to jaw or abdomen', 'unequal arm blood pressures', 'haemodynamic instability', 'Marfan syndrome risk factor'],
      immediateAction: 'EMERGENCY: 999 immediately; do not perform any manual therapy; haemodynamic monitoring; vascular surgery emergency',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — thoracic extension exercises, chest expansion, breathing exercises, core stabilisation' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — postural correction, ergonomics, functional movement' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — thoracic mobilisation/manipulation, rib mobilisation, soft tissue' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — thoracic distraction (less common than cervical/lumbar)' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — paraspinal muscles, costovertebral joints' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — pain modulation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — scoliosis exercise class, postural group' },
  ],
};
