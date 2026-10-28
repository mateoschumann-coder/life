// Abhak-Liste nach Kategorien (v0.90, Mateo): Kategorien als Reiter statt untereinander, Eingabe OBEN, kurze kompakte Zeilen.
// extraTabs = weitere Reiter mit eigenem Inhalt (z.B. Einkauf bei Events): [{ key, label, open, total, render }]
import { useState } from 'react';
import { Check, Icon } from './ui';

export default function GroupedChecklist({ items, cats = [], onAdd, onToggle, onRemove, onTemplate, color = '#2FA36B', placeholder = 'Neuer Punkt', meta, extraTabs = [], tabKey }) {
  const [extraCats, setExtraCats] = useState([]);
  const order = [...new Set([...cats, ...items.map((x) => x.cat).filter(Boolean), ...extraCats])];
  // extraTabs mit „after“ werden hinter dem genannten Teil eingereiht (z.B. Einkauf nach „Planen“)
  const tabs = [];
  for (const c of order) {
    tabs.push({ key: c, label: c, list: items.filter((x) => x.cat === c) });
    tabs.push(...extraTabs.filter((e) => e.after === c));
  }
  tabs.push(...extraTabs.filter((e) => !e.after || !order.includes(e.after)));
  const [act, setActState] = useState(() => { try { return (tabKey && sessionStorage.getItem(tabKey)) || null; } catch { return null; } });
  const setAct = (k) => { setActState(k); try { if (tabKey) sessionStorage.setItem(tabKey, k); } catch {} };
  const cur = tabs.find((t) => t.key === act) || tabs[0];
  const [text, setText] = useState('');
  const [newCat, setNewCat] = useState(null);
  const done = items.filter((x) => x.done).length;
  const add = (e) => {
    e.preventDefault();
    if (!text.trim() || !cur) return;
    onAdd(text, cur.key);
    setText('');
  };
  const list = cur?.list || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.length > 0 && (
        <div className="progress-line">
          <div className="progress" style={{ flex: 1 }}><div style={{ width: `${(done / items.length) * 100}%`, background: color }} /></div>
          <span className="tiny">{done} von {items.length}</span>
        </div>
      )}
      <div className="box-tabs">
        {tabs.map((t) => {
          const open = t.list ? t.list.filter((x) => !x.done).length : t.open;
          const total = t.list ? t.list.length : t.total;
          return (
            <button key={t.key} type="button" className={cur?.key === t.key ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setAct(t.key)}>
              {t.label}{total ? ` · ${open ? open : '✓'}` : ''}
            </button>
          );
        })}
        {onAdd && (newCat === null
          ? <button type="button" className="chip soft" style={{ whiteSpace: 'nowrap' }} onClick={() => setNewCat('')} aria-label="Neuer Teil">+</button>
          : (
            <form style={{ display: 'flex', gap: 4 }} onSubmit={(e) => { e.preventDefault(); const n = newCat.trim(); if (n) { setExtraCats([...extraCats, n]); setAct(n); } setNewCat(null); }}>
              <input className="input" autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Neuer Teil" aria-label="Name des neuen Teils" style={{ width: 130, minHeight: 34, padding: '4px 10px' }} />
              <button type="submit" className="chip on">{newCat.trim() ? 'OK' : '✕'}</button>
            </form>
          ))}
      </div>
      {cur?.render ? cur.render() : (
        <>
          {onAdd && cur && (
            <form className="block-add" onSubmit={add}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`${placeholder} (${cur.label})`} aria-label={placeholder} />
              <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
            </form>
          )}
          <section className="list">
            {list.length === 0 && (
              <div className="empty" style={{ padding: '12px 14px' }}>
                {items.length === 0 && onTemplate ? <button type="button" className="btn tint small" onClick={onTemplate}>Vorlage einfügen</button> : 'Noch nichts – oben eintragen.'}
              </div>
            )}
            {[...list.filter((x) => !x.done), ...list.filter((x) => x.done)].map((x) => (
              <div key={x.id} className="row compact">
                <Check on={x.done} color={color} onClick={() => onToggle(x.id)} label={x.text} />
                <span className="row-main">
                  <span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span>
                  {meta && meta(x) && <span className="row-meta">{meta(x)}</span>}
                </span>
                <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => onRemove(x.id)}><Icon name="x" size={11} color="var(--chev)" /></button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
