// Draft franchise agreement for a recommended partner. A generic template written for this tool,
// prefilled from the application; anything the sheet doesn't say is left blank for the reviewer to fill.
// Not legal advice: the brand's legal team reviews it before use.

const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const floorText = (f) => (f === 'Mall unit' ? 'a mall unit' : f === 'Upper' ? 'an upper floor' : f === 'Ground' ? 'the ground floor' : '');

// Every fillable field, in the order the form shows them. `value` is the prefill ('' means blank).
export function agreementFields(d, profile) {
  const a = d.applicant;
  const t = d.plan.training;
  const brand = profile.brandName && profile.brandName !== 'Your brand' ? profile.brandName : '';
  return [
    { key: 'date', label: 'Agreement date', value: today() },
    { key: 'franchisor', label: 'Franchisor (brand’s legal name)', value: brand },
    { key: 'franchisorAddress', label: 'Franchisor registered office', value: '' },
    { key: 'franchisee', label: 'Franchisee name', value: a.name || '' },
    { key: 'franchiseeAddress', label: 'Franchisee address', value: '' },
    { key: 'pan', label: 'Franchisee PAN', value: '' },
    { key: 'pin', label: 'Store pin code', value: a.pin || '' },
    { key: 'city', label: 'City', value: a.city || '' },
    { key: 'territory', label: 'Territory', value: d.territoryId || '' },
    { key: 'premises', label: 'Premises (owned / rented)', value: a.space && a.space !== 'Not yet identified' ? a.space.toLowerCase() : '' },
    { key: 'size', label: 'Premises size (sq ft)', value: a.size !== null && a.size !== undefined ? String(a.size) : '' },
    { key: 'floor', label: 'Floor', value: floorText(a.floor) },
    { key: 'investment', label: 'Committed investment (₹ lakh)', value: a.investment !== null && a.investment !== undefined ? String(a.investment) : '' },
    { key: 'term', label: 'Term (years)', value: '5' },
    { key: 'fee', label: 'One-time franchise fee (₹)', value: '' },
    { key: 'deposit', label: 'Refundable security deposit (₹)', value: '' },
    { key: 'royalty', label: 'Royalty (% of monthly net sales)', value: '' },
    { key: 'marketing', label: 'Marketing fund (% of monthly net sales)', value: '' },
    { key: 'opening', label: 'Store to open within (months)', value: a.launch ? String(Math.max(3, a.launch)) : '3' },
    { key: 'training', label: 'Training programme', value: t ? `${t.track.toLowerCase()} (${t.weeks} week${t.weeks === 1 ? '' : 's'}, in ${t.language})` : '' },
    { key: 'jurisdiction', label: 'Courts at', value: 'Bengaluru' },
  ];
}

// The agreement as numbered clauses. `v(key)` returns the filled value or null for a blank.
export function agreementClauses(v) {
  return [
    ['Parties', ['This Franchise Agreement is made on ', 'date', ' between ', 'franchisor', ', with its registered office at ', 'franchisorAddress', ' (the “Franchisor”), and ', 'franchisee', ', residing at ', 'franchiseeAddress', ', PAN ', 'pan', ' (the “Franchisee”).']],
    ['Grant of franchise', ['The Franchisor grants the Franchisee the right to operate one store under the Franchisor’s brand at the Premises. The Franchisor will not open or license another store in pin code ', 'pin', ' during the Term.']],
    ['Premises', ['The store will operate from ', 'premises', ' premises of about ', 'size', ' sq ft on ', 'floor', ' in pin code ', 'pin', ', ', 'city', ' (territory ', 'territory', '). The Franchisee will not move the store without the Franchisor’s written consent.']],
    ['Term', ['This Agreement runs for ', 'term', ' years from the date above and may be renewed by mutual written agreement.']],
    ['Fees', ['The Franchisee will pay a one-time franchise fee of ₹', 'fee', ' on signing and a refundable security deposit of ₹', 'deposit', '. Each month the Franchisee will pay a royalty of ', 'royalty', '% and a marketing contribution of ', 'marketing', '% of the store’s net sales. The Franchisee confirms ₹', 'investment', ' lakh is available to set up the store.']],
    ['Store setup and opening', ['The Franchisee will fit out the store to the Franchisor’s design and open it within ', 'opening', ' months of signing. The Franchisor will provide the store layout, approved vendors and opening support.']],
    ['Training', ['Before opening, the Franchisee and store staff will complete the Franchisor’s ', 'training', ', including shadow shifts at an existing store.']],
    ['Operations and brand standards', ['The Franchisee will follow the Franchisor’s operating manual, pricing policy and brand standards, and buy stock only from approved suppliers.']],
    ['Confidentiality and intellectual property', ['The brand name, trademarks, designs, systems and manuals remain the Franchisor’s property. The Franchisee will keep them confidential and use them only to run the store.']],
    ['Termination', ['Either party may end this Agreement if the other commits a material breach and does not fix it within 30 days of written notice. On termination the Franchisee will stop using the brand and remove all branding from the Premises.']],
    ['Governing law', ['This Agreement is governed by the laws of India, and the courts at ', 'jurisdiction', ' have jurisdiction.']],
  ].map(([title, parts]) => ({
    title,
    parts: parts.map((p, i) => (i % 2 === 1 ? { key: p, value: v(p) } : { text: p })),
  }));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A standalone HTML document: used for "Download (.doc)" and "Print / save as PDF".
export function agreementHtml(values, fields) {
  const v = (k) => (values[k] ?? fields.find((f) => f.key === k)?.value ?? '').trim() || null;
  const clauses = agreementClauses(v);
  const body = clauses.map((c, i) => `<h3>${i + 1}. ${esc(c.title)}</h3><p>${c.parts.map((p) => (p.text !== undefined ? esc(p.text) : p.value ? `<b>${esc(p.value)}</b>` : '<span class="blank">__________</span>')).join('')}</p>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Franchise Agreement - ${esc(v('franchisee') || '')}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;color:#1d1c1a}h1{text-align:center;font-size:22px}h3{font-size:15px;margin:22px 0 4px}.blank{background:#fff3b0}.note{font-size:12px;color:#5b5850;border:1px dashed #8f8a7e;padding:8px 12px}.sign{display:flex;gap:40px;margin-top:48px}.sign div{flex:1;border-top:1px solid #1d1c1a;padding-top:6px;font-size:13px}</style></head><body>
<h1>Franchise Agreement</h1>
<p class="note">Draft generated by FranchEyes from the franchise application. Highlighted blanks still need filling. Not legal advice: have it reviewed by the legal team before signing.</p>
${body}
<div class="sign"><div>For the Franchisor<br>Name and signature</div><div>Franchisee<br>${esc(v('franchisee') || 'Name')} and signature</div></div>
<div class="sign"><div>Witness 1</div><div>Witness 2</div></div>
</body></html>`;
}
