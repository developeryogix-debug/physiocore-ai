# PhysioCore AI — Clinical Architecture Skill

## When this skill applies
Any task involving: posture assessment, exercise agents, treatment planning, FHIR export, clinical scoring, Sapiens API, MediaPipe, agent architecture, or the PhysioCore codebase.

---

## Project Architecture

### Tech Stack
- React 18 + TypeScript + Vite (NOT Next.js — NEVER add "use client")
- pnpm workspaces monorepo with turbo build
- Supabase for auth + biometrics (URL + keys in packages/app/.env.local)
- localStorage for all session data (key: physiocore_sessions)
- `noUncheckedIndexedAccess: true` in tsconfig — always use optional chaining on array access

### Package Structure
```
packages/
├── types/         @physiocore/types — shared TypeScript interfaces
├── supabase/      @physiocore/supabase — Supabase client
├── agents/
│   ├── pose/               @physiocore/pose-agent
│   ├── feedback/           @physiocore/feedback-agent (Haiku — 600 tokens max)
│   ├── nutrition/          @physiocore/nutrition-agent
│   ├── clinical/           @physiocore/clinical-agent
│   ├── behavior/           @physiocore/behavior-agent
│   └── assessment/         @physiocore/assessment-agent (Phase 3 treatment swarm)
├── orchestrator/  @physiocore/orchestrator
└── app/           React SPA (main)
```

---

## Design System: Clinical Noir

NEVER hardcode colors. Always use these CSS variables:

```css
--bg-void:     #050810   /* darkest — page background */
--bg-base:     #080D14
--bg-surface:  #0D1420   /* card background */
--bg-elevated: #121B2E
--teal-400:    #00FFD1   /* brightest accent */
--teal-500:    #00D4AA   /* primary accent */
--teal-dim:    rgba(0,212,170,0.08)
--blue-400:    #4DB8FF   /* secondary accent */
--blue-dim:    rgba(33,150,243,0.08)
--amber-400:   #FFB830   /* warning */
--amber-dim:   rgba(255,184,48,0.08)
--text-primary:   #F0F4FF
--text-secondary: #8892A4
--text-tertiary:  #4A5568
--border-subtle:  rgba(255,255,255,0.04)
--border-default: rgba(255,255,255,0.08)
--border-teal:    rgba(0,212,170,0.2)
--shadow-card:    0 4px 24px rgba(0,0,0,0.4)
```

Typography:
- `'Syne', sans-serif` — display headings (`font-display` class)
- `'Space Mono', monospace` — data labels, metrics, badges
- `'Figtree', system-ui, sans-serif` — body text

CSS classes: `card`, `btn-primary`, `btn-ghost`, `btn-danger`, `animate-in`, `font-display`, `metric-card`

---

## AI Models

| Model | Used for |
|-------|---------|
| `claude-haiku-4-5-20251001` | FeedbackAgent (session reports), Dashboard insights |
| `claude-sonnet-4-20250514` | NutritionAgent, ClinicalAgent, BehaviorAgent, AiChatPanel |

All Anthropic calls go browser-direct with header `'anthropic-dangerous-direct-browser-access': 'true'`.

---

## Sapiens Pose API

**Endpoint:** `https://physiocoreai-physiocore-sapiens.hf.space/gradio_api`

**Gradio 6.x two-step queue flow:**
1. `POST /gradio_api/call/analyse_pose` body: `{data: [imageBase64]}`  → returns `{event_id}`
2. `GET /gradio_api/call/analyse_pose/{event_id}` → SSE text → parse first `data:` line

**File:** `packages/app/src/lib/agents/postureClient.ts`
- Falls back to MediaPipe landmarks if Sapiens fails
- `calcLandmarkConfidence()` returns 0–100 from MediaPipe landmark visibility

**Confidence gate** (`packages/app/src/lib/postureGridOverlay.ts`):
- `drawFrontalOverlay(ctx, lms, w, h, confidence = 100)` — signature
- When `confidence < 75`: deviation lines, spine midline, head tilt hidden
- `PostureAssessment.tsx`: amber warning banner shown when any view < 75%

---

## Phase 3 Treatment Planning Swarm

**Location:** `packages/agents/assessment/src/treatment/`

| Agent | Role |
|-------|------|
| `ConservativeAgent` | Conservative treatment plan |
| `EarlyMobAgent` | Early mobilization plan |
| `TreatmentArbiterAgent` | Picks winner, blends phases |
| `ProgressionAgent` | Week-by-week exercise progression |
| `PrescriptionAgent` | FHIR R4 CarePlan + SOAP notes (PENDING) |

Types: `packages/agents/assessment/src/phase3.ts`

---

## FHIR R4 Export

- Full R4 Bundle: Patient / Observation / Procedure resources
- CPT codes: 97110 (therapeutic exercise), 97530 (therapeutic activities), 97150 (group therapy)
- ICD-10 codes mapped from user conditions
- PatientId from Supabase auth or generated UUID

---

## Evidence Grades

All clinical recommendations require a Grade badge:
- **Grade A** — systematic review / RCT
- **Grade B** — cohort study
- **Grade C** — case study / expert consensus
- **Grade D** — avoid (insufficient evidence)

---

## Key File Map

```
packages/app/src/
├── pages/              All React pages
├── lib/
│   ├── agents/postureClient.ts   Sapiens API integration
│   ├── postureGridOverlay.ts     Canvas drawing + confidence gate
│   ├── voiceGuide.ts             speak() / stopSpeech() with voice priority
│   └── storage.ts                scopedKey() for localStorage namespacing
├── hooks/
│   ├── useUserProfile.ts
│   └── useAuth.ts
├── components/AiChatPanel.tsx    Floating AI chat (all pages)
└── index.css                     Clinical Noir design tokens
```

---

## Common Code Patterns

```typescript
// Storage (always namespace by userId)
import { scopedKey } from '../lib/storage.js';
const sessions = JSON.parse(
  localStorage.getItem(scopedKey('physiocore_sessions', user?.id)) ?? '[]'
);

// Voice guidance
import { speak, stopSpeech } from '../lib/voiceGuide.js';
speak('Good form! Hold for 3 more seconds.');

// Anthropic API — browser direct
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: '...',
    messages: [{ role: 'user', content: '...' }],
  }),
})
```

---

## Safety Rules (NEVER override)

1. Never block exercises without contraindication check
2. Never display AI scores without confidence indicator
3. Never commit .env files or API keys
4. All clinical claims require primary source citation
5. PainMap: always show "consult clinician" for pain > 7/10
6. noUncheckedIndexedAccess is on — use `arr[0] ?? fallback` not `arr[0]`

---

## Build & Deploy

```bash
cd /Users/devkapilicloud.com/Desktop/physiocore-ai
pnpm build          # full monorepo — must be clean before deploy
vercel --prod       # deploy from root (NOT from packages/app)
```

**Vercel note:** Run `vercel --prod` from the repo root, not from `packages/app` (that fails with npm install error).
