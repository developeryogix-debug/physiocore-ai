# PhysioCore AI — Session Context
Last updated: 15 May 2026 (post ROM assessment deploy)

This file is read at the start of every Claude Code session to restore full context.
Keep it updated after every significant change.

---

## Active Accounts

| Service | Account | Email |
|---|---|---|
| GitHub (active) | `developeryogix-debug` | developeryogix@gmail.com |
| GitHub (old, ignore) | `devkapil-tech` | — |
| GitHub (copy, ignore) | `kddocai` | — |
| Vercel | `developeryogix@gmail.com` | developeryogix@gmail.com |
| Supabase | project: qbrrugglfdwcapqrnahw | — |
| Anthropic | auto-reload $15, Tier 1 | developeryogix@gmail.com |

## Active Repos

| Repo | Status |
|---|---|
| `developeryogix-debug/physiocore-ai` | **ACTIVE** — push here |
| `devkapil-tech/physiocore-ai` | OLD — do not use |
| `kddocai/physiocore-ai` | COPY — do not use |

## Git Remote Config
```bash
# origin points to active repo with PAT embedded
git remote -v
# origin → https://ghp_...@github.com/developeryogix-debug/physiocore-ai.git
```

## Live URLs
- **Production app:** https://app-dteam1-mmcv.vercel.app
- **Supabase callback:** https://qbrrugglfdwcapqrnahw.supabase.co/auth/v1/callback
- **GitHub repo:** https://github.com/developeryogix-debug/physiocore-ai

---

## Project Stack

- React 18 + TypeScript + Vite (NOT Next.js — never add "use client")
- pnpm workspaces monorepo (9 packages)
- Supabase auth + Postgres (anon key in .env.local)
- Anthropic Claude API (VITE_ANTHROPIC_KEY in .env.local)
- MediaPipe Pose Landmarker (CDN, WASM)
- Vercel deployment (framework: null, custom outputDirectory)

## Package Structure
```
physiocore-ai/
├── api/                    Vercel serverless functions
│   ├── health-check.ts     daily health monitor (cron 0 0 * * *)
│   ├── weekly-report.ts    Monday email report
│   ├── ping.ts             test endpoint
│   ├── tsconfig.json       CommonJS/node for Vercel runtime
│   └── _lib/
│       ├── claude.ts       server-side Claude caller (process.env)
│       ├── db.ts           Supabase service-role client
│       └── email.ts        Resend email templates
├── packages/
│   ├── types/              @physiocore/types
│   ├── supabase/           @physiocore/supabase (client + schema)
│   ├── agents/
│   │   ├── pose/           @physiocore/pose-agent
│   │   ├── feedback/       @physiocore/feedback-agent (Haiku)
│   │   ├── nutrition/      @physiocore/nutrition-agent
│   │   ├── clinical/       @physiocore/clinical-agent
│   │   └── behavior/       @physiocore/behavior-agent
│   ├── orchestrator/       @physiocore/orchestrator
│   └── app/                React app (main)
│       └── src/
│           ├── pages/      Session.tsx, Login.tsx, Dashboard.tsx...
│           ├── hooks/      useAuth.tsx, useUserProfile.tsx
│           ├── components/ Navigation.tsx, ConsentScreen.tsx
│           └── lib/agents/ anthropicClient.ts, feedbackClient.ts...
```

---

## Environment Variables

### packages/app/.env.local (frontend)
```
VITE_ANTHROPIC_KEY=sk-ant-...
VITE_SUPABASE_URL=https://qbrrugglfdwcapqrnahw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
```

### Vercel Environment Variables (add if missing)
```
VITE_ANTHROPIC_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
RESEND_API_KEY          (from resend.com — free 3000 emails/month)
CRON_SECRET             (random string, used to auth cron requests)
SUPABASE_SERVICE_ROLE_KEY
```

---

## Routes Built

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ | Landing page, competitor comparison |
| `/login` | ✅ | Email/password, Google OAuth, magic link |
| `/onboard` | ✅ | 5-step wizard (needs dark theme restyle) |
| `/dashboard` | ✅ | Health dashboard |
| `/session` | ✅ | Live pose detection + rep counting |
| `/gym` | ✅ | Workout programs |
| `/nutrition` | ✅ | TDEE + supplements |
| `/assessment` | ✅ | Clinical assessment |
| `/clinician` | ✅ | SOAP notes, FHIR R4, churn risk |
| `/behavior` | ✅ | Retention engine |
| `/history` | ✅ | 52-week heatmap, trend chart, session timeline, personal bests |
| `/outcomes` | ✅ | PSFS, NPRS, GROC, PHQ-4 + SOS referral, CSV export |
| `/settings` | ✅ | Profile edit, biometrics tracker, notifications, PDPA data export/delete |
| `/trainer` | ✅ | Full streaming chat, sidebar sessions, voice in/out, PDF export |
| `/posture` | ✅ | 4-view capture, PDF export 7-page (patient + clinician), SOAP always rendered |
| `/rom-assessment` | ✅ | 8-test camera goniometry, voice-guided, PDF export |
| `/pain-map` | ✅ | Interactive body map, NPRS, quality/behaviour chips, Supabase sync |
| `/assessment` | ✅ | AssessmentOrchestrator — 8-agent swarm, consensus score, SOAP, treatment priorities |
| `/functional` | ✅ | PSFS + TUG + 30s Chair Stand, Haiku summary, age-adjusted norms, Supabase save |
| `/gait-assessment` | ✅ | Live MediaPipe gait analysis — cadence, symmetry, trunk sway, Trendelenburg |

---

## Auth Flow

```
App load → AuthProvider (useAuth) → UserProfileProvider (useUserProfile)
ProtectedRoute: isLoading → !user → /login
               !hasConsented → ConsentScreen
               !onboardingDone → /onboard
               → render page
```

- Supabase tables: `profiles`, `consents`, `user_profiles`, `outcomes`, `sessions`
- Google OAuth: Client ID in Supabase, callback = supabase.co/auth/v1/callback
- Supabase Site URL: http://localhost:5173 (local dev)
- Profile sync: Supabase always authoritative on login (useUserProfile.tsx init())

---

## AI Models

| Agent | Model | File | Tokens |
|---|---|---|---|
| Feedback | claude-haiku-4-5-20251001 | feedbackClient.ts | 900 |
| Nutrition | claude-sonnet-4-20250514 | nutritionClient.ts | 2048 |
| Clinical | claude-sonnet-4-20250514 | clinicalClient.ts | 2048 |
| Behavior | claude-sonnet-4-20250514 | behaviorClient.ts | 2048 |
| Chat | claude-sonnet-4-20250514 | AiChatPanel | streaming |
| Monitor/Diagnose | claude-haiku-4-5-20251001 | api/_lib/claude.ts | 300 |

---

## Session Features

- MediaPipe pose detection: front + side view, confidence threshold 0.55
- Rep counting: 6° hysteresis band (gym), 0.8s hold (pilates), 5s hold (yoga)
- Live HOLD state: teal glow card, "HOLDING" label, live seconds countdown
- Startup dead zone: 8 seconds, no false counts on session start
- Angle sanity filter: squat < 60° discarded as noise
- AI feedback: Haiku, 900 tokens, JSON fallback if parse fails
- Post-session: rep-by-rep table, next session prescription, PDF + FHIR R4 export

---

## Monitoring System

- `api/health-check.ts` v2 — 8 parallel check groups: Anthropic API, Supabase core, 8 tables, MediaPipe CDN, app homepage, 5 SPA routes, /assessment page, cost budget
- DiagnoseAgent: Claude Haiku on failure → root cause + severity + fix steps
- AlertAgent: Resend email to devkapilicloud@gmail.com, 4h global deduplication
- CostWatchAgent: estimates daily spend, alerts at $2.00 (warning) / $5.00 (critical) — raised for Opus AdversarialAgent
- Cron: `0 0 * * *` (daily 8am SGT)
- Test endpoint: https://app-dteam1-mmcv.vercel.app/api/ping
- Health check: https://app-dteam1-mmcv.vercel.app/api/health-check
  - Header required: `Authorization: Bearer {CRON_SECRET}`
  - CRON_SECRET: a3f9b2c1d4e5f6 (set in Vercel env vars)

---

## Supabase Tables

| Table | Purpose |
|---|---|
| `profiles` | user_id, role (patient/clinician/admin) |
| `consents` | signed consent records |
| `user_profiles` | full onboarding data |
| `sessions` | session history (synced from localStorage) |
| `outcomes` | PSFS/NPRS/GROC/PHQ-4 scores (type, score, metadata, recorded_at) |
| `biometrics` | HR, BP, glucose, HRV, sleep, weight readings |
| `trainer_sessions` | AI trainer conversation list |
| `trainer_messages` | messages per trainer session |
| `health_checks` | monitoring results |
| `alert_log` | sent email deduplication |
| `cost_log` | daily spend estimates |

Migration files:
- `packages/supabase/src/migration.sql` — auth tables
- `packages/supabase/src/monitor-migration.sql` — monitoring tables
- `packages/supabase/src/session-memory-migration.sql` — session_summaries + chat_messages
- `packages/supabase/src/pages-migration.sql` — biometrics + trainer_sessions + trainer_messages

---

## Design System — Clinical Noir

Dark luxury medical aesthetic. All CSS variables in `packages/app/src/index.css`.

Key tokens:
- `--bg-void: #050810` — page background
- `--bg-surface: #0D1420` — cards
- `--teal-500: #00D4AA` — primary accent
- `--blue-400: #4DB8FF` — secondary
- `--text-primary: #F0F4FF`
- `--text-secondary: #8892A4`

Typography: Syne (display) · Figtree (body) · Space Mono (data) · Noto Serif (yoga)

Navigation: floating pill, `position: fixed`, `top: 1.25rem`, `backdrop-blur(20px)`
All pages need `padding-top: 100px` to clear nav.

---

## Known Issues

### Fixed
- Duplicate fontSize TS1117 in Session.tsx
- Supabase new table types → `never[]` in tsc -b → removed Database generic, use `supabase as any`
- AI feedback JSON truncated → raised to 900 tokens + try/catch fallback
- Gym rep counter jitter → 6° hysteresis + live HOLD feedback
- Profile lost after sign-out → Supabase always authoritative on login
- Google OAuth redirect to wrong port → Supabase Site URL = localhost:5173
- Vercel deploy blocked (email mismatch) → migrated to developeryogix-debug account
- orgApi.ts mixed static/dynamic import warning → converted `useAuth.tsx` dynamic `import()` to static top-level import
- ClinicianPatientDetail SOAP note broken → fixed env var `VITE_ANTHROPIC_API_KEY` → `VITE_ANTHROPIC_KEY`
- Clinician page showing mock-only data → wired to real Supabase sessions via `getProfilesByUserIds` + `getSessionsBatchForPatients`

### Remaining
- Onboard page still uses old light theme (needs Clinical Noir redesign)
- Run pages-migration.sql in Supabase (biometrics, trainer_sessions, trainer_messages tables)
- Dashboard 8-panel upgrade

---

## Session — 14 May 2026

### Major Milestones
- **FIRST REAL PAYMENT**: $12/month Pro plan via Stripe
- **Phase 1 COMPLETE**: all 12 joints, 26 exercises, 12 red flags, posture capture
- PostureAgent AI analysis live with Claude Sonnet
- Bundle reduced: 2.1MB → 789KB initial load
- B2B pricing page: Clinic $99, Studio $49, Enterprise custom
- Equipment filtering: exercises match user's available equipment
- Phase 2 plan documented: `docs/PHASE2_ASSESSMENT_SWARM.md` (892 lines)
- **PainMapAgent ✅ BUILT** — two-stage: algorithmic red-flag detection + Claude Sonnet clinical analysis; ICD-10 mapping, neuropathic indicators, pain trend, `safeToExercise`
- **health-check v2 ✅ BUILT** — upgraded monitoring with CostWatchAgent, 4h dedup, Resend email alerts
- **PainMap.tsx ✅ BUILT** — interactive body map UI, NPRS input, quality/behaviour selectors, Supabase sync
- **Posture PDF export ✅ BUILT** — patient variant (grid images, score, recommendations) + clinician variant (measurements, deviation table, FHIR reference)
- **Phase 3 plan ✅ DOCUMENTED** — treatment planning swarm; see `docs/PHASE3_TREATMENT_SWARM.md`

### Phase 2 — ALL COMPLETE ✅

#### Agents
| Agent | Status | Notes |
|---|---|---|
| GaitAgent | ✅ BUILT | `src/gait/GaitAgent.ts` — step symmetry, cadence, trunk sway, arm swing, Trendelenburg; Evidence B, Krebs 1985 |
| ROMAgent | ✅ BUILT | `src/rom/ROMAgent.ts` — ExerciseQualityProxy: score-as-proxy model (joint ROM inferred from session form score, not direct goniometry) |
| PainMapAgent | ✅ BUILT | `src/pain/painMapAgent.ts` — red flag detection (Greenhalgh 2010), risk levels, ICD-10, Haiku differentials |
| FunctionalAgent | ✅ BUILT | `src/functional/FunctionalAgent.ts` — PSFS/TUG/30s Chair Stand; Stratford 1995, Podsiadlo 1991, Jones 1999 |
| SpecialTestsAgent | ✅ BUILT | `src/specialTests/SpecialTestsAgent.ts` — voice-guided; Phase A + Phase B; clinician mode only |
| AdversarialAgent | ✅ BUILT | `src/adversarial/AdversarialAgent.ts` — Claude Opus; `approvedForConsensus` gate |
| ConsensusAgent | ✅ BUILT | `src/consensus/ConsensusAgent.ts` — Sonnet 4.6; FHIR R4 CarePlan; SOAP note |
| AssessmentOrchestrator | ✅ BUILT | `src/orchestrator/AssessmentOrchestrator.ts` — 4-phase parallel; SafetyRuleEngine gate |

#### UI Pages
| Page | Route | Status |
|---|---|---|
| PostureAssessment | `/posture` | ✅ 4-view capture + PDF export (7 pages, patient + clinician) |
| GuidedROMAssessment | `/rom-assessment` | ✅ BUILT + DEPLOYED — 8-test camera goniometry, voice-guided, patient + clinician PDF export |
| GaitAssessment | `/gait-assessment` | ✅ |
| FunctionalAssessment | `/functional` | ✅ |
| PainMap | `/pain-map` | ✅ interactive body map, NPRS, Supabase sync |
| Assessment (full swarm) | `/assessment` | ✅ WIRED to AssessmentOrchestrator — 9-step swarm progress, data source grid, consensus score, risk level, SOAP note, treatment priorities |

#### Infrastructure
- `full_assessments` Supabase table ✅
- `rom_assessments` Supabase table ✅
- `posture_assessments` Supabase table ✅
- `health-check v2` ✅ — 8 parallel checks, CostWatchAgent, 4h dedup, Resend alerts
- Posture PDF 7-page export (patient + clinician variant) ✅

#### Phase 2 Design Decisions
| Question | Decision |
|---|---|
| SpecialTestsAgent input | Voice-guided (hands-free for clinician) |
| GaitAgent processing | Client-side MediaPipe (privacy-first, no upload) |
| FHIR storage | Supabase, export on demand |
| AdversarialAgent | Separate Claude Opus call |
| Assessment frequency | Monthly posture; each session ROM + pain |
| Special tests availability | Clinician mode only |

---

## Session — 15 May 2026 (continued)

### Completed
- PostureReportPDF SOAP page 7 now always renders (removed clinician-variant conditional)
- Posture prompt: hip/shoulder ≥3° → triggers Janda lateral chain analysis
- Nav audit: added /gait-assessment + /functional; assessment routes grouped in hover dropdown
- FunctionalAssessment page ✅ — PSFS + TUG + 30s Chair Stand, Haiku summary, Supabase save
- GaitAssessment page ✅ — full MediaPipe live gait analysis (hook-upgraded from stub)
- CONTEXT.md routes table updated

---

## Session — 15 May 2026

### Phase 3 — Treatment Planning Swarm ✅ COMPLETE (15 May 2026)

Spec: `docs/PHASE3_TREATMENT_PLANNING.md`  
Package: `packages/agents/assessment/src/treatment/`  
Types: `packages/agents/assessment/src/types/phase3.ts`

#### Agent Status
| Agent | Status | Model | File |
|---|---|---|---|
| ConservativeAgent | ✅ BUILT | claude-sonnet-4-6 | `treatment/ConservativeAgent.ts` |
| EarlyMobAgent | ✅ BUILT | claude-sonnet-4-6 | `treatment/EarlyMobAgent.ts` |
| TreatmentArbiterAgent | ✅ BUILT | claude-opus-4-7, 600 tokens | `treatment/TreatmentArbiterAgent.ts` |
| ProgressionAgent | ✅ BUILT | claude-haiku-4-5-20251001, 500 tokens | `treatment/ProgressionAgent.ts` |
| PrescriptionAgent | ✅ BUILT | claude-haiku-4-5-20251001, 800 tokens | `treatment/PrescriptionAgent.ts` |
| TreatmentOrchestrator | ⏳ NEXT | — | `treatment/TreatmentOrchestrator.ts` |

#### Architecture
```
ConsensusAgent report
    ├── ConservativeAgent (Sonnet) ──┐
    └── EarlyMobAgent (Sonnet) ──────┤
                                     ▼
                          TreatmentArbiterAgent (Opus, brief)
                                     ▼
                          PrescriptionAgent (Haiku) → FHIR R4 CarePlan
                                     │
                              (every 4 sessions)
                                     ▼
                          ProgressionAgent (Haiku) → advance/hold/regress/modify
```

#### Phase 3 Type Definitions
`PlanningInput`, `TreatmentPlan`, `TreatmentPhase`, `ArbiterInput`, `ArbiterVerdict`,
`ProgressionInput`, `ProgressionOutput`, `FinalTreatmentPlan`, `WeekByWeekSchedule`
— all in `src/types/phase3.ts`, exported from `src/index.ts`.

---

## Session — 13 May 2026

### Completed
- Multi-tenant organisation system live
- 4 organisations created: Doctor On Click (clinic), progressive (wellness_retreat), devyogastudio (yoga_studio), dpw (gym)
- Admin panel working at /admin
- User guide v1.1 PDF completed by Cowork
- react-pdf session export fixed
- SQL migrations all run
- RLS policies fixed (user_id vs id column)

### Org Structure
| Role | Identity |
|---|---|
| Super Admin | devkapiltech@gmail.com |
| Org: clinic | doctor-on-click |
| Org: wellness | phy-retreat |
| Org: yoga | devyoga-studio |
| Org: gym | city-gym |

---

## Session — 13–14 May 2026

### Completed
- `packages/clinical/` scaffolded and workspace conflict resolved
- `packages/agents/clinical/src/safetyRules.ts` — 12 APA red flags, hard-coded, zero-temperature (Phase 1c)
- `packages/clinical/src/joints/` — shoulder, knee, lumbar with real primary citations
- `packages/app/src/lib/exerciseLibrary.ts` — 26 exercises, Latin muscle names, ICD-10, CPT codes
- `packages/app/src/pages/PostureAssessment.tsx` — 4-view capture, countdown timer, audio beeps
- `packages/app/src/pages/Pricing.tsx` — 3 tiers (Free / Pro / Clinical), Stripe checkout stubs
- `VISION.md` and `POSTURE_SYSTEM.md` added to repo
- `CLAUDE.md` updated with global vision reference (read at session start)
- Navigation: Posture link added
- Admin panel: 5 organisations now live
- Design fixes: font floor 0.75rem, btn border-radius, font-weight ceiling 600

### In Progress
- **FunctionalAgent** — Phase 2 functional movement screen (squat, lunge, push, pull scoring)
- 9 remaining joints: elbow, wrist, hip, ankle, cervical, thoracic, SI, TMJ, foot

---

## Clinical Milestones

| Milestone | Status | Date |
|---|---|---|
| First Doctor On Click patient invited | ⏳ PENDING | — |
| First patient onboarded (posture + ROM + pain map) | ⏳ PENDING | — |
| Clinical validation: in progress | ⏳ PENDING | — |

### First Real Patient — Invite Flow (manual steps)
1. Go to https://app-dteam1-mmcv.vercel.app/clinician (role=clinician required)
2. Click **+ Invite Patient** → enter patient name + email
3. Patient receives branded Resend email → clicks link → onboards on phone
4. Patient completes: `/posture` → `/rom-assessment` → `/pain-map`
5. Data appears in `/clinician` patient list (real patients row above demo)
6. Update table above + commit: `"docs: first real patient milestone"`

---

## Next Build Priorities

1. **Voice physiotherapist** — Cartesia or ElevenLabs TTS; real-time coaching during sessions
2. **TreatmentOrchestrator** — wire all 5 Phase 3 agents into single orchestrator pipeline
3. **Stripe: statement descriptor → "PhysioCore AI"** — update in Stripe dashboard settings
4. **PWA improvements** — offline mode, install prompt, push notifications
5. **Imperial College IRB submission prep** — ethics application, consent forms, data management plan
