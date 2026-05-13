import type { JointData } from '../types.js';

// ROM source: Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016.
const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';

export const knee: JointData = {
  joint: 'knee',

  normalROM: {
    flexion:              { min: 0, max: 135, unit: 'degrees', citation: NORKIN_2016 },
    extension:            { min: 0, max: 0,   unit: 'degrees', citation: NORKIN_2016 },
    hyperextension:       { min: 0, max: 10,  unit: 'degrees', citation: NORKIN_2016, needsReview: true },
    // Tibial rotation measured at 90° knee flexion
    internalTibialRotation: { min: 0, max: 10, unit: 'degrees', citation: NORKIN_2016 },
    externalTibialRotation: { min: 0, max: 10, unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'Lachman Test',
      procedure: 'Knee at 20–30° flexion; stabilise femur; translate tibia anteriorly; increased excursion or absent firm endpoint = positive for ACL insufficiency',
      sensitivity: 0.87,
      specificity: 0.93,
      citation: 'Benjaminse A et al. Am J Sports Med. 2006;34(8):1299-1307',
    },
    {
      name: 'Anterior Drawer Test',
      procedure: 'Supine, knee at 90° flexion, hip at 45°; stabilise foot; translate tibia anteriorly; >5 mm excursion or absent endpoint = positive for ACL',
      sensitivity: 0.62,
      specificity: 0.88,
      citation: 'Benjaminse A et al. Am J Sports Med. 2006;34(8):1299-1307',
    },
    {
      name: 'Pivot Shift Test',
      procedure: 'Supine; apply valgus stress and internal rotation while extending from 30° flexion; clunk at ~30° = positive for ACL with anterolateral rotatory instability',
      sensitivity: 0.56,
      specificity: 0.98,
      citation: 'Benjaminse A et al. Am J Sports Med. 2006;34(8):1299-1307',
    },
    {
      name: 'McMurray Test',
      procedure: 'Supine; fully flex knee; apply valgus + ER for medial meniscus, or varus + IR for lateral meniscus; extend slowly; pain or click = positive',
      sensitivity: 0.70,
      specificity: 0.71,
      citation: 'Hegedus EJ et al. Br J Sports Med. 2007;41(6):343-352',
    },
    {
      name: 'Thessaly Test',
      procedure: 'Standing on affected leg, knee at 20° flexion; patient rotates torso medially and laterally × 3; medial or lateral joint line pain or locking = positive for meniscal pathology',
      sensitivity: 0.89,
      specificity: 0.97,
      citation: 'Karachalios T et al. J Bone Joint Surg Am. 2005;87(5):955-962',
    },
    {
      name: 'Posterior Drawer Test',
      procedure: 'Supine, knee at 90°; posterior translation of tibia on femur; sagging of tibial plateau and increased excursion = positive for PCL insufficiency',
      sensitivity: 0.90,
      specificity: 0.99,
      citation: 'Rubinstein RA et al. Am J Sports Med. 1994;22(4):550-557',
    },
    {
      name: 'Valgus Stress Test',
      procedure: 'Knee at 0° (tests capsule) and 30° flexion (isolates MCL); apply valgus force; medial joint pain or increased laxity = positive for MCL sprain',
      sensitivity: 0.86,
      specificity: 0.86,
      citation: 'Kastelein M et al. Knee. 2009;16(1):17-23',
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'ACL Rupture',
      icd10: 'M23.619',
      description: 'Complete or partial tear of the anterior cruciate ligament; most common in pivoting and cutting sports',
      commonPresentations: ['audible pop at time of injury', 'immediate swelling (haemarthrosis)', 'positive Lachman and anterior drawer', 'instability on pivoting'],
    },
    {
      name: 'Medial Meniscal Tear',
      icd10: 'M23.219',
      description: 'Tear of the medial (C-shaped) meniscus; degenerative or traumatic (rotational injury)',
      commonPresentations: ['medial joint line pain', 'positive McMurray and Thessaly', 'joint line tenderness', 'locking or giving way'],
    },
    {
      name: 'Lateral Meniscal Tear',
      icd10: 'M23.229',
      description: 'Tear of the lateral (O-shaped) meniscus; often associated with ACL rupture',
      commonPresentations: ['lateral joint line pain', 'positive McMurray (varus + IR)', 'popliteal fossa pain', 'discoid meniscus in younger patients'],
    },
    {
      name: 'Patellofemoral Pain Syndrome',
      icd10: 'M22.2',
      description: 'Anterior knee pain arising from the patellofemoral joint; multifactorial (biomechanical, loading, muscular)',
      commonPresentations: ['anterior knee pain with stairs/squatting', 'worse sitting (cinema sign)', 'VMO weakness', 'positive Clarke\'s test'],
    },
    {
      name: 'Knee Osteoarthritis',
      icd10: 'M17.1',
      description: 'Degenerative joint disease of the tibiofemoral and/or patellofemoral compartments',
      commonPresentations: ['age >45', 'morning stiffness <30 min', 'crepitus', 'bony enlargement', 'varus deformity in medial compartment disease'],
    },
    {
      name: 'Patellar Tendinopathy (Jumper\'s Knee)',
      icd10: 'M76.5',
      description: 'Degenerative tendinopathy of the patellar tendon insertion at the inferior pole of patella',
      commonPresentations: ['inferior patellar pole pain', 'worse with jumping/landing', 'single-leg squat pain', 'palpation tenderness at inferior pole'],
    },
    {
      name: 'Iliotibial Band Syndrome',
      icd10: 'M76.3',
      description: 'Friction or compression of the ITB at the lateral femoral epicondyle; common in runners',
      commonPresentations: ['lateral knee pain at 30° flexion (impingement zone)', 'positive Noble compression test', 'pain worsening with mileage', 'no joint line tenderness'],
    },
    {
      name: 'PCL Rupture',
      icd10: 'M23.629',
      description: 'Posterior cruciate ligament tear; dashboard injury mechanism or hyperflexion',
      commonPresentations: ['posterior knee pain', 'positive posterior drawer and posterior sag', 'posterior tibial step-off', 'often missed initially'],
    },
  ],

  redFlags: [
    {
      type: 'septic_arthritis',
      description: 'Septic arthritis of the knee is an orthopaedic emergency; risk of rapid cartilage destruction',
      signsSymptoms: ['fever >38°C', 'acute hot swollen knee', 'non-weight-bearing', 'systemically unwell', 'CRP/ESR markedly elevated'],
      immediateAction: 'EMERGENCY: immediate hospital admission; joint aspiration for MC&S before antibiotics',
    },
    {
      type: 'fracture',
      description: 'Tibial plateau, femoral condyle, or patellar fracture; Ottawa Knee Rules guide imaging need',
      signsSymptoms: ['high-energy trauma', 'unable to weight bear', 'bony tenderness at fibular head or tibial plateau', 'age ≥55 with isolated patellar tenderness'],
      immediateAction: 'URGENT: plain X-ray (AP + lateral) immediately; non-weight-bearing until result',
    },
    {
      type: 'dvt',
      description: 'Deep vein thrombosis presenting as posterior knee or calf pain; risk after trauma, surgery, or prolonged immobility',
      signsSymptoms: ['calf swelling and warmth', 'Homan\'s sign (low sensitivity — use Wells score)', 'pitting oedema', 'recent surgery, immobilisation, or cancer'],
      immediateAction: 'URGENT: Wells DVT score; if ≥2 → ultrasound Doppler same day; if score ≤1 → D-dimer',
    },
    {
      type: 'vascular_injury',
      description: 'Popliteal artery injury after knee dislocation or high-energy trauma; risk of limb ischaemia',
      signsSymptoms: ['knee dislocation mechanism', 'absent popliteal or foot pulses', 'pallor or paraesthesia distal to knee', 'expanding haematoma'],
      immediateAction: 'EMERGENCY: vascular surgery immediately; ABI measurement; do NOT delay for imaging',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — quadriceps setting, SLR, terminal knee extension, VMO activation' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — step training, balance board, sport-specific drills' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — patellar mobilisation, tibiofemoral glides, soft tissue' },
    { code: '97016', description: 'Vasopneumatic compression device', notes: 'Per 15 min — acute post-surgical oedema management' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — patellar tendon, soft tissue' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — tibiofemoral distraction' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — knee OA class' },
  ],
};
