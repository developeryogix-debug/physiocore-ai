import { useState, useCallback } from 'react';
import type { UserProfile, BodyPart, Equipment } from '@physiocore/types';
import { useUserProfile } from '../hooks/useUserProfile.js';

const CONDITIONS = ['Osteoarthritis','Rheumatoid Arthritis','Fibromyalgia','Type 2 Diabetes','Hypertension','Osteoporosis','Scoliosis','Herniated Disc','Rotator Cuff Injury','ACL Injury','Plantar Fasciitis','Carpal Tunnel Syndrome','COPD','Heart Disease','Anxiety / Depression'];

const GOALS: Array<{value: UserProfile['primaryGoal']; label: string}> = [
  {value:'rehabilitation',  label:'🩹 Injury recovery & rehabilitation'},
  {value:'strengthening',   label:'💪 Build strength & muscle'},
  {value:'flexibility',     label:'🧘 Improve flexibility & mobility'},
  {value:'pain_management', label:'💊 Manage chronic pain'},
  {value:'performance',     label:'🏆 Athletic performance'},
];

const FITNESS: Array<{value: UserProfile['fitnessLevel']; label: string; desc: string}> = [
  {value:'beginner',     label:'Beginner',     desc:'Little or no exercise experience'},
  {value:'intermediate', label:'Intermediate', desc:'1–3 sessions per week'},
  {value:'advanced',     label:'Advanced',     desc:'4+ structured sessions per week'},
  {value:'athlete',      label:'Athlete',      desc:'Competitive or professional training'},
];

const EQUIPMENT: Array<{value: Equipment; label: string}> = [
  {value:'none',             label:'Bodyweight only'},
  {value:'yoga_mat',         label:'Yoga Mat'},
  {value:'resistance_bands', label:'Resistance Bands'},
  {value:'foam_roller',      label:'Foam Roller'},
  {value:'dumbbells',        label:'Dumbbells'},
  {value:'pull_up_bar',      label:'Pull-up Bar'},
];

type ShapeProps = {kind:'e';cx:number;cy:number;rx:number;ry:number} | {kind:'r';x:number;y:number;w:number;h:number;rx?:number};
const ZONES: Array<{part:BodyPart;label:string;s:ShapeProps}> = [
  {part:'neck',           label:'Neck',       s:{kind:'e',cx:60, cy:20, rx:16,ry:18}},
  {part:'upper_back',     label:'Upper Back', s:{kind:'r',x:36, y:40, w:48,h:36,rx:5}},
  {part:'lower_back',     label:'Lower Back', s:{kind:'r',x:36, y:76, w:48,h:28,rx:4}},
  {part:'core',           label:'Core',       s:{kind:'r',x:38, y:104,w:44,h:22,rx:4}},
  {part:'shoulder_right', label:'R Shoulder', s:{kind:'e',cx:20, cy:58, rx:18,ry:13}},
  {part:'shoulder_left',  label:'L Shoulder', s:{kind:'e',cx:100,cy:58, rx:18,ry:13}},
  {part:'elbow_right',    label:'R Elbow',    s:{kind:'e',cx:9,  cy:98, rx:12,ry:12}},
  {part:'elbow_left',     label:'L Elbow',    s:{kind:'e',cx:111,cy:98, rx:12,ry:12}},
  {part:'wrist_right',    label:'R Wrist',    s:{kind:'e',cx:7,  cy:134,rx:10,ry:8}},
  {part:'wrist_left',     label:'L Wrist',    s:{kind:'e',cx:113,cy:134,rx:10,ry:8}},
  {part:'hip_right',      label:'R Hip',      s:{kind:'e',cx:40, cy:136,rx:16,ry:12}},
  {part:'hip_left',       label:'L Hip',      s:{kind:'e',cx:80, cy:136,rx:16,ry:12}},
  {part:'knee_right',     label:'R Knee',     s:{kind:'e',cx:40, cy:184,rx:14,ry:14}},
  {part:'knee_left',      label:'L Knee',     s:{kind:'e',cx:80, cy:184,rx:14,ry:14}},
  {part:'ankle_right',    label:'R Ankle',    s:{kind:'e',cx:40, cy:242,rx:11,ry:9}},
  {part:'ankle_left',     label:'L Ankle',    s:{kind:'e',cx:80, cy:242,rx:11,ry:9}},
  {part:'foot_right',     label:'R Foot',     s:{kind:'e',cx:36, cy:266,rx:20,ry:11}},
  {part:'foot_left',      label:'L Foot',     s:{kind:'e',cx:84, cy:266,rx:20,ry:11}},
];

// ─── Dark body map ────────────────────────────────────────────────────────────
function BodyMap({selected, onToggle}: {selected: BodyPart[]; onToggle:(p:BodyPart)=>void}) {
  const [hovered, setHovered] = useState<BodyPart|null>(null);
  const hit = (p: BodyPart) => selected.includes(p);
  const fill = (p: BodyPart) => hit(p)?'rgba(239,68,68,0.7)':hovered===p?'rgba(239,68,68,0.25)':'transparent';
  const sil = '#1E2D48';
  const renderShape = (z: typeof ZONES[0]) => {
    const common = {
      fill: fill(z.part),
      stroke: hit(z.part)?'#dc2626':'rgba(255,255,255,0.15)',
      strokeWidth: hit(z.part)?2:1,
      style:{cursor:'pointer'} as React.CSSProperties,
      onClick:()=>onToggle(z.part),
      onMouseEnter:()=>setHovered(z.part),
      onMouseLeave:()=>setHovered(null),
    };
    if(z.s.kind==='e') return <ellipse key={z.part} cx={z.s.cx} cy={z.s.cy} rx={z.s.rx} ry={z.s.ry} {...common}/>;
    return <rect key={z.part} x={z.s.x} y={z.s.y} width={z.s.w} height={z.s.h} rx={z.s.rx??0} {...common}/>;
  };
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <svg viewBox="0 0 120 282" width={140} height={282} style={{overflow:'visible'}}>
        {/* Dark silhouette */}
        <ellipse cx={60} cy={20} rx={17} ry={19} fill={sil}/>
        <rect x={53} y={37} width={14} height={12} rx={3} fill={sil}/>
        <rect x={34} y={48} width={52} height={78} rx={8} fill={sil}/>
        <rect x={7}  y={50} width={24} height={80} rx={11} fill={sil}/>
        <rect x={89} y={50} width={24} height={80} rx={11} fill={sil}/>
        <rect x={34} y={126} width={22} height={80} rx={9} fill={sil}/>
        <rect x={64} y={126} width={22} height={80} rx={9} fill={sil}/>
        <rect x={34} y={206} width={20} height={62} rx={8} fill={sil}/>
        <rect x={66} y={206} width={20} height={62} rx={8} fill={sil}/>
        <ellipse cx={42} cy={276} rx={22} ry={11} fill={sil}/>
        <ellipse cx={78} cy={276} rx={22} ry={11} fill={sil}/>
        {ZONES.map(renderShape)}
      </svg>
      {hovered && (
        <div style={{fontSize:'0.75rem',color:'#ef4444',fontWeight:600,height:20}}>
          {ZONES.find(z=>z.part===hovered)?.label}
        </div>
      )}
      {selected.length>0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:4,maxWidth:300,justifyContent:'center'}}>
          {selected.map(p=>(
            <span key={p} style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.35)',borderRadius:99,padding:'2px 8px',fontSize:'0.7rem',fontWeight:600}}>
              {ZONES.find(z=>z.part===p)?.label??p} ×
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────
function Chip<T extends string>({value,label,selected,onToggle}:{value:T;label:string;selected:T[];onToggle:(v:T)=>void}) {
  const on = selected.includes(value);
  return (
    <button type="button" onClick={()=>onToggle(value)} style={{
      padding:'6px 14px',borderRadius:99,
      border:`1.5px solid ${on?'var(--teal-500)':'rgba(255,255,255,0.1)'}`,
      background:on?'rgba(0,212,170,0.12)':'rgba(255,255,255,0.03)',
      color:on?'var(--teal-500)':'var(--text-secondary)',
      fontWeight:on?600:400,fontSize:'0.83rem',cursor:'pointer',
      transition:'all 0.15s',fontFamily:'inherit',
    }}>
      {label}
    </button>
  );
}

// ─── Input field ─────────────────────────────────────────────────────────────
function Field({label,unit,type='text',value,onChange,placeholder}:{label:string;unit?:string;type?:string;value:string;onChange:(v:string)=>void;placeholder?:string}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <label style={{fontSize:'0.78rem',fontWeight:600,color:'var(--text-secondary)'}}>{label}</label>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          style={{flex:1,padding:'9px 12px',border:`1.5px solid ${focused?'var(--teal-500)':'rgba(255,255,255,0.1)'}`,
            borderRadius:8,fontSize:'0.9rem',outline:'none',
            background:'#121B2E',color:'var(--text-primary)',
            fontFamily:'inherit',transition:'border-color 0.15s',
            '::placeholder':{color:'var(--text-tertiary)'}} as React.CSSProperties}/>
        {unit&&<span style={{fontSize:'0.8rem',color:'var(--text-tertiary)',minWidth:32}}>{unit}</span>}
      </div>
    </div>
  );
}

// ─── Wizard data ──────────────────────────────────────────────────────────────
interface WizardData {
  name:string;age:string;gender:UserProfile['gender'];
  heightCm:string;weightKg:string;
  painParts:BodyPart[];conditionNames:string[];
  goals:UserProfile['primaryGoal'][];
  fitnessLevel:UserProfile['fitnessLevel'];equipment:Equipment[];
  sessionMinutes:number;intensity:'low'|'moderate'|'high';
  restingHR:string;bloodPressure:string;notes:string;
}

const INIT: WizardData = {
  name:'',age:'',gender:'prefer_not_to_say',heightCm:'',weightKg:'',
  painParts:[],conditionNames:[],goals:[],
  fitnessLevel:'intermediate',equipment:[],sessionMinutes:30,intensity:'moderate',
  restingHR:'',bloodPressure:'',notes:'',
};

function bmi(h:string,w:string){const hm=parseFloat(h)/100;const wk=parseFloat(w);return hm>0&&wk>0?(wk/(hm*hm)).toFixed(1):'—';}

function buildProfile(d:WizardData):UserProfile{
  const now=new Date().toISOString();const age=parseInt(d.age,10)||30;
  const dob=new Date();dob.setFullYear(dob.getFullYear()-age);
  const hm=parseFloat(d.heightCm)/100||1.7;const wk=parseFloat(d.weightKg)||70;
  return {
    id:`user-${Date.now()}`,email:'',name:d.name.trim()||'User',
    dateOfBirth:dob.toISOString().split('T')[0]??'',gender:d.gender,
    heightCm:parseFloat(d.heightCm)||170,weightKg:wk,bmi:parseFloat((wk/(hm*hm)).toFixed(1)),
    fitnessLevel:d.fitnessLevel,primaryGoal:d.goals[0]??'rehabilitation',
    injuries:d.painParts.map((part,i)=>({id:`inj-${i}`,bodyPart:part,type:'chronic' as const,severity:2 as const,isActive:true})),
    conditions:d.conditionNames.map((name,i)=>({id:`cond-${i}`,name,isActive:true})),
    medications:[],
    preferences:{sessionDurationMinutes:d.sessionMinutes,preferredIntensity:d.intensity,equipmentAvailable:d.equipment.length>0?d.equipment:['none' as Equipment],notificationsEnabled:true,language:'en',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},
    subscription:'free',createdAt:now,updatedAt:now,
  };
}

const STEPS = ['About You','Pain & Health','Your Goals','Fitness & Equipment','Biometrics'];

export default function OnboardingWizard() {
  const {setUserProfile} = useUserProfile();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<WizardData>(INIT);
  const set = useCallback(<K extends keyof WizardData>(k:K,v:WizardData[K])=>setD(prev=>({...prev,[k]:v})),[]);
  const toggle = <T extends string>(key:keyof WizardData,val:T)=>{
    const arr=d[key] as T[];
    set(key,(arr.includes(val)?arr.filter(x=>x!==val):[...arr,val]) as WizardData[typeof key]);
  };

  const finish = () => {
    const profile = buildProfile(d);
    if(d.restingHR||d.bloodPressure||d.notes){
      localStorage.setItem('physiocore_biometrics',JSON.stringify({restingHR:d.restingHR,bloodPressure:d.bloodPressure,notes:d.notes}));
    }
    setUserProfile(profile);
  };

  const canNext = [d.name.trim().length>0&&d.age.trim().length>0,true,d.goals.length>0,d.equipment.length>0,true][step];

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position:'fixed',inset:0,background:'rgba(5,8,16,0.92)',
    display:'flex',alignItems:'center',justifyContent:'center',
    zIndex:1000,padding:16,overflowY:'auto',backdropFilter:'blur(8px)',
  };
  const card: React.CSSProperties = {
    background:'#0D1420',borderRadius:20,padding:'32px 36px',
    width:'100%',maxWidth:560,
    border:'1px solid rgba(255,255,255,0.08)',
    boxShadow:'0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(0,212,170,0.04)',
    maxHeight:'90vh',overflowY:'auto',
  };
  const heading: React.CSSProperties = {fontSize:'1.35rem',fontWeight:600,color:'var(--text-primary)',marginBottom:4,fontFamily:"'Syne', sans-serif"};
  const sub: React.CSSProperties = {fontSize:'0.875rem',color:'var(--text-secondary)',marginBottom:24,lineHeight:1.6};
  const row: React.CSSProperties = {display:'flex',gap:12};
  const chips: React.CSSProperties = {display:'flex',flexWrap:'wrap',gap:8,marginBottom:8};
  const sectionLabel: React.CSSProperties = {fontSize:'0.75rem',fontWeight:600,color:'var(--text-tertiary)',marginBottom:8,marginTop:18,textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:"'Space Mono', monospace"};
  const selectStyle: React.CSSProperties = {padding:'9px 12px',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:'0.9rem',background:'#121B2E',color:'var(--text-primary)',fontFamily:'inherit',cursor:'pointer'};
  const goalOn = (on:boolean): React.CSSProperties => ({
    textAlign:'left',padding:'14px 18px',borderRadius:12,
    border:`2px solid ${on?'var(--teal-500)':'rgba(255,255,255,0.08)'}`,
    background:on?'rgba(0,212,170,0.1)':'rgba(255,255,255,0.02)',
    cursor:'pointer',fontWeight:on?600:400,fontSize:'0.93rem',
    color:on?'var(--teal-500)':'var(--text-secondary)',fontFamily:'inherit',transition:'all 0.15s',
  });
  const fitnessOn = (on:boolean): React.CSSProperties => ({
    padding:'12px 14px',borderRadius:10,
    border:`2px solid ${on?'var(--teal-500)':'rgba(255,255,255,0.08)'}`,
    background:on?'rgba(0,212,170,0.1)':'rgba(255,255,255,0.02)',
    cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.15s',
  });

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Progress dots + bar */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:28}}>
          {STEPS.map((label,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:'unset',gap:8}}>
              <div title={label} style={{
                width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'0.72rem',fontWeight:600,flexShrink:0,
                background: i<step?'var(--teal-500)':i===step?'rgba(0,212,170,0.15)':'rgba(255,255,255,0.05)',
                color: i<step?'#000':i===step?'var(--teal-500)':'var(--text-tertiary)',
                border: i===step?'2px solid var(--teal-500)': i<step?'2px solid var(--teal-500)':'2px solid transparent',
                boxShadow: i===step?'0 0 12px rgba(0,212,170,0.3)':'none',
                transition:'all 0.2s',
              }}>
                {i<step?'✓':i+1}
              </div>
              {i<STEPS.length-1&&(
                <div style={{flex:1,height:2,borderRadius:99,
                  background:i<step?'linear-gradient(90deg,var(--teal-500),rgba(0,212,170,0.4))':'rgba(255,255,255,0.06)',
                  minWidth:12,transition:'background 0.3s'}}/>
              )}
            </div>
          ))}
        </div>

        {/* Step 1: About You */}
        {step===0&&(
          <>
            <h2 style={heading}>Let's get to know you</h2>
            <p style={sub}>Basic info so your AI physiotherapist can personalise every session.</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Field label="Full name" value={d.name} onChange={v=>set('name',v)} placeholder="e.g. Jordan Smith"/>
              <div style={row}>
                <Field label="Age" type="number" value={d.age} onChange={v=>set('age',v)} placeholder="28" unit="yrs"/>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:4}}>
                  <label style={{fontSize:'0.78rem',fontWeight:600,color:'var(--text-secondary)'}}>Biological sex</label>
                  <select value={d.gender} onChange={e=>set('gender',e.target.value as WizardData['gender'])} style={selectStyle}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div style={row}>
                <Field label="Height" type="number" value={d.heightCm} onChange={v=>set('heightCm',v)} placeholder="175" unit="cm"/>
                <Field label="Weight" type="number" value={d.weightKg} onChange={v=>set('weightKg',v)} placeholder="70" unit="kg"/>
              </div>
              {(d.heightCm||d.weightKg)&&(
                <div style={{background:'rgba(0,212,170,0.08)',border:'1px solid rgba(0,212,170,0.2)',borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontFamily:"'Space Mono', monospace",fontSize:'1.5rem',fontWeight:600,color:'var(--teal-500)'}}>{bmi(d.heightCm,d.weightKg)}</span>
                  <span style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>BMI (auto-calculated)</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 2: Pain & Health */}
        {step===1&&(
          <>
            <h2 style={heading}>Pain & health conditions</h2>
            <p style={sub}>Tap areas where you feel pain or discomfort. Add any diagnosed conditions.</p>
            <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
              <BodyMap selected={d.painParts} onToggle={p=>toggle('painParts',p)}/>
            </div>
            <p style={sectionLabel}>Diagnosed conditions</p>
            <div style={chips}>
              {CONDITIONS.map(c=>(
                <Chip key={c} value={c} label={c} selected={d.conditionNames} onToggle={v=>toggle('conditionNames',v)}/>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Goals */}
        {step===2&&(
          <>
            <h2 style={heading}>What are your goals?</h2>
            <p style={sub}>Select all that apply. Your primary goal shapes every AI recommendation.</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {GOALS.map(g=>(
                <button key={g.value} type="button" onClick={()=>toggle('goals',g.value)} style={goalOn(d.goals.includes(g.value))}>
                  {g.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 4: Fitness & Equipment */}
        {step===3&&(
          <>
            <h2 style={heading}>Fitness level & equipment</h2>
            <p style={sub}>This calibrates difficulty and selects appropriate exercises.</p>
            <p style={sectionLabel}>Current fitness level</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:4}}>
              {FITNESS.map(f=>(
                <button key={f.value} type="button" onClick={()=>set('fitnessLevel',f.value)} style={fitnessOn(d.fitnessLevel===f.value)}>
                  <div style={{fontWeight:600,fontSize:'0.9rem',color:d.fitnessLevel===f.value?'var(--teal-500)':'var(--text-primary)'}}>{f.label}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginTop:2}}>{f.desc}</div>
                </button>
              ))}
            </div>
            <p style={sectionLabel}>Equipment available</p>
            <div style={chips}>
              {EQUIPMENT.map(e=>(
                <Chip key={e.value} value={e.value} label={e.label} selected={d.equipment} onToggle={v=>toggle('equipment',v)}/>
              ))}
            </div>
            <p style={sectionLabel}>Session preferences</p>
            <div style={row}>
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:4}}>
                <label style={{fontSize:'0.78rem',fontWeight:600,color:'var(--text-secondary)'}}>Session length</label>
                <select value={d.sessionMinutes} onChange={e=>set('sessionMinutes',Number(e.target.value))} style={selectStyle}>
                  {[15,20,30,45,60].map(m=><option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:4}}>
                <label style={{fontSize:'0.78rem',fontWeight:600,color:'var(--text-secondary)'}}>Preferred intensity</label>
                <select value={d.intensity} onChange={e=>set('intensity',e.target.value as WizardData['intensity'])} style={selectStyle}>
                  <option value="low">Low — gentle pace</option>
                  <option value="moderate">Moderate — balanced</option>
                  <option value="high">High — challenging</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Step 5: Biometrics */}
        {step===4&&(
          <>
            <h2 style={heading}>Optional biometrics</h2>
            <p style={sub}>These help personalise cardiovascular and recovery recommendations. All optional — skip freely.</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Field label="Resting heart rate" type="number" value={d.restingHR} onChange={v=>set('restingHR',v)} placeholder="e.g. 62" unit="bpm"/>
              <Field label="Blood pressure" value={d.bloodPressure} onChange={v=>set('bloodPressure',v)} placeholder="e.g. 120/80" unit="mmHg"/>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <label style={{fontSize:'0.78rem',fontWeight:600,color:'var(--text-secondary)'}}>Additional notes for your physiotherapist</label>
                <textarea value={d.notes} onChange={e=>set('notes',e.target.value)} rows={3}
                  placeholder="Recent surgeries, medications, specific concerns…"
                  data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"
                  spellCheck={false} autoComplete="off"
                  style={{padding:'9px 12px',border:'1.5px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:'0.9rem',resize:'vertical',fontFamily:'inherit',background:'#121B2E',color:'var(--text-primary)',outline:'none'}}/>
              </div>
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:28,gap:12}}>
          {step>0?(
            <button type="button" onClick={()=>setStep(s=>s-1)} style={{
              padding:'11px 22px',borderRadius:10,
              border:'1.5px solid rgba(255,255,255,0.12)',
              background:'transparent',fontWeight:600,fontSize:'0.9rem',
              cursor:'pointer',color:'var(--text-secondary)',fontFamily:'inherit',
              transition:'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.25)';e.currentTarget.style.color='var(--text-primary)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='var(--text-secondary)'}}
            >
              ← Back
            </button>
          ):<div/>}
          {step<STEPS.length-1?(
            <button type="button" onClick={()=>setStep(s=>s+1)} disabled={!canNext} style={{
              padding:'11px 28px',borderRadius:10,
              background:canNext?'var(--teal-500)':'rgba(255,255,255,0.08)',
              color:canNext?'#000':'var(--text-tertiary)',
              border:'none',fontWeight:600,fontSize:'0.9rem',
              cursor:canNext?'pointer':'not-allowed',fontFamily:'inherit',
              boxShadow:canNext?'0 4px 20px rgba(0,212,170,0.3)':'none',
              transition:'all 0.2s',
            }}>
              Continue →
            </button>
          ):(
            <button type="button" onClick={finish} style={{
              padding:'11px 28px',borderRadius:10,
              background:'linear-gradient(135deg, var(--teal-500), var(--blue-400))',
              color:'#000',border:'none',fontWeight:600,fontSize:'0.95rem',
              cursor:'pointer',fontFamily:'inherit',
              boxShadow:'0 4px 24px rgba(0,212,170,0.35)',
            }}>
              Start My Programme 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
