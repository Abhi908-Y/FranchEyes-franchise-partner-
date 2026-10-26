'use client';

import { useRef, useState } from 'react';
function Rules({ profile, setProfile }) {
  const setMin = (tier, v) => setProfile({ ...profile, minInvestment: { ...profile.minInvestment, [tier]: Number(v) || 0 } });
  const setBar = (p, v) => setProfile({ ...profile, minScore: { ...profile.minScore, [p]: Number(v) || 0 } });
  const num = (k) => (e) => setProfile({ ...profile, [k]: Number(e.target.value) || 0 });
  return (
    <div className="rules-body">
      <p className="rules-note">
        {profile.upperFloorOk
          ? 'Upper floors are allowed, so any floor qualifies (ground, upper or mall).'
          : 'This is walk-in retail: customers walk in, so the shop needs street-level or mall footfall. Upper floors go on hold.'}
        {' '}Change any number and every decision updates.
      </p>
      <div className="rules-grid">
        <label className="field">Brand name (used in emails and agreements)
          <input value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} />
        </label>
        {['Tier 1', 'Tier 2', 'Tier 3'].map((t) => (
          <label className="field" key={t}>{t} minimum (₹ lakh)
            <input type="number" min="0" value={profile.minInvestment[t]} onChange={(e) => setMin(t, e.target.value)} />
          </label>
        ))}
        <label className="field">Reject if short by more than (%)
          <input type="number" min="0" max="100" value={profile.rejectShortfall} onChange={num('rejectShortfall')} />
        </label>
        <label className="field">Minimum space (sq ft)
          <input type="number" min="0" value={profile.minSize} onChange={num('minSize')} />
        </label>
        <label className="field">Flag spaces larger than (sq ft)
          <input type="number" min="0" value={profile.maxSize ?? 3000} onChange={num('maxSize')} />
        </label>
        <label className="field check">
          <input type="checkbox" checked={!!profile.upperFloorOk} onChange={(e) => setProfile({ ...profile, upperFloorOk: e.target.checked })} />
          Upper floors qualify
        </label>
        {['High', 'Medium', 'Low'].map((p) => (
          <label className="field" key={p}>Score needed, {p.toLowerCase()} priority
            <input type="number" min="0" max="100" value={profile.minScore[p]} onChange={(e) => setBar(p, e.target.value)} />
          </label>
        ))}
      </div>
      <p className="rules-note">
        Never two stores in one pin code. Pin codes outside every territory, or with an existing store, are rejected.
        Score out of 100: investment headroom 30, experience 20, space 25, floor 15, launch timing 10.
      </p>
    </div>
  );
}

// Upload screen. Each upload is saved as its own review in the sidebar, so earlier ones are never lost.
export default function Upload({ onCreate, error }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    await onCreate(file);
    setBusy(false);
  }

  async function sample() {
    setBusy(true);
    const r = await fetch('/sample-applications.xlsx');
    const blob = await r.blob();
    await onCreate(new File([blob], 'sample-applications.xlsx'));
    setBusy(false);
  }

  return (
    <section className="hero">
      <h2>Upload the <mark>application sheet.</mark></h2>
      <p className="lede">
        Drop in this round’s franchise applications. Every applicant gets an outcome, the reason, a franchisee readiness score and next steps,
        with never two stores in one pin code. Each upload is saved as its own review, so earlier ones stay in the sidebar.
      </p>

      <div
        className={`drop sk${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files?.[0]); }}
      >
        <strong>Drag the Excel file here</strong>
        <div className="row-btns">
          <button className="btn" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Reading…' : 'Choose file'}</button>
          <button className="btn ghost" onClick={sample} disabled={busy}>Try the sample file</button>
          <a className="btn quiet" href="/sample-applications.xlsx" download>Download the template</a>
        </div>
        <p className="hint">.xlsx in the template format: Applications and Territories sheets (Existing stores is already filled in). The file is read in your browser.</p>
        <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
    </section>
  );
}

Upload.Rules = Rules;
