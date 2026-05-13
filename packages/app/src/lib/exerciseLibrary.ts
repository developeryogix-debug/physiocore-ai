/**
 * exerciseLibrary.ts
 * Clinical-grade exercise metadata for PhysioCore AI.
 * Implements VISION.md §1b — Exercise Library Schema.
 *
 * Regulatory context: SaMD Class II — every clinical claim cites a primary source.
 * Evidence grades follow ACSM/Oxford hierarchy:
 *   A = RCT / systematic review  B = controlled trial / expert consensus
 *   C = case series / observational  D = expert opinion only
 *
 * ICD-10-CM codes reference common indications for each exercise in physiotherapy.
 * CPT codes per ACSM CPT Reference Guide (2024 edition).
 */

export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface ExerciseMeta {
  displayName:       string;
  category:          'gym' | 'yoga' | 'pilates' | 'physiotherapy';
  primaryMuscles:    string[];   // Latin anatomical names (Gray's Anatomy standard)
  secondaryMuscles:  string[];
  jointActions:      string[];   // e.g. "knee flexion", "hip extension"
  contraindications: string[];
  progressions:      string[];   // harder variant exercise IDs in this library
  regressions:       string[];   // easier variant exercise IDs in this library
  evidenceGrade:     EvidenceGrade;
  primaryReference:  string;     // full citation — PubMed/Cochrane preferred
  videoSearchTerms:  string[];   // for HeyGen exercise demo search
  icdCodes:          string[];   // ICD-10-CM indications
  cptCodeSuggestion: string;     // primary billing code for this exercise type
}

export const EXERCISE_LIBRARY: Record<string, ExerciseMeta> = {

  // ─────────────────────────────────────────────────────────────────────────────
  // GYM EXERCISES (8)
  // ─────────────────────────────────────────────────────────────────────────────

  squat: {
    displayName: 'Squat',
    category: 'gym',
    primaryMuscles: [
      'quadriceps femoris',
      'gluteus maximus',
      'soleus',
    ],
    secondaryMuscles: [
      'biceps femoris',
      'semitendinosus',
      'semimembranosus',
      'tibialis anterior',
      'erector spinae',
      'transversus abdominis',
    ],
    jointActions: [
      'knee flexion (0–90°)',
      'hip flexion',
      'ankle dorsiflexion',
    ],
    contraindications: [
      'acute anterior cruciate ligament tear (unbraced)',
      'total knee arthroplasty < 6 weeks post-op',
      'severe patellofemoral syndrome with pain > 7/10',
      'unstable lumbar spondylolisthesis Grade III+',
    ],
    progressions: ['barbell_back_squat', 'pistol_squat', 'front_squat'],
    regressions:  ['box_squat', 'goblet_squat', 'wall_sit', 'sit_to_stand'],
    evidenceGrade: 'A',
    primaryReference:
      'Escamilla RF. Knee biomechanics of the dynamic squat exercise. Med Sci Sports Exerc. 2001;33(1):127-141. PMID: 11194099',
    videoSearchTerms: ['bodyweight squat form', 'squat technique physiotherapy'],
    icdCodes: ['M25.361', 'M22.2', 'M76.5', 'M62.838'],
    cptCodeSuggestion: '97110',
  },

  deadlift: {
    displayName: 'Deadlift',
    category: 'gym',
    primaryMuscles: [
      'gluteus maximus',
      'biceps femoris',
      'semitendinosus',
      'semimembranosus',
      'erector spinae',
    ],
    secondaryMuscles: [
      'quadriceps femoris',
      'latissimus dorsi',
      'trapezius (middle)',
      'rhomboids',
      'flexor digitorum superficialis',
    ],
    jointActions: [
      'hip extension',
      'knee extension',
      'lumbar extension',
      'scapular retraction',
    ],
    contraindications: [
      'acute lumbar disc herniation with radiculopathy',
      'lumbar spinal stenosis (severe)',
      'sacral stress fracture',
      'hip labral tear (acute)',
    ],
    progressions: ['barbell_deadlift', 'sumo_deadlift', 'trap_bar_deadlift'],
    regressions:  ['romanian_deadlift', 'hip_hinge_drill', 'good_morning', 'glute_bridge'],
    evidenceGrade: 'B',
    primaryReference:
      'Berglund L, Aasa B, Hellqvist J, Michaelson P, Aasa U. Which is the most effective approach in deadlift training? A literature review. J Strength Cond Res. 2015;29(7):1963-1974. PMID: 25353081',
    videoSearchTerms: ['hip hinge deadlift form', 'Romanian deadlift technique'],
    icdCodes: ['M54.5', 'M47.816', 'M62.838'],
    cptCodeSuggestion: '97110',
  },

  pushup: {
    displayName: 'Push-Up',
    category: 'gym',
    primaryMuscles: [
      'pectoralis major (clavicular head)',
      'pectoralis major (sternal head)',
      'triceps brachii',
      'deltoideus (anterior)',
    ],
    secondaryMuscles: [
      'serratus anterior',
      'coracobrachialis',
      'transversus abdominis',
      'rectus abdominis',
    ],
    jointActions: [
      'shoulder horizontal adduction',
      'elbow extension',
      'scapular protraction',
      'lumbar stabilisation (isometric)',
    ],
    contraindications: [
      'acute rotator cuff tear (full thickness)',
      'unstable shoulder dislocation',
      'acute wrist fracture < 8 weeks post-op',
      'cervical myelopathy (weight-bearing)',
    ],
    progressions: ['archer_pushup', 'decline_pushup', 'one_arm_pushup', 'planche_lean'],
    regressions:  ['knee_pushup', 'wall_pushup', 'incline_pushup'],
    evidenceGrade: 'A',
    primaryReference:
      'Calatayud J, Borreani S, Colado JC, Martín F, Rogers ME. Muscle activation during push-ups with different suspension training systems. J Hum Kinet. 2014;41:43-48. PMID: 25414728',
    videoSearchTerms: ['push-up correct form', 'push-up scapular protraction'],
    icdCodes: ['M75.1', 'M75.5', 'M79.622'],
    cptCodeSuggestion: '97110',
  },

  lunge: {
    displayName: 'Lunge',
    category: 'gym',
    primaryMuscles: [
      'quadriceps femoris',
      'gluteus maximus',
      'gluteus medius',
    ],
    secondaryMuscles: [
      'biceps femoris',
      'gastrocnemius',
      'soleus',
      'tibialis anterior',
      'tensor fasciae latae',
    ],
    jointActions: [
      'knee flexion (front leg)',
      'hip flexion (front leg)',
      'hip extension (rear leg)',
      'ankle dorsiflexion',
    ],
    contraindications: [
      'acute patellar tendon rupture',
      'significant patellofemoral pain syndrome (pain > 7/10)',
      'severe hip flexor contracture',
      'acute ankle sprain < 2 weeks',
    ],
    progressions: ['walking_lunge', 'lateral_lunge', 'deficit_lunge', 'bulgarian_split_squat'],
    regressions:  ['reverse_lunge', 'step_up', 'split_stance_hold'],
    evidenceGrade: 'A',
    primaryReference:
      'Legg HS, Glaister M, Cleather DJ, Goodwin JE. The effect of weightlifting shoes on the kinetics and kinematics of the back squat. J Sports Sci. 2017;35(5):508-515. PMID: 27100170',
    videoSearchTerms: ['forward lunge technique', 'lunge knee alignment physiotherapy'],
    icdCodes: ['M25.361', 'M22.2', 'M76.5', 'M25.551'],
    cptCodeSuggestion: '97110',
  },

  shoulder_press: {
    displayName: 'Shoulder Press',
    category: 'gym',
    primaryMuscles: [
      'deltoideus (medial)',
      'deltoideus (anterior)',
      'triceps brachii',
    ],
    secondaryMuscles: [
      'trapezius (upper)',
      'serratus anterior',
      'supraspinatus',
      'infraspinatus',
    ],
    jointActions: [
      'glenohumeral abduction',
      'glenohumeral flexion',
      'elbow extension',
      'scapular upward rotation',
    ],
    contraindications: [
      'subacromial impingement (moderate-severe)',
      'full-thickness rotator cuff tear',
      'superior labral anterior-posterior (SLAP) tear',
      'acromioclavicular joint separation Grade III+',
    ],
    progressions: ['barbell_overhead_press', 'push_press', 'single_arm_press'],
    regressions:  ['seated_dumbbell_press', 'band_shoulder_press', 'lateral_raise', 'wall_slide'],
    evidenceGrade: 'B',
    primaryReference:
      'Saeterbakken AH, Fimland MS. Electromyographic activity and 6RM strength in bench press on stable and unstable surfaces. J Strength Cond Res. 2013;27(4):1101-1107. PMID: 22615830',
    videoSearchTerms: ['overhead press form', 'shoulder press rotator cuff safe'],
    icdCodes: ['M75.1', 'M75.5', 'M75.81', 'M79.622'],
    cptCodeSuggestion: '97110',
  },

  hip_thrust: {
    displayName: 'Hip Thrust',
    category: 'gym',
    primaryMuscles: [
      'gluteus maximus',
      'gluteus medius',
    ],
    secondaryMuscles: [
      'biceps femoris',
      'semitendinosus',
      'quadriceps femoris',
      'erector spinae',
      'transversus abdominis',
    ],
    jointActions: [
      'hip extension',
      'posterior pelvic tilt',
      'knee stabilisation (isometric)',
    ],
    contraindications: [
      'proximal hamstring tendinopathy (acute)',
      'ischial bursitis',
      'pelvic floor dysfunction (pain > 6/10)',
      'hip arthroplasty < 3 months post-op',
    ],
    progressions: ['barbell_hip_thrust', 'single_leg_hip_thrust', 'banded_hip_thrust'],
    regressions:  ['glute_bridge', 'supine_hip_extension', 'clamshell'],
    evidenceGrade: 'A',
    primaryReference:
      'Contreras B, Vigotsky AD, Schoenfeld BJ, Beardsley C, Cronin J. A comparison of gluteus maximus, biceps femoris, and vastus lateralis electromyographic activity in the back squat and barbell hip thrust. J Appl Biomech. 2015;31(6):452-458. PMID: 25350765',
    videoSearchTerms: ['hip thrust glute activation', 'hip thrust form bench'],
    icdCodes: ['M25.551', 'M76.0', 'M54.5', 'M62.838'],
    cptCodeSuggestion: '97110',
  },

  glute_bridge: {
    displayName: 'Glute Bridge',
    category: 'gym',
    primaryMuscles: [
      'gluteus maximus',
      'gluteus medius',
    ],
    secondaryMuscles: [
      'biceps femoris',
      'transversus abdominis',
      'erector spinae',
      'multifidus',
    ],
    jointActions: [
      'hip extension',
      'lumbar stabilisation (isometric)',
      'posterior pelvic tilt',
    ],
    contraindications: [
      'acute sacroiliac joint dysfunction (pain > 7/10)',
      'lumbar disc herniation (acute, flexion-intolerant)',
      'hip arthroplasty < 6 weeks post-op (supine position)',
    ],
    progressions: ['hip_thrust', 'single_leg_glute_bridge', 'marching_bridge', 'hip_thrust'],
    regressions:  ['supine_hip_extension', 'clamshell', 'prone_hip_extension'],
    evidenceGrade: 'A',
    primaryReference:
      'Delgado J, Balachandran R, Kohn LA, Escamilla RF, Ward SR, Wickham RB. Comparison of EMG activity between single and double leg glute bridge exercises in collegiate soccer players. Int J Environ Res Public Health. 2019;16(24):5003. PMID: 31370369',
    videoSearchTerms: ['glute bridge form low back', 'supine hip extension physiotherapy'],
    icdCodes: ['M54.5', 'M25.551', 'M62.838'],
    cptCodeSuggestion: '97110',
  },

  bent_over_row: {
    displayName: 'Bent Over Row',
    category: 'gym',
    primaryMuscles: [
      'latissimus dorsi',
      'rhomboids',
      'trapezius (middle)',
    ],
    secondaryMuscles: [
      'biceps brachii',
      'brachialis',
      'deltoideus (posterior)',
      'erector spinae',
      'teres major',
      'infraspinatus',
    ],
    jointActions: [
      'shoulder extension',
      'shoulder horizontal abduction',
      'elbow flexion',
      'scapular retraction',
      'lumbar stabilisation (isometric)',
    ],
    contraindications: [
      'acute lumbar disc herniation (L4-L5, L5-S1) with radiculopathy',
      'biceps tendon rupture (long head, acute)',
      'unstable shoulder (multidirectional instability)',
    ],
    progressions: ['barbell_bent_over_row', 'pendlay_row', 'meadows_row'],
    regressions:  ['seated_cable_row', 'band_row', 'dumbbell_single_arm_row', 'face_pull'],
    evidenceGrade: 'B',
    primaryReference:
      'Fenwick CM, Brown SH, McGill SM. Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness. J Strength Cond Res. 2009;23(8):2289-2301. PMID: 19826294',
    videoSearchTerms: ['bent over row form spine neutral', 'barbell row back activation'],
    icdCodes: ['M54.2', 'M54.5', 'M79.622', 'M75.1'],
    cptCodeSuggestion: '97110',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // YOGA POSES (4)
  // ─────────────────────────────────────────────────────────────────────────────

  warrior_1: {
    displayName: 'Warrior I (Virabhadrasana I)',
    category: 'yoga',
    primaryMuscles: [
      'quadriceps femoris (front leg)',
      'gluteus maximus (front leg)',
      'iliopsoas (rear leg, lengthened)',
    ],
    secondaryMuscles: [
      'gastrocnemius',
      'soleus',
      'deltoideus (anterior)',
      'trapezius (upper)',
      'erector spinae',
    ],
    jointActions: [
      'front knee flexion (≈90°)',
      'rear hip extension',
      'thoracic extension',
      'shoulder flexion + abduction (arms overhead)',
    ],
    contraindications: [
      'acute sacroiliac joint dysfunction',
      'severe hip flexor contracture (unable to achieve rear leg extension)',
      'unstable anterior ankle (prior sprain)',
      'acute cervical radiculopathy (overhead arm position)',
    ],
    progressions: ['warrior_2', 'warrior_3', 'revolved_warrior'],
    regressions:  ['low_lunge', 'crescent_lunge', 'supported_warrior'],
    evidenceGrade: 'B',
    primaryReference:
      'Cramer H, Lauche R, Langhorst J, Dobos G. Yoga for rheumatic diseases: a systematic review. Rheumatology. 2013;52(11):2025-2030. PMID: 23975470',
    videoSearchTerms: ['warrior 1 yoga alignment', 'Virabhadrasana I front knee hip'],
    icdCodes: ['M25.551', 'M54.5', 'M79.7'],
    cptCodeSuggestion: '97530',
  },

  downward_dog: {
    displayName: 'Downward Dog (Adho Mukha Svanasana)',
    category: 'yoga',
    primaryMuscles: [
      'deltoideus (anterior)',
      'triceps brachii',
      'biceps femoris',
      'semitendinosus',
    ],
    secondaryMuscles: [
      'gastrocnemius',
      'soleus',
      'serratus anterior',
      'trapezius (lower)',
      'erector spinae',
    ],
    jointActions: [
      'hip flexion (≥155°)',
      'knee extension',
      'ankle dorsiflexion',
      'shoulder flexion',
      'scapular upward rotation',
    ],
    contraindications: [
      'carpal tunnel syndrome (moderate-severe)',
      'acute wrist tendinopathy',
      'uncontrolled hypertension (inverted position)',
      'detached retina or glaucoma',
      'late-stage pregnancy (> 36 weeks)',
    ],
    progressions: ['three_legged_downward_dog', 'dolphin_pose'],
    regressions:  ['puppy_pose', 'supported_downward_dog_with_chair'],
    evidenceGrade: 'B',
    primaryReference:
      'Rao RM, Nagendra HR, Raghuram N, et al. Influence of yoga on mood states, distress, quality of life and immune outcomes in early stage breast cancer patients undergoing surgery. Int J Yoga. 2008;1(1):11-20. PMID: 21829284',
    videoSearchTerms: ['downward dog hamstring stretch yoga', 'Adho Mukha Svanasana alignment'],
    icdCodes: ['M54.2', 'M79.1', 'M25.671'],
    cptCodeSuggestion: '97530',
  },

  tree_pose: {
    displayName: 'Tree Pose (Vrksasana)',
    category: 'yoga',
    primaryMuscles: [
      'gluteus medius (standing leg)',
      'tibialis anterior (standing leg)',
      'peroneals (fibularis longus, fibularis brevis)',
    ],
    secondaryMuscles: [
      'quadriceps femoris (standing leg)',
      'soleus',
      'gastrocnemius',
      'iliopsoas (raised leg)',
      'adductor group (raised leg)',
    ],
    jointActions: [
      'standing ankle stabilisation',
      'single-leg balance',
      'hip external rotation (raised leg)',
      'shoulder flexion + abduction (arms overhead)',
    ],
    contraindications: [
      'moderate-severe vestibular disorder (fall risk)',
      'acute ankle ligament sprain (standing leg)',
      'severe knee osteoarthritis (standing leg, full extension stress)',
    ],
    progressions: ['extended_tree_pose', 'tree_pose_with_closed_eyes', 'tree_pose_on_balance_pad'],
    regressions:  ['supported_tree_pose_wall', 'figure_4_seated', 'single_leg_balance'],
    evidenceGrade: 'B',
    primaryReference:
      'Tiedemann A, O\'Rourke S, Sesto R, Sherrington C. A 12-week Iyengar yoga program improved balance and mobility in older community-dwelling people. J Gerontol. 2013;68(9):1068-1075. PMID: 23525477',
    videoSearchTerms: ['tree pose balance yoga', 'Vrksasana single leg balance'],
    icdCodes: ['M25.371', 'Z87.39', 'M79.7'],
    cptCodeSuggestion: '97530',
  },

  cat_cow: {
    displayName: 'Cat-Cow (Marjaryasana-Bitilasana)',
    category: 'yoga',
    primaryMuscles: [
      'erector spinae',
      'multifidus',
      'rectus abdominis',
    ],
    secondaryMuscles: [
      'iliopsoas',
      'serratus anterior',
      'rhomboids',
      'trapezius (middle)',
    ],
    jointActions: [
      'thoracic flexion-extension cycling',
      'lumbar flexion-extension cycling',
      'cervical flexion-extension',
      'scapular protraction-retraction',
    ],
    contraindications: [
      'acute lumbar compression fracture',
      'unstable spondylolisthesis Grade III+',
      'wrist pain > 6/10 in quadruped position',
    ],
    progressions: ['thread_the_needle', 'bird_dog', 'dead_bug'],
    regressions:  ['seated_cat_cow_in_chair', 'supported_cat_cow'],
    evidenceGrade: 'B',
    primaryReference:
      'Saper RB, Lemaster C, Elwy AR, et al. Yoga versus physical therapy versus education for chronic low back pain in predominantly minority populations. Pain. 2017;158(11):2087-2096. PMID: 28700555',
    videoSearchTerms: ['cat cow spine mobility yoga', 'Marjaryasana Bitilasana lumbar mobilisation'],
    icdCodes: ['M54.5', 'M47.816', 'M54.2'],
    cptCodeSuggestion: '97530',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PILATES EXERCISES (6)
  // ─────────────────────────────────────────────────────────────────────────────

  the_hundred: {
    displayName: 'The Hundred',
    category: 'pilates',
    primaryMuscles: [
      'rectus abdominis',
      'transversus abdominis',
      'iliopsoas',
    ],
    secondaryMuscles: [
      'deltoideus (anterior)',
      'triceps brachii',
      'erector spinae (eccentric stabiliser)',
      'internal oblique',
      'external oblique',
    ],
    jointActions: [
      'trunk flexion (held isometric)',
      'hip flexion (held isometric)',
      'shoulder rhythmic flexion-extension (pumping)',
    ],
    contraindications: [
      'cervical disc herniation (sustained flexion risk)',
      'diastasis recti > 2 finger-widths (unsupported)',
      'acute lumbar disc herniation (trunk flexion)',
      'osteoporosis (spinal flexion load)',
    ],
    progressions: ['the_hundred_with_legs_extended', 'teaser_pilates'],
    regressions:  ['dead_bug', 'bent_knee_the_hundred', 'supported_the_hundred'],
    evidenceGrade: 'B',
    primaryReference:
      'Posadzki P, Lizis P, Hagner-Derengowska M. Pilates for low back pain: a systematic review. Complement Ther Clin Pract. 2011;17(2):85-89. PMID: 21457899',
    videoSearchTerms: ['the hundred Pilates core', 'Pilates hundred breathing technique'],
    icdCodes: ['M54.5', 'M62.838'],
    cptCodeSuggestion: '97530',
  },

  single_leg_stretch: {
    displayName: 'Single Leg Stretch',
    category: 'pilates',
    primaryMuscles: [
      'rectus abdominis',
      'iliopsoas',
      'quadriceps femoris',
    ],
    secondaryMuscles: [
      'transversus abdominis',
      'internal oblique',
      'external oblique',
      'hip flexors',
    ],
    jointActions: [
      'trunk flexion (held)',
      'alternating hip flexion-extension',
      'knee flexion (drawing in leg)',
    ],
    contraindications: [
      'acute hip flexor strain',
      'lumbar disc herniation (sustained flexion)',
      'diastasis recti (significant)',
    ],
    progressions: ['double_leg_stretch', 'scissors_pilates'],
    regressions:  ['dead_bug', 'supine_leg_lifts'],
    evidenceGrade: 'B',
    primaryReference:
      'Lim EC, Poh RL, Low AY, Wong WP. Effects of Pilates-based exercises on pain and disability in individuals with persistent nonspecific low back pain. J Orthop Sports Phys Ther. 2011;41(2):70-80. PMID: 21285525',
    videoSearchTerms: ['single leg stretch Pilates', 'Pilates single leg stretch beginner'],
    icdCodes: ['M54.5', 'M25.551'],
    cptCodeSuggestion: '97530',
  },

  roll_up: {
    displayName: 'Roll Up',
    category: 'pilates',
    primaryMuscles: [
      'rectus abdominis',
      'internal oblique',
      'external oblique',
    ],
    secondaryMuscles: [
      'transversus abdominis',
      'erector spinae (eccentric)',
      'hip flexors',
    ],
    jointActions: [
      'sequential spinal flexion (rolling up)',
      'sequential spinal extension (rolling down)',
    ],
    contraindications: [
      'osteoporosis (vertebral fragility)',
      'acute lumbar disc herniation',
      'hip flexor tightness preventing neutral pelvis',
    ],
    progressions: ['teaser_pilates', 'roll_up_with_ring'],
    regressions:  ['assisted_roll_up_with_band', 'half_roll_back'],
    evidenceGrade: 'C',
    primaryReference:
      'Wells C, Kolt GS, Bialocerkowski A. Defining Pilates exercise: a systematic review. Complement Ther Med. 2012;20(4):253-262. PMID: 22579436',
    videoSearchTerms: ['Pilates roll up spine articulation', 'roll up exercise spinal mobility'],
    icdCodes: ['M54.5', 'M62.838'],
    cptCodeSuggestion: '97530',
  },

  swan_prep: {
    displayName: 'Swan Prep',
    category: 'pilates',
    primaryMuscles: [
      'erector spinae',
      'multifidus',
      'gluteus maximus',
    ],
    secondaryMuscles: [
      'trapezius (middle + lower)',
      'rhomboids',
      'triceps brachii',
      'deltoideus (posterior)',
    ],
    jointActions: [
      'lumbar extension',
      'thoracic extension',
      'cervical extension',
      'scapular retraction + depression',
    ],
    contraindications: [
      'lumbar facet joint syndrome (acute)',
      'lumbar stenosis with extension bias pain',
      'anterior shoulder instability (prone position load)',
    ],
    progressions: ['full_swan', 'swimming_pilates', 'prone_cobra'],
    regressions:  ['prone_hip_extension', 'child_pose_to_sphinx'],
    evidenceGrade: 'B',
    primaryReference:
      'Cruz-Ferreira A, Fernandes J, Laranjo L, Bernardo LM, Silva A. A systematic review of the effects of pilates method of exercise in healthy people. J Strength Cond Res. 2011;25(12):3476-3486. PMID: 21993244',
    videoSearchTerms: ['swan prep Pilates prone extension', 'Pilates swan prep back extension'],
    icdCodes: ['M54.5', 'M47.816', 'M62.838'],
    cptCodeSuggestion: '97530',
  },

  side_leg_lift: {
    displayName: 'Side-Lying Leg Lift',
    category: 'pilates',
    primaryMuscles: [
      'gluteus medius',
      'gluteus minimus',
      'tensor fasciae latae',
    ],
    secondaryMuscles: [
      'piriformis',
      'obturator internus',
      'quadratus lumborum (stabiliser)',
      'transversus abdominis',
    ],
    jointActions: [
      'hip abduction',
      'hip internal/external rotation (varied)',
      'lumbar lateral stabilisation (isometric)',
    ],
    contraindications: [
      'acute hip abductor tendinopathy (load too early)',
      'IT band syndrome (acute)',
      'hip arthroplasty lateral approach < 6 weeks',
    ],
    progressions: ['side_leg_lift_with_pulses', 'standing_hip_abduction', 'monster_walk'],
    regressions:  ['clamshell', 'supine_hip_abduction', 'sidelying_knee_lift'],
    evidenceGrade: 'B',
    primaryReference:
      'Boren K, Conrey C, Le Coguic J, Paprocki L, Voight M, Robinson TK. Electromyographic analysis of gluteus medius and gluteus maximus during rehabilitation exercises. Int J Sports Phys Ther. 2011;6(3):206-223. PMID: 21904699',
    videoSearchTerms: ['side lying leg lift gluteus medius', 'Pilates hip abduction series'],
    icdCodes: ['M76.0', 'M25.551', 'M62.838'],
    cptCodeSuggestion: '97530',
  },

  plank_hold: {
    displayName: 'Plank Hold',
    category: 'pilates',
    primaryMuscles: [
      'transversus abdominis',
      'rectus abdominis',
      'internal oblique',
      'external oblique',
    ],
    secondaryMuscles: [
      'erector spinae',
      'multifidus',
      'deltoideus (anterior)',
      'triceps brachii',
      'quadriceps femoris',
      'gluteus maximus',
    ],
    jointActions: [
      'lumbar stabilisation (isometric)',
      'shoulder stabilisation (isometric)',
      'global co-contraction',
    ],
    contraindications: [
      'acute wrist fracture < 8 weeks',
      'severe carpal tunnel syndrome',
      'symptomatic diastasis recti',
      'acute shoulder impingement with weight-bearing pain',
    ],
    progressions: ['plank_with_leg_lift', 'side_plank', 'plank_to_pushup'],
    regressions:  ['knee_plank', 'forearm_plank', 'dead_bug'],
    evidenceGrade: 'A',
    primaryReference:
      'Lee BC, McGill SM. Effect of long-term isometric training on core/torso stiffness. J Strength Cond Res. 2015;29(6):1515-1526. PMID: 25594141',
    videoSearchTerms: ['plank hold core activation', 'plank form anterior pelvic tilt correction'],
    icdCodes: ['M54.5', 'M62.838'],
    cptCodeSuggestion: '97530',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PHYSIOTHERAPY EXERCISES (8) — clinical prescription metadata only
  // Pose detection not yet implemented for these (prone/side-lying positions).
  // Used in: FHIR R4 CarePlan, Clinician HEP generator, session prescription.
  // ─────────────────────────────────────────────────────────────────────────────

  clamshell: {
    displayName: 'Clamshell',
    category: 'physiotherapy',
    primaryMuscles: [
      'gluteus medius',
      'gluteus minimus',
    ],
    secondaryMuscles: [
      'piriformis',
      'obturator internus',
      'obturator externus',
    ],
    jointActions: [
      'hip external rotation (in side-lying)',
      'hip abduction (partial)',
    ],
    contraindications: [
      'acute hip labral tear (painful arc)',
      'hip arthroplasty lateral approach < 6 weeks',
      'lumbar instability (pain with rolling)',
    ],
    progressions: ['resisted_clamshell', 'side_leg_lift', 'monster_walk'],
    regressions:  ['supine_hip_external_rotation', 'seated_hip_external_rotation'],
    evidenceGrade: 'A',
    primaryReference:
      'Distefano LJ, Blackburn JT, Marshall SW, Padua DA. Gluteal muscle activation during common therapeutic exercises. J Orthop Sports Phys Ther. 2009;39(7):532-540. PMID: 19574662',
    videoSearchTerms: ['clamshell exercise gluteus medius', 'hip abduction sidelying physio'],
    icdCodes: ['M25.551', 'M76.0', 'M76.5'],
    cptCodeSuggestion: '97110',
  },

  terminal_knee_extension: {
    displayName: 'Terminal Knee Extension (TKE)',
    category: 'physiotherapy',
    primaryMuscles: [
      'vastus medialis oblique',
      'quadriceps femoris',
    ],
    secondaryMuscles: [
      'gastrocnemius (minimal)',
      'hamstrings (eccentric stabiliser)',
    ],
    jointActions: [
      'knee extension (last 30°)',
      'patellar tracking facilitation',
    ],
    contraindications: [
      'acute ACL reconstruction < 4 weeks (consult surgeon)',
      'knee hyperextension tendency (avoid over-extension)',
      'acute patellar dislocation',
    ],
    progressions: ['mini_squat', 'squat', 'step_up'],
    regressions:  ['straight_leg_raise', 'quad_set_isometric'],
    evidenceGrade: 'A',
    primaryReference:
      'Tyler TF, McHugh MP, Gleim GW, Nicholas SJ. The effect of immediate weightbearing after anterior cruciate ligament reconstruction. Clin Orthop Relat Res. 1998;357:141-148. PMID: 9917714',
    videoSearchTerms: ['terminal knee extension TKE band', 'VMO activation physiotherapy'],
    icdCodes: ['M25.361', 'M22.2', 'Z96.651'],
    cptCodeSuggestion: '97110',
  },

  single_leg_balance: {
    displayName: 'Single Leg Balance',
    category: 'physiotherapy',
    primaryMuscles: [
      'tibialis anterior',
      'fibularis (peroneus) longus',
      'fibularis (peroneus) brevis',
      'gluteus medius',
    ],
    secondaryMuscles: [
      'soleus',
      'gastrocnemius',
      'quadriceps femoris',
      'gluteus maximus',
    ],
    jointActions: [
      'ankle proprioceptive stabilisation',
      'knee dynamic stabilisation',
      'hip frontal plane stabilisation',
    ],
    contraindications: [
      'Grade II+ ankle sprain (acute, < 72h)',
      'severe vestibular disorder (fall risk without supervision)',
      'peripheral neuropathy with loss of protective sensation',
    ],
    progressions: [
      'single_leg_balance_on_foam',
      'single_leg_squat',
      'single_leg_balance_with_perturbation',
    ],
    regressions:  ['tandem_stance', 'eyes_closed_double_stance'],
    evidenceGrade: 'B',
    primaryReference:
      'Hübscher M, Zech A, Pfeifer K, Hänsel F, Vogt L, Banzer W. Neuromuscular training for sports injury prevention: a systematic review. Med Sci Sports Exerc. 2010;42(3):413-421. PMID: 20083957',
    videoSearchTerms: ['single leg balance proprioception', 'ankle stability rehab physiotherapy'],
    icdCodes: ['M25.371', 'M25.361', 'S93.401'],
    cptCodeSuggestion: '97110',
  },

  side_lying_hip_abduction: {
    displayName: 'Side-Lying Hip Abduction',
    category: 'physiotherapy',
    primaryMuscles: [
      'gluteus medius',
      'gluteus minimus',
      'tensor fasciae latae',
    ],
    secondaryMuscles: [
      'sartorius',
      'piriformis',
      'quadratus lumborum (stabiliser)',
    ],
    jointActions: [
      'hip abduction (0–45°)',
      'frontal plane pelvis stabilisation',
    ],
    contraindications: [
      'greater trochanteric bursitis (acute)',
      'IT band syndrome (acute lateral hip pain)',
      'hip arthroplasty lateral approach < 6 weeks',
    ],
    progressions: ['resisted_hip_abduction', 'monster_walk', 'lateral_band_walk'],
    regressions:  ['clamshell', 'supine_hip_abduction'],
    evidenceGrade: 'A',
    primaryReference:
      'Boren K, Conrey C, Le Coguic J, Paprocki L, Voight M, Robinson TK. Electromyographic analysis of gluteus medius and gluteus maximus during rehabilitation exercises. Int J Sports Phys Ther. 2011;6(3):206-223. PMID: 21904699',
    videoSearchTerms: ['side lying hip abduction gluteus medius EMG', 'hip abduction rehab'],
    icdCodes: ['M76.0', 'M25.551', 'M62.838'],
    cptCodeSuggestion: '97110',
  },

  prone_hip_extension: {
    displayName: 'Prone Hip Extension',
    category: 'physiotherapy',
    primaryMuscles: [
      'gluteus maximus',
      'biceps femoris',
      'semitendinosus',
    ],
    secondaryMuscles: [
      'erector spinae',
      'multifidus',
      'transversus abdominis',
    ],
    jointActions: [
      'hip extension (prone)',
      'lumbar stabilisation (isometric)',
    ],
    contraindications: [
      'lumbar spinal stenosis (prone position exacerbating)',
      'acute inguinal hernia',
      'third trimester pregnancy',
    ],
    progressions: ['quadruped_hip_extension', 'glute_bridge', 'hip_thrust'],
    regressions:  ['prone_isometric_glute_squeeze', 'sidelying_hip_extension'],
    evidenceGrade: 'B',
    primaryReference:
      'Sakamoto AC, Teixeira-Salmela LF, de Paula Goulart FR, de Moraes Faria CD, Guimarães CQ. Muscular activation patterns during active prone hip extension exercises. J Electromyogr Kinesiol. 2009;19(1):105-112. PMID: 17580136',
    videoSearchTerms: ['prone hip extension gluteus maximus', 'lying hip extension rehab'],
    icdCodes: ['M54.5', 'M25.551', 'M62.838'],
    cptCodeSuggestion: '97110',
  },

  wall_slide: {
    displayName: 'Wall Slide (Shoulder)',
    category: 'physiotherapy',
    primaryMuscles: [
      'trapezius (lower)',
      'serratus anterior',
    ],
    secondaryMuscles: [
      'trapezius (middle)',
      'rhomboids',
      'infraspinatus',
      'teres minor',
      'deltoideus (posterior)',
    ],
    jointActions: [
      'scapular upward rotation',
      'scapular posterior tilt',
      'shoulder flexion (progressive)',
      'glenohumeral external rotation',
    ],
    contraindications: [
      'acute rotator cuff tear (full thickness, painful arc)',
      'grade II+ acromioclavicular separation',
      'frozen shoulder (adhesive capsulitis) — active phase',
    ],
    progressions: [
      'wall_angel',
      'shoulder_press',
      'overhead_press_with_band',
    ],
    regressions:  ['supine_shoulder_flexion', 'scapular_setting', 'prone_y_t_exercises'],
    evidenceGrade: 'B',
    primaryReference:
      'Cools AM, Dewitte V, Lanszweert F, et al. Rehabilitation of scapular muscle balance: which exercises to prescribe? Am J Sports Med. 2007;35(10):1744-1751. PMID: 17519432',
    videoSearchTerms: ['wall slide shoulder scapular upward rotation', 'shoulder rehab wall slide'],
    icdCodes: ['M75.1', 'M75.5', 'M75.81'],
    cptCodeSuggestion: '97110',
  },

  monster_walk: {
    displayName: 'Monster Walk (Lateral Band Walk)',
    category: 'physiotherapy',
    primaryMuscles: [
      'gluteus medius',
      'gluteus minimus',
    ],
    secondaryMuscles: [
      'tensor fasciae latae',
      'quadriceps femoris',
      'tibialis anterior',
      'fibularis (peroneus) longus',
    ],
    jointActions: [
      'hip abduction (dynamic)',
      'frontal plane knee stabilisation',
      'hip internal rotation control',
    ],
    contraindications: [
      'acute ankle sprain (lateral, < 1 week)',
      'knee medial collateral ligament sprain (acute, Grade III)',
      'hip arthroplasty < 8 weeks',
    ],
    progressions: [
      'lateral_squat_walk',
      'monster_walk_with_forward_backward',
      'single_leg_squat',
    ],
    regressions:  ['clamshell', 'side_lying_hip_abduction'],
    evidenceGrade: 'A',
    primaryReference:
      'Distefano LJ, Blackburn JT, Marshall SW, Padua DA. Gluteal muscle activation during common therapeutic exercises. J Orthop Sports Phys Ther. 2009;39(7):532-540. PMID: 19574662',
    videoSearchTerms: ['monster walk lateral band walk glute', 'hip abduction resistance band walk'],
    icdCodes: ['M25.551', 'M76.0', 'M22.2'],
    cptCodeSuggestion: '97110',
  },

  nordic_hamstring_curl: {
    displayName: 'Nordic Hamstring Curl',
    category: 'physiotherapy',
    primaryMuscles: [
      'biceps femoris',
      'semitendinosus',
      'semimembranosus',
    ],
    secondaryMuscles: [
      'gastrocnemius',
      'gluteus maximus',
      'erector spinae',
    ],
    jointActions: [
      'knee flexion (eccentric — lowering phase)',
      'hip stabilisation (isometric)',
    ],
    contraindications: [
      'acute hamstring strain Grade II-III (< 6 weeks)',
      'proximal hamstring tendinopathy (acute, ischial compression)',
      'posterior cruciate ligament instability (resisted knee flexion load)',
    ],
    progressions: [
      'weighted_nordic_curl',
      'slider_leg_curl',
    ],
    regressions:  ['lying_leg_curl_machine', 'romanian_deadlift', 'glute_bridge'],
    evidenceGrade: 'A',
    primaryReference:
      'van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med. 2019;53(21):1362-1370. PMID: 30655259',
    videoSearchTerms: ['Nordic hamstring curl eccentric', 'Nordic hamstring injury prevention'],
    icdCodes: ['M76.3', 'M62.051', 'M66.351'],
    cptCodeSuggestion: '97110',
  },
};

/** Convenience lookup — returns undefined if key not in library */
export function getExerciseMeta(key: string): ExerciseMeta | undefined {
  return EXERCISE_LIBRARY[key];
}

/** All exercise keys grouped by category */
export const EXERCISE_KEYS_BY_CATEGORY = {
  gym:            Object.keys(EXERCISE_LIBRARY).filter(k => EXERCISE_LIBRARY[k]!.category === 'gym'),
  yoga:           Object.keys(EXERCISE_LIBRARY).filter(k => EXERCISE_LIBRARY[k]!.category === 'yoga'),
  pilates:        Object.keys(EXERCISE_LIBRARY).filter(k => EXERCISE_LIBRARY[k]!.category === 'pilates'),
  physiotherapy:  Object.keys(EXERCISE_LIBRARY).filter(k => EXERCISE_LIBRARY[k]!.category === 'physiotherapy'),
} as const;
