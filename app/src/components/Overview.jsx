// „Dein Überblick“ auf Heute (v0.58): pro Bereich kleine Gruppen mit antippbaren Einträgen (direkt dorthin springen),
// dazu höchstens ein kurzer KI-Hinweis pro Bereich (ohne Internet, einmal am Tag automatisch)
import { useEffect, useState } from 'react';
import { SECTIONS, askOverview, loadOverview, structure } from '../lib/overview';
import { getAi } from '../lib/ai';
import { today } from '../lib/dates';
import { markFromHeute } from '../lib/router';
import { Chevron, Icon } from './ui';

let running = null;
const MAX = 6;

function Group({ g }) {
  const [all, setAll] = useState(false);
  const items = all ? g.items : g.items.slice(0, MAX);
  return (
    <div className="ov-group">
      <span className="ov-label">{g.label}</span>
      <div className="ov-chips">
        {items.map((x, i) => {
          const inner = <><span className="ov-t">{x.text}</span>{x.info && <i className={/überfällig/.test(x.info) ? 'late' : ''}>{x.info}</i>}{x.link && <span className="ov-arrow">›</span>}</>;
          if (!x.link) return <span key={i} className="ov-chip plain">{inner}</span>;
          return x.ext
            ? <a key={i} className="ov-chip" href={x.link} target="_blank" rel="noreferrer">{inner}</a>
            : <a key={i} className="ov-chip" href={x.link} onClick={() => markFromHeute(x.link)}>{inner}</a>;
        })}
        {g.items.length > MAX && <button type="button" className="ov-chip more" onClick={() => setAll(!all)}>{all ? 'weniger' : `+${g.items.length - MAX}`}</button>}
      </div>
    </div>
  );
}

export default function Overview({ s }) {
  const [v, setV] = useState(loadOverview);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('life-app-ov-open') !== '0'; } catch { return true; } });
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem('life-app-ov-open', n ? '1' : '0'); } catch {} };
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const fresh = v && v.date === today() && v.kind === 'hint';
  const run = async () => {
    if (running) return;
    setBusy(true);
    setErr(null);
    running = askOverview(s);
    try {
      setV(await running);
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? null : e.message);
    } finally {
      running = null;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (hasKey && !fresh) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const struct = structure(s);
  const hints = {};
  if (fresh) for (const x of v.sections || []) hints[x.key] = x.text;
  const sections = SECTIONS.filter((x) => struct[x.key] || hints[x.key]);

  return (
    <section className="card checkin" style={{ gap: 6 }}>
      <div className="sec-h" style={{ padding: 0 }}>
        <button type="button" onClick={toggle} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17, background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', flex: 1, textAlign: 'left', cursor: 'pointer' }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span> <span style={{ fontWeight: 700, fontSize: 17 }}>Dein Überblick</span>
          <span className="tiny" style={{ marginLeft: 'auto', marginRight: 6 }}>{open ? '▴ Einklappen' : '▾ Aufklappen'}</span>
        </button>
        {open && hasKey && <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={run} disabled={busy} aria-label="Hinweise aktualisieren"><Icon name="refresh" size={15} /></button>}
      </div>
      {open && <>
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {fresh && v.lage && <p className="coach-summary">{v.lage}</p>}
      {sections.map((x) => (
        <div key={x.key} className="ov-sec">
          <a href={x.link} className="ov-head" onClick={() => markFromHeute(x.link)}><Icon name={x.icon} size={15} color="var(--accent)" /><span style={{ flex: 1 }}>{x.name}</span><Chevron /></a>
          {(struct[x.key] || []).map((g) => <Group key={g.label} g={g} />)}
          {hints[x.key] && <span className="ov-hint">✨ {hints[x.key]}</span>}
        </div>
      ))}
      {!sections.length && <span className="sub">Gerade ist nichts eingetragen, das ansteht.</span>}
      {busy && <span className="tiny">KI-Hinweise werden geholt …</span>}
      </>}
    </section>
  );
}
