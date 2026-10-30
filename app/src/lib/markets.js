// v1.34 (Mateo): Kursdaten von Twelve Data (kostenloser Schlüssel, nur auf diesem Gerät gespeichert) für eigene Charts.
// Ohne Schlüssel oder bei Fehlern zeigt Finanzen das TradingView-Mini-Widget.
const KEY = 'life-app-td';
export const tdKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setTdKey = (k) => { try { if (k) localStorage.setItem(KEY, k.trim()); else localStorage.removeItem(KEY); } catch {} };

export const RANGES = [
  { id: '1d', label: '1T', interval: '5min', days: 4 },
  { id: '5d', label: '5T', interval: '30min', days: 8 },
  { id: '1mo', label: '1M', interval: '1day', days: 31 },
  { id: '3mo', label: '3M', interval: '1day', days: 92 },
  { id: '6mo', label: '6M', interval: '1day', days: 183 },
  { id: '1y', label: '1J', interval: '1day', days: 366 },
  { id: '5y', label: '5J', interval: '1week', days: 1827 },
];

// TradingView-Kürzel → Twelve-Data-Kürzel. Indizes gibt es im kostenlosen Plan nicht → passender ETF, der den Index abbildet.
export const TV2TD = {
  'FOREXCOM:NSXUSD': ['QQQ', 'ETF QQQ'], 'FOREXCOM:SPXUSD': ['SPY', 'ETF SPY'], 'FOREXCOM:DJI': ['DIA', 'ETF DIA'],
  'XETR:DAX': ['DAX', 'ETF DAX'], 'TVC:SX5E': ['FEZ', 'ETF FEZ'], 'TVC:UKX': ['EWU', 'ETF EWU'], 'TVC:NI225': ['EWJ', 'ETF EWJ'],
  'BCBA:IMV': ['ARGT', 'ETF ARGT'], 'AMEX:URTH': ['URTH', 'ETF URTH'],
  'FX:EURUSD': ['EUR/USD'], 'FX_IDC:USDARS': ['USD/ARS'], 'FX_IDC:EURARS': ['EUR/ARS'], 'FX:GBPUSD': ['GBP/USD'], 'FX:USDJPY': ['USD/JPY'], 'FX:USDCHF': ['USD/CHF'], 'FX_IDC:USDBRL': ['USD/BRL'],
  'BITSTAMP:BTCUSD': ['BTC/USD'], 'BITSTAMP:ETHUSD': ['ETH/USD'], 'COINBASE:SOLUSD': ['SOL/USD'],
  'TVC:GOLD': ['XAU/USD'], 'TVC:SILVER': ['XAG/USD'], 'TVC:USOIL': ['USO', 'ETF USO'], 'TVC:UKOIL': ['BNO', 'ETF BNO'], 'CAPITALCOM:NATURALGAS': ['UNG', 'ETF UNG'], 'CAPITALCOM:COPPER': ['CPER', 'ETF CPER'],
  'NYSE:BRK.B': ['BRK.B'], 'XETR:SAP': ['SAP', 'ADR in New York'], 'XETR:SIE': ['SIEGY', 'ADR'],
};
// Eigene Werte: „NASDAQ:AAPL“ → „AAPL“, „EURUSD“ → „EUR/USD“
export const tdOf = (t) => {
  if (t.td) return t.td;
  if (TV2TD[t.sym]) return TV2TD[t.sym][0];
  let x = String(t.sym || '').replace(/^\^/, '');
  if (/^[A-Z_]+:/.test(x)) x = x.split(':')[1];
  const CC = /^(USD|EUR|GBP|JPY|CHF|BRL|ARS|BTC|ETH|SOL|XAU|XAG)(USD|EUR|GBP|JPY|CHF|BRL|ARS)$/;
  if (CC.test(x)) x = `${x.slice(0, 3)}/${x.slice(3)}`;
  return x;
};
export const tdNote = (t) => (t.td ? '' : TV2TD[t.sym]?.[1] || '');

// Kostenloser Plan: 8 Abrufe pro Minute → Warteschlange mit Abstand; Ergebnisse zwischenspeichern
const memo = {};
const ttl = (r) => (r.interval.endsWith('min') ? 10 : 6 * 60) * 60 * 1000;
const read = (k, r) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && Date.now() - v.at < ttl(r) ? v.data : null; } catch { return null; } };
const write = (k, data) => { try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), data })); } catch {} };
const stamps = [];
let chain = Promise.resolve();
const slot = () => {
  const p = chain.then(async () => {
    for (;;) {
      const now = Date.now();
      while (stamps.length && now - stamps[0] > 61000) stamps.shift();
      if (stamps.length < 7) { stamps.push(now); return; }
      await new Promise((ok) => setTimeout(ok, 61000 - (now - stamps[0]) + 50));
    }
  });
  chain = p.catch(() => {});
  return p;
};
const ymd = (d) => d.toISOString().slice(0, 10);
const parseT = (s) => new Date(s.length <= 10 ? `${s}T12:00:00` : s.replace(' ', 'T')).getTime();

export async function fetchChart(t, rangeId) {
  const key = tdKey();
  if (!key) throw new Error('KEIN_SCHLUESSEL');
  const sym = tdOf(t);
  const r = RANGES.find((x) => x.id === rangeId) || RANGES[5];
  const ck = `life-td-${sym}-${r.id}`;
  const cached = memo[ck] || read(ck, r);
  if (cached) return cached;
  await slot();
  const start = ymd(new Date(Date.now() - r.days * 864e5));
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${r.interval}&start_date=${start}&outputsize=5000&order=asc&apikey=${encodeURIComponent(key)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  let j;
  try { j = await (await fetch(url, { signal: ctl.signal })).json(); } finally { clearTimeout(timer); }
  if (j?.status === 'error' || !Array.isArray(j?.values)) {
    const m = String(j?.message || 'Keine Daten');
    throw new Error(j?.code === 401 ? 'Schlüssel ungültig' : j?.code === 429 ? 'Zu viele Abrufe – gleich nochmal' : /plan|grow|pro|upgrade/i.test(m) ? 'Im kostenlosen Plan nicht enthalten' : /symbol/i.test(m) ? 'Kürzel nicht gefunden' : m.slice(0, 80));
  }
  let pts = j.values.map((v) => [parseT(v.datetime), Number(v.close)]).filter((p) => Number.isFinite(p[1]));
  if (r.id === '1d' && pts.length) {
    // nur der letzte Handelstag; Veränderung gegenüber dem Schluss des Vortags
    const lastDay = new Date(pts[pts.length - 1][0]).toDateString();
    const i0 = pts.findIndex((p) => new Date(p[0]).toDateString() === lastDay);
    const prevClose = i0 > 0 ? pts[i0 - 1][1] : pts[0][1];
    pts = pts.slice(Math.max(0, i0));
    if (pts.length < 2) throw new Error('Zu wenig Daten');
    const data = { pts, price: pts[pts.length - 1][1], prev: prevClose, cur: j.meta?.currency || '', sym };
    memo[ck] = data; write(ck, data); return data;
  }
  if (pts.length < 2) throw new Error('Zu wenig Daten');
  const data = { pts, price: pts[pts.length - 1][1], prev: pts[0][1], cur: j.meta?.currency || (sym.includes('/') ? sym.split('/')[1] : ''), sym };
  memo[ck] = data; write(ck, data);
  return data;
}

// Schlüssel prüfen (1 Abruf)
export async function testTdKey(k) {
  const j = await (await fetch(`https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=2&apikey=${encodeURIComponent(k.trim())}`)).json();
  if (j?.status === 'error') throw new Error(j?.code === 401 ? 'Schlüssel ungültig' : j.message || 'Fehler');
  return true;
}
