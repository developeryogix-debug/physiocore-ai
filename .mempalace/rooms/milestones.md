# Room: Milestones

Releases and notable build moments. Newest at the top.

---

## 2026-05-15 - User Guide v1.2 shipped
- 15-page PDF with all 8 onboarding/dashboard screenshots embedded
- Screenshots styled with 2px teal #00D4AA borders, 8px radius, mono captions
- Reflects current product state: MediaPipe, Claude AI, FHIR R4, SOAP/CPT, Grade A-D supplements, Singapore data residency
- Privacy contact corrected to devkapiltech@gmail.com (physiocore.ai not yet registered)
- File: `PhysioCore_User_Guide_v1.2.pdf`

## 2026-05-15 - User Guide v1.1 (interim)
- FAQ rewritten to be honest about Anthropic API egress
- Privacy contact moved off the unregistered physiocore.ai domain
- File: `PhysioCore_User_Guide_v1.1.pdf`

## 2026-05-13 - User Guide v1.0 (placeholder version)
- First professional PDF user guide
- Cover, 7 sections, callouts, brand-aligned tables
- Screenshots were placeholders pending real captures
- File: `PhysioCore_User_Guide.pdf`

## ~2026-05-09 - All planned routes shipped to production
- `/history`, `/outcomes`, `/settings`, `/trainer` all built and deployed
- See `wings/frontend.md` for the full route table
- Live at https://app-dteam1-mmcv.vercel.app

## ~2026-04 - Vercel migration to developeryogix-debug
- Vercel deploy blocked under old account; moved to new GH account
- API routes (`api/health-check`, `api/ping`, `api/weekly-report`) now serve from production

## ~2026-04 - Clinical Noir design system
- Dark luxury medical aesthetic adopted
- CSS variables locked in `packages/app/src/index.css`
- Syne / Figtree / Space Mono / Noto Serif typography stack

## Earlier - Foundational five-session Claude build
- Five Claude Code sessions to scaffold the monorepo
- Resulted in the initial 9-package layout and the agent split
