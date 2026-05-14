# Phase 3 — Treatment Planning Swarm Design

**Status:** Design only — implementation follows Phase 2 Assessment UI.  
**References:** VISION.md §Phase 3, PHASE2_ASSESSMENT_SWARM.md §3.8, packages/clinical/src/types.ts, packages/app/src/lib/exerciseLibrary.ts  
**Regulatory context:** SaMD Class II. Every exercise/load recommendation cites a primary source. Clinician reviews output before patient delivery.

---

## 1. Architecture Overview

```
ConsensusAgent report
        │
        ├──────────────────────────┐
        ▼                          ▼
ConservativeAgent          EarlyMobAgent
  (Claude Sonnet)           (Claude Sonnet)
        │                          │
        └─────────┬────────────────┘
                  ▼
         TreatmentArbiterAgent   ← brief Claude Opus call
                  │
                  ▼
         PrescriptionAgent       ← Claude Haiku
                  │
                  ▼
         FinalTreatmentPlan
                  │
              (weekly)
                  ▼
         ProgressionAgent        ← Claude Haiku, runs after every 4 sessions
```

**Debate pattern:** Both planning agents propose independently from identical inputs. Arbiter compares on 6 axes (safety, evidence grade, patient-specific fit, progression logic, FHIR completeness, risk of harm). Winning plan — or a hybrid — becomes the prescription input.

---

## 2. Package Location

```
packages/agents/assessment/src/
└── treatment/
    ├── ConservativeAgent.ts
    ├── EarlyMobAgent.ts
    ├── TreatmentArbiterAgent.ts
    ├── ProgressionAgent.ts
    ├── PrescriptionAgent.ts
    └── TreatmentOrchestrator.ts
```

Types appended to `packages/agents/assessment/src/types/findings.ts`.  
Exports added to `packages/agents/assessment/src/index.ts`.

---

## 3. TypeScript Interfaces

### 3.1 Shared primitives

```typescript
// ── Phase 3 shared types ──────────────────────────────────────────────────────

export type LoadingStrategy =
  | 'rest'         // no load — tissue protection phase
  | 'gentle'       // isometric only, pain-free
  | 'moderate'     // isotonic, controlled ROM, pain <4/10
  | 'progressive'  // full ROM, progressive overload, pain <6/10
  | 'high';        // sport-specific, power, high load

export interface TreatmentPhase {
  phaseNumber:        number;          // 1-indexed
  label:              string;          // "Acute protection", "Early mobilisation", etc.
  durationWeeks:      number;
  loadingStrategy:    LoadingStrategy;
  maxAcceptablePain:  number;          // 0–10; stop/regress if exceeded
  exercises:          PrescribedExercise[];
  homeProgram:        PrescribedExercise[];
  progressionTrigger: string;          // measurable condition to advance phase
  regressionTrigger:  string;          // measurable condition to drop back
  sessionFrequency:   number;          // per week
  sessionDurationMin: number;
  clinicianNotes:     string;
  citations:          string[];
}

export interface TreatmentPlan {
  agentId:            'conservative-agent' | 'early-mob-agent';
  version:            '1.0.0';
  patientId:          string;
  assessmentId:       string;
  generatedAt:        string;

  philosophy:         string;          // 1-sentence rationale
  totalDurationWeeks: number;
  phases:             TreatmentPhase[];

  contraindications:  string[];        // exercises / movements to avoid entirely
  redLineConditions:  string[];        // stop-exercise triggers (>7/10 pain, new neuro sx, etc.)
  expectedOutcomes: Array<{
    outcome:   string;
    timeframe: string;
    measure:   string;               // e.g. "PSFS ≥7/10", "TUG <12s"
  }>;
  evidenceBasis:      string[];        // primary citations supporting approach

  cptCodes:           string[];
  icd10Codes:         string[];
  processingMs:       number;
}
```

### 3.2 ConservativeAgent / EarlyMobAgent input

```typescript
export interface PlanningInput {
  assessmentId:       string;
  patientId:          string;
  consensusReport:    ClinicalAssessmentReport;  // from Phase 2
  userProfile:        UserProfile;               // from @physiocore/types
  availableJoints:    string[];                  // affected joints — keys into jointDatabase
  sessionHistory?:    SessionSummary[];          // last 12 sessions for context
}
```

### 3.3 TreatmentArbiterAgent

```typescript
export interface ArbiterInput {
  patientId:       string;
  assessmentId:    string;
  conservative:    TreatmentPlan;
  earlyMob:        TreatmentPlan;
  userProfile:     UserProfile;
  urgencyLevel:    'routine' | 'urgent' | 'emergency';   // from consensusReport.referralUrgency
}

export interface ArbiterVerdict {
  winner:          'conservative' | 'early_mob' | 'hybrid';
  hybridRationale: string | null;
  // If hybrid: which phases come from which plan
  phaseSource:     Array<{
    phaseNumber: number;
    source:      'conservative' | 'early_mob' | 'modified';
    modification?: string;
  }>;
  rejectedElements: Array<{
    fromPlan:  'conservative' | 'early_mob';
    element:   string;
    reason:    string;
    risk:      'safety' | 'evidence' | 'patient_fit';
  }>;
  safetyOverrides:   string[];      // must-include constraints regardless of winner
  arbitrationReason: string;        // 2–3 sentences explaining decision
  confidenceScore:   number;        // 0–1
  processingMs:      number;
}
```

### 3.4 ProgressionAgent

```typescript
export interface ProgressionInput {
  patientId:       string;
  currentPlan:     FinalTreatmentPlan;
  currentWeek:     number;
  recentSessions:  SessionSummary[];    // last 4 sessions minimum
  recentPainScores: number[];           // NPRS from outcomes table
  recentPSFS?:     number[];            // from outcomes table
  functionalReport?: FunctionalReport;  // latest if available
}

export interface ProgressionOutput {
  action:             'advance' | 'hold' | 'regress' | 'modify';
  targetPhase:        number;           // phase to move to (may be same)
  reasoning:          string;
  progressScore:      number;           // 0–100, derived from linear regression
  formScoreSlope:     number;           // avg form score change per session (from linear regression)
  sessionsTrend:      'improving' | 'plateaued' | 'declining';
  updatedExercises:   PrescribedExercise[];
  newLoadingStrategy: LoadingStrategy;
  flagsForClinician:  string[];         // unexpected plateau, pain spike, etc.
  processingMs:       number;
}
```

### 3.5 PrescriptionAgent

```typescript
export interface PrescriptionInput {
  patientId:      string;
  assessmentId:   string;
  winningPlan:    TreatmentPlan;
  arbiterVerdict: ArbiterVerdict;
  userProfile:    UserProfile;
  consensusReport: ClinicalAssessmentReport;
}

export interface WeekByWeekSchedule {
  week:                number;
  phase:               number;
  sessionCount:        number;
  sessionDurationMin:  number;
  exercises:           PrescribedExercise[];   // clinic sessions
  homeProgram:         PrescribedExercise[];   // between sessions
  reviewMilestone?:    string;                 // "Reassess ROM at week 4"
}

export interface FinalTreatmentPlan {
  agentId:              'prescription-agent';
  version:              '1.0.0';
  patientId:            string;
  assessmentId:         string;
  generatedAt:          string;

  sourcePlan:           ArbiterVerdict['winner'];
  totalDurationWeeks:   number;
  phases:               TreatmentPhase[];
  weeklySchedule:       WeekByWeekSchedule[];

  contraindications:    string[];
  redLineConditions:    string[];
  progressionTriggers:  string[];

  cptCodes:             string[];
  icd10Codes:           string[];
  fhirCarePlan:         Record<string, unknown>;  // FHIR R4 CarePlan resource

  patientInstructions:  string;    // plain English, 3–5 sentences
  clinicianNotes:       string;    // SOAP-style clinical context

  evidenceBasis:        string[];
  processingMs:         number;
}
```

---

## 4. Agent Specifications

### 4.1 ConservativeAgent

**Model:** `claude-sonnet-4-6`  
**Max tokens:** 1800  
**Philosophy:** Tissue healing first. Load tolerance second. Pain-free movement is the non-negotiable gate.

**System prompt:**
```
You are a conservative physiotherapy treatment planner. Your clinical philosophy:
1. Tissue healing timeline: inflammatory (0–3 days) → proliferative (3–21 days) → remodelling (21 days–2 years)
2. Load progression: isometric only → isotonic pain-free → full ROM → functional loading
3. Pain gate: STOP or regress if pain exceeds 3/10 at rest or 5/10 during exercise
4. Loading increments: maximum 10% increase per week (Dye SF. Clin Orthop Relat Res. 2005)
5. Recovery: minimum 48h rest between sessions targeting the same muscle group
6. Contraindications are absolute — never prescribe an exercise that matches an active injury contraindication
7. Evidence: prefer Grade A/B exercises from the exercise library
Output ONLY valid JSON matching the schema. No preamble.
```

**How it reads exerciseLibrary.ts:**
- Filter by `equipmentAvailable` — only include exercises matching user's equipment
- Exclude any exercise whose `contraindications` overlap with `userProfile.injuries[].bodyPart` or `conditions[].name`
- Phase 1 exercises: start from `regressions[]` of target exercises (easier variants)
- Phase 2+: advance to standard exercise when pain gate met
- Prefer `evidenceGrade: 'A' | 'B'` exercises
- Use `cptCodeSuggestion` for billing

**How it reads jointDatabase.ts:**
- Read `normalROM[movement].min/max` for each affected joint → set ROM targets per phase
- Read `commonPathologies` matching `consensusReport.primaryDiagnosis.icd10` → validate exercise choices
- Read `cptCodes` for billing codes → merge with exercise CPT codes
- Read `redFlags` → append to `redLineConditions`

**Prompt input structure (serialised to JSON):**
```json
{
  "patientId": "...",
  "primaryDiagnosis": { "name": "...", "icd10": "...", "confidence": 0.8 },
  "differentialDiagnoses": [...],
  "affectedJoints": ["knee", "hip"],
  "currentFunctionLevel": "moderately_impaired",
  "psfsAverage": 5.5,
  "tugRiskCategory": "moderate",
  "painLevel": 6,
  "userProfile": {
    "fitnessLevel": "beginner",
    "primaryGoal": "rehabilitation",
    "equipment": ["yoga_mat", "resistance_bands"],
    "injuries": [...],
    "conditions": [...]
  },
  "availableExercises": [
    { "id": "glute_bridge", "displayName": "Glute Bridge", "evidenceGrade": "A", "cptCode": "97110", ... }
  ],
  "jointNormativeROM": { "knee": { "flexion": { "min": 135, "max": 160 } } },
  "treatmentPriorities": [...],
  "contraindications": [...],
  "outputSchema": { ... }
}
```

---

### 4.2 EarlyMobAgent

**Model:** `claude-sonnet-4-6`  
**Max tokens:** 1800  
**Philosophy:** Movement is medicine. Graded loading drives neuroplasticity. Fear-avoidance breaks the pain cycle.

**System prompt:**
```
You are an early mobilisation physiotherapy treatment planner. Your clinical philosophy:
1. Pain education: hurt does not equal harm — explain pain approach (Moseley GL. Man Ther. 2004)
2. Graded exposure: graduated return to feared/avoided movements (Vlaeyen JWS. Pain. 2000)
3. Neuroplasticity: 3–5 sessions/week at moderate load drives cortical reorganisation
4. Progressive overload: 5–15% load increase per session when pain <4/10 (Schoenfeld BJ. J Strength Cond Res. 2010)
5. Psychosocial: track pain catastrophising; high catastrophisers need slower progression
6. Pain gate: modify (not stop) when pain 4–6/10; pause only at >7/10
7. Early loading protects cartilage, tendons, bone (Khan KM. Br J Sports Med. 2009)
Output ONLY valid JSON matching the schema. No preamble.
```

**How it reads exerciseLibrary.ts:**
- Same equipment and contraindication filtering as ConservativeAgent
- Starts at standard exercise level (not regressions), unless severity is high
- May include `progressions[]` from week 2 onwards if pain gate allows
- Accepts Grade C evidence exercises if clinical rationale is strong
- Targets `jointActions[]` matching affected joint movements

**How it reads jointDatabase.ts:**
- Same ROM target extraction
- Reads `commonPathologies[].commonPresentations` → aligns exercises to functional deficits
- Reads `specialTests` for post-treatment reassessment recommendations

---

### 4.3 TreatmentArbiterAgent

**Model:** `claude-opus-4-7`  
**Max tokens:** 600  
**Purpose:** Brief, targeted arbitration — not a full assessment red-team. Compare two plans across 6 axes. Decision in <600 tokens.

**System prompt:**
```
You are a clinical arbitrator comparing two physiotherapy treatment plans.
Evaluate on 6 axes — score each plan 0–10:
1. Safety: avoids contraindicated exercises, respects tissue healing
2. Evidence grade: proportion of Grade A/B exercises
3. Patient fit: matches fitness level, equipment, goal, and injury severity
4. Progression logic: clear, measurable phase gates
5. Completeness: all phases specified, CPT/ICD-10 codes included
6. Risk of harm: probability of re-injury or setback

If conservative wins: output winner="conservative".
If early_mob wins: output winner="early_mob".  
If scores are within 5% on composite: build hybrid — take Phase 1–2 from higher-safety plan,
Phase 3+ from higher-mobility plan.
Output ONLY valid JSON. No preamble.
```

**Arbitration input:**
- Full JSON of both `TreatmentPlan` objects
- `userProfile.injuries[].severity` (1–5 scale — drives safety weighting)
- `consensusReport.primaryDiagnosis.confidence`
- `urgencyLevel` from referral

**Cost note:** ~300–400 output tokens per arbitration. Estimated $0.005–0.008 per assessment. Acceptable at current volume.

---

### 4.4 ProgressionAgent

**Model:** `claude-haiku-4-5-20251001`  
**Max tokens:** 500  
**Trigger:** Runs after every 4th session (weekly if 4 sessions/week, every 2 weeks if 2 sessions/week).  
**Purpose:** Lightweight weekly adjustment — no full re-assessment.

**Linear regression logic (pure TypeScript, no LLM):**

```typescript
function computeProgressScore(sessions: SessionSummary[]): {
  slope: number;
  trend: 'improving' | 'plateaued' | 'declining';
  score: number;
} {
  const n = sessions.length;
  if (n < 2) return { slope: 0, trend: 'plateaued', score: 50 };

  const xs = sessions.map((_, i) => i);
  const ys = sessions.map(s => s.avg_score);
  const xBar = (n - 1) / 2;
  const yBar = ys.reduce((a, b) => a + b, 0) / n;
  const ssXY = xs.reduce((acc, x, i) => acc + (x - xBar) * ((ys[i] ?? yBar) - yBar), 0);
  const ssXX = xs.reduce((acc, x) => acc + (x - xBar) ** 2, 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;

  // score = mean score normalised to 0–100
  const score = Math.round(Math.max(0, Math.min(100, yBar)));
  const trend = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'plateaued';
  return { slope: Math.round(slope * 100) / 100, trend, score };
}
```

**Haiku prompt input (compact JSON):**
```json
{
  "currentWeek": 4,
  "currentPhase": 2,
  "progressScore": 72,
  "formSlope": 1.3,
  "trend": "improving",
  "avgPain": 3.2,
  "psfsChange": +1.8,
  "phaseProgressionTrigger": "Pain <3/10 for 3 consecutive sessions AND PSFS ≥6/10",
  "phaseRegressionTrigger": "Pain >6/10 for 2 sessions OR new neurological symptoms",
  "outputSchema": { ... }
}
```

**Decision rules (computed pre-LLM; Haiku confirms and adds clinical rationale):**

| Condition | Action |
|---|---|
| slope > 1.0 AND avg pain < 3 | `advance` |
| slope 0 to 1.0 AND avg pain 3–5 | `hold` |
| slope < 0 AND avg pain < 3 | `modify` (adjust exercises, not phase) |
| slope < 0 AND avg pain > 5 | `regress` |
| avg pain > 7 for 2+ sessions | `regress` (immediate, no LLM needed) |

---

### 4.5 PrescriptionAgent

**Model:** `claude-haiku-4-5-20251001`  
**Max tokens:** 800  
**Purpose:** Structured formatting. Takes the arbiter's winning plan and outputs FHIR R4 CarePlan + week-by-week schedule + patient instructions.

**FHIR CarePlan construction (deterministic, no LLM):**

```typescript
function buildCarePlan(
  plan: FinalTreatmentPlan,
  patientId: string,
  assessmentId: string,
): Record<string, unknown> {
  return {
    resourceType: 'CarePlan',
    id:           assessmentId,
    status:       'active',
    intent:       'plan',
    subject:      { reference: `Patient/${patientId}` },
    period: {
      start: new Date().toISOString().split('T')[0],
      end:   addWeeks(new Date(), plan.totalDurationWeeks).toISOString().split('T')[0],
    },
    activity: plan.weeklySchedule.flatMap(week =>
      week.exercises.map(ex => ({
        detail: {
          kind:            'ServiceRequest',
          code:            {
            coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: ex.cptCodeSuggestion ?? '97110' }],
            text:   ex.name,
          },
          status:          'not-started',
          description:     ex.rationale,
          scheduledTiming: {
            repeat: { frequency: ex.frequencyPerWeek, period: 1, periodUnit: 'wk' },
          },
        },
      }))
    ),
    note: [{ text: plan.clinicianNotes }],
  };
}
```

**CPT code mapping logic:**
- `97110` — Therapeutic Exercise (strength, ROM)
- `97112` — Neuromuscular Re-education (balance, coordination)
- `97116` — Gait Training
- `97530` — Therapeutic Activities (functional tasks)
- `97150` — Therapeutic Procedure, Group (if group session)
- Source: CMS CPT Reference, mapped from `exerciseLibrary.cptCodeSuggestion` per exercise

**Haiku prompt:** Generates `patientInstructions` (plain English, 3–5 sentences) and `clinicianNotes` (SOAP-aligned). Week-by-week schedule constructed deterministically from phase data.

---

## 5. TreatmentOrchestrator

```typescript
// packages/agents/assessment/src/treatment/TreatmentOrchestrator.ts

export async function runTreatmentPlanningSwarm(
  input: PlanningInput,
): Promise<FinalTreatmentPlan> {

  // Phase 1: Both planning agents run in parallel
  const [conservative, earlyMob] = await Promise.all([
    new ConservativeAgent().run(input),
    new EarlyMobAgent().run(input),
  ]);

  // Phase 2: Arbitration (brief Opus call)
  const arbiterInput: ArbiterInput = {
    patientId:    input.patientId,
    assessmentId: input.assessmentId,
    conservative,
    earlyMob,
    userProfile:  input.userProfile,
    urgencyLevel: input.consensusReport.referralUrgency ?? 'routine',
  };
  const verdict = await new TreatmentArbiterAgent().arbitrate(arbiterInput);

  // Phase 3: Prescription (Haiku, structured output)
  const prescriptionInput: PrescriptionInput = {
    patientId:       input.patientId,
    assessmentId:    input.assessmentId,
    winningPlan:     verdict.winner === 'early_mob' ? earlyMob : conservative,
    arbiterVerdict:  verdict,
    userProfile:     input.userProfile,
    consensusReport: input.consensusReport,
  };
  const finalPlan = await new PrescriptionAgent().run(prescriptionInput);

  return finalPlan;
}
```

**Timeout policy:**
| Agent | Timeout | Fallback |
|---|---|---|
| ConservativeAgent | 30s | Return minimal plan (3 exercises, 4-week duration) |
| EarlyMobAgent | 30s | Return minimal plan |
| TreatmentArbiterAgent | 20s | Default to ConservativeAgent output |
| PrescriptionAgent | 20s | Return plan without FHIR/CPT (skeleton) |

---

## 6. Exercise Library Integration Detail

### Filtering function (pure TypeScript, shared by both agents)

```typescript
import { EXERCISE_LIBRARY, ExerciseMeta } from '@physiocore/app/lib/exerciseLibrary';
// NOTE: exerciseLibrary.ts lives in packages/app — shared via path alias or extracted to packages/clinical

function filterExercisesForPatient(
  profile: UserProfile,
  injuries: string[],   // bodyPart names from active injuries
  conditions: string[], // condition names
  equipment: string[],  // from preferences.equipmentAvailable
): Array<{ id: string } & ExerciseMeta> {
  return Object.entries(EXERCISE_LIBRARY)
    .filter(([_id, meta]) => {
      // 1. Equipment check
      const needsEquipment = meta.primaryMuscles.length > 0;  // all exercises need something
      if (meta.category === 'gym') {
        const requiresDumbbells = ['shoulder_press','bent_over_row','deadlift','hip_thrust'].includes(_id);
        if (requiresDumbbells && !equipment.includes('dumbbells')) return false;
      }
      if ((meta.category === 'yoga' || meta.category === 'pilates') && !equipment.includes('yoga_mat')) return false;

      // 2. Contraindication check — exclude if exercise contraindication overlaps injury/condition
      const contraindStr = meta.contraindications.join(' ').toLowerCase();
      for (const injury of injuries) {
        if (contraindStr.includes(injury.toLowerCase())) return false;
      }
      for (const cond of conditions) {
        if (contraindStr.includes(cond.toLowerCase())) return false;
      }

      return true;
    })
    .map(([id, meta]) => ({ id, ...meta }));
}
```

### Move exerciseLibrary to a shared package (migration note)

Currently at `packages/app/src/lib/exerciseLibrary.ts` — accessible only from the app. For Phase 3, extract to `packages/clinical/src/exerciseLibrary.ts` so agents can import it without circular dependency. This is a one-file move.

---

## 7. Joint Database Integration Detail

```typescript
import { jointDatabase } from '@physiocore/clinical';
// Already used by SpecialTestsAgent — same import path

// Extract affected joints from consensusReport
function getAffectedJoints(
  report: ClinicalAssessmentReport,
): string[] {
  const joints: Set<string> = new Set();
  const icd10 = report.primaryDiagnosis?.icd10 ?? '';

  // Map ICD-10 prefix to joint key
  const icd10ToJoint: Record<string, string> = {
    'M75': 'shoulder',  // shoulder disorders
    'M23': 'knee',      // internal derangement of knee
    'M54.5': 'lumbar',  // low back pain
    'M54.2': 'cervical',
    'M77': 'elbow',     // epicondylitis
    'M25.5': 'hip',     // hip pain
    'M25.57': 'ankle',
    'M53.3': 'si',      // sacroiliac
  };

  for (const [prefix, joint] of Object.entries(icd10ToJoint)) {
    if (icd10.startsWith(prefix)) joints.add(joint);
  }

  // Also extract from ROM report significant deficits
  return Array.from(joints);
}
```

---

## 8. Evidence Base (for agent prompts)

### Conservative approach citations
- Dye SF. The pathophysiology of patellofemoral pain. *Clin Orthop Relat Res.* 2005;(436):100-110. — 10% load rule
- Järvinen TAH et al. Muscle injuries: biology and treatment. *Am J Sports Med.* 2005;33(5):745-764. — tissue healing phases
- van den Berg F. *Angewandte Physiologie.* Thieme, 2016. — loading progression

### Early mobilisation citations  
- Vlaeyen JWS, Linton SJ. Fear-avoidance and its consequences in chronic musculoskeletal pain. *Pain.* 2000;85(3):317-332.
- Moseley GL. A pain neuromatrix approach to patients with chronic pain. *Man Ther.* 2003;8(3):130-140.
- Khan KM, Scott A. Mechanotherapy: how physical therapists can use mechanobiology. *Br J Sports Med.* 2009;43(4):247-251.
- Schoenfeld BJ. The mechanisms of muscle hypertrophy. *J Strength Cond Res.* 2010;24(10):2857-2872.

### Progression citations
- Blanpied PR et al. Clinical practice guidelines for knee pain. *J Orthop Sports Phys Ther.* 2017;47(6):A1-A53.
- Stratford PW et al. Assessing disability and change on individual patients. *Physiother Can.* 1995;47:258-263. — PSFS MCID for progression gate

---

## 9. Open Questions

1. **exerciseLibrary location** — Extract to `packages/clinical/src/exerciseLibrary.ts` before Phase 3 build, or use a path alias? Recommendation: extract to clinical package.

2. **ProgressionAgent trigger** — After every 4 sessions OR weekly calendar? Recommend: session-count trigger (more reliable; patients don't attend on fixed schedule).

3. **Hybrid plan construction** — When arbiter returns `winner='hybrid'`, which agent produces the final phase objects? Recommendation: ConservativeAgent phases 1–2, EarlyMobAgent phases 3+. PrescriptionAgent stitches them.

4. **Clinician approval gate** — Like ConsensusAgent, PrescriptionAgent output should require clinician "Reviewed and confirmed" click before patient can view. Wire into existing `/assessment` page review flow.

5. **Patient-visible plan** — Prescription should produce a separate `patientView` stripped of clinical jargon and diagnosis uncertainty. Add `patientPlan: PatientFacingPlan` to `FinalTreatmentPlan`.

---

## 10. Cost Estimate

| Phase | Model | Avg tokens | Per assessment |
|---|---|---|---|
| ConservativeAgent | Sonnet 4.6 | ~1200 in / 800 out | ~$0.012 |
| EarlyMobAgent | Sonnet 4.6 | ~1200 in / 800 out | ~$0.012 |
| TreatmentArbiterAgent | Opus 4.7 | ~800 in / 400 out | ~$0.020 |
| PrescriptionAgent | Haiku 4.5 | ~600 in / 500 out | ~$0.001 |
| **Total per assessment** | | | **~$0.045** |
| ProgressionAgent (weekly) | Haiku 4.5 | ~300 in / 300 out | ~$0.0003 |

Full 8-week programme: ~$0.045 (plan) + 8 × $0.0003 (weekly progression) ≈ **$0.047 per patient**.

---

## 11. Implementation Sequence

1. Move `exerciseLibrary.ts` → `packages/clinical/src/`
2. Add Phase 3 types to `findings.ts`
3. Build `ConservativeAgent.ts`
4. Build `EarlyMobAgent.ts`
5. Build `TreatmentArbiterAgent.ts`
6. Build `ProgressionAgent.ts` (pure TypeScript regression first, Haiku wraps it)
7. Build `PrescriptionAgent.ts`
8. Build `TreatmentOrchestrator.ts`
9. Wire into `/assessment` page post-ConsensusAgent
10. Run `npx tsc --noEmit` across all packages

**Prerequisite:** Assessment UI page (`/assessment`) must be complete and wired to `AssessmentOrchestrator` before Phase 3 treatment planning UI can be added.
