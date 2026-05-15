# Room: Incidents

Bugs and fixes. Capture symptom, root cause, and the actual fix - so future sessions don't relearn the same lesson.

Format:
```
## YYYY-MM-DD - one-line title
Symptom: what the user saw
Root cause: why it happened
Fix: exact change
File(s) touched: ...
```

---

## ~2026-04 - `crypto.randomUUID` browser error
Symptom: Page crash on session start in Vite dev build.
Root cause: Some Node-only paths leaked into the browser bundle.
Fix: Added `vite-plugin-node-polyfills` to the app's Vite config.

## ~2026-04 - Wrong model string `claude-opus-4-7`
Symptom: 400 from Anthropic, model not found.
Root cause: Early code pinned a non-existent Opus version.
Fix: Standardized to `claude-sonnet-4-20250514`. Pinned in `CLAUDE.md`.

## ~2026-04 - Sessions not persisting after browser close
Symptom: User reported dashboard "forgot" yesterday's session.
Root cause: We were relying on in-memory state only; `stopSession` never hit localStorage.
Fix: `stopSession` now writes `physiocore_sessions` to localStorage first, then queues a Supabase sync.

## ~2026-04 - Dashboard showing mock streak / adherence
Symptom: Numbers didn't change after a real session.
Root cause: Mock placeholder values shipped from an earlier sketch.
Fix: Streak and adherence panels now read real `physiocore_sessions` from localStorage.

## ~2026-04 - Rate-limit 429 from Anthropic on feedback
Symptom: Some post-session feedback calls failed with 429.
Root cause: Sonnet token budget burned through with long feedback prompts.
Fix: Switched FeedbackAgent to Haiku, capped at 600 tokens (now 900), added a 3-second retry, JSON fallback if parse fails.

## ~2026-04 - Gym rep counter jitter
Symptom: Reps double-counted near the bottom of a squat.
Root cause: Single-threshold detection oscillated around the cutoff.
Fix: 6 deg hysteresis band + 8-second startup dead zone + angle sanity filter (squat < 60 deg discarded as noise) + live HOLD state ("HOLDING" badge with live seconds).

## ~2026-04 - Profile lost after sign-out
Symptom: User signed out and back in; onboarding restarted.
Root cause: Local state and Supabase profile diverged; local took precedence on rehydrate.
Fix: Supabase is now authoritative on every login (`useUserProfile.tsx` init()).

## ~2026-04 - Google OAuth redirecting to wrong port
Symptom: Login bounced to a port the dev server wasn't listening on.
Root cause: Supabase Site URL was set to a stale port.
Fix: Set Supabase Site URL to `http://localhost:5173`.

## ~2026-04 - Vercel deploy blocked (account email mismatch)
Symptom: Deploy refused with permission error.
Root cause: Vercel team was tied to an old GitHub account.
Fix: Migrated to `developeryogix-debug` (active GH account). The old `devkapil-tech` and `kddocai` repos are dead-letter copies - do not push there.

## ~2026-04 - Supabase generated types coming back as `never[]`
Symptom: `tsc -b` complained that new tables resolved to `never[]`.
Root cause: Database<T> generic didn't see fresh migrations.
Fix: Drop the generic and cast `supabase as any` at call sites until types are regenerated.
