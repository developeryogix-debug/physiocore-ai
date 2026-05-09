import { NavLink, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile.js';

export default function Navigation() {
  const { userProfile, clearProfile } = useUserProfile();
  const navigate = useNavigate();

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

      {/* User pill */}
      {userProfile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginLeft: 6,
          paddingLeft: 8,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{
            fontSize: '0.72rem',
            color: 'var(--text-tertiary)',
            fontFamily: "'Space Mono', monospace",
          }}>
            {userProfile.name.split(' ')[0]}
          </span>
          <button
            onClick={() => { clearProfile(); navigate('/'); }}
            title="Reset profile"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.7rem',
              color: 'var(--text-tertiary)',
              padding: '2px 4px',
              borderRadius: 4,
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </nav>
  );
}
