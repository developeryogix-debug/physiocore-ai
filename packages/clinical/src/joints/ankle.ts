import type { JointData } from '../types.js';

const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';

export const ankle: JointData = {
  joint: 'ankle',

  normalROM: {
    dorsiflexion:    { min: 0, max: 20, unit: 'degrees', citation: NORKIN_2016 },
    plantarflexion:  { min: 0, max: 50, unit: 'degrees', citation: NORKIN_2016 },
    inversion:       { min: 0, max: 35, unit: 'degrees', citation: NORKIN_2016 },
    eversion:        { min: 0, max: 15, unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'Anterior Drawer Test (ATFL)',
      procedure: 'Knee flexed to reduce gastrocnemius tension; ankle in 20° plantarflexion; translate calcaneus anteriorly relative to tibia; dimpling or >4mm excursion = positive for ATFL tear',
      sensitivity: 0.86,
      specificity: 0.74,
      citation: 'van Dijk CN et al. J Bone Joint Surg Br. 1996;78(6):958-962',
    },
    {
      name: 'Talar Tilt Test (CFL)',
      procedure: 'Ankle at 0° (neutral); invert calcaneus; talar tilt >10° or significant laxity vs contralateral = positive for calcaneofibular ligament tear',
      sensitivity: 0.50,
      specificity: 0.88,
      citation: 'van Dijk CN et al. J Bone Joint Surg Br. 1996;78(6):958-962',
      needsReview: true,
    },
    {
      name: 'Thompson Test (Achilles Tendon Rupture)',
      procedure: 'Prone; squeeze gastrocnemius-soleus bulk; absence of plantarflexion response = positive for complete Achilles tendon rupture',
      sensitivity: 0.96,
      specificity: 0.93,
      citation: 'Maffulli N. Clin J Sport Med. 1998;8(3):171-176',
    },
    {
      name: 'Ottawa Ankle Rules',
      procedure: 'X-ray indicated if: bony tenderness at posterior tip/distal 6cm of fibula OR posterior tip/distal 6cm of tibia OR inability to weight bear ≥4 steps immediately and in clinic',
      sensitivity: 0.98,
      specificity: 0.40,
      citation: 'Stiell IG et al. JAMA. 1994;271(11):827-832',
    },
    {
      name: 'Kleiger Test (External Rotation — Syndesmosis)',
      procedure: 'Seated, knee at 90°; stabilise tibia; apply external rotation force to foot; pain over anterior tibiofibular ligament or medial deltoid = positive for syndesmotic injury',
      sensitivity: 0.76,
      specificity: 0.64,
      citation: 'Beumer A et al. Acta Orthop Scand. 2002;73(6):667-669',
      needsReview: true,
    },
    {
      name: 'Single-Heel Raise Test (Tibialis Posterior)',
      procedure: 'Stand on single leg; attempt 10 repetitive heel raises; inability or >3° hindfoot valgus collapse = positive for tibialis posterior insufficiency',
      sensitivity: 0.88,
      specificity: 0.82,
      citation: 'NEEDS_CLINICAL_REVIEW — values from Magee DJ. Orthopedic Physical Assessment. 7th ed. Elsevier; 2021',
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'Lateral Ankle Sprain (ATFL ± CFL)',
      icd10: 'S93.401A',
      description: 'Most common sports injury; Grade I (stretch), II (partial tear), III (complete tear); inversion + plantarflexion mechanism',
      commonPresentations: ['lateral ankle pain post-inversion', 'swelling around lateral malleolus', 'positive anterior drawer ± talar tilt', 'Ottawa rules to exclude fracture'],
    },
    {
      name: 'Achilles Tendinopathy',
      icd10: 'M76.6',
      description: 'Degenerative tendinopathy of Achilles tendon; mid-portion (2–6 cm proximal to insertion) or insertional; overuse in runners',
      commonPresentations: ['morning stiffness improving with warm-up', 'fusiform tendon thickening', 'pain with eccentric loading', 'positive arc sign (pain moves with tendon)'],
    },
    {
      name: 'Achilles Tendon Rupture',
      icd10: 'S86.001A',
      description: 'Complete rupture of Achilles tendon; typically at watershed zone 2–6 cm proximal to insertion; sudden push-off mechanism',
      commonPresentations: ['audible pop and sudden severe pain', 'positive Thompson test', 'palpable gap', 'unable to plantarflex against resistance', 'history of fluoroquinolone use increases risk'],
    },
    {
      name: 'Plantar Fasciitis',
      icd10: 'M72.2',
      description: 'Degenerative fasciopathy at calcaneal insertion; most common cause of heel pain; not truly inflammatory',
      commonPresentations: ['first-step morning heel pain (worst)', 'tenderness at medial calcaneal tuberosity', 'pain with prolonged standing', 'tight gastrocnemius-soleus'],
    },
    {
      name: 'Syndesmotic (High Ankle) Sprain',
      icd10: 'S93.431A',
      description: 'Injury to anterior tibiofibular ligament ± interosseous membrane; longer recovery than lateral sprain; may be associated with fracture',
      commonPresentations: ['pain above ankle mortise', 'positive Kleiger test', 'positive squeeze test (calf squeeze → ankle pain)', 'mechanism: external rotation or hyperdorsiflexion'],
    },
    {
      name: 'Peroneal Tendon Tear / Subluxation',
      icd10: 'M66.371',
      description: 'Longitudinal tear (peroneus brevis most common) or subluxation over lateral malleolus; ankle inversion injury or chronic ankle instability',
      commonPresentations: ['lateral ankle pain posterior to fibula', 'peroneal snap with circumduction', 'tenderness along peroneal tendons', 'may coexist with lateral ankle sprain'],
    },
    {
      name: 'Ankle Osteoarthritis',
      icd10: 'M19.071',
      description: 'Post-traumatic OA most common (80%); often follows talar fracture, ankle fracture, or recurrent instability',
      commonPresentations: ['anterior ankle pain', 'loss of dorsiflexion first', 'anterior osteophytes on X-ray', 'pain worse with walking on uneven ground'],
    },
  ],

  redFlags: [
    {
      type: 'fracture',
      description: 'Ottawa Ankle Rules — bony fracture risk; also consider talar fracture and calcaneal fracture (high-energy)',
      signsSymptoms: ['Ottawa Ankle Rules positive', 'high-energy trauma (fall from height)', 'inability to weight-bear', 'bony tenderness over malleoli, navicular, or 5th metatarsal base'],
      immediateAction: 'URGENT: X-ray immediately (AP + lateral + mortise views); orthopaedic review if fracture confirmed; non-weight-bearing',
    },
    {
      type: 'dvt',
      description: 'DVT presenting as calf/ankle swelling after immobilisation, ankle fracture, or surgery',
      signsSymptoms: ['calf swelling + warmth', 'pitting oedema', 'Wells DVT score ≥2', 'recent surgery, trauma, or immobilisation', 'history of DVT or malignancy'],
      immediateAction: 'URGENT: Wells DVT score; if score ≥2 → proximal vein ultrasound Doppler same day; anticoagulation pending result',
    },
    {
      type: 'infection',
      description: 'Septic ankle arthritis or necrotising fasciitis of foot/ankle; orthopaedic emergency',
      signsSymptoms: ['fever + acutely hot swollen ankle', 'non-weight-bearing', 'systemically unwell', 'rapidly spreading erythema (necrotising fasciitis)', 'diabetes or immunosuppression'],
      immediateAction: 'EMERGENCY: hospital admission; joint aspiration for MC&S; IV antibiotics; necrotising fasciitis → emergency surgery',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — calf eccentric programme, peroneal strengthening, balance/proprioception' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — gait retraining, sport-specific agility, return-to-run protocol' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — talocrural mobilisation (Maitland Grade III–IV), soft tissue' },
    { code: '97016', description: 'Vasopneumatic compression device', notes: 'Per 15 min — acute ankle swelling management' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — Achilles tendon, peroneal tendons' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for pain, NMES for peroneal activation' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — ankle rehab circuit' },
  ],
};
