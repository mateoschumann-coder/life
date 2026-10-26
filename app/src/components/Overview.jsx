// „Dein Überblick“ auf Heute: strukturierte Zusammenfassung mit Knöpfen (KI ohne Internet, einmal am Tag automatisch)
import { useEffect, useState } from 'react';
import { askOverview, collectItems, loadOverview, localOverview, saveOverview, secOf } from '../lib/overview';
import { getAi } from '../lib/ai';
import { today } from '../lib/dates';
import { addTask, logContact, toggleTask, updateTask } from '../lib/actions';
import { listen } from './Coach';
import { doneReminder } from '../lib/home';
import { doneHealthItem } from '../lib/health';
import { go } from '../lib/router';
import { Chevron, Icon, toast } from './ui';

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
  const done = new Set(data?.done || []);
  const hide = (k) => {
    if (!v || v.date !== today()) return;
    const next = { ...v, done: [...(v.done || []), k] };
    saveOverview(next);
    setV(next);
  };
  // Punkte, die inzwischen erledigt sind, fallen weg; ältere Überblicke (ohne Bereiche) werden ignoriert
  const sections = (data?.sections || []).filter((sec) => sec.key && secOf(sec.key)).map((sec) => ({ ...sec, points: sec.points.filter((p) => byRef[p.ref]), ask: done.has(`${sec.key}:q`) ? '' : sec.ask, idea: done.has(`${sec.key}:v`) ? '' : sec.idea })).filter((sec) => sec.points.length || sec.ask || sec.idea);

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
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich gehe deine Bereiche durch …</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {!busy && data?.lage && <p className="coach-summary">{data.lage}</p>}
      {!busy && sections.map((sec) => {
        const info = secOf(sec.key);
        return (
          <div key={sec.key} className="ov-sec">
            <a href={info.link} className="ov-head"><Icon name={info.icon} size={15} color="var(--accent)" /><span style={{ flex: 1 }}>{info.name}</span><Chevron /></a>
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
            {sec.ask && (
              <div className="ov-ask">
                <p>{sec.ask}</p>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="pill on" onClick={() => listen(`${sec.ask} – `)}>Erzählen</button>
                  <button type="button" className="pill" onClick={() => { hide(`${sec.key}:q`); toast('Super 👍'); }}>Läuft gut</button>
                  <button type="button" className="pill" onClick={() => hide(`${sec.key}:q`)}>Später</button>
                </span>
              </div>
            )}
            {sec.idea && (
              <div className="ov-ask">
                <p>💡 {sec.idea}</p>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="pill on" onClick={() => { addTask({ title: sec.idea, areaId: info.areaId, due: today() }); hide(`${sec.key}:v`); toast('Für heute eingeplant'); }}>Heute machen</button>
                  <button type="button" className="pill" onClick={() => { addTask({ title: sec.idea, areaId: info.areaId, due: null, idea: true }); hide(`${sec.key}:v`); toast('Als Idee gemerkt'); }}>Merken</button>
                  <button type="button" className="pill" onClick={() => hide(`${sec.key}:v`)} aria-label="Vorschlag ausblenden">✕</button>
                </span>
              </div>
            )}
          </div>
        );
      })}
      {!busy && !sections.length && <span className="sub">Gerade ist nichts Dringendes offen. 🎉</span>}
      {!busy && v?.date === today() && <span className="tiny">Stand {new Date(v.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Pfeil oben für einen neuen Überblick (ohne Internet, unter 0,5 Cent)</span>}
      {!hasKey && <span className="tiny">Ohne API-Schlüssel sortiert die App selbst nach Datum. Mit Schlüssel fasst die KI zusammen und denkt mit.</span>}
    </section>
  );
}
