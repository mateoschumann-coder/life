// Darstellung und Bedienung der Projekt-Bausteine
import { useState } from 'react';
import { fmtShort, today } from '../lib/dates';
import { BLOCK_TYPES, editBlock, moveBlock, removeBlock } from '../lib/blocks';
import { uid } from '../lib/store';
import { Check, Icon } from './ui';
import MiniChart from './MiniChart';

const num = (v) => (v === '' || v === null || isNaN(Number(v)) ? null : Number(v));
const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('de-DE');

function Head({ p, b, first, last }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="block-head">
      <span className="block-icon"><Icon name={BLOCK_TYPES[b.type]?.icon || 'edit'} size={16} /></span>
      <span className="block-title">{b.title}</span>
      <button type="button" className="x-btn" onClick={() => setMenu(!menu)} aria-label={`Optionen für ${b.title}`} aria-expanded={menu}>
        <Icon name="more" size={16} color="var(--muted)" />
      </button>
      {menu && (
        <div className="block-menu">
          {!first && <button type="button" onClick={() => { moveBlock(p.id, b.id, -1); setMenu(false); }}>Nach oben</button>}
          {!last && <button type="button" onClick={() => { moveBlock(p.id, b.id, 1); setMenu(false); }}>Nach unten</button>}
          <button type="button" style={{ color: 'var(--danger)' }} onClick={() => confirm(`„${b.title}“ entfernen?`) && removeBlock(p.id, b.id)}>Entfernen</button>
        </div>
      )}
    </div>
  );
}

function Kennzahl({ p, b, color }) {
  const [val, setVal] = useState('');
  const [date, setDate] = useState(today());
  const last = [...b.entries].sort((a, c) => (a.date < c.date ? -1 : 1)).at(-1);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700 }}>{last ? fmt(last.value) : '–'}</span>
        <span className="sub">{b.unit}{b.goal ? ` · Ziel ${fmt(b.goal)}` : ''}</span>
      </div>
      <MiniChart entries={b.entries} goal={b.goal} color={color} unit={b.unit} />
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); const v = num(val); if (v === null) return; editBlock(p.id, b.id, (x) => x.entries.push({ date, value: v })); setVal(''); }}>
        <input className="input" type="number" inputMode="decimal" step="any" value={val} onChange={(e) => setVal(e.target.value)} placeholder={`Wert${b.unit ? ' in ' + b.unit : ''}`} aria-label="Neuer Wert" />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 140, flexShrink: 0 }} aria-label="Datum" />
        <button type="submit" className="btn small" disabled={num(val) === null}>+</button>
      </form>
    </>
  );
}

function Liste({ p, b, color }) {
  const [text, setText] = useState('');
  const open = b.items.filter((i) => !i.done).length;
  return (
    <>
      {b.items.length > 0 && <span className="tiny">{open} offen · {b.items.length - open} erledigt</span>}
      <div className="block-list">
        {b.items.map((i) => (
          <div key={i.id} className="block-item">
            <Check on={i.done} color={color} onClick={() => editBlock(p.id, b.id, (x) => { const it = x.items.find((y) => y.id === i.id); it.done = !it.done; })} label={i.text} />
            <span className={i.done ? 'row-title done' : 'row-title'} style={{ fontSize: 16, flex: 1 }}>{i.text}</span>
            <button type="button" className="x-btn" aria-label={`${i.text} löschen`} onClick={() => editBlock(p.id, b.id, (x) => { x.items = x.items.filter((y) => y.id !== i.id); })}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
      </div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; editBlock(p.id, b.id, (x) => x.items.push({ id: uid(), text: text.trim(), done: false })); setText(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Neuer Punkt …" aria-label="Neuer Punkt" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
    </>
  );
}

function Zaehler({ p, b, color }) {
  const pct = b.goal ? Math.min(100, (b.count / b.goal) * 100) : null;
  const change = (d) => editBlock(p.id, b.id, (x) => { x.count = Math.max(0, x.count + d); if (d > 0) x.log.push(today()); });
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" className="icon-btn" onClick={() => change(-1)} aria-label="Eins weniger" disabled={b.count === 0}><Icon name="minus" size={18} /></button>
        <span style={{ fontSize: 30, fontWeight: 700, minWidth: 60, textAlign: 'center' }}>{b.count}</span>
        <button type="button" className="icon-btn" style={{ background: color, color: '#fff' }} onClick={() => change(1)} aria-label="Eins mehr"><Icon name="plus" size={18} color="#fff" /></button>
        {b.goal && <span className="sub">von {b.goal}</span>}
      </div>
      {pct !== null && <div className="progress"><div style={{ width: `${pct}%`, background: color }} /></div>}
    </>
  );
}

function Meilensteine({ p, b, color }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const items = [...b.items].sort((a, c) => (a.date || '9') < (c.date || '9') ? -1 : 1);
  return (
    <>
      <div className="timeline">
        {items.map((i) => (
          <div key={i.id} className="tl-item">
            <Check on={i.done} color={color} onClick={() => editBlock(p.id, b.id, (x) => { const it = x.items.find((y) => y.id === i.id); it.done = !it.done; })} label={i.text} />
            <div className="row-main">
              <span className={i.done ? 'row-title done' : 'row-title'} style={{ fontSize: 16 }}>{i.text}</span>
              {i.date && <span className="row-meta">{fmtShort(i.date)}</span>}
            </div>
            <button type="button" className="x-btn" aria-label={`${i.text} löschen`} onClick={() => editBlock(p.id, b.id, (x) => { x.items = x.items.filter((y) => y.id !== i.id); })}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
      </div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; editBlock(p.id, b.id, (x) => x.items.push({ id: uid(), text: text.trim(), date: date || null, done: false })); setText(''); setDate(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Neuer Meilenstein …" aria-label="Neuer Meilenstein" />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 140, flexShrink: 0 }} aria-label="Datum (optional)" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
    </>
  );
}

function Budget({ p, b, color }) {
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const spent = b.items.reduce((sum, i) => sum + i.amount, 0);
  const pct = b.limit ? Math.min(100, (spent / b.limit) * 100) : 0;
  const over = b.limit && spent > b.limit;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: over ? 'var(--danger)' : undefined }}>{fmt(spent)} {b.unit}</span>
        {b.limit ? <span className="sub">von {fmt(b.limit)} {b.unit} · {over ? `${fmt(spent - b.limit)} drüber` : `${fmt(b.limit - spent)} übrig`}</span> : null}
      </div>
      {b.limit ? <div className="progress"><div style={{ width: `${pct}%`, background: over ? 'var(--danger)' : color }} /></div> : null}
      <div className="block-list">
        {b.items.slice(-5).reverse().map((i) => (
          <div key={i.id} className="block-item">
            <span style={{ flex: 1, fontSize: 15 }}>{i.text}</span>
            <span className="sub">{fmt(i.amount)} {b.unit}</span>
            <button type="button" className="x-btn" aria-label={`${i.text} löschen`} onClick={() => editBlock(p.id, b.id, (x) => { x.items = x.items.filter((y) => y.id !== i.id); })}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
      </div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); const v = num(amount); if (v === null || !text.trim()) return; editBlock(p.id, b.id, (x) => x.items.push({ id: uid(), text: text.trim(), amount: v, date: today() })); setText(''); setAmount(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Wofür?" aria-label="Wofür" />
        <input className="input" type="number" inputMode="decimal" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Betrag" style={{ width: 100, flexShrink: 0 }} aria-label="Betrag" />
        <button type="submit" className="btn small" disabled={!text.trim() || num(amount) === null}>+</button>
      </form>
    </>
  );
}

function Notiz({ p, b }) {
  return (
    <textarea className="input" defaultValue={b.text} key={b.id} placeholder="Gedanken, Ziel, Plan …" onBlur={(e) => e.target.value !== b.text && editBlock(p.id, b.id, (x) => { x.text = e.target.value; })} />
  );
}

const VIEWS = { kennzahl: Kennzahl, liste: Liste, zaehler: Zaehler, meilensteine: Meilensteine, budget: Budget, notiz: Notiz };

export default function Blocks({ p, color }) {
  const blocks = p.blocks || [];
  return blocks.map((b, i) => {
    const View = VIEWS[b.type] || Notiz;
    return (
      <section key={b.id} className="card block">
        <Head p={p} b={b} first={i === 0} last={i === blocks.length - 1} />
        <View p={p} b={b} color={color} />
      </section>
    );
  });
}
