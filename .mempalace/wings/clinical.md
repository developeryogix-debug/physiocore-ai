# Wing: Clinical

Everything that touches healthcare standards, clinician workflows, and patient safety.

---

## Regulatory framing

- **PhysioCore AI is positioned as a SaMD Class II** (Software as a Medical Device).
- Every clinical claim in any output must carry a primary source citation.
- Safety rules cannot be overridden by any agent. This is non-negotiable.

## Interop / export

- **FHIR R4** is the export format. `FHIR_BASE_URL=https://hapi.fhir.org/baseR4` for test posts.
- Each session export is a valid R4 Bundle containing Patient + Observation + Procedure resources.
- The clinician export also embeds **SOAP notes** (Subjective / Objective / Assessment / Plan).
- **CPT billing codes** included: 97110 (therapeutic exercise), 97530 (therapeutic activities), 97150 (group therapy).

## Outcome scales (RCT-ready)

| Scale | What it measures | Range | Cadence |
|---|---|---|---|
| PSFS | Patient-Specific Functional Scale, 3 activities | 0-10 each | Per session |
| NPRS | Numeric Pain Rating Scale | 0-10 | Pre and post session |
| GROC | Global Rating of Change | -7 to +7 | Weekly |
| PHQ-4 | Mental health screen | 0-12; flag > 6 | Periodic |

All scores stored in `physiocore_outcomes` (localStorage) and Supabase `outcomes` table. CSV export is CONSORT-compatible and anonymized (no PII).

## Safety layer (planned, not yet built)

- Pain check-in modal before every session (0-10).
- If pain > 7: block session and show rest recommendation.
- Cross-reference exercise vs user's conditions list; block dangerous combos with modification suggestions.
- Log pain ratings to localStorage and Supabase `biometrics`.

## Research foundation (cite in papers)

| Topic | Reference |
|---|---|
| Pose detection | Lugaresi et al., 2019 (MediaPipe) |
| Energy expenditure | Mifflin MD et al., 1990 (JADA) |
| Protein targets 1.6-2.2 g/kg | Stokes T et al., 2018 (Nutrients) |
| FHIR R4 | HL7 International, 2019 |
| Pose grading | MDPI Healthcare 2021, 2023 |
| AI physio review | MDPI Applied Sciences 2025 |
