'use client';

import { useRef, useState } from 'react';

function Rules({ profile, setProfile }) {
  const setMin = (tier, v) => setProfile({ ...profile, minInvestment: { ...profile.minInvestment, [tier]: Number(v) || 0 } });
  const setBar = (p, v) => setProfile({ ...profile, minScore: { ...profile.minScore, [p]: Number(v) || 0 } });
  return (
    <div className="rules-body">
      <p className="rules-note">
        We assume a walk-in, small-format retail store: customers walk in, so it needs street-level or mall footfall and enough space to display stock.
        Every threshold below comes from that assumption.
      </p>
      <div className="rules-grid">
        <label className="field">Brand name
          <input value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} />
        </label>
        {['Tier 1', 'Tier 2', 'Tier 3'].map((t) => (
          <label className="field" key={t}>{t} minimum (₹ lakh)
            <input type="number" min="0" value={profile.minInvestment[t]} onChange={(e) => setMin(t, e.target.value)} />
          </label>
        ))}
        <label className="field">Reject if short by more than (%)
          <input type="number" min="0" max="100" value={profile.rejectShortfall} onChange={(e) => setProfile({ ...profile, rejectShortfall: Number(e.target.value) || 0 })} />
        </label>
        <label className="field">Minimum space (sq ft)
          <input type="number" min="0" value={profile.minSize} onChange={(e) => setProfile({ ...profile, minSize: Number(e.target.value) || 0 })} />
        </label>
        {['High', 'Medium', 'Low'].map((p) => (
          <label className="field" key={p}>Score needed, {p.toLowerCase()} priority
            <input type="number" min="0" max="100" value={profile.minScore[p]} onChange={(e) => setBar(p, e.target.value)} />
          </label>
        ))}
      </div>
      <p className="rules-note">
        Never two stores in one pin code. Pin codes outside every territory, or with an existing store, are rejected.
        Ground floor and mall units qualify; upper floors go on hold. Score out of 100: investment headroom 30, experience 20, space 25, floor 15, launch timing 10.
      </p>
    </div>
  );
}

export default function Upload({ onFile, onSample, error, profile, setProfile }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    await onFile(file);
    setBusy(false);
  }

  return (
    <section className="hero">
      <h2>Drop in the applications. Get a decision for every partner.</h2>
      <p className="lede">
        Upload the Applications and Territories sheets. Every applicant gets a recommendation, the reason behind it, and their next steps,
        with no two stores ever in the same pin code.
      </p>

      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files?.[0]); }}
      >
        <strong>Drag the Excel file here</strong>
        <div className="row">
          <button className="btn primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Reading…' : 'Choose file'}</button>
          <button className="btn" onClick={async () => { setBusy(true); await onSample(); setBusy(false); }} disabled={busy}>Try the sample file</button>
          <a className="btn quiet" href="/sample-applications.xlsx" download>Download the sample</a>
        </div>
        <span className="hint">.xlsx in the case template format. The file is read in your browser.</span>
        <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}

      <details className="rules">
        <summary>Brand rules <span>Pre-filled. Change them if you like, or just upload.</span></summary>
        <Rules profile={profile} setProfile={setProfile} />
      </details>
    </section>
  );
}

Upload.Rules = Rules;
