# PhysioCore AI — Posture Analysis System
**Version:** 1.0  
**Last updated:** 13 May 2026  
**Priority:** Phase 1 — Build alongside Clinical Knowledge Foundation

---

## Overview

A structured, camera-based postural assessment protocol that captures 4 cardinal views in under 5 minutes. Produces a clinical-grade posture report with grid overlay, deviation measurements, and evidence-based recommendations.

---

## Clinical Protocol — 4-View Capture Sequence

### Setup Requirements
- Distance from camera: 2.5–3 metres
- Camera height: umbilicus level (navel height)
- Background: plain, contrasting with patient's clothing
- Lighting: even, no shadows behind patient
- Clothing: fitted (not baggy) — shoulders, hips, knees visible
- Footwear: bare feet preferred, or flat shoes

### Countdown System
Each view uses an 8-second countdown with voice guidance:

```
"Stand naturally. Counting down..."
8 — 7 — 6 — 5 — (amber)
4 — 3 — 2 — 1 — (red)
"HOLD" — (green flash, capture frame)
"Perfect. Now turn to your right..."
```

### View Sequence

**View 1: ANTERIOR (Front)**
- Voice cue: "Face the camera. Feet hip-width apart. Arms relaxed by your sides. Look straight ahead."
- Capture: Single frame at 0s hold + 30-second video
- Analyses: Head tilt, shoulder height, pelvic obliquity, knee valgus/varus, foot pronation/supination

**View 2: RIGHT LATERAL (Right Side)**  
- Voice cue: "Turn to your right. I can see your right side. Stand tall."
- Capture: Single frame + 30-second video
- Analyses: Ear-shoulder-hip-knee-ankle vertical alignment, cervical lordosis, thoracic kyphosis, lumbar lordosis, knee flexion/hyperextension

**View 3: POSTERIOR (Back)**
- Voice cue: "Turn so your back faces the camera."
- Capture: Single frame + 30-second video
- Analyses: Head tilt, shoulder height asymmetry, spinal curvature (scoliosis screen), pelvic tilt, knee alignment, Achilles angle, calcaneal valgus

**View 4: LEFT LATERAL (Left Side)**
- Voice cue: "Turn to face your right. I can see your left side now."
- Capture: Single frame + 30-second video
- Analyses: Same as right lateral for comparison + asymmetry scoring

---

## Walking Analysis (Optional, 2–5 minutes)

After static posture, patient walks 5 metres away and 5 metres back × 3 cycles.

Analyses:
- Step length symmetry (left vs right)
- Cadence (steps/minute)
- Trunk sway
- Arm swing symmetry
- Head position during gait
- Heel strike / foot flat / toe-off pattern
- Trendelenburg sign (hip drop)
- Antalgic gait patterns

---

## Grid Overlay System

### Plumb Line Grid
Draw vertical reference line through:
- Anterior view: midpoint between feet → through navel → sternal notch → nose
- Lateral view: lateral malleolus → greater trochanter → acromion → ear canal

### Horizontal Reference Lines
- Eye level
- Shoulder level (acromion to acromion)
- ASIS level (anterior superior iliac spine)
- Greater trochanter level
- Knee joint line
- Ankle level

### Grid Rendering
```typescript
type GridOverlay = {
  plumbLine: {
    x: number          // normalised 0-1
    color: '#00D4AA'   // teal for neutral
    deviation: number  // degrees from true vertical
  }
  horizontalLines: HorizontalLine[]
  landmarkDots: LandmarkDot[]   // coloured by deviation severity
  deviationArrows: Arrow[]       // show direction + magnitude
  angleArcOverlays: AngleArc[]  // show measured angles
}
```

Color coding on grid:
- Green: within normal range (±2° of standard)
- Amber: minor deviation (2-5°)
- Red: significant deviation (>5°)

---

## Postural Deviation Analysis

### Sagittal Plane (Lateral views)
| Deviation | Normal | Mild | Moderate | Severe |
|---|---|---|---|---|
| Head forward posture | 0-2cm anterior | 2-4cm | 4-6cm | >6cm |
| Cervical lordosis | 20-40° | 40-50° | 50-60° | >60° |
| Thoracic kyphosis | 20-40° | 40-50° | 50-60° | >60° |
| Lumbar lordosis | 30-50° | 50-60° | 60-70° | >70° |
| Pelvic tilt | 0-5° anterior | 5-10° | 10-15° | >15° |
| Knee hyperextension | 0-5° | 5-10° | 10-15° | >15° |

*Source: Kendall et al., Muscles Testing and Function, 5th Ed.*

### Frontal Plane (Anterior/Posterior views)
| Deviation | Normal | Flag |
|---|---|---|
| Head tilt | 0° | >2° |
| Shoulder height difference | 0-1cm | >2cm |
| Pelvic obliquity | 0° | >2° |
| Spinal deviation (Adams test) | 0° | >7° — refer for X-ray |
| Knee valgus/varus | 0-2° | >5° |
| Calcaneal valgus | 0-2° | >4° |

---

## Muscle Imbalance Detection

Map postural deviations to shortened/lengthened muscles:

```typescript
type MuscleImbalance = {
  deviation: string           // e.g., "anterior pelvic tilt"
  shortenedMuscles: string[]  // e.g., ["iliopsoas", "rectus femoris"]
  lengthenedMuscles: string[] // e.g., ["gluteus maximus", "hamstrings"]
  clinicalName: string        // e.g., "Lower Crossed Syndrome (Janda)"
  correctionExercises: string[] // IDs from exercise library
  stretchingTarget: string[]
  citation: string
}
```

Common patterns to detect:
- Upper Crossed Syndrome (Janda): forward head, rounded shoulders
- Lower Crossed Syndrome (Janda): anterior pelvic tilt, lumbar hyperlordosis
- Layer Syndrome (Janda): combination of both
- Scoliotic posture: lateral deviation + rotation
- Flat back: reduced lumbar lordosis
- Swayback: posterior pelvic tilt

---

## Technical Implementation

### Camera Module
```typescript
// Capture sequence controller
type PostureCapture = {
  sessionId: string
  patientId: string
  views: {
    anterior: CapturedView
    rightLateral: CapturedView
    posterior: CapturedView
    leftLateral: CapturedView
    walking?: WalkingAnalysis
  }
  capturedAt: Date
}

type CapturedView = {
  staticFrame: ImageData      // single frame for grid overlay
  videoBlob?: Blob            // 30-second clip for walking
  landmarks: NormalizedLandmark[]
  angles: Record<string, number>
  gridOverlay: GridOverlay
  deviations: PosturalDeviation[]
}
```

### MediaPipe Landmarks Used for Posture
Key landmark indices:
- 0: Nose (head position)
- 11/12: Shoulders (L/R)
- 23/24: Hips (L/R)
- 25/26: Knees (L/R)
- 27/28: Ankles (L/R)
- 29/30: Heels (L/R)
- 31/32: Toe tips (L/R)
- 7/8: Ears (L/R) — ear canal approximation

### Angle Calculations for Each View

**Anterior view:**
```typescript
shoulderLevelDiff = landmarks[11].y - landmarks[12].y  // in pixels
pelvisLevelDiff = landmarks[23].y - landmarks[24].y
headTiltAngle = calculateAngle(landmarks[8], landmarks[0], landmarks[7])
kneeValgus = calculateAngle(landmarks[23], landmarks[25], landmarks[27]) // right
```

**Lateral view (right side):**
```typescript
earShoulderHipAngle = calculateAngle(landmarks[8], landmarks[12], landmarks[24])
// Should be ~180° (straight line) for good posture
hipKneeAnkleAngle = calculateAngle(landmarks[24], landmarks[26], landmarks[28])
headForwardPosture = landmarks[8].x - landmarks[12].x  // normalised distance
```

---

## Report Output

### Posture Report Card
```typescript
type PostureReport = {
  id: string
  patientId: string
  date: Date
  overallScore: number          // 0-100 (100 = ideal alignment)
  sagittalScore: number
  frontalScore: number
  
  findings: PosturalFinding[]
  muscleImbalances: MuscleImbalance[]
  
  // Clinical output
  clinicalSummary: string       // 3-sentence AI summary
  priorityAreas: string[]       // top 3 to address
  correctionProgram: Exercise[] // 6-week program
  referralFlags: ReferralFlag[] // when to refer
  
  // Data
  gridImages: {
    anterior: string   // base64 with overlay
    rightLateral: string
    posterior: string
    leftLateral: string
  }
  fhirObservation: FHIRObservation  // for clinical records
  
  nextAssessmentDate: Date    // recommended follow-up
}
```

### Posture Score Calculation
```
Overall Score = 
  (sagittal deviations × 0.5) + 
  (frontal deviations × 0.3) + 
  (muscle balance × 0.2)

Each deviation scored:
  Within normal = 100pts
  Mild = 70pts
  Moderate = 40pts
  Severe = 10pts
```

---

## AI Analysis Prompt (for ConsensusAgent)

```
You are a clinical physiotherapist specialising in postural assessment.
Analyse these postural measurements and provide:

1. CLINICAL FINDINGS (cite Kendall et al. or equivalent for each)
   - List each deviation with measured angle/distance
   - Classify severity (mild/moderate/severe)
   - State clinical significance

2. MUSCLE IMBALANCE PATTERN
   - Identify Janda pattern if present (Upper/Lower/Layer Crossed)
   - List shortened muscles (Latin names)
   - List lengthened/weakened muscles (Latin names)
   - Clinical rationale for each

3. PRIORITY CORRECTIONS (top 3 only)
   - Most impactful deviation to address first
   - Specific exercises with sets/reps
   - Expected timeline for improvement

4. REFERRAL FLAGS
   - Any red flags requiring imaging or specialist referral
   - Be specific: "Scoliosis screen >7° Adams test — consider X-ray"

5. HOME SELF-CARE
   - 2 stretches (30s × 3, twice daily)
   - 2 strengthening exercises (3×15, 3×/week)

Format output as structured JSON for FHIR storage.
Evidence grade for each recommendation: A/B/C/D.
```

---

## Integration with Existing Session Page

Add to session page exercise selector:
- New mode: "Posture Assessment"
- On select: launches 4-view capture protocol
- After capture: shows grid overlay on each view
- Runs PostureAgent analysis
- Generates posture report PDF
- Saves to /history as posture_assessment type
- Accessible in /clinician for each patient

---

## Build Priority

1. **This week:** Build 4-view capture UI with countdown + voice cues
2. **Week 2:** Grid overlay rendering on captured frames
3. **Week 3:** Angle calculation for all 4 views
4. **Week 4:** AI analysis integration + report PDF
5. **Week 5:** Walking analysis module
6. **Week 6:** Integration with clinical knowledge graph

---

*Add to CONTEXT.md when each step is completed.*
