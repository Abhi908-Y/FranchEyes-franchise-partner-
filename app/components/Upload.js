'use client';

import { useRef, useState } from 'react';
import { CATEGORIES } from '../../lib/constants';

export function categoryLabel(profile) {
  const c = CATEGORIES.find((x) => x.id === profile.category);
  return profile.categoryName || (c ? c.label : 'Other');
}

function Rules({ profile, setProfile }) {
  const setMin = (tier, v) => setProfile({ ...profile, minInvestment: { ...profile.minInvestment, [tier]: Number(v) || 0 } });
  const setBar = (p, v) => setProfile({ ...profile, minScore: { ...profile.minScore, [p]: Number(v) || 0 } });
  const num = (k) => (e) => setProfile({ ...profile, [k]: Number(e.target.value) || 0 });
  return (
    <div className="rules-body">
      <p className="rules-note">
        Category: <b>{categoryLabel(profile)}</b>.{' '}
        {profile.upperFloorOk
          ? 'Any floor qualifies here (ground, upper or mall), because customers come on purpose rather than walking in off the street.'
          : 'This is walk-in retail: customers walk in, so the shop needs street-level or mall footfall. Upper floors go on hold.'}
        {' '}Change any number and every decision updates.
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

// New project: brand name and category first, then the sheet. Each upload becomes its own saved project.
export default function Upload({ onCreate, error, firstTime }) {
  const input = useRef(null);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [otherName, setOtherName] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = brand.trim() && category && (category !== 'other' || otherName.trim());
  const meta = () => ({ brand: brand.trim(), category, categoryName: category === 'other' ? otherName.trim() : '' });

  async function handle(file) {
    if (!file || !ready) return;
    setBusy(true);
    await onCreate(file, meta());
    setBusy(false);
  }

  async function sample() {
    if (!ready) return;
    setBusy(true);
    const r = await fetch('/sample-applications.xlsx');
    const blob = await r.blob();
    await onCreate(new File([blob], 'sample-applications.xlsx'), meta());
    setBusy(false);
  }

  return (
    <section className="hero">
      <h2>Start a <mark>new review.</mark></h2>
      <p className="lede">
        Tell us whose franchise requests these are, then upload the sheet. Each upload is saved as its own project in the sidebar, so earlier reviews are never lost.
      </p>

      <div className="sk new-form">
        <label className="field">1. Brand name (the franchisor)
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Lenskart" autoFocus={!firstTime} />
        </label>
        <label className="field">2. Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}{c.example ? ` (e.g. ${c.example})` : ''}</option>
            ))}
          </select>
        </label>
        {category === 'other' ? (
          <label className="field">Your category
            <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. Pet care" />
          </label>
        ) : null}
        {category ? (
          <p className="rules-note">
            {CATEGORIES.find((c) => c.id === category).upperFloorOk
              ? `Any floor qualifies for this category. Minimum space ${CATEGORIES.find((c) => c.id === category).minSize.toLocaleString('en-IN')} sq ft.`
              : `Ground-floor or mall spaces only, since customers walk in. Minimum space ${CATEGORIES.find((c) => c.id === category).minSize.toLocaleString('en-IN')} sq ft.`}
            {' '}You can change these under Brand rules later.
          </p>
        ) : null}
      </div>

      <div
        className={`drop sk${over ? ' over' : ''}${ready ? '' : ' locked'}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files?.[0]); }}
      >
        <strong>3. Upload the applicant sheet</strong>
        <div className="row-btns">
          <button className="btn" onClick={() => input.current?.click()} disabled={busy || !ready}>{busy ? 'Reading…' : 'Choose file'}</button>
          <button className="btn ghost" onClick={sample} disabled={busy || !ready}>Use the sample file</button>
          <a className="btn quiet" href="/sample-applications.xlsx" download>Download the template</a>
        </div>
        <p className="hint">
          {ready ? 'Drag the .xlsx here or choose it. It needs the Applications and Territories sheets, like the template. The file is read in your browser.' : 'Fill in the brand name and category first.'}
        </p>
        <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
    </section>
  );
}

Upload.Rules = Rules;
