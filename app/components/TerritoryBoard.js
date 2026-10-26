'use client';

export default function TerritoryBoard({ territories, onApplicant }) {
  return (
    <section>
      <h3 className="section-title">Territories</h3>
      <p className="section-sub">Each pin code can hold one store. Filled squares are slots given out in this batch.</p>
      <div className="legend" aria-hidden="true">
        <span><i style={{ background: 'var(--store)' }} />Existing store</span>
        <span><i style={{ background: 'var(--rec-bg)', border: '1.5px solid var(--rec)' }} />Recommended applicant</span>
        <span><i style={{ border: '1.5px dashed var(--line-2)' }} />Open</span>
      </div>
      <div className="board">
        {territories.map((t) => (
          <div className="terr" key={t.id}>
            <div className="terr-head">
              <b>{t.city} <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}>{t.id}</span></b>
              <span className="meta">{t.tier}, {t.priority.toLowerCase()} priority, needs a score of {t.bar}+</span>
              <div className="slots" aria-label={`${t.filled} of ${t.slots} slots filled`}>
                {Array.from({ length: t.slots }).map((_, i) => <span key={i} className={`slot${i < t.filled ? ' full' : ''}`} />)}
                <small className="num">{t.filled}/{t.slots} slots</small>
              </div>
            </div>
            <div className="pins">
              {t.pinsState.map((p) =>
                p.status === 'awarded' ? (
                  <button key={p.pin} className="pin awarded" onClick={() => onApplicant(p.by)} title={`Recommended: ${p.by}`}>
                    {p.pin} <em>{p.by}</em>
                  </button>
                ) : (
                  <span key={p.pin} className={`pin ${p.status}`} title={p.status === 'store' ? `Existing store ${p.by}` : 'Open'}>
                    {p.pin} {p.status === 'store' ? <em>{p.by}</em> : null}
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
