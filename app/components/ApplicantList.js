'use client';

import { useEffect, useRef, useState } from 'react';
import { PIPELINE, NEXT_STEP_TYPES } from '../../lib/constants';
import NextSteps from './NextSteps';
import { OUTCOME_LABEL } from '../../lib/chatLocal';

const ORDER = { Recommended: 0, Conditional: 1, Redirect: 2, Waitlist: 3, Hold: 4, Reject: 5, Withdrawn: 6 };
const TONE = { Ready: 'ok', 'Nearly ready': 'warn', 'Not ready': 'hot' };
const MAX = { investment: 30, experience: 20, space: 25, floor: 15, launch: 10 };
const PART_LABEL = { investment: 'Investment', experience: 'Experience', space: 'Space', floor: 'Floor', launch: 'Launch timing' };
const show = (v, unit = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${unit}`);

// Outcome first, then readiness, then ID. Used by the list and the download.
export function sortDecisions(ds) {
  return [...ds].sort((x, y) =>
    ORDER[x.outcome] - ORDER[y.outcome] || y.readiness.total - x.readiness.total || x.id.localeCompare(y.id, undefined, { numeric: true }));
}

function Segs({ r }) {
  const on = Math.round(r.total / 10);
  return (
    <span className="ready" data-tone={TONE[r.band]}>
      <span className="segs" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => <span key={i} className={`seg${i < on ? ' on' : ''}`} />)}
      </span>
      <span className="ready-label">{r.band}</span>
    </span>
  );
}

// The soonest upcoming scheduled step for a candidate, if any.
export function nextScheduled(items = []) {
  const now = Date.now();
  return [...items].filter((x) => new Date(x.when).getTime() >= now).sort((x, y) => new Date(x.when) - new Date(y.when))[0] || null;
}

export default function ApplicantList({ list, onOpen, flash, review, bookmarks, notes, schedules = {}, onToggleBookmark, emptyText }) {
  if (!list.length) return <p className="empty">{emptyText || 'No applicants match this view.'}</p>;
  return (
    <ul className="list">
      {sortDecisions(list).map((d, i) => {
        const a = d.applicant;
        const r = review[d.id];
        const marked = !!bookmarks[d.id];
        return (
          <li key={d.id} id={`app-${d.id}`} className={flash.includes(d.id) ? 'flash' : ''}>
            <button
              className={`star${marked ? ' on' : ''}`}
              aria-pressed={marked}
              aria-label={marked ? `Remove ${d.id} from bookmarks` : `Bookmark ${d.id}`}
              title={marked ? 'Bookmarked' : 'Bookmark'}
              onClick={() => onToggleBookmark(d.id)}
            >
              {marked ? '★' : '☆'}
            </button>
            <button className="row" onClick={() => onOpen(d.id)} aria-label={`${d.id} ${a.name || ''}: ${OUTCOME_LABEL[d.outcome]}, franchisee readiness score ${d.readiness.total}. Open details`}>
              <span className="rank num">{i + 1}</span>
              <span className="who">
                <span className="name">
                  {a.name || 'No name'} <span className="id">{d.id}</span>
                  <span className={`chip o-${d.outcome}`}>{OUTCOME_LABEL[d.outcome]}</span>
                  {d.updatedFields ? <span className="chip upd">Updated, verify</span> : null}
                  {r?.status === 'confirmed' ? <span className="chip o-Recommended">Onboarding: {r.stage >= PIPELINE.length ? 'ready to open' : PIPELINE[r.stage].toLowerCase()}</span> : null}
                  {r?.status === 'declined' ? <span className="chip o-Reject">Declined by you</span> : null}
                  {(() => {
                    const n = nextScheduled(schedules[d.id]);
                    return n ? (
                      <span className="chip upd">
                        {NEXT_STEP_TYPES[n.type].icon} {NEXT_STEP_TYPES[n.type].label} {new Date(n.when).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    ) : null;
                  })()}
                </span>
                <span className="one">{d.reason}</span>
                <span className="meta-line">{a.city || 'No city'}, {a.pin || 'no pin'}{d.territoryId ? ` · ${d.territoryId}` : ' · no territory'}</span>
                {notes[d.id] ? <span className="note-line">📝 {notes[d.id]}</span> : null}
              </span>
              <span className="stat"><b className="num">{d.readiness.total}</b><span>Franchisee readiness score</span></span>
              <Segs r={d.readiness} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

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

// Why a readiness part scored 0, in plain words.
function zeroReason(k, d) {
  const a = d.applicant;
  if (k === 'investment') return a.investment === null ? 'not given' : !d.minInvestment ? 'no tier to compare against' : `below the ₹${d.minInvestment} lakh minimum`;
  if (k === 'experience') return a.experience === null ? 'not given' : 'under 1 year';
  if (k === 'space') return a.space ? 'no shop yet' : 'not given';
  if (k === 'floor') return !d.readiness.parts.space ? 'no shop yet' : a.floor === 'Upper' ? 'upper floor' : 'floor not known';
  return '';
}

function ReadinessBars({ d }) {
  const zeros = Object.entries(d.readiness.parts).filter(([k, v]) => v === 0 && zeroReason(k, d));
  return (
    <div className="bars">
      {Object.entries(d.readiness.parts).map(([k, v]) => (
        <div className="bar" key={k}>
          <span>{PART_LABEL[k]}</span>
          <span className="track"><span className={`fill${v ? '' : ' zero'}`} style={{ width: `${(v / MAX[k]) * 100}%` }} /></span>
          <span className="v num">{v}/{MAX[k]}</span>
        </div>
      ))}
      {zeros.length ? <p className="muted">Scored 0: {zeros.map(([k]) => `${PART_LABEL[k].toLowerCase()} (${zeroReason(k, d)})`).join(', ')}.</p> : null}
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
          className="mini-btn"
          onClick={async () => {
            try { await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
          }}
        >
          {copied ? 'Copied' : 'Copy email'}
        </button>
        <a className="mini-btn" href={mailto}>Open in email app</a>
        <small>The sheet has no contact details, so add the address in your email app.</small>
      </div>
    </div>
  );
}

function Review({ d, review, setReview }) {
  const r = review[d.id];
  if (d.outcome !== 'Recommended' && d.outcome !== 'Conditional') return null;
  if (!r) {
    return (
      <div>
        <h3>Your review</h3>
        <div className="review">
          <button className="btn" onClick={() => setReview({ ...review, [d.id]: { status: 'confirmed', stage: 0 } })}>Confirm and start onboarding</button>
          <button className="btn ghost" onClick={() => setReview({ ...review, [d.id]: { status: 'declined' } })}>Decline</button>
        </div>
      </div>
    );
  }
  if (r.status === 'declined') {
    return (
      <div>
        <h3>Your review</h3>
        <div className="review">
          <span className="declined">You declined this recommendation.</span>
          <button className="mini-btn" onClick={() => { const c = { ...review }; delete c[d.id]; setReview(c); }}>Undo</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h3>Onboarding</h3>
      <div className="pipe" role="list">
        {PIPELINE.map((s, i) => (
          <div role="listitem" key={s} className={`stage${i < r.stage ? ' done' : ''}${i === r.stage ? ' now' : ''}`}>{s}</div>
        ))}
      </div>
      <div className="review" style={{ marginTop: 10 }}>
        {r.stage < PIPELINE.length ? (
          <button className="btn" onClick={() => setReview({ ...review, [d.id]: { ...r, stage: r.stage + 1 } })}>
            Mark “{PIPELINE[r.stage]}” done
          </button>
        ) : <b>Ready to open.</b>}
        {r.stage > 0 ? <button className="mini-btn" onClick={() => setReview({ ...review, [d.id]: { ...r, stage: r.stage - 1 } })}>Step back</button> : null}
      </div>
    </div>
  );
}

// Side by side with whoever won the pin or the last slot: the factors behind the scores, not just "lower score".
function Versus({ d }) {
  const v = d.versus;
  const a = d.applicant;
  const rows = [
    ['Score', d.score, v.score],
    ['Capital', a.investment === null ? '—' : `₹${a.investment}L`, v.investment === null ? '—' : `₹${v.investment}L`],
    ['Experience', a.experience === null ? '—' : `${a.experience} yrs`, v.experience === null ? '—' : `${v.experience} yrs`],
    ['Space', `${show(a.space)}${a.size ? `, ${a.size} sq ft` : ''}`, `${show(v.space)}${v.size ? `, ${v.size} sq ft` : ''}`],
    ['Floor', show(a.floor), show(v.floor)],
    ['Launch', a.launch === null ? '—' : `${a.launch} mo`, v.launch === null ? '—' : `${v.launch} mo`],
  ];
  return (
    <table className="versus">
      <caption>{d.id} vs {v.id}, who {v.why}</caption>
      <thead><tr><th scope="col"></th><th scope="col">{d.id}</th><th scope="col">{v.id}</th></tr></thead>
      <tbody>{rows.map(([k, x, y]) => <tr key={k}><th scope="row">{k}</th><td>{x}</td><td>{y}</td></tr>)}</tbody>
    </table>
  );
}

// The reviewer's own note. Saved as they type; the list and the chat can see it.
function NoteBox({ id, note, onNote }) {
  const [text, setText] = useState(note);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setText(note); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <h3><label htmlFor={`note-${id}`}>Your note</label></h3>
      <textarea
        id={`note-${id}`}
        className="note-box"
        value={text}
        placeholder="What you like about this candidate, what to check, follow-ups…"
        onChange={(e) => { setText(e.target.value); onNote(id, e.target.value); setSaved(true); }}
      />
      <div className="muted">{saved ? 'Saved in this browser.' : 'Only you can see this. It’s saved in this browser.'}</div>
    </div>
  );
}

export function ApplicantDialog({
  d, onClose, review, setReview, bookmarked, onToggleBookmark, note, onNote,
  profile, schedule, onAddSchedule, onRemoveSchedule, agreement, onAgreement,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (d && !el.open) el.showModal();
    if (!d && el.open) el.close();
  }, [d]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="d-title"
    >
      {d ? (
        <div className="dialog-body">
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
          <div className="d-top">
            <span className="rank num" title="Franchisee readiness score">{d.readiness.total}</span>
            <div>
              <h2 id="d-title">{d.applicant.name || 'No name'} <span className="muted">{d.id}</span></h2>
              <div className="d-chips">
                <span className={`chip o-${d.outcome}`}>{OUTCOME_LABEL[d.outcome]}</span>
                <span className="chip">{d.readiness.band}</span>
                <span className="chip">{d.territoryId ? `${d.territoryId} · ${d.applicant.city || ''}` : 'No territory'}</span>
                {d.updatedFields ? <span className="chip upd">Updated in chat, verify</span> : null}
              </div>
            </div>
          </div>

          <div className="review">
            <button className={`btn ${bookmarked ? '' : 'ghost'}`} aria-pressed={bookmarked} onClick={() => onToggleBookmark(d.id)}>
              {bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
            </button>
          </div>

          <div className="d-stats">
            <div><b className="num">{d.readiness.total}/100</b><span>Franchisee readiness · {d.readiness.band}</span></div>
            <div>
              <b className="num">{d.competition ? `#${d.competition.rank} of ${d.competition.of}` : '—'}</b>
              <span>{d.competition ? `in ${d.territoryId}, needs ${d.competition.bar}+` : 'Not in a slot ranking'}</span>
            </div>
            <div>
              <b className="num">{d.applicant.investment === null ? '—' : `₹${d.applicant.investment}L`}</b>
              <span>{d.minInvestment ? `Investment · min ₹${d.minInvestment}L` : 'Investment'}</span>
            </div>
          </div>

          <div className={`box t-${d.outcome}`}>
            <h3>{d.outcome === 'Recommended' ? 'Why recommended' : d.outcome === 'Withdrawn' ? 'Withdrawn' : `Why ${OUTCOME_LABEL[d.outcome].toLowerCase()}: every blocker`}</h3>
            <ul className="issues">
              {['Recommended', 'Conditional', 'Redirect', 'Waitlist', 'Withdrawn'].includes(d.outcome) && <li>{d.reason}</li>}
              {d.outcome !== 'Redirect' && d.rejectReasons.map((r) => <li key={r} className="bad">{r}</li>)}
              {d.issues.map((h) => (
                <li key={h.issue}>{h.issue}<span className="fix">Fix: {h.fix}</span></li>
              ))}
              {(d.conditions || []).map((c) => (
                <li key={c.issue} className="warn">{c.issue}<span className="fix">Condition: {c.fix}</span></li>
              ))}
              {d.warnings.map((w) => <li key={w} className="warn">{w}</li>)}
            </ul>
            {d.versus ? <Versus d={d} /> : null}
            {d.plan.slotStatus && d.outcome !== 'Reject' ? <p className="muted" style={{ marginTop: 8 }}>{d.plan.slotStatus}</p> : null}
            {d.competition?.rivals.length ? (
              <p className="muted" style={{ marginTop: 6 }}>Competing with {d.competition.rivals.map((r) => `${r.id} (${r.score})`).join(', ')}.</p>
            ) : null}
          </div>

          {d.outcome === 'Recommended' || d.outcome === 'Conditional' ? (
            <NextSteps
              d={d}
              profile={profile}
              schedule={schedule}
              onAdd={(item) => onAddSchedule(d.id, item)}
              onRemove={(itemId) => onRemoveSchedule(d.id, itemId)}
              agreement={agreement}
              onAgreement={(v) => onAgreement(d.id, v)}
              emailPane={<Email email={d.plan.email} />}
            />
          ) : null}

          <div className="two">
            <div>
              <h3>Franchisee readiness score</h3>
              <ReadinessBars d={d} />
            </div>
            <div>
              <h3>Application</h3>
              <Facts a={d.applicant} updated={d.updatedFields} />
            </div>
          </div>

          {d.questions?.length && d.outcome !== 'Recommended' && d.outcome !== 'Withdrawn' ? (
            <div>
              <h3>Questions to ask the applicant</h3>
              <ol className="steps">{d.questions.map((q) => <li key={q}>{q}</li>)}</ol>
            </div>
          ) : null}

          <NoteBox id={d.id} note={note} onNote={onNote} />

          <div className="two">
            <div>
              <h3>{d.outcome === 'Recommended' || d.outcome === 'Withdrawn' ? 'Next steps' : 'What they can do to get recommended'}</h3>
              <ol className="steps">{d.plan.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
            {d.plan.training ? (
              <div>
                <h3>How they’ll be prepared</h3>
                <div className="box dashed training">
                  <b>{d.plan.training.track}</b>, {d.plan.training.weeks} week{d.plan.training.weeks === 1 ? '' : 's'}, in {d.plan.training.language}
                  <div className="muted">{d.plan.training.why}</div>
                  <ul>{d.plan.training.modules.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              </div>
            ) : null}
          </div>

          <Review d={d} review={review} setReview={setReview} />

          {d.outcome !== 'Recommended' && d.outcome !== 'Conditional' ? (
            <div>
              <h3>Email draft</h3>
              <Email email={d.plan.email} />
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
