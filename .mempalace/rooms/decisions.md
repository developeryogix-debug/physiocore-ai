# Room: Decisions

ADR-lite. Each entry captures a decision, the alternatives, and the rationale - so a future session understands not just what we did but why.

Format:
```
## YYYY-MM-DD - decision title
Status: accepted | superseded | reversed
Context: what problem prompted this
Decision: what we chose
Alternatives considered: ...
Consequences: trade-offs we accepted
```

---

## 2026-05-15 - User-guide privacy contact moved off physiocore.ai
Status: accepted
Context: physiocore.ai domain is not yet registered. Original user guide listed `privacy@physiocore.ai`, which would bounce.
Decision: Use `devkapiltech@gmail.com` as the privacy contact in v1.1+ of the user guide.
Alternatives: register physiocore.ai now (premature given the SaMD compliance work still ahead); use developeryogix@gmail.com (already burned for accounts work).
Consequences: When the domain is registered, swap to a `privacy@` address there and update v1.x.

## 2026-05-15 - User-guide FAQ is honest about Anthropic API egress
Status: accepted
Context: The earlier "your camera footage never leaves your device" framing was technically true for video but obscured that movement-score JSON does go to Anthropic for feedback generation.
Decision: Rewrite the FAQ answer to say video is on-device-only but movement scores and session summary are sent securely to the AI coaching system. No video or images are ever transmitted.
Consequences: More honest privacy stance; reduces risk of trust/regulatory blowback once the SaMD audit begins.

## ~2026-04 - Sonnet for reasoning, Haiku for high-frequency
Status: accepted
Context: Tier 1 Anthropic account, 30K tokens/min Sonnet cap, $100/mo budget. Per-session feedback could trigger 429s if Sonnet was used everywhere.
Decision: Haiku for FeedbackAgent and monitor/diagnose; Sonnet 4 for Nutrition, Clinical, Behavior, and the in-app chat.
Consequences: Slightly less elaborate post-session reports but no rate-limit incidents.

## ~2026-04 - Replace `claude-opus-4-7` with `claude-sonnet-4-20250514`
Status: accepted (corrects an earlier mistake)
Context: `claude-opus-4-7` was hard-coded somewhere and surfaced as a model error.
Decision: Standardize Sonnet on `claude-sonnet-4-20250514` and Haiku on `claude-haiku-4-5-20251001`. Pin in `CLAUDE.md`.

## ~2026-04 - Browser-safe Anthropic client layer
Status: accepted
Context: Node-only Anthropic SDK breaks at runtime in the browser.
Decision: Lightweight wrapper at `packages/app/src/lib/agents/anthropicClient.ts` plus per-agent clients. Server functions in `api/` use the official SDK.
Consequences: Two code paths to maintain; trade-off accepted for browser-side streaming chat.

## ~2026-04 - Sessions persist via localStorage first, then Supabase
Status: accepted
Context: User leaving the page mid-session was losing data.
Decision: Always write `physiocore_sessions` to localStorage in `stopSession`; sync to Supabase opportunistically.
Consequences: Some duplication; resilient to offline use.
