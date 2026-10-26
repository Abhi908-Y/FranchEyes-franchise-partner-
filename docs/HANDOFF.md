# Handoff: Case 1 franchise partner desk

Read this before changing anything. It separates three things:
- **From the case:** stated in `docs/Case1_problem_statement.pdf` or `docs/Case1_Franchise_Test_Data_Format.xlsx`. Those two files are the source of truth; if this document ever disagrees with them, they win.
- **Our decision:** a choice the team made where the case is silent. Defensible, but not required by the case.
- **Status:** what has and hasn't been tested.

## 1. Status

Verified in the build environment:
- `npm run build` succeeds (Next.js 15.5.28, React 19.1.9).
- `npm run check` passes all 45 checks against `public/sample-applications.xlsx`.
- Clicked through in a headless browser at desktop and mobile widths: upload, sample file, territory board, applicant details, confirm and pipeline, email draft, chat (fallback mode).
- The chat route with a real key via **OpenRouter** (`OPENROUTER_API_KEY`, model `google/gemini-3.7-flash`): all four messages in section 7 give the expected outcomes, through the API and the UI.
- With no key set, `/api/chat` returns 503 and the chat falls back to `lib/chatLocal.js`; all four messages still work.
- Deployed on Vercel at https://franchise-partner-desk-topaz.vercel.app (public, no login). Pushes to `main` on GitHub deploy automatically. Sample file, chat updates and Google Fonts all checked on the live site.

**Not yet verified. Do these first:**
1. **The direct Google path** (`GEMINI_API_KEY`) hasn't run with a real key. Its default model `gemini-2.5-flash` is probably retired; set `GEMINI_MODEL` to a current one if you use this path. If both keys are set, OpenRouter is used.
2. **The AI chat on the live site** needs `OPENROUTER_API_KEY` set in Vercel (Settings → Environment Variables). Without it, the live chat uses the built-in fallback.

## 2. What the case asks (from the case)

- A fast-growing retail brand's journey from a partner's first application to an open, trained store is slow and leaky. Build a solution that takes it off the expansion team's plate.
- Judges upload **Sheet 1 Applications** and **Sheet 2 Territories**. **Sheet 3 Existing stores** is fixed (10 stores). The solution must accept the file as-is.
- Some applications will be incomplete or contradictory; several will compete for the same territory.
- **The brand never opens two stores in the same pin code.**
- Part 2: judges ask about decisions in plain language ("Why is APP-007 on hold?") and give new information ("APP-012 has now found a ground-floor space"); the decision must change sensibly.
- For every application: what should happen and why. For partners who move forward: next steps and how they'll be prepared to run the store.
- Judged on reasoning and clarity; no single right answer. The link must work without help or a login.

Allowed values (from the case): Karnataka only. Bengaluru 560 Tier 1; Mysuru 570, Mangaluru 575, Hubballi-Dharwad 580, Belagavi 590 Tier 2; Tumakuru 572, Davanagere 577 Tier 3. Languages: Kannada, English, Hindi.

## 3. Template facts (from the template, checked by reading the file)

- Applications and Territories: row 1 is a note, row 2 headers, row 3 a grey example (APP-001 Ravi Kumar; TER-01 Mysuru 570001, 570002, 570008, 3 slots, High). Data starts at row 4.
- Existing stores: row 1 note, row 2 headers, **no example row**; data starts at row 3.
- Pin codes are stored as numbers (e.g. 570001.0). Territory pin codes are one comma-separated text cell.
- The Field guide marks these Applications columns as **not required**: current/past business, space size, floor, target launch, preferred language, notes. (The PDF says judges fill every column; the template says some are optional. The code handles blanks either way.)
- **There is no email or phone column**, so emails can only be drafts.
- Dropdown validation extends to row 500; the parser stops reading at a blank ID.

## 4. Our decisions (not stated in the case)

- **Business type:** a walk-in, small-format specialty retail store (Lenskart-style). Basis: the case says "retail brand" and "trained store", the template has Floor and Retail experience columns, and the judges' example update is about a ground-floor space.
- **Outcomes:** Recommended, Conditional, Redirect, Waitlist, Hold, Reject, Withdrawn (agreed 26 Oct 2026). All are recommendations; one expansion team member reviews them.
- **Code decides, Gemini explains.** Gemini never changes an outcome directly; it only answers from a snapshot or returns field updates, and the engine re-runs.
- **Chat updates re-run the whole batch** and are flagged "unverified".
- **Emails are drafts** (Copy / Open in email app), not sent, because there's no contact data and a public send button could be abused.
- **No database.** Each upload is saved as a review in the browser's localStorage, with its bookmarks, notes, scheduled next steps, agreement drafts, chat and brand rules. Uploading a new sheet creates a new project; earlier ones stay in the sidebar. Data stays in that one browser; clearing site data removes it.

## 5. Rulebook as implemented (our decision; code in `lib/engine.js`)

Defaults live in `lib/constants.js` (`DEFAULT_PROFILE`) and are editable per project under "Brand rules". Built for one brand (name not disclosed), so there is no category picker; "Upper floors qualify" and the size range are toggles under Brand rules.

**Reject (hard rules):**
- Pin code already has an existing store.
- Pin code isn't in any territory.
- Investment more than 25% below the tier minimum.

**Hold (fixable):** missing name, city, pin, investment, experience or space status; city not in scope; pin not 6 digits; city and pin prefix disagree; investment up to 25% short; space "Not yet identified"; "Not yet identified" but a size or floor given; owned/rented with no size; size under 300 sq ft; floor Not known or blank; notes mention an upper floor while the form says otherwise; notes say they're still looking while the form says owned/rented. (The two notes checks are skipped once that field has been updated in chat.)

**Conditional:** won a slot, approved once a condition is met. An upper-floor shop (when upper floors aren't allowed) competes with 0/15 floor points and, if it wins, must move to a ground-floor or mall unit within 30 days. A winner whose approval rests on a fact only reported in chat must have it verified within 7 days.

**Redirect:** would qualify (no hold, score clears the bar) but the pin is taken, has an existing store, or is outside every territory. Offered a free pin in the same territory first, then another territory in the same city with a slot left and a bar they clear. Offers don't take a slot until the applicant confirms a space; if there's nothing to offer, the outcome stays Reject or Waitlist and the reason says so.

**Withdrawn:** set in chat ("APP-020 has withdrawn", "APP-021 is a duplicate of APP-020"); undone with "reinstate". The slot is released and the next in line moves up.

**Flags with a question for the applicant (don't change the outcome):** likely duplicates (same name and pin), 0 years' experience while the notes mention years of running a shop, a festival deadline that can't be met (e.g. Diwali, 8 Nov 2026: setup takes about 3 months), plans to keep or leave a job.

**Chat changes the data, never the rules:** applicant fields (not their notes), status, territory slots or priority, and closing an existing store. Restating something already true is reported as "nothing changed". Every update reply gives the verdict, what changed (before → after), who else moved (including promotions), who in the same territory kept their pin, and how many applicants didn't change. Non-approvals are explained with every blocker and a side-by-side comparison with whoever won.

**Warnings (shown, don't change the outcome):** state not Karnataka; 0 years' experience but the business sounds like retail; launch target under 3 months; no space with a launch of 2 months or less; size over 3,000 sq ft; investment written as a range; no language (English assumed).

**Minimum investment:** Tier 1 ₹30 lakh, Tier 2 ₹22 lakh, Tier 3 ₹18 lakh. Tier comes from the territory, else the city.

**Score (out of 100), only for applicants with no reject or hold:**
- Investment: 10 + 20 × min(1, headroom ÷ 0.5), where headroom = (investment − minimum) ÷ minimum. So 10 at the minimum, 30 at 50% above.
- Experience: under 1 year 0; under 3 years 8; under 6 years 14; 6+ years 20.
- Space: Owned 25, Rented 20.
- Floor: Ground 15, Mall unit 12.
- Launch: 3 months or less 10; 4–6 months 6; later or blank 3.

**Franchisee readiness score (every applicant, display only; `readinessScore` in `lib/engine.js`):** the same five parts, but a missing or failing part scores 0: investment below the minimum or not given, no shop yet, upper / unknown / blank floor (and no floor points without a shop). Labels: 75+ Ready, 50–74 Nearly ready, under 50 Not ready (`READINESS_BANDS` in `lib/constants.js`). For applicants with no reject or hold it equals the score above, so allocation is unchanged; `npm run check` verifies this. It does not include shop size, so an applicant held for a too-small shop can still show as Ready.

**Allocation, per territory:** sort by score, then investment, then ID. Give slots in order. Skip a pin already given to a higher scorer (→ Waitlist). Require a minimum score by territory priority: High 50, Medium 60, Low 70 (below → Waitlist). When slots run out → Waitlist. Hold and Reject applicants never take slots. If a pin code appears in two territories, the first territory listed is used and a note is shown.

**Training plans (our decision; `lib/plan.js`):** under 3 years' experience, full 3-week programme; 3–5 years, 2 weeks; 6+ years, 1-week fast track. In the preferred language (English if blank). Shadow shifts at an existing store in the same city; Tumakuru shadows Bengaluru, Davanagere shadows Hubballi-Dharwad.

**Take next step (recommended partners, our decision):** schedule a site visit, call or agreement signing (saved, with a downloadable .ics calendar invite), the next-step email, and a draft franchise agreement (`lib/agreement.js`): a generic template written for this tool, prefilled from the application, with unknowns (franchisor legal name, addresses, PAN, fee, deposit, royalty, marketing %) left as highlighted blanks. Exports to Word (.doc) or print / PDF. Not legal advice.

## 6. Files

- `lib/parse.js`: reads the template; skips grey example rows only on an exact match; normalises pin codes, cities (with common aliases), fixed-list values.
- `lib/engine.js`: checks, scoring, allocation, `diffResults` for before/after.
- `lib/plan.js`: next steps, training plan, email drafts.
- `lib/snapshot.js`: text snapshot sent to Gemini.
- `lib/chatLocal.js`: chat without Gemini; also normalises update values.
- `app/api/chat/route.js`: server-side Gemini call; the key never reaches the browser.
- `app/page.js`, `app/components/*`: dashboard UI.
- `scripts/check-sample.mjs`: `npm run check`.
- `public/sample-applications.xlsx`: **our own test data** built on the real template. The judges' data will be different.

## 7. How to verify

1. `npm install`, then `npm run check`. All checks must pass.
2. `npm run build`.
3. `npm run dev`, click "Try the sample file", then in the chat:
   - "Why is APP-007 on hold?" → no shop space yet.
   - "APP-012 has now found a ground-floor space" → APP-012 Redirect → Conditional (verify the floor within 7 days); APP-013 Recommended → Redirect (pin 572101).
   - "APP-008 can now invest 31 lakh" → APP-008 Hold → Conditional (verify funds).
   - "Which territories still have open slots?"
4. Repeat step 3 with `OPENROUTER_API_KEY` (or `GEMINI_API_KEY`) set, to test the real Gemini route.
5. Upload the blank template (`docs/Case1_Franchise_Test_Data_Format.xlsx`): it should show a clear "no rows" message, not crash.

## 8. Known limitations

- Cannibalisation is only handled through the one-store-per-pin-code rule. The data has no distances or revenue, so neighbouring pin codes aren't modelled.
- The `xlsx` package on npm stops at 0.18.5, which has published security advisories; newer versions are distributed from SheetJS's own CDN. Parsing runs in the uploader's own browser on their own file, which limits the exposure. Upgrade if time allows.
- Contradiction checks in free text use keyword matching, not AI, so they can miss phrasing they don't recognise.
- State resets on page refresh.

## 9. Suggested next tasks

1. ~~Test the Gemini route with a real key.~~ Done via OpenRouter.
2. Deploy to Vercel; test the public link in a private window.
3. Write a second test file with different traps (e.g. duplicate application IDs, a territory with 0 slots, a pin code listed in two territories) and confirm the outcomes make sense.
