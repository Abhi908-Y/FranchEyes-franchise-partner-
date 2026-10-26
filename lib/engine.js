import { CITIES } from './constants.js';
import { buildPlan } from './plan.js';

const L = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh`;

function cityFromPin(pin) {
  return Object.entries(CITIES).find(([, c]) => pin && pin.startsWith(c.prefix))?.[0] ?? null;
}

export function scoreApplicant(a, min) {
  const headroom = Math.max(0, (a.investment - min) / min);
  const investment = Math.round(10 + 20 * Math.min(1, headroom / 0.5));
  const e = a.experience ?? 0;
  const experience = e < 1 ? 0 : e < 3 ? 8 : e < 6 ? 14 : 20;
  const space = a.space === 'Owned' ? 25 : 20;
  const floor = a.floor === 'Ground' ? 15 : 12;
  const l = a.launch;
  const launch = l === null || l === undefined ? 3 : l <= 3 ? 10 : l <= 6 ? 6 : 3;
  return {
    total: investment + experience + space + floor + launch,
    parts: { investment, experience, space, floor, launch },
  };
}

function checkApplicant(a, ctx, updated = {}) {
  const { profile, storeByPin, terByPin } = ctx;
  const rejects = [];
  const holds = []; // { issue, fix }
  const warnings = [];

  // Required fields
  if (!a.name) holds.push({ issue: 'Applicant name is missing.', fix: 'Add the applicant’s name.' });
  const cityInfo = a.city ? CITIES[a.city] : null;
  if (!a.city) holds.push({ issue: 'City is missing.', fix: 'Confirm the city.' });
  else if (!cityInfo) holds.push({ issue: `“${a.city}” isn’t one of the seven cities in scope.`, fix: 'Confirm the city.' });
  const pinValid = a.pin && /^\d{6}$/.test(a.pin);
  if (!a.pin) holds.push({ issue: 'Pin code is missing.', fix: 'Confirm the 6-digit pin code of the shop.' });
  else if (!pinValid) holds.push({ issue: `Pin code “${a.pin}” isn’t 6 digits.`, fix: 'Confirm the 6-digit pin code of the shop.' });
  if (a.state && a.state.toLowerCase() !== 'karnataka') warnings.push(`State is given as “${a.state}”; all stores are in Karnataka.`);

  // City and pin must agree
  if (pinValid && cityInfo && !a.pin.startsWith(cityInfo.prefix)) {
    const actual = cityFromPin(a.pin);
    holds.push({
      issue: `City says ${a.city}, but pin ${a.pin} ${actual ? `belongs to ${actual}` : `doesn’t start with ${cityInfo.prefix}`}.`,
      fix: 'Confirm the exact location: city and pin code.',
    });
  }

  // Territory and existing stores (hard rules)
  const terr = pinValid ? terByPin.get(a.pin) : null;
  if (pinValid) {
    const store = storeByPin.get(a.pin);
    if (store) {
      rejects.push(`The brand already has a store in pin ${a.pin} (${store.id}, opened ${store.year ?? 'earlier'}). It never opens two stores in one pin code.`);
    } else if (!terr) {
      rejects.push(`Pin ${a.pin} isn’t in any territory the brand is expanding into right now.`);
    }
  }

  // Investment
  const tier = terr?.tier || cityInfo?.tier || null;
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
        issue: `Investment of ${L(a.investment)} is ${L(min - a.investment)} short of the ${L(min)} minimum for a ${tier} city.`,
        fix: `Show an extra ${L(min - a.investment)}: savings, a partner or a loan sanction letter.`,
      });
    }
  }
  if (a.investmentRaw && typeof a.investmentRaw === 'string' && /\d\s*[-–to]+\s*\d/.test(a.investmentRaw)) {
    warnings.push(`Investment was written as a range (“${a.investmentRaw}”); the lower figure was used.`);
  }

  // Experience
  if (a.experience === null) holds.push({ issue: 'Retail experience is missing.', fix: 'Confirm years of retail experience (0 if none).' });
  else if (a.experience < 0 || a.experience > 50) holds.push({ issue: `Retail experience of ${a.experience} years doesn’t look right.`, fix: 'Confirm years of retail experience.' });
  else if (a.experience === 0 && a.business && /(run|runs|ran|own|owns|manag)\w*\b.*\b(shop|store|outlet|showroom|retail|boutique|mart)/i.test(a.business)) {
    warnings.push(`Experience is 0 years, but their business (“${a.business}”) sounds like retail. Worth confirming; it would raise their score.`);
  }

  // Space and floor
  const notes = (a.notes || '').toLowerCase();
  if (!a.space) {
    holds.push({ issue: 'Space status is missing.', fix: 'Confirm whether they own, rent or are still looking for a shop.' });
  } else if (a.space === 'Not yet identified') {
    const saysFloor = a.floor && a.floor !== 'Not known';
    if (a.size !== null || saysFloor) {
      holds.push({
        issue: `Says no space found yet, but also gives ${[a.size !== null ? `a size (${a.size} sq ft)` : null, saysFloor ? `a floor (${a.floor})` : null].filter(Boolean).join(' and ')}.`,
        fix: 'Clarify whether a shop has been found. If yes, share its size, floor and whether it’s owned or rented.',
      });
    } else {
      holds.push({
        issue: 'No shop space found yet.',
        fix: `Find a ground-floor or mall space of at least ${profile.minSize} sq ft inside the territory.`,
      });
    }
    if (a.launch !== null && a.launch <= 2) warnings.push(`Wants to open in ${a.launch} month${a.launch === 1 ? '' : 's'} without a shop yet. Setup alone usually takes about 3 months.`);
  } else if (a.space === 'Owned' || a.space === 'Rented') {
    if (a.size === null) holds.push({ issue: 'Space size is missing.', fix: 'Confirm the shop’s size in sq ft.' });
    else if (a.size < profile.minSize) holds.push({ issue: `Shop is ${a.size} sq ft, below the ${profile.minSize} sq ft minimum.`, fix: `Find a space of at least ${profile.minSize} sq ft.` });
    else if (a.size > 3000) warnings.push(`Shop is ${a.size} sq ft, much larger than a typical store. Confirm the figure.`);

    if (a.floor === 'Upper') holds.push({ issue: 'Shop is on an upper floor. Walk-in stores need street-level footfall.', fix: 'Move to a ground-floor or mall space.' });
    else if (!a.floor || a.floor === 'Not known') holds.push({ issue: 'Floor isn’t known.', fix: 'Confirm which floor the shop is on.' });
    else if (a.floor !== 'Ground' && a.floor !== 'Mall unit') holds.push({ issue: `Floor “${a.floor}” isn’t clear.`, fix: 'Confirm which floor the shop is on.' });

    if (!updated.floor && !updated.notes && /(first|second|third|1st|2nd|3rd|upper|top)\s+floor/.test(notes) && a.floor !== 'Upper') {
      holds.push({ issue: `Form says ${a.floor || 'no floor'}, but their notes mention an upper floor (“${a.notes}”).`, fix: 'Confirm which floor the shop is on.' });
    }
    if (!updated.space && !updated.notes && /(no (shop|space)|yet to (find|identify|finali[sz]e)|looking for (a )?(shop|space)|searching for (a )?(shop|space)|not finali[sz]ed)/.test(notes)) {
      holds.push({ issue: `Form says the space is ${a.space.toLowerCase()}, but their notes suggest they’re still looking (“${a.notes}”).`, fix: 'Confirm whether the shop is actually secured.' });
    }
  } else {
    holds.push({ issue: `Space status “${a.space}” isn’t clear.`, fix: 'Confirm whether they own, rent or are still looking for a shop.' });
  }

  if (a.launch !== null && a.launch < 3 && (a.space === 'Owned' || a.space === 'Rented')) {
    warnings.push(`Target launch of ${a.launch} month${a.launch === 1 ? '' : 's'} is tight; setup and training usually take about 3 months.`);
  }
  if (!a.language) warnings.push('No training language given, so English is assumed.');

  return { rejects, holds, warnings, terr, tier, min };
}

export function runEngine(data, profile, meta = {}) {
  const storeByPin = new Map(data.stores.filter((s) => s.pin).map((s) => [s.pin, s]));
  const terByPin = new Map();
  const notes = [];
  for (const t of data.territories) {
    for (const p of t.pins) {
      if (terByPin.has(p)) notes.push(`Pin ${p} is listed in both ${terByPin.get(p).id} and ${t.id}; ${terByPin.get(p).id} is used.`);
      else terByPin.set(p, t);
    }
  }
  const ctx = { profile, storeByPin, terByPin };

  const decisions = {};
  const eligibleByTer = new Map();

  for (const a of data.applications) {
    const c = checkApplicant(a, ctx, meta.updated?.[a.id] || {});
    const d = {
      id: a.id,
      applicant: a,
      territoryId: c.terr?.id ?? null,
      tier: c.tier,
      minInvestment: c.min,
      warnings: c.warnings,
      issues: c.holds,
      rejectReasons: c.rejects,
      score: null,
      scoreParts: null,
      outcome: null,
      reason: '',
      competition: null,
      updatedFields: meta.updated?.[a.id] ?? null,
    };
    if (c.rejects.length) {
      d.outcome = 'Reject';
      d.reason = c.rejects[0];
    } else if (c.holds.length) {
      d.outcome = 'Hold';
      d.reason = c.holds.map((h) => h.issue).join(' ');
    } else {
      const s = scoreApplicant(a, c.min);
      d.score = s.total;
      d.scoreParts = s.parts;
      const list = eligibleByTer.get(c.terr.id) || [];
      list.push(d);
      eligibleByTer.set(c.terr.id, list);
    }
    decisions[a.id] = d;
  }

  // Allocation: per territory, highest score first, one store per pin code.
  const territories = data.territories.map((t) => {
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
      } else if (d.score < bar) {
        d.outcome = 'Waitlist';
        d.reason = `Score ${d.score} is below the ${bar} needed in a ${t.priority}-priority territory (${t.id}).`;
        d.waitingFor = `${t.id} priority rising, or a stronger application`;
      } else if (winners.length >= t.slots) {
        d.outcome = 'Waitlist';
        d.reason = t.slots === 0
          ? `${t.id} has no open slots right now.`
          : `All ${t.slots} slot${t.slots === 1 ? '' : 's'} in ${t.id} went to higher scorers: ${winners.map((w) => `${w.id} (${w.score})`).join(', ')}.`;
        d.waitingFor = `a slot in ${t.id}`;
      } else {
        d.outcome = 'Recommended';
        winners.push(d);
        awardedPins.set(pin, d);
        d.reason = `Ranked ${i + 1} of ${ranked.length} eligible in ${t.id} and won ${winners.length === 1 && t.slots === 1 ? 'its only slot' : `slot ${winners.length} of ${t.slots}`} with a score of ${d.score}.`;
      }
    });

    const pins = t.pins.map((p) => {
      const store = storeByPin.get(p);
      if (store) return { pin: p, status: 'store', by: store.id };
      const w = awardedPins.get(p);
      if (w) return { pin: p, status: 'awarded', by: w.id };
      return { pin: p, status: 'open' };
    });
    const inTer = Object.values(decisions).filter((d) => d.territoryId === t.id);
    return {
      ...t,
      bar,
      pinsState: pins,
      filled: winners.length,
      winners: winners.map((w) => w.id),
      counts: {
        Recommended: inTer.filter((d) => d.outcome === 'Recommended').length,
        Waitlist: inTer.filter((d) => d.outcome === 'Waitlist').length,
        Hold: inTer.filter((d) => d.outcome === 'Hold').length,
        Reject: inTer.filter((d) => d.outcome === 'Reject').length,
      },
    };
  });

  const terById = Object.fromEntries(territories.map((t) => [t.id, t]));
  for (const d of Object.values(decisions)) {
    d.plan = buildPlan(d, { terById, territories, profile, stores: data.stores });
  }

  const counts = { Recommended: 0, Waitlist: 0, Hold: 0, Reject: 0 };
  Object.values(decisions).forEach((d) => counts[d.outcome]++);

  return { decisions, territories, counts, notes };
}

export function diffResults(prev, next) {
  if (!prev) return [];
  const changes = [];
  for (const [id, d] of Object.entries(next.decisions)) {
    const p = prev.decisions[id];
    if (!p) continue;
    if (p.outcome !== d.outcome || p.score !== d.score) {
      changes.push({ id, from: p.outcome, to: d.outcome, fromScore: p.score, toScore: d.score, reason: d.reason });
    }
  }
  return changes;
}
