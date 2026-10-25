import { addDays, startOfWeek } from '../lib/dates';

export const heatColor = (n) => (n <= 0 ? 'var(--heat0)' : n === 1 ? '#CBD5BF' : n === 2 ? '#9EB08C' : '#6C8160');

// Kalender-Heatmap: eine Spalte pro Woche, eine Zeile pro Wochentag (Mo–So)
export function Heatmap({ counts, weeks, t }) {
  const start = addDays(startOfWeek(t), -(weeks - 1) * 7);
  const gap = weeks > 30 ? 2 : weeks > 14 ? 3 : 4;
  const h = weeks > 30 ? 7 : weeks > 14 ? 9 : 12;
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const future = d > t;
    cells.push(
      <span key={d} title={d} style={{ height: h, background: future ? 'transparent' : heatColor(counts[d] || 0), boxShadow: future ? 'inset 0 0 0 1px var(--border)' : 'none' }} />
    );
  }
  return (
    <div className="heat" style={{ gridTemplateRows: `repeat(7, ${h}px)`, gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gap }} aria-label={`Aktivität der letzten ${weeks} Wochen`} role="img">
      {cells}
    </div>
  );
}

export function HeatLegend({ left }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span className="sub" style={{ marginRight: 'auto' }}>{left}</span>
      <span className="tiny">weniger</span>
      {[0, 1, 2, 3].map((n) => (
        <span key={n} style={{ width: 11, height: 11, borderRadius: 3, background: heatColor(n) }} />
      ))}
      <span className="tiny">mehr</span>
    </div>
  );
}
