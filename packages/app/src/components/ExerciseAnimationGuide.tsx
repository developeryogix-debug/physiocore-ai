// ExerciseAnimationGuide.tsx — Kaia-style live exercise animation guide
// Phase 2.5 F5. Constitutional: no "use client", font-weight ≤600.
// 25fps animation, ghost trail, voice cues, rep/set/exercise completion callbacks.

import { useEffect, useRef, useState, useCallback } from 'react';
import { StickFigure } from './exercise/StickFigure.js';
import { TrackingBox } from './exercise/TrackingBox.js';
import { RepDots } from './exercise/RepDots.js';
import {
  POSES,
  EXERCISE_CONFIG,
  lerpPose,
  STAND,
  type ExerciseKey,
  type StickPose,
} from '../lib/exercisePoses.js';
import { speak } from '../lib/voiceGuide.js';

interface ExerciseAnimationGuideProps {
  exercise: string;
  repCount: number;           // from Session.tsx — source of truth for completed reps
  poseConfidence: number;     // 0-1 (0.3 = lowConf, 0.9 = good)
  formOk: boolean;            // inRange from Session.tsx
  onRepComplete?: (repIndex: number, quality: number) => void;
  onSetComplete?: (setIndex: number) => void;
  onExerciseComplete?: () => void;
}

const VIEWBOX = '0 0 80 160';
const SVG_W = 160;
const SVG_H = 320;
const FPS_INTERVAL = 40; // 25fps

// easeInOut cosine
function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI);
}

export function ExerciseAnimationGuide({
  exercise,
  repCount,
  poseConfidence,
  formOk,
  onRepComplete,
  onSetComplete,
  onExerciseComplete,
}: ExerciseAnimationGuideProps) {
  const key = exercise as ExerciseKey;
  const poseEntry = POSES[key];
  const cfg = EXERCISE_CONFIG[key];

  // Animation state
  const [currentPose, setCurrentPose] = useState<StickPose>(poseEntry?.stand ?? STAND);
  const [ghostPose, setGhostPose]     = useState<StickPose>(poseEntry?.stand ?? STAND);
  const [flash, setFlash]             = useState(false);
  const [repQualities, setRepQualities] = useState<number[]>([]);
  const [internalSet, setInternalSet] = useState(0);

  // Track last rep count so we detect increments from Session.tsx
  const prevRepCountRef = useRef(repCount);
  const frameRef        = useRef(0);      // 0..1 phase within one rep cycle
  const lastVoiceRef    = useRef(0);      // timestamp of last voice cue
  const prevPoseRef     = useRef<StickPose>(poseEntry?.stand ?? STAND);
  const isMountedRef    = useRef(true);

  // Throttled voice cue — max once per 8s
  const voiceCue = useCallback((text: string) => {
    const now = Date.now();
    if (now - lastVoiceRef.current < 8000) return;
    lastVoiceRef.current = now;
    speak(text, { rate: 0.9, pitch: 1.0, volume: 0.8 });
  }, []);

  // Detect new rep from Session.tsx
  useEffect(() => {
    if (repCount <= prevRepCountRef.current) return;
    prevRepCountRef.current = repCount;

    const quality = formOk ? (poseConfidence >= 0.7 ? 88 : 72) : 48;
    const repIndex = repCount - 1;
    setRepQualities(q => [...q, quality]);
    if (onRepComplete) onRepComplete(repIndex, quality);

    // Flash tracking box on rep complete
    setFlash(true);
    setTimeout(() => { if (isMountedRef.current) setFlash(false); }, 300);

    // Set completion
    if (cfg && repCount > 0 && repCount % cfg.reps === 0) {
      const setIdx = Math.floor(repCount / cfg.reps) - 1;
      setInternalSet(s => s + 1);
      if (onSetComplete) onSetComplete(setIdx);
      if (cfg.sets > 0 && setIdx + 1 >= cfg.sets) {
        if (onExerciseComplete) onExerciseComplete();
      }
    }
  }, [repCount, formOk, poseConfidence, cfg, onRepComplete, onSetComplete, onExerciseComplete]);

  // Form cue voice
  useEffect(() => {
    if (!formOk && poseConfidence > 0.5 && cfg?.formCues.length) {
      const cue = cfg.formCues[Math.floor(Math.random() * cfg.formCues.length)];
      if (cue) voiceCue(cue);
    }
  }, [formOk, poseConfidence, cfg, voiceCue]);

  // Animation loop — 25fps
  useEffect(() => {
    isMountedRef.current = true;
    if (!poseEntry || !cfg) return;

    const { stand, peak } = poseEntry;
    const repMs = cfg.repMs;

    let lastTime = performance.now();
    const iv = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      frameRef.current = (frameRef.current + delta / repMs) % 1;
      const t = frameRef.current;

      // 0→holdRatio: ascend to peak, holdRatio→1: descend back to stand
      const holdEnd = cfg.holdRatio;
      let alpha: number;
      if (t < holdEnd) {
        // ascend
        alpha = easeInOut(t / holdEnd);
      } else {
        // descend
        alpha = easeInOut(1 - (t - holdEnd) / (1 - holdEnd));
      }

      const next = lerpPose(stand, peak, alpha);
      const ghost = lerpPose(stand, peak, Math.max(0, alpha - 0.15));

      prevPoseRef.current = next;
      if (isMountedRef.current) {
        setCurrentPose(next);
        setGhostPose(ghost);
      }
    }, FPS_INTERVAL);

    return () => {
      clearInterval(iv);
      isMountedRef.current = false;
    };
  }, [poseEntry, cfg]);

  // Not a supported exercise
  if (!poseEntry || !cfg) return null;

  const totalReps = cfg.reps;
  const completedReps = repCount % cfg.reps;
  const currentRepIdx = completedReps;
  const currentSet = internalSet;

  const lowConf = poseConfidence < 0.5;
  const badgeText = lowConf ? 'DETECTING' : formOk ? 'IN RANGE' : 'ADJUST FORM';
  const badgeColor = lowConf ? '#94a3b8' : formOk ? '#00D4AA' : '#f97316';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      userSelect: 'none',
    }}>
      {/* SVG figure */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={VIEWBOX}
          width={SVG_W}
          height={SVG_H}
          style={{ display: 'block', background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}
        >
          {/* Ghost trail */}
          <StickFigure
            pose={ghostPose}
            color="#00D4AA"
            opacity={0.15}
            strokeWidth={1.8}
          />

          {/* Primary animated figure */}
          <StickFigure
            pose={currentPose}
            color={formOk ? '#00D4AA' : '#f97316'}
            opacity={lowConf ? 0.45 : 1}
            strokeWidth={2.2}
          />

          {/* Tracking box around primary joints */}
          <TrackingBox
            pose={currentPose}
            primaryJoints={cfg.primaryJoints}
            formOk={formOk}
            flash={flash}
          />
        </svg>

        {/* Floor label for supine exercises */}
        {cfg.isFloor && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)',
            fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
          }}>
            FLOOR VIEW
          </div>
        )}
      </div>

      {/* Form badge */}
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: '0.62rem', letterSpacing: '0.12em',
        color: badgeColor, textTransform: 'uppercase' as const,
      }}>
        {badgeText}
      </div>

      {/* Set counter */}
      <div style={{
        fontSize: '0.75rem', color: 'var(--text-secondary)',
        fontFamily: "'Space Mono', monospace",
      }}>
        Set {currentSet + 1} / {cfg.sets}
      </div>

      {/* Rep dots */}
      <RepDots
        totalReps={totalReps}
        completedReps={completedReps}
        qualities={repQualities}
        currentRep={currentRepIdx}
      />

      {/* Exercise name */}
      <div style={{
        fontSize: '0.7rem', color: 'var(--text-tertiary)',
        fontFamily: "'Figtree', sans-serif", fontWeight: 500,
        textAlign: 'center' as const,
      }}>
        {cfg.name}
      </div>
    </div>
  );
}
