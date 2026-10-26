import { useState } from 'react';
import { useStore } from '../lib/store';
import { addLine, budgetOf, calc, catOf, COST_CATS, convert, CURRENCIES, fetchRates, money, removeLine, setBudget, setRate, updateLine } from '../lib/budget';
import { Back, Icon, Segmented, TabBar, toast } from '../components/ui';

const GREEN = '#2FA36B';
const fmtRate = (v) => (v >= 100 ? Math.round(v).toLocaleString('de-DE') : (Math.round(v * 1000) / 1000).toLocaleString('de-DE'));
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function Amount({ value, currency, onChange, onCurrency, label }) {
  return (
    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <input className="input" style={{ width: 110, textAlign: 'right' }} inputMode="decimal" defaultValue={value || ''} key={value} placeholder="0" aria-label={label} onBlur={(e) => { const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')) || 0; if (v !== value) onChange(v); }} />
      <select className="input" style={{ width: 74, padding: '0 6px' }} value={currency} onChange={(e) => onCurrency(e.target.value)} aria-label={`${label} Währung`}>
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

        <section className="card countdown" style={{ gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <span className="tiny">Pro Tag im {MONTHS[now.getMonth()]} ({r.days} Tage)</span>
          <b style={{ fontSize: 34, color: r.free < 0 ? 'var(--danger)' : 'var(--text)' }}>{money(r.perDay, b.base)}</b>
          <span className="sub">≈ {money(convert(b, r.perDay, b.base, other), other)} · pro Woche {money(r.perWeek, b.base)}</span>
          <span className="tiny">Frei im Monat: {money(r.free, b.base)} = Einnahmen {money(r.income, b.base)} − Fixkosten {money(r.fixed, b.base)} − Sparen {money(r.save, b.base)}</span>
        </section>

        <section className="card" style={{ gap: 6 }}>
          <div className="sec-h" style={{ padding: 0 }}>
            <span className="label" style={{ padding: 0 }}>Wechselkurse</span>
            <button type="button" className="link-btn" onClick={loadRates} disabled={busy}>{busy ? '…' : 'Aktuell holen'}</button>
          </div>
          {[
            { id: 'usdars', left: '1 US$', right: 'ARS', value: b.rates.ARS, set: (v) => setRate('ARS', v) },
            { id: 'eurars', left: '1 €', right: 'ARS', value: b.rates.ARS / b.rates.EUR, set: (v) => setRate('EUR', b.rates.ARS / v) },
            { id: 'eurusd', left: '1 €', right: 'US$', value: 1 / b.rates.EUR, set: (v) => setRate('EUR', 1 / v) },
          ].map((x) => (
            <label key={x.id} className="row" style={{ minHeight: 46 }}>
              <span className="row-main"><span className="row-title plain">{x.left} =</span></span>
              <input className="input" style={{ width: 120, textAlign: 'right' }} inputMode="decimal" defaultValue={fmtRate(x.value)} key={fmtRate(x.value)} onBlur={(e) => { const v = Number(String(e.target.value).replace(/\./g, '').replace(',', '.')); if (v > 0 && fmtRate(v) !== fmtRate(x.value)) x.set(v); }} aria-label={`Kurs ${x.left} in ${x.right}`} />
              <b style={{ width: 40 }}>{x.right}</b>
            </label>
          ))}
          <span className="tiny">„Aktuell holen“ nimmt den offiziellen Kurs{b.ratesAt ? ` (zuletzt ${new Date(b.ratesAt).toLocaleDateString('de-DE')})` : ''}. Für den Blue-Kurs einfach die Peso-Werte selbst eintragen – die anderen passen sich an.</span>
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
              <div key={x.id} className="row" style={{ minHeight: 56 }}>
                <input className="input row-main" style={{ background: 'none', padding: 0 }} defaultValue={x.name} placeholder="z.B. Gehalt" onBlur={(e) => updateLine('incomes', x.id, { name: e.target.value })} aria-label="Name der Einnahme" />
                <Amount value={x.amount} currency={x.currency} label="Betrag" onChange={(v) => updateLine('incomes', x.id, { amount: v })} onCurrency={(c) => updateLine('incomes', x.id, { currency: c })} />
                <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeLine('incomes', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
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
          <div className="chips">{COST_CATS.map((c) => <button key={c.id} type="button" className={cat === c.id ? 'chip on' : 'chip soft'} onClick={() => setCat(c.id)}>{c.label}</button>)}</div>
          <button type="button" className="btn sec small" onClick={() => addLine('costs', { cat, name: catOf(cat).label })}>+ {catOf(cat).label} hinzufügen</button>
          <div className="list">
            {b.costs.length === 0 && <div className="empty">Wähl oben eine Kategorie und füg deine festen Kosten hinzu – jede in ihrer Währung (z.B. Miete in US$, Handy in ARS).</div>}
            {COST_CATS.flatMap((c) => b.costs.filter((x) => (x.cat || 'sonstiges') === c.id)).map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 56 }}>
                <span className="row-main" style={{ gap: 0 }}>
                  <input className="input" style={{ background: 'none', padding: 0, minHeight: 0, height: 24 }} defaultValue={x.name} placeholder={catOf(x.cat).label} onBlur={(e) => updateLine('costs', x.id, { name: e.target.value })} aria-label="Name der Fixkosten" />
                  <span className="tiny">{catOf(x.cat).label}{x.currency !== b.base && x.amount ? ` · ≈ ${money(convert(b, x.amount, x.currency), b.base)}` : ''}</span>
                </span>
                <Amount value={x.amount} currency={x.currency} label={x.name || 'Betrag'} onChange={(v) => updateLine('costs', x.id, { amount: v })} onCurrency={(c) => updateLine('costs', x.id, { currency: c })} />
                <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeLine('costs', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
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
      <TabBar active="bereiche" />
    </>
  );
}
