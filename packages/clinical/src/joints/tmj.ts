import type { JointData } from '../types.js';

// ROM source: Okeson JP. Management of Temporomandibular Disorders and Occlusion. 8th ed. Elsevier; 2019.
// RDC/TMD criteria: Dworkin SF, LeResche L. J Craniomandib Disord. 1992;6(4):301-355.
const OKESON_8TH = 'Okeson JP. Management of Temporomandibular Disorders and Occlusion. 8th ed. Elsevier; 2019';
const RDC_TMD    = 'Dworkin SF, LeResche L. J Craniomandib Disord. 1992;6(4):301-355 (Research Diagnostic Criteria for TMD)';

export const tmj: JointData = {
  joint: 'tmj',

  normalROM: {
    // Inter-incisal opening (maximal unassisted): <35mm = restricted; normal >40mm
    mouthOpening:       { min: 35, max: 55, unit: 'mm', citation: OKESON_8TH },
    leftLateralDeviation:  { min: 8, max: 12, unit: 'mm', citation: OKESON_8TH },
    rightLateralDeviation: { min: 8, max: 12, unit: 'mm', citation: OKESON_8TH },
    protrusion:         { min: 6, max: 9,  unit: 'mm', citation: OKESON_8TH },
    // Deflection (opens to one side) vs deviation (S-curve correcting midline): clinical distinction
  },

  specialTests: [
    {
      name: 'Maximal Assisted Mouth Opening',
      procedure: 'Measure unassisted opening; then apply gentle overpressure; difference >5mm suggests disc displacement with reduction (springy end feel) vs capsular restriction (hard end feel)',
      sensitivity: 0.79,
      specificity: 0.72,
      citation: `NEEDS_CLINICAL_REVIEW — values estimated from RDC/TMD validity studies; procedure from ${RDC_TMD}`,
      needsReview: true,
    },
    {
      name: 'Auscultation / Palpation for Click or Crepitus',
      procedure: 'Palpate lateral pole of condyle bilaterally during opening/closing; early click (disc displacement with reduction) vs crepitus (OA) vs no noise (normal or locked disc)',
      sensitivity: 0.64,
      specificity: 0.66,
      citation: 'Naeije M et al. J Oral Rehabil. 2000;27(9):748-752',
      needsReview: true,
    },
    {
      name: 'Resisted Jaw Opening and Lateral Deviation',
      procedure: 'Resist jaw opening (tests suprahyoid, digastric, lateral pterygoid); resist lateral deviation bilaterally; pain = masticatory muscle dysfunction vs pain = intra-articular TMJ',
      sensitivity: 0.60,
      specificity: 0.65,
      citation: `NEEDS_CLINICAL_REVIEW — limited diagnostic accuracy data; from ${OKESON_8TH}`,
      needsReview: true,
    },
    {
      name: 'Palpation of Masticatory Muscles',
      procedure: 'Palpate masseter (superficial + deep), temporalis (anterior, middle, posterior), medial + lateral pterygoid, SCM, posterior cervicals; pain = masticatory myalgia',
      sensitivity: 0.76,
      specificity: 0.70,
      citation: `Schiffman E et al. J Oral Facial Pain Headache. 2014;28(1):6-27 (DC/TMD criteria)`,
    },
    {
      name: 'Jaw Deviation Pattern Analysis',
      procedure: 'Observe opening path; deviation (S-curve correcting to midline) = disc displacement with reduction; deflection (uncorrected deviation to one side) = anterior disc displacement without reduction or capsular restriction',
      sensitivity: 0.65,
      specificity: 0.68,
      citation: `NEEDS_CLINICAL_REVIEW — diagnostic accuracy varies; classification from ${OKESON_8TH}`,
      needsReview: true,
    },
  ],

  commonPathologies: [
    {
      name: 'TMJ Disc Displacement with Reduction',
      icd10: 'M26.63',
      description: 'Anterior disc displacement that reduces on opening (click); most common TMJ disorder; may progress to displacement without reduction',
      commonPresentations: ['click on opening and closing', 'occasional jaw lock', 'mild TMJ pain', 'normal mouth opening or slightly reduced', 'early click vs late click differentiation'],
    },
    {
      name: 'TMJ Disc Displacement without Reduction (Locked Disc)',
      icd10: 'M26.63',
      description: 'Anteriorly displaced disc that does not reduce; causes limited mouth opening (<35mm unassisted); deflects toward affected side',
      commonPresentations: ['sudden inability to fully open mouth', 'deflection on opening', 'no click', 'mouth opening <35mm', 'history of prior clicking that stopped'],
    },
    {
      name: 'TMJ Arthralgia',
      icd10: 'M26.62',
      description: 'Pain arising from the TMJ itself (intra-articular); tender on palpation of lateral pole; pain with jaw function',
      commonPresentations: ['TMJ tenderness on lateral pole palpation', 'pain with jaw movements', 'morning stiffness', 'bruxism history'],
    },
    {
      name: 'Masticatory Myalgia (Myofascial Pain)',
      icd10: 'M79.18',
      description: 'Pain from masticatory muscles (masseter, temporalis, pterygoids); most common TMD subtype; often associated with bruxism and psychological stress',
      commonPresentations: ['diffuse jaw + temple pain', 'morning pain (nocturnal bruxism)', 'headache', 'tender masseter on palpation', 'normal mouth opening but pain'],
    },
    {
      name: 'Bruxism',
      icd10: 'G47.63',
      description: 'Involuntary teeth grinding/clenching; sleep bruxism (rhythmic masticatory muscle activity) or awake bruxism; causes tooth wear, myalgia, and TMJ loading',
      commonPresentations: ['tooth wear', 'morning jaw pain and headache', 'masseter hypertrophy', 'partner reports grinding noise at night'],
    },
    {
      name: 'TMJ Osteoarthritis',
      icd10: 'M26.64',
      description: 'Degenerative joint disease of the TMJ; crepitus (grating sound) vs click; condylar erosion on imaging',
      commonPresentations: ['crepitus (not click)', 'age >40', 'condylar flattening on panoramic X-ray', 'may be asymptomatic initially'],
    },
  ],

  redFlags: [
    {
      type: 'cancer',
      description: 'Jaw claudication in giant cell arteritis (temporal arteritis) mimics TMJ disorder; delay in diagnosis risks blindness',
      signsSymptoms: ['jaw pain that worsens with chewing and resolves with rest (claudication pattern)', 'age >50', 'scalp tenderness', 'headache', 'visual changes', 'elevated ESR >50'],
      immediateAction: 'EMERGENCY: same-day ESR/CRP blood test + rheumatology referral; high-dose prednisolone to prevent blindness; temporal artery biopsy',
    },
    {
      type: 'infection',
      description: 'Dental abscess/deep space neck infection causing trismus; Ludwig\'s angina (submandibular space) is life-threatening airway emergency',
      signsSymptoms: ['rapidly progressive trismus', 'floor of mouth swelling', 'fever', 'difficulty swallowing', 'unable to extend neck', 'stridor'],
      immediateAction: 'EMERGENCY: immediate hospital; airway management; IV antibiotics; surgical drainage; ICU if Ludwig\'s angina',
    },
    {
      type: 'fracture',
      description: 'Condylar fracture after trauma; may present as malocclusion and limited opening',
      signsSymptoms: ['trauma to jaw or chin', 'acute malocclusion', 'bleeding from ear canal', 'trismus', 'deviation to fractured side on opening'],
      immediateAction: 'URGENT: OPG + CT face; oral and maxillofacial surgery referral; immobilisation',
    },
    {
      type: 'stroke',
      description: 'Trigeminal neuralgia (TN) must be distinguished from TMD; TN: electric shock pain, seconds duration, trigger zones — not TMD',
      signsSymptoms: ['electric shock or lancinating pain in jaw/face', 'triggered by light touch (eating, talking, wind)', 'seconds duration', 'V2/V3 distribution', 'no TMJ tenderness'],
      immediateAction: 'URGENT: neurology referral; MRI brain (exclude vascular loop compression, MS plaque); carbamazepine trial',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — jaw opening exercises, lateral pterygoid stretching, postural exercises' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — jaw function retraining, controlled chewing' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — TMJ mobilisation (distraction, translation), intraoral pterygoid release, cervical manual therapy for cervicogenic component' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — masseter, temporalis (low level for myalgia)' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for masticatory myalgia' },
    { code: '97026', description: 'Infrared', notes: 'Per day — heat to masseter/temporalis pre-treatment' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — TMD / pain education group' },
  ],
};
