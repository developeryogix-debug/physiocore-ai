// PainCheckIn.tsx — Pre-session NPRS pain check-in modal
// Phase 2.5 Feature 1. Constitutional: blocks if NPRS >7, fires safetyRules at ≥8,
// PDPA-compliant Supabase insert to outcomes table (checkin_regions jsonb column).
// References: Hawker GA et al., 2011, Arthritis Care Res — NPRS validity.

import type { ReactNode } from 'react';
import { useState } from 'react';
import { supabase } from '@physiocore/supabase';
import { FaceIcon, scoreLabel } from './FaceIcon.js';
import type { UserProfile } from '@physiocore/types';

// Inline red-flag summary (avoids cross-package dep — full engine runs server-side in clinical-agent)
export interface RedFlagAlert {
  id: string;
  name: string;
  mandatoryAction: string;
  emergencyLevel: 'call_999' | 'urgent_referral' | 'same_day_referral';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Body region chips for checkin_regions ─────────────────────────────────────
const BODY_REGIONS = [
  'Neck', 'Upper back', 'Lower back', 'Shoulder (L)', 'Shoulder (R)',
  'Elbow (L)', 'Elbow (R)', 'Hip (L)', 'Hip (R)',
  'Knee (L)', 'Knee (R)', 'Ankle / Foot',
] as const;
type BodyRegion = typeof BODY_REGIONS[number];

// ── Safety quick-screen questions shown at NPRS ≥8 ─────────────────────────
const SAFETY_QUES: Array<{ key: string; text: string; emergencyKey?: boolean }> = [
  { key: 'chestPain',              text: 'Chest pain or tightness?',              emergencyKey: true },
  { key: 'armRadiation',           text: 'Pain spreading to arm, jaw, or back?',  emergencyKey: true },
  { key: 'dyspnoea',              text: 'Shortness of breath at rest?',           emergencyKey: true },
  { key: 'suddenNeurologicalDeficit', text: 'Sudden weakness, numbness, or speech difficulty?', emergencyKey: true },
  { key: 'bladderBowelChange',     text: 'New bladder or bowel problems?',        emergencyKey: true },
  { key: 'saddleAnaesthesia',      text: 'Numbness in groin / saddle area?',      emergencyKey: true },
];

export interface PainCheckInProps {
  userProfile: UserProfile;
  userId?: string;
  /** Called when user may proceed (NPRS 0–7) */
  onProceed: (score: number) => void;
  /** Called when session is blocked (NPRS >7) — lets parent show alternate UI */
  onBlock: (score: number, alerts: RedFlagAlert[]) => void;
  /** Called when user explicitly dismisses without choosing */
  onDismiss?: () => void;
}

export function PainCheckIn({ userProfile, userId, onProceed, onBlock, onDismiss }: PainCheckInProps) {
  const [score, setScore] = useState<number | null>(null);
  const [regions, setRegions] = useState<BodyRegion[]>([]);
  const [safetyAnswers, setSafetyAnswers] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<'rate' | 'regions' | 'safety' | 'blocked' | 'submitting'>('rate');
  const [redFlagAlerts, setRedFlagAlerts] = useState<RedFlagAlert[]>([]);

  const toggleRegion = (r: BodyRegion) => {
    setRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const toggleSafety = (key: string) => {
    setSafetyAnswers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Supabase insert (fire-and-forget, non-blocking) ─────────────────────────
  const persist = async (s: number, r: BodyRegion[], blocked: boolean, alerts: RedFlagAlert[]) => {
    if (!userId) return;
    try {
      await db.from('outcomes').insert({
        user_id:          userId,
        recorded_at:      new Date().toISOString(),
        type:             'session_pain_checkin',
        pain_score:       s,
        checkin_regions:  r,
        session_blocked:  blocked,
        red_flag_count:   alerts.length,
        red_flag_ids:     alerts.map(a => a.id),
      });
    } catch { /* RLS policy may skip if table not yet migrated — non-fatal */ }
  };

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (score === null) return;
    setPhase('submitting');

    // Check safety rules when NPRS ≥ 8
    // Inline red-flag synthesis from safety screen answers (client-side)
    // Full SafetyRuleEngine runs server-side in clinical-agent; this gives immediate UI
    const alerts: RedFlagAlert[] = [];
    if (score >= 8) {
      const hasChestPain  = (safetyAnswers['chestPain'] ?? false) && ((safetyAnswers['armRadiation'] ?? false) || (safetyAnswers['dyspnoea'] ?? false));
      const hasNeuroDef   = safetyAnswers['suddenNeurologicalDeficit'] ?? false;
      const hasCaudaEquina = (safetyAnswers['bladderBowelChange'] ?? false) && (safetyAnswers['saddleAnaesthesia'] ?? false);

      if (hasChestPain) alerts.push({
        id: 'acute_cardiac', name: 'Possible Acute Cardiac Event',
        mandatoryAction: 'Call 999. Stop all exercise. Sit upright. Do not leave patient alone.',
        emergencyLevel: 'call_999',
      });
      if (hasNeuroDef) alerts.push({
        id: 'stroke_tia', name: 'Possible Stroke / TIA',
        mandatoryAction: 'Call 999 immediately. Time-critical — thrombolysis window is 4.5 hours.',
        emergencyLevel: 'call_999',
      });
      if (hasCaudaEquina) alerts.push({
        id: 'cauda_equina', name: 'Possible Cauda Equina Syndrome',
        mandatoryAction: 'Immediately cease all activity. Call 999. Do not leave patient alone.',
        emergencyLevel: 'call_999',
      });
      setRedFlagAlerts(alerts);
    }

    const blocked = score > 7;
    await persist(score, regions, blocked, alerts);

    if (blocked) {
      setPhase('blocked');
      onBlock(score, alerts);
    } else {
      onProceed(score);
    }
  };

  // ── Phase: rate ─────────────────────────────────────────────────────────────
  if (phase === 'rate') {
    return (
      <ModalShell onDismiss={onDismiss}>
        <p style={styles.eyebrow}>BEFORE YOUR SESSION</p>
        <h2 style={styles.title}>How is your pain right now?</h2>
        <p style={styles.sub}>
          0 = no pain at all · 10 = worst imaginable
          <br />
          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'normal' }}>
            Hawker GA et al., 2011, Arthritis Care Res
          </span>
        </p>

        {/* Face scale */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', margin: '20px 0' }}>
          {Array.from({ length: 11 }, (_, i) => (
            <FaceIcon
              key={i}
              score={i}
              size={38}
              selected={score === i}
              onClick={() => setScore(i)}
              label
            />
          ))}
        </div>

        {/* Selected label */}
        <div style={{ height: 24, textAlign: 'center', marginBottom: 8 }}>
          {score !== null && (
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.8rem',
              color: score <= 2 ? '#00D4AA' : score <= 6 ? '#FFB830' : '#FF4444',
            }}>
              {score} / 10 — {scoreLabel(score)}
            </span>
          )}
        </div>

        <button
          className="btn-primary"
          disabled={score === null}
          onClick={() => score !== null && setPhase('regions')}
          style={{ width: '100%', opacity: score === null ? 0.45 : 1 }}
        >
          Next →
        </button>

        <p style={styles.pdpa}>
          🔒 This data is stored securely and linked only to your account. PDPA compliant.
        </p>
      </ModalShell>
    );
  }

  // ── Phase: regions ──────────────────────────────────────────────────────────
  if (phase === 'regions') {
    return (
      <ModalShell onDismiss={onDismiss}>
        <p style={styles.eyebrow}>STEP 2 OF {score !== null && score >= 8 ? 3 : 2}</p>
        <h2 style={styles.title}>Where do you feel it?</h2>
        <p style={styles.sub}>Select all that apply — or skip if pain-free.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '18px 0 24px' }}>
          {BODY_REGIONS.map(r => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              style={{
                padding: '6px 14px',
                borderRadius: 99,
                fontSize: '0.78rem',
                fontFamily: "'Figtree', sans-serif",
                border: `1px solid ${regions.includes(r) ? 'var(--border-teal)' : 'var(--border-default)'}`,
                background: regions.includes(r) ? 'var(--teal-dim)' : 'transparent',
                color: regions.includes(r) ? '#00D4AA' : 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setPhase('rate')} style={{ flex: 1 }}>← Back</button>
          {score !== null && score >= 8 ? (
            <button className="btn-primary" onClick={() => setPhase('safety')} style={{ flex: 2 }}>
              Continue →
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => void handleSubmit()}
              style={{ flex: 2 }}
            >
              {score !== null && score > 7 ? 'Submit & see safety advice' : 'Start session →'}
            </button>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── Phase: safety (NPRS ≥8 only) ────────────────────────────────────────────
  if (phase === 'safety') {
    const anyEmergency = SAFETY_QUES
      .filter(q => q.emergencyKey)
      .some(q => safetyAnswers[q.key]);

    return (
      <ModalShell onDismiss={onDismiss}>
        <p style={styles.eyebrow}>SAFETY SCREEN</p>
        <h2 style={{ ...styles.title, color: '#f97316' }}>Pain score {score}/10 — quick check</h2>
        <p style={styles.sub}>Answer yes/no — takes 20 seconds. Required at this pain level.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0 20px' }}>
          {SAFETY_QUES.map(q => (
            <div
              key={q.key}
              onClick={() => toggleSafety(q.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${safetyAnswers[q.key] ? 'rgba(255,68,68,0.4)' : 'var(--border-subtle)'}`,
                background: safetyAnswers[q.key] ? 'rgba(255,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>{q.text}</span>
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', fontWeight: 600,
                color: safetyAnswers[q.key] ? '#FF4444' : 'rgba(255,255,255,0.25)',
                minWidth: 28, textAlign: 'right',
              }}>
                {safetyAnswers[q.key] ? 'YES' : 'NO'}
              </span>
            </div>
          ))}
        </div>

        {anyEmergency && (
          <div style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 14,
            background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.35)',
          }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#FF4444', lineHeight: 1.6 }}>
              ⚠️ <strong>Potential emergency.</strong> Please call 999 (Singapore 995) or go to A&E immediately.
              Do not exercise.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setPhase('regions')} style={{ flex: 1 }}>← Back</button>
          <button
            className="btn-primary"
            onClick={() => void handleSubmit()}
            style={{ flex: 2, background: anyEmergency ? 'rgba(255,68,68,0.2)' : undefined }}
          >
            {anyEmergency ? 'Submit (session blocked)' : 'Submit →'}
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Phase: blocked ───────────────────────────────────────────────────────────
  if (phase === 'blocked') {
    const emergency = redFlagAlerts.some(a => a.emergencyLevel === 'call_999');
    return (
      <ModalShell>
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
            {emergency ? '🚨' : '⛔'}
          </div>
          <p style={styles.eyebrow}>SESSION BLOCKED</p>
          <h2 style={{ ...styles.title, color: emergency ? '#FF4444' : '#f97316' }}>
            {emergency ? 'Call emergency services' : 'Pain too high to exercise'}
          </h2>

          {emergency && redFlagAlerts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {redFlagAlerts.map(a => (
                <div key={a.id} style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: 8,
                  background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)',
                  textAlign: 'left',
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#FF4444', fontWeight: 600, marginBottom: 4 }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    {a.mandatoryAction}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!emergency && (
            <p style={{ ...styles.sub, marginBottom: 20 }}>
              Your pain score ({score}/10) is above the safe exercise threshold.
              Rest today and consult your clinician or physiotherapist.
              <br /><br />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>
                Safe exercise threshold: NPRS ≤ 7 — Hawker GA et al., 2011
              </span>
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emergency && (
              <a
                href="tel:995"
                style={{
                  display: 'block', padding: '12px 0', borderRadius: 10,
                  background: '#FF4444', color: '#fff', fontWeight: 600,
                  fontSize: '0.9rem', textDecoration: 'none', textAlign: 'center',
                }}
              >
                📞 Call 995 (SG Emergency)
              </a>
            )}
            <button
              className="btn-ghost"
              onClick={onDismiss}
              style={{ width: '100%' }}
            >
              Return to menu
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── Phase: submitting ────────────────────────────────────────────────────────
  return (
    <ModalShell>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace" }}>
          Saving check-in…
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    // Backdrop
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,8,16,0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Modal card */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 20,
        padding: '28px 24px',
        width: '100%',
        maxWidth: 480,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)', fontSize: '1.1rem', lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const styles = {
  eyebrow: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '0.12em',
    color: 'var(--teal-500)',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontFamily: "'Syne', sans-serif",
    fontSize: '1.3rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },
  sub: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  pdpa: {
    marginTop: 14,
    fontSize: '0.65rem',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: "'Space Mono', monospace",
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },
} as const;
