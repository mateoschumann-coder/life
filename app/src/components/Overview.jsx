// „Dein Überblick“ auf Heute: strukturierte Zusammenfassung mit Knöpfen (KI ohne Internet, einmal am Tag automatisch)
import { useEffect, useState } from 'react';
import { askOverview, collectItems, loadOverview, localOverview } from '../lib/overview';
import { getAi } from '../lib/ai';
import { today } from '../lib/dates';
import { logContact, toggleTask, updateTask } from '../lib/actions';
import { doneReminder } from '../lib/home';
import { doneHealthItem } from '../lib/health';
import { go } from '../lib/router';
import { Icon, toast } from './ui';

let running = null;

export default function Overview({ s }) {
  const [v, setV] = useState(loadOverview);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const items = collectItems(s);
  const byRef = Object.fromEntries(items.map((i) => [i.ref, i]));
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
    if (hasKey && getAi().autoCoach !== false && (!v || v.date !== today())) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const data = v && v.date === today() ? v : !hasKey ? localOverview(s) : v || localOverview(s);
  // Punkte, die inzwischen erledigt sind, fallen weg
  const sections = (data?.sections || []).map((sec) => ({ ...sec, points: sec.points.filter((p) => byRef[p.ref]) })).filter((sec) => sec.points.length);

  const Btns = ({ i }) => (
    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      {i.kind === 'task' && i.date !== today() && <button type="button" className="pill" onClick={() => { updateTask(i.id, { due: today() }); toast('Für heute eingeplant'); }}>Heute</button>}
      {i.kind === 'task' && <button type="button" className="pill on" onClick={() => { toggleTask(i.id); toast('Erledigt'); }} aria-label={`${i.text} erledigt`}>✓</button>}
      {i.kind === 'reminder' && <button type="button" className="pill on" onClick={() => { doneReminder(i.id); toast('Erledigt'); }}>✓</button>}
      {i.kind === 'health' && <button type="button" className="pill on" onClick={() => { doneHealthItem(i.id); toast('Erledigt'); }}>✓</button>}
      {i.kind === 'person' && i.wa && <a className="pill on" href={i.wa} target="_blank" rel="noreferrer" onClick={() => logContact(i.id)}>WhatsApp</a>}
      {i.kind === 'person' && !i.wa && <button type="button" className="pill on" onClick={() => { logContact(i.id); toast('Kontakt notiert'); }}>✓</button>}
      {!['task', 'reminder', 'health'].includes(i.kind) && <button type="button" className="pill" onClick={() => go(i.link.replace(/^#/, ''))}>Öffnen</button>}
    </span>
  );

  return (
    <section className="card checkin" style={{ gap: 12 }}>
      <div className="sec-h" style={{ padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span> Dein Überblick
        </span>
        {hasKey && <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={run} disabled={busy} aria-label="Überblick aktualisieren"><Icon name="refresh" size={15} /></button>}
      </div>
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich schaue mir an, was gerade los ist …</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {!busy && data?.lage && <p className="coach-summary">{data.lage}</p>}
      {!busy && sections.map((sec) => (
        <div key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label" style={{ padding: 0 }}>{sec.title}</span>
          {sec.points.map((p) => {
            const i = byRef[p.ref];
            return (
              <div key={p.ref} className="option" style={{ alignItems: 'center' }}>
                <button type="button" className="row-main" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => go(i.link.replace(/^#/, ''))}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{i.text}</span>
                  <span className="tiny">{[i.area, i.info, p.note].filter(Boolean).join(' · ')}</span>
                </button>
                <Btns i={i} />
              </div>
            );
          })}
        </div>
      ))}
      {!busy && !sections.length && <span className="sub">Gerade ist nichts Dringendes offen. 🎉</span>}
      {!busy && v?.date === today() && <span className="tiny">Stand {new Date(v.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Pfeil oben für einen neuen Überblick (ohne Internet, unter 0,5 Cent)</span>}
      {!hasKey && <span className="tiny">Ohne API-Schlüssel sortiert die App selbst nach Datum. Mit Schlüssel fasst die KI zusammen und denkt mit.</span>}
    </section>
  );
}
