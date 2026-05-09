import { NavLink, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile.js';

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '60px',
  padding: '0 24px',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-sm)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

const brandStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.1rem',
  color: 'var(--color-primary)',
  letterSpacing: '-0.02em',
  textDecoration: 'none',
};

const linksStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
};

const userStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-muted)',
  paddingLeft: '12px',
  borderLeft: '1px solid #e2e8f0',
};

function navLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
    background: isActive ? 'var(--color-primary)' : 'transparent',
    color: isActive ? '#fff' : 'var(--color-text)',
    transition: 'background 0.15s, color 0.15s',
  };
}

function clinicianLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    padding: '5px 12px',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    background: isActive ? '#0369a1' : '#f0f9ff',
    color: isActive ? '#fff' : '#0369a1',
    border: `1px solid ${isActive ? '#0369a1' : '#bae6fd'}`,
    transition: 'background 0.15s, color 0.15s',
  };
}

export default function Navigation() {
  const { userProfile, clearProfile } = useUserProfile();
  const navigate = useNavigate();

  return (
    <nav style={navStyle}>
      <NavLink to="/dashboard" style={brandStyle}>PhysioCore AI</NavLink>
      <div style={linksStyle}>
        <NavLink to="/dashboard" end style={navLinkStyle}>Dashboard</NavLink>
        <NavLink to="/session" style={navLinkStyle}>Session</NavLink>
        <NavLink to="/assessment" style={navLinkStyle}>Assessment</NavLink>
        <NavLink to="/nutrition" style={navLinkStyle}>Nutrition</NavLink>
        <NavLink to="/gym" style={navLinkStyle}>Gym</NavLink>
        <NavLink to="/behavior" style={navLinkStyle}>Behavior</NavLink>
        <NavLink to="/clinician" style={clinicianLinkStyle}>👨‍⚕️ Clinician</NavLink>
        {userProfile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid #e2e8f0' }}>
            <span style={userStyle}>{userProfile.name}</span>
            <button
              onClick={() => { clearProfile(); navigate('/'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8', padding: '2px 6px', borderRadius: 4 }}
              title="Sign out / reset profile"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
