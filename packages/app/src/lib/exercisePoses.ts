// exercisePoses.ts — Stick-figure pose library for ExerciseAnimationGuide
// Phase 2.5 F5. ViewBox: 0 0 80 160. Constitutional: no "use client".

export interface JointPos { x: number; y: number; }

export interface StickPose {
  head: JointPos; neck: JointPos;
  lSho: JointPos; rSho: JointPos;
  lElb: JointPos; rElb: JointPos;
  lWri: JointPos; rWri: JointPos;
  mHip: JointPos; lHip: JointPos; rHip: JointPos;
  lKne: JointPos; rKne: JointPos;
  lAnk: JointPos; rAnk: JointPos;
}

export type ExerciseKey =
  | 'squat' | 'hipAbduction' | 'shoulderPress' | 'hamstringStretch'
  | 'gluteBridge' | 'clamshell' | 'standingBalance' | 'heelRaises'
  | 'deadBug' | 'hipFlexorStretch';

// Neutral standing pose
export const STAND: StickPose = {
  head: { x: 40, y: 12 }, neck: { x: 40, y: 22 },
  lSho: { x: 28, y: 30 }, rSho: { x: 52, y: 30 },
  lElb: { x: 22, y: 48 }, rElb: { x: 58, y: 48 },
  lWri: { x: 20, y: 64 }, rWri: { x: 60, y: 64 },
  mHip: { x: 40, y: 72 }, lHip: { x: 34, y: 72 }, rHip: { x: 46, y: 72 },
  lKne: { x: 34, y: 100 }, rKne: { x: 46, y: 100 },
  lAnk: { x: 34, y: 130 }, rAnk: { x: 46, y: 130 },
};

export const POSES: Record<ExerciseKey, { stand: StickPose; peak: StickPose }> = {
  squat: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 30 }, neck: { x: 40, y: 40 },
      lSho: { x: 28, y: 46 }, rSho: { x: 52, y: 46 },
      lElb: { x: 20, y: 56 }, rElb: { x: 60, y: 56 },
      lWri: { x: 16, y: 64 }, rWri: { x: 64, y: 64 },
      mHip: { x: 40, y: 80 }, lHip: { x: 32, y: 80 }, rHip: { x: 48, y: 80 },
      lKne: { x: 22, y: 108 }, rKne: { x: 58, y: 108 },
      lAnk: { x: 26, y: 130 }, rAnk: { x: 54, y: 130 },
    },
  },

  hipAbduction: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 12 }, neck: { x: 40, y: 22 },
      lSho: { x: 28, y: 30 }, rSho: { x: 52, y: 30 },
      lElb: { x: 22, y: 48 }, rElb: { x: 58, y: 48 },
      lWri: { x: 20, y: 64 }, rWri: { x: 60, y: 64 },
      mHip: { x: 40, y: 72 }, lHip: { x: 34, y: 72 }, rHip: { x: 46, y: 72 },
      lKne: { x: 34, y: 100 }, rKne: { x: 60, y: 88 },
      lAnk: { x: 34, y: 130 }, rAnk: { x: 70, y: 78 },
    },
  },

  shoulderPress: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 12 }, neck: { x: 40, y: 22 },
      lSho: { x: 28, y: 30 }, rSho: { x: 52, y: 30 },
      lElb: { x: 18, y: 16 }, rElb: { x: 62, y: 16 },
      lWri: { x: 14, y: 6 }, rWri: { x: 66, y: 6 },
      mHip: { x: 40, y: 72 }, lHip: { x: 34, y: 72 }, rHip: { x: 46, y: 72 },
      lKne: { x: 34, y: 100 }, rKne: { x: 46, y: 100 },
      lAnk: { x: 34, y: 130 }, rAnk: { x: 46, y: 130 },
    },
  },

  hamstringStretch: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 70 }, neck: { x: 40, y: 62 },
      lSho: { x: 28, y: 58 }, rSho: { x: 52, y: 58 },
      lElb: { x: 24, y: 76 }, rElb: { x: 56, y: 76 },
      lWri: { x: 24, y: 90 }, rWri: { x: 56, y: 90 },
      mHip: { x: 40, y: 54 }, lHip: { x: 34, y: 54 }, rHip: { x: 46, y: 54 },
      lKne: { x: 34, y: 100 }, rKne: { x: 46, y: 100 },
      lAnk: { x: 34, y: 130 }, rAnk: { x: 46, y: 130 },
    },
  },

  // Floor exercises: figure shown lying (head at bottom, body up)
  gluteBridge: {
    stand: {
      head: { x: 40, y: 148 }, neck: { x: 40, y: 140 },
      lSho: { x: 26, y: 134 }, rSho: { x: 54, y: 134 },
      lElb: { x: 16, y: 134 }, rElb: { x: 64, y: 134 },
      lWri: { x: 10, y: 134 }, rWri: { x: 70, y: 134 },
      mHip: { x: 40, y: 118 }, lHip: { x: 34, y: 118 }, rHip: { x: 46, y: 118 },
      lKne: { x: 30, y: 130 }, rKne: { x: 50, y: 130 },
      lAnk: { x: 26, y: 148 }, rAnk: { x: 54, y: 148 },
    },
    peak: {
      head: { x: 40, y: 148 }, neck: { x: 40, y: 140 },
      lSho: { x: 26, y: 134 }, rSho: { x: 54, y: 134 },
      lElb: { x: 16, y: 134 }, rElb: { x: 64, y: 134 },
      lWri: { x: 10, y: 134 }, rWri: { x: 70, y: 134 },
      mHip: { x: 40, y: 100 }, lHip: { x: 34, y: 100 }, rHip: { x: 46, y: 100 },
      lKne: { x: 28, y: 124 }, rKne: { x: 52, y: 124 },
      lAnk: { x: 24, y: 148 }, rAnk: { x: 56, y: 148 },
    },
  },

  clamshell: {
    stand: {
      head: { x: 14, y: 30 }, neck: { x: 20, y: 36 },
      lSho: { x: 26, y: 52 }, rSho: { x: 36, y: 56 },
      lElb: { x: 22, y: 70 }, rElb: { x: 44, y: 74 },
      lWri: { x: 20, y: 84 }, rWri: { x: 48, y: 86 },
      mHip: { x: 40, y: 92 }, lHip: { x: 36, y: 92 }, rHip: { x: 44, y: 92 },
      lKne: { x: 36, y: 112 }, rKne: { x: 44, y: 112 },
      lAnk: { x: 38, y: 130 }, rAnk: { x: 46, y: 130 },
    },
    peak: {
      head: { x: 14, y: 30 }, neck: { x: 20, y: 36 },
      lSho: { x: 26, y: 52 }, rSho: { x: 36, y: 56 },
      lElb: { x: 22, y: 70 }, rElb: { x: 44, y: 74 },
      lWri: { x: 20, y: 84 }, rWri: { x: 48, y: 86 },
      mHip: { x: 40, y: 92 }, lHip: { x: 36, y: 92 }, rHip: { x: 44, y: 92 },
      lKne: { x: 36, y: 112 }, rKne: { x: 58, y: 98 },
      lAnk: { x: 38, y: 130 }, rAnk: { x: 60, y: 126 },
    },
  },

  standingBalance: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 12 }, neck: { x: 40, y: 22 },
      lSho: { x: 28, y: 30 }, rSho: { x: 52, y: 30 },
      lElb: { x: 20, y: 46 }, rElb: { x: 60, y: 46 },
      lWri: { x: 18, y: 62 }, rWri: { x: 62, y: 62 },
      mHip: { x: 40, y: 72 }, lHip: { x: 34, y: 72 }, rHip: { x: 46, y: 72 },
      lKne: { x: 46, y: 90 }, rKne: { x: 46, y: 100 },
      lAnk: { x: 50, y: 78 }, rAnk: { x: 46, y: 130 },
    },
  },

  heelRaises: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 8 }, neck: { x: 40, y: 18 },
      lSho: { x: 28, y: 26 }, rSho: { x: 52, y: 26 },
      lElb: { x: 22, y: 44 }, rElb: { x: 58, y: 44 },
      lWri: { x: 20, y: 60 }, rWri: { x: 60, y: 60 },
      mHip: { x: 40, y: 68 }, lHip: { x: 34, y: 68 }, rHip: { x: 46, y: 68 },
      lKne: { x: 34, y: 96 }, rKne: { x: 46, y: 96 },
      lAnk: { x: 34, y: 118 }, rAnk: { x: 46, y: 118 },
    },
  },

  deadBug: {
    stand: {
      head: { x: 40, y: 148 }, neck: { x: 40, y: 140 },
      lSho: { x: 26, y: 130 }, rSho: { x: 54, y: 130 },
      lElb: { x: 20, y: 112 }, rElb: { x: 60, y: 130 },
      lWri: { x: 16, y: 96 }, rWri: { x: 68, y: 130 },
      mHip: { x: 40, y: 116 }, lHip: { x: 34, y: 116 }, rHip: { x: 46, y: 116 },
      lKne: { x: 32, y: 108 }, rKne: { x: 48, y: 108 },
      lAnk: { x: 28, y: 108 }, rAnk: { x: 52, y: 108 },
    },
    peak: {
      head: { x: 40, y: 148 }, neck: { x: 40, y: 140 },
      lSho: { x: 26, y: 130 }, rSho: { x: 54, y: 130 },
      lElb: { x: 18, y: 110 }, rElb: { x: 62, y: 130 },
      lWri: { x: 12, y: 90 }, rWri: { x: 70, y: 130 },
      mHip: { x: 40, y: 116 }, lHip: { x: 34, y: 116 }, rHip: { x: 46, y: 116 },
      lKne: { x: 34, y: 104 }, rKne: { x: 56, y: 94 },
      lAnk: { x: 26, y: 100 }, rAnk: { x: 64, y: 76 },
    },
  },

  hipFlexorStretch: {
    stand: STAND,
    peak: {
      head: { x: 40, y: 20 }, neck: { x: 40, y: 30 },
      lSho: { x: 28, y: 40 }, rSho: { x: 52, y: 40 },
      lElb: { x: 20, y: 56 }, rElb: { x: 60, y: 56 },
      lWri: { x: 18, y: 72 }, rWri: { x: 62, y: 72 },
      mHip: { x: 40, y: 84 }, lHip: { x: 34, y: 84 }, rHip: { x: 46, y: 84 },
      lKne: { x: 28, y: 110 }, rKne: { x: 56, y: 100 },
      lAnk: { x: 26, y: 130 }, rAnk: { x: 68, y: 130 },
    },
  },
};

export type LoadingCategory = 'strength' | 'mobility' | 'balance' | 'cardio';

export interface ExerciseConfig {
  name: string;
  category: LoadingCategory;
  sets: number;
  reps: number;
  restSecs: number;
  primaryJoints: Array<keyof StickPose>;
  holdRatio: number;    // 0-1 fraction of repMs spent at peak
  repMs: number;        // total ms for one rep cycle
  formCues: string[];
  isFloor?: boolean;
}

export const EXERCISE_CONFIG: Partial<Record<ExerciseKey, ExerciseConfig>> = {
  squat: {
    name: 'Squat',
    category: 'strength',
    sets: 3, reps: 12, restSecs: 60,
    primaryJoints: ['lKne', 'rKne', 'lHip', 'rHip'],
    holdRatio: 0.15, repMs: 3200,
    formCues: ['Knees over toes', 'Chest up', 'Drive through heels'],
  },
  hipAbduction: {
    name: 'Hip Abduction',
    category: 'strength',
    sets: 3, reps: 15, restSecs: 45,
    primaryJoints: ['rKne', 'rAnk', 'rHip'],
    holdRatio: 0.2, repMs: 2800,
    formCues: ['Keep hips level', 'Toes forward', 'Control the return'],
  },
  shoulderPress: {
    name: 'Shoulder Press',
    category: 'strength',
    sets: 3, reps: 10, restSecs: 60,
    primaryJoints: ['lElb', 'rElb', 'lWri', 'rWri'],
    holdRatio: 0.1, repMs: 3000,
    formCues: ['Core tight', 'Press straight up', 'Full extension'],
  },
  hamstringStretch: {
    name: 'Hamstring Stretch',
    category: 'mobility',
    sets: 2, reps: 8, restSecs: 30,
    primaryJoints: ['lKne', 'rKne', 'mHip'],
    holdRatio: 0.5, repMs: 4000,
    formCues: ['Hinge at hips', 'Keep back flat', 'Breathe out as you fold'],
  },
  gluteBridge: {
    name: 'Glute Bridge',
    category: 'strength',
    sets: 3, reps: 15, restSecs: 45,
    primaryJoints: ['mHip', 'lHip', 'rHip', 'lKne', 'rKne'],
    holdRatio: 0.25, repMs: 3000,
    formCues: ['Squeeze glutes at top', 'Feet flat', 'Drive through heels'],
    isFloor: true,
  },
  clamshell: {
    name: 'Clamshell',
    category: 'strength',
    sets: 3, reps: 15, restSecs: 30,
    primaryJoints: ['rKne', 'rHip', 'lKne'],
    holdRatio: 0.2, repMs: 2800,
    formCues: ['Hips stacked', 'Keep feet together', 'Lead with the knee'],
    isFloor: true,
  },
  standingBalance: {
    name: 'Single-Leg Balance',
    category: 'balance',
    sets: 3, reps: 10, restSecs: 30,
    primaryJoints: ['lKne', 'lAnk', 'rAnk'],
    holdRatio: 0.4, repMs: 3600,
    formCues: ['Soft standing knee', 'Eyes fixed ahead', 'Core engaged'],
  },
  heelRaises: {
    name: 'Heel Raises',
    category: 'strength',
    sets: 3, reps: 20, restSecs: 30,
    primaryJoints: ['lAnk', 'rAnk', 'lKne', 'rKne'],
    holdRatio: 0.15, repMs: 2400,
    formCues: ['Full range of motion', 'Control the descent', 'Light fingertip support only'],
  },
  deadBug: {
    name: 'Dead Bug',
    category: 'strength',
    sets: 3, reps: 10, restSecs: 45,
    primaryJoints: ['lWri', 'rKne', 'rAnk'],
    holdRatio: 0.3, repMs: 4000,
    formCues: ['Lower back flat', 'Exhale as you extend', 'Opposite arm and leg'],
    isFloor: true,
  },
  hipFlexorStretch: {
    name: 'Hip Flexor Stretch',
    category: 'mobility',
    sets: 2, reps: 6, restSecs: 20,
    primaryJoints: ['lKne', 'rKne', 'mHip', 'lHip'],
    holdRatio: 0.55, repMs: 5000,
    formCues: ['Posterior pelvic tilt', 'Tall spine', 'Breathe into the stretch'],
  },
};

/** Interpolate between two poses by alpha 0-1 */
export function lerpPose(a: StickPose, b: StickPose, t: number): StickPose {
  const lerp = (va: number, vb: number) => va + (vb - va) * t;
  const lerpJ = (ja: JointPos, jb: JointPos): JointPos => ({ x: lerp(ja.x, jb.x), y: lerp(ja.y, jb.y) });
  return {
    head: lerpJ(a.head, b.head), neck: lerpJ(a.neck, b.neck),
    lSho: lerpJ(a.lSho, b.lSho), rSho: lerpJ(a.rSho, b.rSho),
    lElb: lerpJ(a.lElb, b.lElb), rElb: lerpJ(a.rElb, b.rElb),
    lWri: lerpJ(a.lWri, b.lWri), rWri: lerpJ(a.rWri, b.rWri),
    mHip: lerpJ(a.mHip, b.mHip), lHip: lerpJ(a.lHip, b.lHip), rHip: lerpJ(a.rHip, b.rHip),
    lKne: lerpJ(a.lKne, b.lKne), rKne: lerpJ(a.rKne, b.rKne),
    lAnk: lerpJ(a.lAnk, b.lAnk), rAnk: lerpJ(a.rAnk, b.rAnk),
  };
}
