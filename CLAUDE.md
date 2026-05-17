# PhysioCore AI — Build Context
Last updated: 09 May 2026

## Project Location
/Users/devkapilicloud.com/Desktop/physiocore-ai

## Commands
cd /Users/devkapilicloud.com/Desktop/physiocore-ai
cd packages/app && pnpm dev
App runs at: http://localhost:5173 (or 5174/5175 if ports taken)
Kill all servers: pkill -f "vite"

## Tech Stack
- React 18 + TypeScript + Vite
- pnpm workspaces (9 packages)
- Tailwind CSS + shadcn/ui
- MediaPipe Pose Landmarker (CDN)
- Anthropic Claude API (claude-sonnet-4-20250514)
- Supabase (url + keys in .env.local)
- localStorage for all user data

## Package Structure
physiocore-ai/
├── packages/types/         @physiocore/types
├── packages/supabase/      @physiocore/supabase
├── packages/agents/
│   ├── pose/               @physiocore/pose-agent
│   ├── feedback/           @physiocore/feedback-agent (Haiku model)
│   ├── nutrition/          @physiocore/nutrition-agent
│   ├── clinical/           @physiocore/clinical-agent
│   └── behavior/           @physiocore/behavior-agent
├── packages/orchestrator/  @physiocore/orchestrator
└── packages/app/           React app (main)

## Routes Built
/ → Landing page (comparison table vs 298 competitors)
/onboard → 5-step onboarding wizard
/dashboard → Health dashboard (basic, needs 8 panels)
/session → Live pose session (camera + MediaPipe)
/nutrition → TDEE + supplements + meal plan
/clinician → Patient management + SOAP + FHIR R4
/behavior → Retention engine + churn risk
/gym → Workout programs (Beginner/PPL/Physio)

## Routes NOT YET BUILT
/history → Session timeline + analytics
/outcomes → PSFS/GROC/NPRS questionnaires (RCT-ready)
/settings → Profile edit + biometrics tracker
/trainer → AI chat trainer (streaming, voice) — NOT BUILT YET

## Session Features Built
- MediaPipe pose detection (front + side view)
- Rep counting: 5-sec hold threshold (gym), 0.8s (pilates)
- View modes: Front / Side-right / Side-left / Lost
- Proximity guard (too close to camera)
- Low light warning (confidence < 0.55)
- Startup dead zone (8 seconds, no false counts)
- Angle sanity filter (squat < 60° = noise, discarded)
- Exercise modes: Gym (8 exercises), Yoga (4 poses), Pilates (6 exercises)
- Post-session AI feedback (Haiku model, 600 tokens max)
- Rep-by-rep breakdown table
- Next session prescription
- PDF export with FHIR R4 JSON block
- AiChatPanel on every page (contextual, streaming, voice)

## AI Models Used
- claude-haiku-4-5-20251001 → FeedbackAgent (session reports)
- claude-sonnet-4-20250514 → NutritionAgent, ClinicalAgent, BehaviorAgent, Chat

## API Keys Location
packages/app/.env.local
- VITE_ANTHROPIC_KEY ✅
- VITE_SUPABASE_URL ✅
- VITE_SUPABASE_ANON_KEY ✅
- SUPABASE_SERVICE_ROLE_KEY ✅
- FHIR_BASE_URL = https://hapi.fhir.org/baseR4

## Anthropic Account
- Auto-reload: $15 when balance low
- Current tier: Tier 1 (upgrade to Tier 2 at $5 cumulative spend)
- Sonnet limit: 30K tokens/min (upgrades automatically at $5 spend)
- Monthly limit: $100

## Known Issues Fixed
- crypto.randomUUID browser error → vite-plugin-node-polyfills
- claude-opus-4-7 wrong model → fixed to claude-sonnet-4-20250514
- Node.js packages in browser → lightweight browser-safe client layer
- Sessions not persisting → localStorage write in stopSession
- Dashboard mock data → reads real physiocore_sessions from localStorage
- Rate limit 429 → Haiku for feedback + retry with 3s delay + 600 token cap

## Known Issues Remaining
- Hero headline cut off on landing page (CSS color issue)
- Dashboard still shows some mock data (streak/adherence use real calc now)
- Hold time in report shows cycle time not bottom-hold time (partially fixed)

## Competitive Position
Beats all 298 AI physio startups on 7 gaps:
1. XAI (Explainable AI) — every recommendation shows clinical reasoning
2. FHIR R4 EHR export — valid R4 Bundle with Patient/Observation/Procedure
3. Retention engine — churn prediction, Tiny Habits, adaptive nudges
4. Multi-view pose — front + side unilateral landmark fallback
5. Clinician SOAP notes + CPT codes — 97110/97530/97150
6. Evidence nutrition — Grade A/B/C/D badges, web_search for products
7. Yoga mode — Sanskrit names, hold timer, SpeechSynthesis cues

## Research Foundation (cite in papers)
- MediaPipe: Lugaresi et al., 2019
- TDEE: Mifflin-St Jeor equation (Mifflin MD et al., 1990, JADA)
- Protein targets: Stokes T et al., 2018, Nutrients (1.6-2.2g/kg)
- FHIR R4: HL7 International, 2019
- Pose grading: MDPI Healthcare 2021, 2023
- AI physio review: MDPI Applied Sciences 2025

## Next Build Prompts (paste to Claude Code)

### Next Prompt — History + Outcomes + Settings pages:
Build three missing pages:

1. /history — Session History
- Timeline of all sessions from localStorage (physiocore_sessions)
- Filter by exercise type
- Form score trend line chart (Recharts)
- Personal bests per exercise
- Total reps, total time, sessions per week chart
- GitHub-style 52-week heatmap (color = form score)

2. /outcomes — Clinical Outcomes (RCT-ready)
- PSFS questionnaire (3 activities, 0-10 each)
- NPRS pain scale (0-10, pre/post session)
- GROC scale (-7 to +7, weekly)
- PHQ-4 mental health screen (flag > 6)
- All scores stored in localStorage (physiocore_outcomes)
- Line charts for each measure over time
- Export anonymized CSV (CONSORT-compatible, no PII)

3. /settings — Profile & Biometrics
- Edit all onboarding data
- Manual biometric entry: HR, BP, glucose, HRV, sleep, weight
- Each metric shows sparkline of last 10 readings
- Clinical reference ranges shown
- Out-of-range values highlighted
- Wearable device recommendations

### Next Prompt — Dashboard 8 panels:
Replace current basic dashboard with full 8-panel version:
[paste full dashboard spec from original prompt]

### Next Prompt — Safety layer:
Add pain check-in modal before every session (0-10 scale)
If > 7: block session, show rest recommendation
Log pain ratings to localStorage
Add contraindication check: cross-reference exercise vs conditions
Block dangerous combos with modification suggestions

### Next Prompt — AI Trainer Chat (/trainer):
Full streaming chat page (NOT the floating panel - a dedicated page)
[paste full trainer spec from original prompt]
## Available Claude Skills (invoke by name or trigger phrase)

| Skill | Category | When to use |
|---|---|---|
| `frontend-design` | Web Dev | UI components, landing pages, dashboards, visual design |
| `web-artifacts-builder` | Web Dev | Multi-component apps with routing/state |
| `docx` | Documents | Word docs, letters, reports with tables/headers |
| `pdf` | Documents | Read, merge, fill, encrypt PDFs |
| `pdf-reading` | Files | Extract text/tables/images from PDFs |
| `pptx` | Documents | Slide decks, pitch decks, presentations |
| `xlsx` | Data | Spreadsheets, CSV, data cleaning, financial models |
| `doc-coauthoring` | Writing | Technical specs, proposals, formal documentation |
| `internal-comms` | Writing | Status reports, newsletters, incident reports |
| `canvas-design` | Visual | Posters, illustrations, graphic design |
| `theme-factory` | Visual | Apply colour themes to slides/docs/web pages |
| `algorithmic-art` | Visual | Generative art with p5.js |
| `brand-guidelines` | Visual | Anthropic brand colours & typography |
| `mcp-builder` | Advanced | MCP servers for external API integrations |
| `skill-creator` | Advanced | Build/optimise new Claude skills |
| `product-self-knowledge` | AI | Accurate Claude API facts, pricing, limits |
| `dev-kapil-profile` | Context | Dev Kapil's professional background & expertise |
| `file-reading` | Files | Router — determines correct handler for any file type |

### Skill Combinations
- **Branded deck**: `pptx` + `theme-factory` + `brand-guidelines`
- **PDF → report**: `pdf-reading` → `docx`
- **Full web app**: `frontend-design` + `web-artifacts-builder`
- **Project docs**: `doc-coauthoring` + `docx` + `canvas-design`
- **PDF insights**: `pdf-reading` + `doc-coauthoring` + `docx`

> **Tip**: Name the skill explicitly — "Use the `frontend-design` skill to…" — to guarantee activation.

## Global Vision — Read Before Every Session
Read VISION.md and CONTEXT.md at the start of every session.
Read POSTURE_SYSTEM.md before any posture or assessment work.
PhysioCore AI is a regulated medical device (SaMD Class II).
Every clinical claim requires a primary source citation.
Safety rules cannot be overridden by any agent.
Current phase: Phase 1 — Clinical Knowledge Foundation.

