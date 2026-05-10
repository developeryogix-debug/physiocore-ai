import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useUserProfile } from '../hooks/useUserProfile.js';

export default function Navigation() {
  const { user, userRole, signOut } = useAuth();
  const { userProfile, clearProfile } = useUserProfile();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    clearProfile();
    await signOut();
    navigate('/');
  }

  const displayName = userProfile?.name ?? user?.email ?? '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <nav style={{
      position: 'fixed',
      top: '1.25rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '6px 8px',
      background: 'rgba(8,13,20,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '50px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      whiteSpace: 'nowrap' as const,
    }}>
      {/* Brand */}
      <NavLink
        to="/dashboard"
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: '0.85rem',
          color: 'var(--teal-500)',
          letterSpacing: '-0.01em',
          textDecoration: 'none',
          padding: '5px 14px',
          marginRight: '4px',
        }}
      >
        PhysioCore
      </NavLink>

      {/* Nav links */}
      {[
        { to: '/dashboard', label: 'Dashboard', end: true },
        { to: '/session',   label: 'Session' },
        { to: '/assessment',label: 'Assess' },
        { to: '/nutrition', label: 'Nutrition' },
        { to: '/gym',       label: 'Gym' },
        { to: '/behavior',  label: 'Behavior' },
      ].map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({
            padding: '5px 12px',
            borderRadius: '50px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: isActive ? 600 : 400,
            background: isActive ? 'var(--teal-dim)' : 'transparent',
            color: isActive ? 'var(--teal-500)' : 'var(--text-secondary)',
            transition: 'all 0.15s',
            border: isActive ? '1px solid var(--border-teal)' : '1px solid transparent',
          })}
        >
          {label}
        </NavLink>
      ))}

      {/* Clinician — distinct */}
      <NavLink
        to="/clinician"
        style={({ isActive }) => ({
          padding: '5px 12px',
          borderRadius: '50px',
          textDecoration: 'none',
          fontSize: '0.8rem',
          fontWeight: isActive ? 600 : 500,
          background: isActive ? 'rgba(77,184,255,0.12)' : 'transparent',
          color: isActive ? 'var(--blue-400)' : 'var(--text-secondary)',
          border: isActive ? '1px solid rgba(77,184,255,0.25)' : '1px solid transparent',
          transition: 'all 0.15s',
        })}
      >
        Clinician
      </NavLink>

      {/* Avatar + dropdown */}
      {user && (
        <div ref={menuRef} style={{ position: 'relative', marginLeft: '6px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            title={displayName}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--teal-500), var(--blue-400))',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700, color: '#000',
              fontFamily: "'Space Mono', monospace",
              flexShrink: 0,
              transition: 'opacity 0.15s',
              opacity: menuOpen ? 0.85 : 1,
            }}
          >
            {initials || '?'}
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              minWidth: '200px',
              overflow: 'hidden',
              zIndex: 200,
            }}>
              {/* User info header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {displayName || 'User'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace" }}>
                  {user.email}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: '6px',
                  padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem',
                  fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  background: userRole === 'admin' ? 'rgba(255,184,48,0.15)' :
                               userRole === 'clinician' ? 'rgba(77,184,255,0.15)' : 'rgba(0,212,170,0.1)',
                  color: userRole === 'admin' ? 'var(--amber-400)' :
                         userRole === 'clinician' ? 'var(--blue-400)' : 'var(--teal-500)',
                  border: `1px solid ${userRole === 'admin' ? 'rgba(255,184,48,0.25)' :
                                       userRole === 'clinician' ? 'rgba(77,184,255,0.25)' : 'var(--border-teal)'}`,
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {userRole}
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '6px' }}>
                {menuItem('My Profile', '/settings', () => { setMenuOpen(false); navigate('/settings'); })}
                {(userRole === 'clinician' || userRole === 'admin') &&
                  menuItem('Clinician View', '/clinician', () => { setMenuOpen(false); navigate('/clinician'); })}
                {menuItem('Settings', '/settings', () => { setMenuOpen(false); navigate('/settings'); })}
              </div>

              {/* Sign out */}
              <div style={{ padding: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => { void handleSignOut(); }}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left' as const, fontSize: '0.82rem',
                    color: 'var(--danger)', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,68,68,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function menuItem(label: string, _to: string, onClick: () => void) {
  return (
    <button
      key={label}
      onClick={onClick}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: '8px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left' as const, fontSize: '0.82rem',
        color: 'var(--text-secondary)', fontFamily: 'inherit',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}
