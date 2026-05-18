// api/agents/research-digest.ts
// Vercel cron: Monday 9am SGT (01:00 UTC)
// Schedule: "0 1 * * 1"
//
// Pipeline:
//   1. Auth: Bearer CRON_SECRET
//   2. ResearchAgent → PubMed papers + Haiku digest
//   3. Upsert to research_log (Supabase)
//   4. Send email via Resend to devkapiltech@gmail.com
//
// Supabase table (run once in SQL editor):
// ─────────────────────────────────────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS research_log (
//   id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//   week_of    date        NOT NULL,
//   papers     jsonb       NOT NULL,
//   digest     jsonb       NOT NULL,
//   email_sent boolean     DEFAULT false,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE research_log ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin only" ON research_log
//   FOR ALL TO authenticated
//   USING (
//     EXISTS (
//       SELECT 1 FROM profiles
//       WHERE user_id = auth.uid()
//       AND role IN ('admin','org_admin')
//     )
//   );
// ─────────────────────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient }                        from '@supabase/supabase-js';
import { ResearchAgent }                       from '../../packages/agents/research/src/researchAgent.js';
import type { PubMedPaper, ResearchDigest }    from '../../packages/agents/research/src/researchAgent.js';

// ── Env ────────────────────────────────────────────────────────────────────────

const CRON_SECRET      = process.env['CRON_SECRET'];
const SUPABASE_URL     = process.env['VITE_SUPABASE_URL'] ?? '';
const SUPABASE_SVC_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const RESEND_KEY       = process.env['RESEND_API_KEY'];
const ANTHROPIC_KEY    = process.env['VITE_ANTHROPIC_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? '';
const ADMIN_EMAIL      = 'devkapiltech@gmail.com';
const FROM_EMAIL       = 'noreply@doctoronclick.io';

// ── Supabase ──────────────────────────────────────────────────────────────────

function makeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SVC_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SVC_KEY, { auth: { persistSession: false } });
}

async function persistToSupabase(
  papers:  PubMedPaper[],
  digest:  ResearchDigest,
  weekOf:  string,
): Promise<string | null> {
  const sb = makeSupabase();
  if (!sb) {
    console.warn('[ResearchDigest] Supabase not configured — skipping research_log write');
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('research_log')
      .insert({ week_of: weekOf, papers, digest, email_sent: false })
      .select('id')
      .single();

    if (error) {
      console.error('[ResearchDigest] research_log insert error:', error.message);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.id ?? null;
  } catch (err) {
    console.error('[ResearchDigest] research_log write threw:', err);
    return null;
  }
}

async function markEmailSent(rowId: string): Promise<void> {
  const sb = makeSupabase();
  if (!sb) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any).from('research_log').update({ email_sent: true }).eq('id', rowId);
}

// ── Email via Resend ──────────────────────────────────────────────────────────

function buildEmailHtml(
  papers:  PubMedPaper[],
  digest:  ResearchDigest,
  weekOf:  string,
): string {
  const paperRows = papers.map(p =>
    `<li style="margin-bottom:8px;">
      <strong>${p.title}</strong><br/>
      ${p.authors} — <em>${p.journal}</em> (${p.pubdate})<br/>
      <a href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" style="color:#00D4AA;">PMID:${p.pmid}</a>
      &nbsp;·&nbsp;<small>term: ${p.searchTerm}</small>
    </li>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#050810;color:#F0F4FF;padding:24px;max-width:680px;margin:auto;">
  <h1 style="color:#00D4AA;font-size:20px;">PhysioCore Research Digest</h1>
  <p style="color:#8892A4;">Week of ${weekOf}</p>

  <h2 style="color:#4DB8FF;font-size:16px;">Weekly Theme</h2>
  <p style="background:#0D1420;padding:12px;border-radius:8px;">${digest.weeklyTheme}</p>

  <h2 style="color:#4DB8FF;font-size:16px;">Clinical Insight</h2>
  <p>${digest.clinicalInsight}</p>

  <h2 style="color:#4DB8FF;font-size:16px;">Top Paper</h2>
  <div style="background:#0D1420;padding:12px;border-radius:8px;">
    <strong>${digest.topPaper.title}</strong><br/>
    ${digest.topPaper.authors} — <em>${digest.topPaper.journal}</em><br/>
    <a href="https://pubmed.ncbi.nlm.nih.gov/${digest.topPaper.pmid}/" style="color:#00D4AA;">PMID:${digest.topPaper.pmid}</a><br/>
    <p style="color:#8892A4;margin-top:8px;">${digest.topPaper.relevance}</p>
  </div>

  <h2 style="color:#4DB8FF;font-size:16px;">All Papers (${papers.length})</h2>
  <ul style="padding-left:18px;">${paperRows}</ul>

  <p style="color:#8892A4;font-size:12px;margin-top:24px;">
    PhysioCore AI — SaMD Class II — decision support only
  </p>
</body>
</html>`;
}

async function sendEmail(
  papers:  PubMedPaper[],
  digest:  ResearchDigest,
  weekOf:  string,
): Promise<boolean> {
  if (!RESEND_KEY) {
    console.warn('[ResearchDigest] RESEND_API_KEY not set — skipping email');
    return false;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [ADMIN_EMAIL],
      subject: `PhysioCore Research Digest — week of ${weekOf}`,
      html:    buildEmailHtml(papers, digest, weekOf),
    }),
  });

  if (!res.ok) {
    console.error('[ResearchDigest] Resend error:', res.status, await res.text());
    return false;
  }
  return true;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth
  const auth = req.headers['authorization'];
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'Missing VITE_ANTHROPIC_KEY' });
  }

  const weekOf = new Date().toISOString().slice(0, 10);

  try {
    console.log('[ResearchDigest] Starting PubMed fetch…');
    const agent  = new ResearchAgent(ANTHROPIC_KEY);
    const output = await agent.run();

    console.log(`[ResearchDigest] ${output.papers.length} papers fetched in ${output.processingMs}ms`);

    // Persist to Supabase
    const rowId = await persistToSupabase(output.papers, output.digest, weekOf);

    // Send email
    const emailSent = await sendEmail(output.papers, output.digest, weekOf);

    // Update email_sent flag
    if (rowId && emailSent) await markEmailSent(rowId);

    return res.status(200).json({
      ok:           true,
      weekOf,
      paperCount:   output.papers.length,
      weeklyTheme:  output.digest.weeklyTheme,
      emailSent,
      supabaseRowId: rowId,
      processingMs: output.processingMs,
    });
  } catch (err) {
    console.error('[ResearchDigest] Fatal error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
