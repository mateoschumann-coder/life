// Kalender zum Auswählen eines Zeitraums: 1. Tipp = Von, 2. Tipp = Bis
import { useState } from 'react';
import { diffDays, fmtShort, pad, today } from '../lib/dates';
import { Icon, Sheet } from './ui';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function RangeCalendar({ from, to, onChange, single = false }) {
  const start = from || today();
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const t = today();
  const first = new Date(ym.y, ym.m, 1);
  const offset = (first.getDay() + 6) % 7; // Montag zuerst
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const move = (n) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const pick = (k) => {
    if (single) return onChange({ from: k, to: '' });
    if (!from || to) return onChange({ from: k, to: '' });
    if (k < from) return onChange({ from: k, to: '' });
    onChange({ from, to: k });
  };
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="x-btn" onClick={() => move(-1)} aria-label="Vorheriger Monat"><Icon name="chevLeft" size={18} /></button>
        <b>{MONTHS[ym.m]} {ym.y}</b>
        <button type="button" className="x-btn" onClick={() => move(1)} aria-label="Nächster Monat"><span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icon name="chevLeft" size={18} /></span></button>
      </div>
      <div className="cal-grid">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <span key={d} className="cal-wd">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={'e' + i} />;
          const k = key(ym.y, ym.m, d);
          const isFrom = k === from;
          const isTo = k === to;
          const inside = from && to && k > from && k < to;
          const cls = ['cal-day', (isFrom || isTo) && 'sel', inside && 'mid', isFrom && to && 'start', isTo && 'end', k === t && 'today'].filter(Boolean).join(' ');
          return <button key={k} type="button" className={cls} onClick={() => pick(k)} aria-label={k} aria-pressed={isFrom || isTo}>{d}</button>;
        })}
      </div>
      <span className="tiny" style={{ textAlign: 'center' }}>
        {single ? (from ? fmtShort(from) : 'Tippe auf ein Datum') : !from ? 'Tippe auf den ersten Tag' : !to ? 'Jetzt den letzten Tag antippen' : `${fmtShort(from)} – ${fmtShort(to)} · ${diffDays(from, to) + 1} Tage`}
      </span>
    </div>
  );
}

export const rangeText = (from, to) => (from ? `${fmtShort(from)}${to ? ` – ${fmtShort(to)} · ${diffDays(from, to) + 1} Tage` : ''}` : '');

// Feld, das den Zeitraum anzeigt und beim Antippen den Kalender öffnet
export function DateRangeField({ from, to, onChange, placeholder = 'Zeitraum wählen', title = 'Zeitraum', single = false }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ from, to });
  const show = () => { setV({ from, to }); setOpen(true); };
  return (
    <>
      <button type="button" className="input date-field" onClick={(e) => { e.preventDefault(); show(); }}>
        <Icon name="calendar" size={17} color="var(--muted)" />
        <span style={{ flex: 1, textAlign: 'left', color: from ? 'var(--text)' : 'var(--muted)' }}>{from ? (single ? fmtShort(from) : rangeText(from, to)) : placeholder}</span>
      </button>
      <Sheet open={open} title={title} onClose={() => setOpen(false)}>
        <RangeCalendar from={v.from} to={v.to} single={single} onChange={setV} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn tint" style={{ flex: 1 }} onClick={() => { onChange({ from: '', to: '' }); setOpen(false); }}>{single ? 'Kein Datum' : 'Kein Zeitraum'}</button>
          <button type="button" className="btn" style={{ flex: 2 }} disabled={!v.from} onClick={() => { onChange(v); setOpen(false); }}>Übernehmen</button>
        </div>
      </Sheet>
    </>
  );
}
