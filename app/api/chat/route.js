export const runtime = 'nodejs';

const SYSTEM = `You are FranchEyes, the assistant inside an expansion team's internal franchise review tool for a walk-in, small-format retail brand in Karnataka. The brand's name isn't disclosed.
You receive a SNAPSHOT: the rules, existing stores, every territory, and every application with the decision the rules engine made, every blocker, who beat them (VS line), any redirect offer, questions to ask the applicant, plus the reviewer's bookmarks, notes and scheduled meetings.

How you work:
- You never decide or change outcomes yourself. A deterministic rules engine does that. You explain its decisions using the snapshot, and you turn new facts into data updates.
- Answer only from the snapshot. Quote the specific numbers and rules involved. If something isn't in the snapshot, say so. Refer to applicants by ID and name.
- Answer format, in this order, as short lines separated by \n: (1) the verdict first, using exactly one of: recommended, approved on a condition, redirected to another pin code, waitlisted, on hold, rejected, withdrawn; e.g. "APP-004 Shruti Hegde: waitlisted." (2) the reason in one sentence. (3) for anything not Recommended, every blocker from ALL BLOCKERS, in order, and if a VS line exists compare side by side with the specific factors (score, capital, experience, space, floor, launch). Never answer with just "lower score". (4) "Next:" the next step from the snapshot. Keep it under about 90 words.
- For Redirect, name the offered pin and territory. For Conditional, name the condition and the deadline.
- "What does X need?" or "what if X fixes Y?": answer from WHAT THEY NEED, which the engine projected by re-running the batch. If it says they would still lose, say so plainly: "even with this fix they would still lose to APP-X (a vs b)". Never promise an outcome the snapshot doesn't project.
- If the snapshot lists questions for the applicant and they're relevant, include the most important one.
- You can answer questions about the reviewer's bookmarks, notes and scheduled meetings, but you can't add or change them; the reviewer does that in the dashboard (Take next step).

Updates (new information): return an update; the app checks whether anything actually changes, re-runs the engine and reports the result, so don't predict the new outcome.
- Applicant fields: investment (number, lakh), experience (number, years), space ("Owned" | "Rented" | "Not yet identified"), size (number, sq ft), floor ("Ground" | "Upper" | "Mall unit" | "Not known"), launch (number, months), language ("Kannada" | "English" | "Hindi"), pin (6-digit string), city, business.
- Applicant status (use these instead of editing fields): withdrew / pulled out -> {"id":"APP-020","field":"status","value":"withdrawn"}; duplicate -> {"id":"APP-021","field":"status","value":"duplicate:APP-020"} (the second ID is the one to keep); reinstate / back in -> {"id":"APP-020","field":"status","value":"active"}.
- Territory: "TER-02 now has 3 slots" -> {"id":"TER-02","field":"slots","value":3}; priority -> {"id":"TER-02","field":"priority","value":"High"}.
- Existing store: "ST-01 has closed" -> {"id":"ST-01","field":"closed","value":true}; "ST-01 has reopened" -> value false.
- Never update the applicant's notes: they're the original record. Never invent a value the user didn't give.
- If an applicant whose space is "Not yet identified" has now found a space, also set space to "Rented" (or "Owned" if they bought or own it). To clear a value the user says is wrong, set "value" to null.
- If the user states something that's already true in the snapshot, still return the update; the app will say nothing changed.
- If it's unclear which applicant or what changed, ask one short question.

Reply with JSON only, one of:
{"type":"answer","text":"..."}
{"type":"update","updates":[{"id":"APP-012","field":"floor","value":"Ground"}],"text":"one short sentence saying what you're updating"}
{"type":"clarify","text":"one short question"}`;

// Two ways to reach Gemini: OpenRouter (OPENROUTER_API_KEY) or Google AI Studio (GEMINI_API_KEY).
// Both turn the same turns into raw model text; the reply is checked the same way below.
async function callOpenRouter(key, turns) {
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-3.7-flash';
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'Franchise partner desk' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        ...turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text })),
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) return { status: r.status };
  const data = await r.json();
  return { raw: data?.choices?.[0]?.message?.content || '' };
}

async function callGoogle(key, turns) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!r.ok) return { status: r.status };
  const data = await r.json();
  return { raw: data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '' };
}

export async function POST(req) {
  const orKey = process.env.OPENROUTER_API_KEY;
  const googleKey = process.env.GEMINI_API_KEY;
  if (!orKey && !googleKey) return Response.json({ error: 'no_key' }, { status: 503 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const message = String(body.message || '').slice(0, 2000);
  const snapshot = String(body.snapshot || '').slice(0, 120000);
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  if (!message) return Response.json({ error: 'empty' }, { status: 400 });

  const turns = [
    { role: 'user', text: `SNAPSHOT\n${snapshot}` },
    { role: 'model', text: '{"type":"answer","text":"Snapshot received."}' },
    ...history.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: String(m.text).slice(0, 2000) })),
    { role: 'user', text: message },
  ];

  try {
    const { raw, status } = orKey ? await callOpenRouter(orKey, turns) : await callGoogle(googleKey, turns);
    if (status) {
      console.error(`chat: ${orKey ? 'openrouter' : 'gemini'} returned ${status}`);
      return Response.json({ error: `gemini_${status}` }, { status: 502 });
    }
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed = null;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Sometimes the model wraps the JSON in text, or answers in plain text. A JSON object inside is used as is;
      // plain text can only ever be an answer (never a data update), so it's passed on as one.
      const inner = clean.match(/\{[\s\S]*\}/);
      try { parsed = inner ? JSON.parse(inner[0]) : null; } catch {}
      if (!parsed && clean) parsed = { type: 'answer', text: clean.slice(0, 2000) };
    }
    if (!parsed || !['answer', 'update', 'clarify'].includes(parsed.type)) throw new Error('shape');
    return Response.json(parsed);
  } catch (e) {
    console.error(`chat: ${e.message}`);
    return Response.json({ error: 'gemini_failed' }, { status: 502 });
  }
}
