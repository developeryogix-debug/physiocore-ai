import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useUserProfile } from '../hooks/useUserProfile.js';

// ─── Mobile tab icons (SVG) ───────────────────────────────────────────────────
function IconHome() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function IconSession() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>;
}
function IconTrainer() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function IconNutrition() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12"/><path d="M12 6v6l4 2"/></svg>;
}
function IconSettings() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>;
}

const MOBILE_TABS = [
  {to:'/dashboard', label:'Home',      Icon:IconHome},
  {to:'/session',   label:'Session',   Icon:IconSession},
  {to:'/trainer',   label:'Trainer',   Icon:IconTrainer},
  {to:'/nutrition', label:'Nutrition', Icon:IconNutrition},
  {to:'/settings',  label:'Settings',  Icon:IconSettings},
];

const DESKTOP_LINKS = [
  {to:'/dashboard', label:'Dashboard', end:true},
  {to:'/session',   label:'Session'},
  {to:'/history',   label:'History'},
  {to:'/trainer',   label:'Trainer'},
  {to:'/nutrition', label:'Nutrition'},
  {to:'/outcomes',  label:'Outcomes'},
  {to:'/gym',       label:'Gym'},
  {to:'/settings',  label:'Settings'},
];

export default function Navigation() {
  const {user, userRole, signOut} = useAuth();
  const {userProfile, clearProfile} = useUserProfile();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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
  const initials = displayName.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('');

  // ─── Mobile bottom tab bar ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {/* Minimal top bar on mobile */}
        <nav style={{
          position:'fixed',top:'1rem',left:'50%',transform:'translateX(-50%)',
          zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'6px 16px',width:'calc(100% - 32px)',maxWidth:420,
          background:'rgba(8,13,20,0.92)',backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,0.08)',borderRadius:'50px',
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <NavLink to="/dashboard" style={{fontFamily:"'Syne', sans-serif",fontWeight:700,fontSize:'0.88rem',color:'var(--teal-500)',textDecoration:'none',letterSpacing:'-0.01em'}}>
            PhysioCore
          </NavLink>
          {user && (
            <div ref={menuRef} style={{position:'relative'}}>
              <button onClick={()=>setMenuOpen(o=>!o)} title={displayName} style={{
                width:30,height:30,borderRadius:'50%',
                background:'linear-gradient(135deg,var(--teal-500),var(--blue-400))',
                border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'0.65rem',fontWeight:700,color:'#000',fontFamily:"'Space Mono', monospace",
              }}>
                {initials||'?'}
              </button>
              {menuOpen&&<MobileDropdown displayName={displayName} email={user.email??''} userRole={userRole} onSignOut={()=>{ void handleSignOut(); }} onClose={()=>setMenuOpen(false)} navigate={navigate}/>}
            </div>
          )}
        </nav>

        {/* Bottom tab bar */}
        <div style={{
          position:'fixed',bottom:0,left:0,right:0,
          background:'rgba(8,13,20,0.96)',backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          borderTop:'1px solid rgba(255,255,255,0.08)',
          display:'grid',gridTemplateColumns:'repeat(5,1fr)',
          padding:'8px 0 max(12px, env(safe-area-inset-bottom))',
          zIndex:100,
        }}>
          {MOBILE_TABS.map(({to,label,Icon})=>(
            <NavLink key={to} to={to} end={to==='/dashboard'}
              style={({isActive})=>({
                display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                padding:'6px 0',textDecoration:'none',
                color:isActive?'var(--teal-500)':'var(--text-tertiary)',
                transition:'color 0.15s',
              })}>
              {({isActive})=>(
                <>
                  <div style={{position:'relative'}}>
                    {isActive&&<div style={{position:'absolute',inset:-4,borderRadius:'50%',background:'rgba(0,212,170,0.12)'}}/>}
                    <div style={{position:'relative'}}><Icon/></div>
                  </div>
                  <span style={{fontSize:'0.62rem',fontWeight:isActive?700:400,fontFamily:"'Space Mono', monospace",letterSpacing:'0.02em'}}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </>
    );
  }

  // ─── Desktop floating pill nav ─────────────────────────────────────────────
  return (
    <nav style={{
      position:'fixed',top:'1.25rem',left:'50%',transform:'translateX(-50%)',
      zIndex:100,display:'flex',alignItems:'center',gap:'2px',
      padding:'6px 8px',
      background:'rgba(8,13,20,0.85)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
      border:'1px solid rgba(255,255,255,0.08)',borderRadius:'50px',
      boxShadow:'0 8px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.04)',
      whiteSpace:'nowrap' as const,
    }}>
      {/* Brand */}
      <NavLink to="/dashboard" style={{
        fontFamily:"'Syne', sans-serif",fontWeight:700,fontSize:'0.85rem',
        color:'var(--teal-500)',letterSpacing:'-0.01em',textDecoration:'none',
        padding:'5px 14px',marginRight:'4px',
      }}>
        PhysioCore
      </NavLink>

      {/* Nav links */}
      {DESKTOP_LINKS.map(({to,label,end})=>(
        <NavLink key={to} to={to} end={end}
          style={({isActive})=>({
            padding:'5px 12px',borderRadius:'50px',textDecoration:'none',
            fontSize:'0.8rem',fontWeight:isActive?600:400,
            background:isActive?'var(--teal-dim)':'transparent',
            color:isActive?'var(--teal-500)':'var(--text-secondary)',
            transition:'all 0.15s',
            border:isActive?'1px solid var(--border-teal)':'1px solid transparent',
          })}>
          {label}
        </NavLink>
      ))}

      {/* Clinician — only visible to clinician / admin roles */}
      {(userRole === 'clinician' || userRole === 'admin') && (
        <NavLink to="/clinician"
          style={({isActive})=>({
            padding:'5px 12px',borderRadius:'50px',textDecoration:'none',
            fontSize:'0.8rem',fontWeight:isActive?600:500,
            background:isActive?'rgba(77,184,255,0.12)':'transparent',
            color:isActive?'var(--blue-400)':'var(--text-secondary)',
            border:isActive?'1px solid rgba(77,184,255,0.25)':'1px solid transparent',
            transition:'all 0.15s',
          })}>
          Clinician
        </NavLink>
      )}

      {/* Avatar + dropdown */}
      {user&&(
        <div ref={menuRef} style={{position:'relative',marginLeft:'6px',paddingLeft:'8px',borderLeft:'1px solid rgba(255,255,255,0.06)'}}>
          <button onClick={()=>setMenuOpen(o=>!o)} title={displayName} style={{
            width:30,height:30,borderRadius:'50%',
            background:'linear-gradient(135deg,var(--teal-500),var(--blue-400))',
            border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'0.65rem',fontWeight:700,color:'#000',fontFamily:"'Space Mono', monospace",
            flexShrink:0,transition:'opacity 0.15s',opacity:menuOpen?0.85:1,
          }}>
            {initials||'?'}
          </button>

          {menuOpen&&(
            <div style={{
              position:'absolute',top:'calc(100% + 10px)',right:0,
              background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',
              borderRadius:'12px',boxShadow:'0 16px 48px rgba(0,0,0,0.6)',
              minWidth:'200px',overflow:'hidden',zIndex:200,
            }}>
              <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
                <div style={{fontSize:'0.85rem',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>{displayName||'User'}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono', monospace"}}>{user.email}</div>
                <div style={{
                  display:'inline-block',marginTop:'6px',padding:'2px 8px',borderRadius:'20px',
                  fontSize:'0.65rem',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.06em',
                  background:userRole==='admin'?'rgba(255,184,48,0.15)':userRole==='clinician'?'rgba(77,184,255,0.15)':'rgba(0,212,170,0.1)',
                  color:userRole==='admin'?'var(--amber-400)':userRole==='clinician'?'var(--blue-400)':'var(--teal-500)',
                  border:`1px solid ${userRole==='admin'?'rgba(255,184,48,0.25)':userRole==='clinician'?'rgba(77,184,255,0.25)':'var(--border-teal)'}`,
                  fontFamily:"'Space Mono', monospace",
                }}>
                  {userRole}
                </div>
              </div>
              <div style={{padding:'6px'}}>
                {menuItem('My Profile',()=>{setMenuOpen(false);navigate('/settings');})}
                {(userRole==='clinician'||userRole==='admin')&&menuItem('Clinician View',()=>{setMenuOpen(false);navigate('/clinician');})}
                {menuItem('Settings',()=>{setMenuOpen(false);navigate('/settings');})}
              </div>
              <div style={{padding:'6px',borderTop:'1px solid var(--border-subtle)'}}>
                <button onClick={()=>{void handleSignOut();}} style={{
                  width:'100%',padding:'9px 12px',borderRadius:'8px',
                  background:'transparent',border:'none',cursor:'pointer',
                  textAlign:'left' as const,fontSize:'0.82rem',
                  color:'var(--danger)',fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:'8px',transition:'background 0.1s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,68,68,0.08)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
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

// ─── Mobile dropdown ───────────────────────────────────────────────────────────
function MobileDropdown({displayName,email,userRole,onSignOut,onClose,navigate}:{displayName:string;email:string;userRole:string|null;onSignOut:()=>void;onClose:()=>void;navigate:(to:string)=>void}) {
  return (
    <div style={{
      position:'absolute',top:'calc(100% + 10px)',right:0,
      background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',
      borderRadius:'12px',boxShadow:'0 16px 48px rgba(0,0,0,0.7)',
      minWidth:'190px',overflow:'hidden',zIndex:200,
    }}>
      <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border-subtle)'}}>
        <div style={{fontSize:'0.83rem',fontWeight:600,color:'var(--text-primary)',marginBottom:2}}>{displayName||'User'}</div>
        <div style={{fontSize:'0.7rem',color:'var(--text-tertiary)',fontFamily:"'Space Mono', monospace"}}>{email}</div>
      </div>
      <div style={{padding:'6px'}}>
        {menuItem('History',()=>{onClose();navigate('/history');})}
        {menuItem('Outcomes',()=>{onClose();navigate('/outcomes');})}
        {menuItem('Assessment',()=>{onClose();navigate('/assessment');})}
        {menuItem('Gym',()=>{onClose();navigate('/gym');})}
        {menuItem('Behavior',()=>{onClose();navigate('/behavior');})}
        {(userRole==='clinician'||userRole==='admin')&&menuItem('Clinician',()=>{onClose();navigate('/clinician');})}
      </div>
      <div style={{padding:'6px',borderTop:'1px solid var(--border-subtle)'}}>
        <button onClick={onSignOut} style={{
          width:'100%',padding:'9px 12px',borderRadius:'8px',
          background:'transparent',border:'none',cursor:'pointer',
          textAlign:'left' as const,fontSize:'0.82rem',color:'var(--danger)',fontFamily:'inherit',
        }}>Sign Out</button>
      </div>
    </div>
  );
}

function menuItem(label: string, onClick: () => void) {
  return (
    <button key={label} onClick={onClick} style={{
      width:'100%',padding:'9px 12px',borderRadius:'8px',
      background:'transparent',border:'none',cursor:'pointer',
      textAlign:'left' as const,fontSize:'0.82rem',
      color:'var(--text-secondary)',fontFamily:'inherit',transition:'background 0.1s',
    }}
    onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-elevated)';}}
    onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
      {label}
    </button>
  );
}
