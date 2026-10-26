'use client';

import { useEffect, useRef } from 'react';
import { READINESS_BANDS } from '../../lib/constants';

const TONE = { Ready: 'o-Recommended', 'Nearly ready': 'o-Hold', 'Not ready': 'o-Reject' };

// Explains the franchisee readiness score and how outcomes are decided, using the current brand rules.
export default function Rubric({ open, onClose, profile }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const min = profile.minInvestment;
  const parts = [
    ['Investment', 30, `10 points at the tier minimum (Tier 1 ₹${min['Tier 1']}L, Tier 2 ₹${min['Tier 2']}L, Tier 3 ₹${min['Tier 3']}L), rising to 30 at 50% above it. 0 if below the minimum or not given.`],
    ['Retail experience', 20, 'Under 1 year 0, 1–2 years 8, 3–5 years 14, 6+ years 20.'],
    ['Space', 25, 'Owned 25, rented 20, no shop yet 0.'],
    ['Floor', 15, profile.upperFloorOk
      ? 'Ground floor 15, mall unit 12, upper floor 12 (this category allows any floor). Not known, or no shop yet 0.'
      : 'Ground floor 15, mall unit 12. Upper floor, not known, or no shop yet 0.'],
    ['Launch timing', 10, 'Within 3 months 10, 4–6 months 6, later or not given 3.'],
  ];

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="rubric-title">
      {open ? (
        <div className="dialog-body">
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
          <div>
            <h2 id="rubric-title" style={{ margin: '0 0 6px', fontSize: 22 }}>Scoring rubric</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              Every applicant gets a franchisee readiness score out of 100. It shows how ready the partner is to open a store.
              Code decides outcomes; the AI chat only explains them.
            </p>
          </div>

          <div>
            <h3>Franchisee readiness score (0–100)</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {parts.map(([name, pts, how]) => (
                <div className="rubric-row" key={name}>
                  <b>{name}</b><span className="pts num">up to {pts}</span>
                  <span className="muted">{how}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3>Readiness labels</h3>
            <div className="bands">
              {READINESS_BANDS.map((b, i) => (
                <span key={b.label} className={`chip ${TONE[b.label]}`}>
                  {b.label}: {i === 0 ? `${b.min}+` : `${b.min}–${READINESS_BANDS[i - 1].min - 1}`}
                </span>
              ))}
            </div>
          </div>

          <div className="box dashed">
            <h3>How outcomes are decided</h3>
            <ul className="issues">
              <li className="bad">Reject: investment more than {profile.rejectShortfall}% below the minimum, or a location problem (pin already has a store, or isn’t in any territory) with no free pin to offer instead.</li>
              <li className="warn">On hold: something fixable, such as missing details, no shop yet, an unknown floor, a shop under {profile.minSize} sq ft, a small investment shortfall, or details that contradict each other.</li>
              <li>Everyone else is ranked by readiness inside their territory. Slots go to the highest scores, one store per pin code, if they reach the territory’s bar: high priority {profile.minScore.High}+, medium {profile.minScore.Medium}+, low {profile.minScore.Low}+. The rest are waitlisted.</li>
              <li>Conditional: won a slot, approved once a condition is met. {profile.upperFloorOk ? '' : 'An upper-floor shop competes with 0 floor points and, if it wins, must move to a ground-floor or mall unit within 30 days. '}Anything approved on a fact only reported in chat must be verified within 7 days.</li>
              <li>Redirect: would qualify, but the pin is taken, has a store or is outside every territory. They’re offered a free pin in the same territory first, then another territory in the same city.</li>
              <li>Withdrawn: taken out of the pool in chat (pulled out, or a duplicate). Their slot is released and the next in line moves up.</li>
            </ul>
            <p className="muted" style={{ marginTop: 8 }}>
              Readiness is shown for everyone, but only applicants with no reject or hold reason compete for slots. Minimum investment: Tier 1 ₹{profile.minInvestment['Tier 1']}L, Tier 2 ₹{profile.minInvestment['Tier 2']}L, Tier 3 ₹{profile.minInvestment['Tier 3']}L. Change the numbers under Brand rules.
            </p>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
