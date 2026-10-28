import { useState } from 'react';
import { useStore } from '../lib/store';
import { addCostCat, addLine, budgetOf, calc, catOf, costCatsOf, removeCostCat, convert, CURRENCIES, fetchRates, money, removeLine, setBudget, setRate, updateLine } from '../lib/budget';
import { Back, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

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

export default function Finanzen() {
  const s = useStore();
  const b = budgetOf(s);
  const r = calc(b);
  const [cat, setCat] = useState('miete');
  const [newCat, setNewCat] = useState(null);
  const [editCats, setEditCats] = useState(false);
  const [moveCost, setMoveCost] = useState(null);
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
          <span className="tiny">Frei im Monat: {money(r.free, b.base)} = Einnahmen {money(r.income, b.base)} − Fixkosten {money(r.fixed, b.base)} − Sparen {money(r.save, b.base)}</span>
        </section>

        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Anzeigen in</span>
          <Segmented full options={CURRENCIES.map((c) => ({ id: c, label: c }))} value={b.base} onChange={(v) => setBudget({ base: v })} label="Anzeige-Währung" />
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Einnahmen pro Monat</h2><button type="button" className="link-btn" onClick={() => addLine('incomes', { name: b.incomes.length ? '' : 'Gehalt' })}>+ Einnahme</button></div>
          <div className="list">
            {b.incomes.length === 0 && <div className="empty">Noch nichts eingetragen – z.B. Gehalt oder Freelance.</div>}
            {b.incomes.map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 56, gap: 8 }}>
                <input className="input row-main" style={{ minWidth: 0, minHeight: 36, padding: '6px 10px', fontSize: 15 }} defaultValue={x.name} key={x.id + (x.name || '')} placeholder="z.B. Gehalt" onBlur={(e) => e.target.value !== x.name && updateLine('incomes', x.id, { name: e.target.value })} aria-label="Name der Einnahme" />
                <Amount narrow value={x.amount} currency={x.currency} label="Betrag" onChange={(v) => updateLine('incomes', x.id, { amount: v })} onCurrency={(c) => updateLine('incomes', x.id, { currency: c })} />
                <button type="button" className="x-btn" style={{ width: 26 }} aria-label="Löschen" onClick={() => removeLine('incomes', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
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
          <button type="button" className="btn sec small" onClick={() => addLine('costs', { cat, name: '' })}>+ {catOf(cat, b).label} hinzufügen</button>
          <div className="list">
            {b.costs.length === 0 && <div className="empty">Wähl oben eine Kategorie und füg deine festen Kosten hinzu – jede in ihrer Währung (z.B. Miete in US$, Handy in ARS).</div>}
            {costCatsOf(b).flatMap((c) => b.costs.filter((x) => (catOf(x.cat, b).id) === c.id)).map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 60, gap: 8 }}>
                <span className="row-main" style={{ gap: 2, minWidth: 0 }}>
                  <input className="input" style={{ minHeight: 36, padding: '6px 10px', fontSize: 15 }} defaultValue={x.name} key={x.id + (x.name || '')} placeholder={catOf(x.cat, b).label} onBlur={(e) => e.target.value !== x.name && updateLine('costs', x.id, { name: e.target.value })} aria-label="Name der Fixkosten" />
                  <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 4, minWidth: 0 }}>
                    <button type="button" className="link-btn" style={{ fontSize: 12.5, padding: 0, whiteSpace: 'nowrap' }} onClick={() => setMoveCost(x)} aria-label="Kategorie ändern">{catOf(x.cat, b).label} ▾</button>
                    {x.currency !== b.base && x.amount ? <span className="tiny" style={{ whiteSpace: 'nowrap' }}>≈ {money(convert(b, x.amount, x.currency), b.base)}</span> : null}
                  </span>
                </span>
                <Amount narrow value={x.amount} currency={x.currency} label={x.name || 'Betrag'} onChange={(v) => updateLine('costs', x.id, { amount: v })} onCurrency={(c) => updateLine('costs', x.id, { currency: c })} />
                <button type="button" className="x-btn" style={{ width: 26 }} aria-label="Fixkosten löschen" onClick={() => removeLine('costs', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
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
      <Sheet open={!!moveCost} title={moveCost ? `„${moveCost.name || 'Fixkosten'}“ einsortieren` : ''} onClose={() => setMoveCost(null)}>
        <div className="chips">{costCatsOf(b).map((c) => <button key={c.id} type="button" className={moveCost && catOf(moveCost.cat, b).id === c.id ? 'chip on' : 'chip'} onClick={() => { updateLine('costs', moveCost.id, { cat: c.id }); setMoveCost(null); }}>{c.label}</button>)}</div>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}
