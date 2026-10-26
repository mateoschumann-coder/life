// Zeitrechner fürs Laufen: zwei von drei Werten eingeben (Distanz, Zeit, Pace) → der dritte wird berechnet.
// Dazu Prognosen für andere Distanzen (Riegel-Formel) und Zwischenzeiten.
import { useState } from 'react';
import { fmtDuration, parseDuration } from '../lib/health';
import { Segmented } from './ui';

const DISTS = [{ id: '5', label: '5 km', km: 5 }, { id: '10', label: '10 km', km: 10 }, { id: '21.0975', label: 'Halb', km: 21.0975 }, { id: '42.195', label: 'Marathon', km: 42.195 }];

export default function PaceCalc() {
  const [km, setKm] = useState('42.195');
  const [time, setTime] = useState('');
  const [pace, setPace] = useState('');
  const [last, setLast] = useState('time'); // welcher Wert zuletzt eingegeben wurde
  const d = parseFloat(String(km).replace(',', '.'));
  const tMin = parseDuration(time);
  const pMin = parseDuration(pace);
  let resTime = tMin;
  let resPace = pMin;
  if (d > 0 && last === 'time' && tMin) resPace = tMin / d;
  if (d > 0 && last === 'pace' && pMin) resTime = pMin * d;
  const ok = d > 0 && resTime && resPace;
  const predict = (target) => resTime * (target / d) ** 1.06;
  const splits = ok ? [5, 10, 15, 20, 21.0975, 25, 30, 35, 40].filter((k) => k < d).map((k) => ({ k, t: resPace * k })) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Segmented full options={DISTS.map((x) => ({ id: x.id, label: x.label }))} value={DISTS.some((x) => x.id === km) ? km : ''} onChange={setKm} label="Distanz" />
      <div className="calc-grid">
        <label className="field"><span>Distanz (km)</span><input className="input" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></label>
        <label className="field"><span>Zielzeit</span><input className="input" value={last === 'pace' && ok ? fmtDuration(resTime) : time} onChange={(e) => { setTime(e.target.value); setLast('time'); }} placeholder="3:20:00" inputMode="numeric" /></label>
        <label className="field"><span>Pace (/km)</span><input className="input" value={last === 'time' && ok ? fmtDuration(resPace) : pace} onChange={(e) => { setPace(e.target.value); setLast('pace'); }} placeholder="4:44" inputMode="numeric" /></label>
      </div>
      {ok && (
        <>
          <div className="calc-result">
            <div><span className="tiny">Zeit</span><b>{fmtDuration(resTime)}</b></div>
            <div><span className="tiny">Pace</span><b>{fmtDuration(resPace)} /km</b></div>
            <div><span className="tiny">Tempo</span><b>{(60 / resPace).toFixed(1).replace('.', ',')} km/h</b></div>
          </div>
          <span className="label" style={{ padding: 0 }}>Damit möglich auf anderen Distanzen (Schätzung)</span>
          <div className="calc-result">
            {DISTS.filter((x) => Math.abs(x.km - d) > 0.01).map((x) => (
              <div key={x.id}><span className="tiny">{x.label}</span><b>{fmtDuration(predict(x.km))}</b></div>
            ))}
          </div>
          {splits.length > 0 && (
            <>
              <span className="label" style={{ padding: 0 }}>Zwischenzeiten bei gleichmäßigem Tempo</span>
              <div className="chips">
                {splits.map((x) => <span key={x.k} className="tag" style={{ fontSize: 13 }}>{x.k === 21.0975 ? 'HM' : `${x.k} km`}: {fmtDuration(x.t)}</span>)}
              </div>
            </>
          )}
        </>
      )}
      {!ok && <span className="tiny">Gib Zielzeit oder Pace ein, z.B. 3:20:00 oder 4:44.</span>}
    </div>
  );
}
