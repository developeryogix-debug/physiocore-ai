/**
 * DownloadReport.tsx — Combined session download: PDF / CSV / FHIR.
 * Props: { patientId, defaultFormat?, compact?, label? }
 * compact=true: icon button → bottom-sheet modal.
 * 3 phases: configure → generating → ready.
 * Clinical Noir design system. SaMD Class II — output is decision support.
 * No hardcoded secrets. Font weight max 600.
 */
import { useState, useCallback } from 'react';
import { pdf, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { SlidingTabs } from './ui/SlidingTabs.js';

// Mirrors api/combined-export.ts ExportPayload (kept local — server file must not be imported in browser)
interface SessionRow    { id: string; exercise: string; date: string; reps: number; avg_score: number; ai_feedback_summary?: string; }
interface OutcomeRow    { date: string; nprs?: number; psfs_score?: number; groc?: number; }
interface AssessmentRow { created_at: string; findings?: Record<string, unknown>; overall_score?: number; }
interface SOAPNote      { subjective: string; objective: string; assessment: string; plan: string; }

interface ExportPayload {
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

// ── Types ────────────────────────────────────────────────────────────────────

type DateRange = 'today' | '7d' | '30d';
type Format    = 'pdf' | 'csv' | 'fhir';
type Phase     = 'configure' | 'generating' | 'ready';

interface DownloadReportProps {
  patientId:     string;
  defaultFormat?: Format;
  compact?:       boolean;
  label?:         string;
}

// ── PDF document (white canvas, monospaced data) ──────────────────────────────

const PS = StyleSheet.create({
  page:    { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#222' },
  bar:     { height: 3, flexDirection: 'row', marginBottom: 18 },
  barTeal: { flex: 1, backgroundColor: '#00D4AA' },
  barBlue: { flex: 1, backgroundColor: '#4DB8FF' },
  h1:      { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sub:     { fontSize: 8, color: '#888', marginBottom: 20 },
  sTitle:  { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6, marginTop: 14,
             borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 3 },
  row:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 4 },
  cell:    { flex: 1, fontSize: 8 },
  cellB:   { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  soap:    { fontSize: 9, lineHeight: 1.6, marginBottom: 6 },
  label:   { fontFamily: 'Helvetica-Bold', marginRight: 4 },
  footer:  { fontSize: 7, color: '#aaa', marginTop: 24, textAlign: 'center' },
});

function CombinedPDF({ data }: { data: ExportPayload }) {
  const avg = data.sessions.length
    ? Math.round(data.sessions.reduce((s, r) => s + r.avg_score, 0) / data.sessions.length)
    : 0;

  return (
    <Document>
      <Page size="A4" style={PS.page}>
        <View style={PS.bar}><View style={PS.barTeal} /><View style={PS.barBlue} /></View>
        <Text style={PS.h1}>PhysioCore AI — Combined Report</Text>
        <Text style={PS.sub}>
          Patient: {data.patientId} · Exported: {new Date(data.exportedAt).toLocaleDateString()} ·
          Range: {data.dateRange === 'today' ? 'Today' : data.dateRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'} ·
          Decision support only — not a clinical diagnosis
        </Text>

        {/* SOAP Note */}
        {data.soap && (
          <>
            <Text style={PS.sTitle}>SOAP Clinical Note</Text>
            {(['subjective','objective','assessment','plan'] as const).map(k => (
              <Text key={k} style={PS.soap}>
                <Text style={PS.label}>{k.charAt(0).toUpperCase() + k.slice(1)}: </Text>
                {data.soap![k]}
              </Text>
            ))}
          </>
        )}

        {/* Session summary */}
        <Text style={PS.sTitle}>Sessions ({data.sessions.length}) · Avg Form Score: {avg}/100</Text>
        <View style={PS.row}>
          {['Date','Exercise','Reps','Score'].map(h => <Text key={h} style={PS.cellB}>{h}</Text>)}
        </View>
        {data.sessions.slice(0, 30).map((s, i) => (
          <View key={i} style={PS.row}>
            <Text style={PS.cell}>{new Date(s.date).toLocaleDateString()}</Text>
            <Text style={PS.cell}>{s.exercise.replace(/_/g,' ')}</Text>
            <Text style={PS.cell}>{s.reps}</Text>
            <Text style={PS.cell}>{s.avg_score}%</Text>
          </View>
        ))}

        {/* Outcomes */}
        {data.outcomes.length > 0 && (
          <>
            <Text style={PS.sTitle}>Outcomes</Text>
            {data.outcomes.slice(0, 10).map((o, i) => (
              <Text key={i} style={PS.soap}>
                {new Date(o.date).toLocaleDateString()} — NPRS: {o.nprs ?? '—'} · PSFS: {o.psfs_score ?? '—'} · GROC: {o.groc ?? '—'}
              </Text>
            ))}
          </>
        )}

        <Text style={PS.footer}>
          PhysioCore AI · SaMD Class II · PDPA compliant (Singapore region) · This report is decision support only.
        </Text>
      </Page>
    </Document>
  );
}

// ── Client-side generators ────────────────────────────────────────────────────

async function generatePdf(data: ExportPayload): Promise<Blob> {
  return pdf(<CombinedPDF data={data} />).toBlob();
}

function generateCsv(data: ExportPayload): Blob {
  const headers = ['Date', 'Exercise', 'Reps', 'Form Score (%)', 'AI Feedback'];
  const rows = data.sessions.map(s => [
    new Date(s.date).toLocaleDateString(),
    s.exercise.replace(/_/g, ' '),
    String(s.reps),
    String(s.avg_score),
    s.ai_feedback_summary ?? '',
  ]);
  if (data.soap) {
    rows.push([]);
    rows.push(['SOAP Note', '', '', '', '']);
    rows.push(['Subjective', data.soap.subjective, '', '', '']);
    rows.push(['Objective',  data.soap.objective,  '', '', '']);
    rows.push(['Assessment', data.soap.assessment, '', '', '']);
    rows.push(['Plan',       data.soap.plan,       '', '', '']);
  }
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return new Blob([csv], { type: 'text/csv' });
}

function generateFhir(data: ExportPayload): Blob {
  return new Blob([JSON.stringify(data.fhirBundle ?? {}, null, 2)], { type: 'application/json' });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.05)',
  padding: 20,
};

const RANGE_TABS = [
  { key: 'today', label: 'Today'    },
  { key: '7d',    label: '7 Days'   },
  { key: '30d',   label: '30 Days'  },
];

const FORMAT_TABS = [
  { key: 'pdf',  label: 'PDF'  },
  { key: 'csv',  label: 'CSV'  },
  { key: 'fhir', label: 'FHIR' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function DownloadReport({ patientId, defaultFormat = 'pdf', compact = false, label }: DownloadReportProps) {
  const [open,      setOpen]      = useState(false);
  const [phase,     setPhase]     = useState<Phase>('configure');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [format,    setFormat]    = useState<Format>(defaultFormat);
  const [error,     setError]     = useState('');
  const [blobUrl,   setBlobUrl]   = useState('');
  const [filename,  setFilename]  = useState('');

  const reset = useCallback(() => {
    setPhase('configure');
    setError('');
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl('');
    setFilename('');
  }, [blobUrl]);

  const handleGenerate = useCallback(async () => {
    setPhase('generating');
    setError('');
    try {
      const res  = await fetch('/api/combined-export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ patientId, dateRange, format }),
      });
      if (!res.ok) throw new Error(`Export API ${res.status}`);
      const data = await res.json() as ExportPayload;

      let blob: Blob;
      let name: string;
      const date = new Date().toISOString().slice(0, 10);

      if (format === 'pdf') {
        blob = await generatePdf(data);
        name = `physiocore-report-${date}.pdf`;
      } else if (format === 'csv') {
        blob = generateCsv(data);
        name = `physiocore-report-${date}.csv`;
      } else {
        blob = generateFhir(data);
        name = `physiocore-fhir-${date}.json`;
      }

      triggerDownload(blob, name);
      setBlobUrl(URL.createObjectURL(blob));
      setFilename(name);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
      setPhase('configure');
    }
  }, [patientId, dateRange, format]);

  // ── Inner panel ────────────────────────────────────────────────────────────

  const inner = (
    <div>
      {phase === 'configure' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace",
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Date Range</div>
            <SlidingTabs tabs={RANGE_TABS} active={dateRange} onChange={k => setDateRange(k as DateRange)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace",
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Format</div>
            <SlidingTabs tabs={FORMAT_TABS} active={format} onChange={k => setFormat(k as Format)} />
          </div>
          {error && (
            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: 12,
              background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </div>
          )}
          <button
            onClick={() => { void handleGenerate(); }}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--teal-500)', color: '#000', fontSize: '0.82rem', fontWeight: 600,
              fontFamily: "'Figtree', sans-serif", transition: 'opacity 0.15s',
            }}
          >
            Generate {format.toUpperCase()} ↓
          </button>
        </>
      )}

      {phase === 'generating' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid var(--teal-500)', borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>
            Generating {format.toUpperCase()}…
          </span>
        </div>
      )}

      {phase === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
          <div style={{ fontSize: '1.4rem', color: 'var(--teal-500)' }}>✓</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', textAlign: 'center' }}>
            Download started
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'Space Mono',monospace" }}>
            {filename}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => { triggerDownload(new Blob(), filename); }}
              style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid rgba(0,212,170,0.3)',
                background: 'transparent', color: 'var(--teal-500)', fontSize: '0.75rem',
                cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>
              Download again
            </button>
            <button onClick={reset}
              style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem',
                cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>
              New export
            </button>
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', textAlign: 'center',
            fontFamily: "'Space Mono',monospace", lineHeight: 1.6, marginTop: 4 }}>
            Decision support only. Not a clinical diagnosis. PDPA compliant.
          </p>
        </div>
      )}
    </div>
  );

  // ── Compact: button + bottom-sheet modal ───────────────────────────────────

  if (compact) {
    return (
      <>
        <button
          onClick={() => { setOpen(true); reset(); }}
          style={{
            padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(0,212,170,0.35)',
            background: 'transparent', color: 'var(--teal-500)', fontSize: '0.75rem',
            cursor: 'pointer', fontFamily: "'Space Mono',monospace", letterSpacing: '0.05em',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,170,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          {label ?? '↓ Export'}
        </button>

        {open && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)', zIndex: 200 }}
            />
            {/* Bottom sheet */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
              background: 'var(--bg-surface)',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
              padding: '20px 24px 36px',
              animation: 'pc-slide-up 0.25s cubic-bezier(0.0,0,0.2,1)',
            }}>
              {/* Handle */}
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.15)',
                margin: '0 auto 20px' }} />
              {/* Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
                  fontFamily: "'Space Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Export Report
                </div>
                <button onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
              </div>
              {inner}
            </div>
          </>
        )}
      </>
    );
  }

  // ── Inline (non-compact) ───────────────────────────────────────────────────

  return (
    <div style={CARD}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        fontFamily: "'Space Mono',monospace", marginBottom: 16 }}>
        {label ?? 'Export Report'}
      </div>
      {inner}
    </div>
  );
}
