# Project context for Claude Code

Hackathon Case 1: franchise partner acquisition, geo-selection and onboarding engine for a walk-in, small-format retail brand (Lenskart-style) in Karnataka. Judges upload Applications + Territories sheets in the fixed template; Existing stores is fixed. Then they chat: "Why is APP-007 on hold?" and "APP-012 has now found a ground-floor space".

Non-negotiables:
- Never two stores in one pin code (existing stores and new recommendations).
- Code decides outcomes (lib/engine.js). Gemini only explains and converts chat into field updates. Don't move decisions into prompts.
- Any chat update re-runs the whole batch and reports knock-on changes. Updated fields are flagged "unverified".
- Outcomes are recommendations; one expansion team member reviews them.
- No login; the Gemini key stays server-side (app/api/chat/route.js).
- Template quirks: row 1 note, row 2 headers, row 3 grey example on Applications/Territories (skip only if it matches exactly); Existing stores has no example row. Pin codes arrive as numbers; treat as text.
- The sheet has no email or phone, so emails are drafts (copy / open in email app).

Start by reading docs/HANDOFF.md. The original case PDF and template are in docs/ and are the source of truth.
Before pushing, run `npm run check` (all checks must pass) and `npm run build`.
The chat route is tested with a real key via OpenRouter (OPENROUTER_API_KEY, google/gemini-3.7-flash). The direct Google path (GEMINI_API_KEY) has not been.
