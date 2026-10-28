// v1.05: Kursdaten von Yahoo Finance für eigene, schlichte Charts (direkt; falls der Browser es blockiert über einen öffentlichen Umweg)
export const RANGES = [
  { id: '1d', label: '1T', interval: '5m' },
  { id: '5d', label: '5T', interval: '30m' },
  { id: '1mo', label: '1M', interval: '1d' },
  { id: '3mo', label: '3M', interval: '1d' },
  { id: '6mo', label: '6M', interval: '1d' },
  { id: '1y', label: '1J', interval: '1d' },
  { id: '5y', label: '5J', interval: '1wk' },
];
// TradingView-Kürzel (alte Einträge) → Yahoo-Kürzel
export const TV2Y = {
  'FOREXCOM:NSXUSD': '^NDX', 'FOREXCOM:SPXUSD': '^GSPC', 'FOREXCOM:DJI': '^DJI', 'XETR:DAX': '^GDAXI', 'TVC:SX5E': '^STOXX50E', 'TVC:UKX': '^FTSE', 'TVC:NI225': '^N225', 'BCBA:IMV': '^MERV', 'AMEX:URTH': 'URTH',
  'FX:EURUSD': 'EURUSD=X', 'FX_IDC:USDARS': 'ARS=X', 'FX_IDC:EURARS': 'EURARS=X', 'FX:GBPUSD': 'GBPUSD=X', 'FX:USDJPY': 'JPY=X', 'FX:USDCHF': 'CHF=X', 'FX_IDC:USDBRL': 'BRL=X',
  'BITSTAMP:BTCUSD': 'BTC-USD', 'BITSTAMP:ETHUSD': 'ETH-USD', 'COINBASE:SOLUSD': 'SOL-USD',
  'TVC:GOLD': 'GC=F', 'TVC:SILVER': 'SI=F', 'TVC:USOIL': 'CL=F', 'TVC:UKOIL': 'BZ=F', 'CAPITALCOM:NATURALGAS': 'NG=F', 'CAPITALCOM:COPPER': 'HG=F',
  'NYSE:BRK.B': 'BRK-B', 'XETR:SAP': 'SAP.DE', 'XETR:SIE': 'SIE.DE',
};
export const yOf = (t) => t.y || TV2Y[t.sym] || (/^[A-Z]+:/.test(t.sym || '') ? t.sym.split(':')[1].replace('.', '-') : t.sym);

const URL_OF = (y, r) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=${r.id}&interval=${r.interval}&includePrePost=false`;
const ROUTES = [
  (u) => u,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];
const memo = {};
let good = 0; // zuletzt funktionierender Weg zuerst
const read = (k) => { try { const v = JSON.parse(sessionStorage.getItem(k) || 'null'); return v && Date.now() - v.at < 10 * 60 * 1000 ? v.data : null; } catch { return null; } };
const write = (k, data) => { try { sessionStorage.setItem(k, JSON.stringify({ at: Date.now(), data })); } catch {} };

export async function fetchChart(y, rangeId) {
  const r = RANGES.find((x) => x.id === rangeId) || RANGES[5];
  const key = `life-mk-${y}-${r.id}`;
  const cached = memo[key] || read(key);
  if (cached) return cached;
  const order = [good, ...ROUTES.map((_, i) => i).filter((i) => i !== good)];
  let lastErr;
  for (const i of order) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(ROUTES[i](URL_OF(y, r)), { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const q = j?.chart?.result?.[0];
      if (!q) throw new Error(j?.chart?.error?.description || 'Keine Daten');
      const ts = q.timestamp || [];
      const cl = q.indicators?.quote?.[0]?.close || [];
      const pts = ts.map((t, k) => [t * 1000, cl[k]]).filter((p) => p[1] != null);
      if (pts.length < 2) throw new Error('Zu wenig Daten');
      const m = q.meta || {};
      const data = { pts, price: m.regularMarketPrice ?? pts[pts.length - 1][1], prev: r.id === '1d' ? (m.chartPreviousClose ?? m.previousClose ?? pts[0][1]) : pts[0][1], cur: m.currency || '', name: m.shortName || m.longName || '' };
      good = i;
      memo[key] = data;
      write(key, data);
      return data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Keine Daten');
}
