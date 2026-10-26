// A plain-text picture of the current batch, sent to the chat model.
const v = (x) => (x === null || x === undefined || x === '' ? 'blank' : x);

export function buildSnapshot(result, profile, personal = {}) {
  const bookmarks = personal.bookmarks || {};
  const notes = personal.notes || {};
  const lines = [];
  lines.push('RULES');
  lines.push(`Brand: ${profile.brandName}. Category: ${profile.categoryName || profile.category || 'retail'}. ${profile.upperFloorOk ? 'Any floor qualifies (ground, upper or mall unit).' : 'Walk-in: only ground-floor or mall spaces qualify; upper floors go on hold.'} Space must be at least ${profile.minSize} sq ft.`);
  lines.push(`Minimum investment: Tier 1 ₹${profile.minInvestment['Tier 1']} lakh, Tier 2 ₹${profile.minInvestment['Tier 2']} lakh, Tier 3 ₹${profile.minInvestment['Tier 3']} lakh. More than ${profile.rejectShortfall}% short = Reject; less = Hold.`);
  lines.push(`Hard rules (Reject): pin code not in any territory; pin code already has an existing store. Never two stores in one pin code.`);
  lines.push(`Hold: missing or contradictory details, no space yet, ${profile.upperFloorOk ? '' : 'upper floor, '}unknown floor, space under ${profile.minSize} sq ft, small investment shortfall, city and pin code disagree.`);
  lines.push(`Score out of 100: investment headroom up to 30, experience up to 20 (0y:0, 1-2y:8, 3-5y:14, 6y+:20), space owned 25 / rented 20, floor ground 15 / mall 12${profile.upperFloorOk ? ' / upper 12' : ''}, launch within 3 months 10 / 4-6 months 6 / later or blank 3.`);
  lines.push('Franchisee readiness score (every applicant, display only, never changes an outcome): the same five parts, but a missing or failing part scores 0 (investment below minimum, no space, upper/unknown/blank floor). 75+ Ready, 50-74 Nearly ready, under 50 Not ready. Equals the allocation score for applicants who pass every check.');
  lines.push(`Allocation per territory: highest score first, one store per pin code, up to the open slots, minimum score High ${profile.minScore.High} / Medium ${profile.minScore.Medium} / Low ${profile.minScore.Low}. Others go to Waitlist.`);
  lines.push('Outcomes are recommendations; the expansion team reviews each one.');
  lines.push('');
  lines.push('TERRITORIES');
  for (const t of result.territories) {
    lines.push(`${t.id} | ${t.city} ${t.tier} | priority ${t.priority} (min score ${t.bar}) | ${t.filled}/${t.slots} slots filled by ${t.winners.join(', ') || 'nobody'} | pins: ${t.pinsState.map((p) => `${p.pin}=${p.status}${p.by ? ' ' + p.by : ''}`).join(', ')}`);
  }
  lines.push('');
  lines.push('APPLICATIONS');
  for (const d of Object.values(result.decisions)) {
    const a = d.applicant;
    lines.push(
      [
        `${a.id} ${v(a.name)}`,
        `${v(a.city)} pin ${v(a.pin)} territory ${v(d.territoryId)} ${v(d.tier)}`,
        `investment ${v(a.investment)} lakh (min ${v(d.minInvestment)})`,
        `experience ${v(a.experience)}y`,
        `business: ${v(a.business)}`,
        `space ${v(a.space)} ${v(a.size)} sqft floor ${v(a.floor)}`,
        `launch ${v(a.launch)} months`,
        `language ${v(a.language)}`,
        `notes: ${v(a.notes)}`,
        `OUTCOME ${d.outcome}${d.score !== null ? ` score ${d.score} (${Object.entries(d.scoreParts).map(([k, x]) => `${k} ${x}`).join(', ')})` : ''}`,
        `readiness ${d.readiness.total}/100 ${d.readiness.band} (${Object.entries(d.readiness.parts).map(([k, x]) => `${k} ${x}`).join(', ')})`,
        `reason: ${d.reason}`,
        d.issues.length ? `to fix: ${d.issues.map((h) => h.fix).join(' ')}` : null,
        d.rejectReasons.length > 1 ? `also: ${d.rejectReasons.slice(1).join(' ')}` : null,
        d.warnings.length ? `flags: ${d.warnings.join(' ')}` : null,
        d.competition ? `rank ${d.competition.rank} of ${d.competition.of}; rivals ${d.competition.rivals.map((r) => `${r.id} (${r.score})`).join(', ') || 'none'}` : null,
        bookmarks[a.id] ? 'BOOKMARKED by the reviewer' : null,
        notes[a.id] ? `REVIEWER NOTE: ${notes[a.id]}` : null,
        d.updatedFields ? `UPDATED VIA CHAT, unverified: ${Object.keys(d.updatedFields).join(', ')}` : null,
      ].filter(Boolean).join(' | ')
    );
  }
  return lines.join('\n');
}
