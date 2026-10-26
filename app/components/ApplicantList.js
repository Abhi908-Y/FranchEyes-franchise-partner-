'use client';

import { useState } from 'react';
import { PIPELINE, EDITABLE_FIELDS } from '../../lib/constants';

const ORDER = { Recommended: 0, Waitlist: 1, Hold: 2, Reject: 3 };
const OUTCOME_LABEL = { Recommended: 'Recommended', Waitlist: 'Waitlist', Hold: 'On hold', Reject: 'Rejected' };
const show = (v, unit = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${unit}`);

function Facts({ a, updated }) {
  const rows = [
    ['City', `${show(a.city)}, pin ${show(a.pin)}`, ['city', 'pin']],
    ['Investment', a.investment === null ? '—' : `₹${a.investment} lakh`, ['investment']],
    ['Retail experience', a.experience === null ? '—' : `${a.experience} years`, ['experience']],
    ['Business', show(a.business), ['business']],
    ['Space', `${show(a.space)}${a.size !== null ? `, ${a.size} sq ft` : ''}`, ['space', 'size']],
    ['Floor', show(a.floor), ['floor']],
    ['Target launch', a.launch === null ? '—' : `${a.launch} months`, ['launch']],
    ['Training language', show(a.language), ['language']],
    ['Notes', show(a.notes), ['notes']],
  ];
  return (
    <dl className="facts">
      {rows.map(([k, v, fields]) => {
        const changed = updated && fields.some((f) => f in updated);
        return (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd className={changed ? 'changed' : ''}>{v}{changed ? ' (updated in chat, unverified)' : ''}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function ScoreBars({ d }) {
  if (!d.scoreParts) return null;
  const max = { investment: 30, experience: 20, space: 25, floor: 15, launch: 10 };
  const label = { investment: 'Investment', experience: 'Experience', space: 'Space', floor: 'Floor', launch: 'Launch timing' };
  return (
    <div className="bars">
      {Object.entries(d.scoreParts).map(([k, v]) => (
        <div className="bar" key={k}>
          <span>{label[k]}</span>
          <span className="track"><span className="fill" style={{ width: `${(v / max[k]) * 100}%`, display: 'block' }} /></span>
          <span className="num">{v}/{max[k]}</span>
        </div>
      ))}
    </div>
  );
}

function Email({ email }) {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  return (
    <div className="email">
      <div className="subj">{email.subject}</div>
      <pre>{email.body}</pre>
      <div className="acts">
        <button
          className="btn"
          onClick={async () => {
            try { await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
          }}
        >
          {copied ? 'Copied' : 'Copy email'}
        </button>
        <a className="btn" href={mailto}>Open in email app</a>
        <small>The sheet has no contact details, so add the address in your email app.</small>
      </div>
    </div>
  );
}

function Review({ d, review, setReview }) {
  const r = review[d.id];
  if (d.outcome !== 'Recommended') return null;
  if (!r) {
    return (
      <div>
        <h4>Your review</h4>
        <div className="review">
          <button className="btn primary" onClick={() => setReview({ ...review, [d.id]: { status: 'confirmed', stage: 0 } })}>Confirm and start onboarding</button>
          <button className="btn" onClick={() => setReview({ ...review, [d.id]: { status: 'declined' } })}>Decline</button>
        </div>
      </div>
    );
  }
  if (r.status === 'declined') {
    return (
      <div>
        <h4>Your review</h4>
        <div className="review">
          <span className="declined">You declined this recommendation.</span>
          <button className="btn quiet" onClick={() => { const c = { ...review }; delete c[d.id]; setReview(c); }}>Undo</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h4>Onboarding</h4>
      <div className="pipe" role="list">
        {PIPELINE.map((s, i) => (
          <div role="listitem" key={s} className={`stage${i < r.stage ? ' done' : ''}${i === r.stage ? ' now' : ''}`}>{s}</div>
        ))}
      </div>
      <div className="review" style={{ marginTop: 10 }}>
        {r.stage < PIPELINE.length ? (
          <button className="btn primary" onClick={() => setReview({ ...review, [d.id]: { ...r, stage: r.stage + 1 } })}>
            Mark “{PIPELINE[r.stage]}” done
          </button>
        ) : <span>Ready to open.</span>}
        {r.stage > 0 ? <button className="btn quiet" onClick={() => setReview({ ...review, [d.id]: { ...r, stage: r.stage - 1 } })}>Step back</button> : null}
      </div>
    </div>
  );
}

function Detail({ d, review, setReview }) {
  const a = d.applicant;
  return (
    <div className="detail">
      <div className="two">
        <div>
          <h4>Application</h4>
          <Facts a={a} updated={d.updatedFields} />
        </div>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div className={`t-${d.outcome}`}>
            <h4>Why {OUTCOME_LABEL[d.outcome].toLowerCase()}</h4>
            <ul className="issues">
              {d.outcome === 'Reject' && d.rejectReasons.map((r) => <li key={r} className="bad">{r}</li>)}
              {d.outcome === 'Hold' && d.issues.map((h) => (
                <li key={h.issue}>{h.issue}<span className="fix">Fix: {h.fix}</span></li>
              ))}
              {(d.outcome === 'Recommended' || d.outcome === 'Waitlist') && <li>{d.reason}</li>}
              {d.outcome === 'Reject' && d.issues.length ? <li>Also missing: {d.issues.map((h) => h.fix).join(' ')}</li> : null}
              {d.warnings.map((w) => <li key={w} className="warn">{w}</li>)}
            </ul>
            {d.plan.slotStatus && d.outcome !== 'Reject' ? <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-3)' }}>{d.plan.slotStatus}</p> : null}
          </div>
          {d.scoreParts ? (
            <div>
              <h4>Score {d.score}/100{d.competition ? `, rank ${d.competition.rank} of ${d.competition.of} in ${d.territoryId}` : ''}</h4>
              <ScoreBars d={d} />
              {d.competition?.rivals.length ? (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-3)' }}>
                  Competing with {d.competition.rivals.map((r) => `${r.id} (${r.score})`).join(', ')}. Needs {d.competition.bar}+ in this territory.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="two">
        <div>
          <h4>Next steps</h4>
          <ol className="steps">{d.plan.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        {d.plan.training ? (
          <div>
            <h4>How they’ll be prepared</h4>
            <div className="training">
              <b>{d.plan.training.track}</b>, {d.plan.training.weeks} week{d.plan.training.weeks === 1 ? '' : 's'}, in {d.plan.training.language}
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{d.plan.training.why}</div>
              <ul>{d.plan.training.modules.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          </div>
        ) : null}
      </div>

      <Review d={d} review={review} setReview={setReview} />

      <div>
        <h4>Email draft</h4>
        <Email email={d.plan.email} />
      </div>
    </div>
  );
}

export default function ApplicantList({ result, filter, openId, setOpenId, flash, review, setReview }) {
  const list = Object.values(result.decisions)
    .filter((d) => filter === 'All' || d.outcome === filter)
    .sort((x, y) => ORDER[x.outcome] - ORDER[y.outcome] || (y.score ?? -1) - (x.score ?? -1) || x.id.localeCompare(y.id, undefined, { numeric: true }));

  if (!list.length) return <p className="section-sub">No applicants with this outcome.</p>;

  return (
    <div className="list">
      {list.map((d) => {
        const open = openId === d.id;
        const a = d.applicant;
        const r = review[d.id];
        return (
          <article key={d.id} id={`app-${d.id}`} className={`app${flash.includes(d.id) ? ' flash' : ''}`}>
            <button className="app-row" aria-expanded={open} onClick={() => setOpenId(open ? null : d.id)}>
              <span className={`tagcell t-${d.outcome}`}>
                <span className="tag">{OUTCOME_LABEL[d.outcome]}</span>
              </span>
              <span className="who">
                <b>{d.id}</b> {a.name || 'No name'}
                {d.updatedFields ? <span className="badge-upd">Updated, verify</span> : null}
                <div className="meta">
                  {a.city || 'No city'}, {a.pin || 'no pin'}{d.territoryId ? `, ${d.territoryId}` : ''}
                  {r?.status === 'confirmed' ? `, onboarding: ${r.stage >= PIPELINE.length ? 'ready to open' : PIPELINE[r.stage].toLowerCase()}` : ''}
                  {r?.status === 'declined' ? ', declined by you' : ''}
                </div>
                <div className="why">{d.reason}</div>
              </span>
              <span className="score num">{d.score ?? '—'}<small>score</small></span>
            </button>
            {open ? <Detail d={d} review={review} setReview={setReview} /> : null}
          </article>
        );
      })}
    </div>
  );
}

export { EDITABLE_FIELDS };
