// Chat logic shared by both modes: understanding updates without Gemini, checking any update before it's applied,
// explaining decisions (verdict first, every blocker, side by side with whoever won), and summarising what changed.
import { floorOf, spaceOf, languageOf } from './parse.js';
import { EDITABLE_FIELDS, TERRITORY_FIELDS, STORE_FIELDS, STATUS_FIELD } from './constants.js';

export const OUTCOME_LABEL = {
  Recommended: 'Recommended', Conditional: 'Conditional', Redirect: 'Redirect', Waitlist: 'Waitlist',
  Hold: 'On hold', Reject: 'Rejected', Withdrawn: 'Withdrawn',
};
const VERDICT = {
  Recommended: 'recommended', Conditional: 'approved on a condition', Redirect: 'redirected to another pin code',
  Waitlist: 'waitlisted', Hold: 'on hold', Reject: 'rejected', Withdrawn: 'withdrawn',
};
const FIELD_LABEL = { ...EDITABLE_FIELDS, ...TERRITORY_FIELDS, ...STORE_FIELDS, ...STATUS_FIELD };
const firstSentence = (t) => (String(t).match(/^.*?[.!?](\s|$)/) || [t])[0].trim();
const lakh = (v) => (v === null || v === undefined ? '—' : `₹${v}L`);
const show = (v) => (v === null || v === undefined || v === '' ? 'blank' : v === true ? 'yes' : v === false ? 'no' : typeof v === 'string' && v.startsWith('duplicate:') ? `duplicate of ${v.slice(10)}` : v);

// IDs mentioned in a message: "APP-7", "app 007", "TER-02", "ST-01".
function findPrefixed(message, prefix, ids) {
  const re = new RegExp(`\\b${prefix}[\\s-]?(\\d{1,4})\\b`, 'gi');
  const out = [];
  for (const m of message.matchAll(re)) {
    const id = ids.find((k) => (k.match(/(\d+)/) || [])[1] && Number(k.match(/(\d+)/)[1]) === Number(m[1]) && k.toLowerCase().startsWith(prefix));
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function findIds(message, decisions) {
  return findPrefixed(message, 'app', Object.keys(decisions));
}

export function parseLocalUpdate(message, decision, decisions = {}) {
  const s = message.toLowerCase();
  const a = decision.applicant;
  const updates = [];
  const add = (field, value) => updates.push({ id: a.id, field, value });

  // Actions first: they replace field edits.
  const dupOf = findIds(message, decisions).filter((x) => x !== a.id)[0];
  if (/duplicate/.test(s) && dupOf) return [{ id: a.id, field: 'status', value: `duplicate:${dupOf}` }];
  if (/\b(withdr[ae]w\w*|pulled out|backed out|dropp(ed|ing) out|no longer interested)\b/.test(s)) return [{ id: a.id, field: 'status', value: 'withdrawn' }];
  if (/\b(reinstat\w*|back in|re-?apply|rejoin\w*|undo (the )?withdraw\w*)\b/.test(s)) return [{ id: a.id, field: 'status', value: 'active' }];

  const floorHit = /ground[\s-]?floor/.test(s) ? 'Ground' : /\bmall\b/.test(s) ? 'Mall unit' : /(first|second|third|upper|1st|2nd|3rd)\s+floor/.test(s) ? 'Upper' : null;
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

// Side-by-side factors against whoever won the pin or the last slot.
export function versusText(d) {
  const v = d.versus;
  if (!v) return '';
  const a = d.applicant;
  return `${d.id} vs ${v.id} (who ${v.why}): score ${d.score} vs ${v.score}; capital ${lakh(a.investment)} vs ${lakh(v.investment)}; experience ${show(a.experience)}y vs ${show(v.experience)}y; space ${show(a.space)} vs ${show(v.space)}; floor ${show(a.floor)} vs ${show(v.floor)}; launch ${show(a.launch)} vs ${show(v.launch)} months.`;
}

// Every reason this applicant isn't (yet) approved, most serious first.
export function blockers(d) {
  return [...d.rejectReasons, ...d.issues.map((h) => h.issue), ...(d.conditions || []).map((c) => c.issue)];
}

export function explain(d) {
  const lines = [`${d.id} (${d.applicant.name || 'no name'}): ${VERDICT[d.outcome]}.`, d.reason];
  const b = blockers(d);
  if (d.outcome !== 'Recommended' && d.outcome !== 'Withdrawn' && b.length > 1) lines.push(`All blockers: ${b.map((x, i) => `(${i + 1}) ${x}`).join(' ')}`);
  if (d.versus) lines.push(versusText(d));
  if (d.plan?.nextSteps?.length) lines.push(`Next: ${d.plan.nextSteps.slice(0, 2).join(' ')}`);
  if (d.questions?.length && d.outcome !== 'Recommended') lines.push(`Ask them: ${d.questions.slice(0, 3).join(' ')}`);
  if (d.readiness) lines.push(`Franchisee readiness ${d.readiness.total}/100 (${d.readiness.band}).`);
  if (d.warnings.length) lines.push(`Also check: ${d.warnings.join(' ')}`);
  return lines.join('\n');
}

export function localAnswer(message, result) {
  const s = message.toLowerCase();
  const terIds = result.territories.map((t) => t.id);
  const storeIds = [...new Set(result.territories.flatMap((t) => t.pinsState.filter((p) => p.status === 'store').map((p) => p.by)))];

  // "TER-02 now has 3 slots", "ST-01 has closed"
  const ter = findPrefixed(message, 'ter', terIds)[0];
  const slots = s.match(/(\d{1,2})\s*(open\s*)?slots?|slots?\s*(now|to|=|is|are)?\s*(\d{1,2})/);
  if (ter && slots && /(now|has|have|change|set|increase|reduce|open)/.test(s)) {
    return { type: 'update', updates: [{ id: ter, field: 'slots', value: Number(slots[1] || slots[4]) }], text: `Updating ${ter}.` };
  }
  const store = findPrefixed(message, 'st', storeIds)[0] || findPrefixed(message, 'st', ['ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-05', 'ST-06', 'ST-07', 'ST-08', 'ST-09', 'ST-10'])[0];
  if (store && /(clos|shut|exit)/.test(s)) return { type: 'update', updates: [{ id: store, field: 'closed', value: true }], text: `Updating ${store}.` };
  if (store && /(re-?open)/.test(s)) return { type: 'update', updates: [{ id: store, field: 'closed', value: false }], text: `Updating ${store}.` };

  const ids = findIds(message, result.decisions);
  if (ids.length) {
    const d = result.decisions[ids[0]];
    const updates = parseLocalUpdate(message, d, result.decisions);
    const looksLikeNews = /(now|has|have|found|got|secured|moved|arranged|increased|raised|bought|rented|signed|changed|update|can invest|confirmed|withdr|pulled|backed|dropp|duplicate|reinstat|back in)/.test(s);
    if (updates.length && looksLikeNews) return { type: 'update', updates, text: `Updating ${d.id}.` };
    return { type: 'answer', text: explain(d) };
  }
  const t = result.territories.find((x) => s.includes(x.id.toLowerCase()));
  if (t) {
    return { type: 'answer', text: `${t.id} (${t.city}, ${t.priority} priority) has ${t.filled} of ${t.slots} slots filled${t.winners.length ? ` by ${t.winners.join(', ')}` : ''}. Pin codes: ${t.pinsState.map((p) => `${p.pin} ${p.status === 'store' ? `has ${p.by}` : p.status === 'awarded' ? `→ ${p.by}` : p.status === 'offered' ? `offered to ${p.by}` : 'open'}`).join(', ')}.` };
  }
  if (/(open|free|available|remaining)\s+slot|slots?\s+(left|open|free)|territor/.test(s)) {
    const open = result.territories.filter((x) => x.filled < x.slots);
    if (!open.length) return { type: 'answer', text: 'Every territory’s slots are filled in this batch.' };
    return { type: 'answer', text: `Territories with open slots: ${open.map((x) => `${x.id} ${x.city} (${x.slots - x.filled} of ${x.slots} open; free pins ${x.pinsState.filter((p) => p.status === 'open').map((p) => p.pin).join(', ') || 'none'})`).join('; ')}.` };
  }
  const c = result.counts;
  return {
    type: 'answer',
    text: `This batch: ${c.Recommended} recommended, ${c.Conditional} conditional, ${c.Redirect} redirected, ${c.Waitlist} waitlisted, ${c.Hold} on hold, ${c.Reject} rejected${c.Withdrawn ? `, ${c.Withdrawn} withdrawn` : ''}. Ask about an applicant (“Why is APP-007 on hold?”) or tell me something new (“APP-012 has found a ground-floor space”, “APP-020 has withdrawn”, “TER-05 now has 3 slots”).`,
  };
}

// Chat changes, keyed by ID: applicant fields (status goes to the engine separately), territory slots or priority,
// and closed stores (which drop out of the Existing stores list).
export function applyOverrides(base, overrides) {
  if (!base) return null;
  const fields = ({ status, ...rest }) => rest;
  return {
    ...base,
    applications: base.applications.map((a) => (overrides[a.id] ? { ...a, ...fields(overrides[a.id]) } : a)),
    territories: base.territories.map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id] } : t)),
    stores: base.stores.filter((st) => !overrides[st.id]?.closed),
  };
}

// Current value of an applicant, territory or store field, from the uploaded data plus chat changes so far.
export function makeLookup(base, overrides) {
  return (id) => {
    const a = base.applications.find((x) => x.id === id);
    if (a) return { kind: 'applicant', get: (f) => (f === 'status' ? overrides[id]?.status || 'active' : (overrides[id] && f in overrides[id] ? overrides[id][f] : a[f])) };
    const t = base.territories.find((x) => x.id === id);
    if (t) return { kind: 'territory', get: (f) => (overrides[id] && f in overrides[id] ? overrides[id][f] : t[f]) };
    const st = base.stores.find((x) => x.id === id);
    if (st) return { kind: 'store', get: (f) => (f === 'closed' ? !!overrides[id]?.closed : st[f]) };
    return null;
  };
}

const FIELDS_BY_KIND = { applicant: { ...EDITABLE_FIELDS, ...STATUS_FIELD }, territory: TERRITORY_FIELDS, store: STORE_FIELDS };

// "APP-12", "app 12" and "APP-012" all name the same applicant.
function resolveId(raw, lookup) {
  const m = String(raw || '').trim().toUpperCase().match(/^([A-Z]+)[\s-]*0*(\d+)(.*)$/);
  if (!m) return null;
  for (const pad of [3, 2, 1, 4]) {
    const id = `${m[1]}-${m[2].padStart(pad, '0')}${m[3]}`;
    if (lookup(id)) return id;
  }
  return null;
}

// Keeps updates that name a known applicant, territory or store and a field the chat may change, normalises the
// value, and records the value before the change and whether it actually differs. An explicit null or empty value
// clears an applicant field; a value that can't be read (e.g. "abc" for a number) is dropped.
export function validUpdates(updates, lookup) {
  const out = [];
  for (const u of updates || []) {
    const id = resolveId(u.id, lookup);
    const info = id && lookup(id);
    if (!info || !(u.field in FIELDS_BY_KIND[info.kind])) continue;
    const clear = info.kind === 'applicant' && u.field !== 'status' && (u.value === null || u.value === undefined || String(u.value).trim() === '');
    const value = clear ? null : normaliseValue(u.field, u.value, lookup);
    if (!clear && (value === null || value === undefined)) continue;
    const before = info.get(u.field) ?? null;
    const same = typeof value === 'number' || typeof before === 'number'
      ? Number(value) === Number(before) && before !== null
      : String(value ?? '').toLowerCase() === String(before ?? '').toLowerCase();
    out.push({ id, kind: info.kind, field: u.field, value, before, same });
  }
  return out;
}

export function normaliseValue(field, value, lookup) {
  if (value === null || value === undefined) return null;
  switch (field) {
    case 'investment': case 'experience': case 'size': case 'launch': case 'slots': {
      const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.]/g, ''));
      if (!Number.isFinite(n)) return null;
      return field === 'slots' ? Math.max(0, Math.round(n)) : n;
    }
    case 'floor': return floorOf(value);
    case 'space': return spaceOf(value);
    case 'language': return languageOf(value);
    case 'pin': return String(value).replace(/\D/g, '') || null;
    case 'priority': { const p = String(value).trim().toLowerCase(); return p.startsWith('h') ? 'High' : p.startsWith('m') ? 'Medium' : p.startsWith('l') ? 'Low' : null; }
    case 'closed': return value === true || /^(true|yes|closed|close|1)$/i.test(String(value).trim()) ? true : /^(false|no|open|reopen\w*|0)$/i.test(String(value).trim()) ? false : null;
    case 'status': {
      const v = String(value).trim().toLowerCase();
      const dup = v.match(/dup\w*[:\s-]*(?:of\s*)?(app[\s-]?\d{1,4})/);
      if (dup) {
        const id = lookup && resolveId(dup[1], lookup);
        return id && lookup(id).kind === 'applicant' ? `duplicate:${id}` : null;
      }
      if (/withdr|pull|back|drop|inactive/.test(v)) return 'withdrawn';
      if (/active|reinstat|restor|undo/.test(v)) return 'active';
      return null;
    }
    default: return String(value).trim() || null;
  }
}

const fieldText = (u) => `${u.id} ${String(FIELD_LABEL[u.field] || u.field).toLowerCase()}`;

// Reply when every requested change was already true.
export function noChangeReply(same, result) {
  const lines = [`Nothing changed: ${same.map((u) => `${fieldText(u)} is already ${show(u.before)}`).join('; ')}.`];
  const d = same[0].kind === 'applicant' ? result.decisions[same[0].id] : null;
  if (d) {
    const b = blockers(d);
    lines.push(`${d.id} is still ${VERDICT[d.outcome]}.${b.length && d.outcome !== 'Recommended' ? ` The real blocker: ${b[0]}` : ''}`);
    if (d.versus) lines.push(versusText(d));
  }
  return { role: 'bot', text: lines.join('\n') };
}

// Reply after an update: verdict for what was updated, what changed (before → after), who else moved,
// who in the same territory is unaffected, and how many applicants didn't change.
export function summariseUpdate({ applied, same = [], changes, prev, next }) {
  const lines = [];
  const appIds = [...new Set(applied.filter((u) => u.kind === 'applicant').map((u) => u.id))];
  for (const id of appIds) {
    const p = prev.decisions[id];
    const d = next.decisions[id];
    lines.push(p.outcome === d.outcome ? `${id}: still ${OUTCOME_LABEL[d.outcome]}.` : `${id}: ${OUTCOME_LABEL[p.outcome]} → ${OUTCOME_LABEL[d.outcome]}.`);
    lines.push(firstSentence(d.reason));
    if (d.plan?.nextSteps?.[0]) lines.push(`Next: ${d.plan.nextSteps[0]}`);
  }
  const changed = [`Changed: ${applied.map((u) => `${fieldText(u)} ${show(u.before)} → ${show(u.value)}`).join('; ')}.`];
  if (same.length) changed.push(`Already true, no change: ${same.map((u) => `${fieldText(u)} (${show(u.before)})`).join('; ')}.`);

  const others = changes.filter((c) => !appIds.includes(c.id)).map((c) => ({
    id: c.id,
    text: c.from === c.to && c.to === 'Redirect'
      ? `${c.id}: still Redirect, now offered pin ${c.toPin} (was ${c.fromPin}).`
      : `${c.id}: ${OUTCOME_LABEL[c.from]} → ${OUTCOME_LABEL[c.to]}${['Waitlist', 'Redirect', 'Hold'].includes(c.from) && ['Recommended', 'Conditional'].includes(c.to) ? ' (promoted)' : ''}${c.to === 'Redirect' && c.toPin ? `, offered pin ${c.toPin}` : ''}. ${firstSentence(c.reason)}`,
  }));
  const changedIds = new Set(changes.map((c) => c.id));
  appIds.forEach((id) => changedIds.add(id));

  // Winners in the territories touched by this update who kept their pin.
  const touched = new Set([
    ...appIds.flatMap((id) => [prev.decisions[id].territoryId, next.decisions[id].territoryId]),
    ...applied.filter((u) => u.kind === 'territory').map((u) => u.id),
    ...changes.flatMap((c) => [prev.decisions[c.id]?.territoryId, next.decisions[c.id]?.territoryId]),
  ].filter(Boolean));
  const kept = Object.values(next.decisions).filter((d) => touched.has(d.territoryId) && !changedIds.has(d.id) && ['Recommended', 'Conditional'].includes(d.outcome));
  const unchanged = Object.keys(next.decisions).length - changedIds.size;

  return {
    role: 'bot',
    text: lines.join('\n') || changed.join('\n'),
    detail: lines.length ? changed : [],
    changes: others,
    unaffected: [
      ...kept.map((d) => `${d.id} unaffected, still holds ${d.applicant.pin}.`),
      changedIds.size ? `${unchanged} other applicant${unchanged === 1 ? '' : 's'} unchanged.` : `No outcomes changed (all ${unchanged} applicants re-checked).`,
    ],
    footer: 'Every decision in the batch was re-run.',
    verify: applied.some((u) => u.kind === 'applicant' && u.field !== 'status'),
  };
}
