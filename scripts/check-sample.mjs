// Run with: npm run check
// Verifies the decision engine and the chat's update handling against public/sample-applications.xlsx.
import fs from 'node:fs';
import { parseWorkbook } from '../lib/parse.js';
import { runEngine, diffResults } from '../lib/engine.js';
import { DEFAULT_PROFILE, EDITABLE_FIELDS } from '../lib/constants.js';
import { agreementFields, agreementHtml } from '../lib/agreement.js';
import { validUpdates, makeLookup, applyOverrides, summariseUpdate } from '../lib/chatLocal.js';

// Fixed "today" so date-based flags (e.g. Diwali) give the same result on every run.
const TODAY = '2026-10-26T12:00:00+05:30';

const expected = {
  'APP-002': 'Recommended', 'APP-003': 'Recommended', 'APP-004': 'Waitlist', 'APP-005': 'Reject',
  'APP-006': 'Recommended', 'APP-007': 'Hold', 'APP-008': 'Hold', 'APP-009': 'Reject',
  'APP-010': 'Waitlist', 'APP-011': 'Recommended', 'APP-012': 'Redirect', 'APP-013': 'Recommended',
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

const run = (ov = {}) => runEngine(applyOverrides(data, ov), DEFAULT_PROFILE, { updated: ov, today: TODAY });
const r = run();
for (const [id, want] of Object.entries(expected)) {
  const d = r.decisions[id];
  check(d && d.outcome === want, `${id} → ${want} (got ${d?.outcome}): ${d?.reason}`);
}

// Hard rule: never two stores in one pin code, counting slot winners and pins offered to redirected applicants.
const storePins = new Set(data.stores.map((s) => s.pin));
const taken = Object.values(r.decisions).filter((d) => ['Recommended', 'Conditional'].includes(d.outcome)).map((d) => d.applicant.pin);
const offered = Object.values(r.decisions).filter((d) => d.redirect).map((d) => d.redirect.pin);
check(new Set([...taken, ...offered]).size === taken.length + offered.length, 'No two winners or redirect offers share a pin code');
check([...taken, ...offered].every((p) => !storePins.has(p)), 'No winner or redirect offer is in an existing store’s pin code');
check(r.territories.every((t) => t.filled <= t.slots), 'No territory has more winners than open slots');

// Upper floor is a condition, not a wall: APP-012 competes, loses pin 572101 to APP-013 and is redirected to a free pin.
const d12 = r.decisions['APP-012'];
check(d12.redirect && d12.redirect.territoryId === 'TER-05' && d12.redirect.pin !== '572101' && d12.versus?.id === 'APP-013',
  `APP-012 is offered a free pin in TER-05 and compared with APP-013 (offer: ${JSON.stringify(d12.redirect)})`);

// Waitlisted applicants are compared side by side with whoever beat them.
check(r.decisions['APP-004'].versus?.id === 'APP-003' && /capital ₹\d+L vs ₹\d+L/.test(summariseVs(r.decisions['APP-004'])),
  `APP-004 is compared with APP-003, who took the last slot (${summariseVs(r.decisions['APP-004'])})`);
function summariseVs(d) { return d.versus ? `capital ₹${d.applicant.investment}L vs ₹${d.versus.investment}L, experience ${d.applicant.experience}y vs ${d.versus.experience}y` : 'none'; }

// Chat update: APP-012 finds a ground-floor space. It wins the pin, conditional until verified; APP-013 is redirected.
const r2 = run({ 'APP-012': { floor: 'Ground' } });
const changes = diffResults(r, r2);
check(r2.decisions['APP-012'].outcome === 'Conditional' && /floor/.test(r2.decisions['APP-012'].conditions.map((c) => c.issue).join(' ')),
  `After the update, APP-012 → Conditional until the floor is verified (got ${r2.decisions['APP-012'].outcome})`);
check(r2.decisions['APP-013'].outcome === 'Redirect' && r2.decisions['APP-013'].redirect?.territoryId === 'TER-05',
  `After the update, APP-013 → Redirect to a free TER-05 pin, since 572101 is taken (got ${r2.decisions['APP-013'].outcome})`);
check(changes.length === 2, `The update reports exactly 2 changes (got ${changes.length})`);

// No-change detection: saying something that's already true changes nothing.
const lookup = makeLookup(data, {});
const same = validUpdates([{ id: 'APP-012', field: 'floor', value: 'Upper' }, { id: 'APP-008', field: 'investment', value: 26 }], lookup);
check(same.length === 2 && same.every((u) => u.same), `“APP-012 is on an upper floor” and “APP-008 has ₹26L” are detected as no change (${JSON.stringify(same.map((u) => u.same))})`);

// Withdraw: APP-002 pulls out; their slot is released and APP-004 is promoted.
const rw = run({ 'APP-002': { status: 'withdrawn' } });
check(rw.decisions['APP-002'].outcome === 'Withdrawn' && ['Recommended', 'Conditional'].includes(rw.decisions['APP-004'].outcome),
  `Withdrawing APP-002 promotes APP-004 (got ${rw.decisions['APP-002'].outcome}, ${rw.decisions['APP-004'].outcome})`);
const msg = summariseUpdate({ applied: [{ id: 'APP-002', kind: 'applicant', field: 'status', value: 'withdrawn', before: 'active' }], changes: diffResults(r, rw), prev: r, next: rw });
check(msg.changes.some((c) => /APP-004: Waitlist → Recommended \(promoted\)/.test(c.text)) && msg.unaffected.some((t) => /other applicants unchanged/.test(t)),
  `The reply names who was promoted and how many didn’t change (${msg.changes.map((c) => c.text.slice(0, 50)).join(' | ')} | ${msg.unaffected.slice(-1)})`);

// The diff reports rank moves too: with APP-002 gone, APP-003 moves from rank 2 to 1 and keeps its slot.
const rank3 = diffResults(r, rw).find((c) => c.id === 'APP-003');
check(rank3 && rank3.fromRank === 2 && rank3.toRank === 1, `Withdrawing APP-002 reports APP-003’s rank change (${JSON.stringify(rank3 && [rank3.fromRank, rank3.toRank])})`);

// Typed blockers: APP-012 lost its pin and has an upper-floor condition.
const types12 = r.decisions['APP-012'].blockers.map((b) => b.type);
check(types12.includes('lostPin') && types12.includes('condition'), `APP-012’s blockers are typed (${types12.join(', ')})`);

// What-if: fixing a hold re-runs the batch. APP-020’s 260 sq ft shop is the only problem; at 300 sq ft the engine projects the result.
const wf = r.decisions['APP-020'].ifFixed;
check(wf?.projectable && /300 sq ft/.test(wf.text) && ['Recommended', 'Conditional', 'Waitlist', 'Redirect'].includes(wf.outcome), `APP-020’s what-if is projected (${wf?.text})`);

// Duplicate: removing APP-003 as a duplicate takes it out of the pool too.
const rd = run({ 'APP-003': { status: 'duplicate:APP-002' } });
check(rd.decisions['APP-003'].outcome === 'Withdrawn' && /duplicate of APP-002/.test(rd.decisions['APP-003'].reason), `Marking APP-003 a duplicate removes it (got ${rd.decisions['APP-003'].reason})`);

// Territory slots: TER-02 now has 3 slots, so APP-004 gets one.
const rs = run({ 'TER-02': { slots: 3 } });
check(['Recommended', 'Conditional'].includes(rs.decisions['APP-004'].outcome), `“TER-02 now has 3 slots” gives APP-004 a slot (got ${rs.decisions['APP-004'].outcome})`);

// Store closed: ST-06 closes, so pin 570009 is free and APP-005 competes for it.
const rc = run({ 'ST-06': { closed: true } });
check(rc.decisions['APP-005'].outcome !== 'Reject' && rc.decisions['APP-005'].score !== null, `“ST-06 has closed” frees pin 570009 for APP-005 (got ${rc.decisions['APP-005'].outcome}: ${rc.decisions['APP-005'].reason.slice(0, 80)})`);

// The chat never edits the applicant's own notes.
check(!('notes' in EDITABLE_FIELDS) && validUpdates([{ id: 'APP-019', field: 'notes', value: 'x' }], lookup).length === 0, 'Chat updates to the applicant’s notes are refused');

// Contradictions and timing are flagged with a question for the applicant.
const d2 = r.decisions['APP-002'];
check(d2.warnings.some((w) => /Diwali \(8 Nov 2026, 13 days away\)/.test(w)) && d2.questions.some((q) => /Diwali/.test(q)),
  `APP-002’s “open before Diwali” is flagged as unrealistic, with a question (${d2.warnings.find((w) => /Diwali/.test(w))?.slice(0, 90)})`);

// Readiness score: every applicant gets one, and it matches the allocation score wherever that exists.
const ds = Object.values(r.decisions);
check(ds.every((d) => Number.isInteger(d.readiness?.total) && d.readiness.total >= 0 && d.readiness.total <= 100 && d.readiness.band),
  `Every applicant has a readiness score 0-100 with a label (${ds.map((d) => `${d.id} ${d.readiness?.total}`).join(', ')})`);
check(ds.filter((d) => d.score !== null).every((d) => d.readiness.total === d.score),
  'Readiness equals the allocation score for every ranked applicant');

// "Upper floors qualify" in Brand rules: no upper-floor condition at all.
const up = runEngine(data, { ...DEFAULT_PROFILE, upperFloorOk: true }, { today: TODAY });
check(!Object.values(up.decisions).some((d) => d.conditions.some((c) => /upper floor/i.test(c.issue))), 'With upper floors allowed, nobody gets an upper-floor condition');

// Draft agreement for a recommended partner: prefilled from the application, unknowns left blank.
const rec = r.decisions['APP-002'];
const fields = agreementFields(rec, DEFAULT_PROFILE);
const fv = Object.fromEntries(fields.map((f) => [f.key, f.value]));
check(fv.franchisee === rec.applicant.name && fv.pin === rec.applicant.pin && fv.territory === rec.territoryId && fv.investment === String(rec.applicant.investment),
  `Agreement is prefilled with name, pin, territory and investment (${fv.franchisee}, ${fv.pin}, ${fv.territory}, ₹${fv.investment}L)`);
const html = agreementHtml({}, fields);
check(['fee', 'royalty', 'pan', 'franchisor'].every((k) => !fv[k]) && (html.match(/class="blank"/g) || []).length >= 6 && html.includes(rec.applicant.name),
  `Agreement leaves unknowns blank (${(html.match(/class="blank"/g) || []).length} blanks in the draft)`);

// Chat update that clears a field: APP-017 hasn't found a shop, so its size and floor are wiped.
const cleared = validUpdates([
  { id: 'APP-017', field: 'size', value: null },
  { id: 'APP-017', field: 'floor', value: 'Not known' },
  { id: 'APP-017', field: 'size', value: 'abc' },
], lookup);
check(cleared.length === 2 && cleared[0].value === null, `A null value clears a field; an unreadable one is dropped (got ${JSON.stringify(cleared.map((u) => [u.field, u.value]))})`);
const r3 = run({ 'APP-017': { size: null, floor: 'Not known' } });
check(r3.decisions['APP-017'].reason === 'No shop space found yet.', `After clearing, APP-017 is on hold for no shop space (got: ${r3.decisions['APP-017'].reason})`);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
