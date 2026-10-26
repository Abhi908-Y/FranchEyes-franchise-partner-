'use client';

import { useEffect, useRef, useState } from 'react';
import { buildSnapshot } from '../../lib/snapshot';
import { localAnswer, validUpdates, explain } from '../../lib/chatLocal';
import { EDITABLE_FIELDS } from '../../lib/constants';

const LABEL = { Recommended: 'Recommended', Waitlist: 'Waitlist', Hold: 'On hold', Reject: 'Rejected' };

function suggestions(result) {
  if (!result) return [];
  const ds = Object.values(result.decisions);
  const hold = ds.find((d) => d.outcome === 'Hold');
  const wait = ds.find((d) => d.outcome === 'Waitlist');
  const upper = ds.find((d) => d.outcome === 'Hold' && d.issues.some((h) => /upper floor/i.test(h.issue)));
  const out = [];
  if (hold) out.push(`Why is ${hold.id} on hold?`);
  if (wait) out.push(`Why didn’t ${wait.id} get a slot?`);
  if (upper) out.push(`${upper.id} has now found a ground-floor space`);
  out.push('Which territories still have open slots?');
  return out.slice(0, 4);
}

function Linkify({ text, onApplicant, ids }) {
  if (!ids.length) return text;
  const re = new RegExp(`(${ids.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    ids.includes(part) ? <button key={i} className="link" onClick={() => onApplicant(part)}>{part}</button> : <span key={i}>{part}</span>
  );
}

export default function Chat({ result, profile, personal, messages, setMessages, applyUpdates, onApplicant }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const box = useRef(null);
  const ids = result ? Object.keys(result.decisions) : [];

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [messages, busy]);

  async function ask(message) {
    let reply = null;
    if (!offline) {
      try {
        const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history, snapshot: buildSnapshot(result, profile, personal) }),
        });
        if (r.status === 503) setOffline(true);
        if (r.ok) reply = await r.json();
      } catch {}
    }
    return reply || localAnswer(message, result);
  }

  async function send(message) {
    const m = message.trim();
    if (!m || busy || !result) return;
    setText('');
    setMessages((x) => [...x, { role: 'user', text: m }]);
    setBusy(true);
    try {
      const reply = await ask(m);
      if (reply.type === 'update') {
        const valid = validUpdates(reply.updates, result.decisions, EDITABLE_FIELDS);
        if (!valid.length) {
          setMessages((x) => [...x, { role: 'bot', text: 'I couldn’t match that to an applicant and a field. Try “APP-012 has found a ground-floor space” or “APP-008 can now invest 31 lakh”.' }]);
        } else {
          const { changes, newResult } = applyUpdates(valid);
          const fieldLines = valid.map((u) => `${u.id}: ${EDITABLE_FIELDS[u.field].toLowerCase()} → ${u.value ?? 'blank'}`);
          const lines = changes.length
            ? changes.map((c) => ({
                id: c.id,
                text: `${c.id}: ${LABEL[c.from]} → ${LABEL[c.to]}${c.toScore !== null && c.toScore !== c.fromScore ? ` (score ${c.toScore})` : ''}. ${c.reason}`,
              }))
            : [...new Set(valid.map((u) => u.id))].map((id) => ({ id, text: `No change in outcome. ${explain(newResult.decisions[id])}` }));
          setMessages((x) => [...x, {
            role: 'bot',
            text: `Updated ${fieldLines.join('; ')}. I re-ran every decision in the batch.`,
            changes: lines,
            verify: true,
          }]);
        }
      } else {
        setMessages((x) => [...x, { role: 'bot', text: reply.text || 'I don’t have an answer for that.' }]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="chat-head">
        <b>Ask about any decision</b>
        <p>Ask why, or tell it something new about an applicant. Decisions re-run instantly.</p>
        {offline ? <p className="mode">Running without the AI model: simple questions and updates only.</p> : null}
      </div>
      <div className="msgs" aria-live="polite" ref={box}>
        {!result ? (
          <p className="empty-chat">Upload a file first. Then ask things like “Why is APP-007 on hold?” or “APP-012 has now found a ground-floor space”.</p>
        ) : null}
        {result && !messages.length ? (
          <div className="suggest">
            {suggestions(result).map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.role === 'user' ? m.text : <Linkify text={m.text} onApplicant={onApplicant} ids={ids} />}
            {m.changes ? (
              <ul className="chg">
                {m.changes.map((c, j) => <li key={j}><Linkify text={c.text} onApplicant={onApplicant} ids={ids} /></li>)}
              </ul>
            ) : null}
            {m.verify ? <div className="verify">Reported by the applicant. Verify before you confirm.</div> : null}
          </div>
        ))}
        {busy ? <div className="typing">Checking…</div> : null}
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor="chat-in" className="sr">Message</label>
        <textarea
          id="chat-in"
          rows={1}
          value={text}
          placeholder={result ? 'Why is APP-007 on hold?' : 'Upload a file to start'}
          disabled={!result}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
        />
        <button className="btn primary" disabled={!result || busy || !text.trim()}>Send</button>
      </form>
    </>
  );
}
