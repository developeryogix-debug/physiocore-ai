# PhysioCore AI — Master Constitution
Last updated: 19 May 2026

> This document is the single source of truth for architecture decisions, build rules,
> phase status, and LLM council governance. Read before every session and before any
> major feature work. Do NOT override without council sign-off.

---

## Identity

- **App name:** PhysioCore AI
- **Current phase:** 6 — Compliance Automation Engine
- **Stack:** Vite + React 18 + TypeScript SPA (**NOT Next.js** — never add "use client")
- **Monorepo:** pnpm workspaces (11 packages, Turbo)
- **Supabase project:** `qbrrugglfdwcapqrnahw` (Singapore ap-southeast-1)
- **Live URL:** https://app-dteam1-mmcv.vercel.app
- **GitHub:** https://github.com/developeryogix-debug/physiocore-ai
- **Regulatory class:** SaMD Class II — every agent output is **decision support only**, never autonomous clinical action

---

## LLM Council Review Process

Before any major feature (new page, new agent, new API endpoint, schema change, security touch),
six council roles must mentally review. Record objections in the PR or commit message.

| # | Role | Concerns |
|---|---|---|
| 1 | **Principal Architect** | Scalability, architecture fit, package boundaries, bundle impact |
| 2 | **Clinical Safety Officer** | Patient safety, `safetyRules.ts` immutability, red-flag gate integrity, SaMD constraints |
| 3 | **Compliance Officer** | PDPA (Singapore), SaMD Class II, FHIR R4 correctness, consent audit trail |
| 4 | **Security Engineer** | RLS policies, API key exposure, secrets in env vars, input sanitisation, SQL injection |
| 5 | **DevOps Lead** | Bundle size, build clean, Vercel cold-start, pnpm workspace resolution, deploy risk |
| 6 | **QA Agent** | Edge cases, empty states, network failure paths, mobile viewports, accessibility |

Shorthand in commit messages: `[COUNCIL: APPROVED]` or `[COUNCIL: CSO-CONCERN: <note>]`

---

## Phase Roadmap

| Phase | Name | Status |
|---|---|---|
| 1 | Core Platform | ✅ COMPLETE |
| 2 | Assessment Swarm (8 agents) | ✅ COMPLETE |
| **2.5** | **UX Upgrade** | ✅ COMPLETE |
| 3 | Treatment Planning (ConservativeAgent → TreatmentOrchestrator) | ✅ COMPLETE |
| 4 | Enterprise Agent Layer | ✅ COMPLETE |
| 5 | Multi-model Router + RAG + Sapiens | ✅ COMPLETE |
| **6** | **Compliance Automation Engine** | 🔶 CURRENT |
| 7 | Full DevOps (Kubernetes) | ⏳ PLANNED |
| 8 | Self-improving World Model | ⏳ PLANNED |

---

## Hard Rules — Never Break

| Rule | Detail |
|---|---|
| `safetyRules.ts` **IMMUTABLE** | 12 APA red flags, zero-temperature, hard-coded — no LLM override |
| Font weight max **600** | No bold heavier than 600 in any component |
| MediaPipe **CDN only** | Never bundle MediaPipe WASM — always load from CDN |
| Env var name | Always `VITE_ANTHROPIC_KEY` — never `VITE_ANTHROPIC_API_KEY` |
| File size **≤ 500 lines** | Split before exceeding; no monolith files |
| Clinical citations | Every clinical claim → primary source (author, year, journal) |
| Framework | Vite SPA — **never** add "use client", Next.js imports, or SSR patterns |
| SaMD constraint | Every agent output labelled as decision support; no autonomous clinical action |
| Secrets | Never commit `.env`, API keys, or service role keys to git |
| Patient data | All localStorage keys scoped by `userId` via `scopedKey()` helper |

---

## What EXISTS — Do Not Rebuild

### Pages (`packages/app/src/pages/`)

| File | Route | Notes |
|---|---|---|
| `Landing.tsx` | `/` | Competitor comparison table, pricing CTA |
| `Login.tsx` | `/login` | Email/password, Google OAuth, magic link |
| `OnboardingWizard.tsx` | `/onboard` | 5-step wizard (needs Clinical Noir restyle) |
| `Dashboard.tsx` | `/dashboard` | Health dashboard |
| `Session.tsx` | `/session` | Live pose detection, rep counting, gym/yoga/pilates modes |
| `Gym.tsx` | `/gym` | Workout programs: Beginner / PPL / Physio |
| `Nutrition.tsx` | `/nutrition` | TDEE, supplements, meal plan |
| `Assessment.tsx` | `/assessment` | 8-agent swarm, consensus score, SOAP, treatment priorities |
| `Clinician.tsx` | `/clinician` | SOAP notes, FHIR R4, churn risk, patient list |
| `Behavior.tsx` | `/behavior` | Retention engine, churn prediction |
| `History.tsx` | `/history` | 52-week heatmap, trend chart, session timeline, personal bests |
| `Outcomes.tsx` | `/outcomes` | PSFS, NPRS, GROC, PHQ-4, SOS referral, CSV export |
| `Settings.tsx` | `/settings` | Profile edit, biometrics tracker, PDPA data export/delete |
| `Trainer.tsx` | `/trainer` | Streaming chat, sidebar sessions, voice in/out, PDF export |
| `PostureAssessment.tsx` | `/posture` | 4-view capture, PDF export 7-page (patient + clinician) |
| `GuidedROMAssessment.tsx` | `/rom-assessment` | 8-test camera goniometry, voice-guided, PDF export |
| `PainMap.tsx` | `/pain-map` | Interactive body map, NPRS, quality/behaviour chips, Supabase sync |
| `FunctionalAssessment.tsx` | `/functional` | PSFS + TUG + 30s Chair Stand, Haiku summary, age-adjusted norms |
| `GaitAssessment.tsx` | `/gait-assessment` | Live MediaPipe gait — cadence, symmetry, trunk sway, Trendelenburg |
| `TreatmentPlan.tsx` | `/treatment-plan` | Phase 3 UI — ArbiterVerdict ring, protocol summary, today's exercises, progression |
| `ROMAssessment.tsx` | `/rom-assessment` | (legacy, kept for reference) |
| `Pricing.tsx` | `/pricing` | 3 tiers (Free / Pro / Clinical), Stripe checkout stubs |
| `Admin.tsx` | `/admin` | Multi-tenant org panel |
| `OrgDashboard.tsx` | `/org-dashboard` | Org-level analytics |
| `SkillsGuide.tsx` | `/skills-guide` | Feature discovery page |

### Components (`packages/app/src/components/`)

| File | Purpose |
|---|---|
| `Navigation.tsx` | Floating pill nav, Assessments dropdown (desktop hover + mobile collapse) |
| `AiChatPanel.tsx` | Contextual AI chat, streaming, voice, present on every page |
| `ConsentScreen.tsx` | PDPA-compliant consent gate (blocks app until signed) |
| `OnboardingWizard.tsx` | 5-step profile wizard |
| `PostureReportPDF.tsx` | 7-page posture PDF (patient + clinician variants) |
| `ROMReportPDF.tsx` | ROM PDF (patient + clinician variants, SOAP page) |
| `SessionReportPDF.tsx` | Post-session PDF with rep-by-rep table + FHIR R4 block |
| `PostureReportCard.tsx` | Inline posture summary card |
| `AgentStatusCard.tsx` | Live agent pipeline status display |
| `ClinicianPatientDetail.tsx` | Patient deep-dive modal in /clinician |

### AI Agents — Assessment Swarm (`packages/agents/assessment/src/`)

| Agent | Model | File |
|---|---|---|
| GaitAgent | rule-based | `gait/GaitAgent.ts` |
| ROMAgent | rule-based | `rom/ROMAgent.ts` |
| PainMapAgent | claude-haiku-4-5-20251001 | `pain/painMapAgent.ts` |
| FunctionalAgent | rule-based | `functional/FunctionalAgent.ts` |
| SpecialTestsAgent | claude-sonnet-4-20250514 | `specialTests/SpecialTestsAgent.ts` |
| AdversarialAgent | claude-opus-4-6 | `adversarial/AdversarialAgent.ts` |
| ConsensusAgent | claude-sonnet-4-6 | `consensus/ConsensusAgent.ts` |
| AssessmentOrchestrator | orchestrator | `orchestrator/AssessmentOrchestrator.ts` |

### AI Agents — Treatment Planning Phase 3 (`packages/agents/assessment/src/phase3/`)

| Agent | Model | File | Status |
|---|---|---|---|
| ConservativeProtocolAgent | claude-sonnet-4-20250514 | `phase3/conservativeAgent.ts` | ✅ BUILT |
| EarlyMobProtocolAgent | claude-sonnet-4-20250514 | `phase3/earlyMobAgent.ts` | ✅ BUILT |
| TreatmentArbiterPhase3Agent | claude-opus-4-6 | `phase3/treatmentArbiterAgent.ts` | ✅ BUILT |
| ProgressionAgent | claude-haiku-4-5-20251001 | `phase3/progressionAgent.ts` | ✅ BUILT |
| PrescriptionAgentPhase3 | claude-sonnet-4-20250514 | `phase3/prescriptionAgent.ts` | ✅ BUILT |
| TreatmentOrchestrator | orchestrator | `phase3/treatmentOrchestrator.ts` | ✅ BUILT |

### AI Clients (`packages/app/src/lib/agents/`)

| File | Purpose |
|---|---|
| `anthropicClient.ts` | Base streaming + non-streaming Claude caller |
| `feedbackClient.ts` | Post-session feedback (Haiku, 900 tokens) |
| `nutritionClient.ts` | TDEE + meal plan (Sonnet, 2048 tokens) |
| `clinicalClient.ts` | SOAP notes + FHIR R4 (Sonnet, 2048 tokens) |
| `behaviorClient.ts` | Churn risk + retention (Sonnet, 2048 tokens) |
| `assessmentClient.ts` | Assessment orchestrator bridge |
| `postureClient.ts` | Posture AI analysis + `callSapiensLandmarks()` |
| `poseAnalyzer.ts` | MediaPipe landmark processing |

### Vercel API (`api/`)

| File | Route | Cron |
|---|---|---|
| `ping.ts` | `/api/ping` | — |
| `health-check.ts` | `/api/health-check` | `0 0 * * *` |
| `weekly-report.ts` | `/api/weekly-report` | `0 1 * * 1` |
| `invite-patient.ts` | `/api/invite-patient` | — |
| `create-checkout-session.ts` | `/api/create-checkout-session` | — |
| `voice-token.ts` | `/api/voice-token` | — |
| `sapiens-analyse.ts` | `/api/sapiens-analyse` | — |
| `agents/daily-monitor.ts` | `/api/agents/daily-monitor` | `0 0 * * *` |
| `agents/weekly-progression.ts` | `/api/agents/weekly-progression` | `0 1 * * 1` |

### Supabase Tables
`profiles`, `consents`, `user_profiles`, `sessions`, `outcomes`, `biometrics`,
`trainer_sessions`, `trainer_messages`, `health_checks`, `alert_log`, `cost_log`,
`full_assessments`, `rom_assessments`, `posture_assessments`, `monitoring_alerts`,
`treatment_plans`, `clinician_alerts`, `session_summaries`, `chat_messages`

---

## Phase 2.5 — UX Upgrade ✅ COMPLETE

Features shipped (17 May 2026):

| Feature | Status |
|---|---|
| F1 Ghost Guide | ✅ |
| F2 Pain Check-in | ✅ |
| F3 Stop + Partial Sessions | ✅ |
| F4 ROM Redesign + 14 new Norkin tests | ✅ |
| F5 Kaia-style Live Animation | ✅ |
| F6 Combined Download | ✅ |
| F7 Clinical Nutrition | ✅ |
| F8 Progress + Gamification | ✅ |
| F9 Modern Design System | ✅ |

## Phase 3 — Treatment Planning ✅ COMPLETE

Shipped 18 May 2026:

| Deliverable | File | Status |
|---|---|---|
| ConservativeProtocolAgent (McKenzie MDT + Maitland) | `phase3/conservativeAgent.ts` | ✅ |
| EarlyMobProtocolAgent (fear-avoidance + graded exposure) | `phase3/earlyMobAgent.ts` | ✅ |
| TreatmentArbiterPhase3Agent (Opus 3-round debate) | `phase3/treatmentArbiterAgent.ts` | ✅ |
| ProgressionAgent (Haiku, every 4 sessions, 2-for-2 rule) | `phase3/progressionAgent.ts` | ✅ |
| PrescriptionAgentPhase3 (Sonnet → FHIR R4 CarePlan) | `phase3/prescriptionAgent.ts` | ✅ |
| TreatmentOrchestrator (parallel Step 1, Supabase save) | `phase3/treatmentOrchestrator.ts` | ✅ |
| Treatment Plan UI (confidence ring, tabs, download PDF) | `pages/TreatmentPlan.tsx` | ✅ |

---

## Phase 4 — Enterprise Agent Layer ✅ COMPLETE

Shipped 18 May 2026:

| Deliverable | File | Status |
|---|---|---|
| ResearchAgent (PubMed weekly digest, Mon 1am UTC / 9am SGT) | `api/agents/research-digest.ts` | ✅ |
| ComplianceAgent (MOH/PDPA monthly check, 1st of month 0am UTC) | `api/agents/compliance-check.ts` | ✅ |
| SecurityAgent (weekly scan cron, Sun 6pm UTC) | `api/agents/security-scan.ts` | ✅ |
| Admin Governance Dashboard | `pages/AdminGovernance.tsx` | ✅ |

---

## Phase 5 — Multi-model Router + RAG ✅ COMPLETE

Shipped 18 May 2026:

| Deliverable | File | Status |
|---|---|---|
| Multi-model router (Haiku / Sonnet / Opus tier routing) | `packages/app/src/lib/agents/` | ✅ |
| RAG layer — pgvector embeddings + semantic retrieval | `api/` | ✅ |
| Sapiens 308-keypoint HF Space (`PHYSIOCOREAI/physiocore-sapiens`) | HuggingFace | ✅ LIVE |
| `callSapiensLandmarks()` + `analysePosture()` Sapiens fallback | `postureClient.ts` | ✅ |
| `api/sapiens-analyse.ts` (graceful fallback) | `api/sapiens-analyse.ts` | ✅ |
| `VITE_SAPIENS_ENDPOINT` wired (8s timeout, `/run/predict`) | env var | ✅ |

**Sapiens precision:** 308 keypoints vs MediaPipe 33 | **Cost:** FREE via ZeroGPU + HF PRO ($9/month)

---

## Phase 6 — Compliance Automation Engine (Current)

| Deliverable | File | Status |
|---|---|---|
| — | — | ⏳ PLANNED |

---

## AI Model Registry

| Agent | Model | Max Tokens |
|---|---|---|
| FeedbackAgent | claude-haiku-4-5-20251001 | 900 |
| PainMapAgent | claude-haiku-4-5-20251001 | 600 |
| ProgressionAgent | claude-haiku-4-5-20251001 | 500 |
| PrescriptionAgent | claude-haiku-4-5-20251001 | 800 |
| Monitor/Diagnose | claude-haiku-4-5-20251001 | 300 |
| NutritionAgent | claude-sonnet-4-20250514 | 2048 |
| ClinicalAgent | claude-sonnet-4-20250514 | 2048 |
| BehaviorAgent | claude-sonnet-4-20250514 | 2048 |
| Chat (AiChatPanel) | claude-sonnet-4-20250514 | streaming |
| SpecialTestsAgent | claude-sonnet-4-20250514 | — |
| ConsensusAgent | claude-sonnet-4-6 | 2000 |
| ConservativeAgent | claude-sonnet-4-6 | — |
| EarlyMobAgent | claude-sonnet-4-6 | — |
| AdversarialAgent | claude-opus-4-6 | — |
| TreatmentArbiterAgent | claude-opus-4-6 | 600 |

---

## Research Citations

| Claim | Source |
|---|---|
| MediaPipe pose | Lugaresi et al., 2019 |
| TDEE (Mifflin-St Jeor) | Mifflin MD et al., 1990, JADA |
| Protein targets | Stokes T et al., 2018, Nutrients |
| FHIR R4 | HL7 International, 2019 |
| Red flag criteria | Greenhalgh S & Selfe J, 2010 |
| Gait symmetry | Krebs DE et al., 1985 |
| PSFS | Stratford PW et al., 1995 |
| TUG test | Podsiadlo D & Richardson S, 1991 |
| 30s Chair Stand | Jones CJ et al., 1999 |
| Pose grading AI | MDPI Healthcare 2021, 2023 |
| AI physio review | MDPI Applied Sciences 2025 |

---

## Design System — Clinical Noir

Dark luxury medical aesthetic. CSS variables in `packages/app/src/index.css`.

| Token | Value | Use |
|---|---|---|
| `--bg-void` | `#050810` | Page background |
| `--bg-surface` | `#0D1420` | Cards |
| `--teal-500` | `#00D4AA` | Primary accent |
| `--blue-400` | `#4DB8FF` | Secondary |
| `--text-primary` | `#F0F4FF` | Body text |
| `--text-secondary` | `#8892A4` | Muted text |

Fonts: Syne (display) · Figtree (body) · Space Mono (data) · Noto Serif (yoga)

Nav: `position: fixed`, `top: 1.25rem`, `backdrop-blur(20px)` → all pages need `padding-top: 100px`
