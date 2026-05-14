/**
 * ROMReportPDF.tsx — Range-of-Motion assessment PDF (patient + clinician variants)
 * @react-pdf/renderer — matches PostureReportPDF pattern.
 */
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:      '#171717',
  body:     '#4d4d4d',
  muted:    '#888888',
  hairline: '#ebebeb',
  canvas:   '#ffffff',
  soft:     '#f8f9fa',
  teal:     '#00D4AA',
  blue:     '#4DB8FF',
  success:  '#16a34a',
  warning:  '#d97706',
  danger:   '#dc2626',
  darkBg:   '#050810',
  darkText: '#F0F4FF',
} as const;

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    backgroundColor: C.canvas,
    paddingHorizontal: 48,
    paddingVertical: 44,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.body,
  },
  coverPage: {
    backgroundColor: C.darkBg,
    paddingHorizontal: 64,
    paddingVertical: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.darkText,
    justifyContent: 'space-between',
  },
  accentBar:  { height: 4, flexDirection: 'row', marginBottom: 24 },
  accentTeal: { flex: 1, backgroundColor: C.teal },
  accentBlue: { flex: 1, backgroundColor: C.blue },
  accentGrn:  { flex: 1, backgroundColor: C.success },
  accentWarn: { flex: 1, backgroundColor: C.warning },

  coverBrand:    { fontFamily: 'Helvetica-Bold', fontSize: 28, color: C.teal, marginBottom: 4 },
  coverTagline:  { fontSize: 11, color: '#8892A4', marginBottom: 48 },
  coverTitle:    { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.darkText, marginBottom: 8 },
  coverSubtitle: { fontSize: 12, color: '#8892A4', marginBottom: 40 },
  coverMeta:     { fontSize: 10, color: '#8892A4', marginBottom: 6 },
  coverMetaBold: { fontFamily: 'Helvetica-Bold', color: C.darkText },
  coverDisc:     { fontSize: 8, color: '#4a5568', marginTop: 32, lineHeight: 1.5 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.hairline,
  },
  brand:    { fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.ink, marginBottom: 2 },
  subBrand: { fontSize: 8, color: C.muted },
  pageNum:  { fontSize: 8, color: C.muted },

  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 12, color: C.ink,
    marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: C.hairline,
  },
  section: { marginBottom: 20 },

  row:   { flexDirection: 'row', gap: 8 },
  col50: { flex: 1 },

  // test result card
  card: {
    borderWidth: 1, borderColor: C.hairline, borderRadius: 6,
    padding: 12, marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel:  { fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.ink },
  cardAngle:  { fontFamily: 'Helvetica-Bold', fontSize: 14, color: C.teal },
  cardNorm:   { fontSize: 8, color: C.muted, marginBottom: 4 },
  badgeRow:   { flexDirection: 'row', gap: 6 },
  badge: {
    fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
    fontFamily: 'Helvetica-Bold',
  },
  badgeNormal: { backgroundColor: '#dcfce7', color: C.success },
  badgeMild:   { backgroundColor: '#fef9c3', color: '#92400e' },
  badgeSig:    { backgroundColor: '#fee2e2', color: C.danger },

  // asymmetry table
  tableHeader: {
    flexDirection: 'row', backgroundColor: C.soft, padding: 6,
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
    borderWidth: 1, borderColor: C.hairline,
  },
  tableRow: {
    flexDirection: 'row', padding: 6,
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: C.hairline,
  },
  tableCell:  { flex: 1, fontSize: 9, color: C.body },
  tableHead:  { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  alertCell:  { flex: 1, fontSize: 9, color: C.danger, fontFamily: 'Helvetica-Bold' },

  // summary box
  summaryBox: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 6, padding: 14, marginBottom: 14,
  },
  summaryText: { fontSize: 10, color: '#166534', lineHeight: 1.6 },
  summaryHigh: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  summaryHighText: { color: '#991b1b' },
  summaryMod:  { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  summaryModText: { color: '#92400e' },

  // soap note (clinician)
  soapLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.teal, marginBottom: 2 },
  soapText:  { fontSize: 9, color: C.body, lineHeight: 1.6, marginBottom: 10 },

  disclaimer: { fontSize: 7, color: C.muted, lineHeight: 1.5, marginTop: 16, borderTopWidth: 1, borderTopColor: C.hairline, paddingTop: 8 },
  footer:     { fontSize: 8, color: C.muted, textAlign: 'center', marginTop: 12 },
});

// ── Types (must match GuidedROMAssessment.tsx) ────────────────────────────────
interface ROMResult {
  key: string; joint: string; movement: string; side: 'right' | 'left';
  angle: number; clinicalLabel: string; status: 'normal' | 'mild' | 'significant';
}
interface Asymmetry { movement: string; joint: string; rightDeg: number; leftDeg: number; diff: number; }
interface Interp {
  summary: string;
  findings: { joint: string; finding: string }[];
  soap: string;
  overallRisk: 'low' | 'moderate' | 'high';
  referral: boolean;
}

interface ROMReportPDFProps {
  results:      ROMResult[];
  asymmetries:  Asymmetry[];
  interp:       Interp;
  userName:     string;
  variant:      'patient' | 'clinician';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function badgeStyle(status: ROMResult['status']) {
  if (status === 'normal')      return [s.badge, s.badgeNormal];
  if (status === 'mild')        return [s.badge, s.badgeMild];
  return [s.badge, s.badgeSig];
}
function badgeLabel(status: ROMResult['status']) {
  if (status === 'normal')      return 'NORMAL';
  if (status === 'mild')        return 'MILD DEFICIT';
  return 'SIGNIFICANT';
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PageHeader({ title, pageNum }: { title: string; pageNum: string }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.brand}>PhysioCore AI</Text>
        <Text style={s.subBrand}>ROM Assessment — {title}</Text>
      </View>
      <Text style={s.pageNum}>{pageNum}</Text>
    </View>
  );
}

function AccentBar() {
  return (
    <View style={s.accentBar}>
      <View style={s.accentTeal} /><View style={s.accentBlue} />
      <View style={s.accentGrn} /><View style={s.accentWarn} />
    </View>
  );
}

function TestCard({ r }: { r: ROMResult }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardLabel}>{r.joint} {r.movement} — {r.side.toUpperCase()}</Text>
        <Text style={s.cardAngle}>{r.angle}°</Text>
      </View>
      <Text style={s.cardNorm}>Normal range: {r.clinicalLabel}</Text>
      <View style={s.badgeRow}>
        <Text style={badgeStyle(r.status)}>{badgeLabel(r.status)}</Text>
      </View>
    </View>
  );
}

// ── Cover page ────────────────────────────────────────────────────────────────
function CoverPage({ userName, variant, interp, date }: { userName: string; variant: string; interp: Interp; date: string }) {
  const riskColor = interp.overallRisk === 'high' ? C.danger : interp.overallRisk === 'moderate' ? C.warning : C.success;
  return (
    <Page size="A4" style={s.coverPage}>
      <View>
        <AccentBar />
        <Text style={s.coverBrand}>PhysioCore AI</Text>
        <Text style={s.coverTagline}>Clinical Range-of-Motion Assessment</Text>
        <Text style={s.coverTitle}>ROM Assessment Report</Text>
        <Text style={s.coverSubtitle}>{variant === 'clinician' ? 'Clinician Copy' : 'Patient Copy'}</Text>
        <View style={{ borderWidth: 1, borderColor: '#2a3448', borderRadius: 8, padding: 24, marginBottom: 32, backgroundColor: '#0D1420', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: riskColor, textTransform: 'uppercase', marginBottom: 4 }}>
            Overall Risk: {interp.overallRisk.toUpperCase()}
          </Text>
          {interp.referral && (
            <Text style={{ fontSize: 10, color: C.warning, marginTop: 6 }}>⚠ Clinical Referral Recommended</Text>
          )}
        </View>
        <Text style={s.coverMeta}>Patient: <Text style={s.coverMetaBold}>{userName}</Text></Text>
        <Text style={s.coverMeta}>Date: <Text style={s.coverMetaBold}>{date}</Text></Text>
        <Text style={s.coverMeta}>Tests Performed: <Text style={s.coverMetaBold}>8 (4 joints, bilateral)</Text></Text>
      </View>
      <Text style={s.coverDisc}>
        This report is generated by an AI-assisted physiotherapy assessment system (SaMD Class II context).
        Results are screening estimates only and do not constitute a clinical diagnosis.
        Always consult a qualified physiotherapist or physician before starting or modifying a treatment plan.
        Cite: Norkin CC, White DJ. Measurement of Joint Motion: A Guide to Goniometry. 5th ed. 2016.
      </Text>
    </Page>
  );
}

// ── Page 2: Results grid ──────────────────────────────────────────────────────
function ResultsPage({ results }: { results: ROMResult[] }) {
  const left  = results.filter((_, i) => i % 2 === 0);
  const right = results.filter((_, i) => i % 2 === 1);
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Test Results" pageNum="2" />
      <AccentBar />
      <View style={s.section}>
        <Text style={s.sectionTitle}>Goniometric Measurements</Text>
        <View style={s.row}>
          <View style={s.col50}>{left.map(r => <TestCard key={r.key} r={r} />)}</View>
          <View style={s.col50}>{right.map(r => <TestCard key={r.key} r={r} />)}</View>
        </View>
      </View>
      <Text style={s.disclaimer}>
        Measurements derived from MediaPipe PoseLandmarker (Lugaresi et al., 2019). Landmark-based
        goniometry ±5–10° vs instrumented goniometer. For clinical decision-making, confirm with
        manual goniometry. Reference ranges: Norkin &amp; White, 2016.
      </Text>
    </Page>
  );
}

// ── Page 3: Asymmetry analysis ────────────────────────────────────────────────
function AsymmetryPage({ asymmetries, results }: { asymmetries: Asymmetry[]; results: ROMResult[] }) {
  const joints = [...new Set(results.map(r => `${r.joint} ${r.movement}`))];
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Bilateral Comparison" pageNum="3" />
      <AccentBar />
      <View style={s.section}>
        <Text style={s.sectionTitle}>Bilateral Symmetry Analysis</Text>
        {asymmetries.length === 0 ? (
          <View style={[s.summaryBox]}>
            <Text style={s.summaryText}>No clinically significant asymmetries detected ({'<'}10° difference in all joints). Bilateral mobility appears symmetric.</Text>
          </View>
        ) : (
          <>
            <View style={[s.summaryBox, s.summaryMod]}>
              <Text style={s.summaryModText}>
                {asymmetries.length} asymmetr{asymmetries.length === 1 ? 'y' : 'ies'} detected ({'>'}10° threshold). Asymmetries {'>'} 10° may indicate unilateral mobility restriction or pain-avoidance pattern.
              </Text>
            </View>
            <View style={s.tableHeader}>
              <Text style={s.tableHead}>Joint / Movement</Text>
              <Text style={s.tableHead}>Right</Text>
              <Text style={s.tableHead}>Left</Text>
              <Text style={s.tableHead}>Difference</Text>
            </View>
            {asymmetries.map((a, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={s.tableCell}>{a.joint} {a.movement}</Text>
                <Text style={s.tableCell}>{a.rightDeg}°</Text>
                <Text style={s.tableCell}>{a.leftDeg}°</Text>
                <Text style={s.alertCell}>{a.diff}°</Text>
              </View>
            ))}
          </>
        )}
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>All Results — Bilateral View</Text>
        <View style={s.tableHeader}>
          <Text style={s.tableHead}>Joint / Movement</Text>
          <Text style={s.tableHead}>Right</Text>
          <Text style={s.tableHead}>Left</Text>
          <Text style={s.tableHead}>Status</Text>
        </View>
        {joints.map((jk, i) => {
          const R = results.find(r => `${r.joint} ${r.movement}` === jk && r.side === 'right');
          const L = results.find(r => `${r.joint} ${r.movement}` === jk && r.side === 'left');
          const worstStatus = (R?.status === 'significant' || L?.status === 'significant') ? 'significant'
            : (R?.status === 'mild' || L?.status === 'mild') ? 'mild' : 'normal';
          return (
            <View key={i} style={s.tableRow}>
              <Text style={s.tableCell}>{jk}</Text>
              <Text style={s.tableCell}>{R ? `${R.angle}°` : '—'}</Text>
              <Text style={s.tableCell}>{L ? `${L.angle}°` : '—'}</Text>
              <Text style={worstStatus === 'significant' ? s.alertCell : s.tableCell}>
                {badgeLabel(worstStatus as ROMResult['status'])}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={s.disclaimer}>
        Asymmetry threshold: {'>'} 10° difference between sides (Stegink Jansen CW et al., 2012).
        Asymmetry alone is not diagnostic. Consider pain, strength, and functional context.
      </Text>
    </Page>
  );
}

// ── Page 4: AI interpretation + findings ─────────────────────────────────────
function InterpretationPage({ interp }: { interp: Interp }) {
  const riskBoxStyle = interp.overallRisk === 'high'
    ? [s.summaryBox, s.summaryHigh]
    : interp.overallRisk === 'moderate'
    ? [s.summaryBox, s.summaryMod]
    : [s.summaryBox];
  const riskTextStyle = interp.overallRisk === 'high'
    ? [s.summaryText, s.summaryHighText]
    : interp.overallRisk === 'moderate'
    ? [s.summaryText, s.summaryModText]
    : [s.summaryText];
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Clinical Interpretation" pageNum="4" />
      <AccentBar />
      <View style={s.section}>
        <Text style={s.sectionTitle}>AI Clinical Summary</Text>
        <View style={riskBoxStyle}>
          <Text style={riskTextStyle}>{interp.summary}</Text>
        </View>
        {interp.referral && (
          <View style={[s.summaryBox, s.summaryHigh]}>
            <Text style={[s.summaryText, s.summaryHighText]}>
              ⚠ REFERRAL RECOMMENDED — One or more significant findings suggest clinical evaluation by a physiotherapist or physician is advisable.
            </Text>
          </View>
        )}
      </View>
      {interp.findings.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Key Findings by Joint</Text>
          {interp.findings.map((f, i) => (
            <View key={i} style={{ marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: C.teal }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.ink, marginBottom: 2 }}>{f.joint}</Text>
              <Text style={{ fontSize: 9, color: C.body, lineHeight: 1.6 }}>{f.finding}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={s.disclaimer}>
        Clinical interpretation generated by claude-sonnet-4-6 (Anthropic). AI findings are informational
        and require physiotherapist review before clinical action. Evidence base: Norkin &amp; White (2016),
        Magee DJ. Orthopedic Physical Assessment (6th ed., 2014).
      </Text>
    </Page>
  );
}

// ── Page 5: Home exercise guidance (patient) ─────────────────────────────────
function HomeCarePage({ results }: { results: ROMResult[] }) {
  const limited = results.filter(r => r.status !== 'normal');
  const exercises: { name: string; cue: string }[] = [];

  if (limited.some(r => r.joint === 'Shoulder' && r.movement === 'Flexion'))
    exercises.push({ name: 'Shoulder Pendulum', cue: 'Lean forward, let arm hang loose. Gently swing in small circles × 30 sec, 3×/day.' });
  if (limited.some(r => r.joint === 'Shoulder' && r.movement === 'Abduction'))
    exercises.push({ name: 'Shoulder Pulleys / Wall Walk', cue: 'Walk fingers up wall to max comfortable height, hold 5 s, return. 10 reps, 2×/day.' });
  if (limited.some(r => r.joint === 'Hip' && r.movement === 'Flexion'))
    exercises.push({ name: 'Supine Knee-to-Chest', cue: 'Lying on back, pull one knee gently toward chest. Hold 30 s each side, 3×/day.' });
  if (limited.some(r => r.joint === 'Knee' && r.movement === 'Flexion'))
    exercises.push({ name: 'Seated Heel Slides', cue: 'Sitting, slide heel back bending knee as far as comfortable. Hold 5 s, 15 reps, 2×/day.' });
  if (exercises.length === 0)
    exercises.push({ name: 'General Mobility Maintenance', cue: 'Your ROM is within normal limits. Maintain with daily full-range movement and strength work.' });

  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Home Exercise Programme" pageNum="5" />
      <AccentBar />
      <View style={s.section}>
        <Text style={s.sectionTitle}>Recommended Home Exercises</Text>
        <View style={[s.summaryBox]}>
          <Text style={s.summaryText}>
            Perform the exercises below daily unless you experience pain {'>'} 4/10. Stop and consult a clinician if pain worsens.
          </Text>
        </View>
        {exercises.map((ex, i) => (
          <View key={i} style={{ borderWidth: 1, borderColor: C.hairline, borderRadius: 6, padding: 12, marginBottom: 8 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.ink, marginBottom: 4 }}>{i + 1}. {ex.name}</Text>
            <Text style={{ fontSize: 9, color: C.body, lineHeight: 1.6 }}>{ex.cue}</Text>
          </View>
        ))}
      </View>
      <Text style={s.disclaimer}>
        Exercises are general guidance only and do not replace individualised physiotherapy prescription.
        If you experience sharp pain, dizziness, or neurological symptoms, stop immediately and seek medical advice.
      </Text>
    </Page>
  );
}

// ── Page 6 (clinician): SOAP note ────────────────────────────────────────────
function SOAPPage({ interp, userName, date }: { interp: Interp; userName: string; date: string }) {
  const lines = interp.soap.split('\n').filter(Boolean);
  const sections: Record<string, string[]> = { S: [], O: [], A: [], P: [] };
  let cur = 'S';
  for (const ln of lines) {
    const m = ln.match(/^([SOAP]):\s*(.*)/);
    if (m) { cur = m[1] ?? 'S'; sections[cur]?.push(m[2] ?? ''); }
    else sections[cur]?.push(ln);
  }
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="SOAP Note (Clinician)" pageNum="6" />
      <AccentBar />
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 9, color: C.muted }}>Patient: {userName} | Date: {date} | Assessment: Guided ROM (8 tests, bilateral)</Text>
      </View>
      {(['S', 'O', 'A', 'P'] as const).map(k => (
        <View key={k} style={s.section}>
          <Text style={s.soapLabel}>{
            k === 'S' ? 'S — Subjective' : k === 'O' ? 'O — Objective' : k === 'A' ? 'A — Assessment' : 'P — Plan'
          }</Text>
          <Text style={s.soapText}>{sections[k]?.join('\n') || '—'}</Text>
        </View>
      ))}
      <Text style={s.disclaimer}>
        Clinician copy — retain in patient file. AI-generated SOAP content requires clinician review and
        countersignature before inclusion in medical records. PhysioCore AI (SaMD Class II context).
      </Text>
    </Page>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ROMReportPDF({ results, asymmetries, interp, userName, variant }: ROMReportPDFProps) {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <Document title={`ROM Assessment — ${userName}`} author="PhysioCore AI">
      <CoverPage userName={userName} variant={variant} interp={interp} date={date} />
      <ResultsPage results={results} />
      <AsymmetryPage asymmetries={asymmetries} results={results} />
      <InterpretationPage interp={interp} />
      <HomeCarePage results={results} />
      {variant === 'clinician' && (
        <SOAPPage interp={interp} userName={userName} date={date} />
      )}
    </Document>
  );
}
