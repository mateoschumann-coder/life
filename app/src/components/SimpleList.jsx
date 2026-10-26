// Einfache Abhak-Liste mit Eingabefeld (für Reisen, Treffen …)
import { useState } from 'react';
import { Check, Icon } from './ui';

export default function SimpleList({ items, onAdd, onToggle, onRemove, placeholder, color = '#2FA36B', meta, extraInput }) {
  const [text, setText] = useState('');
  const [extra, setExtra] = useState('');
  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  return (
    <div className="list">
      {[...open, ...done].map((x) => (
        <div key={x.id} className="row" style={{ minHeight: 46 }}>
          <Check on={x.done} color={color} onClick={() => onToggle(x.id)} label={x.text} />
          <span className="row-main">
            <span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span>
            {meta && meta(x) && <span className="row-meta">{meta(x)}</span>}
          </span>
          {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
          <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => onRemove(x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
        </div>
      ))}
      <form className="inline-add" onSubmit={(e) => { e.preventDefault(); onAdd(text, extra); setText(''); setExtra(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        {extraInput && <input className="input" style={{ maxWidth: 110 }} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={extraInput} aria-label={extraInput} />}
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
    </div>
  );
}
