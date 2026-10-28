import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LEVEL_COLOR } from '../lib/logic';
import { clearFrom, fromHeute } from '../lib/router';

const PATHS = {
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  today: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  bolt: <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12.5z" />,
  radar: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  check: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  edit: <path d="M4 20h4l10-10-4-4L4 16v4zM13.5 6.5l4 4" />,
  // Symbole der Lebensbereiche
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  leaf: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19l7-7" /></>,
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  wallet: <><rect x="3.5" y="6.5" width="17" height="12" rx="2.5" /><path d="M3.5 10h17" /><circle cx="16" cy="14.5" r="1" /></>,
  plane: <path d="M10.5 13.5L4 11l1.5-1.5 7 1L16.8 6.2a1.8 1.8 0 0 1 2.6 2.6L15 13.2l1 7-1.5 1.5-2.5-6.5L9 18.2V21l-1.3 1L6.5 18 2.6 16.7 3.6 15.5h2.6z" />,
  family: <><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.3" /><path d="M2.5 19c.7-3.4 2.9-5 5.5-5s4.8 1.6 5.5 5M13.5 15.5c.8-1 1.9-1.5 3-1.5 2.1 0 3.7 1.4 4.3 4" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.8-3.5 3.2-5.3 6-5.3s5.2 1.8 6 5.3" /><path d="M15 5.5a3 3 0 0 1 0 6M17.5 14.5c1.9.6 3.1 2.3 3.5 5" /></>,
  userPlus: <><circle cx="10" cy="8.5" r="3.5" /><path d="M3.5 20c.8-3.8 3.4-5.7 6.5-5.7 1.4 0 2.6.4 3.6 1.1" /><path d="M18 14v6M15 17h6" /></>,
  sparkle: <><path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></>,
  news: <><rect x="4" y="4.5" width="13" height="15" rx="2" /><path d="M17 8h2.5v9.5a2 2 0 0 1-2 2H6M7.5 8.5h6M7.5 12h6M7.5 15.5h4" /></>,
  circle: <circle cx="12" cy="12" r="7" />,
  send: <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />,
  mic: <><rect x="9" y="3" width="6" height="11.5" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  speaker: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  speakerOff: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  cloud: <path d="M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11 3.8 3.8 0 0 0 7 18.5z" />,
  cloudSun: <><path d="M9 3.5v1.3M3.9 5.6l.9.9M2.5 10.5h1.3M14.1 5.6l-.9.9" /><path d="M5.6 12.8A3.5 3.5 0 1 1 12 9.6" /><path d="M9.5 20h8a3.3 3.3 0 0 0 .4-6.6 4.8 4.8 0 0 0-9.2 1.2A2.8 2.8 0 0 0 9.5 20z" /></>,
  rain: <><path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 7.5 3.8 3.8 0 0 0 7 15z" /><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" /></>,
  snow: <><path d="M7 14.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 7 3.8 3.8 0 0 0 7 14.5z" /><path d="M8 18.5h.01M12 20h.01M16 18.5h.01" /></>,
  storm: <><path d="M7 14.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 7 3.8 3.8 0 0 0 7 14.5z" /><path d="M12.5 15.5 10.5 19h3l-2 3.5" /></>,
  shirt: <path d="M8.5 4 4 6.5l1.8 3.6 2.2-1V20h8V9.1l2.2 1 1.8-3.6L15.5 4a3.5 3.5 0 0 1-7 0z" />,
  chevLeft: <path d="M15 6l-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  chart: <><path d="M4 19.5h16" /><path d="M5.5 15l4-4.5 3.5 3 5.5-6.5" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.8" cy="6.5" r="1" /><circle cx="4.8" cy="12" r="1" /><circle cx="4.8" cy="17.5" r="1" /></>,
  plusCircle: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></>,
  flag: <><path d="M5.5 21V4" /><path d="M5.5 4.5h11l-2 4 2 4h-11" /></>,
  minus: <path d="M5 12h14" />,
  run: <><circle cx="14.5" cy="4.5" r="1.8" /><path d="M8 21l3-5.5 3 2.5v4.5M6.5 11.5l3-3.5 4 1.5 2 3 3 1M11 15.5l1.5-5" /></>,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  bike: <><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l3 7M14 5.5h2.5" /></>,
  swim: <><path d="M3 18c2 0 2-1.2 4.5-1.2S9.5 18 12 18s2-1.2 4.5-1.2S18.5 18 21 18" /><circle cx="16.5" cy="7.5" r="1.8" /><path d="M5 14l5-4 3 2.5 3-2" /></>,
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5z" /></>,
  cart: <><path d="M3.5 4.5h2l2.2 10.5h9.8l2-7.5H7" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="16.5" cy="19" r="1.4" /></>,
  pot: <><path d="M4 10.5h16v3.5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2.5 10.5h19M9 7c0-1 1-1.5 1-2.5M13 7c0-1 1-1.5 1-2.5" /></>,
  medical: <><rect x="3.5" y="6.5" width="17" height="13" rx="2.5" /><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5M12 10v6M9 13h6" /></>,
  calc: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8 7.5h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></>,
  play: <><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="M10.5 9.5v5l4-2.5z" /></>,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  pin: <><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  brain: <><path d="M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2 3 3 0 0 0 2.5 4.8 3 3 0 0 0 3 2.5V4.5z" /><path d="M14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-2.5 4.8 3 3 0 0 1-3 2.5V4.5z" /></>,
  more: <><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></>,
};

export function Icon({ name, size = 20, color = 'currentColor', width = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ stroke: color }} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.circle}
    </svg>
  );
}

// Farbiges Quadrat mit Symbol, wie in den iOS-Einstellungen
export function AreaIcon({ icon, color, size = 30 }) {
  return (
    <span className="area-icon" style={{ width: size, height: size, '--c': color, borderRadius: size * 0.28 }}>
      <Icon name={icon} size={size * 0.6} color="currentColor" width={2} />
    </span>
  );
}

export function Dot({ level, color, small }) {
  return <span className={small ? 'dot sm' : 'dot'} style={{ background: color || LEVEL_COLOR[level] }} />;
}

export function Chevron() {
  return <Icon name="chev" size={15} color="var(--chev)" width={2.4} />;
}

export function TabBar({ active }) {
  const tab = (id, href, label, icon) => (
    <a href={href} onClick={clearFrom} className={active === id ? 'tab on' : 'tab'} aria-current={active === id ? 'page' : undefined}>
      <Icon name={icon} size={25} width={active === id ? 2.2 : 1.8} />
      <span>{label}</span>
    </a>
  );
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {tab('heute', '#/heute', 'Heute', 'today')}
      {tab('bereiche', '#/bereiche', 'Bereiche', 'grid')}
      <a href="#/los" onClick={clearFrom} className={active === 'los' ? 'tab-plus on' : 'tab-plus'} aria-label="Was möchtest du tun?">
        <Icon name="bolt" size={25} color="currentColor" width={2.2} />
      </a>
      {tab('ausgehen', '#/ausgehen', 'Ausgehen', 'pin')}
      {tab('menschen', '#/menschen', 'Menschen', 'person')}
    </nav>
  );
}

export function Back({ href, label }) {
  if (fromHeute()) { href = '#/heute'; label = 'Heute'; }
  return (
    <a href={href} className="back">
      <Icon name="back" size={22} width={2.4} />
      {label}
    </a>
  );
}

export function Segmented({ options, value, onChange, full, label = 'Auswahl' }) {
  return (
    <div className={full ? 'seg full' : 'seg'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Abhak-Kreis, füllt sich in der Farbe der Säule (wie in Apple Erinnerungen)
export function Check({ on, onClick, label, color = 'var(--primary)' }) {
  return (
    <button type="button" className={on ? 'check on' : 'check'} style={on ? { background: color } : undefined} onClick={onClick} aria-label={label} aria-pressed={on}>
      {on && <Icon name="check" size={14} color="#fff" width={3} />}
    </button>
  );
}

export function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  // Als Portal direkt in <body>: so stören umgebende Felder (z.B. ein <label>) nicht, und ein Kalender-Fenster
  // innerhalb eines anderen Fensters lässt sich normal schließen
  return createPortal(
    <div className="sheet-bg" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <h2 className="h2">{title}</h2>
          <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Schließen">
            <Icon name="x" size={14} color="var(--muted)" width={2.6} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

// Auswahl eines Lebensbereichs, gruppiert nach Säulen
export function AreaSelect({ s, value, onChange, allowEmpty }) {
  return (
    <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">– keiner –</option>}
      {s.pillars.map((p) => (
        <optgroup key={p.id} label={p.name}>
          {s.areas.filter((a) => a.pillarId === p.id).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// Auswahl eines Unterbereichs (optional)
export function SubSelect({ area, value, onChange }) {
  if (!area || !area.subs.length) return null;
  return (
    <Field label="Unterbereich (optional)">
      <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">– allgemein –</option>
        {area.subs.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
      </select>
    </Field>
  );
}

let toastTimer;
export function toast(msg) {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: msg }));
}
export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    const f = (e) => {
      setMsg(e.detail);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener('app-toast', f);
    return () => window.removeEventListener('app-toast', f);
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function SectionHead({ title, right }) {
  return (
    <div className="sec-h">
      <h2 className="h2">{title}</h2>
      {right}
    </div>
  );
}

// v0.95 (Mateo): Hinweise/Kosten-Infos hinter einem kleinen ⓘ – antippen zeigt sie, irgendwo tippen schließt sie
export function Info({ children, label = '', style }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!pos) return undefined;
    const close = (e) => { if (btn.current && btn.current.contains(e.target)) return; setPos(null); };
    const off = () => setPos(null);
    document.addEventListener('pointerdown', close, true);
    window.addEventListener('scroll', off, true);
    return () => { document.removeEventListener('pointerdown', close, true); window.removeEventListener('scroll', off, true); };
  }, [pos]);
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btn.current.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left - 8, window.innerWidth - w - 12));
    const below = r.bottom + 160 < window.innerHeight;
    setPos({ left, w, top: below ? r.bottom + 6 : null, bottom: below ? null : window.innerHeight - r.top + 6 });
  };
  return (
    <span className="info-wrap" style={style}>
      <button type="button" ref={btn} className={pos ? 'info-btn on' : 'info-btn'} onClick={toggle} aria-label="Info anzeigen" aria-expanded={!!pos}>ⓘ{label ? <span>{label}</span> : null}</button>
      {pos && createPortal(<div className="info-pop" role="note" style={{ left: pos.left, width: pos.w, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined }}>{children}</div>, document.body)}
    </span>
  );
}
