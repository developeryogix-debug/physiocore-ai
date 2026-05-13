# PhysioCore AI — Global Vision & Architecture
**Last updated:** 13 May 2026  
**Owner:** Dev Kapil (devkapiltech@gmail.com)  
**Status:** Active development — Phase 1 starting

---

## What We Are Building

PhysioCore AI is a regulated, evidence-based AI physiotherapy platform combining:
- Real-time pose estimation (MediaPipe + ViTPose)
- Multi-agent clinical assessment swarm
- AI physiotherapist voice agent
- FHIR R4 clinical data export
- Multi-tenant B2B/B2B2C/B2C business model

**Regulatory classification:** Software as a Medical Device (SaMD) Class II  
**Markets:** Singapore (HSA), India (CDSCO), Global (MDR/FDA pathway)  
**Every clinical claim must cite a primary source. No hallucination permitted.**

---

## Current Live System (as of May 2026)

**Live URL:** https://app-dteam1-mmcv.vercel.app  
**GitHub:** https://github.com/developeryogix-debug/physiocore-ai  
**Supabase:** qbrrugglfdwcapqrnahw (Singapore region)

### What is built and deployed:
- Authentication (Supabase Auth, Google OAuth, magic link)
- Multi-tenant organisation system (Super Admin / Org Admin / Clinician / Patient)
- 4 organisations: Doctor On Click (clinic), progressive (wellness_retreat), devyogastudio (yoga_studio), dpw (gym)
- Live pose detection (MediaPipe, front + side view, 33 landmarks)
- Exercise modes: Gym (8 exercises), Yoga (4 poses), Pilates (6 exercises)
- Rep counting with hysteresis, hold timer, mobile-optimised
- Post-session AI feedback (Claude Haiku — injury-aware, XAI grade)
- Session report PDF + FHIR R4 bundle export
- Dashboard (8 panels: health score, pain map, biometrics, heatmap, radar)
- History, Outcomes (PSFS/NPRS/GROC/PHQ-4), Settings, Trainer chat
- Nutrition page (TDEE, supplement Grade A-D, web search)
- Clinician mode (SOAP notes, CPT codes, FHIR R4, HEP generator)
- Behavior/retention engine (churn prediction, habit stacking)
- Monitoring agents (HealthCheck, Diagnose, Alert via Resend, WeeklyReport, CostWatch)
- Clinical Noir design system (teal #00D4AA, dark navy #080D14)

### Known pending fixes:
- Invite Admin clipboard display (fix committed, deploying)
- Bundle size 2.1MB needs code splitting
- Design fixes (12px font floor, pill buttons, weight 600 ceiling)

---

## Phase 1 — Clinical Knowledge Foundation (Current)

**Goal:** Build the evidence-based knowledge graph before any clinical agent

### 1a. Joint Assessment Database
For 12 joints (shoulder, elbow, wrist, hip, knee, ankle, cervical, thoracic, lumbar, SI, TMJ, foot):
- Normal ROM values with citations (Maitland, Cyriax, McKenzie, Mulligan)
- Special orthopaedic tests (name, procedure, sensitivity, specificity)
- Common pathologies + ICD-10 codes
- Red flags requiring immediate referral
- CPT billing codes for treatments

### 1b. Exercise Library Schema (TypeScript)
Extends current ExerciseDefinition with:
- primaryMuscles / secondaryMuscles (Latin names)
- jointActions, contraindications
- progressions / regressions
- evidenceGrade A/B/C/D + primaryReference (citation)
- videoSearchTerms (for HeyGen demos)
- icdCodes / cptCodes

### 1c. Safety Rules Engine
12 absolute red flags — hard-coded, NO agent can override:
Cauda equina, cord compression, AAI, AAA, cancer red flags,
fracture, DVT, stroke, meningitis, acute cardiac, safeguarding

### 1d. Posture Analysis System (Priority build)
See POSTURE_SYSTEM.md for full specification.

---

## Phase 2 — Assessment Agent Swarm (Months 2-4)

MiroFish competitive debate pattern implemented with Claude API:

| Agent | Role | Model |
|---|---|---|
| PostureAgent | Plumb line, segmental alignment, scoliosis screen | Claude Sonnet + ViTPose |
| GaitAgent | Cadence, stride, Trendelenburg, antalgic patterns | Claude Sonnet + slow-motion video |
| ROMAgent | All joint ROM vs normatives, asymmetry flagging | Claude Sonnet + MediaPipe |
| SpecialTestsAgent | Guides clinician through Lachman, SLRT, Hawkins etc | Claude Sonnet |
| PainMapAgent | VAS/NRS, dermatomal vs referred vs local | Claude Haiku |
| FunctionalAgent | PSFS, Berg Balance, TUG, 30s Chair Stand | Claude Haiku |
| AdversarialAgent | Red team — finds flaws in all other agents | Claude Opus |
| ConsensusAgent | Synthesises to ranked differential + confidence | Claude Sonnet |

### Agent Communication Protocol
- Google A2A (Agent-to-Agent) protocol for inter-agent messaging
- Each agent outputs structured JSON with: finding, confidence, evidence_grade, citation
- SafetyRuleEngine runs BEFORE any output reaches patient/clinician
- All agent outputs stored in Supabase with full audit trail

---

## Phase 3 — Treatment Planning Swarm (Months 3-5)

Competing planning agents:
- ConservativeAgent: pain-free movement, slow loading, tissue healing
- EarlyMobAgent: graded loading, neuroplasticity, progressive challenge
- ProgressionAgent: weekly adjustment based on session outcomes
- PrescriptionAgent: final FHIR CarePlan output with CPT codes

---

## Phase 4 — Multimodal Clinical Interface (Months 4-7)

### Voice Physiotherapist Agent
- Model: Cartesia Sonic (50ms latency) or ElevenLabs
- STT: Deepgram Nova-3 (medical vocabulary)
- Speaks during exercise: real-time corrections, encouragement
- Consultation mode: takes history, asks clinical questions

### Video Demonstration Agent
- HeyGen avatar demonstrates each exercise before patient does it
- Synced to prescription — patient sees correct technique first
- Language options: English, Hindi, Mandarin, Tamil

### Breathing & Relaxation System
| Pattern | Frequency | Hz | Animation | Evidence |
|---|---|---|---|---|
| Resonance | 5-6 breaths/min | 432Hz | Sine expansion | Lehrer 2000 — HRV max |
| Box breathing | 4-4-4-4s | 528Hz | Square pulse | Navy SEALs protocol |
| 4-7-8 | 19s cycle | 396Hz | Expanding circle | Weil — parasympathetic |
| Physiological sigh | 2 inhale + exhale | 174Hz | Double pulse | Huberman 2023 |

Natural sounds: rain, waves, waterfall at 40-60dB with brown noise base.

### Biometric Integration
- Apple Watch / Garmin: HRV, HR, SpO2 via HealthKit/Health Connect API
- ECG: Apple Watch Series 4+ 
- EEG: Muse headband API (Phase 5)
- Blood tests / MRI / X-ray: upload → Med-Gemini analysis → clinician review

---

## Phase 5 — World Model + Digital Twin (Months 8-12)

### V-JEPA Integration (Meta)
- Trains on patient's own movement video
- Builds internal world model of their body mechanics
- Detects compensations invisible to standard pose estimation
- Predicts injury risk before pain occurs

### Digital Human Clone
- 3D avatar built from patient measurements + movement data
- Side-by-side correct vs incorrect technique visualisation
- Motivation + education tool

### Mobile App
- React Native (extends existing YogaFlow Pro codebase)
- All webapp features + biometric APIs + offline mode
- PWA first (this month), native app Month 6

---

## Model Stack

| Function | Model | Justification |
|---|---|---|
| Clinical reasoning | Claude Sonnet 4 (claude-sonnet-4-20250514) | Best medical reasoning, tool use, FHIR |
| Quick/voice responses | Claude Haiku 4.5 | 50ms, cheap, sufficient for cues |
| Deep analysis | Claude Opus 4.6 | Complex differential diagnosis |
| Pose estimation | MediaPipe + ViTPose | Speed + clinical accuracy fusion |
| Medical imaging | Med-Gemini | Only model with FDA-cleared pathway |
| Voice output | Cartesia Sonic | 50ms, clinical tone |
| Voice input (STT) | Deepgram Nova-3 | Best medical vocabulary |
| Exercise video | HeyGen Avatar | Most realistic demos |
| Medical knowledge | PubMed API + Cochrane | Primary sources |
| Chinese medical | Huatuo-GPT (HuggingFace) | Best open-source Chinese medical LLM |
| Movement world model | V-JEPA (Meta) | Video movement understanding |
| Swarm orchestration | Claude API + Google A2A | Production-ready agent protocol |

---

## Business Model

### B2B (Organisation pays)
- Clinics: $99-$899/month based on patient volume
- Gyms/Studios: $49/month flat or $3/active member
- Wellness retreats: $8/guest/stay

### B2B2C (Organisation pays + user can upgrade)
- Corporate wellness: $5/employee/month
- Insurance/health plan: per-engaged-member model (Hinge Health pattern)
- Clinician referral → patient continues on personal plan after discharge

### B2C (Individual pays)
- Free: 3 sessions/month
- Pro: $12/month — unlimited sessions, all features
- Yoga by One Wellness: $19/month — Sanskrit library, PHY sequences

---

## Key Files in Repository

```
CONTEXT.md          — Current build state, recent changes
CLAUDE.md           — Rules Claude must follow in this codebase
DESIGN.md           — Clinical Noir design system specification
VISION.md           — This file (long-term architecture)
POSTURE_SYSTEM.md   — Posture analysis system specification
packages/app/       — React 18 + Vite frontend
packages/agents/    — 5 AI agents (pose, feedback, nutrition, clinical, behavior)
packages/supabase/  — Database schema + migrations
api/                — Vercel serverless functions (health check, cron, email)
```

---

## Regulatory Checklist (Must complete before clinical launch)

- [ ] HSA Singapore SaMD notification
- [ ] PDPA Data Protection Officer registered  
- [ ] IRB approval for Imperial College pilot study
- [ ] Clinical validation study (minimum 20 patients, 6 weeks)
- [ ] Informed consent v2.0 (research-grade)
- [ ] Audit trail for all AI clinical recommendations
- [ ] Human clinician review requirement documented
- [ ] Incident reporting process established

---

## People & Contacts

- Dev Kapil: CTIO Doctor On Click, Honorary Research Associate Imperial College London, PHY Yoga Teacher, NUS-ISS MTech AI Systems
- Contact: devkapiltech@gmail.com / dev@live.com.sg
- GitHub: developeryogix-debug
- Vercel account: developeryogix@gmail.com

---

*This file must be updated after every major build session.*  
*Claude: read this file at the start of every session before making any changes.*
