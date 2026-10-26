# Franchise partner desk

Upload the case's Excel file (Applications + Territories, with the fixed Existing stores sheet). Every applicant gets a recommendation (Recommended, Waitlist, On hold or Rejected), the reason, next steps, a training plan and an email draft. A chat panel answers "why" questions and takes new facts ("APP-012 has now found a ground-floor space"), then re-runs the whole batch and reports every knock-on change.

No login. The file is read in the browser.

## Run it locally

```bash
npm install
cp .env.example .env.local     # add OPENROUTER_API_KEY (or GEMINI_API_KEY)
npm run dev                    # http://localhost:3000
```

The app works without a key too: the chat falls back to built-in handling of simple questions and updates.

## Deploy to Vercel (about 5 minutes)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo. Framework is detected as Next.js.
3. Under **Environment Variables**, add `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`, default `google/gemini-3.7-flash`). Or use a Google AI Studio key: `GEMINI_API_KEY` and `GEMINI_MODEL`. If both keys are set, OpenRouter is used.
4. Deploy. Open the link in a private window to confirm it works without being signed in.
5. Set a credit limit on the key (OpenRouter) or a spending cap (Google AI Studio). The link is public.

If the model ever returns errors (for example, a retired model name), set `OPENROUTER_MODEL` (or `GEMINI_MODEL`) to a current Flash model and redeploy. The dashboard keeps working either way.

## How decisions are made

Code decides; Gemini only explains and turns chat messages into data updates. Same input, same output, every time.

1. **Reject (hard rules):** pin code already has an existing store; pin code isn't in any territory; investment more than 25% below the tier minimum.
2. **Hold (fixable):** missing required fields; city and pin code disagree; no space yet; upper or unknown floor; space under 300 sq ft; investment up to 25% short; form contradicts itself or the notes.
3. **Score out of 100** for everyone else: investment headroom 30, experience 20, owned/rented space 25/20, ground/mall floor 15/12, launch timing 10.
4. **Allocation per territory:** highest score first, one store per pin code, up to the open slots, minimum score by territory priority (High 50, Medium 60, Low 70). The rest go to Waitlist.

Minimum investment: Tier 1 ₹30 lakh, Tier 2 ₹22 lakh, Tier 3 ₹18 lakh. All thresholds are editable under "Brand rules" in the app.

## The sample file

`public/sample-applications.xlsx` is built on the real template and plants the traps judges are likely to use:

| Applicant | Trap | Expected |
|---|---|---|
| APP-005 | Pin 570009 already has ST-06 | Rejected |
| APP-016 | Pin outside every territory | Rejected |
| APP-009 | ₹18 lakh in Tier 1 | Rejected |
| APP-008 | ₹26 lakh in Tier 1 (small shortfall) | On hold |
| APP-007 | No space yet, 2-month launch | On hold |
| APP-012 | Upper floor | On hold → Recommended after "found a ground-floor space", which pushes APP-013 off pin 572101 |
| APP-015 | City Mangaluru, pin from Mysuru | On hold |
| APP-017 | "Not yet identified" but gives size and floor | On hold |
| APP-018 | Investment blank | On hold |
| APP-019 | Form says Ground, notes say second floor | On hold |
| APP-020 | 260 sq ft | On hold |
| APP-004, APP-010 | Lose slots to higher scorers | Waitlist |
| APP-014 | Score below a Low-priority territory's bar | Waitlist |

## Check it

```bash
npm run check   # 30 checks against the sample file
```

## Files

- `docs/`: the original case PDF and template, plus HANDOFF.md
- `scripts/check-sample.mjs`: the self-check

- `lib/parse.js`: reads the template (skips the grey example rows, keeps pin codes as text)
- `lib/engine.js`: rules, scoring, allocation, before/after comparison
- `lib/plan.js`: next steps, training plans, email drafts
- `lib/snapshot.js`, `app/api/chat/route.js`: what Gemini sees, and the server call (key never reaches the browser)
- `lib/chatLocal.js`: chat fallback without Gemini
- `app/page.js`, `app/components/*`: the dashboard
