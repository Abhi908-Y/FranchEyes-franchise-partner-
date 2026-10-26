'use client';

// Welcome page of the internal tool. The brand isn't named, so the copy stays generic.

const STEPS = [
  ['⬆️', 'Upload the applications', 'Drop in this round’s Applications and Territories sheets. Messy, incomplete and contradictory rows are handled, not rejected.'],
  ['🎯', 'Get a decision for every applicant', 'Recommended, Waitlist, On hold or Rejected, with the exact reason. Slots go to the strongest applicant in each territory.'],
  ['📊', 'See their franchisee readiness score', 'Every applicant is scored out of 100 on funds, experience, space, floor and launch timing, with a breakdown.'],
  ['🧭', 'Show them the way in', 'Anyone not recommended gets the specific things they can do to get there: the space, funds or details still missing.'],
  ['💬', 'Ask and update in chat', '“Why is APP-007 on hold?” or “APP-012 has found a ground-floor space”. The whole batch re-runs instantly.'],
  ['⭐', 'Shortlist and take notes', 'Bookmark the partners you like and keep your own notes on each one.'],
];

const NEXT = [
  ['📍', 'Schedule a site visit'],
  ['📞', 'Schedule a call'],
  ['✍️', 'Schedule the agreement signing'],
  ['✉️', 'Send the next-step email'],
  ['📄', 'Draft the franchise agreement'],
];

export default function Home({ reviews, onUpload, onOpen }) {
  return (
    <section className="home">
      <div className="home-hero">
        <span className="chip">FranchEyes · internal tool for the expansion team</span>
        <h1>Welcome. The vision for <mark>better franchisees.</mark></h1>
        <p className="lede">
          Getting from a partner’s first application to an open, trained store is slow and leaky. FranchEyes takes that journey off the
          expansion team’s plate: upload the applications and it reviews every partner, explains each decision, and walks the
          recommended ones through to signing.
        </p>
        <div className="row-btns">
          <button className="btn big" onClick={onUpload}>⬆ Upload a sheet</button>
          {reviews.length ? <span className="muted">or open one of your {reviews.length} saved review{reviews.length === 1 ? '' : 's'} below</span> : null}
        </div>
      </div>

      {reviews.length ? (
        <div>
          <h3 className="list-title">Your saved reviews</h3>
          <div className="proj-grid">
            {reviews.map((p) => (
              <button className="sk proj-card" key={p.id} onClick={() => onOpen(p.id)}>
                <b>{p.fileName}</b>
                <span className="muted">{p.base.applications.length} applicants</span>
                <span className="muted">Uploaded {new Date(p.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="list-title">How FranchEyes works</h3>
        <div className="steps-grid">
          {STEPS.map(([icon, title, body], i) => (
            <div className="sk step" key={title}>
              <span className="rank num" aria-hidden="true">{i + 1}</span>
              <b><span aria-hidden="true">{icon}</span> {title}</b>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="two home-two">
        <div className="sk step">
          <b>🚀 When a partner is recommended</b>
          <p>Open them and use <b>Take next step</b>:</p>
          <ul className="next-list">
            {NEXT.map(([icon, label]) => <li key={label}><span aria-hidden="true">{icon}</span> {label}</li>)}
          </ul>
          <p>Meetings come with a calendar invite. The agreement is prefilled from the application, and the blanks that still need the brand’s terms (fee, royalty, PAN) are highlighted. Download it for Word or save it as a PDF.</p>
        </div>
        <div className="sk step agreement-peek" aria-hidden="true">
          <b className="peek-title">Franchise Agreement</b>
          <p><b>1. Parties.</b> This Franchise Agreement is made on <b>[today’s date]</b> between <span className="blank">__________</span> (the “Franchisor”) and <b>Ananya Rao</b> (the “Franchisee”)…</p>
          <p><b>2. Grant of franchise.</b> …The Franchisor will not open or license another store in pin code <b>570002</b> during the Term.</p>
          <p><b>5. Fees.</b> …a royalty of <span className="blank">____</span>% of the store’s net sales…</p>
        </div>
      </div>

    </section>
  );
}
