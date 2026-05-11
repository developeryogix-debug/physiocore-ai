import type { VercelRequest, VercelResponse } from '@vercel/node';

export function GET(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
