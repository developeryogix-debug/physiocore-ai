import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth.js';

const CONSENTS = [
  'I understand PhysioCore AI provides movement guidance, not medical diagnosis. It does not replace professional clinical advice.',
  'I consent to my movement and health data being stored securely for my personal use. I can delete my data at any time.',
  'I have read and agree to the Privacy Policy. My data is handled in accordance with PDPA requirements.',
] as const;

export default function ConsentScreen() {
  const { recordConsent, user } = useAuth();
  const [ticked, setTicked] = useState([false, false, false]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allTicked = ticked.every(Boolean) && name.trim().length >= 2;

  function toggle(i: number) {
    setTicked(prev => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allTicked) return;
    setLoading(true);
    setError(null);
    try {
      await recordConsent(name.trim());
    } catch {
      setError('Failed to record consent. Please try again.');
      setLoading(false);
    }
  }

  const defaultEmail = user?.email ?? '';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-void)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(0,212,170,0.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: '14px', marginBottom: '16px',
            background: 'rgba(0,212,170,0.1)', border: '1px solid var(--border-teal)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: '1.5rem', color: 'var(--text-primary)',
            letterSpacing: '-0.02em', marginBottom: '8px',
          }}>
            Informed Consent
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
            Before we begin, please read and acknowledge each item below. This is required once per account.
          </p>
          {defaultEmail && (
            <p style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>
              Signing as: {defaultEmail}
            </p>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: '16px', padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            {/* Consent items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
              {CONSENTS.map((text, i) => (
                <div
                  key={i}
                  onClick={() => toggle(i)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                    padding: '16px', borderRadius: '10px', cursor: 'pointer',
                    background: ticked[i] ? 'rgba(0,212,170,0.06)' : 'var(--bg-elevated)',
                    border: `1px solid ${ticked[i] ? 'var(--border-teal)' : 'var(--border-subtle)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '5px', flexShrink: 0,
                    border: `2px solid ${ticked[i] ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                    background: ticked[i] ? 'var(--teal-500)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: '1px', transition: 'all 0.15s',
                  }}>
                    {ticked[i] && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3"/>
                      </svg>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, userSelect: 'none' as const }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>

            {/* Signature */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '0.72rem', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: '8px',
                letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                fontFamily: "'Space Mono', monospace",
              }}>
                Type your full name to sign
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full legal name"
                autoComplete="name"
                style={{
                  width: '100%', padding: '12px 14px', boxSizing: 'border-box' as const,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  outline: 'none', fontFamily: "'Syne', sans-serif", fontStyle: 'italic',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal-500)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                Timestamp and IP hash are recorded for compliance (PDPA, HIPAA-aligned).
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                color: 'var(--danger)', fontSize: '0.82rem',
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={!allTicked || loading}
              className="btn-primary"
              style={{
                width: '100%', padding: '13px', fontSize: '0.9rem',
                opacity: allTicked && !loading ? 1 : 0.4,
                cursor: allTicked && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? 'Recording consent…' : 'I Agree — Continue to Setup'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
          Consent v1.0 · PhysioCore AI · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
