# PhysioCore AI — Autonomous Agent Architecture

**Version:** 1.0  
**Date:** 16 May 2026  
**Status:** Design complete — pending implementation  
**Regulatory:** SaMD Class II — all autonomous clinical outputs require audit trail + clinician override pathway  
**References:** VISION.md, PHASE3_TREATMENT_PLANNING.md, PHASE4_VOICE_AGENT.md

---

## 1. System Overview

PhysioCore AI operates autonomously **between clinician appointments** through five layered agent loops. No human intervention required for routine monitoring, progression, and guidance. Clinicians are alerted only for anomalies and referral flags.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHYSIOCORE AI AUTONOMOUS SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   REAL-TIME LAYER (client-side, no LLM)                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Session.tsx                                                         │   │
│   │  MediaPipe 30fps ──► Session Coach Agent ──► Cartesia TTS            │   │
│   │  (pure algorithmic: angle, rep count, hold, view mode)              │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│            │ session_end event                                               │
│            ▼                                                                 │
│   EVENT-DRIVEN LAYER (Vercel serverless, milliseconds)                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Post-Session Intelligence Agent (Haiku)                             │   │
│   │  → AI feedback  → progression score  → clinician flag check         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│            │ writes to Supabase                                              │
│            ▼                                                                 │
│   SCHEDULED LAYER (Vercel Cron, daily/weekly/monthly)                        │
│   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│   │  Daily Monitor       │  │  Weekly Progression  │  │  Monthly Assess  │  │
│   │  Agent (Haiku)       │  │  Agent (Haiku)        │  │  Agent (Sonnet)  │  │
│   │  08:00 SGT daily     │  │  09:00 SGT Monday     │  │  Enrolment date  │  │
│   └──────────┬───────────┘  └──────────┬────────────┘  └────────┬─────────┘  │
│              │                         │                         │            │
│              └─────────────┬───────────┘─────────────────────────┘            │
│                            ▼                                                 │
│   NOTIFICATION LAYER                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Resend (email) ·  WhatsApp Business API (Twilio) · Supabase audit  │   │
│   │  Patient notifications       Clinician alerts (anomalies only)      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   CLINICAL MEASUREMENT FUSION LAYER                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  MediaPipe (browser, 30fps) ──► real-time feedback                   │   │
│   │  Meta Sapiens (server, on-capture) ──► override clinical measures   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Autonomous Loop 1 — Daily Monitoring Agent

### Schedule
```
Vercel Cron: "0 0 * * *"   (midnight UTC = 08:00 SGT)
Function:    api/agents/daily-monitor.ts
```

### Input — per patient, single Supabase query batch
```typescript
interface DailyMonitorInput {
  patientId:        string;
  orgId:            string | null;
  clinicianId:      string | null;
  last7Days: {
    sessions:       SessionSummary[];       // physiocore_sessions last 7 days
    prescribedCount: number;                // from treatment_plans.sessionFrequency
    painScores:     number[];               // outcomes.nprs_post last 7 days
    formScores:     number[];               // sessions.avg_score last 7 days
  };
  twoWeekPlateau:   boolean;                // form slope < 0.2 for 14 days
  profileName:      string;
}
```

### Decision Tree
```
adherence = sessions.length / prescribedCount

adherence < 0.5 (missed 2+ of 4 sessions)
  → ACTION: send WhatsApp + email reminder to patient
  → LOG: monitor_events table, type='missed_sessions'

painScores trend UP by ≥2 over 3 days
  → ACTION: alert clinician (NOT patient) via email
  → LOG: monitor_events table, type='pain_worsening', flagged=true
  → NO autonomous message to patient

formScores trend UP by ≥5% vs previous 7 days
  → ACTION: congratulations email + push notification to patient
  → LOG: monitor_events table, type='form_improving'

twoWeekPlateau === true
  → ACTION: email patient suggesting program review
  → LOG: monitor_events table, type='plateau_detected'
  → OPTIONAL: trigger ProgressionAgent on next Weekly run
```

### Model
**Claude Haiku 4.5** — generates personalised message text only. Decision logic is pure TypeScript pre-LLM.

```typescript
// Haiku prompt (compact, ~300 tokens in / ~200 out)
const systemPrompt = `
You are PhysioCore AI writing a brief, warm clinical message to a patient.
Write in second person. Max 3 sentences. Evidence-based encouragement only.
No diagnosis. No clinical advice beyond the programme. PDPA compliant.
`;
const userPrompt = `
Patient: ${name}. Status: ${status}. Context: ${contextSummary}.
Write a ${messageType} message. Output raw text only — no JSON wrapper.
`;
```

### Notifications
| Channel | Use | Provider |
|---|---|---|
| Email | All notifications | Resend (`noreply@doctoronclick.io`) |
| WhatsApp | Missed session reminders | Twilio WhatsApp Business API |
| In-app push | Form improvement | Supabase Realtime → browser |

### Cost per run
- 1 Haiku call × ~500 tokens = **$0.0001 per patient**
- 30 patients × 30 days = **$0.09/month total**

---

## 3. Autonomous Loop 2 — Weekly Progression Agent

### Schedule
```
Vercel Cron: "0 1 * * 1"   (01:00 UTC Monday = 09:00 SGT Monday)
Function:    api/agents/weekly-progression.ts
```

### Input
```typescript
interface WeeklyProgressionInput {
  patientId:       string;
  currentPlan:     FinalTreatmentPlan;      // from treatment_plans table
  currentWeek:     number;
  recentSessions:  SessionSummary[];        // last 4 sessions
  recentPainScores: number[];               // from outcomes table
  recentPSFS?:     number[];
}
```

### Execution Flow
```
1. Read treatment_plans WHERE patient_id AND status='active'
2. Compute ProgressScore via linear regression (PHASE3 §4.4 algorithm)
3. Apply decision rules (pure TS, no LLM):
   slope > 1.0 AND pain < 3  → advance phase
   slope 0–1.0 AND pain 3–5  → hold
   slope < 0 AND pain < 3    → modify exercises
   slope < 0 AND pain > 5    → regress
4. Call Haiku to generate:
   a. Updated exercise prescription for the new week
   b. Patient-facing week summary (plain English)
   c. Clinician note (SOAP-aligned, if flags present)
5. Write to treatment_plans: current_phase, current_week, exercises_this_week
6. Email patient their week plan (Resend branded template)
7. If flags present: email clinician summary
```

### Model
**Claude Haiku 4.5** — generates new prescription text and week plan. ProgressionAgent logic (linear regression, decision rules) runs without LLM.

### Email Template — Patient Week Plan
```html
Subject: "Your Week {N} programme is ready — PhysioCore AI"
Content:
  - Week number + phase name
  - Sessions this week (count + duration)
  - Exercise list with sets/reps
  - Key focus for the week (from Haiku)
  - Pain gate reminder
  - "Message your clinician" CTA
```

### Supabase Write
```sql
UPDATE treatment_plans SET
  current_week     = $1,
  current_phase    = $2,
  progression_action = $3,       -- 'advance'|'hold'|'regress'|'modify'
  exercises_this_week = $4,      -- jsonb
  week_generated_at = now(),
  flags_for_clinician = $5       -- text[]
WHERE patient_id = $6 AND status = 'active';
```

### Cost per run
- Haiku × 1 call × ~800 tokens = **$0.0003 per patient per week**
- 30 patients × 4 weeks = **$0.036/month total**

---

## 4. Autonomous Loop 3 — Session Coach Agent (Real-Time)

### Runs
Client-side, inside `Session.tsx`. **No LLM, no network call during session.** Pure algorithmic state machine.

### Architecture
```
MediaPipe 30fps
    │
    ▼
PoseContext (live state)
    │
    ├── angle outside targetRange ≥3 frames → FORM_CUE
    ├── repCount increments                  → REP_ANNOUNCE (every 5th)
    ├── holdState + holdSeconds > 2          → HOLD_ENCOURAGE
    ├── viewMode === 'lost' > 2s             → REPOSITION
    └── sessionActive → false               → SESSION_END
         │
         ▼
    CueQueue (deduplicated, min 3s between cues)
         │
         ▼
    Cartesia TTS (if voice mode ON) or SpeechSynthesis fallback
```

### CueQueue Rules
```typescript
interface CueQueueItem {
  type:      'form' | 'rep' | 'hold' | 'reposition' | 'safety';
  priority:  1 | 2 | 3;        // 1 = safety (interrupt), 2 = form, 3 = rep/hold
  text:      string;
  cooldownMs: number;           // min ms before same type can fire again
}

const CUE_COOLDOWNS = {
  form:       5000,   // 5s between form corrections
  rep:        0,      // immediate on every 5th rep
  hold:       8000,   // 8s between hold encouragements
  reposition: 3000,
  safety:     0,      // no cooldown — safety always fires
};
```

### Safety Stops
Triggered without LLM, immediately:
- Confidence < 0.3 for all landmarks × 5s → stop recording, speak "I can't see your full body"
- Pain report via voice ("stop", "hurt", "pain") → pause session, speak disclaimer
- Form score < 20 for 3 consecutive reps → slow down cue + offer regression

### Voice Routing
```
Cue text (from cue templates or Phase 4 voiceAgent.ts)
    │
    ├── [Voice Mode OFF] → window.speechSynthesis (SpeechSynthesisUtterance)
    └── [Voice Mode ON]  → Cartesia Sonic TTS (api/voice-session.ts)
```

### Cost
**$0.00** — no LLM calls during session. Cartesia cost only if voice mode on: **~$0.06/session** (see PHASE4_VOICE_AGENT.md §5).

---

## 5. Autonomous Loop 4 — Post-Session Intelligence Agent

### Trigger
Fires immediately after `session_end` event. Called from `Session.tsx` `stopSession()` via `api/post-session.ts`.

### Input
```typescript
interface PostSessionInput {
  sessionSummary:  SessionSummary;          // avg_score, rep_history, exerciseKey, duration
  userProfile:     UserProfile;             // injuries, conditions, goals
  recentHistory:   SessionSummary[];        // last 3 sessions for trend context
  currentPlan?:    FinalTreatmentPlan;      // if treatment plan active
}
```

### Execution Flow
```
1. Compute progression delta:
   formScoreDelta = thisSession.avg_score - avg(last3.avg_score)
   repCountDelta  = thisSession.totalReps - avg(last3.totalReps)

2. Flag check (pure TS, no LLM):
   formScoreDelta < -10     → flag.suddenFormDrop = true
   thisSession.avgPain > 6  → flag.painSpike = true
   sessionDuration < 40%    → flag.earlyStop = true

3. Call Haiku:
   - Generate AI feedback (injury-aware, XAI grade, already built in FeedbackAgent)
   - Generate "next session preview" (1 sentence)
   - If flags: generate clinician alert summary

4. Write to Supabase:
   - physiocore_sessions: ai_feedback, progression_score, flags (jsonb)
   - If flag.painSpike || flag.suddenFormDrop:
       agent_alerts: type, patient_id, org_id, clinician_id, summary, created_at

5. Return to client:
   { feedback, nextSessionPreview, flagged: boolean }
```

### Clinician Alert Email (Resend)
Fires only when `flagged === true`:
```
Subject: "[PhysioCore AI] Patient {name} — session flag: {flagType}"
To: clinician email (from profiles where role='clinician' AND org_id matches)
Content: patient name, session date, flag type, AI summary, link to /clinician
```

### Model
**Claude Haiku 4.5** — single call, ~600 tokens max (existing FeedbackAgent pattern).

### Cost per session
- 1 Haiku call × ~600 tokens = **$0.0003 per session**
- 12 sessions/month × 30 patients = **$0.108/month total**

---

## 6. Autonomous Loop 5 — Monthly Assessment Agent

### Schedule
```
Vercel Cron: "0 2 1 * *"   (02:00 UTC 1st of month = 10:00 SGT)
Function:    api/agents/monthly-assessment.ts
Logic: fires monthly; per-patient, checks if today is enrolment anniversary (±3 days)
```

### Input
```typescript
interface MonthlyAssessmentInput {
  patientId:       string;
  enrolmentDate:   string;
  baselineReport:  ClinicalAssessmentReport;   // first Phase 2 output
  allSessionsData: SessionSummary[];            // all sessions since last assessment
  allOutcomes:     OutcomesRecord[];            // PSFS/NPRS/GROC over period
  currentPlan:     FinalTreatmentPlan;
}
```

### Execution Flow
```
1. CHECK: is today within ±3 days of patient's monthly anniversary?
   No → skip (cron runs for all patients, only processes due ones)
   Yes → proceed

2. TRIGGER: Full Phase 2 Assessment Swarm
   Calls AssessmentOrchestrator.runFullAssessment() with:
   - Latest PostureAgent snapshot (if available from last ROM/posture session)
   - Latest ROMAgent output
   - Trend data from allSessionsData

3. COMPARE vs baseline:
   compareReports(baselineReport, newReport) → {
     romChanges:      { joint, movement, baseline, current, delta }[]
     formScoreChange: number        // delta from 3-month average
     psfsChange:      number        // PSFS average delta
     painChange:      number        // NPRS delta
     functionChange:  string        // 'improved' | 'stable' | 'declined'
   }

4. Call Sonnet: Generate comparison report
   - Clinical narrative comparing baseline vs current
   - Revised differential (if function changed)
   - Updated treatment recommendations
   - Progress towards PSFS/functional goals

5. Call Opus (if significant changes):
   AdversarialAgent reviews comparison report for:
   - Missed red flags in trend data
   - Overconfident conclusions
   - Safety concerns requiring urgent clinician review

6. Write to Supabase:
   - monthly_reports: patient_id, report, comparison, generated_at
   - treatment_plans: update if recommendations differ from current

7. Email patient: progress report (patient-facing language)
8. Email clinician: clinical comparison report + Opus flags (if any)
```

### Model Routing
| Task | Model | Justification |
|---|---|---|
| AssessmentOrchestrator agents | Sonnet 4 | Full clinical reasoning |
| Comparison narrative | Sonnet 4 | Longitudinal clinical analysis |
| Adversarial review | Opus 4.6 | Red-team, once/month only |

### Cost per patient per month
- Sonnet × ~4000 tokens = ~$0.16
- Opus × ~1500 tokens = ~$0.04 (if triggered)
- **Total: ~$0.20/patient/month**

---

## 7. Meta Sapiens Integration Layer

Meta Sapiens 2.0 provides 2D/3D human body parsing at clinical-grade accuracy. Run **server-side on-capture** to override MediaPipe clinical measurements.

### MediaPipe vs Sapiens Roles
```
┌────────────────────────────────────────────────────────────┐
│                    CAPTURE FLOW                            │
│                                                            │
│  BROWSER (always)                 SERVER (on-capture)      │
│  ┌─────────────────┐              ┌──────────────────┐     │
│  │ MediaPipe       │              │ Meta Sapiens     │     │
│  │ 30fps, real-time│              │ Single frame     │     │
│  │ 33 landmarks    │              │ 17 keypoints     │     │
│  │                 │              │ + depth map      │     │
│  │ Uses for:       │              │                  │     │
│  │ • Rep counting  │              │ Uses for:        │     │
│  │ • Form coaching │  hold event  │ • ROM measurement│     │
│  │ • Live overlays │──────────────►• Posture angles  │     │
│  │ • Safety stops  │              │ • Segment lengths│     │
│  │                 │◄─────────────│                  │     │
│  │ Clinical output │  landmarks   │ Overrides MP for │     │
│  │ uses Sapiens    │              │ clinical values  │     │
│  └─────────────────┘              └──────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### Trigger Conditions
Sapiens API call fires when:
- Posture assessment: user holds still for ≥2s (posture hold detected)
- ROM assessment: angle within 5° of target for ≥1.5s (hold threshold)
- Session end: final frame captured for session summary

### API Design
```typescript
// api/sapiens-analyse.ts  (Vercel serverless, POST)
interface SapiensRequest {
  imageDataUrl:  string;        // base64 PNG from canvas capture
  taskType:      'posture' | 'rom' | 'gait_frame';
  jointOfInterest?: string;     // e.g. 'right_knee' for ROM
}

interface SapiensResponse {
  landmarks:    SapiensLandmark[];    // 17 keypoints (COCO format)
  depthMap?:    number[][];           // optional — if depth model available
  segmentation: SegmentationMask;     // body part pixel masks
  confidence:   number;               // 0–1 per landmark
  inferenceMs:  number;
}
```

### Landmark Fusion
```typescript
function fuseLandmarks(
  mediapipe: NormalizedLandmarkList,
  sapiens:   SapiensLandmark[],
  threshold: number = 0.65,           // min sapiens confidence to override
): NormalizedLandmarkList {
  const fused = [...mediapipe];
  const SAPIENS_TO_MP = {
    0: 0,   // nose
    5: 11,  // left_shoulder
    6: 12,  // right_shoulder
    7: 13,  // left_elbow
    8: 14,  // right_elbow
    11: 23, // left_hip
    12: 24, // right_hip
    13: 25, // left_knee
    14: 26, // right_knee
    15: 27, // left_ankle
    16: 28, // right_ankle
  };
  for (const [sIdx, mpIdx] of Object.entries(SAPIENS_TO_MP)) {
    const sp = sapiens[Number(sIdx)];
    if (sp && sp.confidence >= threshold) {
      fused[Number(mpIdx)] = { x: sp.x, y: sp.y, z: sp.z ?? 0, visibility: sp.confidence };
    }
  }
  return fused;
}
```

### Hosting Options
| Option | Latency | Cost | Recommendation |
|---|---|---|---|
| Replicate API (`meta/sapiens`) | ~800ms | $0.0023/call | **MVP choice** |
| Modal.com GPU serverless | ~200ms | $0.0006/call | Scale choice |
| HuggingFace Inference Endpoints | ~1.5s | $0.0008/call | Fallback |
| Self-hosted (DigitalOcean GPU) | ~150ms | $0.50/hr fixed | >500 calls/day |

**MVP: Replicate.** Switch to Modal at >200 captures/day.

### Cost
- ~4 Sapiens calls/session (posture hold + 2-3 ROM holds + session end)
- 12 sessions/month × $0.0023 × 4 = **$0.11/patient/month**

---

## 8. Token Efficiency Architecture

### 3-Tier Model Router
```
Input task
    │
    ├── Tier 1: Agent Booster (WASM, <1ms, $0)
    │   Pure transforms: format conversion, schema validation,
    │   countdown updates, simple boolean checks
    │
    ├── Tier 2: Haiku (~500ms, ~$0.0002/call)
    │   Daily monitor messages, post-session feedback,
    │   weekly progression text, cue generation
    │
    └── Tier 3: Sonnet/Opus (2–5s, $0.003–0.020/call)
        Full assessment agents, monthly comparison,
        adversarial review, clinical reasoning
```

### Prompt Compression Rules
```typescript
// Applied to ALL agent prompts before sending
const compress = (prompt: string): string =>
  prompt
    .replace(/\s{2,}/g, ' ')            // collapse whitespace
    .replace(/\n{3,}/g, '\n\n')          // max 2 newlines
    .slice(0, MAX_CHARS[model]);          // hard truncation by tier

const MAX_CHARS = {
  haiku:  4000,    // ~1000 tokens input
  sonnet: 12000,   // ~3000 tokens input
  opus:   6000,    // ~1500 tokens input (adversarial — brief)
};
```

### Supabase Batch Pattern
All scheduled agents batch their patient reads into a single query:
```typescript
// One query fetches all data an agent needs — no N+1
const { data } = await db
  .from('physiocore_sessions')
  .select('id, avg_score, created_at, exercise_key, total_reps, ai_feedback')
  .eq('user_id', patientId)
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: false })
  .limit(20);
```

### Response Caching
Daily monitor insights cached for 22 hours in Supabase `agent_cache` table:
```sql
CREATE TABLE agent_cache (
  patient_id uuid,
  agent_type text,                  -- 'daily_monitor' | 'weekly_progression' | 'monthly'
  computed_at timestamptz,
  expires_at  timestamptz,
  payload     jsonb,
  PRIMARY KEY (patient_id, agent_type)
);
```
If cache hit and `expires_at > now()` → skip LLM call, return cached insight.

---

## 9. Vercel Cron Configuration

### vercel.json additions
```json
{
  "crons": [
    {
      "path": "/api/agents/daily-monitor",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/agents/weekly-progression",
      "schedule": "0 1 * * 1"
    },
    {
      "path": "/api/agents/monthly-assessment",
      "schedule": "0 2 1 * *"
    }
  ]
}
```

All crons run against all active patients in the organisation. Each function queries `profiles WHERE status='active' AND role='patient'` and fans out per patient (sequential, not parallel, to stay within Vercel function timeout).

### Function Timeout Allocation
| Function | Max Duration | Vercel Plan |
|---|---|---|
| `daily-monitor` | 60s (≤30 patients) | Pro |
| `weekly-progression` | 120s (≤30 patients) | Pro |
| `monthly-assessment` | 300s (1 patient/call) | Pro |

Monthly assessment fires per-patient (each patient gets their own cron invocation keyed by enrolment date) to avoid timeout.

---

## 10. Supabase Tables Required

```sql
-- Agent event audit trail
CREATE TABLE agent_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type   text NOT NULL,              -- 'daily_monitor'|'weekly_progression'|'post_session'|'monthly'
  patient_id   uuid REFERENCES auth.users(id),
  org_id       uuid,
  action_taken text,                       -- 'reminder_sent'|'clinician_alerted'|'plan_advanced'|etc
  payload      jsonb,                      -- full agent input/output snapshot
  cost_usd     numeric(8,6),              -- Anthropic cost for this call
  model_used   text,
  latency_ms   integer,
  created_at   timestamptz DEFAULT now()
);

-- Clinician alerts (separate from general events for UI surfacing)
CREATE TABLE agent_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid REFERENCES auth.users(id),
  org_id       uuid,
  clinician_id uuid REFERENCES auth.users(id),
  alert_type   text,                       -- 'pain_worsening'|'sudden_form_drop'|'red_flag'|'plateau'
  severity     text,                       -- 'info'|'warning'|'urgent'
  summary      text,
  acknowledged  boolean DEFAULT false,
  acknowledged_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- Monthly assessment reports
CREATE TABLE monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid REFERENCES auth.users(id),
  report_month    date,
  baseline_report jsonb,
  current_report  jsonb,
  comparison      jsonb,
  clinical_summary text,
  adversarial_flags text[],
  opus_reviewed   boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Agent computation cache
CREATE TABLE agent_cache (
  patient_id  uuid,
  agent_type  text,
  computed_at timestamptz,
  expires_at  timestamptz,
  payload     jsonb,
  PRIMARY KEY (patient_id, agent_type)
);

-- Enable RLS on all tables
ALTER TABLE agent_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cache      ENABLE ROW LEVEL SECURITY;
```

---

## 11. Cost Projection Per Patient Per Month

| Agent | Model | Calls/month | Cost/call | Monthly cost |
|---|---|---|---|---|
| Daily Monitor | Haiku | 30 | $0.0001 | $0.003 |
| Weekly Progression | Haiku | 4 | $0.0003 | $0.001 |
| Post-Session | Haiku | 12 | $0.0003 | $0.004 |
| Monthly Assessment | Sonnet + Opus | 1 | $0.200 | $0.200 |
| Sapiens fusion (4×/session × 12) | Replicate | 48 | $0.0023 | $0.110 |
| Voice TTS (Cartesia, 20 sessions) | Cartesia | 20 | $0.060 | $0.060 |
| Voice STT (Deepgram, 20 sessions) | Deepgram | 20 | $0.129 | est. $0.040 |
| **TOTAL** | | | | **~$0.42/patient/month** |

**Gross margin check:**
- Pro plan: $12/month
- AI cost: $0.42/month
- Infrastructure (Vercel Pro, Supabase, LiveKit): ~$0.30/month shared
- **AI gross margin: ~97%**
- B2B clinic ($99/month, 20 patients): $0.42 × 20 = $8.40 AI cost → **91% gross margin**

---

## 12. Notification Templates

### Missed Sessions — WhatsApp (Twilio)
```
PhysioCore AI: Hi {name} 👋

You haven't had a session this week. Your {exercise} programme is 
most effective with {prescribedPerWeek}× per week.

Even 10 minutes makes a difference. Tap to start: {deeplink}

Reply STOP to unsubscribe.
```

### Pain Worsening — Clinician Email (Resend)
```
Subject: [PhysioCore AI] Patient {name} — pain trend requires review

{name}'s pain scores have increased by {delta}/10 over the past 
{days} days. Autonomous monitoring detected this trend at {time} SGT.

Session data: {link_to_clinician_patient_detail}

This alert was generated by PhysioCore AI autonomous monitoring.
Clinical review required before next programme progression.

PhysioCore AI · PDPA Compliant · Singapore Region
```

### Week Plan — Patient Email (Resend)
```
Subject: Your Week {N} programme — PhysioCore AI

Hi {name},

Great work completing Week {N-1}! Here's your programme for this week.

{WEEK_SUMMARY_HTML}

Key focus: {haiku_generated_focus}

Remember your pain gate: stop or modify if pain exceeds 6/10 during exercise.

Start your session: {deeplink}
```

---

## 13. Implementation Sequence

| Priority | Component | File | Complexity | Status |
|---|---|---|---|---|
| 1 | Supabase migrations (4 tables) | `supabase/migrations/` | Low | Pending |
| 2 | Post-session API endpoint | `api/post-session.ts` | Medium | Pending |
| 3 | Daily Monitor agent | `api/agents/daily-monitor.ts` | Medium | Pending |
| 4 | Weekly Progression agent | `api/agents/weekly-progression.ts` | Medium | Pending |
| 5 | Cron config in vercel.json | `vercel.json` | Low | Pending |
| 6 | Resend email templates (3) | `api/_lib/email-templates.ts` | Low | Pending |
| 7 | Twilio WhatsApp integration | `api/_lib/whatsapp.ts` | Medium | Pending |
| 8 | Clinician alert UI | `packages/app/src/pages/Clinician.tsx` | Low | Pending |
| 9 | Sapiens API wrapper | `api/sapiens-analyse.ts` | High | Pending |
| 10 | Landmark fusion | `packages/app/src/lib/sapiensFusion.ts` | High | Pending |
| 11 | Monthly Assessment agent | `api/agents/monthly-assessment.ts` | High | Pending |
| 12 | agent_cache implementation | `api/_lib/agentCache.ts` | Low | Pending |

**MVP delivery order:** Steps 1–6 deliver the core autonomous monitoring loop with zero new external dependencies.  
**Step 7** (WhatsApp) requires Twilio account + WhatsApp Business verification (~5 days approval).  
**Steps 9–10** (Sapiens) require Replicate API key + new serverless function.  
**Step 11** (Monthly) requires Phase 2 AssessmentOrchestrator wired up first.

---

## 14. Regulatory Notes

- **Audit trail mandatory:** Every autonomous action writes to `agent_events`. No LLM output reaches patient/clinician without being logged.
- **Clinician override always available:** `/clinician` dashboard shows all agent alerts + allows one-click override of any automated progression.
- **Patient consent:** Autonomous monitoring consent collected at onboarding (step 3 of `/onboard`). Stored in `profiles.autonomous_monitoring_consent` (boolean + timestamp).
- **Pain worsening → human:** The system NEVER gives autonomous clinical advice when pain is worsening. It alerts the clinician and sends a neutral "check in with your physio" message to the patient.
- **SaMD Class II compliance:** All autonomous outputs (feedback, progression, recommendations) include evidence grade and citation per VISION.md safety rules. SafetyRuleEngine intercepts all outputs before delivery.

---

*Design by Dev Kapil / PhysioCore AI · Last updated 16 May 2026*  
*Implementation follow-up: run `npx @claude-flow/cli@latest memory store --key "autonomous-arch-v1" --namespace physiocore --value "designed 16 May 2026, 14 steps, MVP = steps 1-6"`*
