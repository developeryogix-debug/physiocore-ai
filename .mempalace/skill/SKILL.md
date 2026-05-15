---
name: physiocore-memory
description: Project memory palace for PhysioCore AI. Read this skill at the start of EVERY session before doing any work in this repo. It points to a structured knowledge base of wings (frontend, agents, clinical, infrastructure, product), rooms (decisions, incidents, people, milestones), and drawers (verbatim snippets). Update the palace at the end of any session that changes meaningful state.
---

# PhysioCore Memory Palace - skill

This skill exists so that Claude (or any agent) loses zero context between sessions when working on PhysioCore AI. It is inspired by [MemPalace](https://github.com/mempalace/mempalace) - verbatim, locally-indexed, never paraphrased away.

The palace lives at:

```
/Users/devkapilicloud.com/Desktop/physiocore-ai/.mempalace/
├── PALACE.md          <- master index, read first
├── LOG.md             <- append-only changelog
├── wings/             <- major project areas
│   ├── frontend.md
│   ├── agents.md
│   ├── clinical.md
│   ├── infrastructure.md
│   └── product.md
├── rooms/             <- cross-cutting topics
│   ├── decisions.md
│   ├── incidents.md
│   ├── people.md
│   └── milestones.md
├── drawers/           <- verbatim snippets (raw logs, outputs)
│   └── README.md
└── skill/             <- this skill
    ├── SKILL.md
    └── update-protocol.md
```

## When to use this skill

Use this skill **at the very start of any conversation about PhysioCore AI**, before reading CLAUDE.md / VISION.md / CONTEXT.md, and again at the end if anything material changed.

Common triggers:
- User opens the physiocore-ai folder and asks anything substantive.
- User mentions a route, an agent, a Supabase table, an Anthropic model, or a clinician feature.
- User asks "what's the status of X" or "what did we decide about Y".
- A bug is reported, a release is cut, a decision is made, an account changes.

## Session protocol

### At session start

1. **Read `PALACE.md`** in full. It's the master index.
2. **Read the relevant wing(s)** based on the user's request. (Front-end question -> `wings/frontend.md`. New agent? -> `wings/agents.md`. Clinical export? -> `wings/clinical.md`. And so on.)
3. **Skim the rooms** if the request looks cross-cutting (e.g. "why did we...?" -> `rooms/decisions.md`; "what broke last time...?" -> `rooms/incidents.md`).
4. **Check the latest `LOG.md` entry** to see what changed in the prior session - this often tells you what to pick up next.

### During the session

- If you find a fact in the palace that contradicts what's currently in the code or CONTEXT.md, **trust the current code or env** and mark the palace entry for update.
- If you make a decision worth remembering, jot it down in a scratch note - don't update the palace mid-flight.

### At session end

If the session changed any meaningful state - a new decision, a new bug fix, a new release, a new account, a removed feature - update the palace before signing off:

1. **Open the relevant wing or room** and add/update the entry.
2. **Append an entry to `LOG.md`** following the format in that file.
3. **If the user-facing state changed** (new URL, new email, new version), also update the "Quick facts" block at the bottom of `PALACE.md`.
4. **Never delete history.** Mark old entries `superseded` or `reversed` instead of removing them.

Details and templates are in `update-protocol.md` alongside this `SKILL.md`.

## What goes where (cheat sheet)

| Kind of fact | File |
|---|---|
| "We use Sonnet 4 for the clinical agent because..." | `rooms/decisions.md` |
| "Rate-limit 429 was caused by..." | `rooms/incidents.md` |
| "Supabase project ID is `qbrrugglfdwcapqrnahw`" | `wings/infrastructure.md` |
| "Form Score uses MediaPipe + a 6 deg hysteresis band" | `wings/agents.md` |
| "Dev's monitoring email is devkapilicloud@gmail.com" | `rooms/people.md` |
| "User Guide v1.2 shipped on 2026-05-15" | `rooms/milestones.md` |
| The full stderr of a build that broke | `drawers/2026-05-15_vercel-build-stderr.md` |

## Anti-patterns

- **Do not** paraphrase a clinician's verbatim feedback into a wing. Verbatim text goes in `drawers/`; only the takeaway goes in the wing.
- **Do not** store secrets in the palace. Use `.env.local` and Vercel env vars.
- **Do not** write PHI (real patient data) into the palace. Synthetic examples only.
- **Do not** scatter the same fact across multiple files. Put it in the right home and link to it.

## Relationship to other context files

- `CLAUDE.md` and `CONTEXT.md` at the repo root are **read on every session** (per project rules). The palace **augments** them - it captures *why* things are the way they are, and the history that led there. If the palace drifts from CLAUDE.md/CONTEXT.md, the source-of-truth is whichever file was edited last; reconcile and update both.
- `VISION.md` and `POSTURE_SYSTEM.md` are unchanged sacred docs; the palace links to them but does not duplicate them.
