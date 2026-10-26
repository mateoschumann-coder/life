// Coach-Karte auf „Heute“: kommt einmal am Tag von selbst mit Anstößen
import { useEffect, useState } from 'react';
import { askCoach, autoCoach, lastBriefing, saveBriefing } from '../lib/coach';
import { getAi } from '../lib/ai';
import { addDays, fmtShort, today } from '../lib/dates';
import { addEvent, addProject, addTask } from '../lib/actions';
import { areaOf } from '../lib/logic';
import { go } from '../lib/router';
import { Icon, toast } from './ui';

let running = null; // verhindert doppelte Abrufe

const ART_ICON = { aufgabe: 'check', projekt: 'sparkle', event: 'calendar', link: 'link' };

export function listen() {
  window.dispatchEvent(new Event('life-listen'));
}

export default function Coach({ s }) {
  const [b, setB] = useState(lastBriefing);
  const [busy, setBusy] = useState(!!running);
  const [err, setErr] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const hasKey = !!getAi().apiKey;

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      running = running || askCoach(s);
      setB(await running);
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Für den Coach braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      running = null;
      setBusy(false);
    }
  };
  // Kommt von selbst: beim ersten Öffnen am Tag
  useEffect(() => {
    if (running) {
      running.then(setB).catch(() => {}).finally(() => setBusy(false));
      return;
    }
    if (hasKey && autoCoach() && (!b || b.date !== today())) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = (id, status, note) => {
    const next = { ...b, items: b.items.map((x) => (x.id === id ? { ...x, status, note } : x)) };
    saveBriefing(next);
    setB(next);
  };
  const plan = (x, when) => {
    const due = when === 'heute' ? today() : addDays(today(), 1);
    addTask({ title: x.task, areaId: x.projectId ? null : x.areaId, projectId: x.projectId, due, url: x.url });
    mark(x.id, 'erledigt', `Für ${when} eingeplant`);
    toast(`Für ${when} eingeplant`);
  };
  const keepEvent = (x) => {
    addEvent({ name: x.title, date: x.date || '', place: x.place || '', stage: 'interessiert', url: x.url || '', note: x.text });
    if (x.date) addTask({ title: x.task || x.title, areaId: x.areaId, due: x.date, url: x.url });
    mark(x.id, 'erledigt', x.date ? `Gemerkt und am ${fmtShort(x.date)} eingetragen` : 'Unter Ausgehen gemerkt');
    toast('Event gemerkt');
  };
  const startProject = (x) => {
    const area = x.areaId || s.areas[0].id;
    const id = addProject({ name: x.projectName || x.title, areaId: area });
    mark(x.id, 'erledigt', 'Projekt gestartet');
    try {
      sessionStorage.setItem('life-open-designer', id);
    } catch {}
    go(`/projekt/${id}`);
  };

  const items = b?.items || [];
  const open = items.filter((x) => x.status === 'offen');
  const done = items.filter((x) => x.status !== 'offen');

  return (
    <section className="card checkin coach">
      <div className="sec-h" style={{ padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span>
          Dein Coach
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={listen} aria-label="Dem Coach erzählen">
            <Icon name="mic" size={15} />
          </button>
          {hasKey && (
            <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={run} disabled={busy} aria-label="Neue Anstöße holen">
              <Icon name="refresh" size={15} />
            </button>
          )}
        </span>
      </div>

      {busy && (
        <div className="coach-busy">
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="sub">Ich schaue mir alles an und suche im Internet nach Passendem für dich … (ca. 20 Sek.)</span>
        </div>
      )}
      {!busy && b?.summary && <p className="coach-summary">{b.summary}</p>}

      {!busy && open.map((x) => (
        <article key={x.id} className="nudge">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="nudge-icon"><Icon name={ART_ICON[x.art] || 'check'} size={15} /></span>
            <div className="row-main" style={{ gap: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 650, lineHeight: 1.3 }}>{x.title}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.42, color: 'var(--text-2, var(--muted))' }}>{x.text}</span>
              <span className="tiny">
                {[areaOf(s, x.areaId)?.name, x.date && fmtShort(x.date), x.place, x.source].filter(Boolean).join(' · ')}
              </span>
            </div>
            <button type="button" className="x-btn" aria-label={`${x.title} verwerfen`} onClick={() => mark(x.id, 'verworfen', 'Verworfen')}>
              <Icon name="x" size={12} color="var(--chev)" />
            </button>
          </div>
          <div className="nudge-actions">
            {x.url && (
              <a className="pill" href={x.url} target="_blank" rel="noreferrer">
                {x.art === 'event' ? 'Ansehen' : 'Öffnen'} <Icon name="link" size={13} />
              </a>
            )}
            {x.art === 'event' && <button type="button" className="pill on" onClick={() => keepEvent(x)}>Interessiert</button>}
            {x.art === 'projekt' && <button type="button" className="pill on" onClick={() => startProject(x)}>Projekt starten</button>}
            {(x.art === 'aufgabe' || x.art === 'link') && (
              <>
                <button type="button" className="pill on" onClick={() => plan(x, 'heute')}>Heute</button>
                <button type="button" className="pill" onClick={() => plan(x, 'morgen')}>Morgen</button>
              </>
            )}
          </div>
        </article>
      ))}

      {!busy && items.length > 0 && open.length === 0 && (
        <span className="sub">Alles durch – stark. Neue Anstöße kommen morgen von selbst, oder jetzt mit dem Pfeil oben.</span>
      )}
      {!busy && done.length > 0 && (
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowDone(!showDone)}>
          {showDone ? 'Erledigte ausblenden' : `${done.length} erledigt`}
        </button>
      )}
      {!busy && showDone && done.map((x) => (
        <span key={x.id} className="tiny" style={{ display: 'flex', gap: 6 }}>
          <Icon name={x.status === 'verworfen' ? 'x' : 'check'} size={12} /> {x.title} – {x.note}
        </span>
      ))}

      {!busy && !b && hasKey && (
        <>
          <span className="sub" style={{ lineHeight: 1.45 }}>Dein Coach schaut sich jeden Tag deine Projekte, Ziele und Menschen an, sucht passende Events, Videos und News und schlägt dir die besten nächsten Schritte vor.</span>
          <button type="button" className="btn small" onClick={run}>Jetzt Anstöße holen</button>
        </>
      )}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {!hasKey && <a href="#/einstellungen" className="link-btn">API-Schlüssel hinterlegen</a>}

      <div className="coach-foot">
        <button type="button" className="tell" onClick={listen}>
          <Icon name="mic" size={16} /> Erzähl mir, wie es läuft
        </button>
        <a href="#/gedaechtnis" className="tiny" style={{ color: 'var(--accent)' }}>Was Life über dich weiß ({(s.memory || []).length})</a>
      </div>
    </section>
  );
}
