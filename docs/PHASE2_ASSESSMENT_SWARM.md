# Phase 2 — Assessment Agent Swarm Design
**Status:** Plan — awaiting review before implementation  
**Date:** 14 May 2026  
**Author:** Dev Kapil  
**References:** VISION.md §Phase 2, POSTURE_SYSTEM.md, packages/agents/clinical/

---

## 1. Overview

The Assessment Swarm is a MiroFish-pattern competitive debate system: 6 specialist agents gather findings in parallel, 1 adversarial agent challenges them, 1 consensus agent synthesises the final differential. The Safety Rules Engine (already built — `packages/agents/clinical/src/safetyRules.ts`) runs as a non-bypassable gate before any output reaches a clinician or patient.

```
┌──────────────────────────────────────────────────────────────┐
│                        PHASE 1 (Parallel)                    │
│  PostureAgent  GaitAgent  ROMAgent  PainMapAgent  Functional │
└────────────────────────────┬─────────────────────────────────┘
                             │ all complete
                             ▼
                 ┌───────────────────────┐
                 │  PHASE 2 (Interactive) │
                 │   SpecialTestsAgent   │
                 └───────────┬───────────┘
                             │ clinician completes tests
                             ▼
                 ┌───────────────────────┐
                 │  PHASE 3 (Sequential)  │
                 │   AdversarialAgent    │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │   PHASE 4 (Final)      │
                 │    ConsensusAgent     │
                 └───────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  SafetyRuleEngine (ALWAYS)   │  ← cannot be skipped
              └──────────────────────────────┘
```

---

## 2. Package Architecture

All 8 assessment agents live in one new package to keep assessment concerns co-located.

```
packages/agents/assessment/
├── package.json                        @physiocore/assessment-agent
├── tsconfig.json
└── src/
    ├── index.ts                        — re-exports all agents + orchestrator
    ├── orchestrator/
    │   └── AssessmentOrchestrator.ts  — phase sequencing, message bus, audit log
    ├── posture/
    │   └── PostureAgent.ts
    ├── gait/
    │   └── GaitAgent.ts
    ├── rom/
    │   └── ROMAgent.ts
    ├── special-tests/
    │   └── SpecialTestsAgent.ts
    ├── pain/
    │   └── PainAgent.ts
    ├── functional/
    │   └── FunctionalAgent.ts
    ├── adversarial/
    │   └── AdversarialAgent.ts
    ├── consensus/
    │   └── ConsensusAgent.ts
    └── types/
        └── findings.ts                — all output JSON schemas (TypeScript interfaces)
```

**Dependencies this package needs:**
- `@physiocore/types` — existing AgentContext, AgentResult, UserProfile
- `@physiocore/clinical` — jointDatabase (all 12 joints), SafetyRuleEngine
- `@anthropic-ai/sdk` — Anthropic client (matches pattern in ClinicalAgent.ts)
- Supabase client (from `@physiocore/supabase`)

---

## 3. Agent Specifications

### 3.1 PostureAgent

**Purpose:** Interpret the 4-view posture capture data into clinical findings with muscle imbalance patterns and referral flags.

**Model:** `claude-sonnet-4-6` — clinical interpretation of angular deviations requires structured reasoning.

**Input (reads from Supabase `posture_assessments` table):**
```typescript
interface PostureAgentInput {
  assessmentId: string;
  patientId: string;
  capturedAt: string;
  views: {
    anterior:     { angles: Record<string, number>; deviations: PosturalDeviation[] };
    rightLateral: { angles: Record<string, number>; deviations: PosturalDeviation[] };
    posterior:    { angles: Record<string, number>; deviations: PosturalDeviation[] };
    leftLateral:  { angles: Record<string, number>; deviations: PosturalDeviation[] };
  };
  // Pre-calculated by POSTURE_SYSTEM.md angle formulas
  headForwardPostureCm: number;
  thoracicKyphosisDeg: number;
  lumbarLordosisDeg: number;
  pelvicTiltDeg: number;
  shoulderHeightDiffCm: number;
  pelvisObliquityDeg: number;
  spinalDeviationDeg: number;  // Adam's test equivalent
  kneeValgusRightDeg: number;
  kneeValgusLeftDeg: number;
}
```

**Output JSON schema:**
```typescript
interface PostureFindings {
  agentId: 'posture-agent';
  version: string;
  processingMs: number;
  confidence: number;  // 0–1 — lower if landmark quality poor
  findings: Array<{
    region: string;         // e.g. 'cervical', 'thoracic'
    deviation: string;      // e.g. 'forward head posture'
    measured: number;
    normalRange: { min: number; max: number };
    severity: 'normal' | 'mild' | 'moderate' | 'severe';
    evidenceGrade: 'A' | 'B' | 'C' | 'D';
    citation: string;       // Kendall or POSTURE_SYSTEM.md source
  }>;
  muscleImbalancePatterns: Array<{
    clinicalName: string;   // e.g. 'Upper Crossed Syndrome (Janda)'
    shortenedMuscles: string[];
    lengthenedMuscles: string[];
    citation: string;
  }>;
  overallScore: number;       // 0–100 (POSTURE_SYSTEM.md scoring formula)
  sagittalScore: number;
  frontalScore: number;
  priorityCorrections: string[];  // top 3
  referralFlags: RedFlagAlert[];
}
```

**Calls other agents:** None. Consumed by AdversarialAgent and ConsensusAgent.

**Supabase reads:** `posture_assessments` (by assessmentId)  
**Supabase writes:** `agent_findings` (INSERT with agentId + output JSON)

---

### 3.2 GaitAgent

**Purpose:** Analyse the optional 30-second walking video clip to identify gait deviations, Trendelenburg sign, and antalgic patterns.

**Model:** `claude-sonnet-4-6` — video-extracted landmark sequences require temporal reasoning.

**Input:**
```typescript
interface GaitAgentInput {
  assessmentId: string;
  patientId: string;
  // Walking video processed by MediaPipe into per-frame landmarks
  frameLandmarks: Array<{
    frameIndex: number;
    timestampMs: number;
    landmarks: NormalizedLandmark[];  // 33 MediaPipe landmarks
  }>;
  videoFPS: number;
  walkingDistanceM: number;  // 5m
  cycleDurationMs: number;
}
```

**Output JSON schema:**
```typescript
interface GaitFindings {
  agentId: 'gait-agent';
  confidence: number;
  dataQuality: 'good' | 'acceptable' | 'poor';
  cadenceStepsPerMin: number;
  stepLengthSymmetryPercent: number;  // 100 = perfect symmetry
  trunkSway: 'normal' | 'mild' | 'moderate' | 'severe';
  armSwingSymmetry: 'symmetric' | 'reduced_left' | 'reduced_right' | 'absent';
  heelStrikePattern: 'normal' | 'flat_foot' | 'toe_strike' | 'antalgic';
  trendelenburgSign: 'absent' | 'positive_left' | 'positive_right';
  antalgicPattern: boolean;
  antalgicSide: 'left' | 'right' | null;
  gaitDeviations: Array<{
    name: string;
    phase: 'stance' | 'swing' | 'double_support';
    severity: 'mild' | 'moderate' | 'severe';
    likelyCause: string;
  }>;
  referralFlags: RedFlagAlert[];
}
```

**Prerequisite:** Walking video must have been captured in PostureAssessment walking module. If absent → GaitAgent returns `dataQuality: 'no_data'` and is excluded from ConsensusAgent weighting.

**Supabase reads:** `posture_assessments.walking_video_url` or `sessions` with walking mode  
**Supabase writes:** `agent_findings`

---

### 3.3 ROMAgent

**Purpose:** Compare session-measured joint angles against normalROM values from `@physiocore/clinical` jointDatabase; flag clinically significant deficits and bilateral asymmetries.

**Model:** `claude-sonnet-4-6` — pattern-matching deficits against clinical database requires reasoning over structured reference data.

**Input:**
```typescript
interface ROMAgentInput {
  patientId: string;
  sessionIds: string[];  // recent sessions to aggregate from
  // Aggregated angle data from physiocore_sessions
  measuredAngles: Array<{
    joint: string;        // must match jointDatabase key
    movement: string;     // must match normalROM key
    side: 'left' | 'right' | 'bilateral' | null;
    maxAngleDeg: number;
    measuredAt: string;
    sessionId: string;
    confidence: number;   // MediaPipe landmark confidence
  }>;
}
```

**Output JSON schema:**
```typescript
interface ROMFindings {
  agentId: 'rom-agent';
  confidence: number;
  jointMeasurements: Array<{
    joint: string;
    movement: string;
    measured: number;
    normalMin: number;
    normalMax: number;
    deficitPercent: number;     // (normalMax - measured) / normalMax × 100
    clinicallySignificant: boolean;  // >20% deficit
    citation: string;
  }>;
  asymmetries: Array<{
    joint: string;
    leftDeg: number;
    rightDeg: number;
    asymmetryPercent: number;
    clinicallySignificant: boolean;  // >15% side-to-side
  }>;
  functionalImpact: 'none' | 'mild' | 'moderate' | 'severe';
  referralFlags: RedFlagAlert[];
}
```

**Supabase reads:** `physiocore_sessions` (angles field), `profiles`  
**Supabase writes:** `agent_findings`

---

### 3.4 SpecialTestsAgent

**Purpose:** Using Phase 1 findings, recommend the highest-yield special tests for the suspected pathology. After the clinician performs and records results, interpret them with sensitivity/specificity-adjusted probability reasoning (Bayesian likelihood ratio).

**Model:** `claude-sonnet-4-6` — Bayesian probability reasoning + clinical test interpretation.

**Two-phase operation:**

**Phase A (Recommendation):** Runs immediately after Phase 1 agents complete.  
**Phase B (Interpretation):** Runs after clinician records test results in UI.

**Input Phase A:**
```typescript
interface SpecialTestsRecommendationInput {
  patientId: string;
  suspectedRegions: string[];    // from Phase 1 agent outputs
  suspectedPathologies: string[];
  phase1Summary: {
    postureFindings?: PostureFindings;
    romFindings?: ROMFindings;
    painFindings?: PainFindings;
    functionalFindings?: FunctionalFindings;
  };
}
```

**Input Phase B (after clinician performs tests):**
```typescript
interface SpecialTestsResultInput {
  completedTests: Array<{
    testName: string;
    joint: string;
    result: 'positive' | 'negative' | 'equivocal';
    painReproduced: boolean;
    notes?: string;
  }>;
}
```

**Output JSON schema:**
```typescript
interface SpecialTestFindings {
  agentId: 'special-tests-agent';
  phase: 'recommendation' | 'interpretation';
  confidence: number;
  recommendedTests: Array<{
    testName: string;
    joint: string;
    targetPathology: string;
    sensitivity: number;
    specificity: number;
    priority: 'high' | 'medium' | 'low';
    procedurePrompt: string;    // step-by-step for clinician UI
    citation: string;
  }>;
  completedTests: Array<{
    testName: string;
    result: 'positive' | 'negative' | 'equivocal';
    positiveLR: number;         // sensitivity / (1 - specificity)
    negativeLR: number;         // (1 - sensitivity) / specificity
    postTestProbability: number;
    pathologyImplication: string;
  }>;
  positiveTestsSummary: string[];
  impliedPathologies: Array<{
    name: string;
    icd10: string;
    probability: 'high' | 'moderate' | 'low';
    supportingTests: string[];
  }>;
  referralFlags: RedFlagAlert[];
}
```

**Supabase reads:** `profiles`, `physiocore_sessions`, `posture_assessments`  
**Supabase writes:** `agent_findings`, `assessment_sessions.special_tests_data`

---

### 3.5 PainAgent

**Purpose:** Classify pain mechanism and pattern from patient-reported VAS/NRS location, quality, and timing. Flag yellow flags (psychosocial risk factors for chronic pain).

**Model:** `claude-haiku-4-5-20251001` — classification task, not deep reasoning. Fast + cheap.

**Input:**
```typescript
interface PainAgentInput {
  patientId: string;
  currentPainScore: number;        // 0–10 NRS
  painLocations: Array<{
    bodyRegion: string;
    side: 'left' | 'right' | 'bilateral' | 'central';
    depth: 'superficial' | 'deep' | 'both';
  }>;
  painQuality: string[];           // e.g. ['burning', 'sharp', 'aching']
  painTiming: 'constant' | 'intermittent' | 'nocturnal' | 'activity-related';
  aggravatingFactors: string[];
  relievingFactors: string[];
  nightPain: boolean;
  previousHistory: boolean;
  // From physiocore_outcomes
  nprsHistory: Array<{ date: string; score: number }>;
  phq4Score: number;               // PHQ-4 from outcomes questionnaire
  psfsActivities: Array<{ activity: string; score: number }>;
}
```

**Output JSON schema:**
```typescript
interface PainFindings {
  agentId: 'pain-agent';
  confidence: number;
  painMechanism: 'nociceptive' | 'neuropathic' | 'nociplastic' | 'mixed';
  painPattern: 'local' | 'dermatomal' | 'referred_somatic' | 'visceral_referred';
  dermatomeMatch: string | null;   // e.g. 'L5', 'C6', null
  likelyStructure: string;         // e.g. 'L4-5 disc', 'SI joint'
  painTrend: 'improving' | 'stable' | 'worsening';
  nprsChangeLast4Weeks: number;
  yellowFlags: Array<{
    flag: string;
    description: string;
    interventionSuggested: string;
  }>;
  phq4Interpretation: 'normal' | 'mild' | 'moderate' | 'severe';
  referralFlags: RedFlagAlert[];
}
```

**Supabase reads:** `physiocore_outcomes` (NPRS, PHQ-4, PSFS), `physiocore_sessions`  
**Supabase writes:** `agent_findings`

---

### 3.6 FunctionalAgent

**Purpose:** Score validated outcome measures (PSFS, TUG, Berg Balance, 30s Chair Stand) and calculate functional impairment level and fall risk.

**Model:** `claude-haiku-4-5-20251001` — scoring and interpretation, not reasoning.

**Input:**
```typescript
interface FunctionalAgentInput {
  patientId: string;
  // From physiocore_outcomes
  psfsActivities: Array<{ activity: string; baseline: number; current: number }>;
  tugSeconds: number | null;         // null if not tested
  bergBalanceItems: number[] | null; // 14 items, 0–4 each; null if not tested
  thirtySecChairStandCount: number | null;
  grocScore: number | null;          // −7 to +7
  sessionCount: number;              // total sessions completed
  adherencePercent: number;          // from behavior agent data
}
```

**Output JSON schema:**
```typescript
interface FunctionalFindings {
  agentId: 'functional-agent';
  confidence: number;
  psfsAverage: number;               // 0–10
  psfsInterpretation: string;
  psfsChangeFromBaseline: number;
  mdcPsfs: number;                   // minimal detectable change = 2.0 (Stratford 1995)
  tugSeconds: number | null;
  tugRiskCategory: 'low' | 'moderate' | 'high' | 'not_tested';
  // TUG: <10s low risk, 10–20s moderate, >20s high fall risk (Podsiadlo & Richardson 1991)
  bergTotal: number | null;
  bergRiskCategory: 'low' | 'medium' | 'high' | 'not_tested';
  // Berg: >45 low risk, 36–45 medium, <36 high (Berg et al 1992)
  thirtySecChairStand: number | null;
  thirtySecNormative: string;         // age/sex normative reference
  overallFunctionLevel: 'normal' | 'mildly_impaired' | 'moderately_impaired' | 'severely_impaired';
  goalProgressPercent: number;
  grocInterpretation: string | null;
  referralFlags: RedFlagAlert[];
}
```

**Supabase reads:** `physiocore_outcomes`  
**Supabase writes:** `agent_findings`

---

### 3.7 AdversarialAgent

**Purpose:** Red-team all Phase 1+2 findings. Challenge low-confidence claims, identify missing data that could change diagnosis, propose alternative diagnoses, and escalate any safety concern that earlier agents may have underweighted.

**Model:** `claude-opus-4-7` — adversarial reasoning requires the highest capability model. This agent must be willing to contradict other agents.

**Critical design constraint:** This agent has NO access to call any other agent or modify their outputs. It only reads and critiques.

**Input (all Phase 1+2 findings):**
```typescript
interface AdversarialInput {
  patientId: string;
  assessmentId: string;
  postureFindings: PostureFindings | null;
  gaitFindings: GaitFindings | null;
  romFindings: ROMFindings | null;
  specialTestFindings: SpecialTestFindings | null;
  painFindings: PainFindings | null;
  functionalFindings: FunctionalFindings | null;
  patientProfile: UserProfile;
  redFlagsAlreadyRaised: RedFlagAlert[];
}
```

**Output JSON schema:**
```typescript
interface AdversarialReport {
  agentId: 'adversarial-agent';
  processingMs: number;
  overallConfidenceInPrimaryDiagnosis: number;  // 0–1 adversarial estimate
  challenges: Array<{
    targetAgent: string;
    targetFinding: string;
    challenge: string;
    alternativeExplanation: string;
    evidenceForChallenge: string;
    severity: 'minor' | 'moderate' | 'major';
  }>;
  missingData: Array<{
    dataType: string;
    reason: string;
    wouldChangeAssessment: boolean;
    recommendedAction: string;
  }>;
  alternativeDiagnoses: Array<{
    name: string;
    icd10: string;
    reasoning: string;
    requiredToExclude: string;  // what test/finding would exclude this
    dangerIfMissed: 'low' | 'moderate' | 'high' | 'critical';
  }>;
  safetyEscalations: Array<{
    concern: string;
    reasoning: string;
    immediateAction: string;
    targetRedFlagType: string;
  }>;
  // Confidence adjustments for ConsensusAgent weighting
  confidenceAdjustments: Array<{
    agentId: string;
    originalConfidence: number;
    adjustedConfidence: number;
    reason: string;
  }>;
  adversarialVerdict: 'accept' | 'accept_with_caveats' | 'significant_concerns' | 'reject';
}
```

**Supabase reads:** `agent_findings` (all Phase 1+2 outputs for this assessmentId)  
**Supabase writes:** `agent_findings`

---

### 3.8 ConsensusAgent

**Purpose:** Synthesise all 7 agent outputs (with adversarial adjustments) into a ranked differential diagnosis, evidence-graded treatment priorities, FHIR R4 Bundle, and CPT billing codes.

**Model:** `claude-sonnet-4-6` — synthesis and structured JSON output. Opus reserved for adversarial; consensus is a structured aggregation task.

**Must run AFTER:** AdversarialAgent completes.  
**Output is gated by:** `SafetyRuleEngine.checkForRedFlags()` — if any red flag fires, output is replaced with escalation protocol before reaching clinician/patient.

**Input:**
```typescript
interface ConsensusInput {
  assessmentId: string;
  patientId: string;
  patientProfile: UserProfile;
  allFindings: {
    posture:      PostureFindings | null;
    gait:         GaitFindings | null;
    rom:          ROMFindings | null;
    specialTests: SpecialTestFindings | null;
    pain:         PainFindings | null;
    functional:   FunctionalFindings | null;
  };
  adversarialReport: AdversarialReport;
  existingConditions: string[];
  currentMedications: string[];
}
```

**Output JSON schema:**
```typescript
interface AssessmentConsensus {
  agentId: 'consensus-agent';
  processingMs: number;
  assessmentId: string;
  generatedAt: string;  // ISO 8601

  primaryDiagnosis: {
    name: string;
    icd10: string;
    confidence: number;       // 0–1
    evidenceGrade: 'A' | 'B' | 'C' | 'D';
    supportingFindings: string[];
    adversarialChallenged: boolean;
  };

  differentialDiagnoses: Array<{
    name: string;
    icd10: string;
    probability: 'high' | 'moderate' | 'low';
    keyDistinguishingFeature: string;
    toExcludeWith: string;
  }>;

  treatmentPriorities: Array<{
    priority: number;          // 1 = highest
    intervention: string;
    rationale: string;
    evidenceGrade: 'A' | 'B' | 'C' | 'D';
    citation: string;
    cptCodes: string[];
    timeframeWeeks: number;
  }>;

  safetyFlags: RedFlagAlert[];  // from SafetyRuleEngine (added post-synthesis)
  referralRecommended: boolean;
  referralUrgency: 'routine' | 'urgent' | 'emergency' | null;
  referralReason: string | null;

  recommendedCPTCodes: string[];
  nextAssessmentDate: string;

  evidenceSummary: string;       // 3–5 sentence narrative for clinician
  patientSummary: string;        // 2–3 sentences for patient-facing report (plain English)

  fhirBundle: FHIRBundle;        // R4 Bundle: Patient + Observations + Conditions + CarePlan

  adversarialOverrideApplied: boolean;
  adversarialVerdict: string;
  dataCompleteness: number;      // 0–1 (proportion of agents that returned data)
}
```

**Supabase reads:** `agent_findings` (all agents for this assessmentId), `profiles`  
**Supabase writes:** `assessment_reports` (final output), `fhir_resources`

---

## 4. Orchestration Flow

### 4.1 Execution Phases

```typescript
// AssessmentOrchestrator sequence (pseudocode — plan only)

// PHASE 1: fire and forget in parallel
const [posture, rom, pain, functional] = await Promise.all([
  PostureAgent.run(postureInput),
  ROMAgent.run(romInput),
  PainAgent.run(painInput),
  FunctionalAgent.run(functionalInput),
]);

// GaitAgent: only if walking video exists
const gait = walkingVideoExists
  ? await GaitAgent.run(gaitInput)
  : null;

// PHASE 2: SpecialTestsAgent Phase A (recommendations based on Phase 1)
const testRecommendations = await SpecialTestsAgent.recommend({
  phase1Summary: { posture, rom, pain, functional, gait }
});
// → UI presents test list to clinician
// → clinician performs tests, records results
// → UI calls SpecialTestsAgent Phase B
const specialTests = await SpecialTestsAgent.interpret(testResults);

// PHASE 3: AdversarialAgent (all Phase 1+2 data)
const adversarial = await AdversarialAgent.run({
  postureFindings: posture,
  gaitFindings: gait,
  romFindings: rom,
  specialTestFindings: specialTests,
  painFindings: pain,
  functionalFindings: functional,
});

// PHASE 4: ConsensusAgent
const consensus = await ConsensusAgent.run({
  allFindings: { posture, gait, rom, specialTests, pain, functional },
  adversarialReport: adversarial,
});

// PHASE 5: Non-bypassable safety gate
const safetyResult = SafetyRuleEngine.checkForRedFlags(
  buildCurrentSymptoms(consensus, pain)
);

if (safetyResult.alerts.length > 0) {
  // Replace consensus output with escalation protocol
  return buildSafetyEscalation(safetyResult.alerts);
}

return consensus;
```

### 4.2 Timeout Policy

| Phase | Timeout | Fallback |
|---|---|---|
| Phase 1 (parallel) | 30s each | Agent excluded from ConsensusAgent with `dataQuality: 'timed_out'` |
| SpecialTestsAgent Phase A | 15s | Return empty test list; clinician proceeds without guidance |
| SpecialTestsAgent Phase B | 20s | Return raw test results without LR calculations |
| AdversarialAgent | 60s | ConsensusAgent proceeds without adversarial weighting |
| ConsensusAgent | 45s | Return partial findings with `dataCompleteness` flag |
| SafetyRuleEngine | Synchronous | Never timeout — hard-coded logic, no LLM call |

### 4.3 AdversarialAgent Integration Rules

- AdversarialAgent output `confidenceAdjustments[]` is applied multiplicatively to each agent's confidence before ConsensusAgent weighting.
- If `adversarialVerdict === 'reject'` → ConsensusAgent must mark primary diagnosis as `confidence < 0.5` regardless of other evidence.
- If `safetyEscalations[]` contains any item → these are passed directly to SafetyRuleEngine before ConsensusAgent even synthesises.
- AdversarialAgent findings are **always** included in the FHIR audit trail, even when overridden.

### 4.4 Weighting in ConsensusAgent Synthesis

ConsensusAgent should weight agent inputs by:

```
adjustedWeight = baseWeight × agentConfidence × adversarialConfidenceMultiplier
```

Suggested base weights (subject to clinical review):

| Agent | Base Weight | Rationale |
|---|---|---|
| SpecialTestsAgent | 0.30 | Objective tests with known LR |
| PostureAgent | 0.20 | Objective measurement |
| ROMAgent | 0.20 | Objective measurement |
| PainAgent | 0.15 | Subjective but clinically important |
| FunctionalAgent | 0.10 | Outcome measures, not diagnosis |
| GaitAgent | 0.05 (default) / 0.15 (if gait complaint) | Context-dependent |

---

## 5. Supabase Schema Additions

New tables required (migrations needed):

### `assessment_sessions`
```sql
CREATE TABLE assessment_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID REFERENCES profiles(id),
  org_id       UUID REFERENCES organisations(id),
  clinician_id UUID REFERENCES profiles(id) NULL,
  status       TEXT CHECK (status IN ('in_progress','awaiting_special_tests','complete','failed')),
  started_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  fhir_bundle  JSONB,  -- final FHIR R4 Bundle from ConsensusAgent
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### `agent_findings`
```sql
CREATE TABLE agent_findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID REFERENCES assessment_sessions(id),
  agent_id       TEXT NOT NULL,  -- 'posture-agent', 'rom-agent', etc.
  phase          INTEGER NOT NULL,  -- 1, 2, 3, or 4
  input_hash     TEXT,              -- SHA-256 of input for cache/replay
  output         JSONB NOT NULL,    -- full typed output object
  confidence     FLOAT,
  processing_ms  INTEGER,
  model_used     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
-- RLS: clinicians see findings for their org's patients only
```

### `assessment_reports`
```sql
CREATE TABLE assessment_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     UUID REFERENCES assessment_sessions(id),
  patient_id        UUID REFERENCES profiles(id),
  primary_diagnosis TEXT,
  primary_icd10     TEXT,
  confidence        FLOAT,
  evidence_grade    TEXT,
  differential      JSONB,
  treatment_plan    JSONB,
  safety_flags      JSONB,
  adversarial_overridden BOOLEAN DEFAULT false,
  data_completeness FLOAT,
  fhir_bundle       JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. API / Vercel Function Endpoints

New serverless functions needed in `api/`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/assessment/start` | POST | Initialise `assessment_sessions`, kick off Phase 1 agents |
| `/api/assessment/[id]/status` | GET | Poll assessment progress (phase, agent completion status) |
| `/api/assessment/[id]/special-tests` | GET | Retrieve SpecialTestsAgent recommendations |
| `/api/assessment/[id]/special-tests` | POST | Submit completed test results → Phase B interpretation |
| `/api/assessment/[id]/report` | GET | Fetch final `assessment_reports` row (after ConsensusAgent) |
| `/api/assessment/[id]/fhir` | GET | Return FHIR R4 Bundle for EHR export |

All endpoints: Supabase Auth JWT required. RLS enforces org-level data isolation.

---

## 7. Frontend Integration Points

### Session Page (existing `/session`)
- Add "Start Clinical Assessment" button after session completes
- Triggers `/api/assessment/start`

### Posture Assessment Page (existing `/posture`)
- On completion of 4-view capture → auto-triggers PostureAgent as part of assessment start
- Show loading state while Phase 1 agents run

### New Route: `/assessment/[id]`
- Stepper UI: Phase 1 (auto) → Phase 2 (SpecialTests, interactive) → Phase 3/4 (processing) → Report
- During Phase 2: show SpecialTestsAgent recommendations one at a time with procedure guide
- Clinician records each test result (positive/negative/equivocal)

### Clinician Page (existing `/clinician`)
- Assessment report rendered with tabs: Summary | Differential | Treatment | FHIR
- Adversarial challenges shown as collapsible "AI second opinion" section
- SOAP note pre-populated from ConsensusAgent output

---

## 8. Model Selection Rationale

| Agent | Model | Justification |
|---|---|---|
| PostureAgent | claude-sonnet-4-6 | Clinical interpretation of angular measurements against normative data. Needs structured JSON output. |
| GaitAgent | claude-sonnet-4-6 | Temporal pattern recognition from landmark sequences. Moderate complexity. |
| ROMAgent | claude-sonnet-4-6 | Reference lookup + clinical significance reasoning. Reads jointDatabase. |
| SpecialTestsAgent | claude-sonnet-4-6 | Bayesian LR reasoning + test selection from clinical database. |
| PainAgent | claude-haiku-4-5-20251001 | Classification only. Speed and cost matter (runs on every assessment). |
| FunctionalAgent | claude-haiku-4-5-20251001 | Score calculation and normative comparison. No complex reasoning. |
| AdversarialAgent | claude-opus-4-7 | Must challenge all other agents. Requires highest reasoning capability. Runs once per assessment. |
| ConsensusAgent | claude-sonnet-4-6 | Synthesis + FHIR generation. Structured output. Opus reserved for adversarial only. |

**Estimated cost per full assessment:**
- Phase 1 parallel (5 agents): ~$0.02 (4 Haiku + 1 Sonnet)
- Phase 2 (SpecialTests × 2): ~$0.006
- Phase 3 (Adversarial, Opus): ~$0.08–$0.15
- Phase 4 (Consensus, Sonnet): ~$0.02
- **Total per assessment: ~$0.13–$0.20**

---

## 9. Safety Architecture

### Non-bypassable Gate (existing SafetyRuleEngine)
- `SafetyRuleEngine.checkForRedFlags()` in `packages/agents/clinical/src/safetyRules.ts`
- Called synchronously after ConsensusAgent output
- Any `RedFlagAlert` with `emergencyLevel: 'call_999'` → output BLOCKED, emergency screen shown
- All red flag checks are hard-coded TypeScript — **no LLM call, no probability — deterministic**

### Audit Trail Requirements (regulatory — SaMD Class II)
Every agent run must log to `agent_findings`:
- Input hash (for reproducibility)
- Full output JSON
- Model used and version
- Processing time
- Confidence score
- Whether SafetyRuleEngine was triggered

### Human Clinician Override
- ConsensusAgent output is **a recommendation**, not a diagnosis
- UI must show: "This AI assessment requires clinician review before clinical action"
- Clinician must click "Reviewed and confirmed" before FHIR export or patient sharing
- Override action logged to `audit_log` table

---

## 10. Open Questions for Clinical Review

Before implementation begins, the following require review:

1. **SpecialTestsAgent interactivity model:** Should Phase A recommendations be voice-guided (voice physiotherapist) or text-only UI? Voice requires Cartesia/Deepgram integration not yet built.

2. **GaitAgent video processing:** MediaPipe runs in-browser. Processing 30-second video for per-frame landmarks client-side may cause performance issues on low-end mobile devices. Alternative: upload video to Supabase Storage → server-side MediaPipe job. Decision needed.

3. **AdversarialAgent verbosity:** Opus is expensive. Should we rate-limit adversarial challenges to max 3 per assessment, or run full adversarial on all findings? Recommend: full for clinical mode, limited for consumer mode.

4. **ConsensusAgent FHIR generation:** Current FHIR client (`fhirClient.ts`) points to `hapi.fhir.org/baseR4` (test server). Phase 2 production must point to Supabase-stored FHIR resources, not the external HAPI test server.

5. **Weighting calibration:** The ConsensusAgent base weights in §4.4 are initial proposals. These must be validated against clinical case studies before production. A/B test with physiotherapist review of AI consensus vs clinical gold standard.

6. **PHQ-4 escalation threshold:** PainAgent flags `phq4Score >6` as significant. Current VISION.md says "flag > 6". Confirm: does this trigger a mental health referral recommendation, or just a yellow flag note? PHQ-4 is a screen only, not a diagnostic tool.

---

## 11. Build Sequence (When Approved)

Recommended implementation order:

1. **types/findings.ts** — define all 8 output interfaces first; get TypeScript agreement
2. **AssessmentOrchestrator** — skeleton with phase sequencing and timeout logic
3. **PainAgent + FunctionalAgent** — Haiku models, simpler logic, build pattern
4. **ROMAgent** — reads existing jointDatabase; tests against known ROM data
5. **PostureAgent** — reads existing posture_assessments data
6. **SpecialTestsAgent Phase A** — recommendation only (no Phase B until tested)
7. **GaitAgent** — only if walking video infra decision resolved (Q2 above)
8. **SpecialTestsAgent Phase B** — interpretation + LR calculations
9. **AdversarialAgent** — build last (needs all others working to test against)
10. **ConsensusAgent** — integrate with existing FHIR client
11. **SafetyRuleEngine integration** — wire into ConsensusAgent output gate
12. **Supabase migrations** — 3 new tables
13. **API endpoints** — 6 new Vercel functions
14. **Frontend** — `/assessment/[id]` route + Session/Clinician page additions

---

*Review this document before proceeding to implementation.*  
*Approval required from: Dev Kapil*  
*Next action: Address the 6 open questions in §10, then proceed with build sequence §11.*
