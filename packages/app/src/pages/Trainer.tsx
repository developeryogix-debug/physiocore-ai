import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { supabase } from '@physiocore/supabase';
import { getRecentSessionSummaries, formatSessionsForPrompt } from '../lib/sessionMemory.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const MODEL = 'claude-sonnet-4-20250514';
const API = 'https://api.anthropic.com/v1/messages';

const QUICK_CHIPS = [
  'Plan my session for today',
  'My knee hurts — what should I do?',
  'Am I ready to progress my squats?',
  'Teach me Warrior I in Sanskrit',
  'What supplements do I actually need?',
  'Review my last 3 sessions',
  'Write a progress note for my physio',
  'I am vegetarian — adjust my protein plan',
];

interface Msg { role: 'user' | 'assistant'; content: string; }
interface TrainerSession { id: string; title: string; created_at: string; }

interface SpeechRecognitionEvent extends Event {
  results: { length: number; [i: number]: { length: number; [j: number]: { transcript: string } } };
}
interface SpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
declare global { interface Window { SpeechRecognition: new () => SpeechRecognition; webkitSpeechRecognition: new () => SpeechRecognition; } }

export default function Trainer() {
  const { userProfile } = useUserProfile();
  const [sessions, setSessions] = useState<TrainerSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [listening, setListening] = useState(false);
  const [sessionCtx, setSessionCtx] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<(text: string) => Promise<void>>(async () => { /* placeholder */ });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    void loadSessions();
    void getRecentSessionSummaries(5).then(s => setSessionCtx(formatSessionsForPrompt(s)));
  }, []);

  async function loadSessions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { data } = await db.from('trainer_sessions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    const rows = (data ?? []) as TrainerSession[];
    setSessions(rows);
    if (rows.length > 0 && !activeId) {
      setActiveId(rows[0]!.id);
      await loadMessages(rows[0]!.id);
    }
  }

  async function loadMessages(sessionId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { data } = await db.from('trainer_messages').select('role,content').eq('session_id', sessionId).eq('user_id', session.user.id).order('created_at', { ascending: true });
    setMessages((data ?? []) as Msg[]);
  }

  async function newSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const { data } = await db.from('trainer_sessions').insert({ user_id: session.user.id, title: 'New conversation' }).select().single();
    if (!data) return;
    const created = data as TrainerSession;
    setSessions(prev => [created, ...prev]);
    setActiveId(created.id);
    setMessages([]);
  }

  async function saveMessage(sessionId: string, msg: Msg) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.from('trainer_messages').insert({ session_id: sessionId, user_id: session.user.id, role: msg.role, content: msg.content });
  }

  async function updateSessionTitle(sessionId: string, title: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.from('trainer_sessions').update({ title: title.slice(0, 60) }).eq('id', sessionId);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: title.slice(0, 60) } : s));
  }

  function buildSystem(): string {
    const p = userProfile;
    const profile = p
      ? `User: ${p.name}, ${p.fitnessLevel} fitness level, goal: ${p.primaryGoal?.replace(/_/g, ' ') ?? 'general health'}. Conditions: ${p.conditions.filter(c => c.isActive).map(c => c.name).join(', ') || 'none'}. Injuries: ${p.injuries.filter(i => i.isActive).map(i => `${i.bodyPart} sev${i.severity}`).join(', ') || 'none'}.`
      : '';
    return `You are PhysioCore AI — expert physiotherapist (APAM), yoga teacher (RYT-500 Sanskrit tradition), Pilates instructor (STOTT), strength coach (CSCS), and sports nutritionist (ISSN-SNS). Evidence-based, XAI-grade reasoning.

${profile}
${sessionCtx}

Always cite evidence grade (A/B/C/D). Use Latin anatomy terms with plain English in parentheses. Use Sanskrit names for yoga poses followed by English. Flag when in-person assessment is needed. Be concise, warm, and safety-focused.`.trim();
  }

  const sendMessage = useCallback(async (text: string) => {
    console.log('[Trainer] sendMessage called, text:', JSON.stringify(text), 'streaming:', streaming);
    if (!text.trim() || streaming) {
      console.log('[Trainer] blocked — empty:', !text.trim(), 'streaming:', streaming);
      return;
    }
    const apiKey = (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_API_KEY'];
    if (!apiKey) { console.error('[Trainer] VITE_ANTHROPIC_API_KEY missing'); return; }

    let sessionId = activeId;
    if (!sessionId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const { data } = await db.from('trainer_sessions').insert({ user_id: session.user.id, title: text.slice(0, 60) }).select().single();
        if (data) { const s = data as TrainerSession; sessionId = s.id; setActiveId(s.id); setSessions(prev => [s, ...prev]); }
      }
    }

    const userMsg: Msg = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);
    if (sessionId) void saveMessage(sessionId, userMsg);

    // Auto-title after first user message
    if (messages.length === 0 && sessionId) void updateSessionTitle(sessionId, text.trim());

    const assistantMsg: Msg = { role: 'assistant', content: '' };
    setMessages([...history, assistantMsg]);
    abortRef.current = new AbortController();

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1200, stream: true, system: buildSystem(), messages: history.map(m => ({ role: m.role, content: m.content })) }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`API ${res.status}`);
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        for (const line of dec.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim(); if (d === '[DONE]') break;
          try {
            const p = JSON.parse(d) as { type: string; delta?: { type: string; text?: string } };
            if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') {
              full += p.delta.text ?? '';
              setMessages(prev => { const n = [...prev]; const l = n[n.length - 1]; if (l?.role === 'assistant') n[n.length - 1] = { ...l, content: full }; return n; });
            }
          } catch { /* skip */ }
        }
      }
      if (full && sessionId) void saveMessage(sessionId, { role: 'assistant', content: full });
      if (voiceOut && window.speechSynthesis && full) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(full.slice(0, 400)); u.rate = 1.05; window.speechSynthesis.speak(u);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => { const n = [...prev]; const l = n[n.length - 1]; if (l?.role === 'assistant') n[n.length - 1] = { ...l, content: '⚠ Error — check API key or connection.' }; return n; });
      }
    } finally { setStreaming(false); abortRef.current = null; }
  }, [messages, streaming, activeId, voiceOut, sessionCtx]);

  useEffect(() => { sendRef.current = sendMessage; }, [sendMessage]);

  function startVoice() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); recogRef.current = r; r.lang = 'en-US'; r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0]?.[0]?.transcript ?? '';
      if (t) { setInput(t); void sendRef.current(t); }
    };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    r.start(); setListening(true);
  }

  function exportPDF() {
    const lines = messages.map(m => `<p><strong>${m.role === 'user' ? 'You' : 'PhysioCore AI'}:</strong> ${m.content.replace(/\n/g, '<br>')}</p>`).join('');
    const html = `<!DOCTYPE html><html><head><title>PhysioCore AI Trainer Chat</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1e293b}strong{color:#0369a1}</style></head><body><h1>PhysioCore AI — Trainer Chat Export</h1><p style="color:#64748b">${new Date().toLocaleDateString()}</p>${lines}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.addEventListener('load', () => w.print()); }
  }

  const SIDEBAR_W = 240;

  return (
    <div style={{ paddingTop: 80, display: 'flex', height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: SIDEBAR_W, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: 'var(--teal-500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>AI Trainer</p>
          <button onClick={() => void newSession()} className="btn-primary" style={{ width: '100%', fontSize: '0.78rem', padding: '8px' }}>+ New Conversation</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {sessions.length === 0 && <p style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No conversations yet</p>}
          {sessions.map(s => (
            <button key={s.id} onClick={async () => { setActiveId(s.id); await loadMessages(s.id); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: s.id === activeId ? 'var(--teal-dim)' : 'transparent', border: 'none', borderLeft: `2px solid ${s.id === activeId ? 'var(--teal-500)' : 'transparent'}`, cursor: 'pointer', fontSize: '0.78rem', color: s.id === activeId ? 'var(--teal-500)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title || 'New conversation'}
              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" />
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '0.9rem' }}>PhysioCore AI Trainer</span>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', color: 'var(--teal-500)', letterSpacing: '0.06em' }}>APAM · RYT-500 · CSCS · ISSN</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setVoiceOut(v => !v)} title={voiceOut ? 'Voice output on' : 'Voice output off'} style={{ background: voiceOut ? 'var(--teal-dim)' : 'transparent', border: `1px solid ${voiceOut ? 'var(--border-teal)' : 'var(--border-default)'}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', color: voiceOut ? 'var(--teal-500)' : 'var(--text-tertiary)' }}>♪ Voice</button>
            <button onClick={exportPDF} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>↓ Export PDF</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 560 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>What can I help you with?</div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginBottom: 24 }}>Your expert physiotherapist, yoga teacher, strength coach, and nutritionist — all in one.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK_CHIPS.map(q => (
                  <button key={q} onClick={() => void sendMessage(q)} style={{ textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.4, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-teal)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.role === 'user' ? 'linear-gradient(135deg,var(--teal-600),var(--teal-500))' : 'var(--bg-surface)', color: m.role === 'user' ? '#000' : 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: m.role === 'assistant' ? '2px solid var(--teal-600)' : 'none' }}>
                {m.content || (streaming && i === messages.length - 1 ? <span style={{ opacity: 0.4, fontFamily: "'Space Mono',monospace" }}>▌</span> : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { console.log('[Trainer] input changed:', JSON.stringify(e.target.value)); setInput(e.target.value); }}
            placeholder="Ask your AI trainer…"
            rows={2}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            spellCheck={false}
            autoComplete="off"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = inputRef.current?.value ?? input;
                console.log('[Trainer] Enter pressed, sending:', JSON.stringify(text));
                void sendRef.current(text);
              }
            }}
            style={{ flex: 1, resize: 'none', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontFamily: "'Figtree',inherit", lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-teal)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          />
          <button
            type="button"
            onClick={() => { const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition; if (!SR) return; listening ? recogRef.current?.stop() : startVoice(); }}
            style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${listening ? 'var(--warning)' : 'var(--border-default)'}`, background: listening ? 'rgba(255,184,48,0.1)' : 'var(--bg-surface)', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: listening ? 'var(--warning)' : 'var(--text-tertiary)', pointerEvents: 'auto' as const }}>
            {listening ? '⏹' : '🎤'}
          </button>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              if (streaming) {
                abortRef.current?.abort();
                setStreaming(false);
                return;
              }
              const text = inputRef.current?.value ?? input;
              console.log('[Trainer] send button mousedown, text:', JSON.stringify(text));
              void sendRef.current(text);
            }}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: streaming ? 'rgba(255,68,68,0.2)' : (!input.trim() ? 'var(--bg-overlay)' : 'var(--teal-500)'), color: streaming ? 'var(--danger)' : (!input.trim() ? 'var(--text-tertiary)' : '#000'), cursor: !input.trim() && !streaming ? 'default' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 600, transition: 'all 0.15s', pointerEvents: 'auto' as const }}>
            {streaming ? '⏹' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
