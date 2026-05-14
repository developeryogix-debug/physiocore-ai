// NOTE: This is ExerciseQualityAgent — estimates functional movement quality from session scores.
// NOT a goniometric ROM assessment.
// For clinical ROM use GuidedROMAssessment.tsx (camera-based goniometry, 8 tests).
import Anthropic from '@anthropic-ai/sdk';
import type {
  SessionSummary,
  JointROM,
  Asymmetry,
  Trend,
  ROMReport,
  EvidenceGrade,
} from '../types/findings.js';

// ─── Exercise → Joint mapping ─────────────────────────────────────────────────
// Maps exercise name substrings → { jointKey, movement, side? }
// side 'left'|'right' indicates unilateral exercise; null = bilateral

interface ExerciseJointMapping {
  jointKey:  string;
  movement:  string;
  normalMax: number;   // degrees, from Norkin 2016
  side?:     'left' | 'right';
}

const EXERCISE_JOINT_MAP: Record<string, ExerciseJointMapping[]> = {
  // ── Knee ──────────────────────────────────────────────────────────────────
  squat:                  [{ jointKey: 'knee', movement: 'flexion',   normalMax: 135 }],
  split_squat:            [{ jointKey: 'knee', movement: 'flexion',   normalMax: 135 }],
  knee_extension:         [{ jointKey: 'knee', movement: 'extension', normalMax: 0   }],
  knee_flexion:           [{ jointKey: 'knee', movement: 'flexion',   normalMax: 135 }],
  lunge:                  [{ jointKey: 'knee', movement: 'flexion',   normalMax: 135 }],
  step_up:                [{ jointKey: 'knee', movement: 'flexion',   normalMax: 135 }],
  wall_sit:               [{ jointKey: 'knee', movement: 'flexion',   normalMax: 135 }],

  // ── Hip ───────────────────────────────────────────────────────────────────
  hip_thrust:             [{ jointKey: 'hip',  movement: 'extension', normalMax: 30  }],
  hip_hinge:              [{ jointKey: 'hip',  movement: 'flexion',   normalMax: 120 }],
  deadlift:               [{ jointKey: 'hip',  movement: 'flexion',   normalMax: 120 }],
  hip_abduction:          [{ jointKey: 'hip',  movement: 'abduction', normalMax: 45  }],
  hip_extension:          [{ jointKey: 'hip',  movement: 'extension', normalMax: 30  }],
  clamshell:              [{ jointKey: 'hip',  movement: 'externalRotation', normalMax: 45 }],
  pigeon:                 [{ jointKey: 'hip',  movement: 'externalRotation', normalMax: 45 }],

  // ── Shoulder ──────────────────────────────────────────────────────────────
  shoulder_press:         [{ jointKey: 'shoulder', movement: 'flexion',   normalMax: 180 }],
  shoulder_flexion:       [{ jointKey: 'shoulder', movement: 'flexion',   normalMax: 180 }],
  shoulder_abduction:     [{ jointKey: 'shoulder', movement: 'abduction', normalMax: 180 }],
  shoulder_external_rotation: [{ jointKey: 'shoulder', movement: 'externalRotation', normalMax: 90 }],
  shoulder_internal_rotation: [{ jointKey: 'shoulder', movement: 'internalRotation', normalMax: 70 }],
  lateral_raise:          [{ jointKey: 'shoulder', movement: 'abduction', normalMax: 180 }],
  overhead_press:         [{ jointKey: 'shoulder', movement: 'flexion',   normalMax: 180 }],

  // ── Ankle ─────────────────────────────────────────────────────────────────
  calf_raise:             [{ jointKey: 'ankle', movement: 'plantarFlexion',  normalMax: 50 }],
  ankle_dorsiflexion:     [{ jointKey: 'ankle', movement: 'dorsiFlexion',    normalMax: 20 }],
  ankle_plantarflexion:   [{ jointKey: 'ankle', movement: 'plantarFlexion',  normalMax: 50 }],
  single_leg_calf_raise:  [{ jointKey: 'ankle', movement: 'plantarFlexion',  normalMax: 50 }],

  // ── Lumbar ────────────────────────────────────────────────────────────────
  lumbar_flexion:         [{ jointKey: 'lumbar', movement: 'flexion',    normalMax: 60 }],
  lumbar_extension:       [{ jointKey: 'lumbar', movement: 'extension',  normalMax: 25 }],
  cat_cow:                [{ jointKey: 'lumbar', movement: 'flexion',    normalMax: 60 }],
  bird_dog:               [{ jointKey: 'lumbar', movement: 'extension',  normalMax: 25 }],
  superman:               [{ jointKey: 'lumbar', movement: 'extension',  normalMax: 25 }],
  bridge:                 [{ jointKey: 'lumbar', movement: 'extension',  normalMax: 25 }],

  // ── Cervical ──────────────────────────────────────────────────────────────
  cervical_flexion:       [{ jointKey: 'cervical', movement: 'flexion',  normalMax: 45 }],
  cervical_rotation:      [{ jointKey: 'cervical', movement: 'rotation', normalMax: 80 }],
  chin_tuck:              [{ jointKey: 'cervical', movement: 'flexion',  normalMax: 45 }],
};

// Normalise exercise string to map key: lowercase, spaces→underscores, trim
function normaliseExercise(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]+/g, '_').trim();
}

// Find all joint mappings for an exercise name (substring match)
function findMappings(exercise: string): ExerciseJointMapping[] {
  const key = normaliseExercise(exercise);
  // Exact key match first
  if (EXERCISE_JOINT_MAP[key]) return EXERCISE_JOINT_MAP[key];
  // Substring: find first map key contained in exercise or vice-versa
  for (const [mapKey, mappings] of Object.entries(EXERCISE_JOINT_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return mappings;
  }
  return [];
}

// ─── Score → ROM estimation ───────────────────────────────────────────────────
// avg_score is a form-quality proxy (0–100).
// High score ≈ full ROM; low score ≈ restricted ROM.
// Conservative floor: even score=0 implies at least 40% ROM (patient can attempt move).
// Linear interpolation: ROM% = 40 + score * 0.60
function scoreToROMPercent(score: number): number {
  return Math.min(100, Math.max(0, 40 + score * 0.60));
}

function confidenceFromCount(count: number): JointROM['confidence'] {
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

// ─── Group sessions by exercise → joint key ──────────────────────────────────
interface JointBucket {
  jointKey:  string;
  movement:  string;
  normalMax: number;
  sessions:  SessionSummary[];
}

function buildJointBuckets(sessions: SessionSummary[]): Map<string, JointBucket> {
  const buckets = new Map<string, JointBucket>();

  for (const s of sessions) {
    const mappings = findMappings(s.exercise);
    for (const m of mappings) {
      const key = `${m.jointKey}__${m.movement}`;
      if (!buckets.has(key)) {
        buckets.set(key, { jointKey: m.jointKey, movement: m.movement, normalMax: m.normalMax, sessions: [] });
      }
      buckets.get(key)!.sessions.push(s);
    }
  }

  return buckets;
}

// ─── Compute JointROM per bucket ─────────────────────────────────────────────
function computeJointROMs(buckets: Map<string, JointBucket>): Record<string, JointROM> {
  const CITATION = 'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016';
  const result: Record<string, JointROM> = {};

  for (const [key, bucket] of buckets) {
    const scores  = bucket.sessions.map(s => s.avg_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const estimatedROMPercent = scoreToROMPercent(avgScore);
    const deficitPercent      = 100 - estimatedROMPercent;
    const lastSession         = bucket.sessions.sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;

    result[key] = {
      joint:     bucket.jointKey,
      movement:  bucket.movement,
      normalMax: bucket.normalMax,
      movementQualityPercent: Math.round(estimatedROMPercent * 10) / 10,
      deficitPercent:         Math.round(deficitPercent      * 10) / 10,
      clinicallySignificant:  deficitPercent > 20,
      sessionCount:    bucket.sessions.length,
      lastMeasuredAt:  lastSession.date,
      citation:        CITATION,
      confidence:      confidenceFromCount(bucket.sessions.length),
      dataSource:      'session_score_proxy',
      assessmentType:  'exercise_quality_proxy',
    };
  }

  return result;
}

// ─── Detect bilateral asymmetries ────────────────────────────────────────────
// Look for left/right keywords in exercise name for the same joint/movement.
function detectAsymmetries(sessions: SessionSummary[]): Asymmetry[] {
  // Group by normalised exercise stripped of side prefix/suffix
  const sideGroups = new Map<string, { left: number[]; right: number[] }>();

  for (const s of sessions) {
    const norm = normaliseExercise(s.exercise);
    const isLeft  = /\bleft\b|_left|left_/.test(norm);
    const isRight = /\bright\b|_right|right_/.test(norm);
    if (!isLeft && !isRight) continue;

    // Canonical key: strip side tokens
    const base = norm.replace(/(^left_|_left$|^right_|_right$)/g, '').replace(/__+/g, '_');
    if (!sideGroups.has(base)) sideGroups.set(base, { left: [], right: [] });
    const g = sideGroups.get(base)!;
    if (isLeft)  g.left.push(s.avg_score);
    if (isRight) g.right.push(s.avg_score);
  }

  const result: Asymmetry[] = [];

  for (const [base, { left, right }] of sideGroups) {
    if (left.length === 0 || right.length === 0) continue;
    const leftAvg  = left.reduce((a, b)  => a + b, 0) / left.length;
    const rightAvg = right.reduce((a, b) => a + b, 0) / right.length;
    const maxAvg   = Math.max(leftAvg, rightAvg);
    const asymmetryPercent = maxAvg === 0 ? 0 : (Math.abs(leftAvg - rightAvg) / maxAvg) * 100;

    const mappings = findMappings(base);
    const joint    = mappings[0]?.jointKey  ?? base;
    const movement = mappings[0]?.movement  ?? 'unknown';

    result.push({
      joint,
      movement,
      leftScoreAvg:  Math.round(leftAvg  * 10) / 10,
      rightScoreAvg: Math.round(rightAvg * 10) / 10,
      asymmetryPercent: Math.round(asymmetryPercent * 10) / 10,
      dominantSide: leftAvg >= rightAvg ? 'left' : 'right',
      clinicallySignificant: asymmetryPercent > 10,
    });
  }

  return result;
}

// ─── Compute trends per exercise (last 5 sessions, linear slope) ─────────────
function computeTrends(sessions: SessionSummary[]): Trend[] {
  // Group by exercise
  const byExercise = new Map<string, SessionSummary[]>();
  for (const s of sessions) {
    const key = normaliseExercise(s.exercise);
    if (!byExercise.has(key)) byExercise.set(key, []);
    byExercise.get(key)!.push(s);
  }

  const result: Trend[] = [];

  for (const [exercise, exSessions] of byExercise) {
    const sorted = [...exSessions].sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-5);
    if (recent.length < 2) continue;

    // Simple linear regression (x = session index, y = avg_score)
    const n   = recent.length;
    const xs  = recent.map((_, i) => i);
    const ys  = recent.map(s => s.avg_score);
    const xBar = (n - 1) / 2;
    const yBar = ys.reduce((a, b) => a + b, 0) / n;
    const ssXY = xs.reduce((acc, x, i) => acc + (x - xBar) * ((ys[i] ?? yBar) - yBar), 0);
    const ssXX = xs.reduce((acc, x) => acc + (x - xBar) ** 2, 0);
    const slope = ssXX === 0 ? 0 : ssXY / ssXX;

    const direction: Trend['direction'] =
      slope >  0.5 ? 'improving' :
      slope < -0.5 ? 'declining' :
      'stable';

    const mappings = findMappings(exercise);
    const joint    = mappings[0]?.jointKey  ?? exercise;
    const movement = mappings[0]?.movement  ?? 'unknown';

    result.push({
      joint,
      movement,
      exercise,
      direction,
      slopePerSession: Math.round(slope * 100) / 100,
      sessionsAnalysed: n,
    });
  }

  return result;
}

// ─── Claude Haiku clinical summary ───────────────────────────────────────────
async function summariseWithHaiku(
  patientId:   string,
  joints:      Record<string, JointROM>,
  asymmetries: Asymmetry[],
  trends:      Trend[],
  client:      Anthropic,
): Promise<string> {
  const significant = Object.values(joints).filter(j => j.clinicallySignificant);
  const declining   = trends.filter(t => t.direction === 'declining');
  const improving   = trends.filter(t => t.direction === 'improving');
  const asymSig     = asymmetries.filter(a => a.clinicallySignificant);

  const prompt = `You are a physiotherapy AI assistant. Write a 2-3 sentence clinical ROM summary for a physiotherapist.

Patient data (session-score proxy, NOT goniometric measurement):
- Clinically significant deficits (>20%): ${significant.length === 0 ? 'None' : significant.map(j => `${j.joint} ${j.movement} ${j.deficitPercent.toFixed(0)}% deficit`).join(', ')}
- Declining trends: ${declining.length === 0 ? 'None' : declining.map(t => t.exercise).join(', ')}
- Improving trends: ${improving.length === 0 ? 'None' : improving.map(t => t.exercise).join(', ')}
- Bilateral asymmetries >10%: ${asymSig.length === 0 ? 'None' : asymSig.map(a => `${a.joint} ${a.movement} (${a.dominantSide} dominant, ${a.asymmetryPercent.toFixed(0)}% diff)`).join(', ')}

Write a concise clinical summary. Note that ROM values are inferred from form scores and should be validated with goniometry. No preamble, no bullet points — prose only.`;

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages:   [{ role: 'user', content: prompt }],
  });

  const block = msg.content[0];
  return block?.type === 'text' ? (block as { type: 'text'; text: string }).text.trim() : 'Clinical summary unavailable.';
}

// ─── ROMAgent ─────────────────────────────────────────────────────────────────

export class ROMAgent {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyseFromSessions(
    patientId: string,
    sessions:  SessionSummary[],
  ): Promise<ROMReport> {
    const t0 = Date.now();

    // Use last 10 sessions only
    const recent = [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    const buckets    = buildJointBuckets(recent);
    const joints     = computeJointROMs(buckets);
    const asymmetries = detectAsymmetries(recent);
    const trends     = computeTrends(recent);

    // Overall mobility: weighted average of ROM% (weights by sessionCount)
    const jointList = Object.values(joints);
    const overallMobility = jointList.length === 0 ? 0 : (() => {
      const totalWeight = jointList.reduce((a, j) => a + j.sessionCount, 0);
      return totalWeight === 0
        ? 0
        : jointList.reduce((acc, j) => acc + j.movementQualityPercent * j.sessionCount, 0) / totalWeight;
    })();

    // Data completeness: joints with data / 6 major joints expected
    const EXPECTED_JOINTS = 6;
    const dataCompleteness = Math.min(1, Object.keys(joints).length / EXPECTED_JOINTS);

    // Haiku summary
    let clinicalSummary: string;
    try {
      clinicalSummary = await summariseWithHaiku(
        patientId, joints, asymmetries, trends, this.client,
      );
    } catch {
      clinicalSummary =
        'ROM analysis based on session form scores. Goniometric validation recommended for clinical decisions.';
    }

    const evidenceGrade: EvidenceGrade = 'B';

    return {
      agentId:    'rom-agent',
      version:    '1.0.0',
      patientId,
      generatedAt: new Date().toISOString(),
      joints,
      overallMobility: Math.round(overallMobility * 10) / 10,
      asymmetries,
      trends,
      clinicalSummary,
      dataCompleteness: Math.round(dataCompleteness * 100) / 100,
      sessionsAnalysed: recent.length,
      evidenceGrade,
      citation:
        'Norkin CC, White DJ. Measurement of Joint Motion. 5th ed. FA Davis; 2016',
      processingMs: Date.now() - t0,
    };
  }
}
