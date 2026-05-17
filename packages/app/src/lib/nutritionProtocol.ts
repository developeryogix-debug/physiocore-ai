/**
 * nutritionProtocol.ts — Clinical nutrition constants + recovery phase logic
 * SaMD Class II: data only — no autonomous clinical decisions.
 * Citations: Calder 2017, Shaw 2017, Moores 2013, Gammoh 2017, Abbasi 2012, Lanhers 2017
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecoveryPhase = 'acute' | 'subacute' | 'maintenance';
export type ConditionKey  = 'back_pain' | 'post_surgery' | 'inflammatory';
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface NutrientRec {
  name:       string;
  dose:       string;
  timing:     string;
  grade:      EvidenceGrade;
  phases:     RecoveryPhase[];
  conditions: ConditionKey[];
  mechanism:  string;
  citation:   string;
  pmid:       string;
}

interface PhaseInfo {
  label: string;
  range: string;
  focus: string;
  foods: string[];
}

interface ConditionInfo {
  label:       string;
  emoji:       string;
  description: string;
}

export interface SupplementRec {
  name: string; mechanism: string; grade: EvidenceGrade;
  dose: string; timing: string; contraindications: string;
  interactions: string; product: string; productUrl: string;
  cost: string; citation: string; conditions: string[];
}

export interface LabTest {
  name: string; code: string; reason: string; refRange: string; action: string;
}

// ── Recovery Phase Data ───────────────────────────────────────────────────────

export const RECOVERY_PHASES: Record<RecoveryPhase, PhaseInfo> = {
  acute: {
    label: 'Acute',
    range: '0–72 hours',
    focus: 'Anti-inflammatory, pain modulation, tissue protection',
    foods: ['Oily fish', 'Blueberries', 'Turmeric', 'Ginger', 'Leafy greens'],
  },
  subacute: {
    label: 'Subacute',
    range: '3 days – 6 weeks',
    focus: 'Tissue repair, collagen synthesis, protein remodelling',
    foods: ['Lean protein', 'Citrus fruits', 'Bone broth', 'Eggs', 'Nuts & seeds'],
  },
  maintenance: {
    label: 'Maintenance',
    range: '6+ weeks',
    focus: 'Performance optimisation, long-term joint health',
    foods: ['Whole grains', 'Legumes', 'Greek yoghurt', 'Dark chocolate', 'Green tea'],
  },
};

export const CONDITIONS: Record<ConditionKey, ConditionInfo> = {
  back_pain:    { label: 'Back Pain',    emoji: '🦴', description: 'Spinal and paraspinal focus' },
  post_surgery: { label: 'Post-Surgery', emoji: '🩹', description: 'Wound healing and recovery' },
  inflammatory: { label: 'Inflammatory', emoji: '🔥', description: 'Systemic inflammation reduction' },
};

// ── Phase Nutrients (clinical, cited) ────────────────────────────────────────

export const PHASE_NUTRIENTS: NutrientRec[] = [
  {
    name: 'Omega-3 (EPA/DHA)',
    dose: '2–4 g/day EPA+DHA',
    timing: 'With meals',
    grade: 'A',
    phases: ['acute', 'subacute', 'maintenance'],
    conditions: ['back_pain', 'inflammatory'],
    mechanism: 'COX-2 inhibition; resolvin/protectin synthesis; reduces IL-6 and TNF-α',
    citation: 'Calder PC, 2017, Ann Nutr Metab',
    pmid: '28965053',
  },
  {
    name: 'Curcumin (Phytosome)',
    dose: '500 mg 2× daily',
    timing: 'With black pepper (piperine) or fat',
    grade: 'B',
    phases: ['acute', 'subacute'],
    conditions: ['inflammatory', 'back_pain'],
    mechanism: 'NF-κB pathway inhibition; downregulates inflammatory cytokines',
    citation: 'Daily JW et al., 2016, J Med Food',
    pmid: '27533649',
  },
  {
    name: 'Vitamin C (Ascorbic Acid)',
    dose: '500 mg/day',
    timing: 'With meals to reduce GI irritation',
    grade: 'B',
    phases: ['acute', 'subacute'],
    conditions: ['post_surgery', 'inflammatory'],
    mechanism: 'Prolyl/lysyl hydroxylase cofactor; collagen cross-linking; antioxidant',
    citation: 'Moores J, 2013, Nutrients',
    pmid: '23736884',
  },
  {
    name: 'Collagen Peptides',
    dose: '15 g/day with vitamin C',
    timing: '30–60 min pre-exercise',
    grade: 'B',
    phases: ['subacute', 'maintenance'],
    conditions: ['post_surgery', 'back_pain'],
    mechanism: 'Hydroxyproline-rich peptides stimulate tenocyte and chondrocyte collagen synthesis',
    citation: 'Shaw G et al., 2017, Am J Clin Nutr',
    pmid: '28174772',
  },
  {
    name: 'Zinc Bisglycinate',
    dose: '15 mg elemental Zn/day',
    timing: 'With meals (avoid >40mg/day)',
    grade: 'B',
    phases: ['acute', 'subacute'],
    conditions: ['post_surgery'],
    mechanism: 'Metalloproteinase cofactor; immune modulation; wound healing',
    citation: 'Gammoh NZ & Rink L, 2017, Nutrients',
    pmid: '28629136',
  },
  {
    name: 'Magnesium Glycinate',
    dose: '300 mg elemental Mg/day',
    timing: 'Evening (promotes relaxation)',
    grade: 'B',
    phases: ['subacute', 'maintenance'],
    conditions: ['back_pain', 'inflammatory'],
    mechanism: 'Muscle relaxation via Ca²⁺ antagonism; cofactor for 300+ enzymes',
    citation: 'Abbasi B et al., 2012, J Res Med Sci',
    pmid: '23853635',
  },
  {
    name: 'Creatine Monohydrate',
    dose: '3–5 g/day (no loading)',
    timing: 'Post-exercise with carbohydrate',
    grade: 'A',
    phases: ['maintenance'],
    conditions: [],
    mechanism: 'Phosphocreatine resynthesis; satellite cell activation; muscle hypertrophy',
    citation: 'Lanhers C et al., 2017, Eur J Sport Sci',
    pmid: '28609972',
  },
  {
    name: 'Bromelain',
    dose: '400 mg 3× daily',
    timing: 'Between meals for anti-inflammatory effect',
    grade: 'B',
    phases: ['acute'],
    conditions: ['inflammatory', 'post_surgery'],
    mechanism: 'Proteolytic enzyme; reduces bradykinin-mediated oedema; fibrinolytic',
    citation: 'Majtan J et al., 2012, Evid Based Complement Alternat Med',
    pmid: '22454684',
  },
];

// ── Grade + Activity constants ─────────────────────────────────────────────────

export const GRADE_META: Record<EvidenceGrade, { label: string; bg: string; color: string }> = {
  A: { label: 'Grade A', bg: 'rgba(0,230,118,0.1)',  color: '#00E676' },
  B: { label: 'Grade B', bg: 'rgba(77,184,255,0.1)', color: '#4DB8FF' },
  C: { label: 'Grade C', bg: 'rgba(255,184,48,0.1)', color: '#FFB830' },
  D: { label: 'Grade D', bg: 'rgba(74,85,104,0.15)', color: '#8892A4' },
};

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  beginner: 1.375, intermediate: 1.55, advanced: 1.725, athlete: 1.9,
};

// ── Supplement defaults ──────────────────────────────────────────────────────

export const CONDITION_SUPPLEMENTS: Record<string, SupplementRec[]> = {
  osteoarthritis: [
    { name: 'Glucosamine Sulfate', mechanism: 'Stimulates cartilage synthesis; inhibits IL-1β, TNF-α', grade: 'B', dose: '1500 mg/day', timing: 'With meals (split 500mg × 3)', contraindications: 'Shellfish allergy; caution in diabetes', interactions: 'May potentiate warfarin — monitor INR', product: 'NOW Glucosamine Sulfate 1000mg', productUrl: 'https://examine.com/supplements/glucosamine/', cost: '~$18/month', citation: 'Towheed et al., 2005, Cochrane Database Syst Rev', conditions: ['osteoarthritis'] },
    { name: 'Chondroitin Sulfate', mechanism: 'Inhibits cartilage-degrading enzymes; structural proteoglycan substrate', grade: 'B', dose: '1200 mg/day', timing: 'With glucosamine or split across meals', contraindications: 'Avoid with active bleeding disorders', interactions: 'Mild anticoagulant effect — additive with warfarin', product: 'Jarrow Formulas Chondroitin 400mg', productUrl: 'https://examine.com/supplements/chondroitin/', cost: '~$14/month', citation: 'Clegg et al., 2006, NEJM (GAIT trial)', conditions: ['osteoarthritis'] },
  ],
  general_athlete: [
    { name: 'Creatine Monohydrate', mechanism: 'Replenishes phosphocreatine; buffers ATP during high-intensity efforts', grade: 'A', dose: '3–5 g/day (no loading)', timing: 'Post-workout with carbohydrate', contraindications: 'Caution with pre-existing renal disease', interactions: 'NSAIDs: theoretically additive renal load', product: 'Optimum Nutrition Micronized Creatine', productUrl: 'https://examine.com/supplements/creatine/', cost: '~$12/month', citation: 'Lanhers et al., 2017, Eur J Sport Sci', conditions: ['strengthening', 'performance'] },
  ],
  flexibility: [
    { name: 'Magnesium Glycinate', mechanism: 'Cofactor for 300+ enzymes; promotes muscle relaxation via Ca²⁺ antagonism', grade: 'B', dose: '300 mg elemental Mg/day', timing: 'Evening, before sleep', contraindications: 'Severe renal impairment (GFR <30)', interactions: 'Reduces absorption of tetracyclines — separate by 2h', product: 'Thorne Magnesium Bisglycinate', productUrl: 'https://examine.com/supplements/magnesium/', cost: '~$22/month', citation: 'Abbasi et al., 2012, J Res Med Sci', conditions: ['flexibility'] },
  ],
  post_surgery: [
    { name: 'Vitamin C (Ascorbic Acid)', mechanism: 'Essential cofactor for collagen hydroxylation; antioxidant', grade: 'B', dose: '500 mg/day', timing: 'With meals', contraindications: 'Calcium oxalate kidney stones (limit to 200mg)', interactions: 'High doses may interfere with B12 absorption', product: 'Pure Encapsulations Vitamin C 500mg', productUrl: 'https://examine.com/supplements/vitamin-c/', cost: '~$10/month', citation: 'Moores, 2013, Nutrients', conditions: ['rehabilitation', 'post_surgery'] },
    { name: 'Zinc Bisglycinate', mechanism: 'Essential cofactor for metalloproteinases; immune modulation', grade: 'B', dose: '15 mg elemental Zn/day', timing: 'With meals', contraindications: "Avoid >40mg/day long-term", interactions: 'Reduces absorption of quinolone antibiotics — separate by 2h', product: 'Thorne Zinc Picolinate 15mg', productUrl: 'https://examine.com/supplements/zinc/', cost: '~$8/month', citation: 'Gammoh & Rink, 2017, Nutrients', conditions: ['rehabilitation', 'post_surgery'] },
  ],
  hypertension: [
    { name: 'CoQ10 (Ubiquinol)', mechanism: 'Restores endothelial function; reduces vascular resistance via NO pathway', grade: 'B', dose: '100–200 mg/day', timing: 'With a fat-containing meal', contraindications: 'May lower BP — monitor on antihypertensives', interactions: 'May reduce warfarin efficacy — monitor INR', product: 'Jarrow Formulas QH-absorb 100mg', productUrl: 'https://examine.com/supplements/coenzyme-q10/', cost: '~$28/month', citation: 'Rosenfeldt et al., 2007, J Hum Hypertens', conditions: ['hypertension'] },
  ],
  diabetes: [
    { name: 'Berberine HCl', mechanism: 'AMPK activator; reduces hepatic glucose output; improves insulin sensitivity', grade: 'B', dose: '500 mg, 2–3× daily', timing: 'With meals', contraindications: 'Pregnancy/breastfeeding contraindicated', interactions: '⚠ SIGNIFICANT: Potentiates metformin — risk of hypoglycemia. Monitor glucose.', product: 'Thorne Berberine-500', productUrl: 'https://examine.com/supplements/berberine/', cost: '~$35/month', citation: 'Yin et al., 2008, Metabolism', conditions: ['type 2 diabetes'] },
  ],
};

export const LAB_TESTS: LabTest[] = [
  { name: '25-OH Vitamin D', code: '25(OH)D', reason: 'Deficiency >40% adults; linked to musculoskeletal pain and depression', refRange: '75–150 nmol/L (30–60 ng/mL)', action: 'If <50 nmol/L: supplement 2000–4000 IU/day, retest 12 weeks' },
  { name: 'Vitamin B12', code: 'B12 / Cobalamin', reason: 'Essential for neurological function; deficiency causes neuropathy', refRange: '200–700 pmol/L', action: 'If <200: methylcobalamin 1000mcg sublingual daily' },
  { name: 'Iron Studies (Ferritin, TSAT)', code: 'Iron panel', reason: 'Iron deficiency impairs exercise performance even without anaemia', refRange: 'Ferritin >30 µg/L; TSAT >20%', action: 'If ferritin <30: iron bisglycinate 25mg/day with Vitamin C' },
  { name: 'HbA1c', code: 'Glycated haemoglobin', reason: 'Identifies pre-diabetes; high glucose accelerates tissue damage', refRange: '<5.7% normal; 5.7–6.4% pre-diabetes; ≥6.5% diabetes', action: 'If 5.7–6.4%: dietary intervention + GP referral' },
  { name: 'Lipid Panel', code: 'TC / HDL / LDL / TG', reason: 'Cardiovascular risk assessment; dyslipidaemia common in metabolic conditions', refRange: 'LDL <2.6 mmol/L; HDL >1.0 (M) >1.3 (F); TG <1.7', action: 'If LDL elevated: dietary fat modification, omega-3 3g/day' },
  { name: 'CRP (high-sensitivity)', code: 'hs-CRP', reason: 'Systemic inflammation marker; guides anti-inflammatory nutrition', refRange: '<1.0 mg/L optimal; 1–3 elevated; >3 high risk', action: 'If elevated: Mediterranean diet, omega-3, assess sleep and stress' },
  { name: 'Thyroid (TSH)', code: 'TSH', reason: 'Thyroid dysfunction causes fatigue and musculoskeletal symptoms', refRange: '0.4–4.0 mIU/L', action: 'If outside range: request Free T4 and T3; refer to endocrinology' },
  { name: 'Magnesium (RBC)', code: 'RBC Mg', reason: 'Serum Mg unreliable; RBC Mg reflects true tissue stores', refRange: '4.2–6.8 mg/dL (RBC)', action: 'If low: magnesium glycinate 300mg/day, reduce alcohol/caffeine' },
];

// ── Logic helpers ─────────────────────────────────────────────────────────────

export function detectRecoveryPhase(lastSessionIso: string | null): RecoveryPhase {
  if (!lastSessionIso) return 'maintenance';
  const hours = (Date.now() - new Date(lastSessionIso).getTime()) / 3_600_000;
  if (hours <= 72)   return 'acute';
  if (hours <= 1008) return 'subacute'; // 42 days ≈ 6 weeks
  return 'maintenance';
}

export function filterNutrients(phase: RecoveryPhase, condition: ConditionKey | null): NutrientRec[] {
  return PHASE_NUTRIENTS.filter(n =>
    n.phases.includes(phase) &&
    (condition === null || n.conditions.length === 0 || n.conditions.includes(condition))
  );
}
