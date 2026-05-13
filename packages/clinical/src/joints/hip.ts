import type { JointData } from '../types.js';

const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';
const MAGEE_7TH   = 'Magee DJ. Orthopedic Physical Assessment. 7th ed. Elsevier; 2021';

export const hip: JointData = {
  joint: 'hip',

  normalROM: {
    flexion:           { min: 0, max: 120, unit: 'degrees', citation: NORKIN_2016 },
    extension:         { min: 0, max: 30,  unit: 'degrees', citation: NORKIN_2016 },
    abduction:         { min: 0, max: 45,  unit: 'degrees', citation: NORKIN_2016 },
    adduction:         { min: 0, max: 30,  unit: 'degrees', citation: NORKIN_2016 },
    internalRotation:  { min: 0, max: 35,  unit: 'degrees', citation: NORKIN_2016 },
    externalRotation:  { min: 0, max: 45,  unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'FADIR Test (Femoroacetabular Impingement)',
      procedure: 'Supine; flex hip to 90°, adduct, then internally rotate; groin or anterolateral hip pain = positive for FAI or labral pathology',
      sensitivity: 0.94,
      specificity: 0.34,
      citation: 'Reiman MP et al. J Orthop Sports Phys Ther. 2015;45(3):116-141',
    },
    {
      name: 'FABER (Patrick\'s) Test',
      procedure: 'Supine; Figure-4 (hip flex/abd/ER, ankle on opposite knee); apply downward force on knee; groin or posterior hip pain = positive for hip or SI joint pathology',
      sensitivity: 0.88,
      specificity: 0.43,
      citation: 'Maslowski E et al. J Orthop Sports Phys Ther. 2010;40(10):613-618',
    },
    {
      name: 'Trendelenburg Test',
      procedure: 'Stand on one leg for 30 s; contralateral pelvis drops below level of stance side = positive for hip abductor (gluteus medius) weakness',
      sensitivity: 0.55,
      specificity: 0.70,
      citation: 'Hardcastle P, Nade S. J Bone Joint Surg Br. 1985;67(5):741-746',
      needsReview: true,
    },
    {
      name: 'Thomas Test (Hip Flexor Tightness)',
      procedure: 'Supine; fully flex one hip to chest; if contralateral thigh rises off table = positive for hip flexor (iliopsoas/rectus femoris) tightness',
      sensitivity: 0.89,
      specificity: 0.92,
      citation: `NEEDS_CLINICAL_REVIEW — diagnostic accuracy data limited; procedure from Kendall FP et al. Muscles Testing and Function. 5th ed. 2005; values from ${MAGEE_7TH}`,
      needsReview: true,
    },
    {
      name: 'Log Roll Test',
      procedure: 'Supine; passively internally and externally rotate the relaxed leg; groin/anterior hip pain = positive for hip intra-articular pathology',
      sensitivity: 0.42,
      specificity: 0.98,
      citation: 'Reiman MP et al. J Orthop Sports Phys Ther. 2015;45(3):116-141',
    },
    {
      name: 'Ober Test (IT Band / TFL Tightness)',
      procedure: 'Sidelying with bottom hip/knee flexed; abduct and extend upper hip; release; inability to adduct below neutral = positive for IT band/TFL tightness',
      sensitivity: 0.80,
      specificity: 0.60,
      citation: `NEEDS_CLINICAL_REVIEW — limited diagnostic data; procedure from ${MAGEE_7TH}; Ober FR. JAMA. 1936;116(24):2477-2479`,
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'Hip Osteoarthritis',
      icd10: 'M16.1',
      description: 'Primary OA of the hip; most common cause of hip pain in adults >50; progressive loss of articular cartilage',
      commonPresentations: ['groin and medial thigh pain', 'reduced IR and flexion first', 'antalgic gait', 'log roll test positive', 'X-ray: joint space narrowing, osteophytes'],
    },
    {
      name: 'Femoroacetabular Impingement (FAI)',
      icd10: 'M24.859',
      description: 'Cam (femoral) or pincer (acetabular) morphology causing premature contact and labral/cartilage damage; young active adults',
      commonPresentations: ['C-sign groin pain', 'positive FADIR', 'reduced IR in flexion', 'activity-related anterior hip pain', 'young athlete'],
    },
    {
      name: 'Acetabular Labral Tear',
      icd10: 'M24.859',
      description: 'Tear of the fibrocartilaginous labrum; often secondary to FAI or hip dysplasia; can cause mechanical catching',
      commonPresentations: ['positive FABER + FADIR cluster', 'clicking or catching', 'sudden sharp groin pain', 'deep ache with sitting'],
    },
    {
      name: 'Greater Trochanteric Pain Syndrome (GTPS)',
      icd10: 'M70.6',
      description: 'Lateral hip pain from gluteal tendinopathy (gluteus medius/minimus) ± trochanteric bursitis; previously called trochanteric bursitis',
      commonPresentations: ['lateral hip pain', 'point tender over greater trochanter', 'positive Trendelenburg', 'positive hip abductor load test', 'common in middle-aged women'],
    },
    {
      name: 'Piriformis Syndrome',
      icd10: 'G57.0',
      description: 'Sciatic nerve irritation by the piriformis muscle; extra-spinal cause of sciatica; controversial entity',
      commonPresentations: ['deep gluteal pain', 'positive FAIR test (flex/adduct/IR)', 'pain with prolonged sitting', 'normal spine imaging'],
    },
    {
      name: 'Hip Labral Tear / Hip Dysplasia',
      icd10: 'M24.859',
      description: 'Acetabular dysplasia (shallow socket) predisposes to labral tear and early OA; Wiberg centre-edge angle <20° on X-ray',
      commonPresentations: ['anterior hip/groin pain', 'instability sensation', 'positive anterior apprehension', 'young women', 'previous childhood hip problems'],
    },
    {
      name: 'Snapping Hip (Coxa Saltans)',
      icd10: 'M65.359',
      description: 'Audible or palpable snapping; internal (iliopsoas over iliopectineal eminence) or external (IT band over greater trochanter)',
      commonPresentations: ['audible snap with hip flexion/extension', 'usually painless unless bursitis coexists', 'internal type: snap in groin', 'external type: lateral snap'],
    },
  ],

  redFlags: [
    {
      type: 'fracture',
      description: 'Femoral neck fracture in elderly after low-energy fall; high risk of AVN; immediate surgical fixation required',
      signsSymptoms: ['elderly patient with fall', 'hip pain and inability to weight-bear', 'externally rotated and shortened limb', 'groin pain'],
      immediateAction: 'URGENT: X-ray immediately (AP pelvis + lateral hip); orthopaedic surgical review; nil-by-mouth in preparation for surgery',
    },
    {
      type: 'cancer',
      description: 'Metastases to proximal femur (breast, prostate, lung, kidney, myeloma); may present as hip/groin pain before pathological fracture',
      signsSymptoms: ['age >50', 'prior cancer history', 'night pain unrelieved by rest', 'unexplained weight loss', 'groin pain without clear musculoskeletal pattern'],
      immediateAction: 'URGENT: same-day medical referral; X-ray + MRI; bloods (FBC, CRP, PSA, LFT, calcium)',
    },
    {
      type: 'septic_arthritis',
      description: 'Septic hip arthritis is an orthopaedic emergency; severe cartilage destruction within hours',
      signsSymptoms: ['fever + acute severe hip pain', 'unable to weight bear', 'all movements restricted and painful', 'CRP markedly elevated', 'child: Kocher criteria (fever, non-weight-bear, ESR, WBC)'],
      immediateAction: 'EMERGENCY: immediate hospital; joint aspiration under imaging guidance; IV antibiotics; surgical washout',
    },
    {
      type: 'vascular_injury',
      description: 'Avascular necrosis (AVN) of the femoral head — risk: corticosteroids, alcohol, sickle cell, trauma',
      signsSymptoms: ['hip pain with no clear trauma in young adult', 'corticosteroid use', 'excessive alcohol', 'sickle cell disease', 'normal X-ray early (MRI needed)'],
      immediateAction: 'URGENT: MRI hip; orthopaedic core decompression may prevent collapse; early referral critical',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — gluteal strengthening, hip abductor loading, Trendelenburg correction' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — gait retraining, functional squat patterns, single-leg balance' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — hip mobilisation/distraction, soft tissue to iliopsoas/piriformis' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — hip joint distraction' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — trochanteric bursa, hip flexor tendons' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — gluteal muscle activation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — hip OA exercise class' },
  ],
};
