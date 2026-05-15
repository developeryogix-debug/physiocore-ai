# Wing: AI Agents

Five specialist agents plus an orchestrator. All live under `packages/agents/` and `packages/orchestrator/`.

---

## Roster

| Agent | Package | Model | Tokens | What it does |
|---|---|---|---|---|
| Pose | `@physiocore/pose-agent` | n/a (MediaPipe) | n/a | Front + side view pose detection; 24 landmarks at 0.55 confidence threshold |
| Feedback | `@physiocore/feedback-agent` | claude-haiku-4-5-20251001 | 900 | Post-session report with rep-by-rep breakdown; JSON fallback if parse fails |
| Nutrition | `@physiocore/nutrition-agent` | claude-sonnet-4-20250514 | 2048 | TDEE (Mifflin-St Jeor), macro targets, supplement grading |
| Clinical | `@physiocore/clinical-agent` | claude-sonnet-4-20250514 | 2048 | SOAP notes, FHIR R4 Bundle, CPT codes |
| Behavior | `@physiocore/behavior-agent` | claude-sonnet-4-20250514 | 2048 | Retention engine, churn risk, Tiny Habits nudges |

Plus:
- **Chat (in-app trainer):** claude-sonnet-4-20250514, streaming, see `AiChatPanel`
- **Monitor/Diagnose:** claude-haiku-4-5-20251001, 300 tokens, see `api/_lib/claude.ts`

## Why these model choices

- Haiku for high-frequency / low-cost flows (feedback, monitoring) - users may run multiple sessions/day; we cap at 900 tokens and use JSON fallback to avoid rate-limit 429s.
- Sonnet 4 for reasoning-heavy flows (nutrition advice, clinical SOAP, behavior modelling) where output quality matters more than cost.
- Opus is NOT used. Watch out: `claude-opus-4-7` was an early wrong choice; fixed to sonnet-4-20250514.

## Session loop (high level)

1. MediaPipe `pose-agent` reads landmarks frame-by-frame
2. Rep counter applies hysteresis (6 deg gym), hold thresholds (5s yoga, 0.8s pilates), and an 8-sec startup dead zone
3. Angle sanity filter discards noise (e.g. squat < 60 deg)
4. On `stopSession`, we hand a structured rep array to `feedback-agent`
5. `feedback-agent` returns rep-by-rep grading + next-session prescription
6. Optional: `clinical-agent` generates SOAP + FHIR Bundle for export

## Browser-safe client layer

Node-only Anthropic SDK fails in the browser. We use a lightweight client at `packages/app/src/lib/agents/anthropicClient.ts` plus per-agent wrappers (`feedbackClient.ts`, `nutritionClient.ts`, etc.). Server-side calls use `api/_lib/claude.ts` and read `process.env`.
