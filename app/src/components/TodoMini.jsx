// v1.57 (Mateo): kleine To-do-Liste für Einladungen und Events (Geschenk kaufen, Tickets ausdrucken …)
import { useState } from 'react';
import { uid } from '../lib/store';
import { Check, Icon } from './ui';

export default function TodoMini({ items = [], onChange, label = '✅ To-dos', placeholder = 'z.B. Geschenk kaufen' }) {
  const [text, setText] = useState('');
  const add = () => {
    const list = text.split(/,|\n/).map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid(), text: x, done: false }));
    if (list.length) onChange([...items, ...list]);
    setText('');
  };
  const open = items.filter((x) => !x.done).length;
  return (
    <div className="field">
      <span>{label}{items.length ? ` · ${open} offen` : ''}</span>
      <div className="list">
        {items.map((x) => (
          <div key={x.id} className="row compact">
            <Check on={x.done} color="#E8775A" onClick={() => onChange(items.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))} label={`${x.text} ${x.done ? 'wieder öffnen' : 'abhaken'}`} />
            <span className="row-main"><span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span></span>
            <button type="button" className="x-btn" aria-label={`${x.text} entfernen`} onClick={() => onChange(items.filter((y) => y.id !== x.id))}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
        <form className="inline-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Neues To-do" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      </div>
    </div>
  );
}
