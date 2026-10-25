// Kleiner Linien-Graph ohne Zusatzbibliothek
import { fmtShort } from '../lib/dates';

export default function MiniChart({ entries, goal, color = 'var(--accent)', unit = '' }) {
  const pts = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-20);
  if (pts.length === 0) return <div className="empty" style={{ padding: '8px 0' }}>Noch keine Werte. Trag unten den ersten ein.</div>;
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const vals = pts.map((p) => p.value);
  const max = Math.max(...vals, goal || 0) * 1.1 || 1;
  const min = Math.min(0, ...vals);
  const x = (i) => pad.l + (pts.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (pts.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Verlauf, letzter Wert ${vals.at(-1)} ${unit}`}>
      {[0, 0.5, 1].map((f) => {
        const v = min + f * (max - min);
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(v)}</text>
          </g>
        );
      })}
      {goal ? <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="#F5B225" strokeWidth="1.5" strokeDasharray="4 4" /> : null}
      <path d={area} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="3" fill={color} />)}
      <text x={pad.l} y={H - 4} fontSize="10" fill="var(--muted)">{fmtShort(pts[0].date)}</text>
      {pts.length > 1 && <text x={W - pad.r} y={H - 4} fontSize="10" fill="var(--muted)" textAnchor="end">{fmtShort(pts.at(-1).date)}</text>}
    </svg>
  );
}
