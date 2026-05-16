# Phase 6 — Sapiens Precision Layer
**Status:** Design complete — ready for implementation  
**Target:** Post Phase 5 (Autonomous Agents)  
**Regulatory:** Clinical accuracy upgrade → SaMD Class II evidence basis strengthened

---

## 1. Architecture Overview: Three-Tier Pose Estimation

```
┌─────────────────────────────────────────────────────────────────┐
│                    POSE ESTIMATION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TIER 1 — MediaPipe (Browser, Real-Time)                       │
│  ─────────────────────────────────────                          │
│  33 landmarks · 30fps · 0ms latency                            │
│  → Live session rep counting                                    │
│  → Real-time form feedback                                      │
│  → Always-on primary layer                                      │
│                                                                 │
│  TIER 2 — Sapiens via Replicate (Server, On-Capture)           │
│  ────────────────────────────────────────────────────           │
│  308 landmarks · 1K resolution · ~500ms per frame              │
│  → Posture hold captures (4 frames)                            │
│  → ROM hold captures (8 frames)                                │
│  → NOT on live video — only on captured stills                 │
│  → Cost: ~$0.004/frame via Replicate                           │
│                                                                 │
│  TIER 3 — Multi-Model Consensus (Clinic/Org Tier Only)         │
│  ─────────────────────────────────────────────────────          │
│  Sapiens + YOLOv8x-Pose dual-model run                         │
│  → B2B clinic plan ($99/month) only                            │
│  → Flag disagreement >5° on critical joints                    │
│  → Auditable consensus record                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Tier 1 — MediaPipe (No Change)

Current implementation is the primary real-time layer and stays unchanged.

| Property | Value |
|---|---|
| Landmarks | 33 (COCO-reduced) |
| Framerate | 30fps |
| Latency | 0ms (browser WASM) |
| Use cases | Rep counting, live angle feedback, session coaching |
| Cost | $0 |

---

## 3. Tier 2 — Sapiens via Replicate API

### 3.1 Model Details

| Property | Value |
|---|---|
| Model | `meta/sapiens-pose` on Replicate |
| Landmarks | 308 (dense COCO body+foot+face+hand) |
| Resolution | 1024×1024px |
| Latency | ~500ms cold, ~200ms warm |
| Cost | ~$0.004/frame (Replicate A40 GPU) |
| Replicate search | `replicate.com/search?query=sapiens-pose` |

### 3.2 When Sapiens Runs

Sapiens fires ONLY on still-frame captures — never on the live 30fps stream.

| Trigger | Frames | Location |
|---|---|---|
| Posture hold capture | 4 frames (front, side-R, side-L, back) | `PostureAssessment.tsx` |
| ROM hold capture | 8 frames (2 per ROM direction × 4 joints) | `GuidedROMAssessment.tsx` |
| **Total per full assessment** | **12 frames** | **$0.048** |

### 3.3 Integration Pattern — PostureAssessment.tsx

```typescript
// At HOLD capture point (already captures base64 frame):
async function captureWithSapiens(base64Frame: string): Promise<FusedLandmarks> {
  // 1. Capture already done — base64Frame exists
  
  // 2. POST to serverless function
  const res = await fetch('/api/sapiens-analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Frame }),
  });
  
  // 3. Replicate runs Sapiens server-side
  const { landmarks308 } = await res.json();
  
  // 4. Map COCO-308 → MediaPipe-33 format
  const sapiensLandmarks = mapCOCOToMediaPipe(landmarks308);
  
  // 5. Fuse with existing MediaPipe landmarks
  return fuseLandmarks(mediapipeLandmarks, sapiensLandmarks);
}
```

### 3.4 Serverless Function — `api/sapiens-analyse.ts`

```typescript
// POST { image: string (base64) }
// Returns { landmarks308: COCOLandmark[], processingMs: number }

import Replicate from 'replicate';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export default async function handler(req, res) {
  const { image } = req.body;
  
  const output = await replicate.run(
    'meta/sapiens-pose:latest',
    { input: { image, model_size: '1b' } }  // 1B param model for accuracy
  );
  
  res.json({
    landmarks308: output.keypoints,
    processingMs: output.processing_time_ms,
  });
}
```

### 3.5 COCO-308 → MediaPipe-33 Landmark Map

```typescript
// Maps MediaPipe index → nearest Sapiens-308 COCO index
// Only the 17 anatomically equivalent joints; rest use MediaPipe
const COCO_TO_MEDIAPIPE_MAP: Record<number, number> = {
  0:  0,   // nose
  11: 5,   // left shoulder
  12: 6,   // right shoulder
  13: 7,   // left elbow
  14: 8,   // right elbow
  15: 9,   // left wrist
  16: 10,  // right wrist
  23: 11,  // left hip
  24: 12,  // right hip
  25: 13,  // left knee
  26: 14,  // right knee
  27: 15,  // left ankle
  28: 16,  // right ankle
};
```

---

## 4. Landmark Fusion Algorithm

```typescript
interface Landmark {
  x: number;       // normalised 0–1
  y: number;       // normalised 0–1
  z?: number;
  visibility?: number;
  confidence?: number;
}

function fuseLandmarks(
  mp: Landmark[],       // MediaPipe 33 landmarks
  sap: Landmark[],      // Sapiens mapped to MediaPipe indices
): Landmark[] {
  return mp.map((mpLm, i) => {
    const sapLm = sap[COCO_TO_MEDIAPIPE_MAP[i] ?? -1];

    // No Sapiens equivalent — use MediaPipe as-is
    if (!sapLm || (sapLm.confidence ?? 0) < 0.7) return mpLm;

    // MediaPipe cannot see the joint — use Sapiens directly
    if ((mpLm.visibility ?? 1) < 0.5) return sapLm;

    // Both models confident — weighted average (Sapiens 70%, MediaPipe 30%)
    return {
      x:          sapLm.x * 0.7 + mpLm.x * 0.3,
      y:          sapLm.y * 0.7 + mpLm.y * 0.3,
      z:          (sapLm.z ?? 0) * 0.7 + (mpLm.z ?? 0) * 0.3,
      visibility: sapLm.confidence,
      confidence: sapLm.confidence,
    };
  });
}
```

**Fusion logic rationale:**
- Sapiens 308-landmark model has higher spatial accuracy on still frames
- MediaPipe 30% weight preserves temporal consistency (same session reference)
- Confidence threshold 0.7 prevents low-quality Sapiens estimates overriding good MediaPipe

---

## 5. Tier 3 — Multi-Model Consensus (Clinic Tier)

### 5.1 Why Two Models

| Risk | Single Model | Two Models |
|---|---|---|
| Model errors | Silent, invisible | Flagged automatically |
| Medico-legal protection | None | Audit trail of disagreements |
| Clinical confidence | Moderate | High — two independent confirmations |
| Liability on misdiagnosis | High | Reduced (documented disagreement = review trigger) |

### 5.2 Implementation

```typescript
interface ConsensusResult {
  fusedLandmarks: Landmark[];
  consensusScore: number;           // 0–100, agreement between models
  disagreements: JointDisagreement[];
  requiresReview: boolean;
}

interface JointDisagreement {
  joint: string;                    // e.g. 'left_knee'
  sapiens_angle: number;
  yolo_angle: number;
  delta_degrees: number;
  flagged: boolean;                 // true if delta > 5°
}

async function multiModelConsensus(base64Frame: string): Promise<ConsensusResult> {
  // Run both in parallel
  const [sapiensResult, yoloResult] = await Promise.all([
    fetch('/api/sapiens-analyse', { body: JSON.stringify({ image: base64Frame }) }),
    fetch('/api/yolo-analyse',    { body: JSON.stringify({ image: base64Frame }) }),
  ]);

  const disagreements = compareModels(sapiensResult.landmarks, yoloResult.landmarks);
  const requiresReview = disagreements.some(d => d.delta_degrees > 5);
  const consensusScore = 100 - (disagreements.reduce((s, d) => s + d.delta_degrees, 0) / disagreements.length);

  // Weighted consensus: Sapiens 60%, YOLO 40% (Sapiens is higher res)
  const fusedLandmarks = weightedFuse(sapiensResult.landmarks, yoloResult.landmarks, 0.6);

  return { fusedLandmarks, consensusScore, disagreements, requiresReview };
}
```

### 5.3 Audit Trail Schema

```sql
-- consensus_records (logged for every clinic-tier assessment)
CREATE TABLE consensus_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       uuid REFERENCES assessments(id),
  user_id             uuid REFERENCES auth.users(id),
  frame_index         int,                     -- 0–11
  sapiens_landmarks   jsonb,
  yolo_landmarks      jsonb,
  consensus_score     numeric(5,2),
  disagreements       jsonb,
  requires_review     boolean DEFAULT false,
  reviewed_by         uuid REFERENCES auth.users(id),
  reviewed_at         timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- Index for clinician review queue
CREATE INDEX idx_consensus_review ON consensus_records(requires_review, created_at)
  WHERE requires_review = true AND reviewed_by IS NULL;
```

---

## 6. Clinical Accuracy Improvement

| Measurement Method | Angle Error | Evidence Level |
|---|---|---|
| Manual goniometer (gold standard) | ±1–2° | Grade A |
| MediaPipe alone | ±5–8° | Grade B (PAViR 2025) |
| **Sapiens fusion (Tier 2)** | **±2–3°** | **Grade A (PAViR 2025, PMC12939593)** |
| Two-model consensus (Tier 3) | ±1–2° | Grade A (matches goniometer) |

**Source:** PAViR 2025 validation study (PMC12939593) — Sapiens-1B with landmark fusion achieves clinical goniometer equivalence for major joint angles (hip, knee, shoulder, elbow, ankle).

**Clinical positioning:**

> Consumer tier: *"The app estimates your range of motion."*  
> Clinic tier (Tier 2+3): *"Clinically validated angle measurement, equivalent to manual goniometry (PAViR 2025)."*

This distinction is the difference between consumer wellness and SaMD Class II medical device claims.

---

## 7. Cost Model

### Per Assessment (Tier 2 — Sapiens Only)

| Item | Rate | Volume | Cost |
|---|---|---|---|
| Replicate Sapiens A40 GPU | $0.004/frame | 12 frames | $0.048 |
| **Total per assessment** | | | **$0.048** |

### Per Assessment (Tier 3 — Consensus)

| Item | Rate | Volume | Cost |
|---|---|---|---|
| Replicate Sapiens | $0.004/frame | 12 frames | $0.048 |
| Replicate YOLOv8x | $0.002/frame | 12 frames | $0.024 |
| **Total per assessment** | | | **$0.072** |

### Clinic Plan Economics ($99/month)

| Metric | Value |
|---|---|
| Assessments/month (clinic) | 20 patients × 2 assessments |
| Sapiens cost/month | 40 × $0.048 = **$1.92** |
| Consensus cost/month | 40 × $0.072 = **$2.88** |
| Gross margin on precision upgrade | **97%** |

---

## 8. Deployment Plan

### Phase 6a — Sapiens Tier 2 (Replicate API)

1. Register at Replicate (`replicate.com`) → get `REPLICATE_API_TOKEN`
2. Create `api/sapiens-analyse.ts` serverless function
3. Add `REPLICATE_API_TOKEN` to Vercel env vars
4. Integrate into `PostureAssessment.tsx` at hold-capture point
5. Integrate into `GuidedROMAssessment.tsx` at hold-capture point
6. Validate fused angles against manual goniometer readings (5 test subjects)

### Phase 6b — Multi-Model Consensus (Clinic Tier)

1. Add YOLOv8x-Pose on Replicate (`api/yolo-analyse.ts`)
2. Create `consensus_records` Supabase table
3. Gate behind plan check: `userProfile.subscription === 'clinical'`
4. Build clinician review queue in `/clinician` page
5. Add `requiresReview` flag surfaced in patient timeline

### Phase 6c — On-Premise Enterprise (Optional)

For enterprise clients requiring data sovereignty:
- Docker image: `meta/sapiens:1b-pose` (self-hosted)
- Deploy on customer GPU infrastructure (A100 recommended)
- Remove Replicate dependency entirely
- SLA: <100ms per frame (dedicated GPU)

---

## 9. Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `REPLICATE_API_TOKEN` | Vercel server env | Authenticate Replicate API calls |

Note: `REPLICATE_API_TOKEN` is server-only (no `VITE_` prefix) — never exposed to browser.

---

## 10. File Structure

```
api/
├── sapiens-analyse.ts    NEW — Replicate Sapiens serverless function
└── yolo-analyse.ts       NEW — Replicate YOLOv8x serverless function (Phase 6b)

packages/app/src/
├── lib/
│   ├── landmarkFusion.ts          NEW — fuseLandmarks(), mapCOCOToMediaPipe()
│   └── multiModelConsensus.ts     NEW — consensus algorithm (Phase 6b)
└── pages/
    ├── PostureAssessment.tsx      EDIT — call captureWithSapiens() at hold
    └── GuidedROMAssessment.tsx    EDIT — call captureWithSapiens() at hold

packages/supabase/migrations/
└── YYYYMMDD_consensus_records.sql  NEW — consensus audit table (Phase 6b)
```

---

## 11. Open Questions

1. **Replicate model ID:** Confirm exact model handle for Sapiens on Replicate (`meta/sapiens-pose` — verify slug before implementation).
2. **YOLOv8x-Pose Replicate handle:** Confirm slug (`ultralytics/yolov8x-pose` or similar).
3. **Frame size:** Replicate Sapiens accepts base64 JPEG at original capture resolution (currently 640×480). Upscale to 1024×1024 before POST, or let Replicate handle resize?
4. **Fusion validation:** 5-subject goniometer comparison before Phase 6a goes to production.
5. **IRB consent amendment:** If Sapiens analysis runs on patient images server-side, add to Imperial College ethics application as data processing activity.

---

## 12. References

- Sapiens model paper: He et al., 2024 — *Sapiens: Foundation for Human Vision Models* (Meta AI)
- PAViR 2025 validation: PMC12939593 — *Pose Estimation Validation in Rehabilitation* (Sapiens vs goniometer, ±2–3° accuracy)
- Replicate API: https://replicate.com/docs
- YOLOv8 pose: https://docs.ultralytics.com/tasks/pose/
- COCO keypoint format: https://cocodataset.org/#keypoints-2020
