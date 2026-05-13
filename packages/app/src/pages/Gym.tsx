import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { AiChatPanel } from '../components/AiChatPanel.js';

type ProgramId = 'beginner' | 'ppl' | 'physio';

interface Ex {
  key: string; label: string; sets: number;
  reps: number; // 0 = timed hold (30s)
  restSecs: number; formCue: string;
  sessionKey: string | null;
  progressTo?: string;
}
interface Day { label: string; exs: Ex[] }
interface Program { id: ProgramId; name: string; freq: string; days: Day[] }
interface SetLog { reps: number }
interface ExLog { key: string; sets: SetLog[] }
interface SessionRec { date: string; programId: ProgramId; dayLabel: string; exs: ExLog[] }
interface GymSt { programId: ProgramId | null; dayIdx: number; lastDate: string; history: SessionRec[] }

// ── Exercise library ──────────────────────────────────────────────────────────

const E = (key: string, label: string, sets: number, reps: number, restSecs: number, formCue: string, sessionKey: string | null, progressTo?: string): Ex =>
  ({ key, label, sets, reps, restSecs, formCue, sessionKey, progressTo });

const squat        = E('squat',        'Squat',                  3, 10,  90, 'Hips below parallel · knees track over toes · chest tall',                             'squat',          'Goblet → Back Squat');
const pushup       = E('pushup',       'Push-up',                3,  8,  90, 'Elbow <90° at bottom · body straight within 10° · flag hip sag',                       'pushup',         'Pike Push-up → Bench Press');
const dbRow        = E('dumbbell_row', 'Dumbbell Row',           3, 10,  90, 'Hip hinge · pull elbow to hip · neutral spine',                                         'deadlift',       'Weighted Row');
const plankEx      = E('plank',        'Plank',                  3,  0,  60, 'Hip–shoulder–ankle within 5° · hold 30 s · drop below 80% alignment = end set',         null,             'RKC Plank');
const lunge        = E('lunge',        'Lunge',                  3, 10,  90, 'Front knee tracks over toe · torso upright · back knee ~1 cm off floor',                'lunge',          'Walking → Bulgarian Split Squat');
const ohPress      = E('shoulder_press','Shoulder Press',        3,  8,  90, 'Arm >165° at top · trunk lean <10° · no lumbar hyperextension',                        'shoulder_press', 'Arnold Press');
const deadlift     = E('deadlift',     'Deadlift',               3,  8, 120, 'Hip hinge · back angle <45° at bottom · soft knee 10–20° · flag back rounding',        'deadlift',       'Romanian → Conventional');
const sidePlank    = E('side_plank',   'Side Plank',             2,  0,  60, 'Body straight · hold 20 s each side',                                                   null,             'Side Plank with Hip Dip');
const latRaise     = E('lateral_raise','Lateral Raise',          3, 12,  60, 'Arms parallel at top · slight elbow bend · controlled descent',                         null);
const facePull     = E('face_pull',    'Face Pull',              3, 15,  60, 'Elbows above wrists · pull to forehead · external rotation at end',                     null);
const bicepCurl    = E('bicep_curl',   'Bicep Curl',             3, 12,  60, 'Full extension at bottom · no body swing',                                               null);
const romanianDL   = E('romanian_dl',  'Romanian Deadlift',      3, 10,  90, 'Back angle <45° at bottom · soft knee 10–20° · flag back rounding',                    'deadlift');
const gluteBridge  = E('glute_bridge', 'Glute Bridge',           3, 15,  60, 'Full hip extension at top · squeeze glutes · neutral spine',                            null);
// Physio – knee
const tke          = E('tke',          'Terminal Knee Extension', 3, 15,  60, 'Final 15° of knee extension against band · hold 2 s at top',                           null);
const stepUp       = E('step_up',      'Step-Up',                3, 10,  90, 'Controlled ascent · knee tracks over toe · no lateral lean',                           'lunge');
const clamshell    = E('clamshell',    'Clamshell',              3, 20,  60, 'Feet together · rotate top knee 45° · pelvis stable',                                   null);
const legPressAngle= E('squat_rehab',  'Rehab Squat (60° range)', 3, 12,  90, 'Controlled 60° range · knee pain-free · stop if pain >3/10',                          'squat');
// Physio – shoulder
const wallSlide    = E('wall_slide',   'Wall Slide',             3, 10,  60, 'Forearms flat on wall · slide up without shoulder shrug',                               null);
const extRotation  = E('ext_rotation', 'External Rotation',      3, 15,  60, 'Elbow at 90° · rotate out against band · slow controlled',                              null);
const scapRetract  = E('scap_retract', 'Scapular Retraction',    3, 15,  60, 'Squeeze shoulder blades together and down · hold 3 s',                                  null);

function makePrograms(injuryBodies: string[]): Program[] {
  const hasKnee     = injuryBodies.some(b => b.includes('knee'));
  const hasShoulder = injuryBodies.some(b => b.includes('shoulder'));
  const physioExs   = hasKnee
    ? [tke, legPressAngle, stepUp, clamshell, gluteBridge]
    : hasShoulder
      ? [wallSlide, extRotation, scapRetract]
      : [tke, stepUp, clamshell, wallSlide, extRotation, scapRetract];
  const physioLabel = hasKnee ? 'Knee Rehab' : hasShoulder ? 'Shoulder Rehab' : 'Full Rehab';

  return [
    { id: 'beginner', name: 'Beginner Full Body', freq: '3 days / week',
      days: [
        { label: 'Day A', exs: [squat, pushup, dbRow, plankEx] },
        { label: 'Day B', exs: [lunge, ohPress, deadlift, sidePlank] },
      ],
    },
    { id: 'ppl', name: 'Push / Pull / Legs', freq: '5–6 days / week',
      days: [
        { label: 'Push', exs: [ohPress, pushup, latRaise] },
        { label: 'Pull', exs: [dbRow, facePull, bicepCurl] },
        { label: 'Legs', exs: [squat, lunge, romanianDL, gluteBridge] },
      ],
    },
    { id: 'physio', name: 'Physiotherapy Strengthening', freq: '3 days / week',
      days: [{ label: physioLabel, exs: physioExs }],
    },
  ];
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORE = 'physiocore_gym';
function loadSt(): GymSt {
  try { return JSON.parse(localStorage.getItem(STORE) ?? 'null') as GymSt ?? dfSt(); } catch { return dfSt(); }
}
function dfSt(): GymSt { return { programId: null, dayIdx: 0, lastDate: '', history: [] }; }
function saveSt(s: GymSt) { localStorage.setItem(STORE, JSON.stringify(s)); }

function progressHint(key: string, target: number, history: SessionRec[]): string | null {
  for (const rec of history.slice(0, 5)) {
    const log = rec.exs.find(e => e.key === key);
    if (!log || log.sets.length === 0) continue;
    const firstReps = log.sets[0]?.reps ?? 0;
    const allHit    = log.sets.every(s => s.reps >= target);
    if (allHit)  return `Last: ${log.sets.length}×${firstReps} ✓ → suggest ${log.sets.length}×${target + 1} today`;
    return `Last: ${log.sets.length}×${firstReps} / target ${target}`;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Gym() {
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [gymSt, setGymSt]         = useState<GymSt>(loadSt);
  const [logs, setLogs]            = useState<Record<string, SetLog[]>>({});
  const [activeKey, setActiveKey]  = useState<string | null>(null);
  const [repInput, setRepInput]    = useState<Record<string, string>>({});
  const [restKey, setRestKey]      = useState<string | null>(null);
  const [restLeft, setRestLeft]    = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const injuries    = userProfile?.injuries.filter(i => i.isActive).map(i => i.bodyPart) ?? [];
  const programs    = makePrograms(injuries);
  const program     = programs.find(p => p.id === gymSt.programId) ?? null;
  const today       = program ? program.days[gymSt.dayIdx % program.days.length] ?? null : null;
  const totalSets   = today?.exs.reduce((a, e) => a + e.sets, 0) ?? 0;
  const doneSets    = Object.values(logs).reduce((a, sets) => a + sets.length, 0);
  const pct         = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  useEffect(() => {
    if (!today || sessionDone) return;
    const allDone = today.exs.every(ex => (logs[ex.key]?.length ?? 0) >= ex.sets);
    if (allDone && doneSets > 0) setSessionDone(true);
  }, [logs, today, sessionDone, doneSets]);

  const startRest = useCallback((key: string, secs: number) => {
    if (restRef.current) clearInterval(restRef.current);
    setRestKey(key); setRestLeft(secs);
    restRef.current = setInterval(() => {
      setRestLeft(prev => {
        if (prev <= 1) { clearInterval(restRef.current!); setRestKey(null); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  function logSet(ex: Ex) {
    const rawVal = repInput[ex.key] ?? '';
    const reps   = ex.reps === 0 ? 30 : Math.max(0, parseInt(rawVal, 10) || 0);
    if (reps === 0 && ex.reps !== 0) return;
    setLogs(prev => ({ ...prev, [ex.key]: [...(prev[ex.key] ?? []), { reps }] }));
    setRepInput(prev => ({ ...prev, [ex.key]: '' }));
    startRest(ex.key, ex.restSecs);
  }

  function selectProgram(id: ProgramId) {
    const next: GymSt = { ...gymSt, programId: id, dayIdx: 0 };
    setGymSt(next); saveSt(next);
    setLogs({}); setSessionDone(false);
  }

  function completeSession() {
    if (!program || !today) return;
    const rec: SessionRec = {
      date: new Date().toISOString().split('T')[0] ?? '',
      programId: program.id, dayLabel: today.label,
      exs: today.exs.map(ex => ({ key: ex.key, sets: logs[ex.key] ?? [] })),
    };
    const next: GymSt = {
      ...gymSt,
      dayIdx:   gymSt.dayIdx + 1,
      lastDate: rec.date,
      history:  [rec, ...gymSt.history].slice(0, 30),
    };
    setGymSt(next); saveSt(next);
  }

  // ── Session complete ────────────────────────────────────────────────────────
  if (sessionDone && today && program) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '28px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
          <h2 style={{ margin: '0 0 4px', color: '#166534', fontSize: '1.3rem' }}>Workout Complete!</h2>
          <p style={{ margin: '0 0 20px', color: '#16a34a', fontSize: '0.85rem' }}>{program.name} · {today.label}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #dcfce7' }}>
                <th style={{ textAlign: 'left', padding: '6px 4px', color: '#15803d' }}>Exercise</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: '#15803d' }}>Sets done</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: '#15803d' }}>Reps / set</th>
              </tr>
            </thead>
            <tbody>
              {today.exs.map(ex => {
                const exLogs = logs[ex.key] ?? [];
                return (
                  <tr key={ex.key} style={{ borderBottom: '1px solid #f0fdf4' }}>
                    <td style={{ padding: '6px 4px', color: '#166534' }}>{ex.label}</td>
                    <td style={{ textAlign: 'right', padding: '6px 4px' }}>{exLogs.length}/{ex.sets}</td>
                    <td style={{ textAlign: 'right', padding: '6px 4px' }}>
                      {exLogs.map(s => s.reps).join(', ') || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => { completeSession(); setLogs({}); setSessionDone(false); }}
              style={{ flex: 1, padding: '10px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
              Save & Next Session
            </button>
            <button onClick={() => navigate('/dashboard')}
              style={{ flex: 1, padding: '10px 0', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
              Dashboard
            </button>
          </div>
        </div>
        <AiChatPanel pageContext="User just completed a gym workout session." quickPrompts={['How do I recover properly?', 'When should I increase weight?', 'What should I eat post-workout?']} />
      </div>
    );
  }

  // ── Program selector ────────────────────────────────────────────────────────
  if (!gymSt.programId) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', color: '#0f172a' }}>Gym Workout</h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: '0.9rem' }}>Select a program to get started</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {programs.map(p => (
            <button key={p.id} onClick={() => selectProgram(p.id)}
              style={{ textAlign: 'left', padding: '18px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 8 }}>{p.freq}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.days.map(d => (
                  <span key={d.label} style={{ background: '#f1f5f9', padding: '2px 9px', borderRadius: 20, fontSize: '0.75rem', color: '#475569' }}>{d.label}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
        <AiChatPanel pageContext="User is choosing a gym workout program." quickPrompts={['Which program suits a beginner?', 'What is progressive overload?', 'How many rest days should I take?']} />
      </div>
    );
  }

  // ── Today's workout ─────────────────────────────────────────────────────────
  if (!program || !today) return null;

  const nextDayLabel = program.days[(gymSt.dayIdx + 1) % program.days.length]?.label ?? '';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '100px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
            {program.name}
          </div>
          <h1 style={{ margin: '0 0 2px', fontSize: '1.4rem', color: '#0f172a' }}>Today: {today.label}</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>Next up: {nextDayLabel} · Session {gymSt.dayIdx + 1}</p>
        </div>
        <button onClick={() => { setGymSt(s => { const n = { ...s, programId: null }; saveSt(n); return n; }); }}
          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem' }}>
          Change program
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, marginBottom: 22, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#6366f1', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>

      {/* Exercise cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {today.exs.map(ex => {
          const exLogs    = logs[ex.key] ?? [];
          const setsLeft  = ex.sets - exLogs.length;
          const done      = setsLeft <= 0;
          const isActive  = activeKey === ex.key;
          const isResting = restKey === ex.key;
          const hint      = progressHint(ex.key, ex.reps, gymSt.history);
          const targetTxt = ex.reps === 0 ? `${ex.sets} × 30 s hold` : `${ex.sets} × ${ex.reps} reps`;

          return (
            <div key={ex.key} onClick={() => !done && setActiveKey(k => k === ex.key ? null : ex.key)}
              style={{ background: done ? '#f0fdf4' : '#fff', border: `1px solid ${done ? '#bbf7d0' : isActive ? '#6366f1' : '#e2e8f0'}`, borderRadius: 14, overflow: 'hidden', cursor: done ? 'default' : 'pointer', boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Card header */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: done ? '#16a34a' : '#0f172a' }}>{ex.label}</span>
                    {done && <span style={{ fontSize: '0.8rem' }}>✅</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{targetTxt}</div>
                  {hint && <div style={{ fontSize: '0.73rem', color: '#6366f1', marginTop: 2 }}>{hint}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Progress dots */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: ex.sets }).map((_, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < exLogs.length ? '#6366f1' : '#e2e8f0' }} />
                    ))}
                  </div>
                  {!done && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{isActive ? '▲' : '▼'}</span>}
                </div>
              </div>

              {/* Expanded panel */}
              {isActive && !done && (
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px', background: '#fafbff' }}
                  onClick={e => e.stopPropagation()}>
                  {/* Form cue */}
                  <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.5, background: '#f1f5f9', padding: '8px 10px', borderRadius: 8 }}>
                    💡 {ex.formCue}
                    {ex.progressTo && <span style={{ display: 'block', marginTop: 4, color: '#6366f1' }}>Progress to: {ex.progressTo}</span>}
                  </p>

                  {/* Start camera */}
                  {ex.sessionKey && (
                    <button onClick={() => navigate(`/session?exercise=${ex.sessionKey}`)}
                      style={{ width: '100%', padding: '9px 0', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', marginBottom: 10 }}>
                      📷 Start Camera Session
                    </button>
                  )}

                  {/* Log set */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {ex.reps !== 0 ? (
                      <input type="number" min={0} max={50} placeholder={`Reps (target ${ex.reps})`}
                        value={repInput[ex.key] ?? ''}
                        onChange={e => setRepInput(prev => ({ ...prev, [ex.key]: e.target.value }))}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none' }} />
                    ) : (
                      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#f1f5f9', fontSize: '0.82rem', color: '#64748b' }}>
                        Held for 30 s
                      </div>
                    )}
                    <button onClick={() => logSet(ex)}
                      style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0 }}>
                      Log Set {exLogs.length + 1}/{ex.sets}
                    </button>
                  </div>

                  {/* Rest timer */}
                  {isResting && (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', color: '#c2410c', fontWeight: 600 }}>⏱ Rest {restLeft}s</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[60, 90, 120].map(s => (
                          <button key={s} onClick={() => startRest(ex.key, s)}
                            style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${restLeft === s ? '#f97316' : '#fed7aa'}`, background: 'transparent', color: '#c2410c', cursor: 'pointer', fontSize: '0.72rem' }}>
                            {s}s
                          </button>
                        ))}
                        <button onClick={() => { clearInterval(restRef.current!); setRestKey(null); }}
                          style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #fed7aa', background: 'transparent', color: '#c2410c', cursor: 'pointer', fontSize: '0.72rem' }}>
                          Skip
                        </button>
                      </div>
                    </div>
                  )}
                  {!isResting && setsLeft > 0 && exLogs.length > 0 && (
                    <button onClick={() => startRest(ex.key, ex.restSecs)}
                      style={{ marginTop: 8, width: '100%', padding: '7px 0', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: '0.78rem' }}>
                      Start {ex.restSecs}s rest timer
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AiChatPanel
        pageContext={`User is doing a ${program.name} gym workout. Today: ${today.label}. Exercises: ${today.exs.map(e => e.label).join(', ')}.`}
        quickPrompts={['How do I improve my squat form?', 'When should I increase reps?', 'What if an exercise causes pain?']}
      />
    </div>
  );
}
