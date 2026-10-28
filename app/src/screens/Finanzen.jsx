import { useState } from 'react';
import { useStore } from '../lib/store';
import { addCostCat, addLine, budgetOf, calc, catOf, costCatsOf, removeCostCat, convert, CURRENCIES, fetchRates, money, removeLine, setBudget, setRate, updateLine } from '../lib/budget';
import { Back, Field, Icon, Segmented, Sheet, TabBar, toast, Info } from '../components/ui';

const GREEN = '#2FA36B';
const fmtRate = (v) => (v >= 100 ? Math.round(v).toLocaleString('de-DE') : (Math.round(v * 1000) / 1000).toLocaleString('de-DE'));
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function Amount({ value, currency, onChange, onCurrency, label, narrow }) {
  return (
    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <input className="input" style={{ width: narrow ? 84 : 110, textAlign: 'right', padding: narrow ? '8px 8px' : undefined }} inputMode="decimal" defaultValue={value || ''} key={value} placeholder="0" aria-label={label} onBlur={(e) => { const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')) || 0; if (v !== value) onChange(v); }} />
      <select className="input" style={{ width: narrow ? 70 : 74, padding: '0 6px', minHeight: narrow ? 40 : undefined }} value={currency} onChange={(e) => onCurrency(e.target.value)} aria-label={`${label} Währung`}>
        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
      </select>
    </span>
  );
}

const toNum = (v) => Number(String(v || '').replace(/\./g, '').replace(',', '.')) || 0;
// v0.93 (Mateo: kleine Felder in der Zeile ließen sich schlecht leeren): Zeile antippen → Fenster mit großen Feldern
function LineSheet({ b, line, onClose }) {
  const [f, setF] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const key = line ? line.id || `neu-${line.kind}` : null;
  if (key !== loaded) { setLoaded(key); setF(line ? { name: line.name || '', amount: line.amount ? String(line.amount).replace('.', ',') : '', currency: line.currency || b.base, cat: line.cat || 'sonstiges' } : null); }
  if (!line || !f) return <Sheet open={false} onClose={onClose} title="" />;
  const isNew = !line.id;
  const cost = line.kind === 'costs';
  const save = () => {
    const data = { name: f.name.trim(), amount: toNum(f.amount), currency: f.currency, ...(cost ? { cat: f.cat } : {}) };
    if (isNew) addLine(line.kind, data);
    else updateLine(line.kind, line.id, data);
    toast('Gespeichert');
    onClose();
  };
  return (
    <Sheet open title={isNew ? (cost ? 'Neue Fixkosten' : 'Neue Einnahme') : f.name || (cost ? 'Fixkosten' : 'Einnahme')} onClose={onClose}>
      <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={cost ? 'z.B. Miete, Handy, Netflix' : 'z.B. Gehalt, Freelance'} /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}><Field label="Betrag pro Monat"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></Field></div>
        <div style={{ width: 96 }}>
          <Field label="Währung">
            <select className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
      </div>
      {cost && (
        <div className="field">
          <span>Kategorie</span>
          <div className="chips">{costCatsOf(b).map((c) => <button key={c.id} type="button" className={catOf(f.cat, b).id === c.id ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, cat: c.id })}>{c.label}</button>)}</div>
        </div>
      )}
      <button type="button" className="btn" onClick={save}>Speichern</button>
      {!isNew && <button type="button" className="btn danger" onClick={() => { removeLine(line.kind, line.id); onClose(); }}>Löschen</button>}
    </Sheet>
  );
}

function LineRow({ b, x, sub, onOpen }) {
  return (
    <button type="button" className="row" style={{ minHeight: 54, width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none' }} onClick={onOpen}>
      <span className="row-main">
        <span className="row-title plain">{x.name || <span style={{ color: 'var(--sub)' }}>Ohne Namen</span>}</span>
        {sub && <span className="row-meta">{sub}</span>}
      </span>
      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <b style={{ fontSize: 15 }}>{money(x.amount || 0, x.currency)}</b>
        {x.currency !== b.base && x.amount ? <span className="tiny" style={{ display: 'block' }}>≈ {money(convert(b, x.amount, x.currency), b.base)}</span> : null}
      </span>
      <Icon name="chev" size={13} color="var(--chev)" />
    </button>
  );
}

export default function Finanzen() {
  const s = useStore();
  const b = budgetOf(s);
  const r = calc(b);
  const [cat, setCat] = useState('miete');
  const [newCat, setNewCat] = useState(null);
  const [editCats, setEditCats] = useState(false);
  const [line, setLine] = useState(null);
  const [busy, setBusy] = useState(false);
  const other = b.base === 'USD' ? 'EUR' : 'USD';
  const now = new Date();
  const loadRates = async () => {
    setBusy(true);
    try { await fetchRates(); toast('Kurse aktualisiert'); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const max = Math.max(1, ...r.byCat.map((c) => c.sum));
  const next = [0, 1, 2].map((i) => new Date(now.getFullYear(), now.getMonth() + i, 1));

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/persoenlich" label="Persönlich" />
          <h1 className="h1">Finanzen</h1>
        </div>

        <section className="card" style={{ gap: 6, padding: '10px 12px' }}>
          <div className="sec-h" style={{ padding: 0 }}>
            <span className="label" style={{ padding: 0 }}>Wechselkurse{b.ratesAt ? ` · ${new Date(b.ratesAt).toLocaleDateString('de-DE')}` : ''}</span>
            <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={loadRates} disabled={busy}>{busy ? '…' : 'Aktuell holen'}</button>
          </div>
          <div className="rate-grid">
            {[
              { id: 'usdars', label: 'US$ → ARS', value: b.rates.ARS, set: (v) => setRate('ARS', v) },
              { id: 'eurars', label: '€ → ARS', value: b.rates.ARS / b.rates.EUR, set: (v) => setRate('EUR', b.rates.ARS / v) },
              { id: 'eurusd', label: '€ → US$', value: 1 / b.rates.EUR, set: (v) => setRate('EUR', 1 / v) },
            ].map((x) => (
              <label key={x.id} className="rate-cell">
                <span className="tiny">{x.label}</span>
                <input className="input" inputMode="decimal" defaultValue={fmtRate(x.value)} key={fmtRate(x.value)} onBlur={(e) => { const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')); if (v > 0 && fmtRate(v) !== fmtRate(x.value)) x.set(v); }} aria-label={`Kurs ${x.label}`} />
              </label>
            ))}
          </div>
        </section>

        <section className="card countdown" style={{ gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <span className="tiny">Pro Tag im {MONTHS[now.getMonth()]} ({r.days} Tage)</span>
          <b style={{ fontSize: 34, color: r.free < 0 ? 'var(--danger)' : 'var(--text)' }}>{money(r.perDay, b.base)}</b>
          <span className="sub">≈ {money(convert(b, r.perDay, b.base, other), other)} · pro Woche {money(r.perWeek, b.base)}</span>
          <Info>Frei im Monat: {money(r.free, b.base)} = Einnahmen {money(r.income, b.base)} − Fixkosten {money(r.fixed, b.base)} − Sparen {money(r.save, b.base)}</Info>
        </section>

        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Anzeigen in</span>
          <Segmented full options={CURRENCIES.map((c) => ({ id: c, label: c }))} value={b.base} onChange={(v) => setBudget({ base: v })} label="Anzeige-Währung" />
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Einnahmen pro Monat</h2><button type="button" className="link-btn" onClick={() => setLine({ kind: 'incomes', name: b.incomes.length ? '' : 'Gehalt', currency: b.base })}>+ Einnahme</button></div>
          <div className="list">
            {b.incomes.length === 0 && <div className="empty">Noch nichts eingetragen – z.B. Gehalt oder Freelance.</div>}
            {b.incomes.map((x) => <LineRow key={x.id} b={b} x={x} onOpen={() => setLine({ ...x, kind: 'incomes' })} />)}
          </div>
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Sparziel pro Monat</h2></div>
          <div className="list">
            <div className="row" style={{ minHeight: 56 }}>
              <span className="row-main"><span className="row-title plain">Will ich zurücklegen</span></span>
              <Amount value={b.savings.amount} currency={b.savings.currency} label="Sparziel" onChange={(v) => setBudget({ savings: { ...b.savings, amount: v } })} onCurrency={(c) => setBudget({ savings: { ...b.savings, currency: c } })} />
            </div>
          </div>
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Fixkosten pro Monat</h2><span className="tiny">{money(r.fixed, b.base)}</span></div>
          <div className="chips">
            {costCatsOf(b).map((c) => <button key={c.id} type="button" className={cat === c.id ? 'chip on' : 'chip soft'} onClick={() => (editCats && c.own ? (confirm(`Kategorie „${c.label}“ entfernen? Einträge landen unter Sonstiges.`) && removeCostCat(c.id)) : setCat(c.id))}>{c.label}{editCats && c.own ? ' ✕' : ''}</button>)}
            {newCat === null && <button type="button" className="chip soft" onClick={() => setNewCat('')}>+ Neue Kategorie</button>}
            {(b.cats || []).length > 0 && <button type="button" className={editCats ? 'chip on' : 'chip soft'} onClick={() => setEditCats(!editCats)}>{editCats ? 'Fertig' : '✎'}</button>}
          </div>
          {newCat !== null && <form className="block-add" onSubmit={(e) => { e.preventDefault(); const id = addCostCat(newCat); if (id) setCat(id); setNewCat(null); }}><input className="input" autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="z.B. Haustier, Spenden, Bildung" aria-label="Neue Kategorie" /><button type="submit" className="btn small">{newCat.trim() ? '+' : '✕'}</button></form>}
          <button type="button" className="btn sec small" onClick={() => setLine({ kind: 'costs', cat, name: '', currency: b.base })}>+ {catOf(cat, b).label} hinzufügen</button>
          <div className="list">
            {b.costs.length === 0 && <div className="empty">Wähl oben eine Kategorie und füg deine festen Kosten hinzu – jede in ihrer Währung (z.B. Miete in US$, Handy in ARS).</div>}
            {costCatsOf(b).flatMap((c) => b.costs.filter((x) => (catOf(x.cat, b).id) === c.id)).map((x) => <LineRow key={x.id} b={b} x={x} sub={catOf(x.cat, b).label} onOpen={() => setLine({ ...x, kind: 'costs' })} />)}
          </div>
          {r.byCat.length > 1 && (
            <section className="card" style={{ gap: 6 }}>
              <span className="label" style={{ padding: 0 }}>Wohin die Fixkosten gehen</span>
              {r.byCat.map((c) => (
                <div key={c.id} className="funnel-row">
                  <span className="tiny" style={{ width: 110 }}>{c.label}</span>
                  <span className="funnel-bar"><span style={{ width: `${(c.sum / max) * 100}%`, background: GREEN }} /></span>
                  <b style={{ minWidth: 70, textAlign: 'right', fontSize: 13 }}>{money(c.sum, b.base)}</b>
                </div>
              ))}
            </section>
          )}
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Die nächsten Monate</h2></div>
          <div className="list">
            {next.map((d) => {
              const x = calc(b, d);
              return (
                <div key={d.getMonth()} className="row" style={{ minHeight: 50 }}>
                  <span className="row-main"><span className="row-title plain">{MONTHS[d.getMonth()]}</span><span className="row-meta">{x.days} Tage</span></span>
                  <b>{money(x.perDay, b.base)} / Tag</b>
                </div>
              );
            })}
          </div>
        </section>

      </main>
      <LineSheet b={b} line={line} onClose={() => setLine(null)} />
      <TabBar active="bereiche" />
    </>
  );
}
