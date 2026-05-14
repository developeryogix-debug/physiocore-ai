/**
 * PostureReportPDF.tsx
 * 7-page posture assessment PDF using @react-pdf/renderer.
 * Patient variant: pages 1–6. Clinician variant: all 7 pages.
 */
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';
import type { PostureReport } from '../lib/agents/postureClient.js';

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
  darkBg:   '#0D1420',
  darkText: '#F0F4FF',
} as const;

type ViewKey = 'anterior' | 'rightLateral' | 'posterior' | 'leftLateral';

const VIEW_LABELS: Record<ViewKey, string> = {
  anterior:     'FRONT VIEW',
  rightLateral: 'RIGHT SIDE',
  posterior:    'BACK VIEW',
  leftLateral:  'LEFT SIDE',
};

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
    backgroundColor: '#050810',
    paddingHorizontal: 64,
    paddingVertical: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.darkText,
    justifyContent: 'space-between',
  },

  // ── Accent bar ─────────────────────────────────────────────────────────────
  accentBar:    { height: 4, flexDirection: 'row', marginBottom: 24 },
  accentTeal:   { flex: 1, backgroundColor: C.teal },
  accentBlue:   { flex: 1, backgroundColor: C.blue },
  accentGreen:  { flex: 1, backgroundColor: C.success },
  accentWarn:   { flex: 1, backgroundColor: C.warning },

  // ── Cover ──────────────────────────────────────────────────────────────────
  coverBrand:     { fontFamily: 'Helvetica-Bold', fontSize: 28, color: C.teal, marginBottom: 4 },
  coverTagline:   { fontSize: 11, color: '#8892A4', marginBottom: 48 },
  coverTitle:     { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.darkText, marginBottom: 8 },
  coverSubtitle:  { fontSize: 12, color: '#8892A4', marginBottom: 48 },
  coverScoreBox:  { borderWidth: 1, borderColor: '#2a3448', borderRadius: 8, padding: 24, marginBottom: 32, backgroundColor: '#0D1420', alignItems: 'center' },
  coverScoreNum:  { fontFamily: 'Helvetica-Bold', fontSize: 64, color: C.teal, lineHeight: 1 },
  coverScoreLbl:  { fontSize: 9, color: '#8892A4', textTransform: 'uppercase', marginTop: 4 },
  coverScoreRow:  { flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 16 },
  coverSubScore:  { alignItems: 'center' },
  coverSubNum:    { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.blue },
  coverSubLbl:    { fontSize: 8, color: '#8892A4', textTransform: 'uppercase', marginTop: 2 },
  coverMeta:      { fontSize: 10, color: '#8892A4', marginBottom: 6 },
  coverMetaBold:  { fontFamily: 'Helvetica-Bold', color: C.darkText },
  coverDisclaimer:{ fontSize: 8, color: '#4a5568', marginTop: 32, lineHeight: 1.5 },

  // ── Section headers ────────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: C.ink,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  section: { marginBottom: 20 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  brand:    { fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.ink, marginBottom: 2 },
  tagline:  { fontSize: 7.5, color: C.muted },
  metaLine: { fontSize: 8, color: C.muted, marginBottom: 2 },
  metaBold: { fontFamily: 'Helvetica-Bold', color: C.ink },
  metaCol:  { alignItems: 'flex-end' },

  // ── Photo grid (Page 2) ────────────────────────────────────────────────────
  photoGrid:  { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell:  { width: '48%', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.hairline}` },
  photoImg:   { width: '100%', height: 160, objectFit: 'cover' },
  photoLabel: { backgroundColor: C.soft, padding: '4px 8px', fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink },
  photoConf:  { backgroundColor: C.soft, padding: '2px 8px', fontSize: 7, color: C.muted, paddingBottom: 4 },
  photoNote:  { marginTop: 10, fontSize: 8, color: C.muted, lineHeight: 1.5 },

  // ── Findings table (Page 3) ────────────────────────────────────────────────
  tableWrap:   { borderWidth: 1, borderColor: C.hairline, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  tableHead:   { flexDirection: 'row', backgroundColor: C.soft, borderBottomWidth: 1, borderBottomColor: C.hairline },
  tableRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.hairline },
  tableRowAlt: { flexDirection: 'row', backgroundColor: C.soft, borderBottomWidth: 1, borderBottomColor: C.hairline },
  th:          { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.muted, textTransform: 'uppercase', padding: 7 },
  td:          { fontSize: 8, color: C.body, padding: 7, lineHeight: 1.4 },

  colFinding:  { width: '22%' },
  colMeasure:  { width: '20%' },
  colNormal:   { width: '20%' },
  colSeverity: { width: '14%' },
  colGrade:    { width: '10%' },
  colCite:     { width: '14%' },

  // Severity chip
  chip: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', alignSelf: 'flex-start' },

  summaryText: { fontSize: 9.5, color: C.body, lineHeight: 1.6, marginBottom: 14 },
  citationItem:{ fontSize: 7.5, color: C.muted, marginBottom: 2 },

  // ── Muscle imbalance (Page 4) ──────────────────────────────────────────────
  muscleRow:     { flexDirection: 'row', gap: 16, marginTop: 12 },
  muscleCol:     { flex: 1 },
  muscleColHead: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.hairline },
  muscleItem:    { fontSize: 8.5, color: C.body, marginBottom: 4 },
  jandaBox:      { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 6, padding: 12, marginBottom: 16 },
  jandaName:     { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1d4ed8', marginBottom: 4 },
  jandaCite:     { fontSize: 7.5, color: '#3b82f6' },

  // ── Exercise table (Page 5) ────────────────────────────────────────────────
  colExName:  { width: '40%' },
  colSets:    { width: '20%' },
  colFocus:   { width: '40%' },

  // ── Home care (Page 6) ────────────────────────────────────────────────────
  careRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.hairline, paddingVertical: 8 },
  careName:    { width: '30%', fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.ink },
  careInstr:   { width: '70%', fontSize: 8.5, color: C.body, lineHeight: 1.5 },

  // ── Clinician (Page 7) ─────────────────────────────────────────────────────
  clinBox:       { backgroundColor: C.soft, borderRadius: 6, padding: 14, marginBottom: 14 },
  clinLabel:     { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.ink, marginBottom: 4 },
  clinText:      { fontSize: 8.5, color: C.body, lineHeight: 1.5 },
  redFlagBox:    { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: 10, marginBottom: 12 },
  redFlagTitle:  { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.danger, marginBottom: 4 },
  redFlagItem:   { fontSize: 8.5, color: C.danger, marginBottom: 2 },
  icd10Row:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  icd10Chip:     { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, fontSize: 8, color: '#1d4ed8', fontFamily: 'Helvetica-Bold' },
  clinWarning:   { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: 10, marginTop: 16 },
  clinWarnText:  { fontSize: 8, color: C.danger, fontFamily: 'Helvetica-Bold' },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer:     { position: 'absolute', bottom: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: C.hairline },
  footerText: { fontSize: 7, color: C.muted },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityChip(sev: string) {
  const map: Record<string, { bg: string; fg: string }> = {
    normal:   { bg: '#dcfce7', fg: C.success },
    mild:     { bg: '#fef9c3', fg: '#854d0e' },
    moderate: { bg: '#ffedd5', fg: '#9a3412' },
    severe:   { bg: '#fee2e2', fg: C.danger },
  };
  const { bg, fg } = map[sev] ?? map['mild']!;
  return <Text style={[s.chip, { backgroundColor: bg, color: fg }]}>{sev}</Text>;
}

function gradeChip(grade: string) {
  const fg = grade === 'A' ? C.success : grade === 'B' ? C.blue : grade === 'C' ? C.warning : C.muted;
  return <Text style={[s.chip, { backgroundColor: C.soft, color: fg }]}>{grade}</Text>;
}

const NORMAL_RANGES: Record<string, string> = {
  'Head Forward Posture':   '≤2 cm offset',
  'Shoulder Level':         '≤2° tilt',
  'Hip Level':              '≤2° tilt',
  'Thoracic Kyphosis':      '20–45°',
  'Lumbar Lordosis':        '30–50°',
  'Pelvic Tilt':            '0–5° anterior',
  'Trunk Sway':             '<2° deviation',
  'Knee Valgus':            '<5°',
};

function normalRange(name: string): string {
  for (const [k, v] of Object.entries(NORMAL_RANGES)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return 'Within normal limits';
}

// ── Shared header / footer ────────────────────────────────────────────────────

function PageHeader({ userName, date }: { userName: string; date: string }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.brand}>PhysioCore AI</Text>
        <Text style={s.tagline}>Clinical intelligence for movement health · PDPA Compliant</Text>
      </View>
      <View style={s.metaCol}>
        <Text style={s.metaLine}><Text style={s.metaBold}>Patient: </Text>{userName}</Text>
        <Text style={s.metaLine}><Text style={s.metaBold}>Assessment: </Text>Postural Analysis</Text>
        <Text style={s.metaLine}><Text style={s.metaBold}>Date: </Text>{date}</Text>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>PhysioCore AI · app-dteam1-mmcv.vercel.app · PDPA Compliant · Data stored Singapore region</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// ── Prop types ─────────────────────────────────────────────────────────────────

export interface PostureReportPDFProps {
  report:          PostureReport;
  userName:        string;
  capturedFrames:  Partial<Record<ViewKey, { dataUrl: string; landmarks: unknown[] | null }>>;
  variant:         'patient' | 'clinician';
  confidences:     Partial<Record<ViewKey, number>>;  // 0-100
}

// ── ICD-10 inference from referral flags ──────────────────────────────────────
function inferICD10(flags: string[], findings: PostureReport['findings']): string[] {
  const codes: string[] = [];
  if (flags.some(f => /forward head/i.test(f)) || findings.some(f => /head forward/i.test(f.name) && f.severity !== 'normal'))
    codes.push('M43.6');
  if (findings.some(f => /thoracic/i.test(f.name) && f.severity !== 'normal'))
    codes.push('M40.1');
  if (findings.some(f => /lumbar|lordosis/i.test(f.name) && f.severity !== 'normal'))
    codes.push('M40.5');
  if (findings.some(f => /shoulder/i.test(f.name) && f.severity !== 'normal'))
    codes.push('M62.9');
  if (flags.some(f => /scoliosis/i.test(f)))
    codes.push('M41.9');
  if (codes.length === 0) codes.push('M62.9');
  return [...new Set(codes)];
}

// ── SOAP generation ───────────────────────────────────────────────────────────
function buildSOAP(report: PostureReport, userName: string, date: string) {
  const significant = report.findings.filter(f => f.severity !== 'normal');
  return {
    subjective: `${userName} presents for postural assessment. Overall posture score ${report.overallScore}/100. Frontal score ${report.frontalScore}/100, sagittal score ${report.sagittalScore}/100.`,
    objective: significant.length > 0
      ? significant.map(f => `${f.name}: ${f.measurement} (${f.severity})`).join('; ')
      : 'No significant postural deviations detected.',
    assessment: report.clinicalSummary,
    plan: report.correctionExercises.length > 0
      ? `Correction programme: ${report.correctionExercises.map(e => `${e.name} (${e.sets})`).join(', ')}. ${report.referralFlags.length > 0 ? `Referral flags: ${report.referralFlags.join('; ')}.` : 'No referral indicated at this time.'}`
      : 'Continue monitoring. Re-assess in 4 weeks.',
  };
}

// ── PDF Document ──────────────────────────────────────────────────────────────

export function PostureReportPDF({
  report, userName, capturedFrames, variant, confidences,
}: PostureReportPDFProps) {
  const date = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
  const icd10 = inferICD10(report.referralFlags, report.findings);
  const soap  = buildSOAP(report, userName, date);
  const allCitations = [...new Set(report.findings.map(f => f.citation))];

  const scoreColor = (n: number) => n >= 80 ? C.success : n >= 60 ? C.warning : C.danger;

  const VIEW_ORDER: ViewKey[] = ['anterior', 'rightLateral', 'posterior', 'leftLateral'];

  return (
    <Document title={`${userName} — Posture Assessment Report`} author="PhysioCore AI">

      {/* ══ PAGE 1: COVER ══════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.coverPage}>
        {/* Accent bar */}
        <View style={s.accentBar}>
          <View style={s.accentTeal}/>
          <View style={s.accentBlue}/>
          <View style={s.accentGreen}/>
          <View style={s.accentWarn}/>
        </View>

        <View>
          <Text style={s.coverBrand}>PhysioCore AI</Text>
          <Text style={s.coverTagline}>Clinical AI Assessment System · PDPA Compliant · Singapore Region</Text>

          <Text style={s.coverTitle}>Posture Assessment Report</Text>
          <Text style={s.coverSubtitle}>Comprehensive postural analysis with clinical findings and correction programme</Text>

          {/* Score */}
          <View style={s.coverScoreBox}>
            <Text style={s.coverScoreLbl}>OVERALL POSTURE SCORE</Text>
            <Text style={[s.coverScoreNum, { color: scoreColor(report.overallScore) }]}>{report.overallScore}</Text>
            <Text style={[s.coverScoreLbl, { marginTop: 2 }]}>/ 100</Text>
            <View style={s.coverScoreRow}>
              <View style={s.coverSubScore}>
                <Text style={[s.coverSubNum, { color: scoreColor(report.frontalScore) }]}>{report.frontalScore}</Text>
                <Text style={s.coverSubLbl}>Frontal Score</Text>
              </View>
              <View style={s.coverSubScore}>
                <Text style={[s.coverSubNum, { color: scoreColor(report.sagittalScore) }]}>{report.sagittalScore}</Text>
                <Text style={s.coverSubLbl}>Sagittal Score</Text>
              </View>
            </View>
          </View>

          <Text style={s.coverMeta}><Text style={s.coverMetaBold}>Patient: </Text>{userName}</Text>
          <Text style={s.coverMeta}><Text style={s.coverMetaBold}>Date: </Text>{date}</Text>
          <Text style={s.coverMeta}><Text style={s.coverMetaBold}>Prepared by: </Text>PhysioCore AI Clinical Assessment System</Text>
        </View>

        <Text style={s.coverDisclaimer}>
          This report is generated by an AI-assisted clinical tool for informational purposes only.
          It does not constitute a medical diagnosis. Consult a licensed physiotherapist for
          clinical interpretation and treatment planning. PhysioCore AI is a decision-support tool — not a replacement for professional clinical judgment.
        </Text>

        <Footer />
      </Page>

      {/* ══ PAGE 2: CAPTURED VIEWS ════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.accentBar}>
          <View style={s.accentTeal}/><View style={s.accentBlue}/><View style={s.accentGreen}/><View style={s.accentWarn}/>
        </View>
        <PageHeader userName={userName} date={date} />

        <Text style={s.sectionTitle}>4-View Postural Capture</Text>

        <View style={s.photoGrid}>
          {VIEW_ORDER.map(key => {
            const frame = capturedFrames[key];
            const conf  = confidences[key] ?? 0;
            const confColor = conf >= 70 ? C.success : conf >= 50 ? C.warning : C.danger;
            return (
              <View key={key} style={s.photoCell}>
                {frame?.dataUrl ? (
                  <Image src={frame.dataUrl} style={s.photoImg} />
                ) : (
                  <View style={[s.photoImg, { backgroundColor: '#1a2535', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#4a5568', fontSize: 8 }}>No frame captured</Text>
                  </View>
                )}
                <Text style={s.photoLabel}>{VIEW_LABELS[key]}</Text>
                <Text style={[s.photoConf, { color: confColor }]}>Confidence: {conf}%</Text>
              </View>
            );
          })}
        </View>

        <Text style={s.photoNote}>
          Grid lines show postural deviations from neutral alignment.
          Green ≤2° = within normal limits · Amber 2–5° = mild deviation · Red {'>'}5° = significant deviation requiring attention.
          Grid overlay uses plumb line and horizontal reference lines at shoulder, hip, and knee level.
        </Text>

        <Footer />
      </Page>

      {/* ══ PAGE 3: CLINICAL FINDINGS ════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.accentBar}>
          <View style={s.accentTeal}/><View style={s.accentBlue}/><View style={s.accentGreen}/><View style={s.accentWarn}/>
        </View>
        <PageHeader userName={userName} date={date} />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Clinical Assessment Summary</Text>
          <Text style={s.summaryText}>{report.clinicalSummary}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Postural Findings</Text>
          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colFinding]}>Finding</Text>
              <Text style={[s.th, s.colMeasure]}>Measurement</Text>
              <Text style={[s.th, s.colNormal]}>Normal Range</Text>
              <Text style={[s.th, s.colSeverity]}>Severity</Text>
              <Text style={[s.th, s.colGrade]}>Grade</Text>
              <Text style={[s.th, s.colCite]}>Citation</Text>
            </View>
            {report.findings.map((f, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, s.colFinding, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>{f.name}</Text>
                <Text style={[s.td, s.colMeasure]}>{f.measurement}</Text>
                <Text style={[s.td, s.colNormal]}>{normalRange(f.name)}</Text>
                <View style={[s.td, s.colSeverity, { justifyContent: 'center' }]}>
                  {severityChip(f.severity)}
                </View>
                <View style={[s.td, s.colGrade, { justifyContent: 'center' }]}>
                  {gradeChip(f.evidenceGrade)}
                </View>
                <Text style={[s.td, s.colCite, { fontSize: 6.5, color: C.muted }]}>{f.citation.split('.')[0]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Citations */}
        {allCitations.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { fontSize: 9 }]}>Evidence References</Text>
            {allCitations.map((c, i) => (
              <Text key={i} style={s.citationItem}>{i + 1}. {c}</Text>
            ))}
          </View>
        )}

        <Footer />
      </Page>

      {/* ══ PAGE 4: MUSCLE IMBALANCE ══════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.accentBar}>
          <View style={s.accentTeal}/><View style={s.accentBlue}/><View style={s.accentGreen}/><View style={s.accentWarn}/>
        </View>
        <PageHeader userName={userName} date={date} />

        <Text style={s.sectionTitle}>Muscle Imbalance Analysis</Text>

        {report.muscleImbalancePattern ? (
          <View>
            <View style={s.jandaBox}>
              <Text style={s.jandaName}>{report.muscleImbalancePattern.name}</Text>
              <Text style={s.jandaCite}>{report.muscleImbalancePattern.citation}</Text>
            </View>

            <View style={s.muscleRow}>
              <View style={s.muscleCol}>
                <Text style={[s.muscleColHead, { color: C.danger }]}>Shortened / Overactive Muscles</Text>
                {report.muscleImbalancePattern.shortenedMuscles.map((m, i) => (
                  <Text key={i} style={s.muscleItem}>• {m}</Text>
                ))}
              </View>
              <View style={s.muscleCol}>
                <Text style={[s.muscleColHead, { color: C.blue }]}>Lengthened / Underactive Muscles</Text>
                {report.muscleImbalancePattern.lengthenedMuscles.map((m, i) => (
                  <Text key={i} style={s.muscleItem}>• {m}</Text>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={[s.clinBox, { alignItems: 'center', paddingVertical: 24 }]}>
            <Text style={{ fontSize: 9.5, color: C.muted }}>No significant muscle imbalance pattern detected in this assessment.</Text>
            <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 6 }}>Continue monitoring with regular assessments.</Text>
          </View>
        )}

        <Footer />
      </Page>

      {/* ══ PAGE 5: CORRECTION PROGRAMME ══════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.accentBar}>
          <View style={s.accentTeal}/><View style={s.accentBlue}/><View style={s.accentGreen}/><View style={s.accentWarn}/>
        </View>
        <PageHeader userName={userName} date={date} />

        <Text style={s.sectionTitle}>Correction Exercise Programme</Text>

        {report.correctionExercises.length > 0 ? (
          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colExName]}>Exercise</Text>
              <Text style={[s.th, s.colSets]}>Sets × Reps</Text>
              <Text style={[s.th, s.colFocus]}>Clinical Focus</Text>
            </View>
            {report.correctionExercises.map((e, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, s.colExName, { fontFamily: 'Helvetica-Bold', color: C.ink }]}>{e.name}</Text>
                <Text style={[s.td, s.colSets]}>{e.sets}</Text>
                <Text style={[s.td, s.colFocus]}>{e.focus}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.summaryText}>No specific correction exercises prescribed. Re-assess in 4 weeks.</Text>
        )}

        <Footer />
      </Page>

      {/* ══ PAGE 6: HOME SELF-CARE ════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.accentBar}>
          <View style={s.accentTeal}/><View style={s.accentBlue}/><View style={s.accentGreen}/><View style={s.accentWarn}/>
        </View>
        <PageHeader userName={userName} date={date} />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Home Self-Care — Stretching Programme</Text>
          {report.homeCare.stretches.length > 0 ? (
            report.homeCare.stretches.map((st, i) => (
              <View key={i} style={[s.careRow, i === 0 ? { borderTopWidth: 1, borderTopColor: C.hairline } : {}]}>
                <Text style={s.careName}>{st.name}</Text>
                <Text style={s.careInstr}>{st.instructions}</Text>
              </View>
            ))
          ) : (
            <Text style={s.summaryText}>No specific stretches prescribed at this time.</Text>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Home Self-Care — Strengthening Programme</Text>
          {report.homeCare.strengthening.length > 0 ? (
            report.homeCare.strengthening.map((ex, i) => (
              <View key={i} style={[s.careRow, i === 0 ? { borderTopWidth: 1, borderTopColor: C.hairline } : {}]}>
                <Text style={s.careName}>{ex.name}</Text>
                <Text style={s.careInstr}>{ex.instructions}</Text>
              </View>
            ))
          ) : (
            <Text style={s.summaryText}>No specific strengthening exercises prescribed at this time.</Text>
          )}
        </View>

        <Footer />
      </Page>

      {/* ══ PAGE 7: CLINICIAN SECTION (clinician variant only) ════════════════ */}
      {variant === 'clinician' && (
        <Page size="A4" style={s.page}>
          <View style={s.accentBar}>
            <View style={s.accentTeal}/><View style={s.accentBlue}/><View style={s.accentGreen}/><View style={s.accentWarn}/>
          </View>
          <PageHeader userName={userName} date={date} />

          <Text style={s.sectionTitle}>Clinician Report — SOAP Summary</Text>

          {/* Red flags first */}
          {report.referralFlags.length > 0 && (
            <View style={s.redFlagBox}>
              <Text style={s.redFlagTitle}>Referral Flags — Review Required</Text>
              {report.referralFlags.map((f, i) => (
                <Text key={i} style={s.redFlagItem}>• {f}</Text>
              ))}
            </View>
          )}

          {/* SOAP */}
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key => (
            <View key={key} style={s.clinBox}>
              <Text style={s.clinLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              <Text style={s.clinText}>{soap[key]}</Text>
            </View>
          ))}

          {/* ICD-10 */}
          <Text style={[s.sectionTitle, { marginTop: 8 }]}>ICD-10 Classification</Text>
          <View style={s.icd10Row}>
            {icd10.map(code => (
              <Text key={code} style={s.icd10Chip}>{code}</Text>
            ))}
          </View>

          {/* Follow-up */}
          <View style={s.clinBox}>
            <Text style={s.clinLabel}>Recommended Follow-Up</Text>
            <Text style={s.clinText}>
              {report.referralFlags.length > 0
                ? 'Urgent: within 1–2 weeks. Consider specialist referral for flagged findings.'
                : report.findings.some(f => f.severity === 'severe' || f.severity === 'moderate')
                  ? 'Reassess in 4 weeks to monitor correction programme progress.'
                  : 'Reassess in 8 weeks or on symptom change.'}
            </Text>
          </View>

          {/* Clinical use warning */}
          <View style={s.clinWarning}>
            <Text style={s.clinWarnText}>
              FOR CLINICAL USE ONLY — Not for patient self-diagnosis.
              This AI-generated report requires clinical validation by a licensed physiotherapist before treatment decisions.
            </Text>
          </View>

          <Footer />
        </Page>
      )}

    </Document>
  );
}

export default PostureReportPDF;
