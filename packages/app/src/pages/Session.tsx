import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { PoseFrame, PoseLandmark, AgentResult, FeedbackResponse } from '@physiocore/types';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { analyzeFrames, generateFeedback } from '../hooks/useOrchestrator.js';
import { saveSessionSummary } from '../lib/sessionMemory.js';
import { AgentStatusCard } from '../components/AgentStatusCard.js';
import { AiChatPanel } from '../components/AiChatPanel.js';
import { MOCK_PROFILE } from '../lib/mockProfile.js';
import { EXERCISE_LIBRARY, EXERCISE_KEYS_BY_CATEGORY } from '../lib/exerciseLibrary.js';
import type { ExerciseMeta } from '../lib/exerciseLibrary.js';

type MPLandmark = { x: number; y: number; z: number; visibility?: number };
interface Landmarker {
  detectForVideo(el: HTMLVideoElement, ts: number): { landmarks: MPLandmark[][] };
  close(): void;
}

type StatusState = 'ready' | 'warn_body' | 'warn_proximity' | 'warn_velocity' | 'warn_lighting' | 'idle';
interface SessionStatus { state: StatusState; message: string }
const STATUS_UI: Record<StatusState, { bg: string; border: string; color: string; dot: string }> = {
  ready:          { bg: 'rgba(0, 230, 118, 0.12)', border: '#86efac', color: '#00E676', dot: '#22c55e' },
  warn_body:      { bg: 'rgba(239, 68, 68, 0.12)', border: '#fca5a5', color: '#FF4444', dot: '#ef4444' },
  warn_proximity: { bg: 'rgba(245, 158, 11, 0.12)', border: '#fde047', color: '#FFB830', dot: '#f59e0b' },
  warn_velocity:  { bg: 'rgba(239, 68, 68, 0.12)', border: '#fca5a5', color: '#FF4444', dot: '#ef4444' },
  warn_lighting:  { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', dot: '#f97316' },
  idle:           { bg: 'rgba(245, 158, 11, 0.12)', border: '#fde047', color: '#FFB830', dot: '#f59e0b' },
};

type ViewMode = 'front' | 'right' | 'left' | 'lost';
const VIEW_BADGE: Record<ViewMode, { bg: string; border: string; color: string; dot: string; label: string }> = {
  front: { bg: 'rgba(0, 230, 118, 0.12)', border: '#86efac', color: '#00E676', dot: '#22c55e', label: '● Front view' },
  right: { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', dot: '#3b82f6', label: '● Side view — right' },
  left:  { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', dot: '#3b82f6', label: '● Side view — left' },
  lost:  { bg: 'rgba(245, 158, 11, 0.12)', border: '#fde047', color: '#FFB830', dot: '#f59e0b', label: '● Repositioning...' },
};
interface RepRecord { num: number; angle: number; score: number; duration: number; flag: 'good' | 'too_fast' | 'shallow' | 'invalid' }

const LANDMARK_NAMES = [
  'nose','left_eye_inner','left_eye','left_eye_outer','right_eye_inner','right_eye','right_eye_outer',
  'left_ear','right_ear','mouth_left','mouth_right',
  'left_shoulder','right_shoulder','left_elbow','right_elbow',
  'left_wrist','right_wrist','left_pinky','right_pinky','left_index','right_index','left_thumb','right_thumb',
  'left_hip','right_hip','left_knee','right_knee',
  'left_ankle','right_ankle','left_heel','right_heel','left_foot_index','right_foot_index',
] as const;

const POSE_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],
  [11,13],[13,15],[15,17],[17,19],[19,15],[15,21],
  [12,14],[14,16],[16,18],[18,20],[20,16],[16,22],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[29,31],[31,27],
  [24,26],[26,28],[28,30],[30,32],[32,28],
];

type ExerciseKey = 'squat' | 'deadlift' | 'pushup' | 'lunge' | 'shoulder_press' | 'hip_thrust' | 'glute_bridge' | 'bent_over_row';
const EXERCISE_CONFIG: Record<ExerciseKey, {
  joint: [number,number,number]; jointLeft: [number,number,number];
  label: string; labelLeft: string;
  targetRange: [number,number]; repDownThreshold: number; repUpThreshold: number;
}> = {
  squat:          { joint:[24,26,28], jointLeft:[23,25,27], label:'Right Knee',    labelLeft:'Left Knee',     targetRange:[70,110],  repDownThreshold:100, repUpThreshold:160 },
  deadlift:       { joint:[12,24,26], jointLeft:[11,23,25], label:'Hip Hinge (R)', labelLeft:'Hip Hinge (L)', targetRange:[45,70],   repDownThreshold:80,  repUpThreshold:160 },
  pushup:         { joint:[12,14,16], jointLeft:[11,13,15], label:'Right Elbow',   labelLeft:'Left Elbow',    targetRange:[60,100],  repDownThreshold:90,  repUpThreshold:150 },
  lunge:          { joint:[24,26,28], jointLeft:[23,25,27], label:'Front Knee',    labelLeft:'Front Knee',    targetRange:[80,100],  repDownThreshold:80,  repUpThreshold:140 },
  shoulder_press: { joint:[12,14,16], jointLeft:[11,13,15], label:'Right Elbow',   labelLeft:'Left Elbow',    targetRange:[85,100],  repDownThreshold:95,  repUpThreshold:150 },
  // hip thrust / glute bridge — measures trunk-to-thigh angle (ankle-hip-shoulder arc)
  hip_thrust:     { joint:[28,24,12], jointLeft:[27,23,11], label:'Hip Angle (R)', labelLeft:'Hip Angle (L)', targetRange:[145,175], repDownThreshold:120, repUpThreshold:160 },
  glute_bridge:   { joint:[28,24,12], jointLeft:[27,23,11], label:'Hip Angle (R)', labelLeft:'Hip Angle (L)', targetRange:[155,180], repDownThreshold:130, repUpThreshold:170 },
  // bent over row — tracks elbow angle at peak contraction
  bent_over_row:  { joint:[12,14,16], jointLeft:[11,13,15], label:'Right Elbow',   labelLeft:'Left Elbow',    targetRange:[50,90],   repDownThreshold:80,  repUpThreshold:140 },
};
const EXERCISES = Object.keys(EXERCISE_CONFIG) as ExerciseKey[];

type YogaKey = 'warrior_1' | 'downward_dog' | 'tree_pose' | 'cat_cow';
type PilatesKey = 'the_hundred' | 'single_leg_stretch' | 'roll_up' | 'swan_prep' | 'side_leg_lift' | 'plank_hold';
type SessionKey = ExerciseKey | YogaKey | PilatesKey;
interface YogaConfig {
  englishName: string; sanskritName: string;
  joint: [number,number,number]; jointLeft: [number,number,number];
  label: string; labelLeft: string;
  targetRange: [number,number]; holdTarget: number;
  voiceCue: string; completeCue: string;
}
const YOGA_CONFIG: Record<YogaKey, YogaConfig> = {
  warrior_1:    { englishName:'Warrior I',    sanskritName:'Virabhadrasana I',        joint:[24,26,28], jointLeft:[23,25,27], label:'Front knee (R)', labelLeft:'Front knee (L)', targetRange:[80,100],  holdTarget:30, voiceCue:'Bend your front knee to 90 degrees',              completeCue:'Warrior I complete — switch sides when ready' },
  downward_dog: { englishName:'Downward Dog', sanskritName:'Adho Mukha Svanasana',    joint:[12,24,26], jointLeft:[11,23,25], label:'Hip angle (R)',  labelLeft:'Hip angle (L)',  targetRange:[155,180], holdTarget:30, voiceCue:'Push your hips up and back, lengthen the spine',  completeCue:'Excellent hold — rest in child\'s pose' },
  tree_pose:    { englishName:'Tree Pose',    sanskritName:'Vrksasana',               joint:[24,26,28], jointLeft:[23,25,27], label:'Standing leg (R)',labelLeft:'Standing leg (L)',targetRange:[168,180], holdTarget:30, voiceCue:'Straighten your standing leg and find your balance', completeCue:'Tree Pose complete — switch sides when ready' },
  cat_cow:      { englishName:'Cat-Cow',      sanskritName:'Marjaryasana-Bitilasana', joint:[12,24,26], jointLeft:[11,23,25], label:'Spine (R)',      labelLeft:'Spine (L)',      targetRange:[70,115],  holdTarget:30, voiceCue:'Flow between cat and cow, keep the spine mobile',  completeCue:'Cat-Cow complete — well done' },
};
const YOGA_POSES = Object.keys(YOGA_CONFIG) as YogaKey[];

interface PilatesConfig {
  label: string; labelLeft: string;
  joint: [number,number,number]; jointLeft: [number,number,number];
  targetRange: [number,number];
  repDownThreshold: number; repUpThreshold: number;
  minCycleMs: number;
  targetReps: number; targetLabel: string;
  isPlank: boolean;
  invertRep: boolean;
}
const PILATES_CONFIG: Record<PilatesKey, PilatesConfig> = {
  the_hundred:         { label:'Arm elevation (R)', labelLeft:'Arm elevation (L)', joint:[23,11,15], jointLeft:[24,12,16], targetRange:[60,95],   repDownThreshold:90,  repUpThreshold:110, minCycleMs:600,  targetReps:100, targetLabel:'100 pumps',     isPlank:false, invertRep:false },
  single_leg_stretch:  { label:'Hip extension (R)', labelLeft:'Hip extension (L)', joint:[24,26,28], jointLeft:[23,25,27], targetRange:[140,160], repDownThreshold:130, repUpThreshold:110, minCycleMs:800,  targetReps:20,  targetLabel:'10 each side',  isPlank:false, invertRep:true  },
  roll_up:             { label:'Spine angle (R)',    labelLeft:'Spine angle (L)',   joint:[24,12,0],  jointLeft:[23,11,0],  targetRange:[70,105],  repDownThreshold:110, repUpThreshold:148, minCycleMs:1000, targetReps:8,   targetLabel:'8 reps',        isPlank:false, invertRep:false },
  swan_prep:           { label:'Extension (R)',      labelLeft:'Extension (L)',     joint:[11,23,25], jointLeft:[12,24,26], targetRange:[115,142], repDownThreshold:144, repUpThreshold:158, minCycleMs:800,  targetReps:10,  targetLabel:'10 reps',       isPlank:false, invertRep:false },
  side_leg_lift:       { label:'Hip abduction (L)',  labelLeft:'Hip abduction (R)', joint:[11,23,25], jointLeft:[12,24,26], targetRange:[143,165], repDownThreshold:163, repUpThreshold:172, minCycleMs:800,  targetReps:15,  targetLabel:'15 each side',  isPlank:false, invertRep:false },
  plank_hold:          { label:'Alignment (hip)',    labelLeft:'Alignment (hip)',   joint:[28,24,12], jointLeft:[27,23,11], targetRange:[165,180], repDownThreshold:0,   repUpThreshold:0,   minCycleMs:1000, targetReps:0,   targetLabel:'30–60s hold',   isPlank:true,  invertRep:false },
};
const PILATES_POSES = Object.keys(PILATES_CONFIG) as PilatesKey[];

function angleDeg(a: MPLandmark, b: MPLandmark, c: MPLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }; const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2) * (cb.x ** 2 + cb.y ** 2));
  return mag === 0 ? 0 : (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function angleRange(angles: number[]): number {
  return angles.length < 2 ? 999 : Math.max(...angles) - Math.min(...angles);
}

function computeFormScore(peakAngle: number, targetRange: [number, number]): number {
  const mid = (targetRange[0] + targetRange[1]) / 2;
  const half = Math.max((targetRange[1] - targetRange[0]) / 2, 1);
  return Math.max(10, Math.round(100 - (Math.abs(peakAngle - mid) / half) * 50));
}

function generatePrescription(exercise: ExerciseKey, records: RepRecord[]): Array<{ name: string; sets: string; focus: string }> {
  const tooFast = records.filter(r => r.flag === 'too_fast').length;
  const shallow = records.filter(r => r.flag === 'shallow').length;
  const many = records.length;
  const base: Record<ExerciseKey, Array<{ name: string; sets: string; focus: string }>> = {
    squat: [
      { name: shallow > many * 0.3 ? 'Box Squat' : 'Goblet Squat', sets: '3×10', focus: shallow > many * 0.3 ? 'Achieve full target depth on every rep' : 'Upright torso, controlled descent' },
      { name: tooFast > many * 0.3 ? 'Tempo Squat 4-1-2' : 'Paused Squat', sets: '3×6', focus: tooFast > many * 0.3 ? '4s down, 1s hold, 2s up' : '2s pause at bottom position' },
      { name: 'Hip Flexor Stretch', sets: '3×30s/side', focus: 'Improve depth and reduce anterior pelvic tilt' },
    ],
    deadlift: [
      { name: 'Romanian Deadlift', sets: '3×8', focus: 'Hinge at hips, neutral spine throughout' },
      { name: 'Good Morning', sets: '3×10', focus: 'Strengthen posterior chain and hamstrings' },
      { name: 'Cat-Cow Mobilisation', sets: '3×10', focus: 'Lumbar mobility and segmental activation' },
    ],
    pushup: [
      { name: tooFast > many * 0.3 ? 'Tempo Push-up 3-1-2' : 'Decline Push-up', sets: '3×8', focus: tooFast > many * 0.3 ? 'Control descent phase, eliminate momentum' : 'Increase upper chest engagement' },
      { name: 'Dumbbell Chest Fly', sets: '3×12', focus: 'Pectoral isolation and full range of motion' },
      { name: 'Shoulder Opener Stretch', sets: '3×30s', focus: 'Wrist flexor and anterior shoulder mobility' },
    ],
    lunge: [
      { name: 'Reverse Lunge', sets: '3×10/leg', focus: 'Knee tracks over second toe, torso upright' },
      { name: 'Bulgarian Split Squat', sets: '3×8/leg', focus: 'Build single-leg stability and quad strength' },
      { name: 'Hip Flexor Stretch', sets: '3×30s/side', focus: 'Improve stride length and pelvic posture' },
    ],
    shoulder_press: [
      { name: 'Dumbbell Lateral Raise', sets: '3×12', focus: 'Medial deltoid isolation, controlled arc' },
      { name: 'Face Pull', sets: '3×15', focus: 'Rear delt and rotator cuff balance' },
      { name: 'Thoracic Extension', sets: '3×10', focus: 'Overhead mobility prerequisite' },
    ],
    hip_thrust: [
      { name: tooFast > many * 0.3 ? 'Tempo Hip Thrust 3-1-2' : 'Single-Leg Hip Thrust', sets: '3×10', focus: tooFast > many * 0.3 ? '3s down, 1s squeeze at top, 2s up' : 'Unilateral gluteus maximus activation and pelvic stability' },
      { name: 'Clamshell', sets: '3×15/side', focus: 'Gluteus medius activation — prevents hip drop' },
      { name: 'Hip Flexor Stretch', sets: '3×30s/side', focus: 'Opposing hip flexors limit full hip extension range' },
    ],
    glute_bridge: [
      { name: 'Hip Thrust', sets: '3×12', focus: 'Loaded hip extension — progress from floor to bench' },
      { name: 'Dead Bug', sets: '3×8/side', focus: 'Lumbar stabilisation with contralateral limb loading' },
      { name: 'Monster Walk', sets: '2×20 steps', focus: 'Gluteus medius dynamic activation pattern' },
    ],
    bent_over_row: [
      { name: tooFast > many * 0.3 ? 'Tempo Bent Row 2-1-3' : 'Single-Arm Dumbbell Row', sets: '3×10', focus: tooFast > many * 0.3 ? 'Control eccentric phase — eliminate momentum' : 'Scapular retraction through full range' },
      { name: 'Face Pull', sets: '3×15', focus: 'Posterior rotator cuff balance — pairs with horizontal pull' },
      { name: 'Cat-Cow Mobilisation', sets: '3×10', focus: 'Lumbar mobility for safe hinge position maintenance' },
    ],
  };
  return base[exercise];
}


const _lastVoiceMs = { t: 0 };
function speak(text: string, force = false) {
  if (typeof speechSynthesis === 'undefined') return;
  const now = Date.now();
  if (!force && now - _lastVoiceMs.t < 6000) return;
  _lastVoiceMs.t = now;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.85; utt.pitch = 1.0;
  speechSynthesis.speak(utt);
}

function drawSkeleton(ctx: CanvasRenderingContext2D, lms: MPLandmark[], joint: [number,number,number], inRange: boolean, angle: number) {
  const w = ctx.canvas.width; const h = ctx.canvas.height;
  const [, vertex] = joint; const jc = inRange ? '#22c55e' : '#ef4444';
  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = lms[a]; const lmB = lms[b]; if (!lmA || !lmB) continue;
    const tracked = a === vertex || b === vertex;
    ctx.beginPath(); ctx.moveTo(lmA.x * w, lmA.y * h); ctx.lineTo(lmB.x * w, lmB.y * h);
    ctx.strokeStyle = tracked ? jc : 'rgba(255,255,255,0.55)'; ctx.lineWidth = tracked ? 4 : 2; ctx.stroke();
  }
  for (let i = 0; i < lms.length; i++) {
    const lm = lms[i]; if (!lm || (lm.visibility ?? 1) < 0.25) continue;
    ctx.beginPath(); ctx.arc(lm.x * w, lm.y * h, i === vertex ? 9 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i === vertex ? jc : '#ffffff'; ctx.fill();
  }
  const vLm = lms[vertex];
  if (vLm) {
    ctx.font = 'bold 24px system-ui'; ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(`${Math.round(angle)}°`, vLm.x * w + 12, vLm.y * h - 12);
    ctx.fillStyle = jc; ctx.fillText(`${Math.round(angle)}°`, vLm.x * w + 12, vLm.y * h - 12);
  }
}

async function loadLandmarker(): Promise<Landmarker> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error CDN dynamic import has no type declarations
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs') as {
    FilesetResolver: { forVisionTasks(p: string): Promise<unknown> };
    PoseLandmarker: { createFromOptions(v: unknown, o: unknown): Promise<Landmarker> };
  };
  const vision = await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
  return mod.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
  });
}

type SessionMode = 'idle' | 'starting' | 'running' | 'stopping';
function priorityColor(p: string) { return p === 'stop' ? '#ef4444' : p === 'high' ? '#f59e0b' : '#64748b'; }
function fmtDur(s: number) { return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`; }

/** Web Audio beep — no dependency required. isDouble fires a second beep 80ms after. */
function playBeep(freq = 440, dur = 0.12, isDouble = false) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const fire = (offset: number) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + offset);
      g.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + dur);
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + dur);
    };
    fire(0); if (isDouble) fire(dur + 0.08);
  } catch { /* AudioContext blocked or unavailable */ }
}

export default function Session() {
  const { userProfile } = useUserProfile();
  const profile = userProfile ?? MOCK_PROFILE;

  // ── Equipment-based exercise filtering ───────────────────────────────────
  const equipment = profile.preferences.equipmentAvailable;
  const hasYogaMat    = equipment.includes('yoga_mat');
  const hasDumbbells  = equipment.includes('dumbbells');
  const hasBands      = equipment.includes('resistance_bands');

  const GYM_BODYWEIGHT: ExerciseKey[] = ['squat', 'pushup', 'lunge', 'glute_bridge'];
  const GYM_DUMBBELL:   ExerciseKey[] = ['shoulder_press', 'bent_over_row', 'hip_thrust', 'deadlift'];
  const availableGym = [...GYM_BODYWEIGHT, ...(hasDumbbells ? GYM_DUMBBELL : [])] as ExerciseKey[];

  const PILATES_BODYWEIGHT: PilatesKey[] = ['plank_hold'];
  const availablePilates = hasYogaMat ? PILATES_POSES : PILATES_BODYWEIGHT;
  const availableYoga    = hasYogaMat ? YOGA_POSES   : ([] as YogaKey[]);

  // Resistance band physio exercises — shown but disabled (no pose tracking yet)
  const BAND_PHYSIO = hasBands ? ['monster_walk', 'clamshell'] : [];

  const location = useLocation();
  const [exercise, setExercise] = useState<SessionKey>(() => {
    const p = new URLSearchParams(location.search).get('exercise');
    return (p && (EXERCISES as string[]).includes(p) ? p : 'squat') as SessionKey;
  });
  const [holdTime, setHoldTime] = useState(0);
  const [holdComplete, setHoldComplete] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [bottomHoldSecs, setBottomHoldSecs] = useState(0);
  const [mode, setMode] = useState<SessionMode>('idle');
  const [repCount, setRepCount] = useState(0);
  const [repFlash, setRepFlash] = useState(false);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [inRange, setInRange] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('front');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({ state: 'ready', message: 'Ready — counting reps' });
  const [repRecords, setRepRecords] = useState<RepRecord[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [feedbackResult, setFeedbackResult] = useState<AgentResult<FeedbackResponse> | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'downloaded'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const repStateRef = useRef<'up' | 'down'>('up');
  const repCountRef = useRef(0);
  const repStartTimeRef = useRef(0);
  const repPeakAngleRef = useRef(999);
  const prevAngleRef = useRef<number | null>(null);
  const prevRoundedRef = useRef<number | null>(null);
  const angleWindowRef = useRef<number[]>([]);
  const proximityBlockedRef = useRef(false);
  const statusRef = useRef<StatusState>('ready');
  const viewModeRef = useRef<ViewMode>('front');
  const framesRef = useRef<PoseFrame[]>([]);
  const repRecordsRef = useRef<RepRecord[]>([]);
  const sessionStartRef = useRef(0);
  const exerciseRef = useRef<SessionKey>(exercise);
  exerciseRef.current = exercise;
  const holdMsRef = useRef(0);
  const prevHoldSecRef = useRef(-1);
  const wasHoldingRef = useRef(false);
  const holdCompleteRef = useRef(false);
  const consecTopFramesRef = useRef(0); // consecutive frames at/above repUpThreshold (mobile stability)
  const lastRepTimeRef = useRef(0);     // performance.now() of last counted rep (prevents double-count)
  const lastFrameTimeRef = useRef<number | null>(null);
  // Fix 1: startup dead zone
  const [countdown, setCountdown] = useState<number | null>(null);
  const deadZoneEndRef = useRef(0);
  const lastCountdownRef = useRef(-1);
  // Fix 3: hold time — track only time spent below down threshold
  const holdEndTimeRef = useRef(0);
  const bottomEnteredRef = useRef(0);
  const prevBottomSecRef = useRef(0);
  // Pilates
  const [plankScore, setPlankScore] = useState(0);
  const [plankSeconds, setPlankSeconds] = useState(0);
  const lastPlankSecRef = useRef(-1);
  const pilatesInvertStateRef = useRef<'up' | 'down'>('up');
  // FAQ modal
  const [showFaq, setShowFaq] = useState(false);
  // Distance guide overlay (shows from session start until person is in frame)
  const [showDistanceGuide, setShowDistanceGuide] = useState(false);
  const showDistanceGuideRef = useRef(false);
  const distanceGuideDismissedRef = useRef(false);
  // Lunge bilateral auto-detect
  const [lungeForwardSide, setLungeForwardSide] = useState<'left' | 'right' | null>(null);
  const lungeForwardSideRef = useRef<'left' | 'right' | null>(null);

  const stopLoop = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const updateStatus = useCallback((s: StatusState, msg: string) => {
    if (statusRef.current !== s) { statusRef.current = s; setSessionStatus({ state: s, message: msg }); }
  }, []);

  const updateViewMode = useCallback((vm: ViewMode) => {
    if (viewModeRef.current !== vm) { viewModeRef.current = vm; setViewMode(vm); }
  }, []);

  const processFrame = useCallback(() => {
    if (!activeRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current; const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame); return;
    }
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const result = landmarker.detectForVideo(video, performance.now());
      const lms = result.landmarks[0];
      const exerciseKey = exerciseRef.current;
      const yogaCfg = exerciseKey in YOGA_CONFIG ? YOGA_CONFIG[exerciseKey as YogaKey] : null;
      const pilateCfg = exerciseKey in PILATES_CONFIG ? PILATES_CONFIG[exerciseKey as PilatesKey] : null;
      const cfg = yogaCfg ?? pilateCfg ?? EXERCISE_CONFIG[exerciseKey as ExerciseKey];

      if (!lms || lms.length < 33) {
        updateStatus('warn_body', 'No body detected — step into frame');
        rafRef.current = requestAnimationFrame(processFrame); return;
      }

      // ── Fix 4: low-light / confidence check across key joints ────────────
      // Use the BETTER side's confidence, not the average of both.
      // Critical for lunge: back-leg ankle is frequently off-screen on phone
      // portrait mode, dragging avgConf < 0.55 and blocking every frame.
      const confR = cfg.joint.reduce((s, i) => s + (lms[i]?.visibility ?? 0), 0) / cfg.joint.length;
      const confL = cfg.jointLeft.reduce((s, i) => s + (lms[i]?.visibility ?? 0), 0) / cfg.jointLeft.length;
      const bestConf = Math.max(confR, confL);
      if (bestConf < 0.45) {
        updateStatus('warn_lighting', '⚠ Adjust position — move to brighter area or step back');
        drawSkeleton(ctx, lms, cfg.joint, false, prevAngleRef.current ?? 0);
        prevAngleRef.current = null;
        rafRef.current = requestAnimationFrame(processFrame); return;
      }

      // ── View mode: pick active side by joint visibility ──────────────────
      // Lunge uses 0.5 threshold (lower) because in portrait mode one leg is
      // always partially off-screen. Squat/pushup etc. keep 0.7 (stricter).
      const visThresh = exerciseKey === 'lunge' ? 0.5 : 0.7;
      const visR = cfg.joint.every(i => (lms[i]?.visibility ?? 0) >= visThresh);
      const visL = cfg.jointLeft.every(i => (lms[i]?.visibility ?? 0) >= visThresh);

      // ── Lunge camera-distance guidance ───────────────────────────────────
      if (exerciseKey === 'lunge') {
        const hipY  = Math.min(lms[23]?.y ?? 1, lms[24]?.y ?? 1);
        const ankleY = Math.max(lms[27]?.y ?? 0, lms[28]?.y ?? 0);
        const legSpan = ankleY - hipY; // normalised 0-1; needs ≥0.35 to see full leg
        if (legSpan < 0.30 && (lms[27]?.visibility ?? 0) < 0.4 && (lms[28]?.visibility ?? 0) < 0.4) {
          updateStatus('warn_body', 'Step back — need full legs in frame');
          drawSkeleton(ctx, lms, cfg.joint, false, prevAngleRef.current ?? 0);
          rafRef.current = requestAnimationFrame(processFrame); return;
        }
      }

      // ── Auto-dismiss distance guide when person is well positioned ────────
      if (showDistanceGuideRef.current) {
        const keyPts = [11, 12, 23, 24, 25, 26];
        if (keyPts.every(i => (lms[i]?.visibility ?? 0) > 0.6)) {
          showDistanceGuideRef.current = false; setShowDistanceGuide(false);
        }
      }

      let activeJoint: [number,number,number];
      let angle: number;
      let currentViewMode: ViewMode;

      if (visR && visL) {
        currentViewMode = 'front';
        activeJoint = cfg.joint;
        const [ai,bi,ci] = cfg.joint; const [al,bl,cl] = cfg.jointLeft;
        angle = (angleDeg(lms[ai]!, lms[bi]!, lms[ci]!) + angleDeg(lms[al]!, lms[bl]!, lms[cl]!)) / 2;
      } else if (visR) {
        currentViewMode = 'right';
        activeJoint = cfg.joint;
        const [ai,bi,ci] = cfg.joint;
        angle = angleDeg(lms[ai]!, lms[bi]!, lms[ci]!);
      } else if (visL) {
        currentViewMode = 'left';
        activeJoint = cfg.jointLeft;
        const [al,bl,cl] = cfg.jointLeft;
        angle = angleDeg(lms[al]!, lms[bl]!, lms[cl]!);
      } else {
        updateViewMode('lost');
        updateStatus('warn_body', 'Reposition — body not detected');
        drawSkeleton(ctx, lms, cfg.joint, false, prevAngleRef.current ?? 0);
        rafRef.current = requestAnimationFrame(processFrame); return;
      }

      // ── Lunge: auto-detect which leg is forward (smaller angle = more bent = front knee) ──
      if (exerciseKey === 'lunge' && visR && visL) {
        const [ai,bi,ci] = cfg.joint; const [al,bl,cl] = cfg.jointLeft;
        const angleR = angleDeg(lms[ai]!, lms[bi]!, lms[ci]!);
        const angleL = angleDeg(lms[al]!, lms[bl]!, lms[cl]!);
        if (angleR <= angleL) { activeJoint = cfg.joint; angle = angleR; currentViewMode = 'right'; }
        else { activeJoint = cfg.jointLeft; angle = angleL; currentViewMode = 'left'; }
        const ns = angleR <= angleL ? 'right' as const : 'left' as const;
        if (ns !== lungeForwardSideRef.current) { lungeForwardSideRef.current = ns; setLungeForwardSide(ns); }
      }

      updateViewMode(currentViewMode);

      // ── Proximity guard — front mode only (shoulder width collapses in side view) ─
      if (currentViewMode === 'front') {
        const shW = Math.abs((lms[12]?.x ?? 0) - (lms[11]?.x ?? 0));
        if (shW > 0.4) proximityBlockedRef.current = true;
        else if (shW < 0.35) proximityBlockedRef.current = false;
        if (proximityBlockedRef.current) {
          updateStatus('warn_proximity', 'Move further back from camera');
          drawSkeleton(ctx, lms, activeJoint, false, prevAngleRef.current ?? 0);
          rafRef.current = requestAnimationFrame(processFrame); return;
        }
      } else {
        proximityBlockedRef.current = false;
      }

      // ── Guard: velocity noise filter (>25° jump = noisy frame) ───────────
      const prev = prevAngleRef.current;
      if (prev !== null && Math.abs(angle - prev) > 25) {
        drawSkeleton(ctx, lms, activeJoint, prev >= cfg.targetRange[0] && prev <= cfg.targetRange[1], prev);
        rafRef.current = requestAnimationFrame(processFrame); return;
      }
      prevAngleRef.current = angle;

      const rounded = Math.round(angle);
      if (rounded !== prevRoundedRef.current) { prevRoundedRef.current = rounded; setLiveAngle(rounded); }
      const isInRange = angle >= cfg.targetRange[0] && angle <= cfg.targetRange[1];
      setInRange(isInRange);

      if (yogaCfg) {
        // ── Yoga: delta-accumulating hold timer ───────────────────────────────
        const now = performance.now();
        const delta = lastFrameTimeRef.current !== null ? now - lastFrameTimeRef.current : 16;
        lastFrameTimeRef.current = now;
        if (isInRange) {
          holdMsRef.current += delta;
          wasHoldingRef.current = true;
          const sec = Math.floor(holdMsRef.current / 1000);
          if (sec !== prevHoldSecRef.current || statusRef.current !== 'ready') {
            prevHoldSecRef.current = sec;
            setHoldTime(sec);
            const target = yogaCfg.holdTarget;
            const completed = sec >= target;
            statusRef.current = 'ready';
            setSessionStatus({ state: 'ready', message: completed ? `✓ ${target}s hold complete!` : `Hold ${sec} / ${target}s` });
            if (completed && !holdCompleteRef.current) {
              holdCompleteRef.current = true;
              setHoldComplete(true);
              speak(yogaCfg.completeCue, true);
            }
          }
        } else {
          if (wasHoldingRef.current) {
            wasHoldingRef.current = false;
            lastFrameTimeRef.current = null;
            speak(yogaCfg.voiceCue);
          }
          if (statusRef.current !== 'warn_body') {
            statusRef.current = 'warn_body';
            setSessionStatus({ state: 'warn_body', message: 'Adjust pose — outside target range' });
          }
        }
        drawSkeleton(ctx, lms, activeJoint, isInRange, angle);
        framesRef.current.push({ timestamp: now, landmarks: lms.map((lm, idx) => ({ name: LANDMARK_NAMES[idx] ?? `point_${idx}`, x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) as PoseLandmark[] });
        if (framesRef.current.length > 300) framesRef.current.shift();
      } else if (pilateCfg) {
        // ── Pilates: rhythmic rep counting (no hold requirement) ──────────────
        const now = performance.now();
        const smooth = prev === null || Math.abs(angle - prev) <= 15;

        if (pilateCfg.isPlank) {
          // Plank: alignment score per second
          const alignScore = Math.max(10, Math.round(100 - Math.abs(angle - 172.5) * 3));
          const plankSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
          if (plankSec !== lastPlankSecRef.current) {
            lastPlankSecRef.current = plankSec;
            setPlankScore(alignScore); setPlankSeconds(plankSec);
            repCountRef.current = plankSec; setRepCount(plankSec);
            const rec: RepRecord = { num: plankSec, angle: Math.round(angle), score: alignScore, duration: 1, flag: alignScore >= 80 ? 'good' : 'shallow' };
            repRecordsRef.current = [...repRecordsRef.current, rec]; setRepRecords([...repRecordsRef.current]);
          }
          updateStatus(isInRange ? 'ready' : 'warn_body',
            isInRange ? `Alignment ${alignScore}/100 — hold steady`
                       : angle < pilateCfg.targetRange[0] ? 'Hips piking — lower hips slightly' : 'Hips sagging — engage core');
        } else {
          // ── Dead zone ────────────────────────────────────────────────────────
          const remaining = deadZoneEndRef.current - Date.now();
          if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            const display = secs;
            if (display !== lastCountdownRef.current) {
              lastCountdownRef.current = display; setCountdown(display);
              updateStatus('ready', `Starting in ${secs}...`);
              playBeep(secs <= 3 ? 660 : 440, 0.1);
            }
            drawSkeleton(ctx, lms, activeJoint, isInRange, angle);
            framesRef.current.push({ timestamp: now, landmarks: lms.map((lm, idx) => ({ name: LANDMARK_NAMES[idx] ?? `point_${idx}`, x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) as PoseLandmark[] });
            if (framesRef.current.length > 300) framesRef.current.shift();
            rafRef.current = requestAnimationFrame(processFrame); return;
          }
          if (lastCountdownRef.current !== 0) { lastCountdownRef.current = 0; setCountdown(0); playBeep(880, 0.15, true); setTimeout(() => setCountdown(null), 1200); }

          const minMs = pilateCfg.minCycleMs;
          if (!pilateCfg.invertRep) {
            // Normal: angle goes LOW (in-position) then returns HIGH
            if (repStateRef.current === 'up' && angle < pilateCfg.repDownThreshold) {
              repStateRef.current = 'down'; repStartTimeRef.current = now; repPeakAngleRef.current = angle; holdEndTimeRef.current = 0;
            } else if (repStateRef.current === 'down') {
              repPeakAngleRef.current = Math.min(repPeakAngleRef.current, angle);
              if (angle > pilateCfg.repDownThreshold && holdEndTimeRef.current === 0) holdEndTimeRef.current = now;
              if (angle > pilateCfg.repUpThreshold) {
                repStateRef.current = 'up';
                const cycleMs = now - repStartTimeRef.current; holdEndTimeRef.current = 0;
                const score = computeFormScore(repPeakAngleRef.current, pilateCfg.targetRange);
                const flag: RepRecord['flag'] = (cycleMs < minMs || !smooth) ? 'too_fast' : repPeakAngleRef.current > pilateCfg.targetRange[1] ? 'shallow' : 'good';
                if (flag === 'too_fast') { updateStatus('warn_velocity', 'Too fast — slow to 2 seconds per rep'); const r = statusRef; setTimeout(() => { if (r.current === 'warn_velocity') updateStatus('ready', 'Ready — counting reps'); }, 2000);
                } else { repCountRef.current++; const rec: RepRecord = { num: repCountRef.current, angle: Math.round(repPeakAngleRef.current), score, duration: parseFloat((cycleMs/1000).toFixed(1)), flag }; repRecordsRef.current = [...repRecordsRef.current, rec]; setRepCount(repCountRef.current); setRepRecords([...repRecordsRef.current]); updateStatus('ready', 'Ready — counting reps'); }
              }
            } else { updateStatus('ready', 'Ready — counting reps'); }
          } else {
            // Inverted: angle goes HIGH (extended) then returns LOW (single_leg_stretch)
            if (pilatesInvertStateRef.current === 'up' && angle > pilateCfg.repDownThreshold) {
              pilatesInvertStateRef.current = 'down'; repStartTimeRef.current = now; repPeakAngleRef.current = angle; holdEndTimeRef.current = 0;
            } else if (pilatesInvertStateRef.current === 'down') {
              repPeakAngleRef.current = Math.max(repPeakAngleRef.current, angle);
              if (angle < pilateCfg.repDownThreshold && holdEndTimeRef.current === 0) holdEndTimeRef.current = now;
              if (angle < pilateCfg.repUpThreshold) {
                pilatesInvertStateRef.current = 'up';
                const cycleMs = now - repStartTimeRef.current; holdEndTimeRef.current = 0;
                const score = computeFormScore(repPeakAngleRef.current, pilateCfg.targetRange);
                const flag: RepRecord['flag'] = (cycleMs < minMs || !smooth) ? 'too_fast' : repPeakAngleRef.current < pilateCfg.targetRange[0] ? 'shallow' : 'good';
                if (flag === 'too_fast') { updateStatus('warn_velocity', 'Too fast — slow to 2 seconds per rep'); const r = statusRef; setTimeout(() => { if (r.current === 'warn_velocity') updateStatus('ready', 'Ready — counting reps'); }, 2000);
                } else { repCountRef.current++; const rec: RepRecord = { num: repCountRef.current, angle: Math.round(repPeakAngleRef.current), score, duration: parseFloat((cycleMs/1000).toFixed(1)), flag }; repRecordsRef.current = [...repRecordsRef.current, rec]; setRepCount(repCountRef.current); setRepRecords([...repRecordsRef.current]); updateStatus('ready', 'Ready — counting reps'); }
              }
            } else { updateStatus('ready', 'Ready — counting reps'); }
          }
        }
        drawSkeleton(ctx, lms, activeJoint, isInRange, angle);
        framesRef.current.push({ timestamp: now, landmarks: lms.map((lm, idx) => ({ name: LANDMARK_NAMES[idx] ?? `point_${idx}`, x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) as PoseLandmark[] });
        if (framesRef.current.length > 300) framesRef.current.shift();
      } else {
        // ── Guard: idle detection (300-frame window, <10° range) ─────────────
        angleWindowRef.current.push(angle);
        if (angleWindowRef.current.length > 300) angleWindowRef.current.shift();
        const isIdle = angleWindowRef.current.length >= 270 && angleRange(angleWindowRef.current) < 10;
        if (isIdle) {
          updateStatus('idle', 'Session paused — waiting for movement');
          drawSkeleton(ctx, lms, activeJoint, isInRange, angle);
          framesRef.current.push({ timestamp: performance.now(), landmarks: lms.map((lm, idx) => ({ name: LANDMARK_NAMES[idx] ?? `point_${idx}`, x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) as PoseLandmark[] });
          if (framesRef.current.length > 300) framesRef.current.shift();
          rafRef.current = requestAnimationFrame(processFrame); return;
        }
        // ── Fix 1: startup dead zone — no reps for first 8 seconds ──────────
        const now = performance.now();
        const remaining = deadZoneEndRef.current - Date.now();
        if (remaining > 0) {
          const secs = Math.ceil(remaining / 1000);
          const display = secs;
          if (display !== lastCountdownRef.current) {
            lastCountdownRef.current = display;
            setCountdown(display);
            updateStatus('ready', `Starting in ${secs}...`);
            playBeep(secs <= 3 ? 660 : 440, 0.1);
          }
          drawSkeleton(ctx, lms, activeJoint, isInRange, angle);
          framesRef.current.push({ timestamp: now, landmarks: lms.map((lm, idx) => ({ name: LANDMARK_NAMES[idx] ?? `point_${idx}`, x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) as PoseLandmark[] });
          if (framesRef.current.length > 300) framesRef.current.shift();
          rafRef.current = requestAnimationFrame(processFrame); return;
        }
        if (lastCountdownRef.current !== 0) {
          lastCountdownRef.current = 0; setCountdown(0);
          playBeep(880, 0.15, true); // double beep on GO!
          setTimeout(() => setCountdown(null), 1200);
        }

        // ── Rep counting: hysteresis + bottom-hold feedback ──────────────────
        const exCfg = EXERCISE_CONFIG[exerciseKey as ExerciseKey];
        // 15° hysteresis (was 6°) — wider band prevents premature ascent detection
        // at mobile 30fps where landmark jitter near the threshold is larger.
        const HYSTERESIS = 15;
        if (repStateRef.current === 'up' && angle < exCfg.repDownThreshold) {
          repStateRef.current = 'down'; repStartTimeRef.current = now;
          repPeakAngleRef.current = angle; holdEndTimeRef.current = 0;
          bottomEnteredRef.current = now; prevBottomSecRef.current = 0;
          consecTopFramesRef.current = 0;
          setIsAtBottom(true);
          updateStatus('ready', 'HOLD ↓ — rise slowly when ready');
        } else if (repStateRef.current === 'down') {
          repPeakAngleRef.current = Math.min(repPeakAngleRef.current, angle);
          // Update bottom hold seconds display (once per second)
          const bSec = Math.floor((now - bottomEnteredRef.current) / 1000);
          if (bSec !== prevBottomSecRef.current) { prevBottomSecRef.current = bSec; setBottomHoldSecs(bSec); }
          // Hysteresis: only mark hold-end when angle rises well above threshold
          if (angle > exCfg.repDownThreshold + HYSTERESIS && holdEndTimeRef.current === 0) {
            holdEndTimeRef.current = now;
          }
          if (angle > exCfg.repUpThreshold) {
            // 2 consecutive frames above repUpThreshold required (was 3 — too strict
            // for mobile where angle at standing often reads 155-158° due to lens
            // distortion, making 3 consecutive frames above 160° unreachable).
            consecTopFramesRef.current++;
            if (consecTopFramesRef.current >= 2) {
              // Guard: ignore if a rep was counted within the last 1000ms (debounce)
              if (now - lastRepTimeRef.current < 1000) {
                // still rising — just wait
              } else {
                // ── Explicit full reset before counting ───────────────────────
                consecTopFramesRef.current = 0;
                repStateRef.current = 'up';        // READY for next descent
                setIsAtBottom(false); setBottomHoldSecs(0);
                const holdMs = (holdEndTimeRef.current || now) - repStartTimeRef.current;
                const elapsed = holdMs / 1000;
                holdEndTimeRef.current = 0;        // reset hold-end marker
                repStartTimeRef.current = 0;       // reset rep start
                // Angle sanity — squat peak < 60° is camera noise, not a real rep
                const isSane = (exerciseKey !== 'squat' || repPeakAngleRef.current >= 60) &&
                               (exerciseKey !== 'lunge' || repPeakAngleRef.current >= 50);
                const score = computeFormScore(repPeakAngleRef.current, exCfg.targetRange);
                const flag: RepRecord['flag'] = !isSane ? 'invalid' : elapsed < 0.8 ? 'too_fast' : repPeakAngleRef.current > exCfg.targetRange[1] ? 'shallow' : 'good';
                if (flag === 'too_fast') {
                  updateStatus('warn_velocity', 'Too fast — slow down for reps to count');
                  const capturedRef = statusRef;
                  setTimeout(() => { if (capturedRef.current === 'warn_velocity') updateStatus('ready', 'Ready — go down for next rep'); }, 2000);
                } else if (flag === 'invalid') {
                  updateStatus('warn_body', 'Invalid rep — angle too extreme (camera noise?)');
                  const capturedRef = statusRef;
                  setTimeout(() => { if (capturedRef.current === 'warn_body') updateStatus('ready', 'Ready — go down for next rep'); }, 2000);
                } else {
                  repCountRef.current++;
                  lastRepTimeRef.current = now;    // stamp time for debounce
                  const rec: RepRecord = { num: repCountRef.current, angle: Math.round(repPeakAngleRef.current), score, duration: parseFloat(elapsed.toFixed(1)), flag };
                  repRecordsRef.current = [...repRecordsRef.current, rec];
                  setRepCount(repCountRef.current); setRepRecords([...repRecordsRef.current]);
                  setRepFlash(true); setTimeout(() => setRepFlash(false), 500);
                  updateStatus('ready', `Rep ${repCountRef.current} ✓ — go down for next`);
                  console.log('[Session] Rep counted, state reset to READY, total reps:', repCountRef.current);
                }
              }
            }
          } else {
            // Angle dropped back below upThreshold — reset consecutive counter
            consecTopFramesRef.current = 0;
          }
        } else {
          updateStatus('ready', 'Ready — go down to start');
        }
        drawSkeleton(ctx, lms, activeJoint, isInRange, angle);
        framesRef.current.push({ timestamp: now, landmarks: lms.map((lm, idx) => ({ name: LANDMARK_NAMES[idx] ?? `point_${idx}`, x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1 })) as PoseLandmark[] });
        if (framesRef.current.length > 300) framesRef.current.shift();
      }

    } catch { /* skip transient errors */ }
    rafRef.current = requestAnimationFrame(processFrame);
  }, [updateStatus, updateViewMode]);

  const startSession = useCallback(async () => {
    setMode('starting'); setError(null); setFeedbackResult(null);
    setRepCount(0); setLiveAngle(null); setInRange(false); setRepRecords([]); setSessionDuration(0); setViewMode('front');
    repCountRef.current = 0; repStateRef.current = 'up'; repStartTimeRef.current = 0; repPeakAngleRef.current = 999;
    prevAngleRef.current = null; prevRoundedRef.current = null;
    angleWindowRef.current = []; proximityBlockedRef.current = false;
    framesRef.current = []; repRecordsRef.current = [];
    holdMsRef.current = 0; prevHoldSecRef.current = -1; wasHoldingRef.current = false;
    holdCompleteRef.current = false; lastFrameTimeRef.current = null;
    setHoldTime(0); setHoldComplete(false);
    setIsAtBottom(false); setBottomHoldSecs(0); bottomEnteredRef.current = 0;
    const dzMs = exerciseRef.current === 'lunge' ? 10000 : 8000;
    deadZoneEndRef.current = Date.now() + dzMs; lastCountdownRef.current = -1; setCountdown(null);
    holdEndTimeRef.current = 0; consecTopFramesRef.current = 0; lastRepTimeRef.current = 0;
    lungeForwardSideRef.current = null; setLungeForwardSide(null);
    distanceGuideDismissedRef.current = false; showDistanceGuideRef.current = true; setShowDistanceGuide(true);
    setTimeout(() => { if (!distanceGuideDismissedRef.current) { showDistanceGuideRef.current = false; setShowDistanceGuide(false); } }, dzMs + 10000);
    setPlankScore(0); setPlankSeconds(0); lastPlankSecRef.current = -1; pilatesInvertStateRef.current = 'up';
    statusRef.current = 'ready'; viewModeRef.current = 'front';
    const isYoga = exerciseRef.current in YOGA_CONFIG;
    const isPilatesExercise = exerciseRef.current in PILATES_CONFIG;
    const isPlankExercise = isPilatesExercise && PILATES_CONFIG[exerciseRef.current as PilatesKey].isPlank;
    setSessionStatus({ state: 'ready', message: isYoga ? 'Hold pose to start timer' : isPlankExercise ? 'Get into plank position' : 'Ready — counting reps' });
    sessionStartRef.current = Date.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) { video.srcObject = stream; await video.play(); }
      if (!landmarkerRef.current) landmarkerRef.current = await loadLandmarker();
      activeRef.current = true; setMode('running');
      rafRef.current = requestAnimationFrame(processFrame);
    } catch (e) {
      setError(`Failed to start: ${String(e)}`); setMode('idle'); stopLoop();
    }
  }, [processFrame, stopLoop]);

  const stopSession = useCallback(async () => {
    setMode('stopping'); stopLoop(); setLiveAngle(null);
    setSessionDuration((Date.now() - sessionStartRef.current) / 1000);
    const frames = framesRef.current;
    if (frames.length === 0) { setMode('idle'); return; }
    setLoadingFeedback(true);
    try {
      const analysis = analyzeFrames(frames, exercise as ExerciseKey);
      const feedbackData = await generateFeedback(analysis, exercise as ExerciseKey, profile);
      setFeedbackResult({ success: true, data: feedbackData, metadata: { agentId: 'feedback-client', agentVersion: '1.0.0', processingMs: 0 } });
      // Persist to localStorage so Dashboard can show real metrics
      try {
        const durSec = (Date.now() - sessionStartRef.current) / 1000;
        const newSession = {
          id: `s-${Date.now()}`,
          exercise,
          date: new Date().toISOString(),
          reps: repCountRef.current,
          formScore: analysis.formScore,
          durationMin: Math.round(durSec / 60),
        };
        const existing = JSON.parse(localStorage.getItem('physiocore_sessions') ?? '[]') as unknown[];
        localStorage.setItem('physiocore_sessions', JSON.stringify([newSession, ...existing]));
      } catch { /* storage unavailable */ }
      // Save session summary to Supabase for AI memory
      void saveSessionSummary({
        date: new Date().toISOString(),
        exercise,
        reps: repCountRef.current,
        avg_score: analysis.formScore,
        top_deviation: feedbackData.formCorrections[0]?.issue ?? '',
        ai_feedback_summary: feedbackData.summary,
      });
    } catch (e) {
      setFeedbackResult({ success: false, error: { code: 'FEEDBACK_ERROR', message: String(e), retryable: true }, metadata: { agentId: 'feedback-client', agentVersion: '1.0.0', processingMs: 0 } });
    } finally { setLoadingFeedback(false); setMode('idle'); }
  }, [exercise, profile, stopLoop]);

  useEffect(() => () => { stopLoop(); landmarkerRef.current?.close(); }, [stopLoop]);

  const isRunning = mode === 'running';
  const isStarting = mode === 'starting';
  const angleColor = inRange ? '#22c55e' : '#ef4444';
  const yogaCfgUI = exercise in YOGA_CONFIG ? YOGA_CONFIG[exercise as YogaKey] : null;
  const pilateCfgUI = exercise in PILATES_CONFIG ? PILATES_CONFIG[exercise as PilatesKey] : null;
  const isYogaMode = yogaCfgUI !== null;
  const isPilatesMode = pilateCfgUI !== null;
  const isPlankMode = isPilatesMode && pilateCfgUI!.isPlank;
  const cfg = yogaCfgUI ?? pilateCfgUI ?? EXERCISE_CONFIG[exercise as ExerciseKey];
  const stUi = STATUS_UI[sessionStatus.state];
  const avgScore = repRecords.length > 0 ? Math.round(repRecords.reduce((s, r) => s + r.score, 0) / repRecords.length) : 0;
  const bestScore = repRecords.length > 0 ? Math.max(...repRecords.map(r => r.score)) : 0;
  const tension = repRecords.reduce((s, r) => s + r.duration, 0);
  const prescription = (!isYogaMode && !isPilatesMode) ? generatePrescription(exercise as ExerciseKey, repRecords) : [];
  const feedbackData = feedbackResult?.success ? feedbackResult.data : undefined;
  const vb = VIEW_BADGE[viewMode];

  const exportReport = async () => {
    setExportLoading(true);
    try {
      const firstName = ((userProfile?.name || profile?.name || 'User').split(' ')[0] || 'User').replace(/[^a-zA-Z0-9]/g, '') || 'User';
      const sessionNum = (JSON.parse(localStorage.getItem('physiocore_sessions') ?? '[]') as unknown[]).length;
      const dateStr = new Date().toISOString().split('T')[0] as string;
      const exerciseLabel = (exercise as string).replace(/_/g, '-');
      const filename = `${firstName}_${exerciseLabel}_${dateStr}_S${sessionNum}`;

      const fhirJson = JSON.stringify({
        resourceType: 'Bundle', type: 'collection',
        entry: repRecords.map(r => ({
          resource: {
            resourceType: 'Observation', status: 'final',
            code: { coding: [{ system: 'http://loinc.org', code: '72514-3', display: 'Physiotherapy session rep' }] },
            valueInteger: r.num,
            component: [
              { code: { text: 'Peak Angle' }, valueQuantity: { value: r.angle, unit: 'deg' } },
              { code: { text: 'Form Score' }, valueQuantity: { value: r.score } },
              { code: { text: 'Duration' },   valueQuantity: { value: r.duration, unit: 's' } },
              { code: { text: 'Flag' },       valueString: r.flag },
            ],
          },
        })),
      }, null, 2);

      const [{ pdf }, { SessionReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../components/SessionReportPDF.js'),
      ]);

      const blob = await pdf(
        <SessionReportPDF
          exercise={exercise as string}
          viewMode={viewMode}
          sessionNumber={sessionNum}
          userName={firstName}
          sessionDuration={sessionDuration}
          records={repRecords}
          feedback={feedbackData ? {
            summary: feedbackData.summary,
            formCorrections: feedbackData.formCorrections.map(c => ({ bodyPart: c.bodyPart, priority: c.priority, instruction: c.instruction })),
            motivationalMessage: feedbackData.motivationalMessage,
            nextSteps: feedbackData.nextSteps,
            safetyWarnings: feedbackData.safetyWarnings,
          } : null}
          prescription={(!isYogaMode && !isPilatesMode) ? (generatePrescription(exercise as ExerciseKey, repRecords) ?? []) : []}
          fhirJson={fhirJson}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}.pdf` });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExportStatus('downloaded');
      setTimeout(() => setExportStatus('idle'), 2500);
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generation failed: ' + String(err));
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 48px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.75rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Live Session</p>
        <h1 className="font-display" style={{ fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 0 }}>Exercise Session</h1>
      </div>

      {mode === 'idle' && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={exercise} onChange={(e) => { setExercise(e.target.value as SessionKey); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '0.85rem', minWidth: '260px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Figtree', sans-serif" }}>
              <optgroup label="Exercises">
                {availableGym.map((ex) => <option key={ex} value={ex}>{ex.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </optgroup>
              {availableYoga.length > 0 && (
                <optgroup label="Yoga">
                  {availableYoga.map((key) => <option key={key} value={key}>{YOGA_CONFIG[key].englishName} — {YOGA_CONFIG[key].sanskritName}</option>)}
                </optgroup>
              )}
              <optgroup label={hasYogaMat ? 'Pilates' : 'Pilates (add Yoga Mat to unlock more)'}>
                {availablePilates.map((key) => {
                  const pc = PILATES_CONFIG[key];
                  const name = key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
                  return <option key={key} value={key}>{name} — {pc.targetLabel}</option>;
                })}
              </optgroup>
              {BAND_PHYSIO.length > 0 && (
                <optgroup label="Resistance Band (tracking coming soon)">
                  {BAND_PHYSIO.map((key) => {
                    const meta = EXERCISE_LIBRARY[key];
                    return <option key={key} value={key} disabled>{meta?.displayName ?? key}</option>;
                  })}
                </optgroup>
              )}
              <optgroup label="Physiotherapy (prescription only)">
                {EXERCISE_KEYS_BY_CATEGORY.physiotherapy
                  .filter(k => !BAND_PHYSIO.includes(k))
                  .map((key) => {
                    const meta = EXERCISE_LIBRARY[key]!;
                    return <option key={key} value={key} disabled>{meta.displayName}</option>;
                  })}
              </optgroup>
            </select>
            <button onClick={() => { void startSession(); }} className="btn-primary">
              Start Session
            </button>
            <button
              type="button"
              onClick={() => setShowFaq(true)}
              title="Session help"
              style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >?</button>
          </div>
          {exercise === 'lunge' && (
            <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(0,212,170,0.07)', border: '1px solid var(--border-teal)', fontSize: '0.82rem', color: 'var(--teal-500)', lineHeight: 1.5 }}>
              <strong>Lunge tip:</strong> Stand 2–3 m from camera so your full body is visible. Step one foot forward — the app auto-detects your front knee. Alternate sides each set.
            </div>
          )}
        </div>
      )}

      {isStarting && <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontFamily: "'Space Mono', monospace", fontSize: '0.8rem' }}>Requesting camera and loading MediaPipe model (~5 MB)…</p>}
      {error && <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>}

      {(isRunning || isStarting || mode === 'stopping') && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 480px', maxWidth: '640px', borderRadius: '12px', overflow: 'hidden', transform: 'scaleX(-1)', background: '#0f172a' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ display: 'block', width: '100%', borderRadius: '12px' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
            {countdown !== null && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', transform: 'scaleX(-1)' }}>
                <div style={{ textAlign: 'center' as const }}>
                  <div style={{
                    fontSize: countdown === 0 ? '3.5rem' : '6rem', fontWeight: 600, lineHeight: 1,
                    color: countdown === 0 ? 'var(--teal-500)' : countdown <= 3 ? '#22c55e' : '#f59e0b',
                    textShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'color 0.2s, font-size 0.15s',
                  }}>
                    {countdown === 0 ? 'GO!' : countdown}
                  </div>
                  {(countdown ?? 0) > 0 && (
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 10, color: countdown <= 3 ? '#86efac' : '#fcd34d' }}>
                      {countdown <= 3 ? 'Almost ready…' : 'Get into position'}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Distance guide overlay — shows until person is in frame or tapped */}
            {showDistanceGuide && (
              <div
                onClick={() => { distanceGuideDismissedRef.current = true; showDistanceGuideRef.current = false; setShowDistanceGuide(false); }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transform: 'scaleX(-1)', zIndex: 5 }}
              >
                <div style={{ fontSize: '2.4rem' }}>📱 ↔ 🧍</div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '1.05rem', textAlign: 'center' as const }}>Stand 2–3 metres away</div>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', textAlign: 'center' as const, maxWidth: 220, lineHeight: 1.5 }}>Full body (head to ankles) must be visible. Tap to dismiss.</div>
              </div>
            )}

            {isRunning && (
              <>
                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%) scaleX(-1)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '7px', background: stUi.bg, border: `1px solid ${stUi.border}`, borderRadius: '99px', padding: '5px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: stUi.dot, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: stUi.color }}>{sessionStatus.message}</span>
                </div>
                {isYogaMode && yogaCfgUI && (
                  <div style={{ position: 'absolute', top: 46, left: '50%', transform: 'translateX(-50%) scaleX(-1)', whiteSpace: 'nowrap', background: 'rgba(109,40,217,0.82)', color: '#f3e8ff', borderRadius: '99px', padding: '3px 14px', fontSize: '0.75rem', fontStyle: 'italic', fontWeight: 500 }}>
                    {yogaCfgUI.sanskritName}
                  </div>
                )}
                {isPilatesMode && pilateCfgUI && (
                  <div style={{ position: 'absolute', top: 46, left: '50%', transform: 'translateX(-50%) scaleX(-1)', whiteSpace: 'nowrap', background: 'rgba(219,39,119,0.85)', color: '#fdf2f8', borderRadius: '99px', padding: '3px 14px', fontSize: '0.75rem', fontWeight: 600 }}>
                    Pilates · {pilateCfgUI.targetLabel}
                  </div>
                )}
                {/* Lunge: forward-leg side indicator */}
                {exercise === 'lunge' && lungeForwardSide && (
                  <div style={{ position: 'absolute', top: 46, right: 10, transform: 'scaleX(-1)', background: 'rgba(0,212,170,0.88)', color: '#000', borderRadius: '99px', padding: '3px 12px', fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>
                    {lungeForwardSide === 'right' ? '→ Right' : '← Left'}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%) scaleX(-1)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', background: vb.bg, border: `1px solid ${vb.border}`, borderRadius: '99px', padding: '4px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: vb.dot, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: vb.color }}>{vb.label}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ flex: '0 0 188px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isYogaMode ? (
              <div className="metric-card" style={{ border: `1px solid ${holdComplete ? 'var(--success)' : 'rgba(167,139,250,0.3)'}`, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px', fontFamily: "'Space Mono', monospace" }}>Hold Time</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '3rem', fontWeight: 600, lineHeight: 1, color: holdComplete ? 'var(--success)' : '#a78bfa' }}>{holdTime}s</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Target {yogaCfgUI?.holdTarget ?? 30}s</div>
                <div style={{ marginTop: '10px', height: 4, background: 'var(--bg-overlay)', borderRadius: 2 }}>
                  <div style={{ width: `${Math.min(100, (holdTime / (yogaCfgUI?.holdTarget ?? 30)) * 100)}%`, height: '100%', background: holdComplete ? 'var(--success)' : '#7c3aed', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                {holdComplete && <div style={{ marginTop: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', fontFamily: "'Space Mono', monospace" }}>COMPLETE</div>}
              </div>
            ) : isPlankMode ? (
              <div className="metric-card" style={{ border: `1px solid ${plankScore >= 80 ? 'rgba(0,230,118,0.3)' : plankScore >= 60 ? 'rgba(255,184,48,0.3)' : 'rgba(255,68,68,0.3)'}`, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px', fontFamily: "'Space Mono', monospace" }}>Alignment</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '3rem', fontWeight: 600, lineHeight: 1, color: plankScore >= 80 ? 'var(--success)' : plankScore >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{plankScore}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>/100 · {plankSeconds}s held</div>
                <div style={{ marginTop: '10px', height: 4, background: 'var(--bg-overlay)', borderRadius: 2 }}>
                  <div style={{ width: `${plankScore}%`, height: '100%', background: plankScore >= 80 ? 'var(--success)' : plankScore >= 60 ? 'var(--warning)' : 'var(--danger)', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
              </div>
            ) : isPilatesMode && pilateCfgUI ? (
              <div className="metric-card" style={{ border: '1px solid rgba(244,114,182,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px', fontFamily: "'Space Mono', monospace" }}>Reps</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '4rem', fontWeight: 600, lineHeight: 1, color: '#f472b6' }}>{repCount}</div>
                <div style={{ fontSize: '0.75rem', color: '#f472b6', marginTop: '4px' }}>Target: {pilateCfgUI.targetLabel}</div>
              </div>
            ) : (
              <div className="metric-card" style={{
                textAlign: 'center',
                border: repFlash ? '2px solid #22c55e' : isAtBottom ? '1px solid var(--teal-500)' : '1px solid var(--border-subtle)',
                boxShadow: repFlash ? '0 0 32px rgba(34,197,94,0.45)' : isAtBottom ? '0 0 24px rgba(0,212,170,0.12)' : 'none',
                background: repFlash ? 'rgba(34,197,94,0.08)' : 'var(--bg-elevated)',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px', fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' as const, color: repFlash ? '#22c55e' : isAtBottom ? 'var(--teal-500)' : 'var(--text-tertiary)', transition: 'color 0.15s' }}>
                  {repFlash ? '✓ REP!' : isAtBottom ? 'HOLDING' : 'REPS'}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '4rem', fontWeight: 600, lineHeight: 1, color: repFlash ? '#22c55e' : isAtBottom ? 'var(--teal-500)' : 'var(--text-primary)', transition: 'color 0.15s' }}>
                  {repCount}
                </div>
                {repFlash ? (
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#22c55e', fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>
                    ✓ Counted!
                  </div>
                ) : isAtBottom ? (
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace" }}>
                    {bottomHoldSecs}s ↑ rise to count
                  </div>
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Go down to start
                  </div>
                )}
              </div>
            )}
            <div className="metric-card" style={{ border: `1px solid ${inRange ? 'rgba(0,230,118,0.3)' : 'rgba(255,68,68,0.3)'}`, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px', fontFamily: "'Space Mono', monospace" }}>{cfg.label}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '2.5rem', fontWeight: 600, lineHeight: 1, color: inRange ? 'var(--success)' : 'var(--danger)' }}>{liveAngle !== null ? `${liveAngle}°` : '—'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '5px' }}>Target {cfg.targetRange[0]}°–{cfg.targetRange[1]}°</div>
              <div style={{ marginTop: '8px', padding: '3px 8px', borderRadius: '4px', background: inRange ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)', color: inRange ? 'var(--success)' : 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>
                {liveAngle === null ? 'DETECTING' : inRange ? 'IN RANGE ✓' : 'ADJUST'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {isYogaMode ? yogaCfgUI!.englishName : exercise.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              {isYogaMode && <div style={{ fontSize: '0.75rem', color: '#a78bfa', fontStyle: 'italic', marginTop: '2px', fontFamily: "'Noto Serif', serif" }}>{yogaCfgUI!.sanskritName}</div>}
              {isPilatesMode && pilateCfgUI && !isPlankMode && <div style={{ fontSize: '0.75rem', color: '#f472b6', fontWeight: 600, marginTop: '2px' }}>Target: {pilateCfgUI.targetLabel}</div>}
              {isPlankMode && <div style={{ fontSize: '0.75rem', color: '#f472b6', fontWeight: 600, marginTop: '2px' }}>Alignment scored/sec</div>}
            </div>
            {isRunning && (
              <button onClick={() => { void stopSession(); }} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,68,68,0.12)', color: 'var(--danger)', border: '1px solid rgba(255,68,68,0.3)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                Stop Session
              </button>
            )}
          </div>
        </div>
      )}

      {(feedbackResult !== null || loadingFeedback) && (
        <div style={{ marginTop: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap' as const, gap: '12px' }}>
            <div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.75rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Session Complete</p>
              <h2 className="font-display" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Session Report</h2>
            </div>
            {repRecords.length > 0 && (
              <button
                onClick={() => { void exportReport(); }}
                disabled={exportLoading}
                className="btn-ghost"
                style={{ fontSize: '0.82rem', opacity: exportLoading ? 0.6 : 1 }}
              >
                {exportLoading ? 'Generating PDF…' : exportStatus === 'downloaded' ? '✓ PDF Downloaded' : 'Export for Physiotherapist ↓'}
              </button>
            )}
          </div>

          {repRecords.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {([
                ['Total Reps', String(repRecords.length)],
                ['Avg Score', `${avgScore}/100`],
                ['Best Score', `${bestScore}/100`],
                ['Time Under Tension', `${tension.toFixed(0)}s`],
                ['Duration', fmtDur(sessionDuration)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="metric-card" style={{ textAlign: 'center' as const }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.4rem', fontWeight: 600, color: 'var(--teal-500)', lineHeight: 1, marginBottom: 6 }}>{value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <AgentStatusCard<FeedbackResponse>
            title={`AI Feedback — ${exercise.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())} · ${repCount} rep${repCount !== 1 ? 's' : ''}`}
            result={feedbackResult ?? undefined}
            isLoading={loadingFeedback}
            renderData={(data) => (
              <div>
                <p style={{ fontSize: '0.88rem', marginBottom: '14px', lineHeight: 1.7, color: 'var(--text-primary)' }}>{data.summary}</p>
                {data.safetyWarnings.length > 0 && (
                  <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: 'var(--danger)', fontWeight: 500, fontSize: '0.82rem' }}>
                    <strong>Safety warnings:</strong>
                    <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>{data.safetyWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                )}
                {data.formCorrections.map((c, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.84rem' }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, fontSize: '0.72rem', color: priorityColor(c.priority) }}>[{c.priority.toUpperCase()}]</span>{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{c.bodyPart.replace(/_/g,' ')}</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{' — '}{c.instruction}</span>
                  </div>
                ))}
                <p style={{ marginTop: '14px', fontStyle: 'italic', color: 'var(--teal-500)', fontSize: '0.88rem' }}>{data.motivationalMessage}</p>
                {data.nextSteps.length > 0 && <ul style={{ marginTop: '10px', paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{data.nextSteps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}</ul>}
              </div>
            )}
          />

          {repRecords.length > 0 && (
            <div style={{ marginTop: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontSize: '0.75rem' }}>Rep by Rep Breakdown</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Rep', 'Angle', 'Score', 'Time', 'Quality'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: "'Space Mono', monospace", letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repRecords.map((r, i) => (
                    <tr key={r.num} style={{ borderTop: '1px solid var(--border-subtle)', background: 'transparent' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, fontFamily: "'Space Mono', monospace", fontSize: '0.78rem' }}>Rep {r.num}</td>
                      <td style={{ padding: '9px 14px', fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)' }}>{r.angle}°</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, color: r.score >= 80 ? 'var(--success)' : r.score >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{r.score}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>/100</span>
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)' }}>{r.duration}s</td>
                      <td style={{ padding: '9px 14px', color: r.flag === 'good' ? 'var(--success)' : 'var(--warning)', fontSize: '0.78rem' }}>{r.flag === 'good' ? '✓ Good' : r.flag === 'too_fast' ? '⚠ Too fast' : '⚠ Shallow'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {repRecords.length > 0 && (
            <div style={{ marginTop: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.75rem', fontFamily: "'Space Mono', monospace", color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Next Session Prescription</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Exercise', 'Sets × Reps', 'Focus'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: "'Space Mono', monospace", letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prescription.map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--teal-500)' }}>{p.name}</td>
                      <td style={{ padding: '9px 14px', fontFamily: "'Space Mono', monospace", fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.sets}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{p.focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={() => { setFeedbackResult(null); setRepCount(0); setRepRecords([]); }} className="btn-ghost" style={{ marginTop: '16px', fontSize: '0.85rem' }}>
            New Session
          </button>
        </div>
      )}

      {/* ── FAQ modal ────────────────────────────────────────────────────────── */}
      {showFaq && (
        <div
          onClick={() => setShowFaq(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto' as const, padding: '28px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Session Guide</h2>
              <button type="button" onClick={() => setShowFaq(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
            </div>
            {[
              { title: '📐 Setup', body: 'Stand 2–3 metres from camera on a flat floor. Ensure your full body (head to ankles) is visible. Good lighting helps — face a window if possible.' },
              { title: '🔁 Counting Reps', body: 'The app counts a rep when you complete a full movement. For squats/lunges: descend until the angle drops below threshold, then rise fully. A green flash confirms the rep was counted.' },
              { title: '👁 View Modes', body: 'The app automatically detects front view or side view. For lunges it auto-detects which leg is forward and shows "→ Right" or "← Left" on screen.' },
              { title: '💪 Exercise Tips', body: 'Squat: feet shoulder-width, knees track over toes. Deadlift: hip-hinge movement (shoulder–hip–knee angle), keep back neutral. Lunge: front knee over ankle, back knee low. Push-up: elbows close to body.' },
              { title: '📄 Your Report', body: 'After stopping a session, AI analyses your form. Each rep is scored 0–100. The PDF export includes rep-by-rep data in FHIR R4 format for your physiotherapist.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--teal-500)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{body}</div>
              </div>
            ))}
            <button type="button" onClick={() => setShowFaq(false)} className="btn-ghost" style={{ marginTop: 8, fontSize: '0.85rem', width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      <AiChatPanel
        pageContext={`Current page: Exercise Session. Exercise: ${exercise.replace(/_/g, ' ')}. Reps completed: ${repCount}. ${repRecords.length > 0 ? `Avg form score: ${Math.round(repRecords.reduce((s, r) => s + r.score, 0) / repRecords.length)}/100. Rep records: ${repRecords.map(r => `rep${r.num}:${r.score}/100,${r.flag}`).join('; ')}.` : ''} ${feedbackResult?.data ? `AI feedback summary: ${feedbackResult.data.summary}. Deviations: ${feedbackResult.data.formCorrections.map(c => `${c.bodyPart}(${c.priority}):${c.issue}`).join('; ')}.` : ''}`}
        quickPrompts={[
          'I feel knee pain during this exercise — is that normal?',
          'What does a form score of 65 mean?',
          'How do I improve my score to above 80?',
          'What does the angle reading represent clinically?',
          'Can I modify this exercise for my injury?',
        ]}
      />
    </div>
  );
}
