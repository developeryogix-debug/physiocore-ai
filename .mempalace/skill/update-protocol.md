# Update Protocol

How to actually keep the palace fresh, with concrete templates.

---

## When the palace must be updated

Run the protocol whenever a session has changed any of:

| Change type | Where to update | Always also log? |
|---|---|---|
| New architectural / product decision | `rooms/decisions.md` | Yes |
| Bug found and fixed | `rooms/incidents.md` | Yes |
| Release shipped or version bumped | `rooms/milestones.md` + `wings/product.md` | Yes |
| Account, URL, env var, or contact changed | `wings/infrastructure.md` or `rooms/people.md` + Quick facts in `PALACE.md` | Yes |
| New route, page, or major component | `wings/frontend.md` | Yes |
| New or modified agent, model, or token budget | `wings/agents.md` | Yes |
| Clinical scale, FHIR change, or safety rule | `wings/clinical.md` | Yes |
| Raw error output / build log worth preserving | new file in `drawers/` | Optional |

If none of these changed - don't update. The palace should grow only when something material happened.

---

## Templates

### Decision entry (`rooms/decisions.md`)

```markdown
## YYYY-MM-DD - decision title
Status: accepted | superseded | reversed
Context: 1-2 sentences on what problem prompted this.
Decision: what we chose, in one sentence.
Alternatives considered: bullet list of what else we looked at.
Consequences: trade-offs we accepted; what to watch out for.
```

### Incident entry (`rooms/incidents.md`)

```markdown
## YYYY-MM-DD - one-line title
Symptom: what the user saw.
Root cause: why it happened.
Fix: exact change, code-level.
File(s) touched: path/to/file.ts, ...
Notes (optional): related decisions, follow-ups.
```

### Milestone entry (`rooms/milestones.md`)

```markdown
## YYYY-MM-DD - what shipped
- bullet of what changed
- bullet of why it matters
- File / URL: pointer to the artifact
```

### Drawer file (`drawers/YYYY-MM-DD_slug.md`)

```markdown
---
date: YYYY-MM-DD
kind: error | log | output | snapshot | transcript
tags: [tag1, tag2]
links_to:
  - rooms/incidents.md#anchor
---

<verbatim content - do not paraphrase>
```

### LOG entry (`LOG.md`)

```markdown
## YYYY-MM-DD - short-title
Author: Claude (model) / human-name
Touched: file1.md, file2.md
Why: one-line reason
Summary: 1-3 sentences describing what changed and what it means.
```

---

## Reconciling against CLAUDE.md / CONTEXT.md

The palace **augments** but does not replace the repo-root context files.

- If a fact lives in both places and they disagree, the **more recently edited file wins**. Update the older one.
- Use `mtime` (or git log) to decide which is newer if you can't tell.
- After reconciling, log the reconcile in `LOG.md` so future sessions know it happened.

## Periodic consolidation (every ~20 entries or monthly)

Run a light consolidation pass:

1. Read each wing and room in full.
2. Look for duplicates, contradictions, or stale entries (e.g., decisions that have since been reversed).
3. Mark superseded entries; do not delete.
4. If a wing exceeds ~600 lines, split it into sub-wings (e.g., `wings/frontend.md` -> `wings/frontend/routes.md`, `wings/frontend/design-system.md`).
5. Log the consolidation in `LOG.md`.

## What never goes in the palace

- API keys, OAuth tokens, service-role keys, passwords.
- Real patient data (PHI). Use synthetic examples only.
- Anything you wouldn't want in a public security audit.

## Hygiene quick-checks

Before signing off a session, confirm:

- [ ] `LOG.md` has a new entry dated today (if anything changed).
- [ ] No secrets crept into any palace file.
- [ ] If user-facing state changed, the Quick Facts block in `PALACE.md` reflects it.
- [ ] Superseded entries are marked, not deleted.
