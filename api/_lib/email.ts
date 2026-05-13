import { Resend } from 'resend';

const resend = new Resend(process.env['RESEND_API_KEY'] ?? '');
const TO = 'devkapilicloud@gmail.com';
const FROM = 'onboarding@resend.dev';

export interface AlertPayload {
  service: string;
  error: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  rootCause: string;
  fixSteps: string[];
  eta: string;
}

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const color = payload.severity === 'CRITICAL' ? '#ef4444' : payload.severity === 'WARNING' ? '#f59e0b' : '#6b7280';
  const icon = payload.severity === 'CRITICAL' ? '🔴' : payload.severity === 'WARNING' ? '🟡' : 'ℹ️';

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `[${payload.severity}] PhysioCore AI — ${payload.service} issue detected`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d1420;color:#f0f4ff;padding:32px;border-radius:12px">
        <div style="border-left:4px solid ${color};padding-left:16px;margin-bottom:24px">
          <h2 style="margin:0;color:${color}">${icon} ${payload.severity}: ${payload.service}</h2>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#8892a4;width:120px">Service</td><td style="color:#f0f4ff">${payload.service}</td></tr>
          <tr><td style="padding:8px 0;color:#8892a4">Error</td><td style="color:#f0f4ff;font-family:monospace;font-size:0.85em">${payload.error}</td></tr>
          <tr><td style="padding:8px 0;color:#8892a4">Root cause</td><td style="color:#f0f4ff">${payload.rootCause}</td></tr>
          <tr><td style="padding:8px 0;color:#8892a4">ETA to fix</td><td style="color:#00d4aa">${payload.eta}</td></tr>
        </table>
        <div style="margin-top:24px">
          <p style="color:#8892a4;margin-bottom:8px">Fix steps:</p>
          <ol style="color:#f0f4ff;padding-left:20px;line-height:1.8">${payload.fixSteps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:12px">
          <a href="https://vercel.com/dashboard" style="color:#4db8ff;text-decoration:none">Vercel Dashboard</a>
          <span style="color:#4a5568">·</span>
          <a href="https://supabase.com/dashboard" style="color:#4db8ff;text-decoration:none">Supabase Dashboard</a>
          <span style="color:#4a5568">·</span>
          <a href="https://app-dteam1-mmcv.vercel.app" style="color:#4db8ff;text-decoration:none">Live App</a>
        </div>
        <p style="margin-top:16px;color:#4a5568;font-size:0.75em">PhysioCore AI Monitor · ${new Date().toISOString()}</p>
      </div>
    `,
  });
}

export interface WeeklyReportPayload {
  weekOf: string;
  sessions: number;
  avgFormScore: number;
  newUsers: number;
  healthFailures: number;
  topErrors: string[];
  summary: string;
  priorities: string[];
}

export async function sendWeeklyReport(payload: WeeklyReportPayload): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `📊 PhysioCore AI — Weekly Report (${payload.weekOf})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d1420;color:#f0f4ff;padding:32px;border-radius:12px">
        <h2 style="color:#00d4aa;margin-bottom:4px">PhysioCore AI — Weekly Report</h2>
        <p style="color:#8892a4;margin-top:0">Week of ${payload.weekOf}</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0">
          ${[
            { label: 'Sessions', value: payload.sessions },
            { label: 'Avg Form Score', value: `${payload.avgFormScore}/100` },
            { label: 'New Users', value: payload.newUsers },
            { label: 'Health Failures', value: payload.healthFailures },
          ].map(m => `
            <div style="background:#121b2e;border-radius:8px;padding:16px;text-align:center">
              <div style="font-size:1.5em;font-weight:700;color:#00d4aa;font-family:monospace">${m.value}</div>
              <div style="font-size:0.75em;color:#8892a4;margin-top:4px">${m.label}</div>
            </div>
          `).join('')}
        </div>
        <div style="background:#121b2e;border-radius:8px;padding:20px;margin-bottom:20px">
          <h3 style="color:#4db8ff;margin-top:0">AI Summary</h3>
          <p style="color:#f0f4ff;line-height:1.7;white-space:pre-line">${payload.summary}</p>
        </div>
        <div style="background:#121b2e;border-radius:8px;padding:20px">
          <h3 style="color:#4db8ff;margin-top:0">This week's priorities</h3>
          <ol style="color:#f0f4ff;padding-left:20px;line-height:2">${payload.priorities.map(p => `<li>${p}</li>`).join('')}</ol>
        </div>
        ${payload.topErrors.length ? `
        <div style="margin-top:20px;padding:16px;background:#1a0a0a;border-radius:8px;border:1px solid rgba(239,68,68,0.2)">
          <p style="color:#8892a4;margin:0 0 8px">Top errors this week:</p>
          <ul style="color:#fca5a5;padding-left:20px;margin:0">${payload.topErrors.map(e => `<li style="font-family:monospace;font-size:0.85em">${e}</li>`).join('')}</ul>
        </div>` : ''}
        <p style="margin-top:24px;color:#4a5568;font-size:0.75em">PhysioCore AI Monitor · Auto-generated ${new Date().toISOString()}</p>
      </div>
    `,
  });
}

export async function sendCostAlert(severity: 'WARNING' | 'CRITICAL', dailySpend: number, threshold: number): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `[${severity}] PhysioCore AI — Daily AI spend $${dailySpend.toFixed(2)} exceeds $${threshold}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d1420;color:#f0f4ff;padding:32px;border-radius:12px">
        <h2 style="color:${severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}">${severity === 'CRITICAL' ? '🔴' : '🟡'} Cost Alert: ${severity}</h2>
        <p>Today's estimated Anthropic API spend: <strong style="color:#00d4aa;font-family:monospace">$${dailySpend.toFixed(4)}</strong></p>
        <p>Threshold: <strong style="font-family:monospace">$${threshold.toFixed(2)}</strong></p>
        <p style="color:#8892a4">Check Anthropic console for exact usage. Consider reducing session frequency or capping token usage.</p>
        <a href="https://console.anthropic.com" style="color:#4db8ff">→ Anthropic Console</a>
      </div>
    `,
  });
}
