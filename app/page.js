'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseWorkbook } from '../lib/parse';
import { runEngine, diffResults } from '../lib/engine';
import { OUTCOMES, profileFor } from '../lib/constants';
import Home from './components/Home';
import Upload, { categoryLabel } from './components/Upload';
import TerritoryBoard from './components/TerritoryBoard';
import ApplicantList, { ApplicantDialog, sortDecisions } from './components/ApplicantList';
import Rubric from './components/Rubric';
import Chat from './components/Chat';

const OUTCOME_NAV = { All: 'All applicants', Recommended: 'Recommended', Waitlist: 'Waitlist', Hold: 'On hold', Reject: 'Rejected' };
const OUTCOME_ICON = { All: '📋', Recommended: '✅', Waitlist: '⏳', Hold: '✋', Reject: '⛔' };
// Projects live in this browser only (no database). Bump the version if the saved shape changes.
const STORE_KEY = 'franchEyes.projects.v1';

function applyOverrides(base, overrides) {
  if (!base) return null;
  return {
    ...base,
    applications: base.applications.map((a) => (overrides[a.id] ? { ...a, ...overrides[a.id] } : a)),
  };
}

function toCsv(result, p) {
  const head = ['Application ID', 'Name', 'City', 'Pin code', 'Territory', 'Outcome', 'Franchisee readiness score', 'Readiness label', 'Allocation score', 'Reason', 'Next steps', 'Bookmarked', 'Your note'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = sortDecisions(Object.values(result.decisions)).map((d) => [
    d.id, d.applicant.name, d.applicant.city, d.applicant.pin, d.territoryId, d.outcome,
    d.readiness.total, d.readiness.band, d.score, d.reason, d.plan.nextSteps.join(' | '),
    p.bookmarks[d.id] ? 'Yes' : '', p.notes[d.id] || '',
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export default function Page() {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [screen, setScreen] = useState('home'); // home | new | project
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('list'); // list | bookmarks | notes | territories | rules
  const [filter, setFilter] = useState('All');
  const [terr, setTerr] = useState('All');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [flash, setFlash] = useState([]);
  const [error, setError] = useState('');

  // Load saved projects once, after the first render (localStorage isn't available on the server).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved?.projects?.length) {
        setProjects(saved.projects);
        if (saved.activeId && saved.projects.some((p) => p.id === saved.activeId)) {
          setActiveId(saved.activeId);
          setScreen('project');
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ projects, activeId: screen === 'project' ? activeId : null })); } catch {}
  }, [projects, activeId, screen, loaded]);

  const p = projects.find((x) => x.id === activeId) || null;
  const data = useMemo(() => (p ? applyOverrides(p.base, p.overrides) : null), [p?.base, p?.overrides]);
  const result = useMemo(() => (data ? runEngine(data, p.profile, { updated: p.overrides }) : null), [data, p?.profile, p?.overrides]);

  // Update one field of the active project; accepts a value or an updater function, like setState.
  const setField = (key) => (v) =>
    setProjects((ps) => ps.map((x) => (x.id === activeId ? { ...x, [key]: typeof v === 'function' ? v(x[key]) : v } : x)));
  const setProfile = setField('profile');
  const setOverrides = setField('overrides');
  const setReview = setField('review');
  const setMessages = setField('messages');
  const setNotes = setField('notes');
  const setBookmarks = setField('bookmarks');

  function resetView() {
    setView('list');
    setFilter('All');
    setTerr('All');
    setQuery('');
    setOpenId(null);
  }

  function openProject(id) {
    setActiveId(id);
    setScreen('project');
    resetView();
  }

  async function createProject(file, meta) {
    setError('');
    try {
      const parsed = parseWorkbook(await file.arrayBuffer());
      if (!parsed.applications.length) throw new Error('The Applications sheet has no rows below the header. Add applicants from row 4 and upload again.');
      const profile = { ...profileFor(meta.category, meta.brand), categoryName: meta.categoryName || '' };
      const proj = {
        id: `p${Date.now().toString(36)}`,
        createdAt: Date.now(),
        fileName: file.name,
        base: parsed,
        profile,
        overrides: {},
        review: {},
        notes: {},
        bookmarks: {},
        messages: [],
      };
      setProjects((ps) => [...ps, proj]);
      openProject(proj.id);
    } catch (e) {
      setError(e.message || 'Couldn’t read that file. Upload the .xlsx in the case template format.');
    }
  }

  function deleteProject() {
    if (!p || !window.confirm(`Delete the ${p.profile.brandName} project and its bookmarks, notes and chat? This can’t be undone.`)) return;
    setProjects((ps) => ps.filter((x) => x.id !== p.id));
    setActiveId(null);
    setScreen('home');
  }

  function showView(v, o = 'All') {
    setView(v);
    setFilter(o);
    setTerr('All');
  }

  // Chat links and territory pins open the applicant's detail pop-up.
  function focusApplicant(id) {
    if (result?.decisions[id]) setOpenId(id);
  }

  // Called by the chat with validated updates. Returns the changes for the reply.
  function applyUpdates(updates) {
    const next = { ...p.overrides };
    for (const u of updates) next[u.id] = { ...(next[u.id] || {}), [u.field]: u.value };
    const newResult = runEngine(applyOverrides(p.base, next), p.profile, { updated: next });
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

  function toggleBookmark(id) {
    setBookmarks((b) => {
      const c = { ...b };
      if (c[id]) delete c[id];
      else c[id] = Date.now();
      return c;
    });
  }

  function saveNote(id, text) {
    setNotes((n) => {
      const c = { ...n };
      if (text.trim()) c[id] = text;
      else delete c[id];
      return c;
    });
  }

  function exportCsv() {
    const blob = new Blob([toCsv(result, p)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.profile.brandName.replace(/[^\w-]+/g, '-').toLowerCase() || 'franchise'}-decisions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inProject = screen === 'project' && p && result;
  const all = inProject ? Object.values(result.decisions) : [];
  const bookmarkCount = inProject ? all.filter((d) => p.bookmarks[d.id]).length : 0;
  const noteCount = inProject ? all.filter((d) => p.notes[d.id]).length : 0;
  const q = query.trim().toLowerCase();
  const inView = (d) =>
    view === 'bookmarks' ? !!p.bookmarks[d.id]
    : view === 'notes' ? !!p.notes[d.id]
    : filter === 'All' || d.outcome === filter;
  const shown = all
    .filter(inView)
    .filter((d) => terr === 'All' || (terr === 'none' ? !d.territoryId : d.territoryId === terr))
    .filter((d) => !q || [d.id, d.applicant.name, d.applicant.city, d.applicant.pin, d.territoryId, p.notes[d.id]].some((v) => String(v ?? '').toLowerCase().includes(q)));
  const listView = view === 'list' || view === 'bookmarks' || view === 'notes';
  const noTerritory = all.filter((d) => !d.territoryId).length;

  const brand = p?.profile.brandName || '';
  const title = view === 'territories' ? <>{brand} <mark>territories</mark></>
    : view === 'rules' ? <>{brand} <mark>brand rules</mark></>
    : view === 'bookmarks' ? <>Your <mark>bookmarks</mark></>
    : view === 'notes' ? <>Your <mark>notes</mark></>
    : filter === 'All' ? <>{brand} <mark>partner review</mark></>
    : <>{OUTCOME_NAV[filter]} <mark>partners</mark></>;

  const emptyText = view === 'bookmarks'
    ? 'No bookmarks yet. Open a candidate and click ☆ Bookmark, or use the star on any row.'
    : view === 'notes'
      ? 'No notes yet. Open a candidate and write a note in “Your note”.'
      : 'No applicants match this view.';

  return (
    <div className="app">
      <aside className="side">
        <button className="brand" onClick={() => { setScreen('home'); setOpenId(null); }} aria-label="FranchEyes home">
          <span className="brand-mark sk" aria-hidden="true">👁</span>
          <b>FranchEyes</b>
        </button>

        <div className="nav-label">Projects</div>
        <nav className="nav" aria-label="Projects">
          {projects.map((x) => (
            <button
              key={x.id}
              className="nav-item proj"
              aria-pressed={screen === 'project' && x.id === activeId}
              aria-label={`${x.profile.brandName} project, ${categoryLabel(x.profile)}`}
              onClick={() => openProject(x.id)}
            >
              <span aria-hidden="true">🏷️</span>
              <span className="proj-name"><b>{x.profile.brandName}</b><small>{categoryLabel(x.profile)}</small></span>
            </button>
          ))}
          <button className="nav-item new" aria-pressed={screen === 'new'} onClick={() => { setScreen('new'); setError(''); setOpenId(null); }}>
            <span aria-hidden="true">＋</span>Upload a new sheet
          </button>
        </nav>

        {inProject ? (
          <>
            <div className="nav-label">{brand}</div>
            <nav className="nav" aria-label="Applicants by outcome">
              {['All', ...OUTCOMES].map((o) => (
                <button key={o} className="nav-item" aria-pressed={view === 'list' && filter === o} onClick={() => showView('list', o)}>
                  <span aria-hidden="true">{OUTCOME_ICON[o]}</span>{OUTCOME_NAV[o]}
                  <span className="n num">{o === 'All' ? all.length : result.counts[o]}</span>
                </button>
              ))}
            </nav>
            <div className="nav-label">Your picks</div>
            <nav className="nav" aria-label="Your picks">
              <button className="nav-item" aria-pressed={view === 'bookmarks'} onClick={() => showView('bookmarks')}>
                <span aria-hidden="true">⭐</span>Bookmarks<span className="n num">{bookmarkCount}</span>
              </button>
              <button className="nav-item" aria-pressed={view === 'notes'} onClick={() => showView('notes')}>
                <span aria-hidden="true">📝</span>Notes<span className="n num">{noteCount}</span>
              </button>
            </nav>
            <div className="nav-label">Batch</div>
            <nav className="nav" aria-label="Batch">
              <button className="nav-item" aria-pressed={view === 'territories'} onClick={() => showView('territories')}>
                <span aria-hidden="true">🗺️</span>Territories<span className="n num">{result.territories.length}</span>
              </button>
              <button className="nav-item" aria-pressed={view === 'rules'} onClick={() => showView('rules')}>
                <span aria-hidden="true">⚙️</span>Brand rules
              </button>
            </nav>
            <div className="side-foot">
              <span className="file">{p.fileName}</span>
              {Object.keys(p.overrides).length ? (
                <button className="mini-btn" onClick={() => setOverrides({})}>Undo chat updates ({Object.keys(p.overrides).length})</button>
              ) : null}
              <button className="mini-btn danger" onClick={deleteProject}>Delete project</button>
            </div>
          </>
        ) : null}
      </aside>

      <main className="main">
        {!loaded ? null : screen === 'home' ? (
          <Home projects={projects} onNew={() => { setScreen('new'); setError(''); }} onOpen={openProject} />
        ) : screen === 'new' || !inProject ? (
          <Upload onCreate={createProject} error={error} firstTime={!projects.length} />
        ) : (
          <>
            <div className="head">
              <div>
                <h1>{title}</h1>
                <p>
                  {categoryLabel(p.profile)} · {all.length} applications · {result.territories.length} territories · {result.counts.Recommended} recommended
                </p>
              </div>
              <div className="actions">
                {listView ? (
                  <label className="search">
                    <span aria-hidden="true">⌕</span>
                    <span className="sr">Search applicants</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, pin" />
                  </label>
                ) : null}
                <button className="btn ghost" onClick={() => setRubricOpen(true)}>⚖ Scoring rubric</button>
                <button className="btn" onClick={exportCsv}>⬇ Download decisions</button>
              </div>
            </div>

            {p.base.notes.length || result.notes.length ? (
              <ul className="message">{[...p.base.notes, ...result.notes].map((n) => <li key={n}>{n}</li>)}</ul>
            ) : null}

            {listView ? (
              <>
                <div className="tabs" role="tablist" aria-label="Filter by territory">
                  <button role="tab" className="tab" aria-selected={terr === 'All'} onClick={() => setTerr('All')}>
                    All <span className="n num">{all.filter(inView).length}</span>
                  </button>
                  {result.territories.map((t) => (
                    <button key={t.id} role="tab" className="tab" aria-selected={terr === t.id} onClick={() => setTerr(t.id)}>
                      {t.city} <span className="n num">{all.filter((d) => d.territoryId === t.id && inView(d)).length}</span>
                    </button>
                  ))}
                  {noTerritory ? (
                    <button role="tab" className="tab" aria-selected={terr === 'none'} onClick={() => setTerr('none')}>
                      No territory <span className="n num">{all.filter((d) => !d.territoryId && inView(d)).length}</span>
                    </button>
                  ) : null}
                  <span className="hint">{view === 'list' && filter === 'All' ? 'sorted by outcome, then readiness' : 'sorted by readiness'}</span>
                </div>
                <section className="sk">
                  <ApplicantList
                    list={shown}
                    onOpen={setOpenId}
                    flash={flash}
                    review={p.review}
                    bookmarks={p.bookmarks}
                    notes={p.notes}
                    onToggleBookmark={toggleBookmark}
                    emptyText={emptyText}
                  />
                </section>
              </>
            ) : null}

            {view === 'territories' ? <TerritoryBoard territories={result.territories} onApplicant={focusApplicant} /> : null}

            {view === 'rules' ? (
              <section className="sk rules-card">
                <Upload.Rules profile={p.profile} setProfile={setProfile} />
              </section>
            ) : null}
          </>
        )}
      </main>

      {inProject ? (
        <>
          {/* Floating chat: a button in the corner opens the panel. Chat stays mounted so the conversation survives closing it. */}
          <button className="chat-fab" aria-expanded={chatOpen} aria-controls="chat-panel" onClick={() => setChatOpen((o) => !o)}>
            {chatOpen ? '✕ Close chat' : <>💬 Ask FranchEyes{p.messages.length ? <span className="fab-n num">{p.messages.length}</span> : null}</>}
          </button>
          <aside id="chat-panel" className="chat sk" aria-label="Ask about decisions" hidden={!chatOpen}>
            <button className="close chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">✕</button>
            <Chat
              key={p.id}
              result={result}
              profile={p.profile}
              personal={{ bookmarks: p.bookmarks, notes: p.notes }}
              messages={p.messages}
              setMessages={setMessages}
              applyUpdates={applyUpdates}
              onApplicant={focusApplicant}
            />
          </aside>

          <ApplicantDialog
            d={openId ? result.decisions[openId] : null}
            onClose={() => setOpenId(null)}
            review={p.review}
            setReview={setReview}
            bookmarked={!!(openId && p.bookmarks[openId])}
            onToggleBookmark={toggleBookmark}
            note={(openId && p.notes[openId]) || ''}
            onNote={saveNote}
          />
          <Rubric open={rubricOpen} onClose={() => setRubricOpen(false)} profile={p.profile} />
        </>
      ) : null}
    </div>
  );
}
