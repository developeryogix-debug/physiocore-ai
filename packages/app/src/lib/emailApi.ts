/**
 * emailApi.ts — Resend email integration
 *
 * Requires VITE_RESEND_API_KEY in .env.local
 * In production, move to a Supabase Edge Function to protect the API key.
 * Resend API reference: https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY as string | undefined;
const FROM_EMAIL = 'PhysioCore AI <noreply@physiocore.ai>';
const APP_URL    = typeof window !== 'undefined' ? window.location.origin : 'https://physiocore.ai';

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) {
    console.warn('[emailApi] VITE_RESEND_API_KEY not set — email not sent. Invite link:', html.match(/href="([^"]+)"/)?.[1]);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    return res.ok;
  } catch (e) {
    console.error('[emailApi] send failed', e);
    return false;
  }
}

// ── Patient invite ────────────────────────────────────────────────────────────

export async function sendPatientInvite(opts: {
  toEmail: string;
  toName: string;
  clinicianName: string;
  orgName: string;
  inviteToken: string;
}): Promise<boolean> {
  const link = `${APP_URL}/signup?invite=${opts.inviteToken}`;
  const subject = `${opts.clinicianName} has set up your PhysioCore AI program`;
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#050810;font-family:'Figtree',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#0d1117;border:1px solid #1e2533;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00D4AA,#4DB8FF);padding:28px 32px;">
    <div style="font-size:1.3rem;font-weight:800;color:#000;letter-spacing:-0.02em;">PhysioCore AI</div>
    <div style="color:rgba(0,0,0,0.65);font-size:0.82rem;margin-top:2px;">Clinical intelligence for movement health</div>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#f1f5f9;font-size:1.15rem;font-weight:700;margin:0 0 16px;">Hi ${opts.toName || 'there'},</h2>
    <p style="color:#94a3b8;line-height:1.7;margin:0 0 20px;">
      <strong style="color:#e2e8f0;">${opts.clinicianName}</strong> at <strong style="color:#e2e8f0;">${opts.orgName}</strong>
      has created a personalised rehabilitation program for you on PhysioCore AI.
    </p>
    <p style="color:#94a3b8;line-height:1.7;margin:0 0 28px;">
      PhysioCore AI uses your phone camera to track your exercises and give you
      clinical-grade feedback — no wearables needed.
    </p>
    <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#4DB8FF);color:#000;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.01em;">
      Start My Program →
    </a>
    <p style="color:#475569;font-size:0.75rem;margin:24px 0 0;">
      This link expires in 7 days. If you did not expect this email, you can safely ignore it.
    </p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #1e2533;background:#050810;">
    <p style="color:#334155;font-size:0.7rem;margin:0;">PhysioCore AI · Powered by MediaPipe + Claude AI · PDPA Compliant</p>
  </div>
</div>
</body></html>`;
  return sendEmail(opts.toEmail, subject, html);
}

// ── Clinician invite ──────────────────────────────────────────────────────────

export async function sendClinicianInvite(opts: {
  toEmail: string;
  toName: string;
  orgAdminName: string;
  orgName: string;
  inviteToken: string;
}): Promise<boolean> {
  const link = `${APP_URL}/signup?invite=${opts.inviteToken}`;
  const subject = `You've been invited to join ${opts.orgName} on PhysioCore AI`;
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#050810;font-family:'Figtree',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#0d1117;border:1px solid #1e2533;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00D4AA,#4DB8FF);padding:28px 32px;">
    <div style="font-size:1.3rem;font-weight:800;color:#000;letter-spacing:-0.02em;">PhysioCore AI</div>
    <div style="color:rgba(0,0,0,0.65);font-size:0.82rem;margin-top:2px;">Clinical intelligence for movement health</div>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#f1f5f9;font-size:1.15rem;font-weight:700;margin:0 0 16px;">Hi ${opts.toName || 'there'},</h2>
    <p style="color:#94a3b8;line-height:1.7;margin:0 0 20px;">
      <strong style="color:#e2e8f0;">${opts.orgAdminName}</strong> has invited you to join
      <strong style="color:#e2e8f0;">${opts.orgName}</strong> as a clinician on PhysioCore AI.
    </p>
    <p style="color:#94a3b8;line-height:1.7;margin:0 0 28px;">
      You'll be able to monitor patient sessions, generate SOAP notes,
      and export FHIR R4 data.
    </p>
    <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#4DB8FF);color:#000;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.01em;">
      Accept Invitation →
    </a>
    <p style="color:#475569;font-size:0.75rem;margin:24px 0 0;">This link expires in 7 days.</p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #1e2533;background:#050810;">
    <p style="color:#334155;font-size:0.7rem;margin:0;">PhysioCore AI · Powered by MediaPipe + Claude AI · PDPA Compliant</p>
  </div>
</div>
</body></html>`;
  return sendEmail(opts.toEmail, subject, html);
}

/** Returns the invite signup URL (for copy-link fallback when Resend key missing) */
export function getInviteLink(token: string): string {
  return `${APP_URL}/signup?invite=${token}`;
}
