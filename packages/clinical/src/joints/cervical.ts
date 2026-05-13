import type { JointData } from '../types.js';

const MAITLAND_8TH  = 'Maitland GD. Vertebral Manipulation. 8th ed. Butterworth-Heinemann; 2013';
const NORKIN_2016   = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';

export const cervical: JointData = {
  joint: 'cervical',

  normalROM: {
    flexion:            { min: 0, max: 45, unit: 'degrees', citation: NORKIN_2016 },
    extension:          { min: 0, max: 45, unit: 'degrees', citation: NORKIN_2016 },
    leftLateralFlexion: { min: 0, max: 45, unit: 'degrees', citation: NORKIN_2016 },
    rightLateralFlexion:{ min: 0, max: 45, unit: 'degrees', citation: NORKIN_2016 },
    leftRotation:       { min: 0, max: 60, unit: 'degrees', citation: NORKIN_2016 },
    rightRotation:      { min: 0, max: 60, unit: 'degrees', citation: NORKIN_2016 },
  },

  specialTests: [
    {
      name: 'Spurling\'s Test (Cervical Radiculopathy)',
      procedure: 'Seated; ipsilateral lateral flexion + extension + axial compression; reproduction of ipsilateral arm radicular pain = positive for nerve root compression',
      sensitivity: 0.62,
      specificity: 0.95,
      citation: 'Rubinstein SM et al. Eur Spine J. 2007;16(3):307-319',
    },
    {
      name: 'Cervical Distraction Test',
      procedure: 'Supine; apply manual traction (15–20 lb); relief of neck or arm symptoms = positive; high specificity for radiculopathy',
      sensitivity: 0.44,
      specificity: 0.90,
      citation: 'Wainner RS et al. Spine. 2003;28(1):52-62',
    },
    {
      name: 'Upper Limb Tension Test A (ULTT-A — Median Nerve)',
      procedure: 'Supine; scapular depression, shoulder abduction 110°, elbow extension, forearm supination, wrist/finger extension, cervical lateral flexion away from test side; reproduction of arm symptoms + sensitised by cervical movement = positive',
      sensitivity: 0.97,
      specificity: 0.22,
      citation: 'Wainner RS et al. Spine. 2003;28(1):52-62',
    },
    {
      name: 'Shoulder Abduction Relief Sign',
      procedure: 'Patient places ipsilateral hand on top of head; relief of radicular arm symptoms = positive for cervical nerve root compression (root decompressed by reducing tension)',
      sensitivity: 0.43,
      specificity: 0.90,
      citation: 'Wainner RS et al. Spine. 2003;28(1):52-62',
    },
    {
      name: 'Sharp-Purser Test (Atlantoaxial Instability)',
      procedure: 'Seated, head slightly flexed; examiner places one hand on forehead, other on spinous process of C2; apply posterior force to head; clunk or relief of symptoms = positive for AAI',
      sensitivity: 0.69,
      specificity: 0.96,
      citation: 'Uitvlugt G, Indenbaum S. Spine. 1988;13(5):482-485',
      needsReview: true, // older study; use subjective screen first (rheumatoid arthritis, Down syndrome, trauma)
    },
    {
      name: 'VBI Screen (5Ds + 3Ns Pre-Manipulation)',
      procedure: 'Subjective: ask about Dizziness, Diplopia, Dysarthria, Dysphagia, Drop attacks, Nausea, Numbness (face/bilateral), Nystagmus; sustained rotation + extension position test; positive if any VBI symptom reproduced',
      sensitivity: 0.00,
      specificity: 1.00,
      citation: 'IFOMPT Standards Committee. International Framework for Examination of the Cervical Region. 2012',
      needsReview: true, // sensitivity near zero — used as precaution, not diagnosis
    },
  ],

  commonPathologies: [
    {
      name: 'Cervical Radiculopathy',
      icd10: 'M54.12',
      description: 'Nerve root compression at C5–C6 (most common) or C6–C7; dermatomal pain + neurological deficit in arm',
      commonPresentations: ['arm pain > neck pain', 'dermatomal distribution', 'positive Spurling\'s', 'reflex changes (biceps C5/6, triceps C7)', 'weakness in myotomal distribution'],
    },
    {
      name: 'Cervical Disc Herniation (C5–C6)',
      icd10: 'M50.12',
      description: 'Nucleus pulposus herniation at C5–C6 or C6–C7; most common disc levels; may be central (myelopathy risk) or lateral (radiculopathy)',
      commonPresentations: ['C5–C6: deltoid/biceps weakness, lateral arm pain, diminished biceps reflex', 'C6–C7: triceps weakness, posterior arm pain, diminished triceps reflex'],
    },
    {
      name: 'Cervical Spondylosis with Radiculopathy',
      icd10: 'M47.812',
      description: 'Osteophytic foraminal stenosis from degenerative disc disease; insidious onset; age >40',
      commonPresentations: ['episodic cervical + arm pain', 'multilevel stiffness', 'age >40', 'MRI/CT confirms foraminal stenosis'],
    },
    {
      name: 'Cervical Myelopathy',
      icd10: 'M47.12',
      description: 'Spinal cord compression causing upper motor neuron dysfunction; progressive unsteady gait and hand clumsiness; surgical emergency if progressive',
      commonPresentations: ['wide-based gait', 'hand clumsiness (difficulty with buttons)', 'hyperreflexia + Hoffmann\'s sign', 'positive Romberg', 'bladder urgency'],
    },
    {
      name: 'Whiplash-Associated Disorder (WAD)',
      icd10: 'S13.4',
      description: 'Acceleration-deceleration injury; WAD Grade I–IV (Quebec classification); most recover within 3 months',
      commonPresentations: ['neck pain post-MVA', 'headache', 'shoulder pain', 'sleep disturbance', 'psychological overlay in chronic WAD', 'normal imaging in Grades I–II'],
    },
    {
      name: 'Cervicogenic Headache',
      icd10: 'M54.81',
      description: 'Headache referred from upper cervical joints (C0–C3); unilateral, starts in neck, radiates to occiput/forehead; aggravated by neck movement',
      commonPresentations: ['unilateral head pain starting in neck', 'restricted upper cervical ROM', 'reproducible by neck palpation', 'positive flexion-rotation test (limited rotation C1–C2)'],
    },
    {
      name: 'Torticollis',
      icd10: 'M43.6',
      description: 'Acquired torticollis (muscular, atlantoaxial subluxation, discogenic, or spasmodic); neck deviated and rotated',
      commonPresentations: ['head held in lateral flexion + rotation', 'sternocleidomastoid spasm', 'in children: consider atlantoaxial rotatory fixation (Grisel syndrome)'],
    },
  ],

  redFlags: [
    {
      type: 'cord_compression',
      description: 'Cervical myelopathy from cord compression; progressive — urgent decompression surgery prevents permanent deficit',
      signsSymptoms: ['wide-based ataxic gait', 'bilateral hand numbness and clumsiness', 'positive Hoffmann\'s sign', 'hyperreflexia', 'bladder dysfunction', 'positive Lhermitte\'s sign'],
      immediateAction: 'URGENT: immediate MRI cervical spine; neurosurgical referral same day; no manipulation',
    },
    {
      type: 'atlantoaxial_instability',
      description: 'AAI in rheumatoid arthritis, Down syndrome, or trauma; C1–C2 subluxation risks cord compression with flexion',
      signsSymptoms: ['rheumatoid arthritis + neck pain', 'Down syndrome', 'occipital pain on flexion', 'positive Sharp-Purser', 'bilateral hand/leg weakness'],
      immediateAction: 'URGENT: MRI/CT cervical spine; NO neck manipulation; neurosurgical referral; hard collar',
    },
    {
      type: 'fracture',
      description: 'Cervical fracture after high-energy trauma; dens fracture (C2), Jefferson fracture (C1), or teardrop fracture',
      signsSymptoms: ['significant trauma (MVA, fall from height, diving injury)', 'midline cervical tenderness', 'neuro deficit', 'positive Canadian C-Spine Rule'],
      immediateAction: 'EMERGENCY: immobilise in collar; immediate CT cervical spine; trauma team; do NOT move without imaging',
    },
    {
      type: 'stroke',
      description: 'Vertebral artery dissection (VAD) presenting as neck pain + posterior fossa symptoms; can occur spontaneously or post-manipulation',
      signsSymptoms: ['sudden severe neck pain (thunderclap)', 'dizziness', 'diplopia', 'dysphagia', 'ipsilateral facial numbness', 'Wallenberg syndrome features'],
      immediateAction: 'EMERGENCY: 999 immediately; MRI/MRA brain and neck; thrombolysis decision; do NOT manipulate cervical spine',
    },
    {
      type: 'cancer',
      description: 'Cervical spinal metastases; thoracic spine mets most common but cervical can occur (breast, thyroid, lymphoma)',
      signsSymptoms: ['age >50', 'prior cancer history', 'constant non-mechanical pain', 'unexplained weight loss', 'night pain', 'progressive neurological deficit'],
      immediateAction: 'URGENT: same-day medical referral; MRI full spine; bloods (FBC, ESR, calcium)',
    },
  ],

  cptCodes: [
    { code: '97001', description: 'Physical therapy evaluation' },
    { code: '97110', description: 'Therapeutic exercises', notes: 'Per 15 min — deep neck flexor training (craniocervical flexion exercise), scapular stabilisation' },
    { code: '97530', description: 'Therapeutic activities', notes: 'Per 15 min — posture correction, ergonomics training' },
    { code: '97140', description: 'Manual therapy techniques', notes: 'Per 15 min — cervical mobilisation (Maitland), MWM, soft tissue to suboccipitals' },
    { code: '97012', description: 'Mechanical traction', notes: 'Per 15 min — cervical decompression for radiculopathy; contraindicated in myelopathy' },
    { code: '97035', description: 'Ultrasound', notes: 'Per 15 min — upper trapezius, levator scapulae' },
    { code: '97014', description: 'Electrical stimulation (unattended)', notes: 'Per day — TENS for cervicogenic headache, neck pain' },
    { code: '97150', description: 'Therapeutic procedure, group', notes: 'Per 15 min — neck school / pain education group' },
  ],
};
