// Abhak-Liste nach Kategorien (z.B. Packliste: Kleidung, Elektronik …), Kategorien einklappbar
import { useState } from 'react';
import { Check, Icon } from './ui';

export default function GroupedChecklist({ items, cats = [], onAdd, onToggle, onRemove, onTemplate, color = '#2FA36B', placeholder = 'Neuer Punkt', meta }) {
  const order = [...cats, ...[...new Set(items.map((x) => x.cat))].filter((c) => !cats.includes(c))];
  const used = order.filter((c) => items.some((x) => x.cat === c));
  const [closed, setClosed] = useState({});
  const [text, setText] = useState('');
  const [cat, setCat] = useState(cats[0] || 'Sonstiges');
  const done = items.filter((x) => x.done).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.length > 0 && (
        <div className="progress-line">
          <div className="progress" style={{ flex: 1 }}><div style={{ width: `${(done / items.length) * 100}%`, background: color }} /></div>
          <span className="tiny">{done} von {items.length}</span>
        </div>
      )}
      {items.length === 0 && onTemplate && (
        <button type="button" className="btn tint" onClick={onTemplate}>Vorlage einfügen</button>
      )}
      {used.map((c) => {
        const list = items.filter((x) => x.cat === c);
        const left = list.filter((x) => !x.done).length;
        return (
          <section key={c} className="list">
            <button type="button" className="row group-head" onClick={() => setClosed({ ...closed, [c]: !closed[c] })} aria-expanded={!closed[c]}>
              <span className="row-main"><span className="row-title strong">{c}</span></span>
              <span className="tiny">{left ? `${left} offen` : '✓ fertig'}</span>
              <span style={{ display: 'inline-flex', transform: closed[c] ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }}><span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icon name="chevLeft" size={15} color="var(--chev)" /></span></span>
            </button>
            {!closed[c] && [...list.filter((x) => !x.done), ...list.filter((x) => x.done)].map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 44 }}>
                <Check on={x.done} color={color} onClick={() => onToggle(x.id)} label={x.text} />
                <span className="row-main">
                  <span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span>
                  {meta && meta(x) && <span className="row-meta">{meta(x)}</span>}
                </span>
                <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => onRemove(x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
          </section>
        );
      })}
      <form className="card" style={{ gap: 8, padding: 12 }} onSubmit={(e) => { e.preventDefault(); onAdd(text, cat); setText(''); }}>
        <div className="box-tabs">
          {[...new Set([...cats, ...used, 'Sonstiges'])].map((c) => <button key={c} type="button" className={c === cat ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="block-add">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`${placeholder} (${cat})`} aria-label={placeholder} />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </div>
      </form>
    </div>
  );
}
