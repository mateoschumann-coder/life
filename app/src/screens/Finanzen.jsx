import { useEffect, useRef, useState } from 'react';
import { fetchChart, RANGES as MRANGES, yOf } from '../lib/markets';
import { store } from '../lib/store';
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

function Alltag({ s }) {
  const b = budgetOf(s);
  const r = calc(b);
  const [cat, setCat] = useState('miete');
  const [newCat, setNewCat] = useState(null);
  const [editCats, setEditCats] = useState(false);
  const [line, setLine] = useState(null);
  const other = b.base === 'USD' ? 'EUR' : 'USD';
  const now = new Date();
  const max = Math.max(1, ...r.byCat.map((c) => c.sum));
  const next = [0, 1, 2].map((i) => new Date(now.getFullYear(), now.getMonth() + i, 1));

  return (
    <>
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
      <LineSheet b={b} line={line} onClose={() => setLine(null)} />
    </>
  );
}

function RatesCard({ s }) {
  const b = budgetOf(s);
  const [busy, setBusy] = useState(false);
  const loadRates = async () => {
    setBusy(true);
    try { await fetchRates(); toast('Kurse aktualisiert'); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  return (
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

  );
}

// v1.03: Börsen-Indizes als kostenlose TradingView-Mini-Charts (kein Schlüssel nötig); Liste bearbeitbar
const DEFAULT_TICKERS = [
  { sym: 'FOREXCOM:NSXUSD', label: 'NASDAQ 100' },
  { sym: 'FOREXCOM:SPXUSD', label: 'S&P 500' },
  { sym: 'XETR:DAX', label: 'DAX' },
  { sym: 'TVC:SX5E', label: 'Euro Stoxx 50' },
  { sym: 'NYSE:BRK.B', label: 'Berkshire Hathaway' },
];
const tickersOf = (s) => s.profile?.tickers || DEFAULT_TICKERS;
const setTickers = (list) => store.update((x) => { x.profile = { ...(x.profile || {}), tickers: list }; });
// v1.04: Katalog zum schnellen Hinzufügen (Indizes, Währungen, Aktien, Krypto, Rohstoffe)
const CATALOG = [
  { g: '📈 Indizes', items: [['FOREXCOM:NSXUSD', 'NASDAQ 100'], ['FOREXCOM:SPXUSD', 'S&P 500'], ['FOREXCOM:DJI', 'Dow Jones'], ['XETR:DAX', 'DAX'], ['TVC:SX5E', 'Euro Stoxx 50'], ['TVC:UKX', 'FTSE 100'], ['TVC:NI225', 'Nikkei 225'], ['BCBA:IMV', 'Merval'], ['AMEX:URTH', 'MSCI World (ETF)']] },
  { g: '💱 Währungen', items: [['FX:EURUSD', 'Euro / US$'], ['FX_IDC:USDARS', 'US$ / Peso (offiziell)'], ['FX_IDC:EURARS', 'Euro / Peso'], ['FX:GBPUSD', 'Pfund / US$'], ['FX:USDJPY', 'US$ / Yen'], ['FX:USDCHF', 'US$ / Franken'], ['FX_IDC:USDBRL', 'US$ / Real']] },
  { g: '🏢 Aktien', items: [['NASDAQ:AAPL', 'Apple'], ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:NVDA', 'Nvidia'], ['NASDAQ:AMZN', 'Amazon'], ['NASDAQ:GOOGL', 'Alphabet'], ['NASDAQ:META', 'Meta'], ['NASDAQ:TSLA', 'Tesla'], ['NASDAQ:MELI', 'Mercado Libre'], ['NYSE:YPF', 'YPF'], ['NASDAQ:GGAL', 'Grupo Galicia'], ['XETR:SAP', 'SAP'], ['XETR:SIE', 'Siemens'], ['NYSE:BRK.B', 'Berkshire Hathaway']] },
  { g: '🪙 Krypto', items: [['BITSTAMP:BTCUSD', 'Bitcoin'], ['BITSTAMP:ETHUSD', 'Ethereum'], ['COINBASE:SOLUSD', 'Solana']] },
  { g: '🛢 Rohstoffe', items: [['TVC:GOLD', 'Gold'], ['TVC:SILVER', 'Silber'], ['TVC:USOIL', 'Öl (WTI)'], ['TVC:UKOIL', 'Öl (Brent)'], ['CAPITALCOM:NATURALGAS', 'Erdgas'], ['CAPITALCOM:COPPER', 'Kupfer']] },
];
// v1.05: eigener Chart (Yahoo-Daten): Name oben links, Kurs + Veränderung, Linie mit Fläche, Finger drüber = Wert, Zeitraum darunter
const fmtNum = (v) => { const a = Math.abs(v); return v.toLocaleString('de-DE', { minimumFractionDigits: a < 10 ? 3 : 2, maximumFractionDigits: a < 10 ? 4 : 2 }); };
const fmtWhen = (t, r) => { const d = new Date(t); if (r === '1d') return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); if (r === '5d') return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); if (r === '5y') return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }); return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', ...(r === '1y' ? { year: '2-digit' } : {}) }); };
const CUR = { USD: '$', EUR: '€', ARS: 'ARS', GBP: '£', JPY: '¥' };
const RKEY = 'life-app-fin-range2';
function MiniTV({ t }) {
  const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const cfg = { symbol: t.sym, width: '100%', height: 170, locale: 'de_DE', dateRange: '12M', colorTheme: dark ? 'dark' : 'light', isTransparent: true, autosize: true };
  return <iframe title={t.label} src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=de_DE#${encodeURIComponent(JSON.stringify(cfg))}`} style={{ width: '100%', height: 170, border: 0, display: 'block' }} loading="lazy" />;
}
function Ticker({ t }) {
  const [range, setRangeS] = useState(() => { try { return localStorage.getItem(RKEY) || '1y'; } catch { return '1y'; } });
  const setRange = (r) => { setRangeS(r); try { localStorage.setItem(RKEY, r); } catch {} };
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const y = yOf(t);
  useEffect(() => {
    let alive = true;
    setErr(null);
    fetchChart(y, range).then((d) => alive && setData(d)).catch((e) => alive && setErr(e.message || 'Fehler'));
    return () => { alive = false; };
  }, [y, range]);
  const W = 320, H = 130, P = 4;
  let path = '', area = '', last = null, sx = null, sy = null, minV = 0, maxV = 0;
  if (data) {
    const vs = data.pts.map((p) => p[1]);
    minV = Math.min(...vs); maxV = Math.max(...vs);
    const span = maxV - minV || 1;
    sx = (i) => P + (i / (data.pts.length - 1)) * (W - 2 * P);
    sy = (v) => P + (1 - (v - minV) / span) * (H - 2 * P);
    path = data.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
    area = `${path}L${sx(data.pts.length - 1).toFixed(1)},${H}L${sx(0).toFixed(1)},${H}Z`;
    last = data.pts[data.pts.length - 1];
  }
  const shown = hover != null && data ? data.pts[hover] : null;
  const price = shown ? shown[1] : data?.price;
  const base = data?.prev;
  const ch = data && base ? price - base : 0;
  const pct = data && base ? (ch / base) * 100 : 0;
  const up = ch >= 0;
  const col = up ? '#1F9D55' : '#D64545';
  const move = (e) => {
    if (!data || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const i = Math.round(((cx / rect.width) * W - P) / (W - 2 * P) * (data.pts.length - 1));
    setHover(Math.max(0, Math.min(data.pts.length - 1, i)));
  };
  const gid = `g${y.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <div className="card mk-card">
      <div className="mk-head">
        <b className="mk-title">{t.label}</b>
        {data && <span className="mk-price">{fmtNum(price)} <small>{CUR[data.cur] || data.cur}</small></span>}
        {data && <span className="mk-ch" style={{ color: col }}>{up ? '▲' : '▼'} {fmtNum(Math.abs(ch))} ({up ? '+' : '−'}{Math.abs(pct).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %)<span className="mk-when"> · {shown ? fmtWhen(shown[0], range) : MRANGES.find((r) => r.id === range)?.label}</span></span>}
      </div>
      {err && !data ? (
        <><MiniTV t={t} /><span className="tiny">Eigener Chart gerade nicht verfügbar ({err}) – Ersatz von TradingView.</span></>
      ) : !data ? (
        <div className="mk-load">Lädt …</div>
      ) : (
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mk-svg" onMouseMove={move} onMouseLeave={() => setHover(null)} onTouchStart={move} onTouchMove={move} onTouchEnd={() => setHover(null)}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.22" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
          {range === '1d' && base >= minV && base <= maxV && <line x1={P} x2={W - P} y1={sy(base)} y2={sy(base)} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.6" />}
          <path d={area} fill={`url(#${gid})`} />
          <path d={path} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {shown && <line x1={sx(hover)} x2={sx(hover)} y1={0} y2={H} stroke="var(--muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          {(shown || last) && <circle cx={sx(shown ? hover : data.pts.length - 1)} cy={sy((shown || last)[1])} r="3.5" fill={col} stroke="var(--card)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        </svg>
      )}
      {data && <div className="mk-axis"><span>{fmtWhen(data.pts[0][0], range)}</span><span>Hoch {fmtNum(maxV)} · Tief {fmtNum(minV)}</span><span>{fmtWhen(last[0], range)}</span></div>}
      {!(err && !data) && <div className="mk-ranges">{MRANGES.map((r) => <button key={r.id} type="button" className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>)}</div>}
    </div>
  );
}
function AddAsset({ open, list, onClose }) {
  const [sym, setSym] = useState('');
  const [label, setLabel] = useState('');
  const has = (sy) => list.some((x) => x.sym === sy);
  const toggle = (sy, l) => setTickers(has(sy) ? list.filter((x) => x.sym !== sy) : [...list, { sym: sy, label: l }]);
  return (
    <Sheet open={open} title="Werte hinzufügen" onClose={onClose}>
      <span className="tiny">Antippen = hinzufügen, nochmal = entfernen.</span>
      {CATALOG.map((c) => (
        <section key={c.g} className="group" style={{ gap: 6 }}>
          <h2 className="label" style={{ padding: '0 2px' }}>{c.g}</h2>
          <div className="chips">{c.items.map(([sy, l]) => <button key={sy} type="button" className={has(sy) ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => toggle(sy, l)}>{has(sy) ? '✓ ' : '＋ '}{l}</button>)}</div>
        </section>
      ))}
      <section className="card" style={{ gap: 8 }}>
        <b style={{ fontSize: 15 }}>Eigener Wert</b>
        <form style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onSubmit={(e) => { e.preventDefault(); const sy = sym.trim().toUpperCase(); if (!sy) return; setTickers([...list.filter((x) => x.sym !== sy), { sym: sy, y: sy, label: label.trim() || sy }]); setSym(''); setLabel(''); toast('Hinzugefügt'); }}>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, z.B. Coca-Cola" aria-label="Name" />
          <div className="block-add"><input className="input" value={sym} onChange={(e) => setSym(e.target.value)} placeholder="Yahoo-Kürzel, z.B. KO oder ^GDAXI" aria-label="Kürzel" /><button type="submit" className="btn small" disabled={!sym.trim()}>+</button></div>
        </form>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a className="link-btn" style={{ fontSize: 13 }} href="https://finance.yahoo.com/lookup" target="_blank" rel="noreferrer">Kürzel finden ↗</a>
          <Info>Auf Yahoo Finance einen Wert suchen – das Kürzel steht neben dem Namen, z.B. „AAPL“ (Apple), „SAP.DE“, „^GDAXI“ (DAX) oder „EURUSD=X“ (Euro/Dollar).</Info>
        </div>
      </section>
    </Sheet>
  );
}
function Markets({ s }) {
  const list = tickersOf(s);
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const move = (i, d) => { const l = [...list]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setTickers(l); };
  return (
    <section className="group">
      <div className="sec-h">
        <h2 className="h2" style={{ fontSize: 19 }}>Märkte</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="chip soft small-chip" onClick={() => setAdd(true)}>＋ Wert</button>
          <button type="button" className={edit ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : '✎'}</button>
        </div>
      </div>
      {edit && (
        <div className="list">
          {list.map((t, i) => (
            <div key={t.sym} className="row compact">
              <span className="row-main"><span className="row-title plain">{t.label}</span><span className="row-meta">{t.sym}</span></span>
              <button type="button" className="x-btn" aria-label="nach oben" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="x-btn" aria-label="nach unten" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="x-btn" aria-label={`${t.label} entfernen`} onClick={() => setTickers(list.filter((x) => x.sym !== t.sym))}><Icon name="x" size={12} color="var(--chev)" /></button>
            </div>
          ))}
          <button type="button" className="link-btn" style={{ fontSize: 13, padding: 10 }} onClick={() => setTickers(DEFAULT_TICKERS)}>Auf Standard zurücksetzen</button>
        </div>
      )}
      {!edit && list.map((t) => <Ticker key={t.sym} t={t} />)}
      {!list.length && <div className="empty">Noch keine Werte – tipp auf „＋ Wert“.</div>}
      <span className="tiny" style={{ padding: '0 4px' }}>Finger über den Chart ziehen = Wert an dem Tag. Kurse von Yahoo Finance, teils verzögert.</span>
      <AddAsset open={add} list={list} onClose={() => setAdd(false)} />
    </section>
  );
}

// v1.03: Rentenrechner (Rentenformel): benötigtes Kapital, mögliche Rente oder Sparplan – mit Zins, Inflation, Zahlung am Anfang/Ende
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
export function annuity({ mode, amount, capital, years, rate, inflation, due, monthly, dyn }) {
  const m = monthly ? 12 : 1;
  const N = Math.max(1, Math.round(years * m));
  const r = Math.pow(1 + rate / 100, 1 / m) - 1;
  const g = dyn ? Math.pow(1 + inflation / 100, 1 / m) - 1 : 0;
  const d = due ? 1 + r : 1;
  const af = (Math.abs(r - g) < 1e-12 ? N / (1 + r) : (1 - Math.pow((1 + g) / (1 + r), N)) / (r - g)) * d;
  const ff = (Math.abs(r - g) < 1e-12 ? N * Math.pow(1 + r, N - 1) : (Math.pow(1 + r, N) - Math.pow(1 + g, N)) / (r - g)) * d;
  const real = Math.pow(1 + inflation / 100, years);
  const sumPay = (R) => (g ? R * (Math.pow(1 + g, N) - 1) / g : R * N);
  if (mode === 'kapital') return { value: amount * af, first: amount, last: amount * Math.pow(1 + g, N - 1), paid: sumPay(amount), N };
  if (mode === 'rente') { const R = af ? capital / af : 0; return { value: R, first: R, last: R * Math.pow(1 + g, N - 1), paid: sumPay(R), N }; }
  const fv = capital * Math.pow(1 + r, N) + amount * ff;
  const paid = capital + sumPay(amount);
  return { value: fv, real: fv / real, paid, interest: fv - paid, N };
}
const RMODES = [
  { id: 'kapital', label: 'Kapital nötig' },
  { id: 'rente', label: 'Mögliche Rente' },
  { id: 'sparen', label: 'Sparplan' },
];
function RenteRechner({ s }) {
  const b = budgetOf(s);
  const [f, setFState] = useState(() => { try { return { mode: 'kapital', amount: '1.000', capital: '200.000', years: '25', rate: '5', inflation: '2', due: true, monthly: true, dyn: true, ...JSON.parse(localStorage.getItem('life-app-rente') || '{}') }; } catch { return { mode: 'kapital', amount: '1.000', capital: '200.000', years: '25', rate: '5', inflation: '2', due: true, monthly: true, dyn: true }; } });
  const setF = (p) => { const n = { ...f, ...p }; setFState(n); try { localStorage.setItem('life-app-rente', JSON.stringify(n)); } catch {} };
  const res = annuity({ mode: f.mode, amount: num(f.amount), capital: num(f.capital), years: num(f.years), rate: Number(String(f.rate).replace(',', '.')) || 0, inflation: Number(String(f.inflation).replace(',', '.')) || 0, due: f.due, monthly: f.monthly, dyn: f.dyn });
  const per = f.monthly ? 'Monat' : 'Jahr';
  const M = (x) => money(x, b.base);
  const field = (k, label, ph, suffix) => (
    <label className="rate-cell"><span className="tiny">{label}</span><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input className="input" inputMode="decimal" value={f[k]} onChange={(e) => setF({ [k]: e.target.value })} placeholder={ph} style={{ textAlign: 'right' }} />{suffix && <span className="tiny">{suffix}</span>}</span></label>
  );
  return (
    <>
      <Segmented full options={RMODES} value={f.mode} onChange={(v) => setF({ mode: v })} label="Was berechnen?" />
      <section className="card" style={{ gap: 10 }}>
        <span className="tiny">{f.mode === 'kapital' ? 'Wie viel Geld brauche ich, um eine bestimmte Rente zu bekommen?' : f.mode === 'rente' ? 'Wie viel Rente kann ich mir aus meinem Geld auszahlen?' : 'Was wird aus regelmäßigem Sparen?'}</span>
        <div className="rate-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {f.mode !== 'rente' && field('amount', f.mode === 'sparen' ? `Sparrate pro ${per}` : `Rente pro ${per}`, '1.000', b.base)}
          {f.mode !== 'kapital' && field('capital', f.mode === 'sparen' ? 'Startkapital' : 'Vorhandenes Kapital', '0', b.base)}
          {field('years', 'Laufzeit', '25', 'Jahre')}
          {field('rate', 'Zins pro Jahr', '5', '%')}
          {field('inflation', 'Inflation pro Jahr', '2', '%')}
        </div>
        <div className="field"><span>Zahlung</span><div className="chips">
          <button type="button" className={f.due ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setF({ due: true })}>Am Anfang (vorschüssig)</button>
          <button type="button" className={!f.due ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setF({ due: false })}>Am Ende (nachschüssig)</button>
        </div></div>
        <div className="field"><span>Wie oft?</span><div className="chips">
          <button type="button" className={f.monthly ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setF({ monthly: true })}>Monatlich</button>
          <button type="button" className={!f.monthly ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setF({ monthly: false })}>Jährlich</button>
        </div></div>
        <div className="field"><span>{f.mode === 'sparen' ? 'Sparrate steigt mit der Inflation?' : 'Rente steigt mit der Inflation?'}</span><div className="chips">
          <button type="button" className={f.dyn ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setF({ dyn: true })}>Ja</button>
          <button type="button" className={!f.dyn ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setF({ dyn: false })}>Nein, fester Betrag</button>
        </div></div>
      </section>
      <section className="card countdown" style={{ gap: 6, alignItems: 'center', textAlign: 'center' }}>
        <span className="tiny">{f.mode === 'kapital' ? 'Dafür brauchst du heute' : f.mode === 'rente' ? `Mögliche Rente pro ${per}` : `Nach ${num(f.years)} Jahren hast du`}</span>
        <b style={{ fontSize: 32 }}>{M(res.value)}</b>
        {f.mode === 'sparen' ? (
          <span className="sub">In heutiger Kaufkraft ≈ {M(res.real)} · eingezahlt {M(res.paid)} · Zinsen {M(res.interest)}</span>
        ) : (
          <span className="sub">{res.N} Zahlungen · erste {M(res.first)}{f.dyn ? ` · letzte ${M(res.last)}` : ''} · ausgezahlt gesamt {M(res.paid)}</span>
        )}
        <Info>Rentenformel (Rentenbarwert{f.mode === 'sparen' ? ' bzw. -endwert' : ''}): Zins pro {per} aus dem Jahreszins, {f.dyn ? 'Zahlungen wachsen jedes Mal mit der Inflation (dynamische Rente)' : 'gleich bleibende Zahlungen'}, {f.due ? 'Zahlung jeweils am Anfang der Periode' : 'Zahlung jeweils am Ende der Periode'}. Steuern und Gebühren sind nicht eingerechnet.</Info>
      </section>
    </>
  );
}

const FTABS = [{ id: 'infos', label: '📊 Finanzinfos' }, { id: 'rechner', label: '🧮 Rechner' }];
export default function Finanzen() {
  const s = useStore();
  const [tab, setTabState] = useState(() => { try { return localStorage.getItem('life-app-fin-tab') || 'infos'; } catch { return 'infos'; } });
  const setTab = (v) => { setTabState(v); try { localStorage.setItem('life-app-fin-tab', v); } catch {} };
  const [calcTab, setCalcState] = useState(() => { try { return localStorage.getItem('life-app-fin-calc') || 'alltag'; } catch { return 'alltag'; } });
  const setCalc = (v) => { setCalcState(v); try { localStorage.setItem('life-app-fin-calc', v); } catch {} };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereiche" label="Bereiche" />
          <h1 className="h1">Finanzen</h1>
        </div>
        <Segmented full options={FTABS} value={tab} onChange={setTab} label="Ansicht" />
        {tab === 'infos' ? (
          <>
            <RatesCard s={s} />
            <Markets s={s} />
          </>
        ) : (
          <>
            <div className="sub-switch" style={{ alignSelf: 'flex-start' }}>
              <button type="button" className={calcTab === 'alltag' ? 'on' : ''} onClick={() => setCalc('alltag')}>Alltagsrechner</button>
              <button type="button" className={calcTab === 'rente' ? 'on' : ''} onClick={() => setCalc('rente')}>Rentenrechner</button>
            </div>
            {calcTab === 'rente' ? <RenteRechner s={s} /> : <Alltag s={s} />}
          </>
        )}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
