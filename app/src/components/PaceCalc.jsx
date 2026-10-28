// Zeitrechner (v0.34, Mateo: meist kurze Distanzen): Distanz + Zeit ODER Pace → der Rest wird berechnet.
// Schnellwahl 200–1000 m, sonst Meter frei eingeben. Dazu Durchgangszeiten und Schätzung für die anderen Distanzen.
import { useState } from 'react';
import { Info } from './ui';

const QUICK = [200, 400, 600, 800, 1000];

// "75" → 75 s · "1:15" → 75 s · "1:02:30" → 3750 s (Komma als Dezimal erlaubt: "58,5")
export function parseSec(v) {
  const s = String(v || '').trim().replace(',', '.');
  if (!s) return 0;
  const p = s.split(':').map(Number);
  if (p.some((x) => Number.isNaN(x))) return 0;
  if (p.length === 1) return p[0];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] * 3600 + p[1] * 60 + p[2];
}
// v0.90 (Mateo: auf dem iPhone gibt es keinen Doppelpunkt): Ziffern werden automatisch formatiert
// Zeit: 75 → 75 s · 115 → 1:15 · 1230 → 12:30 · 13000 → 1:30:00 · Pace: 4 → 4 Min · 43 → 4:3 · 345 → 3:45 · 1030 → 10:30
export function autoColon(v, kind = 'time') {
  const raw = String(v || '');
  // v0.98: Komma/Punkt (gibt es auf der iPhone-Zahlentastatur) wird zum Doppelpunkt: „1,15“ → „1:15“
  if (/[.,:]/.test(raw)) return raw.replace(/[.,]/g, ':').replace(/[^\d:]/g, '').replace(/:{2,}/g, ':').replace(/^:/, '');
  const d = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 6);
  if (kind === 'pace') {
    if (d.length <= 1) return d;
    if (d.length === 2) return `${d[0]}:${d[1]}`;
    if (d.length === 3) return `${d[0]}:${d.slice(1)}`;
    return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
  }
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}
export function fmtSec(sec) {
  if (!sec || !Number.isFinite(sec)) return '';
  const tot = sec < 600 ? Math.round(sec * 10) / 10 : Math.round(sec);
  const h = Math.floor(tot / 3600);
  const m = Math.floor((tot % 3600) / 60);
  const r = Math.round((tot - h * 3600 - m * 60) * 10) / 10;
  const ss = (r < 10 ? '0' : '') + String(r).replace('.', ',');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
const label = (m) => (m >= 1000 && m % 1000 === 0 ? `${m / 1000} km` : `${m} m`);

export default function PaceCalc() {
  const [meters, setMeters] = useState('400');
  const [time, setTime] = useState('');
  const [pace, setPace] = useState('');
  const [last, setLast] = useState('time');
  const m = parseFloat(String(meters).replace(',', '.'));
  const t = parseSec(time);
  const p = /:/.test(pace) || parseSec(pace) >= 30 ? parseSec(pace) : parseSec(pace) * 60; // Sekunden pro km; „4“ = 4 Min
  let resT = t;
  let resP = p;
  if (m > 0 && last === 'time' && t) resP = (t / m) * 1000;
  if (m > 0 && last === 'pace' && p) resT = (p * m) / 1000;
  const ok = m > 0 && resT > 0 && resP > 0;
  const step = m <= 1000 ? 100 : m <= 5000 ? 400 : 1000;
  const splits = ok ? Array.from({ length: Math.floor((m - 1) / step) }, (_, i) => (i + 1) * step).map((x) => ({ x, t: (resP * x) / 1000 })) : [];
  const others = [...QUICK, 1500, 3000, 5000, 10000].filter((x) => Math.abs(x - m) > 1);
  const predict = (x) => resT * (x / m) ** 1.06;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="chips">
        {QUICK.map((x) => <button key={x} type="button" className={Number(meters) === x ? 'chip on' : 'chip soft'} style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => setMeters(String(x))}>{label(x)}</button>)}
      </div>
      <div className="calc-grid">
        <label className="field"><span>Distanz (m)</span><input className="input" inputMode="decimal" value={meters} onChange={(e) => setMeters(e.target.value)} aria-label="Distanz in Metern" /></label>
        <label className="field"><span>Zeit</span><input className="input" value={last === 'pace' && ok ? fmtSec(resT) : time} onFocus={() => { if (last === 'pace') { setTime(''); setLast('time'); } }} onChange={(e) => { setTime(autoColon(e.target.value, 'time')); setLast('time'); }} placeholder="z.B. 1:15" inputMode="decimal" aria-label="Zeit" /></label>
        <label className="field"><span>Pace (/km)</span><input className="input" value={last === 'time' && ok ? fmtSec(resP) : pace} onFocus={() => { if (last === 'time') { setPace(''); setLast('pace'); } }} onChange={(e) => { setPace(autoColon(e.target.value, 'pace')); setLast('pace'); }} placeholder="z.B. 3:45" inputMode="decimal" aria-label="Pace pro km" /></label>
      </div>
      {ok && (
        <>
          <div className="calc-result">
            <div><span className="tiny">Zeit</span><b>{fmtSec(resT)}</b></div>
            <div><span className="tiny">Pace</span><b>{fmtSec(resP)} /km</b></div>
            <div><span className="tiny">Tempo</span><b>{(3600 / resP).toFixed(1).replace('.', ',')} km/h</b></div>
          </div>
          {splits.length > 0 && (
            <>
              <span className="label" style={{ padding: 0 }}>Durchgangszeiten bei gleichem Tempo</span>
              <div className="chips">{splits.map((x) => <span key={x.x} className="tag" style={{ fontSize: 13 }}>{label(x.x)}: {fmtSec(x.t)}</span>)}</div>
            </>
          )}
          <span className="label" style={{ padding: 0 }}>Gleiches Niveau auf anderen Distanzen (Schätzung)</span>
          <div className="chips">{others.map((x) => <span key={x} className="tag" style={{ fontSize: 13 }}>{label(x)}: {fmtSec(predict(x))}</span>)}</div>
        </>
      )}
      {!ok && <Info>Einfach nur Ziffern tippen, der Doppelpunkt kommt automatisch: Zeit „115“ = 1:15, „75“ = 75 Sekunden · Pace „345“ = 3:45 pro km, „4“ = 4:00.</Info>}
    </div>
  );
}
