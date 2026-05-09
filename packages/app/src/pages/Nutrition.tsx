import { useState, useMemo } from 'react';
import { useUserProfile } from '../hooks/useUserProfile.js';
import { AiChatPanel } from '../components/AiChatPanel.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

interface SupplementRec {
  name: string;
  mechanism: string;
  grade: EvidenceGrade;
  dose: string;
  timing: string;
  contraindications: string;
  interactions: string;
  product: string;
  productUrl: string;
  cost: string;
  citation: string;
  conditions: string[];
}

interface DayMeals {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
  avoidNote?: string;
}

interface LabTest {
  name: string;
  code: string;
  reason: string;
  refRange: string;
  action: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_META: Record<EvidenceGrade, { label: string; bg: string; color: string }> = {
  A: { label: 'Grade A', bg: 'rgba(0,230,118,0.1)',  color: '#00E676' },
  B: { label: 'Grade B', bg: 'rgba(77,184,255,0.1)', color: '#4DB8FF' },
  C: { label: 'Grade C', bg: 'rgba(255,184,48,0.1)', color: '#FFB830' },
  D: { label: 'Grade D', bg: 'rgba(74,85,104,0.15)', color: '#8892A4' },
};

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  beginner: 1.375,
  intermediate: 1.55,
  advanced: 1.725,
  athlete: 1.9,
};

// Condition-based supplement recommendations (static defaults shown before AI call)
const CONDITION_SUPPLEMENTS: Record<string, SupplementRec[]> = {
  'osteoarthritis': [
    {
      name: 'Glucosamine Sulfate',
      mechanism: 'Stimulates cartilage synthesis; inhibits pro-inflammatory cytokines (IL-1β, TNF-α)',
      grade: 'B',
      dose: '1500 mg/day',
      timing: 'With meals (split 500mg × 3)',
      contraindications: 'Shellfish allergy; caution in diabetes (monitor glucose)',
      interactions: 'May potentiate warfarin — monitor INR. Caution with NSAIDs.',
      product: 'NOW Glucosamine Sulfate 1000mg',
      productUrl: 'https://examine.com/supplements/glucosamine/',
      cost: '~$18/month',
      citation: 'Towheed et al., 2005, Cochrane Database Syst Rev, n=2570',
      conditions: ['osteoarthritis', 'knee oa'],
    },
    {
      name: 'Chondroitin Sulfate',
      mechanism: 'Inhibits cartilage-degrading enzymes; provides structural proteoglycan substrate',
      grade: 'B',
      dose: '1200 mg/day',
      timing: 'With glucosamine or split across meals',
      contraindications: 'Generally well tolerated; avoid with active bleeding disorders',
      interactions: 'Mild anticoagulant effect — additive with warfarin',
      product: 'Jarrow Formulas Chondroitin 400mg',
      productUrl: 'https://examine.com/supplements/chondroitin/',
      cost: '~$14/month',
      citation: 'Clegg et al., 2006, NEJM (GAIT trial), n=1583',
      conditions: ['osteoarthritis', 'knee oa'],
    },
  ],
  'general_athlete': [
    {
      name: 'Creatine Monohydrate',
      mechanism: 'Replenishes phosphocreatine stores; buffers ATP during high-intensity efforts',
      grade: 'A',
      dose: '3–5 g/day (no loading needed)',
      timing: 'Post-workout with carbohydrate',
      contraindications: 'Caution with pre-existing renal disease',
      interactions: 'NSAIDs: theoretically additive renal load — monitor in athletes',
      product: 'Optimum Nutrition Micronized Creatine',
      productUrl: 'https://examine.com/supplements/creatine/',
      cost: '~$12/month',
      citation: 'Lanhers et al., 2017, Eur J Sport Sci, systematic review, n=22 studies',
      conditions: ['strengthening', 'performance'],
    },
  ],
  'flexibility': [
    {
      name: 'Magnesium Glycinate',
      mechanism: 'Cofactor for 300+ enzymes; promotes skeletal muscle relaxation via Ca²⁺ antagonism',
      grade: 'B',
      dose: '300 mg elemental Mg/day',
      timing: 'Evening, before sleep (promotes relaxation)',
      contraindications: 'Severe renal impairment (GFR <30)',
      interactions: 'Reduces absorption of tetracyclines and bisphosphonates — separate by 2h',
      product: 'Thorne Magnesium Bisglycinate',
      productUrl: 'https://examine.com/supplements/magnesium/',
      cost: '~$22/month',
      citation: 'Abbasi et al., 2012, J Res Med Sci, RCT, n=46',
      conditions: ['flexibility', 'pain_management'],
    },
  ],
  'post_surgery': [
    {
      name: 'Vitamin C (Ascorbic Acid)',
      mechanism: 'Essential cofactor for collagen hydroxylation (prolyl/lysyl hydroxylase); antioxidant',
      grade: 'B',
      dose: '500 mg/day',
      timing: 'With meals to reduce GI irritation',
      contraindications: 'History of calcium oxalate kidney stones (limit to 200mg)',
      interactions: 'High doses may interfere with B12 absorption; reduces iron absorption',
      product: 'Pure Encapsulations Vitamin C 500mg',
      productUrl: 'https://examine.com/supplements/vitamin-c/',
      cost: '~$10/month',
      citation: 'Moores, 2013, Nutrients, systematic review',
      conditions: ['rehabilitation', 'post_surgery'],
    },
    {
      name: 'Zinc Bisglycinate',
      mechanism: 'Essential cofactor for metalloproteinases in wound healing; immune modulation',
      grade: 'B',
      dose: '15 mg elemental Zn/day',
      timing: 'With meals (copper depletion risk if >40mg/day)',
      contraindications: 'Avoid >40mg/day long-term; caution with Wilson\'s disease',
      interactions: 'Reduces absorption of quinolone/tetracycline antibiotics — separate by 2h',
      product: 'Thorne Zinc Picolinate 15mg',
      productUrl: 'https://examine.com/supplements/zinc/',
      cost: '~$8/month',
      citation: 'Gammoh & Rink, 2017, Nutrients, review',
      conditions: ['rehabilitation', 'post_surgery'],
    },
  ],
  'hypertension': [
    {
      name: 'CoQ10 (Ubiquinol)',
      mechanism: 'Restores endothelial function; reduces vascular resistance via NO pathway upregulation',
      grade: 'B',
      dose: '100–200 mg/day',
      timing: 'With a fat-containing meal for absorption',
      contraindications: 'Generally safe; may lower BP — monitor in those on antihypertensives',
      interactions: 'May reduce warfarin efficacy — monitor INR. Statins deplete CoQ10.',
      product: 'Jarrow Formulas QH-absorb 100mg',
      productUrl: 'https://examine.com/supplements/coenzyme-q10/',
      cost: '~$28/month',
      citation: 'Rosenfeldt et al., 2007, J Hum Hypertens, meta-analysis, n=12 trials',
      conditions: ['hypertension', 'heart disease'],
    },
  ],
  'diabetes': [
    {
      name: 'Berberine HCl',
      mechanism: 'AMPK activator; reduces hepatic glucose output; improves insulin receptor sensitivity',
      grade: 'B',
      dose: '500 mg, 2–3× daily',
      timing: 'With meals to reduce GI side effects',
      contraindications: 'Pregnancy/breastfeeding contraindicated; caution in severe hepatic disease',
      interactions: '⚠ SIGNIFICANT: Potentiates metformin — risk of hypoglycemia. Monitor glucose closely. Inhibits CYP3A4/2D6.',
      product: 'Thorne Berberine-500',
      productUrl: 'https://examine.com/supplements/berberine/',
      cost: '~$35/month',
      citation: 'Yin et al., 2008, Metabolism, RCT, n=116',
      conditions: ['type 2 diabetes', 'diabetes'],
    },
  ],
};

const LAB_TESTS: LabTest[] = [
  { name: '25-OH Vitamin D', code: '25(OH)D', reason: 'Deficiency is prevalent (>40% adults) and linked to musculoskeletal pain, immune dysfunction, and depression', refRange: '75–150 nmol/L (30–60 ng/mL)', action: 'If <50 nmol/L: supplement 2000–4000 IU/day and retest in 12 weeks' },
  { name: 'Vitamin B12', code: 'B12 / Cobalamin', reason: 'Essential for neurological function; deficiency causes peripheral neuropathy and fatigue', refRange: '200–700 pmol/L', action: 'If <200: methylcobalamin 1000mcg sublingual daily; check intrinsic factor antibodies' },
  { name: 'Iron Studies (Ferritin, TSAT)', code: 'Iron panel', reason: 'Iron deficiency impairs oxygen transport and exercise performance even without anaemia', refRange: 'Ferritin >30 µg/L; TSAT >20%', action: 'If ferritin <30: oral iron bisglycinate 25mg/day with Vitamin C. Retest 8 weeks.' },
  { name: 'HbA1c', code: 'Glycated haemoglobin', reason: 'Identifies pre-diabetes and diabetes; high glucose accelerates tissue damage and inflammation', refRange: '<5.7% normal; 5.7–6.4% pre-diabetes; ≥6.5% diabetes', action: 'If 5.7–6.4%: dietary intervention + metformin discussion with GP. Retest annually.' },
  { name: 'Lipid Panel', code: 'TC / HDL / LDL / TG', reason: 'Cardiovascular risk assessment; dyslipidaemia is common in metabolic conditions', refRange: 'LDL <2.6 mmol/L; HDL >1.0 (M) >1.3 (F); TG <1.7', action: 'If LDL elevated: dietary fat modification, omega-3 3g/day, refer to GP if >4.0 mmol/L' },
  { name: 'CRP (high-sensitivity)', code: 'hs-CRP', reason: 'Systemic inflammation marker; guides anti-inflammatory nutrition and supplementation strategy', refRange: '<1.0 mg/L optimal; 1–3 elevated; >3 high risk', action: 'If elevated: Mediterranean diet, omega-3 supplement, assess sleep and stress' },
  { name: 'Thyroid (TSH)', code: 'TSH', reason: 'Thyroid dysfunction causes fatigue, weight changes, and musculoskeletal symptoms that mimic other conditions', refRange: '0.4–4.0 mIU/L', action: 'If outside range: request Free T4 and T3; refer to endocrinology if symptomatic' },
  { name: 'Magnesium (RBC)', code: 'RBC Mg', reason: 'Serum Mg is unreliable; RBC Mg reflects true tissue stores. Deficiency impairs 300+ enzymatic reactions', refRange: '4.2–6.8 mg/dL (RBC)', action: 'If low: magnesium glycinate 300mg/day, reduce alcohol/caffeine, retest 3 months' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function calcTDEE(weightKg: number, heightCm: number, age: number, gender: string, fitnessLevel: string) {
  const sexFactor = gender === 'male' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexFactor;
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[fitnessLevel] ?? 1.55));
}

// SVG donut chart
function DonutChart({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  const pPct = (protein * 4) / total;
  const cPct = (carbs * 4) / total;
  const fPct = (fat * 9) / total;

  const r = 54;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;

  function arc(pct: number, offset: number) {
    return { strokeDasharray: `${pct * circ} ${circ}`, strokeDashoffset: -offset * circ };
  }

  const pA = arc(pPct, 0);
  const cA = arc(cPct, pPct);
  const fA = arc(fPct, pPct + cPct);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--teal-500)" strokeWidth={16} strokeLinecap="butt" transform="rotate(-90 70 70)" {...pA} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--blue-400)" strokeWidth={16} strokeLinecap="butt" transform="rotate(-90 70 70)" {...cA} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--amber-400)" strokeWidth={16} strokeLinecap="butt" transform="rotate(-90 70 70)" {...fA} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)" fontFamily="Space Mono, monospace">KCAL</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fontWeight="700" fill="var(--text-primary)" fontFamily="Space Mono, monospace">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { color: 'var(--teal-500)',  label: 'Protein', g: protein, kcal: protein * 4, pct: pPct },
          { color: 'var(--blue-400)', label: 'Carbs',   g: carbs,   kcal: carbs * 4,   pct: cPct },
          { color: 'var(--amber-400)',label: 'Fat',     g: fat,     kcal: fat * 9,     pct: fPct },
        ].map(({ color, label, g, kcal, pct }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', minWidth: 52 }}>{label}</span>
            <span style={{ fontWeight: 700, fontFamily: "'Space Mono', monospace", color: 'var(--text-primary)' }}>{g}g</span>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: "'Space Mono', monospace", fontSize: '0.72rem' }}>{kcal}kcal · {Math.round(pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeBadge({ grade }: { grade: EvidenceGrade }) {
  const m = GRADE_META[grade];
  return (
    <span style={{ background: m.bg, color: m.color, borderRadius: 4, padding: '2px 7px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em' }}>
      {m.label}
    </span>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: '100px 24px 48px' };
const h1: React.CSSProperties = { fontFamily: "'Syne', sans-serif", fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 };
const muted: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.82rem' };
const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 };
const sectionH: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: "'Space Mono', monospace" };
const btn: React.CSSProperties = { padding: '8px 18px', borderRadius: 8, background: 'var(--teal-500)', color: '#000', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' };
const btnSm: React.CSSProperties = { padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' };
const tag: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, fontFamily: "'Space Mono', monospace" };
const formulaBox: React.CSSProperties = { background: 'var(--bg-void)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 18px', fontFamily: "'Space Mono', monospace", fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.9 };
const row: React.CSSProperties = { display: 'flex', gap: 16, flexWrap: 'wrap' as const };
const statBlock: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 18px', minWidth: 120, textAlign: 'center' as const };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Nutrition() {
  const { userProfile } = useUserProfile();

  // ── Section 2 state ──
  const [mealPlan, setMealPlan] = useState<DayMeals[] | null>(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [mealsError, setMealsError] = useState('');

  // ── Section 3 state ──
  const [suppRecs, setSuppRecs] = useState<SupplementRec[] | null>(null);
  const [loadingSupp, setLoadingSupp] = useState(false);
  const [suppError, setSuppError] = useState('');

  // ── Section 4 state ──
  const [stack, setStack] = useState<SupplementRec[]>([]);

  if (!userProfile) return <div style={{ ...page, ...muted }}>Profile not loaded.</div>;

  const age = calcAge(userProfile.dateOfBirth);
  const tdee = calcTDEE(userProfile.weightKg, userProfile.heightCm, age, userProfile.gender, userProfile.fitnessLevel);
  const isStrength = ['strengthening', 'performance'].includes(userProfile.primaryGoal);
  const hasRenal = userProfile.conditions.some(c => /renal|kidney/i.test(c.name));
  const proteinPerKg = isStrength ? (hasRenal ? 1.2 : 2.0) : 1.6;
  const proteinG = Math.round(userProfile.weightKg * proteinPerKg);

  // Adjust calories by goal
  const goalAdj: Record<string, number> = { rehabilitation: 0, strengthening: 250, flexibility: 0, pain_management: 0, performance: 350 };
  const targetKcal = tdee + (goalAdj[userProfile.primaryGoal] ?? 0);
  const fatG = Math.round((targetKcal * 0.28) / 9);
  const carbG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);
  const hydrationMl = Math.round(userProfile.weightKg * 35);
  const sexFactor = userProfile.gender === 'male' ? '+5' : '−161';
  const actMultiplier = ACTIVITY_MULTIPLIERS[userProfile.fitnessLevel] ?? 1.55;

  // Detect conditions for lab recommendations
  const conditionNames = userProfile.conditions.filter(c => c.isActive).map(c => c.name.toLowerCase());
  const hasDiabetes = conditionNames.some(c => /diabet/i.test(c));
  const hasHTN = conditionNames.some(c => /hypertens/i.test(c));
  const hasOA = conditionNames.some(c => /osteoarthr/i.test(c));

  const labTests = LAB_TESTS.filter(t => {
    if (t.code === 'HbA1c' && !hasDiabetes && !hasHTN) return false;
    return true;
  });

  // ── Section 3: condition-based static defaults ──
  const conditionSupplements = useMemo(() => {
    const seen = new Set<string>();
    const out: SupplementRec[] = [];
    const check = (key: string) => {
      (CONDITION_SUPPLEMENTS[key] ?? []).forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); out.push(s); }
      });
    };
    if (hasOA) check('osteoarthritis');
    if (hasDiabetes) check('diabetes');
    if (hasHTN) check('hypertension');
    if (['flexibility'].includes(userProfile.primaryGoal)) check('flexibility');
    if (['strengthening', 'performance'].includes(userProfile.primaryGoal)) check('general_athlete');
    if (['rehabilitation'].includes(userProfile.primaryGoal)) check('post_surgery');
    if (out.length === 0) check('general_athlete');
    return out;
  }, [userProfile, hasOA, hasDiabetes, hasHTN]);

  // Stack interaction checker
  const stackInteractions = useMemo(() => {
    const warnings: string[] = [];
    const names = stack.map(s => s.name.toLowerCase());
    if (names.includes('berberine hcl') && userProfile.medications.some(m => /metformin/i.test(m.name))) {
      warnings.push('Berberine + Metformin: additive hypoglycemic effect — monitor blood glucose closely');
    }
    if (names.includes('glucosamine sulfate') && names.includes('chondroitin sulfate') && userProfile.medications.some(m => /warfarin/i.test(m.name))) {
      warnings.push('Glucosamine + Chondroitin + Warfarin: may increase anticoagulation — check INR weekly');
    }
    if (names.includes('magnesium glycinate') && names.includes('zinc bisglycinate')) {
      warnings.push('Magnesium + Zinc at high doses: may compete for absorption — separate by 2h');
    }
    if (names.includes('coq10 (ubiquinol)') && userProfile.medications.some(m => /warfarin/i.test(m.name))) {
      warnings.push('CoQ10 + Warfarin: may reduce warfarin efficacy — monitor INR');
    }
    return warnings;
  }, [stack, userProfile.medications]);

  const stackCost = useMemo(() => {
    const costs = stack.map(s => parseInt(s.cost.replace(/[^0-9]/g, ''), 10) || 0);
    return costs.reduce((a, b) => a + b, 0);
  }, [stack]);

  // ── API calls ──
  async function fetchMealPlan() {
    setLoadingMeals(true);
    setMealsError('');
    try {
      const apiKey = (import.meta.env as Record<string, string>)['VITE_ANTHROPIC_API_KEY'];
      if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set');
      const conditions = conditionNames.join(', ') || 'none';
      const flagRules: string[] = [];
      if (hasDiabetes) flagRules.push('Avoid high-glycemic foods (GI>70). Flag if a meal is high-GI.');
      if (hasHTN) flagRules.push('Limit sodium to <2300mg/day. Flag high-sodium meals.');
      if (hasOA) flagRules.push('Emphasise anti-inflammatory omega-3 rich foods.');
      const meds = userProfile!.medications.map(m => m.name).join(', ') || 'none';

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          system: `You are a registered dietitian. Provide a 7-day meal STRUCTURE (not specific recipes — just descriptive names and food types). Active conditions: ${conditions}. Medications: ${meds}. TDEE: ${tdee} kcal. Daily target: ${targetKcal} kcal. ${flagRules.join(' ')} Respond ONLY with valid JSON array of 7 objects with fields: day (Mon-Sun), breakfast, lunch, dinner, snack, avoidNote (optional string flagging any concern for that day).`,
          messages: [{ role: 'user', content: `Generate 7-day meal structure. Goal: ${userProfile!.primaryGoal}. Fitness level: ${userProfile!.fitnessLevel}.` }],
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content.find(b => b.type === 'text')?.text ?? '';
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
      const raw = match ? (match[1] ?? match[0]) : text;
      setMealPlan(JSON.parse(raw.trim()) as DayMeals[]);
    } catch (e) {
      setMealsError(String(e));
    }
    setLoadingMeals(false);
  }

  async function fetchSupplements() {
    setLoadingSupp(true);
    setSuppError('');
    try {
      const apiKey = (import.meta.env as Record<string, string>)['VITE_ANTHROPIC_API_KEY'];
      if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set');
      const conditions = conditionNames.join(', ') || 'none';
      const meds = userProfile!.medications.map(m => m.name).join(', ') || 'none';
      const goal = userProfile!.primaryGoal;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: `You are a clinical pharmacist and sports nutritionist. User: ${userProfile!.name}, ${age}yo, ${userProfile!.weightKg}kg. Conditions: ${conditions}. Medications: ${meds}. Goal: ${goal}. Search examine.com and Labdoor for top-rated products. For each supplement provide evidence grade A/B/C/D where A=multiple RCTs+systematic review, B=some RCT evidence, C=observational only, D=traditional/minimal clinical. Respond ONLY with valid JSON array. Each item: { name, mechanism, grade, dose, timing, contraindications, interactions, product, productUrl, cost, citation, conditions }`,
          messages: [{ role: 'user', content: `Find evidence-based supplement recommendations with current research citations from examine.com and PubMed. Include interaction warnings with listed medications: ${meds}.` }],
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content.find(b => b.type === 'text')?.text ?? '';
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
      const raw = match ? (match[1] ?? match[0]) : text;
      setSuppRecs(JSON.parse(raw.trim()) as SupplementRec[]);
    } catch (e) {
      setSuppError(String(e));
    }
    setLoadingSupp(false);
  }

  const displaySupplements = suppRecs ?? conditionSupplements;

  function toggleStack(s: SupplementRec) {
    setStack(prev => prev.some(x => x.name === s.name) ? prev.filter(x => x.name !== s.name) : [...prev, s]);
  }

  function exportShoppingList() {
    const lines = [
      `PhysioCore AI — Supplement Shopping List`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `Estimated monthly cost: ~$${stackCost}`,
      '',
      ...stack.map(s => `• ${s.name} — ${s.dose}\n  Product: ${s.product}\n  ${s.productUrl}\n  Cost: ${s.cost}`),
      '',
      stackInteractions.length > 0 ? ['INTERACTION WARNINGS:', ...stackInteractions].join('\n') : '',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'supplement-stack.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <div style={page}>
      <h1 style={h1}>Nutrition & Supplements</h1>
      <p style={{ ...muted, marginBottom: 28 }}>
        Evidence-based recommendations for {userProfile.name} · Every recommendation cites sources.
      </p>

      {/* ─── Section 1: TDEE + Macros ─────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionH}>
          <span style={{ fontSize: '1.2rem' }}>🔢</span> Macronutrient Calculator
        </div>

        <div style={formulaBox}>
          <div><strong>Mifflin-St Jeor BMR</strong></div>
          <div>BMR = (10 × {userProfile.weightKg}kg) + (6.25 × {userProfile.heightCm}cm) − (5 × {age}y) {sexFactor}</div>
          <div style={{ color: '#6366f1' }}>BMR = {Math.round(10 * userProfile.weightKg + 6.25 * userProfile.heightCm - 5 * age + (userProfile.gender === 'male' ? 5 : -161))} kcal/day</div>
          <div style={{ marginTop: 6 }}>TDEE = BMR × {actMultiplier} <span style={{ color: '#64748b' }}>({userProfile.fitnessLevel})</span></div>
          <div style={{ color: '#6366f1' }}>TDEE = <strong>{tdee} kcal/day</strong></div>
          {goalAdj[userProfile.primaryGoal] !== 0 && (
            <div style={{ marginTop: 4, color: '#22c55e' }}>Goal adjustment ({userProfile.primaryGoal}): +{goalAdj[userProfile.primaryGoal]} kcal → <strong>Target: {targetKcal} kcal/day</strong></div>
          )}
        </div>

        <div style={{ ...row, marginBottom: 20 }}>
          <div style={statBlock}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal-500)' }}>{targetKcal}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Daily kcal target</div>
          </div>
          <div style={statBlock}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal-400)' }}>{proteinG}g</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Protein ({proteinPerKg}g/kg)</div>
          </div>
          <div style={statBlock}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.5rem', fontWeight: 700, color: 'var(--blue-400)' }}>{carbG}g</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Carbohydrates</div>
          </div>
          <div style={statBlock}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.5rem', fontWeight: 700, color: 'var(--amber-400)' }}>{fatG}g</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Fat</div>
          </div>
          <div style={statBlock}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>{hydrationMl}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Hydration (ml/day)</div>
          </div>
          <div style={{ ...statBlock, border: '1px solid var(--border-teal)', background: 'var(--teal-dim)' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal-500)' }}>{hydrationMl} + 500</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>35ml/kg + 500ml/session</div>
          </div>
        </div>

        {hasRenal && (
          <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: '0.8rem', color: 'var(--warning)' }}>
            ⚠ Renal condition detected — protein limited to 1.2g/kg. Consult your nephrologist before exceeding.
          </div>
        )}
        {hasDiabetes && (
          <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: '0.8rem', color: 'var(--warning)' }}>
            ⚠ Diabetes detected — carbohydrate quality matters more than quantity. Focus on low-GI sources (oats, legumes, vegetables). Monitor post-meal glucose.
          </div>
        )}
        {hasHTN && (
          <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: '0.8rem', color: 'var(--warning)' }}>
            ⚠ Hypertension detected — target sodium &lt;2300mg/day. Increase potassium (bananas, sweet potato, leafy greens). DASH diet pattern recommended.
          </div>
        )}

        <DonutChart protein={proteinG} carbs={carbG} fat={fatG} />
        <p style={{ ...muted, marginTop: 10, fontSize: '0.75rem' }}>
          Protein: {proteinPerKg}g/kg {isStrength ? '(strength goal — higher end)' : '(conservative range)'} · Hydration: 35ml/kg base + 500ml/session<br />
          Source: Mifflin MD et al., 1990, JADA · Stokes T et al., 2018, Nutrients (protein)
        </p>
      </div>

      {/* ─── Section 2: 7-day Meal Structure ─────────────────────────────── */}
      <div style={card}>
        <div style={sectionH}>
          <span style={{ fontSize: '1.2rem' }}>🍽</span> Personalised 7-Day Meal Structure
          <button style={{ ...btn, marginLeft: 'auto', fontSize: '0.8rem', padding: '7px 16px' }} onClick={() => { void fetchMealPlan(); }} disabled={loadingMeals}>
            {loadingMeals ? 'Generating...' : mealPlan ? 'Regenerate' : 'Generate with AI'}
          </button>
        </div>

        {mealsError && <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: 10 }}>Error: {mealsError}</div>}

        {!mealPlan && !loadingMeals && (
          <p style={muted}>Click "Generate with AI" to create a personalised 7-day meal structure based on your conditions, goals, and medications.</p>
        )}
        {loadingMeals && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            Generating 7-day plan with dietary condition flags...
          </div>
        )}

        {mealPlan && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Day', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mealPlan.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#334155' }}>{d.day}</td>
                    <td style={{ padding: '8px 10px' }}>{d.breakfast}</td>
                    <td style={{ padding: '8px 10px' }}>{d.lunch}</td>
                    <td style={{ padding: '8px 10px' }}>{d.dinner}</td>
                    <td style={{ padding: '8px 10px' }}>{d.snack}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {d.avoidNote && (
                        <span style={{ ...tag, background: '#fef9c3', color: '#92400e' }}>⚠ {d.avoidNote}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ ...muted, marginTop: 10, fontSize: '0.75rem' }}>
              AI-generated meal structure based on your active conditions and medications. Not specific recipes — consult a registered dietitian for personalised meal plans.
            </p>
          </div>
        )}
      </div>

      {/* ─── Section 3: Supplement Protocol ──────────────────────────────── */}
      <div style={card}>
        <div style={sectionH}>
          <span style={{ fontSize: '1.2rem' }}>💊</span> Evidence-Based Supplement Protocol
          <button style={{ ...btn, marginLeft: 'auto', fontSize: '0.8rem', padding: '7px 16px', background: '#7c3aed' }} onClick={() => { void fetchSupplements(); }} disabled={loadingSupp}>
            {loadingSupp ? 'Searching...' : suppRecs ? 'Re-search' : 'Search with web_search'}
          </button>
        </div>

        <p style={{ ...muted, marginBottom: 14 }}>
          {suppRecs ? 'Results from live web search via Claude API.' : 'Showing condition-based defaults. Click "Search with web_search" for live citations from examine.com and PubMed.'}
        </p>
        {suppError && <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: 10 }}>Error: {suppError}</div>}
        {loadingSupp && <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>Searching examine.com, PubMed, Labdoor...</div>}

        {!loadingSupp && displaySupplements.map((s, i) => {
          const inStack = stack.some(x => x.name === s.name);
          return (
            <div key={i} style={{
              border: `1px solid ${inStack ? 'var(--border-teal)' : 'var(--border-subtle)'}`,
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 10,
              background: inStack ? 'var(--teal-dim)' : 'var(--bg-elevated)',
              position: 'relative' as const,
              overflow: 'hidden',
            }}>
              {inStack && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--teal-500), transparent)' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.name}</span>
                  <GradeBadge grade={s.grade as EvidenceGrade} />
                </div>
                <button
                  style={{
                    ...btnSm,
                    background: inStack ? 'var(--teal-500)' : 'var(--bg-overlay)',
                    color: inStack ? '#000' : 'var(--text-secondary)',
                    border: inStack ? 'none' : '1px solid var(--border-default)',
                    fontWeight: inStack ? 700 : 500,
                  }}
                  onClick={() => { toggleStack(s); }}
                >
                  {inStack ? '✓ In stack' : '+ Add to stack'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '5px 24px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <div><span style={muted}>Mechanism: </span>{s.mechanism}</div>
                <div><span style={muted}>Dose: </span><strong style={{ color: 'var(--text-primary)', fontFamily: "'Space Mono', monospace" }}>{s.dose}</strong></div>
                <div><span style={muted}>Timing: </span>{s.timing}</div>
                <div><span style={muted}>Cost: </span><span style={{ color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace" }}>{s.cost}</span></div>
                {s.contraindications && (
                  <div style={{ gridColumn: '1 / -1' }}><span style={muted}>Contraindications: </span>{s.contraindications}</div>
                )}
                {s.interactions && (
                  <div style={{ gridColumn: '1 / -1', color: s.interactions.includes('⚠') || s.interactions.includes('SIGNIFICANT') ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    <span style={muted}>Interactions: </span>{s.interactions}
                  </div>
                )}
                {s.product && (
                  <div><span style={muted}>Product: </span>
                    <a href={s.productUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-500)', textDecoration: 'none', fontWeight: 500 }}>{s.product}</a>
                  </div>
                )}
              </div>

              {s.citation && (
                <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic', fontFamily: "'Space Mono', monospace" }}>
                  {s.citation}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {Object.entries(GRADE_META).map(([g, m]) => (
            <span key={g} style={{ ...tag, background: m.bg, color: m.color }}>
              {m.label}
            </span>
          ))}
          <span style={{ ...muted, fontSize: '0.72rem', alignSelf: 'center' }}>
            A=Multiple RCTs+SR · B=Some RCT evidence · C=Observational · D=Traditional use
          </span>
        </div>
      </div>

      {/* ─── Section 4: Stack Builder ─────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionH}>
          <span style={{ fontSize: '1.2rem' }}>🧪</span> Supplement Stack Builder
          {stack.length > 0 && (
            <button style={{ ...btnSm, marginLeft: 'auto' }} onClick={exportShoppingList}>
              Export shopping list
            </button>
          )}
        </div>

        {stack.length === 0 ? (
          <p style={muted}>Add supplements from the protocol above to build your stack. Interactions are checked automatically.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 }}>
              {stack.map(s => (
                <div key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal-dim)', border: '1px solid var(--border-teal)', borderRadius: 99, padding: '5px 12px', fontSize: '0.78rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ color: 'var(--teal-500)', fontFamily: "'Space Mono', monospace", fontSize: '0.7rem' }}>{s.dose}</span>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '1rem', lineHeight: 1, padding: 0 }} onClick={() => { toggleStack(s); }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ ...row, marginBottom: 16 }}>
              <div style={statBlock}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.4rem', fontWeight: 700, color: 'var(--teal-500)' }}>{stack.length}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Supplements</div>
              </div>
              <div style={statBlock}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>~${stackCost}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Est. monthly cost</div>
              </div>
            </div>

            {stackInteractions.length > 0 && (
              <div style={{ background: 'rgba(255,184,48,0.08)', border: '1px solid rgba(255,184,48,0.2)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--warning)', marginBottom: 6 }}>⚠ Interaction Warnings</div>
                {stackInteractions.map((w, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: 'var(--warning)', marginBottom: 4, opacity: 0.85 }}>• {w}</div>
                ))}
              </div>
            )}
            {stackInteractions.length === 0 && (
              <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--success)' }}>
                ✓ No significant interactions detected between selected supplements
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Section 5: Lab Tests ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionH}>
          <span style={{ fontSize: '1.2rem' }}>🩸</span> Lab Test Recommendations
        </div>

        <div style={{ background: 'var(--blue-dim)', border: '1px solid rgba(77,184,255,0.2)', borderRadius: 8, padding: '10px 16px', fontSize: '0.78rem', color: 'var(--blue-400)', marginBottom: 16 }}>
          Ask your GP for these tests based on your conditions and goals. Reference ranges shown are for adults — your GP may use lab-specific ranges.
        </div>

        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.75rem', background: 'var(--bg-void)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: 'var(--teal-500)', lineHeight: 1.9 }}>
          {'> '}
          {labTests.map(t => t.name).join(', ')}
        </div>

        {labTests.map((t, i) => (
          <div key={i} style={{ borderBottom: i < labTests.length - 1 ? '1px solid var(--border-subtle)' : 'none', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{t.name}</span>
              <span style={{ ...tag, background: 'var(--bg-overlay)', color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>{t.code}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{t.reason}</div>
            <div style={{ fontSize: '0.75rem', display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
              <span><span style={muted}>Range: </span><span style={{ fontFamily: "'Space Mono', monospace", color: 'var(--text-primary)', fontSize: '0.72rem' }}>{t.refRange}</span></span>
              <span><span style={muted}>If abnormal: </span><span style={{ color: 'var(--blue-400)' }}>{t.action}</span></span>
            </div>
          </div>
        ))}

        <p style={{ ...muted, marginTop: 14, fontSize: '0.73rem' }}>
          Test recommendations based on your profile. Not a substitute for clinical assessment. Consult your GP or a registered healthcare provider.
        </p>
      </div>

      <AiChatPanel
        pageContext={`Current page: Nutrition Plan. TDEE: ${targetKcal} kcal/day. Protein: ${proteinG}g, Carbs: ${carbG}g, Fat: ${fatG}g. Hydration: ${hydrationMl}ml/day. Active conditions: ${userProfile.conditions.filter(c => c.isActive).map(c => c.name).join(', ') || 'none'}. Supplement stack: ${stack.map(s => s.name).join(', ') || 'empty'}. Fitness goal: ${userProfile.primaryGoal.replace(/_/g, ' ')}.`}
        quickPrompts={[
          'How do I get enough protein on a vegetarian diet?',
          'I have a gluten allergy — what should I avoid?',
          'I have a nut allergy — which supplements should I check?',
          'Suggest Indian food options that fit my macros',
          'Are any of my supplements unsafe with my medications?',
        ]}
      />
    </div>
  );
}
