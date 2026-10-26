// Works without Gemini: understands simple questions and updates.
import { floorOf, spaceOf, languageOf } from './parse.js';

const ID_RE = /\b(?:app)[\s-]?(\d{1,4})\b/gi;

export function findIds(message, decisions) {
  const ids = [];
  for (const m of message.matchAll(ID_RE)) {
    const n = m[1];
    const id = Object.keys(decisions).find((k) => {
      const km = k.match(/(\d+)/);
      return km && Number(km[1]) === Number(n);
    });
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseLocalUpdate(message, decision) {
  const s = message.toLowerCase();
  const a = decision.applicant;
  const updates = [];
  const add = (field, value) => updates.push({ id: a.id, field, value });

  const floorHit = /ground[\s-]?floor/.test(s) ? 'Ground' : /\bmall\b/.test(s) ? 'Mall unit' : /(first|second|upper|1st|2nd)\s+floor/.test(s) ? 'Upper' : null;
  if (floorHit) {
    add('floor', floorHit);
    if (a.space === 'Not yet identified' || !a.space) add('space', /\b(bought|own|owns|purchased)\b/.test(s) ? 'Owned' : 'Rented');
  } else if (/\b(bought|purchased)\b/.test(s)) add('space', 'Owned');
  else if (/\b(rented|leased|signed a lease)\b/.test(s)) add('space', 'Rented');

  const money = s.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l\b)/);
  if (money && /(invest|fund|capital|budget|loan|money|raise|arrang|lakh)/.test(s)) add('investment', parseFloat(money[1]));
  const size = s.match(/(\d{2,5})\s*(?:sq|square)/);
  if (size) add('size', parseFloat(size[1]));
  const exp = s.match(/(\d{1,2})\s*years?\s*(?:of\s*)?(?:retail\s*)?experience/);
  if (exp) add('experience', parseFloat(exp[1]));
  const launch = s.match(/(?:launch|open)\w*\s*(?:in|within)\s*(\d{1,2})\s*months?/);
  if (launch) add('launch', parseFloat(launch[1]));
  const pin = s.match(/\b(5\d{5})\b/);
  if (pin) add('pin', pin[1]);
  const lang = /\b(kannada|hindi|english)\b/.exec(s);
  if (lang && /(train|language|prefer)/.test(s)) add('language', languageOf(lang[1]));

  return updates;
}

export function localAnswer(message, result) {
  const ids = findIds(message, result.decisions);
  const s = message.toLowerCase();
  if (ids.length) {
    const d = result.decisions[ids[0]];
    const updates = parseLocalUpdate(message, d);
    const looksLikeNews = /(now|has|have|found|got|secured|moved|arranged|increased|raised|bought|rented|signed|changed|update|can invest|confirmed)/.test(s);
    if (updates.length && looksLikeNews) return { type: 'update', updates, text: `Updating ${d.id}.` };
    return { type: 'answer', text: explain(d) };
  }
  const t = result.territories.find((x) => s.includes(x.id.toLowerCase()));
  if (t) {
    return { type: 'answer', text: `${t.id} (${t.city}, ${t.priority} priority) has ${t.filled} of ${t.slots} slots filled${t.winners.length ? ` by ${t.winners.join(', ')}` : ''}. Pin codes: ${t.pinsState.map((p) => `${p.pin} ${p.status === 'store' ? `has ${p.by}` : p.status === 'awarded' ? `→ ${p.by}` : 'open'}`).join(', ')}.` };
  }
  if (/(open|free|available|remaining)\s+slot|slots?\s+(left|open|free)|territor/.test(s)) {
    const open = result.territories.filter((x) => x.filled < x.slots);
    if (!open.length) return { type: 'answer', text: 'Every territory’s slots are filled in this batch.' };
    return { type: 'answer', text: `Territories with open slots: ${open.map((x) => `${x.id} ${x.city} (${x.slots - x.filled} of ${x.slots} open; open pins ${x.pinsState.filter((p) => p.status === 'open').map((p) => p.pin).join(', ') || 'none'})`).join('; ')}.` };
  }
  const c = result.counts;
  return {
    type: 'answer',
    text: `This batch: ${c.Recommended} recommended, ${c.Waitlist} waitlisted, ${c.Hold} on hold, ${c.Reject} rejected. Ask about an applicant (“Why is APP-007 on hold?”) or tell me something new (“APP-012 has found a ground-floor space”).`,
  };
}

export function explain(d) {
  const parts = [`${d.id} (${d.applicant.name || 'no name'}) is ${d.outcome === 'Hold' ? 'on hold' : d.outcome === 'Waitlist' ? 'waitlisted' : d.outcome === 'Reject' ? 'rejected' : 'recommended'}. ${d.reason}`];
  if (d.outcome === 'Hold') parts.push(`To move forward: ${d.issues.map((h) => h.fix).join(' ')}`);
  if (d.outcome === 'Recommended' && d.scoreParts) parts.push(`Score ${d.score}: investment ${d.scoreParts.investment}/30, experience ${d.scoreParts.experience}/20, space ${d.scoreParts.space}/25, floor ${d.scoreParts.floor}/15, launch ${d.scoreParts.launch}/10.`);
  if (d.warnings.length) parts.push(`Also worth checking: ${d.warnings.join(' ')}`);
  return parts.join(' ');
}

// Keeps updates that name a known applicant and an editable field. An explicit null or empty
// value clears the field; a value that can't be read (e.g. "abc" for a number) is dropped.
export function validUpdates(updates, decisions, fields) {
  return (updates || [])
    .filter((u) => decisions[u.id] && u.field in fields)
    .map((u) => {
      const clear = u.value === null || u.value === undefined || String(u.value).trim() === '';
      return { id: u.id, field: u.field, value: clear ? null : normaliseValue(u.field, u.value), clear };
    })
    .filter((u) => u.clear || u.value !== null)
    .map(({ clear, ...u }) => u);
}

export function normaliseValue(field, value) {
  if (value === null || value === undefined) return null;
  switch (field) {
    case 'investment': case 'experience': case 'size': case 'launch': {
      const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'floor': return floorOf(value);
    case 'space': return spaceOf(value);
    case 'language': return languageOf(value);
    case 'pin': return String(value).replace(/\D/g, '') || null;
    default: return String(value).trim() || null;
  }
}
