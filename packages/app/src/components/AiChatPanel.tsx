import { useState, useRef, useEffect, useCallback } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { saveChatMessage, loadChatHistory, getRecentSessionSummaries, formatSessionsForPrompt } from '../lib/sessionMemory.js';

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
  const [sessionContext, setSessionContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => { /* placeholder */ });

  // Load chat history + session summaries when panel first opens
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [history, summaries] = await Promise.all([
        loadChatHistory(pageContext.slice(0, 40), 10),
        getRecentSessionSummaries(5),
      ]);
      if (history.length > 0) setMessages(history);
      setSessionContext(formatSessionsForPrompt(summaries));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystem = useCallback(() => {
    const profile = userProfile
      ? `User: ${userProfile.name}, ${userProfile.fitnessLevel} fitness, goal: ${userProfile.primaryGoal.replace(/_/g, ' ')}, conditions: ${userProfile.conditions.filter(c => c.isActive).map(c => c.name).join(', ') || 'none'}, injuries: ${userProfile.injuries.filter(i => i.isActive).map(i => `${i.bodyPart}(sev${i.severity})`).join(', ') || 'none'}.`
      : '';
    return `You are a physiotherapy AI assistant embedded in PhysioCore AI. Be concise, evidence-based, and safety-focused. ${profile} ${sessionContext} ${pageContext}`.trim();
  }, [userProfile, pageContext, sessionContext]);

  const speak = useCallback((text: string) => {
    if (!voiceOut || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 300));
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }, [voiceOut]);

  const sendMessage = useCallback(async (text: string) => {
    console.log('[AiChatPanel] sendMessage called, text:', JSON.stringify(text), 'streaming:', streaming);
    if (!text.trim() || streaming) {
      console.log('[AiChatPanel] blocked — empty:', !text.trim(), 'streaming:', streaming);
      return;
    }
    const apiKey = (import.meta.env as Record<string, string | undefined>)['VITE_ANTHROPIC_API_KEY'];
    if (!apiKey) { console.error('[AiChatPanel] VITE_ANTHROPIC_API_KEY missing'); return; }

    const userMsg: Message = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);
    void saveChatMessage({ role: 'user', content: text.trim(), page: pageContext.slice(0, 40) });

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
      if (full) void saveChatMessage({ role: 'assistant', content: full, page: pageContext.slice(0, 40) });
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

  // Keep ref in sync so voice handler always calls latest sendMessage
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setInput(transcript);
        void sendMessageRef.current(transcript);
      }
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
      void sendMessageRef.current(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Ask AI"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 10001,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: open
            ? 'rgba(8,13,20,0.95)'
            : 'linear-gradient(135deg, var(--teal-500), var(--blue-500))',
          color: open ? 'var(--text-secondary)' : '#000',
          border: open ? '1px solid var(--border-teal)' : 'none',
          cursor: 'pointer',
          boxShadow: open
            ? '0 0 0 1px var(--border-teal), 0 8px 32px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,212,170,0.35)',
          fontSize: open ? '1rem' : '1.1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          transform: open ? 'rotate(45deg)' : 'none',
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Drawer */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 92,
            right: 28,
            zIndex: 10000,
            width: 360,
            maxHeight: '70vh',
            background: 'var(--bg-elevated)',
            borderRadius: 16,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--border-default)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.18s ease-out',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-overlay)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-dot" />
              <span style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
              }}>
                PhysioCore AI
              </span>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.62rem',
                color: 'var(--teal-500)',
                letterSpacing: '0.06em',
              }}>
                ONLINE
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setVoiceOut(v => !v)}
                title={voiceOut ? 'Voice output on' : 'Voice output off'}
                style={{
                  background: voiceOut ? 'var(--teal-dim)' : 'transparent',
                  border: `1px solid ${voiceOut ? 'var(--border-teal)' : 'var(--border-default)'}`,
                  borderRadius: 6,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: voiceOut ? 'var(--teal-500)' : 'var(--text-tertiary)',
                  transition: 'all 0.15s',
                }}
              >
                ♪
              </button>
              <button
                type="button"
                onClick={() => { setMessages([]); }}
                title="Clear chat"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: 'var(--text-tertiary)',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {messages.length === 0 && quickPrompts.length > 0 && (
              <div>
                <p style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-tertiary)',
                  margin: '0 0 10px',
                  textAlign: 'center',
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: '0.06em',
                }}>
                  QUICK QUESTIONS
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quickPrompts.map(q => (
                    <button
                      key={q}
                      onClick={() => void sendMessage(q)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 8,
                        padding: '9px 12px',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        lineHeight: 1.4,
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-teal)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 && quickPrompts.length === 0 && (
              <p style={{
                fontSize: '0.78rem',
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                margin: 'auto 0',
                lineHeight: 1.6,
              }}>
                Ask anything about your session, exercises, or health goals.
              </p>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, var(--teal-600), var(--teal-500))'
                    : 'var(--bg-surface)',
                  color: m.role === 'user' ? '#000' : 'var(--text-primary)',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  borderLeft: m.role === 'assistant' ? '2px solid var(--teal-600)' : 'none',
                }}>
                  {m.content || (streaming && i === messages.length - 1
                    ? <span style={{ opacity: 0.5, fontFamily: "'Space Mono', monospace" }}>▌</span>
                    : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { console.log('[AiChatPanel] input changed:', JSON.stringify(e.target.value)); setInput(e.target.value); }}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const text = inputRef.current?.value ?? input;
                  console.log('[AiChatPanel] Enter pressed, sending:', JSON.stringify(text));
                  void sendMessageRef.current(text);
                }
              }}
              placeholder="Ask a question…"
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: "'Figtree', inherit",
                lineHeight: 1.4,
                maxHeight: 80,
                overflowY: 'auto',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-teal)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
            <button
              type="button"
              onClick={() => {
                const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
                if (!SR) return;
                listening ? stopVoice() : startVoice();
              }}
              title={listening ? 'Stop recording' : 'Voice input'}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: `1px solid ${listening ? 'var(--warning)' : 'var(--border-default)'}`,
                background: listening ? 'rgba(255,184,48,0.1)' : 'var(--bg-elevated)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: listening ? 'var(--warning)' : 'var(--text-tertiary)',
              }}
            >
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
                console.log('[AiChatPanel] send button mousedown, text:', JSON.stringify(text));
                void sendMessageRef.current(text);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: streaming
                  ? 'rgba(255,68,68,0.2)'
                  : (!input.trim() ? 'var(--bg-overlay)' : 'var(--teal-500)'),
                color: streaming ? 'var(--danger)' : (!input.trim() ? 'var(--text-tertiary)' : '#000'),
                cursor: (!input.trim() && !streaming) ? 'default' : 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontWeight: 700,
                transition: 'all 0.15s',
                pointerEvents: 'auto' as const,
              }}
            >
              {streaming ? '⏹' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
