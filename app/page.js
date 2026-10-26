'use client';

import { useMemo, useRef, useState } from 'react';
import { parseWorkbook } from '../lib/parse';
import { runEngine, diffResults } from '../lib/engine';
import { DEFAULT_PROFILE, OUTCOMES } from '../lib/constants';
import Upload from './components/Upload';
import TerritoryBoard from './components/TerritoryBoard';
import ApplicantList from './components/ApplicantList';
import Chat from './components/Chat';

function applyOverrides(base, overrides) {
  if (!base) return null;
  return {
    ...base,
    applications: base.applications.map((a) => (overrides[a.id] ? { ...a, ...overrides[a.id] } : a)),
  };
}

function toCsv(result) {
  const head = ['Application ID', 'Name', 'City', 'Pin code', 'Territory', 'Outcome', 'Score', 'Reason', 'Next steps'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = Object.values(result.decisions).map((d) => [
    d.id, d.applicant.name, d.applicant.city, d.applicant.pin, d.territoryId, d.outcome, d.score, d.reason, d.plan.nextSteps.join(' | '),
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export default function Page() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [base, setBase] = useState(null);
  const [fileName, setFileName] = useState('');
  const [overrides, setOverrides] = useState({});
  const [review, setReview] = useState({});
  const [filter, setFilter] = useState('All');
  const [openId, setOpenId] = useState(null);
  const [flash, setFlash] = useState([]);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);

  const data = useMemo(() => applyOverrides(base, overrides), [base, overrides]);
  const result = useMemo(() => (data ? runEngine(data, profile, { updated: overrides }) : null), [data, profile, overrides]);

  async function loadFile(file) {
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      if (!parsed.applications.length) throw new Error('The Applications sheet has no rows below the header. Add applicants from row 4 and upload again.');
      setBase(parsed);
      setFileName(file.name);
      setOverrides({});
      setReview({});
      setMessages([]);
      setFilter('All');
      setOpenId(null);
    } catch (e) {
      setError(e.message || 'Couldn’t read that file. Upload the .xlsx in the case template format.');
    }
  }

  async function loadSample() {
    const r = await fetch('/sample-applications.xlsx');
    const blob = await r.blob();
    await loadFile(new File([blob], 'sample-applications.xlsx'));
  }

  function focusApplicant(id) {
    setFilter('All');
    setOpenId(id);
    setTimeout(() => document.getElementById(`app-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // Called by the chat with validated updates. Returns the changes for the reply.
  function applyUpdates(updates) {
    const next = { ...overrides };
    for (const u of updates) next[u.id] = { ...(next[u.id] || {}), [u.field]: u.value };
    const newResult = runEngine(applyOverrides(base, next), profile, { updated: next });
    const changes = diffResults(result, newResult);
    setOverrides(next);
    const changedIds = [...new Set([...updates.map((u) => u.id), ...changes.map((c) => c.id)])];
    setReview((r) => {
      const copy = { ...r };
      for (const c of changes) if (c.from === 'Recommended' && c.to !== 'Recommended') delete copy[c.id];
      return copy;
    });
    setFlash(changedIds);
    setTimeout(() => setFlash([]), 1800);
    return { changes, newResult };
  }

  function exportCsv() {
    const blob = new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'franchise-decisions.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const updatedCount = Object.keys(overrides).length;

  return (
    <>
      <header className="top">
        <div>
          <h1>Franchise partner desk</h1>
          {fileName ? <div className="file">{fileName}</div> : null}
        </div>
        {result ? (
          <div className="top-actions">
            {updatedCount ? (
              <button className="btn quiet" onClick={() => setOverrides({})}>Undo chat updates ({updatedCount})</button>
            ) : null}
            <button className="btn" onClick={exportCsv}>Download decisions</button>
            <button className="btn" onClick={() => { setBase(null); setFileName(''); }}>Upload another file</button>
          </div>
        ) : null}
      </header>

      <div className="shell">
        <main className="main">
          {!result ? (
            <Upload onFile={loadFile} onSample={loadSample} error={error} profile={profile} setProfile={setProfile} />
          ) : (
            <>
              {result.notes.length || base.notes.length ? (
                <ul className="notes">
                  {[...base.notes, ...result.notes].map((n) => <li key={n}>{n}</li>)}
                </ul>
              ) : null}

              <div className="tally" role="group" aria-label="Filter applicants by outcome">
                {['All', ...OUTCOMES].map((o) => {
                  const n = o === 'All' ? Object.keys(result.decisions).length : result.counts[o];
                  const label = o === 'All' ? 'All applicants' : o === 'Hold' ? 'On hold' : o === 'Reject' ? 'Rejected' : o;
                  return (
                    <button key={o} aria-pressed={filter === o} onClick={() => setFilter(o)} className={o === 'All' ? '' : `t-${o}`}>
                      <span className="n num">{n}</span>
                      <span className="l">{label}</span>
                    </button>
                  );
                })}
              </div>

              <TerritoryBoard territories={result.territories} onApplicant={focusApplicant} />

              <div ref={listRef}>
                <h3 className="section-title">Applicants</h3>
                <p className="section-sub">Every outcome is a recommendation. Open an applicant to review it, see next steps and draft the email.</p>
                <ApplicantList
                  result={result}
                  filter={filter}
                  openId={openId}
                  setOpenId={setOpenId}
                  flash={flash}
                  review={review}
                  setReview={setReview}
                  overrides={overrides}
                />
              </div>

              <details className="rules" style={{ marginTop: 28 }}>
                <summary>Brand rules used for these decisions <span>Change a number and every decision updates</span></summary>
                <Upload.Rules profile={profile} setProfile={setProfile} />
              </details>
            </>
          )}
        </main>

        <aside className="side" aria-label="Ask about decisions">
          <Chat
            result={result}
            profile={profile}
            messages={messages}
            setMessages={setMessages}
            applyUpdates={applyUpdates}
            onApplicant={focusApplicant}
          />
        </aside>
      </div>
    </>
  );
}
