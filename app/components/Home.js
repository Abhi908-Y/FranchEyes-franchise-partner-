'use client';

import { categoryLabel } from './Upload';

const STEPS = [
  ['🏷️', 'Name the brand', 'Tell FranchEyes who the franchisor is and pick its category. A gym and an eyewear store need different spaces, so the rules change with the category.'],
  ['⬆️', 'Upload the applicants', 'Drop in the sheet of franchise requests. Nothing to clean up first: incomplete and contradictory rows are handled.'],
  ['🎯', 'Get a decision for everyone', 'Every candidate gets an outcome, the reason, and a franchisee readiness score out of 100. Never two stores in one pin code.'],
  ['🧭', 'Show them the way in', 'For each candidate, FranchEyes says what more they can do to get recommended: the space, funds or details they still need.'],
  ['💬', 'Ask and update in chat', '“Why is APP-007 on hold?” or “APP-012 found a ground-floor space”. Decisions re-run instantly.'],
  ['⭐', 'Shortlist your favourites', 'Bookmark the candidates you like and add personal notes. Every project is saved in your browser.'],
];

export default function Home({ projects, onNew, onOpen }) {
  return (
    <section className="home">
      <div className="home-hero">
        <span className="chip">FranchEyes · end-to-end franchise partner selection</span>
        <h1>The vision for <mark>better franchisee.</mark></h1>
        <p className="lede">
          FranchEyes helps brands find better franchise partners. Upload the franchise requests you’ve received and it reviews every
          candidate: who to recommend, who to wait on, what’s missing, and what each candidate can do to get recommended.
        </p>
        <div className="row-btns">
          <button className="btn big" onClick={onNew}>⬆ Upload a sheet</button>
          {projects.length ? <span className="muted">or open one of your {projects.length} saved project{projects.length === 1 ? '' : 's'} below</span> : null}
        </div>
      </div>

      <div className="steps-grid">
        {STEPS.map(([icon, title, body], i) => (
          <div className="sk step" key={title}>
            <span className="rank num" aria-hidden="true">{i + 1}</span>
            <b><span aria-hidden="true">{icon}</span> {title}</b>
            <p>{body}</p>
          </div>
        ))}
      </div>

      {projects.length ? (
        <div>
          <h3 className="list-title">Your projects</h3>
          <div className="proj-grid">
            {projects.map((p) => (
              <button className="sk proj-card" key={p.id} onClick={() => onOpen(p.id)}>
                <b>{p.profile.brandName}</b>
                <span className="muted">{categoryLabel(p.profile)}</span>
                <span className="muted">{p.base.applications.length} applicants · {p.fileName}</span>
                <span className="muted">{new Date(p.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
