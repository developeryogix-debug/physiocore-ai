# Wing: Frontend

The React app under `packages/app/`. This wing covers routes, components, UI state, and styling.

---

## Stack

- React 18 + TypeScript + Vite (NOT Next.js - never add `"use client"`)
- pnpm workspaces monorepo (9 packages)
- Tailwind CSS + shadcn/ui
- Recharts for charts
- MediaPipe Pose Landmarker (via CDN/WASM)

## Routes built

| Route | Purpose | Notes |
|---|---|---|
| `/` | Landing page | Competitor comparison vs 298 startups |
| `/login` | Auth | Email/password, Google OAuth, magic link |
| `/onboard` | 5-step wizard | Old light theme - needs Clinical Noir restyle |
| `/dashboard` | Health dashboard | Basic; 8-panel upgrade pending |
| `/session` | Live pose | MediaPipe, rep counting, AI feedback |
| `/gym` | Workout programs | Beginner/PPL/Physio |
| `/nutrition` | TDEE + supplements | Mifflin-St Jeor, Grade A-D evidence |
| `/assessment` | Clinical assessment | - |
| `/clinician` | SOAP/FHIR/churn | CPT 97110/97530/97150 |
| `/behavior` | Retention engine | Tiny Habits, adaptive nudges |
| `/history` | 52-week heatmap | Timeline, trends, personal bests |
| `/outcomes` | RCT-ready scales | PSFS, NPRS, GROC, PHQ-4 |
| `/settings` | Profile + biometrics | PDPA export/delete |
| `/trainer` | Streaming AI chat | Voice in/out, PDF export |

## Design system - Clinical Noir

Dark luxury medical aesthetic. CSS vars in `packages/app/src/index.css`.

Key tokens:
- `--bg-void: #050810`
- `--bg-surface: #0D1420`
- `--teal-500: #00D4AA` (primary accent)
- `--blue-400: #4DB8FF` (secondary)
- `--text-primary: #F0F4FF`
- `--text-secondary: #8892A4`

Typography: Syne (display) - Figtree (body) - Space Mono (data) - Noto Serif (yoga)

Navigation: floating pill, `position: fixed`, `top: 1.25rem`, `backdrop-blur(20px)`. All pages need `padding-top: 100px` to clear nav.

## Auth flow

```
App load -> AuthProvider (useAuth) -> UserProfileProvider (useUserProfile)
ProtectedRoute:
  isLoading -> spinner
  !user -> /login
  !hasConsented -> ConsentScreen
  !onboardingDone -> /onboard
  -> render page
```

Supabase always authoritative on login (useUserProfile.tsx init()) - profile is never lost after sign-out.

## Known frontend issues

- Onboard page still uses old light theme - Clinical Noir restyle is the next-priority redesign
- Dashboard still shows some mock data in the 8 panels; streak/adherence use real localStorage calc
- Hero headline on landing page sometimes appears cut off due to CSS color
