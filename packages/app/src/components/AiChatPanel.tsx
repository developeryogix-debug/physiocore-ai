import { useState, useRef, useEffect, useCallback } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatPanelProps {
  pageContext: string;
  quickPrompts?: string[];
}

interface SpeechRecognitionEvent extends Event {
  results: { length: number; [i: number]: { length: number; [j: number]: { transcript: string } } };
}
interface SpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void; stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function AiChatPanel({ pageContext, quickPrompts = [] }: AiChatPanelProps) {
  const { userProfile } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystem = useCallback(() => {
    const profile = userProfile
      ? `User: ${userProfile.name}, ${userProfile.fitnessLevel} fitness, goal: ${userProfile.primaryGoal.replace(/_/g, ' ')}, conditions: ${userProfile.conditions.filter(c => c.isActive).map(c => c.name).join(', ') || 'none'}, injuries: ${userProfile.injuries.filter(i => i.isActive).map(i => `${i.bodyPart}(sev${i.severity})`).join(', ') || 'none'}.`
      : '';
    return `You are a physiotherapy AI assistant embedded in PhysioCore AI. Be concise, evidence-based, and safety-focused. ${profile} ${pageContext}`.trim();
  }, [userProfile, pageContext]);

  const speak = useCallback((text: string) => {
    if (!voiceOut || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 300));
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }, [voiceOut]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const apiKey = (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_API_KEY'];
    if (!apiKey) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages([...history, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 800,
          stream: true,
          system: buildSystem(),
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data) as { type: string; delta?: { type: string; text?: string } };
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              full += parsed.delta.text ?? '';
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: full };
                return next;
              });
            }
          } catch { /* skip malformed lines */ }
        }
      }

      speak(full);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: '⚠ Error — check API key or network.' };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, buildSystem, speak]);

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) { setInput(transcript); }
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recog.start();
    setListening(true);
  }, []);

  const stopVoice = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ask AI"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? '#4338ca' : '#6366f1',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
          fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, transform 0.15s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Drawer */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: 96, right: 28, zIndex: 999,
            width: 360, maxHeight: '70vh',
            background: '#fff', borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            border: '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.18s ease-out',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>🤖</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Ask PhysioCore AI</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setVoiceOut(v => !v)}
                title={voiceOut ? 'Voice output on' : 'Voice output off'}
                style={{ background: voiceOut ? '#ede9fe' : 'transparent', border: '1px solid ' + (voiceOut ? '#a5b4fc' : '#e2e8f0'), borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.8rem', color: voiceOut ? '#6366f1' : '#94a3b8' }}
              >
                🔊
              </button>
              <button
                onClick={() => { setMessages([]); }}
                title="Clear chat"
                style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8' }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && quickPrompts.length > 0 && (
              <div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 10px', textAlign: 'center' }}>Quick questions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quickPrompts.map(q => (
                    <button
                      key={q}
                      onClick={() => void sendMessage(q)}
                      style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', lineHeight: 1.4 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 && quickPrompts.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', margin: 'auto 0' }}>Ask anything about your session, exercises, or health goals.</p>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? '#6366f1' : '#f1f5f9',
                  color: m.role === 'user' ? '#fff' : '#1e293b',
                  fontSize: '0.82rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.content || (streaming && i === messages.length - 1 ? <span style={{ opacity: 0.5 }}>▌</span> : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'flex-end', background: '#fff' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '8px 10px', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.4, maxHeight: 80, overflowY: 'auto',
              }}
            />
            <button
              onClick={() => {
                const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
                if (!SR) return;
                listening ? stopVoice() : startVoice();
              }}
              title={listening ? 'Stop recording' : 'Voice input'}
              style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid ' + (listening ? '#f97316' : '#e2e8f0'), background: listening ? '#fff7ed' : '#f8fafc', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {listening ? '⏹' : '🎤'}
            </button>
            <button
              onClick={() => {
                if (streaming) { abortRef.current?.abort(); setStreaming(false); }
                else void sendMessage(input);
              }}
              disabled={!input.trim() && !streaming}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                background: streaming ? '#f97316' : (!input.trim() ? '#e2e8f0' : '#6366f1'),
                color: '#fff', cursor: (!input.trim() && !streaming) ? 'default' : 'pointer',
                fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {streaming ? '⏹' : '↑'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
