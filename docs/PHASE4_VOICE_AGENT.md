# Phase 4 — Voice Physiotherapist Agent
**Status:** Design complete — ready for implementation  
**Target:** Months 4–7  
**SaMD Class II:** All voice clinical output requires audit trail + human review pathway

---

## 1. Architecture Overview

```
Patient Mic
    │
    ▼
LiveKit Room (WebRTC)         ◄──── Agent Participant (server-side Node.js)
    │                                        │
    ▼                                        │
Deepgram Nova-3 (STT)                        │
Medical vocabulary, real-time streaming      │
    │                                        │
    ▼                                        │
Intent Classifier (Claude Haiku)             │
    │                                        │
    ├── EXERCISE_CUE ─────────────────────── │ ──► Cartesia TTS → Speaker
    ├── REP_FEEDBACK ─────────────────────── │ ──► Cartesia TTS → Speaker
    ├── CLINICAL_QUERY ──► Claude Sonnet ─── │ ──► Cartesia TTS → Speaker
    ├── SESSION_CONTROL ──► State update ─── │
    └── RED_FLAG ──────────► SafetyEngine ── │ ──► Cartesia TTS + UI alert
              ▲
              │
    Session.tsx PoseContext (live feed)
    angleSmoothed, repCount, formScore, holdState, viewMode
```

### Stack

| Layer | Technology | Justification |
|---|---|---|
| Transport | LiveKit Cloud (WebRTC) | Sub-50ms audio, server-side agent participant |
| STT | Deepgram Nova-3 | Medical vocabulary model, streaming, $0.0043/min |
| NLP | Claude Haiku 4.5 | Intent parse + exercise cue generation, ~50ms |
| Clinical Q&A | Claude Sonnet 4 | History taking, clinical questions only |
| TTS | Cartesia Sonic | 50ms TTFB, British English, "Helpful Woman" voice |
| Logging | Supabase `voice_sessions` + `voice_turns` | Full transcript audit trail |

---

## 2. Integration with Session.tsx

### 2.1 PoseContext (new shared store)

Create `packages/app/src/lib/PoseContext.ts`:

```typescript
export interface PoseContextState {
  currentExercise:  string;          // ExerciseKey
  angleSmoothed:    number;          // degrees, EMA filtered
  angleHistory:     number[];        // last 20 frames
  repCount:         number;
  holdState:        boolean;
  holdSeconds:      number;
  formScore:        number | null;   // 0–100, null until first AI feedback
  viewMode:         'front' | 'side-right' | 'side-left' | 'lost';
  targetRange:      [number, number]; // [min, max] for current exercise
  sessionActive:    boolean;
}
```

Session.tsx emits updates via `window.dispatchEvent(new CustomEvent('pose-update', { detail: state }))` — avoids prop drilling into unrelated components.

VoiceAgent listens via `addEventListener('pose-update', handler)`.

### 2.2 Trigger Logic (client-side, no LLM)

| Event | Trigger Condition | Voice Response Type |
|---|---|---|
| Form degradation | `angleSmoothed` outside `targetRange` for ≥3 consecutive frames | `EXERCISE_CUE` |
| Rep completed | `repCount` increments | `REP_FEEDBACK` (every 5th rep, or on request) |
| Hold threshold | `holdState === true && holdSeconds > 2` | Encouragement cue |
| View lost | `viewMode === 'lost'` for >2s | Positioning instruction |
| Session end | `sessionActive` becomes false | Summary prompt |

Cue generation uses Haiku — not Sonnet — to keep latency under 200ms total (STT→NLP→TTS).

---

## 3. Voice Activation Modes

### 3.1 Exercise Mode — Push-to-Talk (PTT)

- **Why:** Background noise (gym, breathing, movement) triggers false VAD positives
- **UI:** Persistent microphone button on Session.tsx overlay, bottom-center
- **Held:** records; released: sends to Deepgram
- **Always-on** (no PTT): proactive physiotherapist cues from pose data — these flow from server → patient (unidirectional), never need PTT
- **Patient PTT use cases:** "How many reps left?", "Slower?", "Stop"

### 3.2 Consultation Mode — Auto VAD

- **Activated** from `/trainer` page or post-session history-taking
- **VAD:** Deepgram `endpointing: 1500ms` (1.5 second silence → end of utterance)
- **Turn management:** Server holds TTS while patient is speaking (half-duplex default; LiveKit enables full-duplex if needed)
- **Session types:**
  - **History taking:** structured SOAP S intake via voice
  - **Pain check-in:** "Where does it hurt? Rate 0–10"
  - **Prescription review:** "Tell me about your week 2 exercises"

---

## 4. Cartesia Voice Configuration

### 4.1 Voice Profile: "Helpful Woman"

```typescript
const CARTESIA_CONFIG = {
  model_id:  'sonic-2',           // Cartesia Sonic-2 (50ms TTFB)
  voice: {
    mode:    'id',
    id:      'a0e99841-438c-4a64-b679-ae501e7d6091',  // "Helpful Woman" — Cartesia voice library
  },
  output_format: {
    container:   'raw',
    encoding:    'pcm_f32le',
    sample_rate:  22050,
  },
  language: 'en',
};
```

**Tone modifiers** (injected via system prompt to Haiku before TTS):
- **Exercise cues:** directive, calm, encouraging — "Good. Lower your hips slightly. Keep breathing."
- **Clinical consultation:** warm, measured, precise — "I understand. Can you tell me more about when the pain started?"
- **Red flag:** clear, firm, urgent — "Please stop exercising now. Seek immediate medical attention if..."

### 4.2 SSML Pacing

Cartesia Sonic supports SSML. Use for:
- `<break time="0.3s"/>` between exercise cue sentences
- `<emphasis level="strong">stop</emphasis>` for red flags
- `<prosody rate="slow">` for post-session summaries

---

## 5. Cost Model

### Per-session (30 min)

| Service | Rate | Volume | Cost |
|---|---|---|---|
| Deepgram Nova-3 STT | $0.0043/min | 30 min patient mic | $0.129 |
| Cartesia Sonic TTS | $0.08/1K chars | ~750 chars agent speech | $0.060 |
| LiveKit Cloud | $0.001/min/participant × 2 | 30 min × 2 | $0.060 |
| Claude Haiku (NLP) | $0.0008/1K tok input | ~10 turns × 200 tok | $0.002 |
| **Total** | | | **~$0.25/session** |

> Note: Cartesia chars assume ~750 words physiotherapist speech per session (light coaching).
> Active coaching (continuous cues) ≈ 3000 chars → $0.24 Cartesia alone → total $0.44/session.

### Pricing pass-through

- Include in **Pro** plan ($12/month): up to 20 voice sessions/month → breakeven at ~10 sessions
- **Clinical** plan: unlimited (cost absorbed in $99+/month B2B margin)
- Consultation mode (Sonnet calls): add ~$0.02/session — negligible

---

## 6. Regulatory & Safety

### 6.1 Classification

Voice coaching during exercise + answering clinical questions = **SaMD Class II** (Singapore HSA, EU MDR Annex VIII Rule 11).

Rationale: software influences clinical management decisions via voice (advice to modify exercise, pain escalation detection, referral recommendations).

### 6.2 Mandatory Disclaimer

**Before every voice session** — displayed on screen AND spoken by Cartesia TTS:

> "PhysioCore AI voice coaching supports your exercise programme. It is not a substitute for clinical assessment by a registered physiotherapist. Stop immediately if you experience severe pain, chest tightness, dizziness, or difficulty breathing, and seek medical attention."

- Cannot be dismissed in under 5 seconds (enforced by UI timer)
- Spoken version: full text, cannot be skipped
- Consent logged to Supabase `voice_consents` table with timestamp + session_id

### 6.3 Audit Trail

Every voice turn logged to Supabase:

```sql
-- voice_sessions
id uuid, user_id uuid, session_id uuid, mode text, started_at timestamptz, ended_at timestamptz, total_turns int, disclaimer_acknowledged bool

-- voice_turns
id uuid, voice_session_id uuid, role text ('agent'|'patient'), transcript text, intent text, model_used text, latency_ms int, flagged bool, created_at timestamptz
```

### 6.4 Red Flag Hard Stops

SafetyRuleEngine intercepts voice NLP output. Any of the 12 APA red flags detected in patient speech → immediate:
1. Voice agent says: "This sounds serious. Please stop exercising and contact your doctor or emergency services immediately."
2. UI shows red alert banner
3. `flagged: true` in `voice_turns`
4. Email alert to linked clinician (if org mode)

Red flags in patient speech (detected by Haiku in every turn):
- Chest pain / tightness / palpitations
- Sudden severe headache ("thunderclap")
- Loss of bowel/bladder control
- Saddle anaesthesia (cauda equina)
- Bilateral leg weakness
- Fever + neck stiffness

### 6.5 Human Clinician Override

In B2B/org mode: clinician can listen live or review transcript within 24h. Voice sessions surfaced in `/clinician` patient timeline. Flagged turns require clinician acknowledgement before patient can resume voice sessions.

---

## 7. File Structure

```
packages/app/src/
├── lib/
│   ├── PoseContext.ts            NEW — shared live pose state
│   ├── agents/
│   │   └── voiceAgent.ts         NEW — Haiku intent classifier + cue generator
│   └── cartesia.ts               NEW — Cartesia API wrapper (TTS)
├── components/
│   ├── VoiceSessionButton.tsx    NEW — PTT button for Session.tsx overlay
│   └── VoiceConsultPanel.tsx     NEW — auto-VAD consultation panel (/trainer)
└── pages/
    └── Session.tsx               EDIT — emit PoseContext events, mount VoiceSessionButton

packages/agents/assessment/src/
└── voice/
    └── VoiceIntentAgent.ts       NEW — server-side intent parser (Node.js, Haiku)
                                         used by Vercel serverless function

api/
└── voice-session.ts             NEW — Vercel serverless endpoint
                                        LiveKit token generator + Deepgram proxy
```

---

## 8. Implementation Sequence

| Step | Task | Complexity |
|---|---|---|
| 1 | Supabase migrations: `voice_sessions`, `voice_turns`, `voice_consents` | Low |
| 2 | `PoseContext.ts` event emitter in Session.tsx | Low |
| 3 | `api/voice-session.ts` — LiveKit token + Deepgram proxy | Medium |
| 4 | `voiceAgent.ts` — Haiku intent classifier, cue templates | Medium |
| 5 | `cartesia.ts` — TTS wrapper, SSML builder | Low |
| 6 | `VoiceSessionButton.tsx` — PTT UI, disclaimer gate | Medium |
| 7 | `VoiceConsultPanel.tsx` — VAD auto mode for /trainer | Medium |
| 8 | SafetyRuleEngine hook into voice NLP output | High |
| 9 | Clinician audit view in /clinician | Low |

---

## 9. Open Questions (Resolve Before Implementation)

1. **LiveKit vs Daily.co:** LiveKit has native agent SDK (`@livekit/agents`) with Deepgram + Cartesia plugins pre-built. Daily.co also viable but less agent-native. **Recommend: LiveKit.**
2. **Cartesia voice ID:** "Helpful Woman" ID `a0e99841-...` — confirm in Cartesia voice library before hardcoding.
3. **Deepgram medical model:** `nova-3-medical` is a separate model endpoint — confirm pricing matches $0.0043/min.
4. **LiveKit vs pure WebSocket:** For MVP, direct Deepgram WebSocket + Cartesia HTTP might suffice without LiveKit overhead. LiveKit adds ~$0.06/session. Decision: LiveKit for scalability; bare WebSocket for MVP cost.
5. **IRB consent:** Voice recording during exercise raises additional consent requirements for Imperial College study. Add explicit voice data consent to IRB application.

---

## 10. References

- LiveKit Agents SDK: https://docs.livekit.io/agents/
- Deepgram Nova-3 medical: https://developers.deepgram.com/docs/models-overview
- Cartesia Sonic API: https://docs.cartesia.ai/
- HSA SaMD guidance (Singapore): https://www.hsa.gov.sg/medical-devices/overview
- Wearable + Voice SaMD precedent: Cala Health kIQ — FDA 510(k) K211038
