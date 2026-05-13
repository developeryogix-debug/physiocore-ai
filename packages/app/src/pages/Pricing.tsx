import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env['VITE_STRIPE_PUBLISHABLE_KEY'] ?? '');

// ─── Tier data ────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    label: 'Get started',
    accent: 'var(--text-secondary)',
    badge: null,
    features: [
      '3 live sessions / month',
      'Basic pose detection',
      'Session history (7 days)',
      'TDEE calculator',
      'Community support',
    ],
    unavailable: [
      'AI form feedback',
      'Clinician SOAP notes',
      'FHIR R4 export',
      'AI trainer chat',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    label: 'Start Pro',
    accent: 'var(--teal-500)',
    badge: 'Most popular',
    features: [
      'Unlimited live sessions',
      'AI form feedback (Haiku)',
      'Rep-by-rep breakdown',
      'Nutrition AI + TDEE',
      'Full session history',
      'Clinician SOAP notes',
      'FHIR R4 export',
      'PDF session reports',
      'Email support',
    ],
    unavailable: [],
  },
  {
    id: 'yoga',
    name: 'Yoga',
    price: 19,
    label: 'Start Yoga',
    accent: 'var(--blue-400)',
    badge: 'Full platform',
    features: [
      'Everything in Pro',
      'Yoga mode — 4 poses + hold timer',
      'Sanskrit cue voice synthesis',
      'AI trainer chat (streaming)',
      'Behavior engine + churn coaching',
      'Multi-org dashboard',
      'Priority support',
      'Early feature access',
    ],
    unavailable: [],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.15" />
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.04)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    if (success) {
      const plan = searchParams.get('plan') ?? 'pro';
      setToast({ msg: `Welcome to PhysioCore ${plan.charAt(0).toUpperCase() + plan.slice(1)}! Your subscription is active.`, type: 'success' });
    } else if (cancelled) {
      setToast({ msg: 'Checkout cancelled — no charge made.', type: 'error' });
    }
  }, [success, cancelled, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSelect(tierId: string) {
    if (tierId === 'free') {
      navigate('/login');
      return;
    }

    setLoading(tierId);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: tierId }),
      });

      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error ?? 'Failed to create checkout session');
      }

      const { url } = await res.json() as { url: string };

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      window.location.href = url;
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Something went wrong', type: 'error' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-void)',
      color: 'var(--text-primary)',
      fontFamily: "'Figtree', system-ui, sans-serif",
      paddingTop: '100px',
      paddingBottom: '80px',
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '12px 24px', borderRadius: '12px',
          background: toast.type === 'success'
            ? 'rgba(0,212,170,0.15)'
            : 'rgba(255,80,80,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(0,212,170,0.4)' : 'rgba(255,80,80,0.4)'}`,
          color: toast.type === 'success' ? 'var(--teal-500)' : '#FF5050',
          fontSize: '0.875rem', fontWeight: 500,
          backdropFilter: 'blur(12px)',
          maxWidth: '480px', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '0 24px 64px' }}>
        <p style={{
          fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace",
          marginBottom: '16px',
        }}>
          Pricing
        </p>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 700,
          fontFamily: "'Syne', sans-serif", lineHeight: 1.1,
          marginBottom: '16px', letterSpacing: '-0.02em',
        }}>
          Clinical AI, priced fairly
        </h1>
        <p style={{
          fontSize: '1.05rem', color: 'var(--text-secondary)',
          maxWidth: '480px', margin: '0 auto', lineHeight: 1.6,
        }}>
          Start free. Upgrade when you need pose AI, clinical exports, or the full yoga platform.
        </p>
      </div>

      {/* Tier cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '0 24px',
      }}>
        {TIERS.map((tier) => {
          const isPopular = tier.id === 'pro';
          return (
            <div
              key={tier.id}
              style={{
                background: isPopular ? 'rgba(0,212,170,0.04)' : 'var(--bg-surface)',
                border: isPopular
                  ? '1.5px solid rgba(0,212,170,0.35)'
                  : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                padding: '36px 32px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Badge */}
              {tier.badge && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)',
                  background: tier.accent,
                  color: tier.id === 'pro' ? '#050810' : '#050810',
                  fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '4px 14px', borderRadius: '99px',
                  fontFamily: "'Space Mono', monospace",
                  whiteSpace: 'nowrap',
                }}>
                  {tier.badge}
                </div>
              )}

              {/* Name + price */}
              <div style={{ marginBottom: '28px' }}>
                <p style={{
                  fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: tier.accent, fontFamily: "'Space Mono', monospace",
                  marginBottom: '8px',
                }}>
                  {tier.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                    {tier.price === 0 ? 'Free' : `$${tier.price}`}
                  </span>
                  {tier.price > 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>/month</span>
                  )}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleSelect(tier.id)}
                disabled={loading !== null}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  border: isPopular ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  background: isPopular
                    ? 'var(--teal-500)'
                    : tier.id === 'yoga'
                    ? 'linear-gradient(135deg, rgba(77,184,255,0.15), rgba(77,184,255,0.08))'
                    : 'rgba(255,255,255,0.04)',
                  color: isPopular ? '#050810' : 'var(--text-primary)',
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: loading !== null ? 'not-allowed' : 'pointer',
                  opacity: loading !== null && loading !== tier.id ? 0.5 : 1,
                  transition: 'all 0.2s',
                  marginBottom: '28px',
                  fontFamily: "'Figtree', sans-serif",
                  letterSpacing: '0.01em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {loading === tier.id ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: '2px solid currentColor',
                      borderTopColor: 'transparent', borderRadius: '50%',
                      display: 'inline-block', animation: 'spin 0.7s linear infinite',
                    }} />
                    Redirecting…
                  </>
                ) : tier.label}
              </button>

              {/* Feature list */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    <CheckIcon color={tier.accent} />
                    {f}
                  </li>
                ))}
                {tier.unavailable.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                    <CrossIcon />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p style={{
        textAlign: 'center', marginTop: '48px',
        color: 'var(--text-tertiary)', fontSize: '0.8rem',
        fontFamily: "'Space Mono', monospace",
      }}>
        Cancel anytime · No hidden fees · Secure payment via Stripe
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
