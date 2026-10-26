'use client';

export default function TerritoryBoard({ territories, onApplicant }) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Each pin code can hold one store. Filled squares are slots given out in this batch. Click a recommended pin to open that applicant.</p>
      <div className="legend" aria-hidden="true">
        <span><i style={{ background: 'var(--ink)' }} />Existing store</span>
        <span><i style={{ background: 'var(--rec-bg)' }} />Recommended applicant</span>
        <span><i style={{ borderStyle: 'dashed', background: '#fff' }} />Open</span>
      </div>
      <div className="board">
        {territories.map((t) => (
          <div className="terr sk" key={t.id}>
            <div className="terr-head">
              <b>{t.city} <span>{t.id}</span></b>
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
