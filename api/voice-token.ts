// api/voice-token.ts
// LiveKit access token generator for Voice Physiotherapist Agent
// POST { userId, sessionType: 'exercise' | 'consultation' }
// Returns { token: string, url: string }
// Phase 4 — docs/PHASE4_VOICE_AGENT.md

import type { VercelRequest, VercelResponse } from '@vercel/node';

// livekit-server-sdk is an optional Phase 4 dependency — stub until installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AccessToken: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  ({ AccessToken } = require('livekit-server-sdk') as { AccessToken: any });
} catch {
  AccessToken = null;
}

const LIVEKIT_API_KEY    = process.env['LIVEKIT_API_KEY']    ?? '';
const LIVEKIT_API_SECRET = process.env['LIVEKIT_API_SECRET'] ?? '';
const LIVEKIT_URL        = process.env['LIVEKIT_URL']        ?? '';
const TOKEN_TTL          = '2h';

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Method guard
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Config guard (also catches missing package)
  if (!AccessToken || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    res.status(503).json({ error: 'LiveKit not configured — add LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET to env vars and install livekit-server-sdk' });
    return;
  }

  const { userId, sessionType } = req.body as {
    userId?:      string;
    sessionType?: 'exercise' | 'consultation';
  };

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  const type = sessionType === 'consultation' ? 'consultation' : 'exercise';

  // Room name scoped to user + session type (agent joins same room server-side)
  const roomName = `physiocore-${type}-${userId}`;

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      ttl:      TOKEN_TTL,
    });

    at.addGrant({
      roomJoin:     true,
      room:         roomName,
      canPublish:   true,   // patient microphone
      canSubscribe: true,   // hear agent TTS audio
    });

    const token = await at.toJwt();

    res.status(200).json({ token, url: LIVEKIT_URL, roomName });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token generation failed';
    res.status(500).json({ error: message });
  }
}
