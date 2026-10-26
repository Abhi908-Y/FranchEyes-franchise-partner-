'use client';

import { useState } from 'react';
import { NEXT_STEP_TYPES } from '../../lib/constants';
import { agreementFields, agreementClauses, agreementHtml } from '../../lib/agreement';

const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const icsTime = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// A calendar invite the reviewer can open in Google Calendar, Outlook or Apple Calendar.
function downloadIcs(item, d) {
  const t = NEXT_STEP_TYPES[item.type];
  const start = new Date(item.when);
  const end = new Date(start.getTime() + t.minutes * 60000);
  const a = d.applicant;
  const text = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FranchEyes//EN', 'BEGIN:VEVENT',
    `UID:${item.id}@franchEyes`, `DTSTAMP:${icsTime(new Date())}`, `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(end)}`,
    `SUMMARY:${t.label}: ${d.id} ${a.name || ''}`.trim(),
    `LOCATION:${item.type === 'call' ? (item.mode || 'Phone') : `${a.city || ''} ${a.pin || ''}`.trim()}`,
    `DESCRIPTION:${[`${t.label} with franchise applicant ${d.id} ${a.name || ''}`, item.note].filter(Boolean).join('. ').replace(/[\n,;]/g, ' ')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  download(`${d.id}-${item.type}.ics`, 'text/calendar', text);
}

function Scheduler({ type, d, items, onAdd, onRemove }) {
  const t = NEXT_STEP_TYPES[type];
  const [when, setWhen] = useState('');
  const [mode, setMode] = useState('Phone');
  const [note, setNote] = useState('');
  const mine = items.filter((x) => x.type === type);
  const hint = type === 'visit'
    ? `Check the ${d.applicant.size ?? '?'} sq ft space at pin ${d.applicant.pin}: frontage, footfall and fit-out needs.`
    : type === 'call'
      ? 'Introduce the next steps, confirm funds and the space, and answer their questions.'
      : 'Bring the draft agreement (see the Franchise agreement tab), ID and PAN, and the fee payment.';
  return (
    <div className="ns-pane">
      <p className="muted">{hint}</p>
      <div className="ns-form">
        <label className="field">Date and time
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        {type === 'call' ? (
          <label className="field">How
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>Phone</option><option>Video call</option>
            </select>
          </label>
        ) : null}
        <label className="field ns-note">Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'visit' ? 'e.g. meet the landlord too' : ''} />
        </label>
        <button
          className="btn"
          disabled={!when}
          onClick={() => {
            onAdd({ id: `s${Date.now().toString(36)}`, type, when: new Date(when).toISOString(), mode: type === 'call' ? mode : '', note: note.trim() });
            setWhen(''); setNote('');
          }}
        >
          {t.icon} Schedule {t.label.toLowerCase()}
        </button>
      </div>
      {mine.length ? (
        <ul className="ns-list">
          {mine.map((x) => (
            <li key={x.id}>
              <b>{t.icon} {fmt(x.when)}</b>{x.mode ? ` · ${x.mode}` : ''}{x.note ? ` · ${x.note}` : ''}
              <span className="ns-acts">
                <button className="mini-btn" onClick={() => downloadIcs(x, d)}>Add to calendar (.ics)</button>
                <button className="mini-btn" onClick={() => onRemove(x.id)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Agreement({ d, profile, values, onChange }) {
  const fields = agreementFields(d, profile);
  const val = (k) => values[k] ?? fields.find((f) => f.key === k).value;
  const blanks = fields.filter((f) => !String(val(f.key)).trim());
  const clauses = agreementClauses((k) => String(val(k)).trim() || null);
  const merged = Object.fromEntries(fields.map((f) => [f.key, val(f.key)]));
  const name = `franchise-agreement-${d.id}`;
  return (
    <div className="ns-pane">
      <p className="muted">
        Prefilled from the application. {blanks.length ? <b>{blanks.length} blank{blanks.length === 1 ? '' : 's'} left</b> : <b>All fields filled</b>}
        {blanks.length ? `: ${blanks.map((f) => f.label.toLowerCase()).join(', ')}.` : '.'} Not legal advice: have the legal team review it before signing.
      </p>
      <div className="ag-fields">
        {fields.map((f) => (
          <label key={f.key} className={`field${String(val(f.key)).trim() ? '' : ' empty'}`}>{f.label}
            <input value={val(f.key)} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="review">
        <button className="btn" onClick={() => download(`${name}.doc`, 'application/msword', agreementHtml(merged, fields))}>⬇ Download (Word)</button>
        <button
          className="btn ghost"
          onClick={() => {
            const w = window.open('', '_blank');
            if (!w) return;
            w.document.write(agreementHtml(merged, fields));
            w.document.close();
            w.focus();
            w.print();
          }}
        >
          🖨 Print / save as PDF
        </button>
        {Object.keys(values).length ? <button className="mini-btn" onClick={() => onChange({})}>Reset to prefill</button> : null}
      </div>
      <div className="ag-doc">
        <h4>Franchise Agreement</h4>
        {clauses.map((c, i) => (
          <p key={c.title}>
            <b>{i + 1}. {c.title}. </b>
            {c.parts.map((p, j) => (p.text !== undefined ? <span key={j}>{p.text}</span> : p.value ? <b key={j}>{p.value}</b> : <span key={j} className="blank">__________</span>))}
          </p>
        ))}
      </div>
    </div>
  );
}

// For recommended partners: schedule the next meetings, send the email, draft the agreement.
export default function NextSteps({ d, profile, schedule, onAdd, onRemove, agreement, onAgreement, emailPane }) {
  const [tab, setTab] = useState('visit');
  const tabs = [
    ['visit', `${NEXT_STEP_TYPES.visit.icon} Site visit`],
    ['call', `${NEXT_STEP_TYPES.call.icon} Call`],
    ['signing', `${NEXT_STEP_TYPES.signing.icon} Agreement signing`],
    ['email', '✉️ Email'],
    ['agreement', '📄 Franchise agreement'],
  ];
  const count = (k) => schedule.filter((x) => x.type === k).length;
  return (
    <div className="box ns">
      <h3>Take next step</h3>
      <div className="tabs" role="tablist" aria-label="Next steps">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}{count(k) ? <span className="n num">{count(k)}</span> : null}
          </button>
        ))}
      </div>
      {tab in NEXT_STEP_TYPES ? <Scheduler key={tab} type={tab} d={d} items={schedule} onAdd={onAdd} onRemove={onRemove} /> : null}
      {tab === 'email' ? <div className="ns-pane">{emailPane}</div> : null}
      {tab === 'agreement' ? <Agreement d={d} profile={profile} values={agreement} onChange={onAgreement} /> : null}
    </div>
  );
}
