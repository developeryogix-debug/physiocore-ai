# Wing: Product

Vision, competitive position, phases, what we're building and why.

---

## One-line pitch

> PhysioCore AI helps you move better, safely, with feedback you can actually understand - and a plan that grows with you.

## Tagline

**Movement. Measured. Made Personal.**

## Current phase

**Phase 1 - Clinical Knowledge Foundation.** Reads `VISION.md` and `POSTURE_SYSTEM.md` apply for any posture/assessment work.

## Competitive position vs ~298 AI physio startups

We claim to beat the field on 7 gaps. Reference for sales and roadmap framing:

1. **Explainable AI** - every recommendation shows clinical reasoning
2. **FHIR R4 EHR export** - valid R4 Bundle with Patient/Observation/Procedure
3. **Retention engine** - churn prediction, Tiny Habits, adaptive nudges
4. **Multi-view pose** - front + side with unilateral landmark fallback
5. **Clinician SOAP + CPT codes** - 97110, 97530, 97150 generated automatically
6. **Evidence nutrition** - Grade A/B/C/D badges, web_search for product names
7. **Yoga mode** - Sanskrit names, hold timer, SpeechSynthesis cues

## Documents that define product direction

- `VISION.md` (read every session)
- `CONTEXT.md` (read every session)
- `POSTURE_SYSTEM.md` (read before posture or assessment work)
- `CLAUDE.md` (build context)

## Next build priorities (from CONTEXT.md, in order)

1. Vercel <-> developeryogix-debug/physiocore-ai connection - confirm API routes work
2. Add Vercel env vars (RESEND_API_KEY, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY)
3. Onboarding dark theme (Clinical Noir restyle)
4. Dashboard 8-panel upgrade
5. Safety layer (pain check-in modal, contraindication blocks)
6. AI Trainer Chat polishing (`/trainer`)

## User-facing assets

- **User Guide PDF (live):** `PhysioCore_User_Guide_v1.2.pdf` - has all 8 onboarding/dashboard screenshots, FHIR/SOAP/CPT explainers, Grade A-D supplements, Singapore data residency, devkapiltech@gmail.com privacy contact.
- Older versions (`v1.0`, `v1.1`) are kept for diff/comparison.
