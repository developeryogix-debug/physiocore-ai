// api/invite-patient.ts
// Patient invite via Supabase admin + Resend branded email.
// POST { email, orgId, clinicianId, patientName? }
// → supabase.auth.admin.generateLink (service role, no auto-email)
// → Resend branded invite email
// → invites table row for tracking

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env['VITE_SUPABASE_URL'] ?? '';
const SUPABASE_SVC_KEY  = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const RESEND_KEY        = process.env['RESEND_API_KEY'];
const APP_URL           = 'https://app-dteam1-mmcv.vercel.app';

// ── Branded invite email ──────────────────────────────────────────────────────

async function sendBrandedEmail(
  toEmail: string,
  toName: string,
  inviteUrl: string,
): Promise<void> {
  if (!RESEND_KEY) return;
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#050810;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#0d1117;border:1px solid #1e2533;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00D4AA,#4DB8FF);padding:28px 32px;">
    <div style="font-size:1.3rem;font-weight:800;color:#000;letter-spacing:-0.02em;">PhysioCore AI</div>
    <div style="color:rgba(0,0,0,0.65);font-size:0.82rem;margin-top:2px;">Clinical intelligence for movement health</div>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#f1f5f9;font-size:1.15rem;font-weight:700;margin:0 0 16px;">Hi ${toName || 'there'},</h2>
    <p style="color:#94a3b8;line-height:1.7;margin:0 0 20px;">
      Your clinician at <strong style="color:#e2e8f0;">Doctor On Click</strong> has created
      a personalised rehabilitation program for you on PhysioCore AI.
    </p>
    <p style="color:#94a3b8;line-height:1.7;margin:0 0 28px;">
      PhysioCore AI uses your phone camera to track your exercises and provide
      clinical-grade feedback — no wearables needed.
    </p>
    <a href="${inviteUrl}"
       style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#4DB8FF);
              color:#000;font-weight:700;font-size:0.95rem;padding:14px 28px;
              border-radius:10px;text-decoration:none;letter-spacing:-0.01em;">
      Start My Program →
    </a>
    <p style="color:#475569;font-size:0.75rem;margin:24px 0 0;">
      This link expires in 24 hours. If you did not expect this email, you can safely ignore it.
    </p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #1e2533;background:#050810;">
    <p style="color:#334155;font-size:0.7rem;margin:0;">
      PhysioCore AI · Powered by MediaPipe + Claude AI · PDPA Compliant · Singapore Region
    </p>
  </div>
</div>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: 'Your clinician has set up your PhysioCore AI program',
      html,
    }),
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, orgId, clinicianId, patientName } = req.body as {
    email?: string;
    orgId?: string;
    clinicianId?: string;
    patientName?: string;
  };

  if (!email || !orgId || !clinicianId) {
    return res.status(400).json({ error: 'Missing required fields: email, orgId, clinicianId' });
  }

  const adminSb = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate clinician has correct role
  const { data: profile } = await adminSb
    .from('profiles')
    .select('role, org_id')
    .eq('user_id', clinicianId)
    .single();

  if (!profile || !['clinician', 'admin'].includes(profile['role'] as string)) {
    return res.status(403).json({ error: 'Forbidden — clinician or admin role required' });
  }

  // Generate Supabase invite link via service role.
  // generateLink type:'invite' creates the user + magic link WITHOUT auto-sending
  // Supabase's own generic email — we send our branded email instead.
  const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { org_id: orgId, role: 'patient', invited_by: clinicianId },
      redirectTo: `${APP_URL}/onboard`,
    },
  });

  if (linkErr || !linkData) {
    return res.status(500).json({ error: linkErr?.message ?? 'Failed to generate invite link' });
  }

  const userId    = linkData.user.id;
  const inviteUrl = linkData.properties.action_link;

  // Send branded Resend email (non-fatal if Resend key missing)
  await sendBrandedEmail(email, patientName ?? '', inviteUrl).catch(() => undefined);

  // Track invite in table (non-fatal — used for audit log)
  await adminSb.from('invites').insert({
    org_id:      orgId,
    invited_by:  clinicianId,
    email,
    role:        'patient',
    token:       userId,
    expires_at:  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).catch(() => undefined);

  return res.status(200).json({ success: true, userId });
}
