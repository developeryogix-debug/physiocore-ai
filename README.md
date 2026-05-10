# PhysioCore AI

AI-powered physiotherapy platform — real-time pose analysis, clinical-grade session feedback, FHIR R4 export, and a full clinician portal.

**Live:** [app-dteam1-mmcv.vercel.app](https://app-dteam1-mmcv.vercel.app)

---

## What it does

| Feature | Detail |
|---|---|
| Live pose detection | MediaPipe Pose Landmarker, front + side view |
| Rep counting | Hysteresis-stabilised, live hold-time feedback |
| AI session feedback | Claude Haiku — form corrections, safety warnings, next-session prescription |
| Nutrition engine | TDEE (Mifflin-St Jeor), supplements with evidence grades A–D |
| Clinician portal | SOAP notes, CPT codes, FHIR R4 Bundle export, churn-risk scoring |
| Behavior engine | Tiny Habits framework, adherence prediction, adaptive nudges |
| Gym programs | Beginner / PPL Split / Physio Rehab — auto-swaps exercises around injuries |
| Auth | Email/password, Google OAuth, magic link (Supabase) |
| Export | PDF session report with embedded FHIR R4 JSON |

---

## Tech stack

- **Frontend** — React 18, TypeScript, Vite
- **Monorepo** — pnpm workspaces (9 packages)
- **AI** — Anthropic Claude API (Haiku for feedback, Sonnet for all other agents)
- **Pose** — MediaPipe Pose Landmarker (CDN, WASM)
- **Auth + DB** — Supabase (Postgres + RLS)
- **Deployment** — Vercel

---

## Package structure

```
physiocore-ai/
├── packages/types/           @physiocore/types
├── packages/supabase/        @physiocore/supabase  (client + schema + migration)
├── packages/agents/
│   ├── pose/                 @physiocore/pose-agent
│   ├── feedback/             @physiocore/feedback-agent
│   ├── nutrition/            @physiocore/nutrition-agent
│   ├── clinical/             @physiocore/clinical-agent
│   └── behavior/             @physiocore/behavior-agent
├── packages/orchestrator/    @physiocore/orchestrator
└── packages/app/             React app (main entry point)
```

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+

```bash
# Install
npm install -g pnpm@9
git clone https://github.com/devkapil-tech/physiocore-ai.git
cd physiocore-ai
pnpm install
```

### Environment variables

Create `packages/app/.env.local`:

```env
VITE_ANTHROPIC_KEY=sk-ant-...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
```

### Run

```bash
cd packages/app
pnpm dev
# → http://localhost:5173
```

### Build

```bash
pnpm --filter @physiocore/app build
```

### Lint / type-check

```bash
pnpm --filter @physiocore/app lint
npx tsc --noEmit -p packages/app/tsconfig.json
```

---

## Database setup

Run `packages/supabase/src/migration.sql` in the Supabase SQL Editor. This creates:

- `profiles` — role (patient / clinician / admin)
- `consents` — signed consent records
- `user_profiles` — full onboarding data
- `sessions` — session history
- `outcomes` — PSFS / NPRS / GROC scores

All tables use Row Level Security — users can only access their own rows.

---

## Deployment (Vercel)

The repo is connected to Vercel. Every push to `main` triggers a production deploy.

Config in `vercel.json`:

```json
{
  "buildCommand": "pnpm --filter @physiocore/app build",
  "outputDirectory": "packages/app/dist",
  "installCommand": "npx pnpm@9.15.4 install",
  "framework": null
}
```

Required environment variables in Vercel dashboard:
- `VITE_ANTHROPIC_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Auth (email, Google, magic link) |
| `/onboard` | 5-step onboarding wizard |
| `/dashboard` | Health dashboard |
| `/session` | Live pose session |
| `/gym` | Workout programs |
| `/nutrition` | Nutrition + supplements |
| `/assessment` | Clinical assessment |
| `/clinician` | Clinician portal |
| `/behavior` | Behavior & retention engine |

---

## AI models

| Agent | Model | Purpose |
|---|---|---|
| Feedback | claude-haiku-4-5-20251001 | Post-session form feedback |
| Nutrition | claude-sonnet-4-20250514 | Meal plans, supplement research |
| Clinical | claude-sonnet-4-20250514 | SOAP notes, HEP generation |
| Behavior | claude-sonnet-4-20250514 | Churn prediction, habit nudges |
| Chat | claude-sonnet-4-20250514 | Contextual AI assistant panel |

---

## Research citations

- MediaPipe: Lugaresi et al., 2019
- TDEE: Mifflin-St Jeor equation — Mifflin MD et al., 1990, JADA
- Protein targets: Stokes T et al., 2018, Nutrients (1.6–2.2 g/kg)
- FHIR R4: HL7 International, 2019
- Pose grading: MDPI Healthcare 2021, 2023
- AI physiotherapy review: MDPI Applied Sciences 2025

---

## License

MIT
