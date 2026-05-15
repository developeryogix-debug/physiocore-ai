/**
 * useVoiceAgent.ts
 * Phase 4 — Voice Physiotherapist Agent connection layer.
 * Handles: LiveKit room connect/disconnect, Cartesia TTS playback,
 * STT transcript reception via LiveKit data channel.
 *
 * Scaffold: connection layer only — full voice pipeline in Phase 4b.
 * See docs/PHASE4_VOICE_AGENT.md for architecture.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARTESIA_API_URL  = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION  = '2024-06-10';
const CARTESIA_MODEL    = 'sonic-2';
// "Helpful Woman" voice — warm, precise, clinical (Cartesia voice library)
const CARTESIA_VOICE_ID = 'a0e99841-438c-4a64-b679-ae501e7d6091';
const CARTESIA_SAMPLE   = 22050;

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionType = 'exercise' | 'consultation';

export interface VoiceAgentState {
  isConnected: boolean;
  isSpeaking:  boolean;
  transcript:  string;         // last patient utterance (from STT via data channel)
  error:       string | null;
}

export interface VoiceAgentActions {
  connect:    (sessionType?: SessionType) => Promise<void>;
  disconnect: () => Promise<void>;
  speak:      (text: string) => Promise<void>;
}

export type UseVoiceAgentReturn = VoiceAgentState & VoiceAgentActions;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceAgent(userId: string | undefined): UseVoiceAgentReturn {
  const roomRef      = useRef<Room | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const speakAbortRef = useRef<AbortController | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking,  setIsSpeaking]  = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [error,       setError]       = useState<string | null>(null);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect().catch(() => undefined);
      audioCtxRef.current?.close().catch(() => undefined);
      speakAbortRef.current?.abort();
    };
  }, []);

  // ── connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async (sessionType: SessionType = 'exercise') => {
    if (!userId) {
      setError('userId required to connect');
      return;
    }
    if (roomRef.current?.state === ConnectionState.Connected) return;

    setError(null);

    try {
      // 1. Fetch token from serverless function
      const res = await fetch('/api/voice-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, sessionType }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json() as { error: string };
        throw new Error(msg ?? 'Token fetch failed');
      }

      const { token, url } = await res.json() as { token: string; url: string };

      // 2. Create Room and wire events
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setIsConnected(state === ConnectionState.Connected);
      });

      // STT transcript arrives via data channel from server-side agent
      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          const msg  = JSON.parse(text) as { type?: string; text?: string };
          if (msg.type === 'transcript' && msg.text) {
            setTranscript(msg.text);
          }
        } catch {
          // non-JSON data message — ignore
        }
      });

      // 3. Connect
      await room.connect(url, token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LiveKit connection failed';
      setError(msg);
    }
  }, [userId]);

  // ── disconnect ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;

    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setTranscript('');
  }, []);

  // ── speak ───────────────────────────────────────────────────────────────────
  // Calls Cartesia TTS → plays raw PCM f32le via AudioContext.
  // VITE_CARTESIA_API_KEY must be set in .env.local.
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Cancel any in-progress speech
    speakAbortRef.current?.abort();
    const abort = new AbortController();
    speakAbortRef.current = abort;

    const apiKey = import.meta.env['VITE_CARTESIA_API_KEY'] as string | undefined;

    // ── Browser speechSynthesis fallback (no API key required) ─────────────
    if (!apiKey) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.onend   = () => { if (!abort.signal.aborted) setIsSpeaking(false); };
        utterance.onerror  = () => setIsSpeaking(false);
        setIsSpeaking(true);
        setError(null);
        window.speechSynthesis.speak(utterance);
      }
      return;
    }

    setIsSpeaking(true);
    setError(null);

    try {
      const response = await fetch(CARTESIA_API_URL, {
        method:  'POST',
        signal:  abort.signal,
        headers: {
          'X-API-Key':         apiKey,
          'Cartesia-Version':  CARTESIA_VERSION,
          'Content-Type':      'application/json',
        },
        body: JSON.stringify({
          model_id:  CARTESIA_MODEL,
          transcript: text,
          voice: { mode: 'id', id: CARTESIA_VOICE_ID },
          output_format: {
            container:   'raw',
            encoding:    'pcm_f32le',
            sample_rate: CARTESIA_SAMPLE,
          },
          language: 'en',
        }),
      });

      if (!response.ok) {
        throw new Error(`Cartesia TTS error ${response.status}`);
      }

      const buffer    = await response.arrayBuffer();
      const float32   = new Float32Array(buffer);

      // Reuse AudioContext across speaks
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext({ sampleRate: CARTESIA_SAMPLE });
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = ctx.createBuffer(1, float32.length, CARTESIA_SAMPLE);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (!abort.signal.aborted) setIsSpeaking(false);
      };
      source.start();
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'TTS failed');
      setIsSpeaking(false);
    }
  }, []);

  return { isConnected, isSpeaking, transcript, error, connect, disconnect, speak };
}
