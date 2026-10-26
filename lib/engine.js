import { CITIES, READINESS_BANDS, OUTCOMES } from './constants.js';
import { buildPlan } from './plan.js';

const L = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh`;
const DAY = 86400000;
const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
// Setup (6-8 weeks) plus training: about 3 months from today to a realistic opening.
const SETUP_DAYS = 90;
// Festival dates applicants often aim for. Only dates we're sure of; add more as needed.
const FESTIVALS = [
  { re: /diwali|deepavali/i, name: 'Diwali', dates: ['2026-11-08', '2027-10-29'] },
  { re: /christmas|x-?mas/i, name: 'Christmas', dates: ['2026-12-25', '2027-12-25'] },
  { re: /new year/i, name: 'New Year', dates: ['2027-01-01', '2028-01-01'] },
];

function cityFromPin(pin) {
  return Object.entries(CITIES).find(([, c]) => pin && pin.startsWith(c.prefix))?.[0] ?? null;
}

const floorPoints = (a, profile) => (a.floor === 'Ground' ? 15 : a.floor === 'Mall unit' ? 12 : a.floor === 'Upper' && profile.upperFloorOk ? 12 : 0);

export function scoreApplicant(a, min, profile = {}) {
  const headroom = Math.max(0, (a.investment - min) / min);
  const investment = Math.round(10 + 20 * Math.min(1, headroom / 0.5));
  const e = a.experience ?? 0;
  const experience = e < 1 ? 0 : e < 3 ? 8 : e < 6 ? 14 : 20;
  const space = a.space === 'Owned' ? 25 : 20;
  // An upper floor (where not allowed) can still compete, but earns no floor points and wins only on condition.
  const floor = floorPoints(a, profile);
  const l = a.launch;
  const launch = l === null || l === undefined ? 3 : l <= 3 ? 10 : l <= 6 ? 6 : 3;
  return {
    total: investment + experience + space + floor + launch,
    parts: { investment, experience, space, floor, launch },
  };
}

// Franchisee readiness: the same five parts as scoreApplicant, but given to every applicant.
// A missing or failing part scores 0 (investment below the minimum, no space, upper or unknown floor).
// For applicants who are ranked it equals scoreApplicant exactly. Display only: it never changes an outcome.
export function readinessScore(a, min, profile = {}) {
  const inv = a.investment !== null && a.investment !== undefined && min && a.investment >= min
    ? Math.round(10 + 20 * Math.min(1, (a.investment - min) / min / 0.5))
    : 0;
  const e = a.experience;
  const experience = e === null || e === undefined || e < 0 || e > 50 ? 0 : e < 1 ? 0 : e < 3 ? 8 : e < 6 ? 14 : 20;
  const space = a.space === 'Owned' ? 25 : a.space === 'Rented' ? 20 : 0;
  // A floor only counts once there's a shop to be on it.
  const floor = !space ? 0 : floorPoints(a, profile);
  const l = a.launch;
  const launch = l === null || l === undefined ? 3 : l <= 3 ? 10 : l <= 6 ? 6 : 3;
  const total = inv + experience + space + floor + launch;
  const band = READINESS_BANDS.find((b) => total >= b.min).label;
  return { total, band, parts: { investment: inv, experience, space, floor, launch } };
}

function checkApplicant(a, ctx, updated = {}) {
  const { profile, storeByPin, terByPin, today } = ctx;
  const rejects = []; // hard "no" that isn't about location
  let location = null; // { kind: 'store' | 'noTerritory', text, store? }
  const holds = []; // { issue, fix }
  const conditions = []; // { issue, fix }: can still compete, approved only once fixed
  const warnings = [];
  const questions = []; // what to ask the applicant
  const warn = (text, question) => { warnings.push(text); if (question) questions.push(question); };

  // Required fields
  if (!a.name) holds.push({ issue: 'Applicant name is missing.', fix: 'Add the applicant’s name.' });
  const cityInfo = a.city ? CITIES[a.city] : null;
  if (!a.city) holds.push({ issue: 'City is missing.', fix: 'Confirm the city.' });
  else if (!cityInfo) holds.push({ issue: `“${a.city}” isn’t one of the seven cities in scope.`, fix: 'Confirm the city.' });
  const pinValid = a.pin && /^\d{6}$/.test(a.pin);
  if (!a.pin) holds.push({ issue: 'Pin code is missing.', fix: 'Confirm the 6-digit pin code of the shop.' });
  else if (!pinValid) holds.push({ issue: `Pin code “${a.pin}” isn’t 6 digits.`, fix: 'Confirm the 6-digit pin code of the shop.' });
  if (a.state && a.state.toLowerCase() !== 'karnataka') warn(`State is given as “${a.state}”; all stores are in Karnataka.`, 'Please confirm the store will be in Karnataka.');

  // City and pin must agree
  if (pinValid && cityInfo && !a.pin.startsWith(cityInfo.prefix)) {
    const actual = cityFromPin(a.pin);
    holds.push({
      issue: `City says ${a.city}, but pin ${a.pin} ${actual ? `belongs to ${actual}` : `doesn’t start with ${cityInfo.prefix}`}.`,
      fix: `Confirm the exact location: is the shop in ${a.city}${actual ? ` or ${actual}` : ''}, and what is its pin code?`,
    });
  }

  // Territory and existing stores (hard rules, but a strong applicant can be redirected to a free pin)
  const terr = pinValid ? terByPin.get(a.pin) : null;
  if (pinValid) {
    const store = storeByPin.get(a.pin);
    if (store) location = { kind: 'store', store, text: `The brand already has a store in pin ${a.pin} (${store.id}, opened ${store.year ?? 'earlier'}). It never opens two stores in one pin code.` };
    else if (!terr) location = { kind: 'noTerritory', text: `Pin ${a.pin} isn’t in any territory the brand is expanding into right now.` };
  }

  // Investment
  const tier = terr?.tier || cityInfo?.tier || (pinValid && cityFromPin(a.pin) ? CITIES[cityFromPin(a.pin)].tier : null);
  const min = tier ? profile.minInvestment[tier] : null;
  if (a.investment === null) {
    holds.push({ issue: 'Investment capacity is missing.', fix: 'Confirm how much the applicant can invest, in lakh.' });
  } else if (a.investment <= 0) {
    holds.push({ issue: `Investment capacity is given as ${a.investment}.`, fix: 'Confirm how much the applicant can invest, in lakh.' });
  } else if (min) {
    const floorAmt = min * (1 - profile.rejectShortfall / 100);
    if (a.investment < floorAmt) {
      rejects.push(`Investment of ${L(a.investment)} is more than ${profile.rejectShortfall}% below the ${L(min)} minimum for a ${tier} city.`);
    } else if (a.investment < min) {
      holds.push({
        code: 'investShort',
        issue: `Investment of ${L(a.investment)} is ${L(min - a.investment)} short of the ${L(min)} minimum for a ${tier} city.`,
        fix: `Show an extra ${L(min - a.investment)}: savings, a partner or a loan sanction letter.`,
      });
    }
  }
  if (a.investmentRaw && typeof a.investmentRaw === 'string' && /\d\s*[-–to]+\s*\d/.test(a.investmentRaw)) {
    warn(`Investment was written as a range (“${a.investmentRaw}”); the lower figure was used.`, 'What exact amount can you invest, in lakh?');
  }

  // Experience, including experience mentioned only in the free text
  const text = `${a.business || ''} ${a.notes || ''}`;
  if (a.experience === null) holds.push({ issue: 'Retail experience is missing.', fix: 'Confirm years of retail experience (0 if none).' });
  else if (a.experience < 0 || a.experience > 50) holds.push({ issue: `Retail experience of ${a.experience} years doesn’t look right.`, fix: 'Confirm years of retail experience.' });
  else if (a.experience === 0 && !updated.experience) {
    const yrs = text.match(/(\d{1,2})\s*\+?\s*(?:yrs?|years?)/i);
    const retail = /(kirana|shop|store|outlet|showroom|retail|boutique|mart|business)/i.test(text);
    if (yrs && retail) {
      warn(`Experience is 0 years, but they wrote “${text.trim()}” (about ${yrs[1]} years). Worth confirming; it would raise their score.`,
        `Your form says 0 years of retail experience, but you mention about ${yrs[1]} years running a shop. Which is correct?`);
    } else if (a.business && /(run|runs|ran|own|owns|manag)\w*\b.*\b(shop|store|outlet|showroom|retail|boutique|mart)/i.test(a.business)) {
      warn(`Experience is 0 years, but their business (“${a.business}”) sounds like retail. Worth confirming; it would raise their score.`,
        'Your form says 0 years of retail experience, but your business sounds like a shop. How many years have you run it?');
    }
  }

  // Space and floor
  const notes = (a.notes || '').toLowerCase();
  if (!a.space) {
    holds.push({ code: 'spaceMissing', issue: 'Space status is missing.', fix: 'Confirm whether they own, rent or are still looking for a shop.' });
  } else if (a.space === 'Not yet identified') {
    const saysFloor = a.floor && a.floor !== 'Not known';
    if (a.size !== null || saysFloor) {
      holds.push({
        issue: `Says no space found yet, but also gives ${[a.size !== null ? `a size (${a.size} sq ft)` : null, saysFloor ? `a floor (${a.floor})` : null].filter(Boolean).join(' and ')}.`,
        fix: 'Have you found a shop? If yes, share its size, floor and whether it’s owned or rented.',
      });
    } else {
      holds.push({
        code: 'noSpace',
        issue: 'No shop space found yet.',
        fix: profile.upperFloorOk
          ? `Find a space of at least ${profile.minSize} sq ft inside the territory (any floor).`
          : `Find a ground-floor or mall space of at least ${profile.minSize} sq ft inside the territory.`,
      });
    }
    if (a.launch !== null && a.launch <= 2) warn(`Wants to open in ${a.launch} month${a.launch === 1 ? '' : 's'} without a shop yet. Setup alone usually takes about 3 months.`);
  } else if (a.space === 'Owned' || a.space === 'Rented') {
    if (a.size === null) holds.push({ code: 'sizeMissing', issue: `Space is ${a.space.toLowerCase()}, but no size is given.`, fix: 'What is the shop’s size in sq ft?' });
    else if (a.size < profile.minSize) holds.push({ code: 'sizeSmall', issue: `Shop is ${a.size} sq ft, below the ${profile.minSize} sq ft minimum.`, fix: `Find a space of at least ${profile.minSize} sq ft.` });
    else if (a.size > (profile.maxSize ?? 3000)) warn(`Shop is ${a.size} sq ft, much larger than a typical store. Confirm the figure.`, `Is the shop really ${a.size} sq ft?`);

    if (a.floor === 'Upper' && !profile.upperFloorOk) {
      conditions.push({ issue: 'Shop is on an upper floor. Walk-in stores need street-level footfall.', fix: 'Move to a ground-floor or mall unit within 30 days.' });
    } else if (!a.floor || a.floor === 'Not known') holds.push({ code: 'floorUnknown', issue: 'Floor isn’t known.', fix: 'Which floor is the shop on?' });
    else if (!['Ground', 'Mall unit', 'Upper'].includes(a.floor)) holds.push({ issue: `Floor “${a.floor}” isn’t clear.`, fix: 'Which floor is the shop on?' });

    // Only matters where an upper floor would change the outcome.
    if (!profile.upperFloorOk && !updated.floor && /(first|second|third|1st|2nd|3rd|upper|top)\s+floor/.test(notes) && a.floor !== 'Upper') {
      holds.push({ issue: `Form says ${a.floor || 'no floor'}, but their notes mention an upper floor (“${a.notes}”).`, fix: 'Which floor is the shop actually on?' });
    }
    if (!updated.space && /(no (shop|space)|yet to (find|identify|finali[sz]e)|looking for (a )?(shop|space)|searching for (a )?(shop|space)|not finali[sz]ed)/.test(notes)) {
      holds.push({ issue: `Form says the space is ${a.space.toLowerCase()}, but their notes suggest they’re still looking (“${a.notes}”).`, fix: 'Have you actually secured the shop?' });
    }
  } else {
    holds.push({ issue: `Space status “${a.space}” isn’t clear.`, fix: 'Confirm whether they own, rent or are still looking for a shop.' });
  }

  // Timing
  if (a.launch !== null && a.launch < 3 && (a.space === 'Owned' || a.space === 'Rented')) {
    warn(`Target launch of ${a.launch} month${a.launch === 1 ? '' : 's'} is tight; setup and training usually take about 3 months.`);
  }
  const earliest = new Date(today.getTime() + SETUP_DAYS * DAY);
  for (const f of FESTIVALS) {
    if (!f.re.test(a.notes || '')) continue;
    const next = f.dates.map((d) => new Date(`${d}T00:00:00+05:30`)).find((d) => d >= today);
    if (next && next < earliest) {
      const days = Math.ceil((next - today) / DAY);
      warn(`Wants to open before ${f.name} (${fmtDate(next)}, ${days} days away). Setup and training take about 3 months, so the earliest realistic opening is around ${fmtDate(earliest)}.`,
        `${f.name} is ${days} days away and setting up a store takes about 3 months. Would opening around ${fmtDate(earliest)} work for you?`);
    }
  }

  // Commitment
  const job = (a.notes || '').match(/[^.]*\b(quit|leave|leaving|resign\w*)\b[^.]*\b(job|work|company)\b[^.]*|[^.]*\b(currently (working|employed)|full[- ]time job|salaried)\b[^.]*/i);
  if (job) {
    warn(`Notes mention a job (“${job[0].trim()}”). Confirm they can run the store full-time from opening.`,
      'Will you be able to run the store full-time from the opening date?');
  }
  if (!a.language) warnings.push('No training language given, so English is assumed.');

  return { rejects, location, holds, conditions, warnings, questions, terr, tier, min };
}

// Factors shown side by side when an applicant loses to someone else.
function facts(d) {
  const a = d.applicant;
  return { score: d.score, investment: a.investment, experience: a.experience, space: a.space, size: a.size, floor: a.floor, launch: a.launch };
}

export function runEngine(data, profile, meta = {}) {
  const today = meta.today ? new Date(meta.today) : new Date();
  const storeByPin = new Map(data.stores.filter((s) => s.pin).map((s) => [s.pin, s]));
  const terByPin = new Map();
  const notes = [];
  for (const t of data.territories) {
    for (const p of t.pins) {
      if (terByPin.has(p)) notes.push(`Pin ${p} is listed in both ${terByPin.get(p).id} and ${t.id}; ${terByPin.get(p).id} is used.`);
      else terByPin.set(p, t);
    }
  }
  const ctx = { profile, storeByPin, terByPin, today };

  // Likely duplicates: same name and pin (or same name and city when the pin is missing).
  const dupOf = {};
  const seenKey = new Map();
  for (const a of data.applications) {
    if (!a.name) continue;
    const key = `${a.name.toLowerCase().replace(/\s+/g, ' ').trim()}|${a.pin || a.city || ''}`;
    if (seenKey.has(key)) dupOf[a.id] = seenKey.get(key);
    else seenKey.set(key, a.id);
  }

  const decisions = {};
  const eligibleByTer = new Map();
  const redirectPool = [];

  for (const a of data.applications) {
    const upd = meta.updated?.[a.id] || {};
    const c = checkApplicant(a, ctx, upd);
    if (dupOf[a.id]) c.warnings.push(`Looks like a duplicate of ${dupOf[a.id]} (same name and ${a.pin ? 'pin' : 'city'}). In chat: “${a.id} is a duplicate of ${dupOf[a.id]}”.`);
    const dupHere = Object.entries(dupOf).filter(([, of]) => of === a.id).map(([id]) => id);
    if (dupHere.length) c.warnings.push(`${dupHere.join(', ')} look${dupHere.length === 1 ? 's' : ''} like a duplicate of this application.`);

    const d = {
      id: a.id,
      applicant: a,
      territoryId: c.terr?.id ?? null,
      tier: c.tier,
      minInvestment: c.min,
      warnings: c.warnings,
      questions: [...c.holds.map((h) => h.fix), ...c.questions].filter((q) => q.trim().endsWith('?')),
      issues: c.holds,
      conditions: c.conditions,
      rejectReasons: [...c.rejects, ...(c.location ? [c.location.text] : [])],
      location: c.location,
      score: null,
      scoreParts: null,
      readiness: readinessScore(a, c.min, profile),
      outcome: null,
      reason: '',
      competition: null,
      versus: null,
      redirect: null,
      updatedFields: meta.updated?.[a.id] ?? null,
    };
    const status = upd.status;
    if (status === 'withdrawn' || (typeof status === 'string' && status.startsWith('duplicate:'))) {
      d.outcome = 'Withdrawn';
      d.reason = status === 'withdrawn' ? 'Withdrawn: the applicant pulled out (reported in chat).' : `Removed as a duplicate of ${status.slice(10)}.`;
      d.questions = [];
    } else if (c.rejects.length || (c.location && c.holds.length && !c.holds.some((h) => /^City says/.test(h.issue)))) {
      // When the city and pin disagree, the pin may be a typo, so its location problem waits for the answer (Hold below).
      d.outcome = 'Reject';
      d.reason = d.rejectReasons[0];
    } else if (c.holds.length) {
      d.outcome = 'Hold';
      d.reason = c.holds.map((h) => h.issue).join(' ');
    } else {
      const s = scoreApplicant(a, c.min, profile);
      d.score = s.total;
      d.scoreParts = s.parts;
      if (c.location) {
        // Would qualify but for the location: try to redirect after allocation.
        d.outcome = 'Reject';
        d.reason = c.location.text;
        redirectPool.push(d);
      } else {
        const list = eligibleByTer.get(c.terr.id) || [];
        list.push(d);
        eligibleByTer.set(c.terr.id, list);
      }
    }
    decisions[a.id] = d;
  }

  // Allocation: per territory, highest score first, one store per pin code.
  const terState = new Map();
  for (const t of data.territories) {
    const ranked = (eligibleByTer.get(t.id) || []).sort(
      (x, y) => y.score - x.score || y.applicant.investment - x.applicant.investment || x.id.localeCompare(y.id, undefined, { numeric: true })
    );
    const bar = profile.minScore[t.priority] ?? profile.minScore.Medium;
    const awardedPins = new Map();
    const winners = [];
    ranked.forEach((d, i) => {
      const pin = d.applicant.pin;
      d.competition = { rank: i + 1, of: ranked.length, bar, rivals: ranked.filter((r) => r !== d).map((r) => ({ id: r.id, score: r.score })) };
      if (awardedPins.has(pin)) {
        const w = awardedPins.get(pin);
        d.outcome = 'Waitlist';
        d.reason = `Pin ${pin} went to ${w.id}, who scored higher (${w.score} vs ${d.score}). Only one store per pin code.`;
        d.waitingFor = `pin ${pin}`;
        d.waitKind = 'pin';
        d.versus = { ...facts(w), id: w.id, why: `won pin ${pin}` };
        if (d.score >= bar) redirectPool.push(d);
      } else if (d.score < bar) {
        d.outcome = 'Waitlist';
        d.reason = `Score ${d.score} is below the ${bar} needed in a ${t.priority}-priority territory (${t.id}).`;
        d.waitingFor = `${t.id} priority rising, or a stronger application`;
        d.waitKind = 'bar';
        d.gap = { bar, short: bar - d.score };
      } else if (winners.length >= t.slots) {
        d.outcome = 'Waitlist';
        d.reason = t.slots === 0
          ? `${t.id} has no open slots right now.`
          : `All ${t.slots} slot${t.slots === 1 ? '' : 's'} in ${t.id} went to higher scorers: ${winners.map((w) => `${w.id} (${w.score})`).join(', ')}.`;
        d.waitingFor = `a slot in ${t.id}`;
        d.waitKind = 'slots';
        const last = winners[winners.length - 1];
        if (last) d.versus = { ...facts(last), id: last.id, why: `took the last slot in ${t.id}` };
      } else {
        winners.push(d);
        awardedPins.set(pin, d);
        const won = `Ranked ${i + 1} of ${ranked.length} eligible in ${t.id} and won ${winners.length === 1 && t.slots === 1 ? 'its only slot' : `slot ${winners.length} of ${t.slots}`} with a score of ${d.score}.`;
        if (d.conditions.length) {
          d.outcome = 'Conditional';
          d.reason = `${won} Approved on condition: ${d.conditions.map((x) => x.fix.replace(/\.$/, '').toLowerCase()).join('; ')}.`;
        } else {
          d.outcome = 'Recommended';
          d.reason = won;
        }
      }
    });
    terState.set(t.id, { t, bar, awardedPins, winners, left: Math.max(0, t.slots - winners.length), offered: new Map() });
  }

  // Redirect: someone who would qualify but for the location gets a free pin, same territory first, then the same city.
  redirectPool.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id, undefined, { numeric: true }));
  for (const d of redirectPool) {
    const city = d.applicant.city && CITIES[d.applicant.city] ? d.applicant.city : cityFromPin(d.applicant.pin);
    const options = [
      ...(d.territoryId ? [terState.get(d.territoryId)] : []),
      ...[...terState.values()].filter((s) => s.t.id !== d.territoryId && s.t.city === city),
    ];
    let pick = null;
    for (const s of options) {
      if (s.left <= 0 || d.score < s.bar) continue;
      const pin = s.t.pins.find((p) => !storeByPin.has(p) && !s.awardedPins.has(p) && !s.offered.has(p) && p !== d.applicant.pin);
      if (pin) { pick = { s, pin }; break; }
    }
    if (!pick) {
      d.reason += d.outcome === 'Waitlist'
        ? ' No other free pin with an open slot in this city.'
        : '';
      if (d.outcome === 'Reject') {
        d.reason = `${d.reason.replace(/ It never opens two stores in one pin code.$/, '').replace(/.$/, '')}, and there’s no free pin with an open slot${city ? ` in ${city}` : ''} to redirect them to (score ${d.score}).`;
        d.rejectReasons = [d.reason, ...d.rejectReasons.filter((x) => x !== d.location.text)];
      }
      continue;
    }
    pick.s.left -= 1;
    pick.s.offered.set(pick.pin, d);
    const same = pick.s.t.id === d.territoryId;
    const why = d.outcome === 'Waitlist' ? d.reason.replace(/ Only one store per pin code\.$/, '') : d.reason.replace(/ It never opens two stores in one pin code\.$/, '');
    d.outcome = 'Redirect';
    d.redirect = { pin: pick.pin, territoryId: pick.s.t.id, sameTerritory: same };
    d.reason = `${why} Offer pin ${pick.pin} in ${pick.s.t.id} (${pick.s.t.city}) instead: it’s free and ${same ? 'the territory' : 'that territory'} still has a slot. Score ${d.score} clears its bar of ${pick.s.bar}.`;
    d.waitingFor = `a space in pin ${pick.pin}`;
    d.questions = [`Could you find a ground-floor or mall space in pin ${pick.pin} (${pick.s.t.city})?`, ...d.questions];
  }

  // A recommendation that rests on something only claimed in chat is conditional until it's verified.
  for (const d of Object.values(decisions)) {
    if (d.outcome !== 'Recommended' || !d.updatedFields) continue;
    const claimed = Object.keys(d.updatedFields).filter((k) => k !== 'status');
    if (!claimed.length) continue;
    d.outcome = 'Conditional';
    d.conditions = [...d.conditions, { issue: `Rests on a chat update not yet verified: ${claimed.join(', ')}.`, fix: `Verify the ${claimed.join(' and ')} with documents within 7 days.` }];
    d.reason = `${d.reason} Conditional until the ${claimed.join(' and ')} ${claimed.length === 1 ? 'is' : 'are'} verified (within 7 days).`;
  }

  const territories = data.territories.map((t) => {
    const s = terState.get(t.id);
    const pins = t.pins.map((p) => {
      const store = storeByPin.get(p);
      if (store) return { pin: p, status: 'store', by: store.id };
      const w = s.awardedPins.get(p);
      if (w) return { pin: p, status: 'awarded', by: w.id };
      const o = s.offered.get(p);
      if (o) return { pin: p, status: 'offered', by: o.id };
      return { pin: p, status: 'open' };
    });
    const inTer = Object.values(decisions).filter((d) => d.territoryId === t.id);
    return {
      ...t,
      bar: s.bar,
      pinsState: pins,
      filled: s.winners.length,
      winners: s.winners.map((w) => w.id),
      counts: Object.fromEntries(OUTCOMES.map((o) => [o, inTer.filter((d) => d.outcome === o).length])),
    };
  });

  for (const d of Object.values(decisions)) d.blockers = typedBlockers(d);
  if (!meta.noWhatIf) {
    for (const d of Object.values(decisions)) {
      if (d.outcome === 'Hold') d.ifFixed = whatIf(d, data, profile, meta);
      if (d.versus && d.score !== null) d.toBeat = toBeat(d, profile, d.versus.score + 1, `beat ${d.versus.id}`);
      else if (d.gap && d.outcome === 'Waitlist') d.toBeat = toBeat(d, profile, d.gap.bar, `reach the bar of ${d.gap.bar}`);
    }
  }

  const terById = Object.fromEntries(territories.map((t) => [t.id, t]));
  for (const d of Object.values(decisions)) {
    d.plan = buildPlan(d, { terById, territories, profile, stores: data.stores });
  }

  const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0]));
  Object.values(decisions).forEach((d) => counts[d.outcome]++);

  return { decisions, territories, counts, notes };
}

// Every reason an applicant isn't (yet) approved, as typed items, most serious first.
// Types: investment, existingStore, noTerritory, rule (a fixable hold), condition, lostPin, territoryFull, belowBar, withdrawn.
function typedBlockers(d) {
  const out = [];
  if (d.outcome === 'Withdrawn') return [{ type: 'withdrawn', text: d.reason }];
  for (const r of d.rejectReasons) {
    if (d.location && r.startsWith(d.location.text.replace(/\.$/, '').slice(0, 30))) {
      if (d.outcome !== 'Redirect') out.push({ type: d.location.kind === 'store' ? 'existingStore' : 'noTerritory', text: r });
    } else out.push({ type: 'investment', text: r });
  }
  for (const h of d.issues) out.push({ type: 'rule', text: h.issue, fix: h.fix });
  for (const c of d.conditions || []) out.push({ type: 'condition', text: c.issue, fix: c.fix });
  if (d.location && d.outcome === 'Redirect') out.push({ type: d.location.kind === 'store' ? 'existingStore' : 'noTerritory', text: d.location.text });
  if (d.waitKind === 'pin') out.push({ type: 'lostPin', text: `Lost pin ${d.applicant.pin} to ${d.versus.id} (${d.versus.score} vs ${d.score}).`, vs: d.versus });
  if (d.waitKind === 'slots' && d.outcome === 'Waitlist') out.push({ type: 'territoryFull', text: d.reason, vs: d.versus });
  if (d.waitKind === 'bar' && d.outcome === 'Waitlist') out.push({ type: 'belowBar', text: d.reason });
  return out;
}

// Apply the fixes a Hold asks for (where the fix is a known value), re-run the batch and report what would happen.
// Contradictions and missing facts can't be projected: the applicant has to answer first.
function whatIf(d, data, profile, meta) {
  const a = { ...d.applicant };
  const did = [];
  for (const h of d.issues) {
    if (h.code === 'investShort') { a.investment = d.minInvestment; did.push(`raise investment to ₹${d.minInvestment} lakh`); }
    else if (h.code === 'noSpace' || h.code === 'spaceMissing') {
      a.space = 'Rented'; if (a.size === null || a.size < profile.minSize) a.size = profile.minSize; if (!a.floor || a.floor === 'Not known' || a.floor === 'Upper') a.floor = 'Ground';
      did.push(`rent a ground-floor shop of ${a.size} sq ft`);
    } else if (h.code === 'sizeSmall' || h.code === 'sizeMissing') { a.size = profile.minSize; did.push(`get a shop of at least ${profile.minSize} sq ft`); }
    else if (h.code === 'floorUnknown') { a.floor = 'Ground'; did.push('confirm a ground-floor shop'); }
    else return { projectable: false, text: `Can’t project yet: they first need to answer “${h.fix}”` };
  }
  const fixed = { ...data, applications: data.applications.map((x) => (x.id === d.id ? a : x)) };
  const fd = runEngine(fixed, profile, { ...meta, noWhatIf: true }).decisions[d.id];
  const fixes = did.join(' and ');
  let text;
  if (fd.outcome === 'Recommended' || fd.outcome === 'Conditional') text = `If they ${fixes}, they would win a slot in ${fd.territoryId} with a score of ${fd.score}.`;
  else if (fd.outcome === 'Redirect') text = `Even if they ${fixes}, they would still lose pin ${fd.applicant.pin} to ${fd.versus.id} (${fd.score} vs ${fd.versus.score}), but could be offered pin ${fd.redirect.pin} instead.`;
  else if (fd.outcome === 'Waitlist' && fd.versus) text = `Even if they ${fixes}, they would still lose to ${fd.versus.id} (${fd.score} vs ${fd.versus.score}), who ${fd.versus.why}.`;
  else if (fd.outcome === 'Waitlist') text = `Even if they ${fixes}, a score of ${fd.score} is still below the bar: ${fd.reason}`;
  else if (fd.outcome === 'Reject') text = `Even if they ${fixes}, they would still be rejected: ${fd.reason}`;
  else text = `If they ${fixes}, they would still be on hold: ${fd.reason}`;
  return { projectable: true, fixes: did, outcome: fd.outcome, score: fd.score, vs: fd.versus?.id ?? null, text };
}

// Points needed to beat whoever won (or reach the territory's bar), and whether more capital alone could close the gap.
function toBeat(d, profile, target, goal) {
  const need = target - d.score;
  const a = d.applicant;
  let extra = null;
  for (let add = 1; add <= 60; add++) {
    if (scoreApplicant({ ...a, investment: a.investment + add }, d.minInvestment, profile).total >= target) { extra = add; break; }
  }
  const floorGain = a.floor === 'Upper' && !profile.upperFloorOk ? 15 : a.floor === 'Mall unit' ? 3 : 0;
  const parts = [];
  if (extra !== null) parts.push(`₹${extra} lakh more capital would do it`);
  else parts.push('more capital alone can’t close it (investment points are capped at 30)');
  if (floorGain >= need) parts.push(`a ground-floor shop (+${floorGain}) would also do it`);
  // Experience bands: 1, 3 and 6 years. The smallest band that closes the gap, if any.
  const base = scoreApplicant(a, d.minInvestment, profile);
  for (const yrs of [1, 3, 6]) {
    if ((a.experience ?? 0) >= yrs) continue;
    const gain = scoreApplicant({ ...a, experience: yrs }, d.minInvestment, profile).total - base.total;
    if (gain >= need) { parts.push(`${yrs} year${yrs === 1 ? '' : 's'} of retail experience (+${gain}) would also do it; worth checking whether they have any`); break; }
  }
  return { points: need, text: `Needs ${need} more point${need === 1 ? '' : 's'} to ${goal}: ${parts.join('; ')}.` };
}

export function diffResults(prev, next) {
  if (!prev) return [];
  const changes = [];
  for (const [id, d] of Object.entries(next.decisions)) {
    const p = prev.decisions[id];
    if (!p) continue;
    const fromRank = p.competition?.rank ?? null;
    const toRank = d.competition?.rank ?? null;
    if (p.outcome !== d.outcome || p.score !== d.score || p.redirect?.pin !== d.redirect?.pin || p.applicant.pin !== d.applicant.pin || fromRank !== toRank) {
      changes.push({ id, from: p.outcome, to: d.outcome, fromScore: p.score, toScore: d.score, fromPin: p.redirect?.pin, toPin: d.redirect?.pin, fromRank, toRank, territoryId: d.territoryId, reason: d.reason });
    }
  }
  return changes;
}
