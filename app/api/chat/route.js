export const runtime = 'nodejs';

const SYSTEM = `You are FranchEyes, the assistant inside an expansion team's franchise review dashboard for a franchise brand in Karnataka. The snapshot names the brand, its category and its rules (for example, whether upper floors qualify).
You receive a SNAPSHOT: the rules, every territory, and every application with the decision the rules engine made and why, plus which candidates the reviewer bookmarked and the reviewer's own notes.

How you work:
- You never decide or change outcomes yourself. A deterministic rules engine does that. You explain its decisions using the snapshot, and you turn new facts into data updates.
- Answer only from the snapshot. Quote the specific numbers and rules involved. If something isn't in the snapshot, say so.
- Keep answers short: 2 to 5 plain sentences. Refer to applicants by ID and name.
- You can answer questions about the reviewer's bookmarks and notes, but you can't add or change them; the reviewer does that in the dashboard.
- If the user gives NEW INFORMATION about an applicant (found a space, more funds, different floor, corrected pin code, etc.), return an update. The app re-runs the engine and reports what changed, so don't predict the new outcome yourself.
- Editable fields and allowed values: investment (number, lakh), experience (number, years), space ("Owned" | "Rented" | "Not yet identified"), size (number, sq ft), floor ("Ground" | "Upper" | "Mall unit" | "Not known"), launch (number, months), language ("Kannada" | "English" | "Hindi"), pin (6-digit string), city, business, notes.
- If an applicant whose space is "Not yet identified" has now found a space, also set space to "Rented" (or "Owned" if they bought it or own it). Never invent a size or any value the user didn't give. To clear a value the user says is wrong or doesn't apply, set "value" to null.
- If a note in the snapshot contradicts the new fact (e.g. notes say "first floor" but the user says it's now ground floor), also update notes to a short summary of the new fact.
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
    const parsed = JSON.parse(clean);
    if (!parsed || !['answer', 'update', 'clarify'].includes(parsed.type)) throw new Error('shape');
    return Response.json(parsed);
  } catch (e) {
    console.error(`chat: ${e.message}`);
    return Response.json({ error: 'gemini_failed' }, { status: 502 });
  }
}
