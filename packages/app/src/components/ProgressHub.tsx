/**
 * ProgressHub.tsx — Recovery Score + Milestones + Streak Calendar.
 * Calls /api/recovery-score for deterministic score computation + Haiku insight.
 * Reads sessions from localStorage (scopedKey). Milestones/scores persisted in Supabase.
 * PDPA note displayed at bottom (Singapore region compliance).
 * Clinical Noir design system. SaMD Class II — score is decision support only.
 * No social sharing. No external gamification services.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { scopedKey } from '../lib/storage.js';
import { ScoreRing } from './progress/ScoreRing.js';
import { MilestoneCard } from './progress/MilestoneCard.js';
import { StreakCalendar } from './progress/StreakCalendar.js';

interface SessionRecord { formScore: number; date: string; }

interface Milestone {
  type: string; label: string; desc: string;
  unlocked: boolean; unlockedAt: string | null; isNew?: boolean;
}

interface RecoveryData {
  score: number;
  delta: number;
  insight: string;
  milestones: Milestone[];
}

// Cache key — refresh at most once per 6 hours
const CACHE_KEY_PREFIX = 'physiocore_recovery_cache_';
const CACHE_TTL_MS     = 6 * 60 * 60 * 1000;

function loadSessionsFromStorage(userId?: string): SessionRecord[] {
  try {
    const raw = localStorage.getItem(scopedKey('physiocore_sessions', userId));
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch { return []; }
}

function loadOutcomes(userId?: string): { nprs?: number } {
  try {
    const raw = localStorage.getItem(scopedKey('physiocore_outcomes', userId));
    if (!raw) return {};
    const arr = JSON.parse(raw) as Array<{ nprs?: number }>;
    const last = [...arr].reverse().find(o => o.nprs != null);
    return { nprs: last?.nprs };
  } catch { return {}; }
}

function getCachedData(userId: string): RecoveryData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: RecoveryData; ts: number };
    return Date.now() - ts < CACHE_TTL_MS ? data : null;
  } catch { return null; }
}

function setCachedData(userId: string, data: RecoveryData): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full — non-fatal */ }
}

export function ProgressHub() {
  const { user } = useAuth();
  const [data, setData]     = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [sessionDates, setSessionDates] = useState<string[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Load sessions from localStorage
    const sessions = loadSessionsFromStorage(user.id);
    setSessionDates(sessions.map(s => s.date));

    // Check cache first
    const cached = getCachedData(user.id);
    if (cached) { setData(cached); setLoading(false); return; }

    // Filter to last 30 days for API call
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const sessionsLast30 = sessions
      .filter(s => new Date(s.date) >= cutoff)
      .map(s => ({ formScore: s.formScore, date: s.date }));

    const { nprs } = loadOutcomes(user.id);

    fetch('/api/recovery-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId:    user.id,
        sessionsLast30,
        latestNprs:   nprs,
      }),
    })
      .then(r => r.json())
      .then((json: RecoveryData) => {
        setData(json);
        setCachedData(user.id, json);
      })
      .catch(() => setError('Could not load progress data.'))
      .finally(() => setLoading(false));
  }, [user]);

  // Card shell style
  const card: React.CSSProperties = {
    background: 'var(--bg-surface)',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.04)',
    padding: 20,
  };
  const pTitle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    fontFamily: "'Space Mono', monospace", marginBottom: 14,
  };

  if (!user) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={pTitle}>Progress Hub</div>

      {loading && (
        <div style={{
          ...card, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '32px 20px', gap: 10,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid var(--teal-500)', borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>
            Computing recovery score…
          </span>
        </div>
      )}

      {error && !loading && (
        <div style={{ ...card, color: 'var(--text-tertiary)', fontSize: '0.82rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Row A: Score Ring + Milestones */}
          <div style={{
            display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 12,
          }}>
            {/* Score ring */}
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
              <ScoreRing
                score={data.score}
                delta={data.delta}
                insight={data.insight}
              />
            </div>

            {/* Milestones */}
            <div style={card}>
              <MilestoneCard milestones={data.milestones} />
            </div>
          </div>

          {/* Row B: Streak Calendar */}
          <div style={card}>
            <StreakCalendar sessionDates={sessionDates} />
          </div>

          {/* PDPA compliance note */}
          <p style={{
            fontSize: '0.65rem', color: 'var(--text-tertiary)',
            fontFamily: "'Space Mono', monospace",
            lineHeight: 1.6, marginTop: 8, padding: '0 2px',
          }}>
            Progress data stored securely in Singapore region (PDPA compliant).
            Recovery score is a wellness indicator only — not a clinical diagnosis.
            Consult your physiotherapist for clinical decisions.
          </p>
        </>
      )}
    </div>
  );
}
