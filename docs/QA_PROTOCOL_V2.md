# PhysioCore AI — QA Protocol V2
**89 checks · 74 blockers · 15 warnings**
Last updated: 18 May 2026
Tester: _______________  Date: _______________  Build: _______________

---

## Legend

| Mark | Meaning |
|---|---|
| `[BLOCKER]` | Release gate — ship nothing until ✅ |
| `[WARN]` | Document, fix in next sprint |
| `[ ]` | Untested |
| `[✅]` | Pass |
| `[❌]` | Fail — log issue |

---

## Phase 0 — Pre-flight

> Run before any feature testing. All must pass.

### 0a. Environment variables

| # | Check | Mark |
|---|---|---|
| 0.1 | `VITE_ANTHROPIC_KEY` present in `packages/app/.env.local` | `[BLOCKER]` |
| 0.2 | `VITE_SUPABASE_URL` present | `[BLOCKER]` |
| 0.3 | `VITE_SUPABASE_ANON_KEY` present | `[BLOCKER]` |
| 0.4 | `SUPABASE_SERVICE_ROLE_KEY` present (server-side crons) | `[BLOCKER]` |
| 0.5 | `RESEND_API_KEY` present (cron emails) | `[BLOCKER]` |
| 0.6 | `CRON_SECRET` present in Vercel env (production) | `[BLOCKER]` |
| 0.7 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` present | `[BLOCKER]` |
| 0.8 | `VITE_SAPIENS_ENDPOINT` set to HuggingFace Space URL (or absent = MediaPipe fallback) | `[WARN]` |

### 0b. Supabase tables

| # | Check | Mark |
|---|---|---|
| 0.9 | `profiles` table exists with `id`, `email`, `full_name`, `role` columns | `[BLOCKER]` |
| 0.10 | `invites` table exists with `email`, `status`, `invited_at` | `[BLOCKER]` |
| 0.11 | `session_summaries` table exists | `[BLOCKER]` |
| 0.12 | `treatment_plans` table with `current_week`, `patient_id`, `plan_data` | `[BLOCKER]` |
| 0.13 | `monitoring_alerts` table exists | `[BLOCKER]` |
| 0.14 | `clinician_alerts` table exists | `[BLOCKER]` |
| 0.15 | `progression_log` table exists | `[BLOCKER]` |
| 0.16 | `pain_sessions` table exists | `[BLOCKER]` |
| 0.17 | RLS enabled on every table listed above (check Supabase dashboard → Table Editor → RLS toggle) | `[BLOCKER]` |

### 0c. Build

| # | Check | Mark |
|---|---|---|
| 0.18 | `pnpm build` exits 0, no TypeScript errors | `[BLOCKER]` |
| 0.19 | No `as Promise<X>` type-cast anti-pattern in `api/agents/*.ts` (grep check) | `[BLOCKER]` |

```bash
grep -rn "as Promise<" api/agents/
# Expected output: (empty)
```

---

## Phase 1 — F1: Ghost Guide

> Route: `/session` · Feature: camera silhouette overlay guiding patient into position before exercise

| # | Check | Mark |
|---|---|---|
| 1.1 | Ghost silhouette renders on camera preview before session starts | `[BLOCKER]` |
| 1.2 | Silhouette disappears once pose is detected (confidence > 0.55) | `[BLOCKER]` |
| 1.3 | Low-light warning banner appears when ambient light causes confidence < 0.55 | `[BLOCKER]` |
| 1.4 | Ghost does not reappear mid-session after being dismissed | `[WARN]` |
| 1.5 | No emoji in ghost guide UI text | `[BLOCKER]` |

---

## Phase 2 — F2: Pain Check-in

> Route: `/pain-map` · Feature: interactive body map + NPRS + quality/behaviour selectors + Supabase sync

| # | Check | Mark |
|---|---|---|
| 2.1 | Body map renders anterior and posterior views | `[BLOCKER]` |
| 2.2 | Tapping a body region highlights it and populates pain location field | `[BLOCKER]` |
| 2.3 | NPRS slider 0–10 functional; value persists through save | `[BLOCKER]` |
| 2.4 | Pain quality selectors (aching, burning, stabbing, etc.) work — multi-select | `[BLOCKER]` |
| 2.5 | Pain behaviour selectors (constant, intermittent, worse AM/PM) work | `[BLOCKER]` |
| 2.6 | Submit writes row to `pain_sessions` in Supabase under logged-in user's ID | `[BLOCKER]` |
| 2.7 | PainMapAgent red-flag detection fires — if NRS ≥ 8 and red-flag keywords present, `safeToExercise: false` returned | `[BLOCKER]` |
| 2.8 | Red-flag result shows referral warning, not a generic error | `[BLOCKER]` |
| 2.9 | ICD-10 code appears in pain analysis output | `[WARN]` |
| 2.10 | No emoji in pain UI clinical fields | `[BLOCKER]` |

---

## Phase 3 — F3: Stop + Partial Sessions

> Feature: user can stop mid-session; partial reps still saved; not lost on abrupt close

| # | Check | Mark |
|---|---|---|
| 3.1 | "Stop Session" button visible during active pose session | `[BLOCKER]` |
| 3.2 | Clicking Stop saves completed reps to `physiocore_sessions` in localStorage | `[BLOCKER]` |
| 3.3 | Partial session appears in history/dashboard with "(partial)" label | `[WARN]` |
| 3.4 | Page refresh mid-session does not duplicate session entry | `[BLOCKER]` |
| 3.5 | Startup dead zone (8-second) still active — no false reps in first 8 s | `[BLOCKER]` |

---

## Phase 4 — F4: ROM Redesign

> Route: `/rom-assessment` · Feature: 3 modes (Active/Passive/Resisted) + radar chart + Sapiens wiring

| # | Check | Mark |
|---|---|---|
| 4.1 | Mode selector shows Active / Passive / Resisted — tabs functional | `[BLOCKER]` |
| 4.2 | All 8 ROM tests listed (shoulder flex/abd, hip flex/abd, knee flex/ext, cervical rot L/R) | `[BLOCKER]` |
| 4.3 | Camera opens on test start; voice prompt reads test name | `[BLOCKER]` |
| 4.4 | HOLD capture triggers at correct moment; countdown voice fires ("Hold still. Capturing in 3, 2, 1.") | `[BLOCKER]` |
| 4.5 | Radar chart renders after all 8 tests with correct angle values | `[BLOCKER]` |
| 4.6 | `🔬 Sapiens 308pt` badge shown when Sapiens landmarks used; `📷 MediaPipe 33pt` shown on fallback | `[WARN]` |
| 4.7 | Patient PDF export — 8 ROM results, radar chart, reference ranges | `[BLOCKER]` |
| 4.8 | Clinician PDF export — raw measurements, deviation table, FHIR reference | `[BLOCKER]` |
| 4.9 | ROM results persist to Supabase (not only localStorage) | `[BLOCKER]` |

---

## Phase 5 — F5: Exercise Animation

> Route: `/session` · Feature: animated stick figure or silhouette demonstrating correct movement

| # | Check | Mark |
|---|---|---|
| 5.1 | Animation plays before exercise starts (demonstration mode) | `[BLOCKER]` |
| 5.2 | Animation matches selected exercise (squat ≠ lunge animation) | `[BLOCKER]` |
| 5.3 | Animation stops cleanly when user starts moving (pose detected) | `[BLOCKER]` |
| 5.4 | Animation does not block camera feed | `[BLOCKER]` |
| 5.5 | Animation renders at 30 fps+ on MacBook Air M2 (no jank) | `[WARN]` |

---

## Phase 6 — F6: Combined Download (PDF / CSV / FHIR)

> Feature: single download button generates all three formats in one action

| # | Check | Mark |
|---|---|---|
| 6.1 | Download button present on assessment results and session report pages | `[BLOCKER]` |
| 6.2 | PDF generated — patient variant includes grid images, score, recommendations | `[BLOCKER]` |
| 6.3 | PDF generated — clinician variant includes measurements, deviation table | `[BLOCKER]` |
| 6.4 | CSV export includes headers + all numeric fields; opens in Excel without errors | `[BLOCKER]` |
| 6.5 | FHIR R4 JSON is valid — run through https://hapi.fhir.org/baseR4/validate or `fhir-validator` CLI | `[BLOCKER]` |
| 6.6 | FHIR bundle contains `Patient`, `Observation`, `Procedure` resources | `[BLOCKER]` |
| 6.7 | All three files download simultaneously (not three separate button clicks) | `[WARN]` |
| 6.8 | No PII leaks into CSV filename or FHIR bundle identifiers beyond session scope | `[BLOCKER]` |

---

## Phase 7 — F7: Clinical Nutrition

> Route: `/nutrition` · Feature: TDEE + evidence-graded supplements + meal plan (Haiku)

| # | Check | Mark |
|---|---|---|
| 7.1 | TDEE calculation shown — uses Mifflin-St Jeor with correct age/weight/height/activity | `[BLOCKER]` |
| 7.2 | Protein target displayed: 1.6–2.2 g/kg (Stokes 2018 citation visible) | `[BLOCKER]` |
| 7.3 | Supplement recommendations show evidence grade badge (A/B/C/D) | `[BLOCKER]` |
| 7.4 | Meal plan generates via Haiku (≤ 600 tokens, no 429 timeout) | `[BLOCKER]` |
| 7.5 | No supplement recommendation includes unsubstantiated claim (no Grade D shown as definitive) | `[BLOCKER]` |
| 7.6 | Nutrition data scoped to logged-in user (`userId` prefix in localStorage) | `[BLOCKER]` |

---

## Phase 8 — F8: Progress Hub

> Route: `/dashboard` · Feature: milestones + streak + recovery score panel

| # | Check | Mark |
|---|---|---|
| 8.1 | Milestone tracker visible — shows current milestone name and % complete | `[BLOCKER]` |
| 8.2 | Milestone advances when session count / outcome score threshold met | `[BLOCKER]` |
| 8.3 | Streak counter shows consecutive days with at least one session | `[BLOCKER]` |
| 8.4 | Streak resets to 0 on missed day (not missed hour) | `[BLOCKER]` |
| 8.5 | Recovery score (0–100) derived from pain trend + form trend + adherence | `[BLOCKER]` |
| 8.6 | Recovery score red (< 40), amber (40–70), green (> 70) — colour coding correct | `[WARN]` |
| 8.7 | Dashboard reads from real `physiocore_sessions` localStorage — no mock data | `[BLOCKER]` |
| 8.8 | Empty state (zero sessions) shows onboarding prompt, not broken UI | `[WARN]` |

---

## Phase 9 — F9: Design System

> Components: `SlidingTabs`, `ElevationCard`, `PageTransition`

| # | Check | Mark |
|---|---|---|
| 9.1 | `SlidingTabs` — selected tab indicator slides smoothly (CSS transition, not jump) | `[BLOCKER]` |
| 9.2 | `SlidingTabs` — keyboard arrow keys navigate tabs | `[WARN]` |
| 9.3 | `ElevationCard` — renders with correct shadow level (1 = subtle, 2 = medium, 3 = strong) | `[BLOCKER]` |
| 9.4 | `ElevationCard` — no elevation shadow uses purple colour | `[BLOCKER]` |
| 9.5 | `PageTransition` — route change animates (fade or slide) — no white flash | `[BLOCKER]` |
| 9.6 | `PageTransition` — animation completes in < 300 ms | `[WARN]` |
| 9.7 | All three components exported from design system index file | `[BLOCKER]` |

---

## Phase 10 — Core Integrity

### 10a. Safety rules

| # | Check | Mark |
|---|---|---|
| 10.1 | `packages/agents/clinical/src/safetyRules.ts` unchanged — run `git log --follow` to confirm no edits since Phase 1c | `[BLOCKER]` |
| 10.2 | Safety engine contains exactly 12 APA red flags (count assertions in file) | `[BLOCKER]` |
| 10.3 | SafetyRuleEngine rejects session with `safeToExercise: false` when red-flag pain score met | `[BLOCKER]` |
| 10.4 | Zero-temperature call verified — `temperature: 0` in safetyRules LLM call (grep check) | `[BLOCKER]` |

```bash
grep -n "temperature" packages/agents/clinical/src/safetyRules.ts
# Expected: temperature: 0
```

### 10b. Voice guide

| # | Check | Mark |
|---|---|---|
| 10.5 | `packages/app/src/lib/voiceGuide.ts` unchanged from last approved version | `[BLOCKER]` |
| 10.6 | `speak()` fires on PostureAssessment view transitions with correct L/R directions | `[BLOCKER]` |
| 10.7 | Countdown voice fires at tick=3: "Hold still. Capturing in 3, 2, 1." | `[BLOCKER]` |
| 10.8 | `stopSpeech()` cancels utterance — no audio bleed between views | `[BLOCKER]` |
| 10.9 | Voice works in Chrome 120+ on macOS (SpeechSynthesis API available) | `[BLOCKER]` |
| 10.10 | Voice directions patient-perspective correct: "turn to your LEFT" to show right side | `[BLOCKER]` |

### 10c. Phase 2 agents

| # | Check | Mark |
|---|---|---|
| 10.11 | `PostureAgent` — returns `PostureReport` with `overallScore`, `findings[]`, `correctionExercises[]` | `[BLOCKER]` |
| 10.12 | `ROMAgent` — returns score-as-proxy ROM inference; no crash on null landmark input | `[BLOCKER]` |
| 10.13 | `GaitAgent` — step symmetry + cadence + trunk sway computed from MediaPipe; Krebs 1985 cited | `[BLOCKER]` |
| 10.14 | `PainMapAgent` — ICD-10 code in output; `safeToExercise` boolean always present | `[BLOCKER]` |
| 10.15 | `FunctionalAgent` — PSFS + TUG + 30s Chair Stand scores computed; Stratford 1995 cited | `[BLOCKER]` |
| 10.16 | `ConsensusAgent` — FHIR R4 CarePlan + SOAP note generated; not empty string | `[BLOCKER]` |
| 10.17 | `AssessmentOrchestrator` — 4-phase parallel swarm completes in < 60 s on good connection | `[WARN]` |

### 10d. Posture grid overlay

| # | Check | Mark |
|---|---|---|
| 10.18 | `postureGridOverlay.ts` — SAPO horizontal lines present for EAR / SHOULDER / HIP / KNEE / ANKLE | `[BLOCKER]` |
| 10.19 | Angle annotation font size 14px (not 11px) | `[BLOCKER]` |
| 10.20 | Angle annotations have dark pill background (`#00000088`, borderRadius 4px) | `[BLOCKER]` |
| 10.21 | Deviation lines suppressed when Sapiens confidence < 75% | `[BLOCKER]` |
| 10.22 | Amber confidence warning banner renders in review UI when confidence < 75% | `[WARN]` |

### 10e. Auth flows

| # | Check | Mark |
|---|---|---|
| 10.23 | Google OAuth login completes — redirects to `/dashboard` | `[BLOCKER]` |
| 10.24 | Magic link login — email arrives; clicking link logs user in | `[BLOCKER]` |
| 10.25 | Unauthenticated `/dashboard` access redirects to login | `[BLOCKER]` |
| 10.26 | Clinician role — accessing `/clinician` works; patient role — `/clinician` blocked | `[BLOCKER]` |
| 10.27 | Logout clears Supabase session cookie and localStorage auth token | `[BLOCKER]` |

### 10f. Stripe payments

| # | Check | Mark |
|---|---|---|
| 10.28 | `/pricing` page shows Free / Pro / Clinical tiers with correct prices | `[BLOCKER]` |
| 10.29 | Stripe checkout opens on "Upgrade" click (test mode) | `[BLOCKER]` |
| 10.30 | Successful test payment (card `4242 4242 4242 4242`) updates user role in Supabase | `[BLOCKER]` |
| 10.31 | Failed test payment (card `4000 0000 0000 9995`) shows error; no role change | `[BLOCKER]` |
| 10.32 | Stripe webhook verifies signature — `STRIPE_WEBHOOK_SECRET` used; forged event rejected | `[BLOCKER]` |

---

## Phase 11 — Performance + Compliance

### 11a. Bundle size

| # | Check | Mark |
|---|---|---|
| 11.1 | Initial JS load < 1 MB (gzip) — check `dist/assets/` after `pnpm build` | `[BLOCKER]` |
| 11.2 | `vendor-react-*.js` < 200 KB gzip | `[WARN]` |
| 11.3 | `vendor-pdf-*.js` lazy-loaded — not in initial bundle | `[BLOCKER]` |

```bash
ls -lh packages/app/dist/assets/*.js | awk '{print $5, $9}' | sort -rh
# Initial entry JS must be < 1MB gzip
```

### 11b. Clinical UI — design constraints

| # | Check | Mark |
|---|---|---|
| 11.4 | No emoji in any clinical UI string — grep all `.tsx` for emoji in JSX | `[BLOCKER]` |
| 11.5 | No font-weight > 600 anywhere in CSS/inline styles | `[BLOCKER]` |
| 11.6 | No purple (`#7C3AED`, `#8B5CF6`, `purple`, `violet`) in clinical UI components | `[BLOCKER]` |
| 11.7 | Min font size 0.75rem enforced — no `font-size` below 12px | `[WARN]` |

```bash
# Emoji check (non-exhaustive — catches common ranges)
grep -rn '[^\x00-\x7F]' packages/app/src/pages/ --include="*.tsx" | grep -v "//.*[^\x00-\x7F]"

# Purple colour check
grep -rn "purple\|violet\|#7C3AED\|#8B5CF6\|#A855F7" packages/app/src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

### 11c. PDPA compliance

| # | Check | Mark |
|---|---|---|
| 11.8 | All localStorage keys use `scopedKey(userId, key)` helper — no bare keys with patient data | `[BLOCKER]` |
| 11.9 | `/settings` — "Export my data" downloads only current user's records | `[BLOCKER]` |
| 11.10 | `/settings` — "Delete my data" removes all user records from Supabase and localStorage | `[BLOCKER]` |
| 11.11 | No patient data in URL query parameters (no `?userId=`, `?email=` in any route) | `[BLOCKER]` |
| 11.12 | Supabase RLS confirmed: `SELECT` policy uses `auth.uid() = user_id` on all patient tables | `[BLOCKER]` |

### 11d. Cron jobs

| # | Check | Mark |
|---|---|---|
| 11.13 | `vercel.json` contains cron `0 0 * * *` → `/api/agents/daily-monitor` | `[BLOCKER]` |
| 11.14 | `vercel.json` contains cron `0 1 * * 1` → `/api/agents/weekly-progression` | `[BLOCKER]` |
| 11.15 | Both cron handlers reject requests without `Authorization: Bearer ${CRON_SECRET}` header (return 401) | `[BLOCKER]` |
| 11.16 | `daily-monitor` completes without TS2339 errors (no `as Promise<X>` anti-pattern) | `[BLOCKER]` |
| 11.17 | `weekly-progression` Stage-1 linear regression fires; Stage-2 Haiku email sends via Resend | `[WARN]` |

### 11e. Sapiens integration

| # | Check | Mark |
|---|---|---|
| 11.18 | `callSapiensLandmarks()` in `postureClient.ts` — if HuggingFace Space unreachable, returns `null` (no throw) | `[BLOCKER]` |
| 11.19 | PostureAssessment.tsx — Sapiens failure silently falls back to MediaPipe; assessment completes | `[BLOCKER]` |
| 11.20 | `/api/sapiens-analyse` — missing `SAPIENS_ENDPOINT` env var returns `{ sapiensAvailable: false, fallback: 'mediapipe' }` with HTTP 200 | `[BLOCKER]` |

---

## Rollback Playbook

> Use when any `[BLOCKER]` fails in production.

### 1. Instant rollback (< 2 min)

```bash
# List recent deployments
vercel list

# Promote previous stable build
vercel promote <previous-deployment-url> --scope dteam1-mmcv
```

### 2. Feature-flag rollback

If the issue is isolated to one feature and a feature flag exists:
- Set `VITE_FEATURE_<NAME>=false` in Vercel env vars
- Re-deploy with `vercel --prod`

### 3. Database rollback

If a migration caused the failure:
```sql
-- Disable RLS temporarily (ONLY if RLS policy caused lockout — re-enable within 15 min)
ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;

-- Restore from Supabase Point-in-Time Recovery (PITR)
-- Dashboard → Settings → Backups → Restore to timestamp
```

### 4. Cron disable

```bash
# Remove cron from vercel.json, redeploy to stop runaway cron
# Do NOT delete the handler file — just remove from vercel.json crons array
```

### 5. Escalation contacts

| Role | Contact |
|---|---|
| Technical lead | Dev Kapil — developeryogix@gmail.com |
| Supabase support | https://supabase.com/support |
| Anthropic API status | https://status.anthropic.com |
| Resend status | https://status.resend.com |

---

## Summary Scorecard

| Phase | Checks | Blockers | Status |
|---|---|---|---|
| 0 — Pre-flight | 19 | 18 | `[ ]` |
| 1 — Ghost Guide | 5 | 4 | `[ ]` |
| 2 — Pain Check-in | 10 | 9 | `[ ]` |
| 3 — Stop + Partial | 5 | 4 | `[ ]` |
| 4 — ROM Redesign | 9 | 8 | `[ ]` |
| 5 — Exercise Animation | 5 | 4 | `[ ]` |
| 6 — Combined Download | 8 | 7 | `[ ]` |
| 7 — Clinical Nutrition | 6 | 6 | `[ ]` |
| 8 — Progress Hub | 8 | 6 | `[ ]` |
| 9 — Design System | 7 | 5 | `[ ]` |
| 10 — Core Integrity | 32 | 30 | `[ ]` |
| 11 — Perf + Compliance | 20 | 17 | `[ ]` |
| **Total** | **134** | **118** | `[ ]` |

> **Ship criteria**: all `[BLOCKER]` items ✅. `[WARN]` items logged as issues, scheduled for next sprint.

---

*PhysioCore AI is a SaMD Class II device. Every release must pass all blockers before patient-facing deployment.*
