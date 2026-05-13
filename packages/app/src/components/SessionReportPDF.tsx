/**
 * SessionReportPDF.tsx
 * Renders a clinical session report as a proper PDF using @react-pdf/renderer.
 * Follows the Vercel-inspired DESIGN.md tokens (white canvas, #171717 ink, #0070f3 accent).
 *
 * Only used via `pdf(<SessionReportPDF {...} />).toBlob()` — never mounted to the DOM.
 */
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// ── DESIGN.md tokens ────────────────────────────────────────────────────────
const C = {
  ink:      '#171717',
  body:     '#4d4d4d',
  muted:    '#888888',
  hairline: '#ebebeb',
  canvas:   '#ffffff',
  soft:     '#fafafa',
  blue:     '#0070f3',
  cyan:     '#50e3c2',
  success:  '#16a34a',
  warning:  '#f5a623',
  danger:   '#ee0000',
  violet:   '#7928ca',
} as const;

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { backgroundColor: C.canvas, paddingHorizontal: 48, paddingVertical: 44, fontFamily: 'Helvetica', fontSize: 10, color: C.body },

  // Gradient accent bar at the top
  accentBar: { height: 3, flexDirection: 'row', marginBottom: 20 },
  accentCyan:    { flex: 1, backgroundColor: C.cyan },
  accentBlue:    { flex: 1, backgroundColor: C.blue },
  accentViolet:  { flex: 1, backgroundColor: C.violet },
  accentWarning: { flex: 1, backgroundColor: C.warning },

  // Header
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.hairline },
  brand:    { fontFamily: 'Helvetica-Bold', fontSize: 14, color: C.ink, marginBottom: 2 },
  tagline:  { fontSize: 8, color: C.muted },
  metaCol:  { alignItems: 'flex-end' },
  metaLine: { fontSize: 8, color: C.muted, marginBottom: 2 },
  metaBold: { fontFamily: 'Helvetica-Bold', color: C.ink },

  // Section
  section:      { marginBottom: 20 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.ink, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.hairline },

  // Stats grid (5 boxes in a row)
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statBox:  { flex: 1, backgroundColor: C.soft, borderWidth: 1, borderColor: C.hairline, borderRadius: 4, padding: 10, alignItems: 'center' },
  statVal:  { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.blue, marginBottom: 2 },
  statLbl:  { fontSize: 6.5, color: C.muted, textTransform: 'uppercase' },

  // Table
  tableWrap:  { borderWidth: 1, borderColor: C.hairline, borderRadius: 4, overflow: 'hidden' },
  tableHead:  { flexDirection: 'row', backgroundColor: C.soft, borderBottomWidth: 1, borderBottomColor: C.hairline },
  tableRow:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.hairline },
  tableRowAlt:{ flexDirection: 'row', backgroundColor: C.soft, borderBottomWidth: 1, borderBottomColor: C.hairline },
  th:         { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.muted, textTransform: 'uppercase', padding: 7 },
  td:         { fontSize: 8.5, color: C.body, padding: 7 },

  // Rep table column widths
  colRep:    { width: '12%' },
  colAngle:  { width: '14%' },
  colScore:  { width: '16%' },
  colTime:   { width: '14%' },
  colFlag:   { width: '44%' },

  // Prescription table column widths
  colExercise: { width: '40%' },
  colSets:     { width: '20%' },
  colFocus:    { width: '40%' },

  // AI Feedback
  feedSummary: { fontSize: 9.5, color: C.body, lineHeight: 1.5, marginBottom: 10 },
  corrRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  badge:       { fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  corrText:    { flex: 1, fontSize: 8.5, color: C.body, lineHeight: 1.4 },
  corrBody:    { fontFamily: 'Helvetica-Bold', color: C.ink },
  motive:      { fontSize: 9, color: C.success, fontFamily: 'Helvetica-Oblique', marginTop: 6 },

  // Safety warnings
  warnBox:  { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 4, padding: 8, marginBottom: 8 },
  warnText: { fontSize: 8.5, color: '#c2410c' },

  // FHIR code block
  codeWrap: { backgroundColor: '#1e293b', borderRadius: 4, padding: 12 },
  codeText: { fontFamily: 'Courier', fontSize: 6.5, color: '#e2e8f0', lineHeight: 1.5 },

  // Footer
  footer:     { position: 'absolute', bottom: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: C.hairline },
  footerText: { fontSize: 7, color: C.muted },
});

// ── Score colour helper ───────────────────────────────────────────────────────
function scoreColor(n: number): string {
  if (n >= 80) return C.success;
  if (n >= 60) return C.warning;
  return C.danger;
}

function priorityBadge(p: string): { bg: string; fg: string } {
  const m: Record<string, { bg: string; fg: string }> = {
    stop:   { bg: '#fee2e2', fg: C.danger },
    high:   { bg: '#ffedd5', fg: '#c2410c' },
    medium: { bg: '#fef9c3', fg: '#92400e' },
    low:    { bg: '#dcfce7', fg: C.success },
  };
  return m[p] ?? m['low']!;
}

// ── Prop types ────────────────────────────────────────────────────────────────
export interface SessionReportProps {
  exercise:     string;
  viewMode:     string;
  sessionNum:   number;
  userName:     string;
  sessionDate:  string;            // ISO date string
  avgScore:     number;
  bestScore:    number;
  tension:      string;            // seconds as string
  mins:         number;
  secs:         number;
  records: Array<{
    num: number; angle: number; score: number; duration: number;
    flag: 'good' | 'too_fast' | 'shallow' | 'invalid';
  }>;
  feedback?: {
    summary: string;
    formCorrections: Array<{ bodyPart: string; priority: string; instruction: string }>;
    motivationalMessage: string;
    nextSteps: string[];
    safetyWarnings: string[];
  };
  prescription: Array<{ name: string; sets: string; focus: string }>;
  fhirJson:     string;
}

const FLAG_LABEL: Record<string, string> = {
  good:     '✓  Good form',
  too_fast: '⚠  Too fast',
  shallow:  '⚠  Shallow depth',
  invalid:  '–  Invalid rep',
};

// ── PDF Document ─────────────────────────────────────────────────────────────
export default function SessionReportPDF({
  exercise, viewMode, sessionNum, userName, sessionDate,
  avgScore, bestScore, tension, mins, secs,
  records, feedback, prescription, fhirJson,
}: SessionReportProps) {
  const exerciseLabel = exercise.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Document title={`PhysioCore AI — ${exerciseLabel} Report`} author="PhysioCore AI">
      <Page size="A4" style={s.page}>

        {/* ── Gradient accent bar ── */}
        <View style={s.accentBar}>
          <View style={s.accentCyan}/>
          <View style={s.accentBlue}/>
          <View style={s.accentViolet}/>
          <View style={s.accentWarning}/>
        </View>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>PhysioCore AI</Text>
            <Text style={s.tagline}>Clinical intelligence for movement health · PDPA Compliant</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLine}><Text style={s.metaBold}>Patient: </Text>{userName}</Text>
            <Text style={s.metaLine}><Text style={s.metaBold}>Exercise: </Text>{exerciseLabel}</Text>
            <Text style={s.metaLine}><Text style={s.metaBold}>View: </Text>{viewMode}  ·  <Text style={s.metaBold}>Session: </Text>#{sessionNum}</Text>
            <Text style={s.metaLine}><Text style={s.metaBold}>Date: </Text>{new Date(sessionDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* ── Summary metrics ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Session Metrics</Text>
          <View style={s.statsRow}>
            {[
              { label: 'Total Reps',       value: records.length.toString() },
              { label: 'Avg Score',         value: `${avgScore}/100` },
              { label: 'Best Score',        value: `${bestScore}/100` },
              { label: 'Time Under Tension',value: `${tension}s` },
              { label: 'Duration',          value: `${mins}m ${secs}s` },
            ].map(({ label, value }) => (
              <View key={label} style={s.statBox}>
                <Text style={s.statVal}>{value}</Text>
                <Text style={s.statLbl}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── AI Feedback ── */}
        {feedback && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>AI Clinical Feedback</Text>

            {feedback.safetyWarnings.length > 0 && (
              <View style={s.warnBox}>
                {feedback.safetyWarnings.map((w, i) => (
                  <Text key={i} style={s.warnText}>⚠  {w}</Text>
                ))}
              </View>
            )}

            <Text style={s.feedSummary}>{feedback.summary}</Text>

            {feedback.formCorrections.map((c, i) => {
              const { bg, fg } = priorityBadge(c.priority);
              return (
                <View key={i} style={s.corrRow}>
                  <Text style={[s.badge, { backgroundColor: bg, color: fg }]}>{c.priority}</Text>
                  <Text style={s.corrText}>
                    <Text style={s.corrBody}>{c.bodyPart.replace(/_/g, ' ')}: </Text>
                    {c.instruction}
                  </Text>
                </View>
              );
            })}

            <Text style={s.motive}>{feedback.motivationalMessage}</Text>
          </View>
        )}

        {/* ── Rep-by-rep breakdown ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Rep-by-Rep Breakdown</Text>
          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colRep]}>Rep</Text>
              <Text style={[s.th, s.colAngle]}>Angle</Text>
              <Text style={[s.th, s.colScore]}>Score</Text>
              <Text style={[s.th, s.colTime]}>Time</Text>
              <Text style={[s.th, s.colFlag]}>Quality</Text>
            </View>
            {records.map((r, i) => (
              <View key={r.num} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, s.colRep]}>{r.num}</Text>
                <Text style={[s.td, s.colAngle]}>{r.angle}°</Text>
                <Text style={[s.td, s.colScore, { color: scoreColor(r.score), fontFamily: 'Helvetica-Bold' }]}>{r.score}/100</Text>
                <Text style={[s.td, s.colTime]}>{r.duration}s</Text>
                <Text style={[s.td, s.colFlag]}>{FLAG_LABEL[r.flag] ?? r.flag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Next session prescription ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Next Session Prescription</Text>
          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colExercise]}>Exercise</Text>
              <Text style={[s.th, s.colSets]}>Sets × Reps</Text>
              <Text style={[s.th, s.colFocus]}>Clinical Focus</Text>
            </View>
            {prescription.map((p, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, s.colExercise, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>{p.name}</Text>
                <Text style={[s.td, s.colSets]}>{p.sets}</Text>
                <Text style={[s.td, s.colFocus]}>{p.focus}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── FHIR R4 Bundle ── */}
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>FHIR R4 Observation Bundle</Text>
          <View style={s.codeWrap}>
            <Text style={s.codeText}>{fhirJson}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>PhysioCore AI · Powered by MediaPipe + Claude AI · PDPA Compliant · Singapore Region</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
