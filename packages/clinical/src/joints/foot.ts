import type { JointData } from '../types.js';

const NORKIN_2016 = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';
const MAGEE_7TH   = 'Magee DJ. Orthopedic Physical Assessment. 7th ed. Elsevier; 2021';

export const foot: JointData = {
  joint: 'foot',

  normalROM: {
    // 1st MTP: critical for normal gait push-off (requires ~65° extension)
    firstMTPExtension: { min: 0, max: 70, unit: 'degrees', citation: NORKIN_2016 },
    firstMTPFlexion:   { min: 0, max: 45, unit: 'degrees', citation: NORKIN_2016 },
    subtalarInversion: { min: 0, max: 35, unit: 'degrees', citation: NORKIN_2016 },
    subtalarEversion:  { min: 0, max: 15, unit: 'degrees', citation: NORKIN_2016 },
    // Midfoot: Lisfranc joint complex — minimal motion; no standard goniometric normal values
  },

  specialTests: [
    {
      name: 'Windlass Test (Plantar Fasciitis)',
      procedure: 'Non-weight-bearing: passively extend great toe; heel pain = positive. Weight-bearing: patient extends great toe actively on step; more clinically representative',
      sensitivity: 0.32,
      specificity: 1.00,
      citation: 'Bolgla LA, Malone TR. J Orthop Sports Phys Ther. 2004;34(6):305-315',
    },
    {
      name: 'Ottawa Foot Rules',
      procedure: 'X-ray of foot indicated if: bony tenderness at navicular or base of 5th metatarsal + inability to weight bear ≥4 steps immediately and in clinic',
      sensitivity: 0.98,
      specificity: 0.49,
      citation: 'Stiell IG et al. JAMA. 1994;271(11):827-832',
    },
    {
      name: 'Mulder\'s Click Test (Morton\'s Neuroma)',
      procedure: 'Transverse compression of metatarsal heads while simultaneously compressing the interspace between 3rd and 4th (or 2nd and 3rd) metatarsals; click ± plantar pain = positive',
      sensitivity: 0.62,
      specificity: 0.62,
      citation: 'Pastides PS et al. Foot Ankle Surg. 2012;18(4):228-234',
      needsReview: true,
    },
    {
      name: 'Too Many Toes Sign (Tibialis Posterior Dysfunction)',
      procedure: 'View patient from behind in normal standing; >2 toes visible lateral to fibula on affected side = positive for tibialis posterior tendon insufficiency / pes planus',
      sensitivity: 0.84,
      specificity: 0.72,
      citation: `NEEDS_CLINICAL_REVIEW — values from ${MAGEE_7TH}; Johnson KA, Strom DE. Foot Ankle. 1989;9(4):154-166`,
      needsReview: true,
    },
    {
      name: 'Single-Leg Heel Raise (Tibialis Posterior)',
      procedure: 'Stand on affected leg; perform 10 heel raises; inability to achieve >10 raises or hindfoot valgus collapse = positive for Stage II+ tibialis posterior tendon dysfunction',
      sensitivity: 0.88,
      specificity: 0.82,
      citation: `NEEDS_CLINICAL_REVIEW — limited diagnostic accuracy trials; functional criteria from Myerson MS. Foot Ankle Int. 1997;18(7):408-414`,
      needsReview: true,
    },
    {
      name: '1st MTP Dorsiflexion Assessment (Hallux Rigidus / Limitus)',
      procedure: 'Non-weight-bearing: measure passive 1st MTP extension; <65° indicates hallux limitus; <20° indicates hallux rigidus; pain at end range with grind = positive for 1st MTP OA',
      sensitivity: 0.85,
      specificity: 0.80,
      citation: `NEEDS_CLINICAL_REVIEW — cut-offs from ${MAGEE_7TH}; Roukis TS et al. J Foot Ankle Surg. 2009`,
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'Plantar Fasciitis',
      icd10: 'M72.2',
      description: 'Degenerative fasciopathy at calcaneal origin; most common cause of heel pain; most improve within 12 months without surgery',
      commonPresentations: ['first-step morning heel pain worst', 'medial calcaneal tuberosity tenderness', 'positive windlass test', 'tight gastrocnemius-soleus', 'BMI >30 risk factor'],
    },
    {
      name: 'Morton\'s Neuroma',
      icd10: 'G57.6',
      description: 'Perineural fibrosis of common plantar digital nerve; 3rd web space most common (75%), then 2nd; compression by tight shoes',
      commonPresentations: ['burning or electric shock pain 3rd/4th toes', 'positive Mulder\'s click', 'relieved by removing shoes', 'narrow toe-box shoes', 'female > male'],
    },
    {
      name: 'Hallux Valgus',
      icd10: 'M20.1',
      description: 'Lateral deviation of great toe with medial prominence of 1st MTP joint; multifactorial (genetic, footwear); aggravated by tight shoes',
      commonPresentations: ['bunion deformity', 'IMA >9° on X-ray', 'HVA >15°', 'metatarsalgia from transfer loading', 'corns over medial 1st MTP'],
    },
    {
      name: 'Hallux Rigidus (1st MTP Osteoarthritis)',
      icd10: 'M20.2',
      description: 'OA of the 1st MTP joint; most common arthritic condition of the foot; progressive loss of dorsiflexion; Grade I–IV (Regnauld/Coughlin classification)',
      commonPresentations: ['dorsal osteophyte at 1st MTP', '<65° extension (limitus) or <20° (rigidus)', 'pain with push-off gait', 'antalgic gait compensating with external rotation'],
    },
    {
      name: 'Tibialis Posterior Tendon Dysfunction',
      icd10: 'M76.82',
      description: 'Progressive degeneration of tibialis posterior tendon causing acquired adult flatfoot; Stage I–IV (Johnson & Strom); unilateral flatfoot in adult is red flag for TPTD',
      commonPresentations: ['medial ankle + arch pain', 'progressive flatfoot', 'too many toes sign', 'failed single-heel raise', 'pain along posterior tibia'],
    },
    {
      name: 'Metatarsalgia',
      icd10: 'M77.4',
      description: 'Forefoot pain under metatarsal heads; primary (structural: long 2nd MT, hallux valgus transfer) or secondary (Morton\'s, stress fracture, synovitis)',
      commonPresentations: ['plantar forefoot pain with weight bearing', 'tenderness under 2nd/3rd MT heads', 'callus formation', 'high-heeled shoe aggravation'],
    },
    {
      name: 'Tarsal Tunnel Syndrome',
      icd10: 'G57.5',
      description: 'Tibial nerve compression in tarsal tunnel posterior to medial malleolus; less common than carpal tunnel; may coexist with TPTD or flatfoot',
      commonPresentations: ['plantar foot burning/paraesthesia', 'positive Tinel\'s at tarsal tunnel', 'worse at end of day', 'associated flatfoot or space-occupying lesion'],
    },
    {
      name: 'Acquired Pes Planus (Flat Foot)',
      icd10: 'M21.40',
      description: 'Loss of medial longitudinal arch; rigid (structural) vs flexible (corrects with heel raise); secondary to TPTD, ligamentous laxity, or obesity',
      commonPresentations: ['absent medial arch in standing', 'hindfoot valgus', 'too many toes sign', 'corrects with toe raise in flexible type', 'overpronation gait pattern'],
    },
  ],

  redFlags: [
    {
      type: 'fracture',
      description: 'Ottawa Foot Rules — navicular and 5th metatarsal base fractures most commonly missed; Jones fracture (zone II base of 5th met) risks non-union',
      signsSymptoms: ['Ottawa Foot Rules positive (navicular or 5th met base tenderness + non-weight-bearing)', 'inversion injury with lateral foot pain', 'direct crush mechanism', 'stress fracture: gradual onset pain with activity increase'],
      immediateAction: 'URGENT: X-ray foot immediately; Jones fracture → orthopaedic review (non-union risk 25–50% without surgery); navicular stress fracture → non-weight-bearing + MRI',
    },
    {
      type: 'infection',
      description: 'Diabetic foot infection / osteomyelitis; Charcot neuroarthropathy must be excluded in any hot swollen diabetic foot',
      signsSymptoms: ['hot swollen foot in diabetic patient (may be painless)', 'skin breakdown or ulceration', 'fever', 'bone probe-positive test', 'acute Charcot: very hot foot + deformity with normal or elevated X-ray'],
      immediateAction: 'URGENT: immediate off-loading; vascular + orthopaedic + diabetologist referral; plain X-ray + MRI for osteomyelitis; Charcot: total contact cast same day',
    },
    {
      type: 'vascular_injury',
      description: 'Peripheral arterial disease presenting as foot ischaemia; critical limb ischaemia (CLI) = rest pain + tissue loss',
      signsSymptoms: ['absent foot pulses', 'pallor on elevation, dependent rubor', 'ABI <0.5', 'rest pain worse at night improved by hanging foot down', 'gangrenous toe', 'non-healing ulcer'],
      immediateAction: 'EMERGENCY: vascular surgery immediately; ABI measurement; do not elevate limb; surgical revascularisation or amputation decision',
    },
    {
      type: 'cancer',
      description: 'Malignant bone tumours of foot (rare but important): Ewing\'s sarcoma in calcaneus, chondrosarcoma; soft tissue sarcoma can mimic ganglion',
      signsSymptoms: ['painful rapidly growing foot mass', 'night pain', 'calcaneal mass in young patient', 'age-inconsistent presentation', 'warm non-transilluminating mass'],
      immediateAction: 'URGENT: plain X-ray + MRI; orthopaedic oncology referral; no biopsy without specialist guidance',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — intrinsic foot strengthening, short foot exercise, calf eccentric programme' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — gait retraining, footwear assessment, load management' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — 1st MTP mobilisation, subtalar/midfoot mobilisation, plantar fascia mobilisation' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — plantar fascia, Achilles insertion, Morton\'s neuroma' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for plantar fascia pain' },
    { code: '97010', description: 'Hot or cold pack', notes: 'Per day — ice after activity for plantar fasciitis / metatarsalgia' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — foot health group, orthotics education' },
  ],
};
