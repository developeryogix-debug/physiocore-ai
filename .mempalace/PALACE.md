# PhysioCore AI - Memory Palace
> Inspired by [MemPalace](https://github.com/mempalace/mempalace).
> Verbatim, local-first project memory. Updated every Claude session.

Last updated: 2026-05-15 by Claude (session bootstrap)

---

## How to read this palace

- **Wings** are major areas of the project (frontend, agents, clinical, infra, product).
- **Rooms** are cross-cutting topics (decisions, incidents, people, milestones).
- **Drawers** hold verbatim snippets - raw logs, error messages, command outputs that you want preserved word-for-word.
- **LOG.md** is the append-only changelog. Every Claude session adds an entry.

When a new session starts, read this file first, then the wings relevant to the task, then the rooms for context.

---

## Wings

| Wing | What lives here | File |
|---|---|---|
| Frontend | React app, routes, pages, components, UI state | [wings/frontend.md](wings/frontend.md) |
| Agents | The 5 AI agents (pose, feedback, nutrition, clinical, behavior) and the orchestrator | [wings/agents.md](wings/agents.md) |
| Clinical | FHIR R4, SOAP notes, CPT codes, outcome scales, safety rules | [wings/clinical.md](wings/clinical.md) |
| Infrastructure | Vercel, Supabase, Anthropic, env vars, monitoring | [wings/infrastructure.md](wings/infrastructure.md) |
| Product | Vision, competitive position, roadmap, build phases | [wings/product.md](wings/product.md) |

## Rooms

| Room | What lives here | File |
|---|---|---|
| Decisions | Architecture/product decisions with rationale (ADR-lite) | [rooms/decisions.md](rooms/decisions.md) |
| Incidents | Bugs encountered, root cause, how we fixed them | [rooms/incidents.md](rooms/incidents.md) |
| People | Stakeholders, accounts, contact points | [rooms/people.md](rooms/people.md) |
| Milestones | Releases, version notes, what shipped when | [rooms/milestones.md](rooms/milestones.md) |

## Drawers

Verbatim snippets - error logs, command outputs, snapshots of state worth keeping word-for-word.
See [drawers/README.md](drawers/README.md) for the filing convention.

## Update Log

The append-only log of every memory update: [LOG.md](LOG.md).

---

## Quick facts (always-fresh top-of-mind)

These should match the latest in CONTEXT.md. If they drift, update the older file.

- **Production URL:** https://app-dteam1-mmcv.vercel.app
- **Active GitHub:** `developeryogix-debug/physiocore-ai`
- **Supabase project:** `qbrrugglfdwcapqrnahw` (Singapore region)
- **Anthropic account:** developeryogix@gmail.com (Tier 1, $15 auto-reload)
- **Primary contact:** developeryogix@gmail.com / devkapiltech@gmail.com
- **Current phase:** Phase 1 - Clinical Knowledge Foundation
- **Regulatory framing:** SaMD Class II (Software as a Medical Device)
- **User guide:** PhysioCore_User_Guide_v1.2.pdf (May 2026)
