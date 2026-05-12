import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

type Mode = 'signin' | 'signup' | 'magic';

export default function Login() {
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, sendMagicLink } = useAuth();

  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [mode, setMode] = useState<Mode>(() => inviteToken ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    let err: string | null = null;

    if (mode === 'magic') {
      err = await sendMagicLink(email);
      if (!err) setInfo('Check your inbox — a login link is on its way.');
    } else if (mode === 'signup') {
      err = await signUpWithEmail(email, password, fullName, inviteToken ?? undefined);
      if (!err) setInfo(inviteToken ? 'Account created! Your invite has been accepted.' : 'Account created! Check your email to confirm, then sign in.');
    } else {
      err = await signInWithEmail(email, password);
    }

    setError(err);
    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    fontFamily: "'Space Mono', monospace",
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-void)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Dot grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(0,212,170,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Invite banner */}
        {inviteToken && (
          <div style={{
            marginBottom: 16, padding: '12px 18px',
            background: 'rgba(0,212,170,0.08)', border: '1px solid var(--border-teal)',
            borderRadius: 12, color: 'var(--teal-500)', fontSize: '0.84rem',
            textAlign: 'center' as const, fontWeight: 500,
          }}>
            🎉 You have been invited to join PhysioCore AI — create your account below
          </div>
        )}
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            marginBottom: '8px',
          }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, var(--teal-500), var(--blue-400))',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 700, color: '#000',
              fontFamily: "'Syne', sans-serif",
            }}>P</div>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: '1.25rem',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}>PhysioCore AI</span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
            Clinical intelligence for movement health
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          {mode !== 'magic' ? (
            <>
              {/* Sign In / Sign Up tabs */}
              <div style={{
                display: 'flex',
                background: 'var(--bg-elevated)',
                borderRadius: '10px',
                padding: '4px',
                marginBottom: '28px',
              }}>
                {(['signin', 'signup'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                      background: mode === m ? 'var(--bg-overlay)' : 'transparent',
                      color: mode === m ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    {m === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>

              <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {mode === 'signup' && (
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Alex Johnson"
                      required
                      autoComplete="name"
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal-500)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal-500)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
                    required
                    minLength={mode === 'signup' ? 8 : undefined}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal-500)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)',
                    borderRadius: '8px', padding: '10px 14px',
                    color: 'var(--danger)', fontSize: '0.82rem',
                  }}>{error}</div>
                )}
                {info && (
                  <div style={{
                    background: 'rgba(0,212,170,0.08)', border: '1px solid var(--border-teal)',
                    borderRadius: '8px', padding: '10px 14px',
                    color: 'var(--teal-500)', fontSize: '0.82rem',
                  }}>{info}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.9rem', marginTop: '4px', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              </div>

              {/* Google OAuth */}
              <button
                onClick={() => { void signInWithGoogle(); }}
                style={{
                  width: '100%', padding: '11px', borderRadius: '10px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-teal)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                {/* Google G */}
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Magic link */}
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                <button
                  onClick={() => switchMode('magic')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal-500)', fontSize: '0.8rem', fontFamily: 'inherit', textDecoration: 'underline' }}
                >
                  Send me a login link instead
                </button>
              </p>
            </>
          ) : (
            /* Magic link mode */
            <>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
                Passwordless Login
              </h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginBottom: '24px' }}>
                We'll email you a secure link — no password needed.
              </p>

              <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--teal-500)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)',
                    borderRadius: '8px', padding: '10px 14px',
                    color: 'var(--danger)', fontSize: '0.82rem',
                  }}>{error}</div>
                )}
                {info && (
                  <div style={{
                    background: 'rgba(0,212,170,0.08)', border: '1px solid var(--border-teal)',
                    borderRadius: '8px', padding: '10px 14px',
                    color: 'var(--teal-500)', fontSize: '0.82rem',
                  }}>{info}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.9rem', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Sending…' : 'Send Login Link'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                <button
                  onClick={() => switchMode('signin')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal-500)', fontSize: '0.8rem', fontFamily: 'inherit', textDecoration: 'underline' }}
                >
                  ← Back to sign in
                </button>
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          By continuing you agree to PhysioCore's{' '}
          <span style={{ color: 'var(--text-secondary)' }}>Privacy Policy</span>
          {' '}and{' '}
          <span style={{ color: 'var(--text-secondary)' }}>Terms of Use</span>.
          <br />PDPA compliant · Data stored in Singapore region.
        </p>
      </div>
    </div>
  );
}
