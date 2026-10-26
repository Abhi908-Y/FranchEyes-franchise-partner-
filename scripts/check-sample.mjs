// Run with: npm run check
// Verifies the decision engine against public/sample-applications.xlsx.
import fs from 'node:fs';
import { parseWorkbook } from '../lib/parse.js';
import { runEngine, diffResults } from '../lib/engine.js';
import { DEFAULT_PROFILE, EDITABLE_FIELDS, profileFor } from '../lib/constants.js';
import { validUpdates } from '../lib/chatLocal.js';

const expected = {
  'APP-002': 'Recommended', 'APP-003': 'Recommended', 'APP-004': 'Waitlist', 'APP-005': 'Reject',
  'APP-006': 'Recommended', 'APP-007': 'Hold', 'APP-008': 'Hold', 'APP-009': 'Reject',
  'APP-010': 'Waitlist', 'APP-011': 'Recommended', 'APP-012': 'Hold', 'APP-013': 'Recommended',
  'APP-014': 'Waitlist', 'APP-015': 'Hold', 'APP-016': 'Reject', 'APP-017': 'Hold',
  'APP-018': 'Hold', 'APP-019': 'Hold', 'APP-020': 'Hold',
};

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

const buf = fs.readFileSync(new URL('../public/sample-applications.xlsx', import.meta.url));
const data = parseWorkbook(buf);
check(data.applications.length === 19, `19 applicants read (got ${data.applications.length}); grey example APP-001 skipped`);
check(data.territories.length === 6, `6 territories read (got ${data.territories.length}); grey example TER-01 skipped`);
check(data.stores.length === 10, `10 existing stores read (got ${data.stores.length})`);

const r = runEngine(data, DEFAULT_PROFILE);
for (const [id, want] of Object.entries(expected)) {
  const d = r.decisions[id];
  check(d && d.outcome === want, `${id} → ${want} (got ${d?.outcome}): ${d?.reason}`);
}

// Hard rule: never two stores in one pin code.
const storePins = new Set(data.stores.map((s) => s.pin));
const recPins = Object.values(r.decisions).filter((d) => d.outcome === 'Recommended').map((d) => d.applicant.pin);
check(new Set(recPins).size === recPins.length, 'No two recommended applicants share a pin code');
check(recPins.every((p) => !storePins.has(p)), 'No recommended applicant is in an existing store’s pin code');
check(r.territories.every((t) => t.filled <= t.slots), 'No territory has more recommendations than open slots');

// Chat update: APP-012 finds a ground-floor space.
const overrides = { 'APP-012': { floor: 'Ground' } };
const data2 = { ...data, applications: data.applications.map((a) => (overrides[a.id] ? { ...a, ...overrides[a.id] } : a)) };
const r2 = runEngine(data2, DEFAULT_PROFILE, { updated: overrides });
const changes = diffResults(r, r2);
check(r2.decisions['APP-012'].outcome === 'Recommended', `After update, APP-012 → Recommended (got ${r2.decisions['APP-012'].outcome})`);
check(r2.decisions['APP-013'].outcome === 'Waitlist', `After update, APP-013 → Waitlist, pin 572101 taken (got ${r2.decisions['APP-013'].outcome})`);
check(changes.length === 2, `Update reports exactly 2 changes (got ${changes.length})`);

// Readiness score: every applicant gets one, and it matches the allocation score wherever that exists.
const ds = Object.values(r.decisions);
check(ds.every((d) => Number.isInteger(d.readiness?.total) && d.readiness.total >= 0 && d.readiness.total <= 100 && d.readiness.band),
  `Every applicant has a readiness score 0-100 with a label (${ds.map((d) => `${d.id} ${d.readiness?.total}`).join(', ')})`);
check(ds.filter((d) => d.score !== null).every((d) => d.readiness.total === d.score),
  'Readiness equals the allocation score for every applicant who passed all checks');

// Category rules. Eyewear (Lenskart) must match the defaults exactly; a gym allows upper floors and needs more space.
const eye = runEngine(data, profileFor('eyewear', 'Lenskart'));
check(ds.every((d) => eye.decisions[d.id].outcome === d.outcome && eye.decisions[d.id].readiness.total === d.readiness.total),
  'Eyewear category gives exactly the default outcomes and readiness scores');
const gym = runEngine(data, profileFor('fitness', 'Cult.fit'));
const gymReasons = Object.values(gym.decisions).flatMap((d) => d.issues.map((h) => h.issue));
check(!gymReasons.some((t) => /upper floor/i.test(t)), `Gym category never holds anyone for an upper floor (got: ${gymReasons.filter((t) => /upper floor/i.test(t)).join(' | ') || 'none'})`);
check(gym.decisions['APP-012'].issues.some((h) => /below the 2500 sq ft minimum/.test(h.issue)),
  `Gym category holds APP-012 for size, not floor (got: ${gym.decisions['APP-012'].reason})`);
check(Object.values(gym.decisions).filter((d) => d.score !== null).every((d) => d.readiness.total === d.score),
  'Gym category: readiness still equals the allocation score for everyone who passed all checks');

// Chat update that clears a field: APP-017 hasn't found a shop, so its size and floor are wiped.
const cleared = validUpdates([
  { id: 'APP-017', field: 'size', value: null },
  { id: 'APP-017', field: 'floor', value: 'Not known' },
  { id: 'APP-017', field: 'size', value: 'abc' },
], r.decisions, EDITABLE_FIELDS);
check(cleared.length === 2 && cleared[0].value === null, `A null value clears a field; an unreadable one is dropped (got ${JSON.stringify(cleared)})`);
const o3 = { 'APP-017': { size: null, floor: 'Not known' } };
const r3 = runEngine({ ...data, applications: data.applications.map((a) => (o3[a.id] ? { ...a, ...o3[a.id] } : a)) }, DEFAULT_PROFILE, { updated: o3 });
check(r3.decisions['APP-017'].reason === 'No shop space found yet.', `After clearing, APP-017 is on hold for no shop space (got: ${r3.decisions['APP-017'].reason})`);

console.log(failures ?`\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
