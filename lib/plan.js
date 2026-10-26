import { SHADOW_CITY } from './constants.js';

const L = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh`;
const place = (a) => (a.floor === 'Mall unit' ? 'mall unit' : a.floor === 'Upper' ? 'upper-floor space' : 'ground-floor space');

function openPinsNearby(d, { territories }) {
  const city = d.applicant.city;
  const out = [];
  for (const t of territories) {
    if (t.city !== city) continue;
    if (t.filled >= t.slots) continue;
    for (const p of t.pinsState) if (p.status === 'open') out.push(`${p.pin} (${t.id})`);
  }
  return out.slice(0, 4);
}

function shadowStore(city, stores) {
  const target = SHADOW_CITY[city] || city;
  const s = stores.find((x) => x.city === target);
  return s ? `${s.id} in ${s.city}` : stores[0] ? `${stores[0].id} in ${stores[0].city}` : 'an existing store';
}

export function trainingPlan(a, stores) {
  const language = a.language || 'English';
  const e = a.experience ?? 0;
  const shadow = shadowStore(a.city, stores);
  if (e < 3) {
    return {
      track: 'Full programme',
      weeks: 3,
      language,
      modules: [
        'Week 1: retail basics, store opening and closing, cash and billing',
        'Week 2: product range, customer service, stock and inventory system',
        `Week 3: shadow shifts at ${shadow}, then a supervised first week in their own store`,
      ],
      why: e === 0 ? 'No retail experience, so they get the complete programme.' : `${e} year${e === 1 ? '' : 's'} of retail experience, so they get the complete programme.`,
    };
  }
  if (e < 6) {
    return {
      track: 'Standard programme',
      weeks: 2,
      language,
      modules: [
        'Week 1: brand standards, product range, billing and inventory system',
        `Week 2: 3 shadow shifts at ${shadow}, plus staff hiring and rostering`,
      ],
      why: `${e} years of retail experience, so store basics are skipped.`,
    };
  }
  return {
    track: 'Fast track',
    weeks: 1,
    language,
    modules: [`5 days: brand standards, product range, systems, and 2 shadow shifts at ${shadow}`],
    why: `${e} years of retail experience, so only brand-specific training is needed.`,
  };
}

// Questions beyond the hold fixes (contradictions, timing, commitment), for the email.
function extraQuestions(d) {
  const extra = (d.questions || []).filter((q) => !d.issues.some((h) => h.fix === q));
  return extra.length ? `\n\nWe’d also like to check:\n${extra.map((q) => `- ${q}`).join('\n')}` : '';
}

function email(d, profile) {
  const a = d.applicant;
  const named = profile.brandName && profile.brandName.trim() && profile.brandName !== 'Your brand' ? profile.brandName.trim() : null;
  const brand = named ? `a ${named}` : 'a franchise';
  const first = (a.name || 'there').split(' ')[0];
  const sign = `\n\nRegards,\nExpansion team${named ? `, ${named}` : ''}`;
  if (d.outcome === 'Withdrawn') {
    return {
      subject: `Your franchise application ${a.id}`,
      body: `Hi ${first},\n\nThanks for letting us know. We’ve closed your application ${a.id}. If your plans change, we’d be glad to hear from you again.${sign}`,
    };
  }
  if (d.outcome === 'Redirect') {
    const r = d.redirect;
    const why = d.location ? d.location.text.replace(/^./, (c) => c.toLowerCase()) : 'another applicant was given that pin code.';
    return {
      subject: `Your franchise application ${a.id}: a different pin code`,
      body: `Hi ${first},\n\nThank you for applying to open ${brand} store. Your application is strong, but we can’t open in pin ${a.pin}: ${why}\n\nWe’d like to offer you pin ${r.pin} instead, where we have a slot open. If you can find a ground-floor or mall space of at least ${d.plan.minSize} sq ft there, reply with the address and we’ll move your application forward straight away.${sign}`,
    };
  }
  if (d.outcome === 'Conditional') {
    return {
      subject: `Your franchise application ${a.id}: shortlisted, with one condition`,
      body: `Hi ${first},\n\nThank you for applying to open ${brand} store in ${a.city} (${a.pin}). Your application has been shortlisted on this condition:\n\n${d.conditions.map((c) => `- ${c.fix}`).join('\n')}\n\nOnce that’s done, the next step is a site visit. Training will be in ${d.plan.training.language}.${sign}`,
    };
  }
  if (d.outcome === 'Recommended') {
    return {
      subject: `Your franchise application ${a.id}: next step`,
      body: `Hi ${first},\n\nThank you for applying to open ${brand} store in ${a.city} (${a.pin}). Your application has been shortlisted.\n\nThe next step is a site visit to your ${a.size} sq ft ${place(a)}. Please reply with two or three times that suit you this week, and keep your ${a.space === 'Owned' ? 'ownership documents' : 'rental agreement'} handy.\n\nTraining will be in ${d.plan.training.language}.${sign}`,
    };
  }
  if (d.outcome === 'Hold') {
    return {
      subject: `Your franchise application ${a.id}: a few details needed`,
      body: `Hi ${first},\n\nThank you for applying to open ${brand} store in ${a.city || 'Karnataka'}. Before we can move forward, we need the following:\n\n${d.issues.map((h) => `- ${h.fix}`).join('\n')}${extraQuestions(d)}\n\nOnce we have this, we’ll review your application again straight away.${sign}`,
    };
  }
  if (d.outcome === 'Waitlist') {
    return {
      subject: `Your franchise application ${a.id}: on our waitlist`,
      body: `Hi ${first},\n\nThank you for applying to open ${brand} store in ${a.city}. Your application meets our requirements, but ${d.reason.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())}.\n\nWe’ve placed you on our waitlist and will contact you as soon as ${d.waitingFor} becomes available.${sign}`,
    };
  }
  const nearby = d.plan.nearbyPins;
  return {
    subject: `Your franchise application ${a.id}`,
    body: `Hi ${first},\n\nThank you for your interest in opening a ${brand} store. We’re unable to take your application forward because ${d.reason.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())}.${nearby.length ? `\n\nWe are looking for partners in nearby pin codes: ${nearby.map((p) => p.split(' ')[0]).join(', ')}. If you can find a space there, we’d be glad to hear from you again.` : ''}${sign}`,
  };
}

export function buildPlan(d, ctx) {
  const a = d.applicant;
  const t = d.territoryId ? ctx.terById[d.territoryId] : null;
  const plan = { nextSteps: [], training: null, nearbyPins: [], slotStatus: null, minSize: ctx.profile.minSize };

  if (t) plan.slotStatus = `${t.id} has ${Math.max(0, t.slots - t.filled)} of ${t.slots} slot${t.slots === 1 ? '' : 's'} still open.`;

  if (d.outcome === 'Withdrawn') {
    plan.nextSteps = ['No action. Any slot or pin they held has been released and the batch re-ran.'];
  } else if (d.outcome === 'Redirect') {
    const r = d.redirect;
    plan.nextSteps = [
      `Offer pin ${r.pin} in ${r.territoryId}: it’s free and has a slot open. Ask them to find a ground-floor or mall space of at least ${ctx.profile.minSize} sq ft there.`,
      `When they confirm a space, tell the chat (“${a.id} found a space in pin ${r.pin}”); they’ll then be ranked for the slot.`,
      'The slot isn’t reserved until they confirm.',
    ];
  } else if (d.outcome === 'Recommended' || d.outcome === 'Conditional') {
    plan.training = trainingPlan(a, ctx.stores);
    const launchNote = a.launch !== null && a.launch < 3
      ? ` Their ${a.launch}-month target is tight; plan for about 3 months.`
      : a.launch !== null ? ` Fits their ${a.launch}-month target.` : '';
    plan.nextSteps = [
      `Site visit within 7 days: verify the ${a.size} sq ft ${place(a)} at pin ${a.pin}, frontage and footfall.`,
      `Agreement: share ${a.space === 'Owned' ? 'ownership proof' : 'the rental agreement (5-year lease preferred)'} and proof of ${L(a.investment)} funds; sign and pay the franchise fee.`,
      `Store setup, about 6–8 weeks: fit-out to brand design, stock, billing system.${launchNote}`,
      `Hire 2–3 staff ${plan.training.weeks > 1 ? 'before training week 2' : 'before training starts'}.`,
      `Training: ${plan.training.track.toLowerCase()} (${plan.training.weeks} week${plan.training.weeks === 1 ? '' : 's'}) in ${plan.training.language}.`,
      'Launch with a supervised first week.',
    ];
    if (d.outcome === 'Conditional') plan.nextSteps = [...d.conditions.map((c) => `First: ${c.fix}`), ...plan.nextSteps];
  } else if (d.outcome === 'Hold') {
    plan.nextSteps = [...d.issues.map((h) => h.fix), 'Once fixed, the application is re-checked automatically. A slot isn’t reserved while on hold.'];
  } else if (d.outcome === 'Waitlist') {
    plan.nextSteps = [
      `Wait for ${d.waitingFor}. They’re next in line if a recommended applicant drops out.`,
      'Keep their space and funds ready; re-check if they can move to another open pin code.',
    ];
    plan.nearbyPins = openPinsNearby(d, ctx);
    if (plan.nearbyPins.length) plan.nextSteps.push(`Open pin codes in ${a.city} right now: ${plan.nearbyPins.join(', ')}.`);
  } else if (/^Investment/.test(d.reason)) {
    plan.nextSteps = [`They can re-apply if they can invest at least ${L(d.minInvestment)}.`];
  } else {
    plan.nearbyPins = openPinsNearby(d, ctx);
    plan.nextSteps = plan.nearbyPins.length
      ? [`Suggest they look for a space in an open pin code instead: ${plan.nearbyPins.join(', ')}.`]
      : ['No further action. Keep their details in case a territory opens in their area.'];
  }

  d.plan = plan; // email needs plan.training
  plan.email = email(d, ctx.profile);
  return plan;
}
