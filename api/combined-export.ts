/**
 * combined-export.ts — POST /api/combined-export
 * Aggregates session, posture, ROM, and outcomes data from Supabase.
 * Generates SOAP note via Sonnet. Returns structured export payload.
 * Client generates actual file (PDF/CSV/FHIR) from this payload.
 * SaMD Class II — all output labelled decision support.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db.js';
import { callClaude, extractJson } from './_lib/claude.js';

interface SOAPNote { subjective: string; objective: string; assessment: string; plan: string; }

type DateRange = 'today' | '7d' | '30d';
type Format    = 'pdf' | 'csv' | 'fhir';

interface ExportRequest {
  patientId: string;
  dateRange: DateRange;
  format:    Format;
}

interface SessionRow {
  id: string;
  exercise: string;
  date: string;
  reps: number;
  avg_score: number;
  ai_feedback_summary?: string;
}

interface OutcomeRow {
  date: string;
  nprs?: number;
  psfs_score?: number;
  groc?: number;
}

interface AssessmentRow {
  created_at: string;
  findings?: Record<string, unknown>;
  overall_score?: number;
}

export interface ExportPayload {
  patientId:  string;
  dateRange:  DateRange;
  format:     Format;
  exportedAt: string;
  sessions:   SessionRow[];
  posture:    AssessmentRow[];
  rom:        AssessmentRow[];
  outcomes:   OutcomeRow[];
  soap:       SOAPNote | null;
  fhirBundle: Record<string, unknown> | null;
}

function cutoffDate(range: DateRange): string {
  const d = new Date();
  if (range === 'today') d.setHours(0, 0, 0, 0);
  else if (range === '7d')  d.setDate(d.getDate() - 7);
  else d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function buildFhirBundle(
  patientId: string,
  sessions:  SessionRow[],
  outcomes:  OutcomeRow[],
  soap:      SOAPNote | null,
): Record<string, unknown> {
  const entry: unknown[] = [
    {
      resource: {
        resourceType: 'Patient',
        id: patientId,
        meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Patient'] },
      },
    },
  ];

  for (const s of sessions) {
    entry.push({
      resource: {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '55757-9', display: 'Physical therapy note' }],
          text: s.exercise.replace(/_/g, ' '),
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: s.date,
        valueQuantity: { value: s.avg_score, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
        component: [
          { code: { text: 'Reps' }, valueInteger: s.reps },
          { code: { text: 'Form score' }, valueQuantity: { value: s.avg_score, unit: '%' } },
        ],
      },
    });
  }

  for (const o of outcomes) {
    if (o.nprs != null) {
      entry.push({
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating' }],
            text: 'NPRS pain score',
          },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: o.date,
          valueInteger: o.nprs,
        },
      });
    }
  }

  if (soap) {
    entry.push({
      resource: {
        resourceType: 'ClinicalImpression',
        status: 'completed',
        subject: { reference: `Patient/${patientId}` },
        date: new Date().toISOString(),
        summary: `S: ${soap.subjective} O: ${soap.objective} A: ${soap.assessment} P: ${soap.plan}`,
        note: [{ text: soap.plan }],
      },
    });
  }

  return {
    resourceType: 'Bundle',
    id: `export-${patientId}-${Date.now()}`,
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'] },
    entry,
  };
}

async function generateSoap(
  patientId: string,
  sessions:  SessionRow[],
  outcomes:  OutcomeRow[],
  posture:   AssessmentRow[],
  rom:       AssessmentRow[],
  range:     string,
): Promise<SOAPNote | null> {
  if (sessions.length === 0) return null;

  const avgForm = sessions.reduce((s, r) => s + r.avg_score, 0) / sessions.length;
  const lastNprs = [...outcomes].reverse().find(o => o.nprs != null)?.nprs;
  const exercises = [...new Set(sessions.map(s => s.exercise.replace(/_/g, ' ')))];
  const postureFindings = posture
    .slice(0, 3)
    .flatMap(a => Object.values(a.findings ?? {}).map(v => String(v)).slice(0, 2));
  const romFindings = rom
    .slice(0, 3)
    .flatMap(a => Object.values(a.findings ?? {}).map(v => String(v)).slice(0, 2));

  const system = `You are a senior physiotherapist. Return ONLY valid JSON with keys: subjective, objective, assessment, plan. Each value max 2 sentences. No preamble.`;
  const userMsg = `SOAP note for patientId ${patientId}.
Date range: ${range}. Sessions: ${sessions.length}. Avg form score: ${Math.round(avgForm)}/100.
Exercises: ${exercises.slice(0, 8).join(', ')}.
NPRS: ${lastNprs != null ? lastNprs + '/10' : 'not assessed'}.
Posture: ${postureFindings.slice(0, 3).join('; ') || 'none'}.
ROM: ${romFindings.slice(0, 3).join('; ') || 'none'}.
Return JSON only.`;

  try {
    const raw = await callClaude({ system, userMessage: userMsg, maxTokens: 1000, model: 'claude-sonnet-4-20250514' });
    return extractJson<SOAPNote>(raw);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { patientId, dateRange = '7d', format = 'pdf' } = (req.body ?? {}) as ExportRequest;
  if (!patientId) { res.status(400).json({ error: 'patientId required' }); return; }

  const cutoff = cutoffDate(dateRange);

  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const [sessRes, postRes, romRes, outRes] = await Promise.all([
      db.from('sessions').select('id,exercise,date,reps,avg_score,ai_feedback_summary')
        .eq('patient_id', patientId).gte('date', cutoff).order('date', { ascending: false }),
      db.from('posture_assessments').select('created_at,findings,overall_score')
        .eq('patient_id', patientId).gte('created_at', cutoff).order('created_at', { ascending: false }),
      db.from('rom_assessments').select('created_at,findings,overall_score')
        .eq('patient_id', patientId).gte('created_at', cutoff).order('created_at', { ascending: false }),
      db.from('outcomes').select('date,nprs,psfs_score,groc')
        .eq('patient_id', patientId).gte('date', cutoff).order('date', { ascending: false }),
    ]);

    const sessions: SessionRow[]    = (sessRes.data ?? []) as SessionRow[];
    const posture:  AssessmentRow[] = (postRes.data ?? []) as AssessmentRow[];
    const rom:      AssessmentRow[] = (romRes.data  ?? []) as AssessmentRow[];
    const outcomes: OutcomeRow[]    = (outRes.data  ?? []) as OutcomeRow[];

    const rangeLabel = dateRange === 'today' ? 'today' : dateRange === '7d' ? 'last 7 days' : 'last 30 days';
    const soap       = await generateSoap(patientId, sessions, outcomes, posture, rom, rangeLabel);
    const fhirBundle = format === 'fhir' ? buildFhirBundle(patientId, sessions, outcomes, soap) : null;

    const payload: ExportPayload = {
      patientId,
      dateRange,
      format,
      exportedAt: new Date().toISOString(),
      sessions,
      posture,
      rom,
      outcomes,
      soap,
      fhirBundle,
    };

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Export failed: ${msg}` });
  }
}
