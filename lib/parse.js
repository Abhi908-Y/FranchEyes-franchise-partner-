import * as XLSX from 'xlsx';
import { CITIES, CITY_ALIASES } from './constants.js';

const low = (v) => String(v ?? '').trim().toLowerCase();
const text = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function pinOf(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return String(Math.round(v));
  const d = String(v).replace(/\D/g, '');
  return d === '' ? null : d;
}

export function pinList(v) {
  if (v === null || v === undefined || v === '') return [];
  if (typeof v === 'number') return [String(Math.round(v))];
  return String(v)
    .split(/[,;\s/|]+/)
    .map(pinOf)
    .filter(Boolean);
}

export function cityOf(v) {
  const s = low(v);
  if (!s) return null;
  if (CITY_ALIASES[s]) return CITY_ALIASES[s];
  const hit = Object.keys(CITIES).find((c) => low(c) === s);
  return hit || String(v).trim();
}

export function spaceOf(v) {
  const s = low(v);
  if (!s) return null;
  if (s.includes('own')) return 'Owned';
  if (s.includes('rent') || s.includes('lease')) return 'Rented';
  if (s.includes('not') || s.includes('yet') || s === 'no' || s.includes('none')) return 'Not yet identified';
  return String(v).trim();
}

export function floorOf(v) {
  const s = low(v);
  if (!s) return null;
  if (s.includes('mall')) return 'Mall unit';
  if (s.includes('ground')) return 'Ground';
  if (s.includes('not known') || s.includes('unknown') || s === 'na' || s === 'n/a') return 'Not known';
  if (/(upper|first|second|third|1st|2nd|3rd|top)/.test(s)) return 'Upper';
  return String(v).trim();
}

export function languageOf(v) {
  const s = low(v);
  if (!s) return null;
  if (s.includes('kannada')) return 'Kannada';
  if (s.includes('hindi')) return 'Hindi';
  if (s.includes('english')) return 'English';
  return String(v).trim();
}

const priorityOf = (v) => {
  const s = low(v);
  if (s.startsWith('h')) return 'High';
  if (s.startsWith('m')) return 'Medium';
  if (s.startsWith('l')) return 'Low';
  return text(v);
};

const tierOf = (v) => {
  const m = low(v).match(/[123]/);
  return m ? `Tier ${m[0]}` : null;
};

function findSheet(wb, keys, fallbackIndex) {
  const name = wb.SheetNames.find((n) => keys.some((k) => low(n).includes(k)));
  const chosen = name ?? wb.SheetNames[fallbackIndex];
  return chosen ? wb.Sheets[chosen] : null;
}

function mapHeaders(headerRow, spec) {
  const used = new Set();
  const map = {};
  for (const [field, test] of spec) {
    const idx = headerRow.findIndex((h, i) => !used.has(i) && h && test(low(h)));
    if (idx >= 0) {
      map[field] = idx;
      used.add(idx);
    }
  }
  return map;
}

function readTable(ws, firstHeader, spec) {
  if (!ws) return { rows: [], missingSheet: true };
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
  const h = all.findIndex((r) => Array.isArray(r) && r.some((c) => low(c) === firstHeader));
  if (h < 0) return { rows: [], missingHeader: true };
  const map = mapHeaders(all[h], spec);
  const rows = [];
  for (const r of all.slice(h + 1)) {
    const rec = {};
    for (const [f, i] of Object.entries(map)) rec[f] = r[i] ?? null;
    if (rec.id === null || String(rec.id).trim() === '') continue;
    rows.push(rec);
  }
  return { rows };
}

const APP_SPEC = [
  ['id', (h) => h.includes('application id')],
  ['name', (h) => h.includes('name')],
  ['city', (h) => h.startsWith('city')],
  ['state', (h) => h.startsWith('state')],
  ['pin', (h) => h.includes('pin')],
  ['investment', (h) => h.includes('invest')],
  ['experience', (h) => h.includes('experience')],
  ['business', (h) => h.includes('business')],
  ['space', (h) => h.includes('space') && h.includes('avail')],
  ['size', (h) => h.includes('size') || h.includes('sq')],
  ['floor', (h) => h.includes('floor')],
  ['launch', (h) => h.includes('launch')],
  ['language', (h) => h.includes('language')],
  ['notes', (h) => h.includes('note')],
];

const TER_SPEC = [
  ['id', (h) => h.includes('territory id')],
  ['city', (h) => h.startsWith('city') && !h.includes('tier')],
  ['state', (h) => h.startsWith('state')],
  ['pins', (h) => h.includes('pin')],
  ['tier', (h) => h.includes('tier')],
  ['slots', (h) => h.includes('slot')],
  ['priority', (h) => h.includes('priority')],
];

const STORE_SPEC = [
  ['id', (h) => h.includes('store id')],
  ['city', (h) => h.startsWith('city')],
  ['pin', (h) => h.includes('pin')],
  ['year', (h) => h.includes('open') || h.includes('year')],
];

// The template's grey example rows. Skipped only when they match exactly.
const isExampleApp = (r) =>
  low(r.id) === 'app-001' && low(r.name) === 'ravi kumar' && pinOf(r.pin) === '570001' && low(r.notes).includes('diwali');
const isExampleTer = (r) =>
  low(r.id) === 'ter-01' && pinList(r.pins).join(',') === '570001,570002,570008' && num(r.slots) === 3 && low(r.priority) === 'high';

export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const notes = [];

  const a = readTable(findSheet(wb, ['application'], 0), 'application id', APP_SPEC);
  const t = readTable(findSheet(wb, ['territor'], 1), 'territory id', TER_SPEC);
  const s = readTable(findSheet(wb, ['existing', 'store'], 2), 'store id', STORE_SPEC);

  if (a.missingSheet || a.missingHeader) throw new Error('Couldn’t find the Applications sheet. Check the file uses the case template (a header row starting with “Application ID”).');
  if (t.missingSheet || t.missingHeader) throw new Error('Couldn’t find the Territories sheet. Check the file uses the case template (a header row starting with “Territory ID”).');

  let appRows = a.rows;
  if (appRows.length && isExampleApp(appRows[0])) {
    appRows = appRows.slice(1);
    notes.push('Skipped the template’s grey example applicant (APP-001, Ravi Kumar).');
  }
  let terRows = t.rows;
  if (terRows.length && isExampleTer(terRows[0])) {
    terRows = terRows.slice(1);
    notes.push('Skipped the template’s grey example territory (TER-01).');
  }

  const seen = new Map();
  const applications = appRows.map((r) => {
    let id = String(r.id).trim();
    if (seen.has(id)) {
      const n = seen.get(id) + 1;
      seen.set(id, n);
      notes.push(`Application ID ${id} appears more than once; the extra row is labelled ${id}#${n}.`);
      id = `${id}#${n}`;
    } else seen.set(id, 1);
    return {
      id,
      name: text(r.name),
      city: cityOf(r.city),
      state: text(r.state),
      pin: pinOf(r.pin),
      investment: num(r.investment),
      investmentRaw: text(r.investment),
      experience: num(r.experience),
      business: text(r.business),
      space: spaceOf(r.space),
      size: num(r.size),
      floor: floorOf(r.floor),
      launch: num(r.launch),
      language: languageOf(r.language),
      notes: text(r.notes),
    };
  });

  const territories = terRows.map((r) => ({
    id: String(r.id).trim(),
    city: cityOf(r.city),
    state: text(r.state),
    pins: pinList(r.pins),
    tier: tierOf(r.tier),
    slots: Math.max(0, Math.floor(num(r.slots) ?? 0)),
    priority: priorityOf(r.priority) || 'Medium',
  }));

  const stores = (s.rows.length ? s.rows : DEFAULT_STORES).map((r) => ({
    id: String(r.id).trim(),
    city: cityOf(r.city),
    pin: pinOf(r.pin),
    year: num(r.year),
  }));
  if (!s.rows.length) notes.push('No Existing stores sheet found, so the case’s fixed list of 10 stores was used.');

  return { applications, territories, stores, notes };
}

// The fixed list from the case, used only if the sheet is missing.
const DEFAULT_STORES = [
  ['ST-01', 'Bengaluru', '560001', 2019], ['ST-02', 'Bengaluru', '560034', 2020],
  ['ST-03', 'Bengaluru', '560038', 2021], ['ST-04', 'Bengaluru', '560066', 2022],
  ['ST-05', 'Bengaluru', '560076', 2023], ['ST-06', 'Mysuru', '570009', 2021],
  ['ST-07', 'Mysuru', '570017', 2024], ['ST-08', 'Mangaluru', '575001', 2022],
  ['ST-09', 'Hubballi-Dharwad', '580020', 2023], ['ST-10', 'Belagavi', '590001', 2024],
].map(([id, city, pin, year]) => ({ id, city, pin, year }));
