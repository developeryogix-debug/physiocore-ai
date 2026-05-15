# Drawers - Verbatim Snippets

Drawers hold raw, word-for-word content that's worth preserving exactly: error logs, SQL outputs, command transcripts, snapshots of a Vercel build, a stack trace from a 429, etc. Unlike wings and rooms (which summarize), drawers do not paraphrase.

## Filing convention

One file per snippet, named:

```
YYYY-MM-DD_short-kebab-title.md
```

Each drawer file starts with a tiny frontmatter so you can scan a folder fast:

```markdown
---
date: 2026-05-15
kind: error | log | output | snapshot | transcript
tags: [vercel, supabase, anthropic-429]
links_to:
  - rooms/incidents.md#anthropic-429
---

<verbatim content here>
```

## When to file a drawer

- A stack trace you might want to grep later.
- The full output of a Vercel deploy that succeeded but warned.
- A Supabase migration script you actually ran (so we can re-run on a fresh env).
- The exact text of a clinician's feedback during a pilot.
- The JSON shape of a real `physiocore_sessions` localStorage entry.

## When NOT to file

- Anything secret (keys, tokens, passwords) - put those in `.env.local`.
- Anything personally identifying about a real patient.
- Working notes you'll throw away in an hour - use a scratch file.

## Index

(empty - drawers start being filled as incidents and snapshots accumulate)
