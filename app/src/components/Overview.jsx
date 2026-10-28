// „Dein Überblick“ auf Heute (v0.92, Mateo): pro Bereich eine Zeile – links kurze Zusammenfassung, rechts Knöpfe zu den
// wichtigsten Einträgen (z.B. „China-Reise“), ganz rechts ein Pfeil über die volle Höhe zum Bereich.
// Oben eine Klappe „Bereiche ▾“: alle oder nur ausgewählte Bereiche zeigen (gemerkt in life-app-ov-secs).
import { useEffect, useState } from 'react';
import { SECTIONS, askOverview, loadOverview, structure } from '../lib/overview';
import { getAi } from '../lib/ai';
import { today } from '../lib/dates';
import { markFromHeute, go } from '../lib/router';
import { Icon } from './ui';

let running = null;
const SEC_KEY = 'life-app-ov-secs';
const loadSecs = () => { try { return JSON.parse(localStorage.getItem(SEC_KEY) || 'null'); } catch { return null; } };

// Zusammenfassung ohne KI: Gruppen mit Anzahl, z.B. „2 überfällig · 1 heute“
const localSummary = (groups) => groups.map((g) => (g.items.length === 1 ? `${g.label}: ${g.items[0].text}` : `${g.label}: ${g.items.length}`)).join(' · ');

// v0.95 (Mateo): „Alle“ oben; einzelne Bereiche antippen = nur diese zeigen (nicht abwählen)
function SecPicker({ avail, sel, onChange }) {
  const [open, setOpen] = useState(false);
  const all = !sel;
  const label = all ? 'Alle Bereiche' : sel.length === 1 ? SECTIONS.find((x) => x.key === sel[0])?.name : `${sel.length} Bereiche`;
  const tap = (k) => {
    if (all) { onChange([k]); return; }
    const next = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k];
    onChange(next.length && next.length < avail.length ? next : null);
  };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className={all ? 'sec-pick-btn' : 'sec-pick-btn on'} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Bereiche auswählen">
        <Icon name="filter" size={13} color="currentColor" /><span>{label}</span><span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="sec-pick">
            <button type="button" className={all ? 'sec-all on' : 'sec-all'} onClick={() => { onChange(null); setOpen(false); }}>{all ? '✓ ' : ''}Alle Bereiche</button>
            <span className="tiny" style={{ padding: '2px 2px 0' }}>Oder nur bestimmte:</span>
            <div className="sec-grid">
              {avail.map((x) => {
                const on = !all && sel.includes(x.key);
                return <button key={x.key} type="button" className={on ? 'sec-chip on' : 'sec-chip'} onClick={() => tap(x.key)} aria-pressed={on}><Icon name={x.icon} size={13} color="currentColor" /> {x.name}</button>;
              })}
            </div>
            <button type="button" className="btn small" onClick={() => setOpen(false)}>Fertig</button>
          </div>
        </>
      )}
    </div>
  );
}

// Zeile: links Zusammenfassung, darunter ▾ zum Aufklappen der Direkt-Knöpfe, rechts Pfeil über die ganze Höhe
// v0.96 (Mateo): ganze Zeile antippen = zum Bereich (vorher nur der schmale Text/Pfeil – klappte nicht immer)
const openLink = (link) => {
  if (link === '#/heute') { document.getElementById('tagesliste')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  markFromHeute(link);
  go(link.replace(/^#/, ''));
};
function SecRow({ x, groups, hint }) {
  const [open, setOpen] = useState(false);
  const items = groups.flatMap((g) => g.items).filter((i) => i.link);
  const chips = items.slice(0, 6);
  const more = groups.reduce((n, g) => n + g.items.length, 0) - chips.length;
  const stop = (e) => e.stopPropagation();
  return (
    <div className="ov-row" role="link" tabIndex={0} aria-label={`${x.name} öffnen`} onClick={() => openLink(x.link)} onKeyDown={(e) => e.key === 'Enter' && openLink(x.link)}>
      <div className="ov-row-body">
        <div className="ov-row-main">
          <span className="ov-row-title"><Icon name={x.icon} size={14} color="var(--accent)" /> {x.name}</span>
          <span className="ov-row-text">{hint ? `✨ ${hint}` : localSummary(groups) || 'Nichts Offenes'}</span>
        </div>
        {chips.length > 0 && (
          <button type="button" className="ov-expand" onClick={(e) => { stop(e); setOpen(!open); }} aria-expanded={open}>{open ? '▴ weniger' : `▾ ${items.length} ${items.length === 1 ? 'Eintrag' : 'Einträge'}`}</button>
        )}
        {open && chips.length > 0 && (
          <div className="ov-row-chips" onClick={stop}>
            {chips.map((i, k) => (i.ext
              ? <a key={k} className="ov-mini" href={i.link} target="_blank" rel="noreferrer">{i.text}</a>
              : <button key={k} type="button" className="ov-mini" onClick={() => openLink(i.link)}>{i.text}{i.info ? <i>{i.info}</i> : null}</button>))}
            {more > 0 && <button type="button" className="ov-mini more" onClick={() => openLink(x.link)}>+{more}</button>}
          </div>
        )}
      </div>
      <span className="ov-row-arrow" aria-hidden="true">›</span>
    </div>
  );
}

export default function Overview({ s }) {
  const [v, setV] = useState(loadOverview);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('life-app-ov-open') !== '0'; } catch { return true; } });
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem('life-app-ov-open', n ? '1' : '0'); } catch {} };
  const [sel, setSelState] = useState(loadSecs);
  const setSel = (x) => { setSelState(x); try { if (x) localStorage.setItem(SEC_KEY, JSON.stringify(x)); else localStorage.removeItem(SEC_KEY); } catch {} };
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
  const avail = SECTIONS.filter((x) => struct[x.key] || hints[x.key]);
  const sections = avail.filter((x) => !sel || sel.includes(x.key));

  return (
    <section className="card checkin" style={{ gap: 8 }}>
      <div className="sec-h" style={{ padding: 0, gap: 6 }}>
        <button type="button" onClick={toggle} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', flex: 1, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span> <span style={{ fontWeight: 700, fontSize: 17 }}>Dein Überblick</span>
          <span className="tiny">{open ? '▴' : '▾'}</span>
        </button>
        {open && avail.length > 1 && <SecPicker avail={avail} sel={sel} onChange={setSel} />}
        {open && hasKey && <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={run} disabled={busy} aria-label="Zusammenfassung aktualisieren"><Icon name="refresh" size={15} /></button>}
      </div>
      {open && <>
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {fresh && v.lage && !sel && <p className="coach-summary">{v.lage}</p>}
      <div className="ov-rows">
        {sections.map((x) => <SecRow key={x.key} x={x} groups={struct[x.key] || []} hint={hints[x.key]} />)}
      </div>
      {!avail.length && <span className="sub">Gerade ist nichts eingetragen, das ansteht.</span>}
      {busy && <span className="tiny">Zusammenfassung wird geholt …</span>}
      </>}
    </section>
  );
}
