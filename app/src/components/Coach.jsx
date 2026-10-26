// Coach-Karte auf „Heute“: kommt einmal am Tag von selbst und geht die Themen-Boxen nacheinander durch.
// Dieselben Boxen erscheinen auch im jeweiligen Lebensbereich (CoachBox).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { askCoach, autoCoach, BOXES, boxOfArea, lastBriefing, logAnswer, saveBriefing } from '../lib/coach';
import { getAi } from '../lib/ai';
import { addDays, diffDays, fmtShort, relDays, today } from '../lib/dates';
import { addEvent, addProject, addTask, logActivity } from '../lib/actions';
import { go } from '../lib/router';
import { Icon, toast } from './ui';

// Gemeinsamer Zustand des Briefings (Heute-Karte und Bereichs-Boxen sehen dasselbe)
let briefing = lastBriefing();
let running = null;
let busy = false;
let error = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());
let snap = { briefing, busy, error };
const setState = (patch) => {
  if ('briefing' in patch) briefing = patch.briefing;
  if ('busy' in patch) busy = patch.busy;
  if ('error' in patch) error = patch.error;
  snap = { briefing, busy, error };
  emit();
};
function useBriefing() {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => snap);
}
export async function runCoach(s) {
  if (running) return running;
  setState({ busy: true, error: null });
  running = askCoach(s)
    .then((b) => setState({ briefing: b }))
    .catch((e) => setState({ error: e.message === 'KEIN_SCHLUESSEL' ? 'Für den Coach braucht es einen API-Schlüssel (Einstellungen).' : e.message }))
    .finally(() => {
      running = null;
      setState({ busy: false });
    });
  return running;
}
function update(fn) {
  const next = structuredClone(briefing);
  fn(next);
  saveBriefing(next);
  setState({ briefing: next });
}

const ART_ICON = { aufgabe: 'check', projekt: 'sparkle', event: 'calendar', link: 'link' };

// Schwebenden Assistenten im Coach-Modus öffnen und zuhören (optional mit Einleitung, z.B. der Frage)
export function listen(prefix) {
  window.dispatchEvent(new CustomEvent('life-listen', { detail: { prefix } }));
}

function Nudge({ s, x, boxId }) {
  const mark = (status, note) => update((b) => {
    const it = b.boxes.find((y) => y.id === boxId)?.items.find((y) => y.id === x.id);
    if (it) Object.assign(it, { status, note });
  });
  const plan = (when) => {
    const due = when === 'heute' ? today() : addDays(today(), 1);
    addTask({ title: x.task, areaId: x.projectId ? null : x.areaId, projectId: x.projectId, due, url: x.url });
    mark('erledigt', `Für ${when} eingeplant`);
    toast(`Für ${when} eingeplant`);
  };
  const keepEvent = () => {
    addEvent({ name: x.title, date: x.date || '', place: x.place || '', stage: 'interessiert', url: x.url || '', note: x.text });
    if (x.date) addTask({ title: x.task || x.title, areaId: x.areaId, due: x.date, url: x.url });
    mark('erledigt', x.date ? `Gemerkt, am ${fmtShort(x.date)} eingetragen` : 'Unter Ausgehen gemerkt');
    toast('Event gemerkt');
  };
  const startProject = () => {
    const id = addProject({ name: x.projectName || x.title, areaId: x.areaId || s.areas[0].id });
    mark('erledigt', 'Projekt gestartet');
    try {
      sessionStorage.setItem('life-open-designer', id);
    } catch {}
    go(`/projekt/${id}`);
  };
  if (x.status !== 'offen') {
    return (
      <span className="tiny" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name={x.status === 'verworfen' ? 'x' : 'check'} size={12} /> {x.title} – {x.note}
      </span>
    );
  }
  return (
    <article className="nudge">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span className="nudge-icon"><Icon name={ART_ICON[x.art] || 'check'} size={15} /></span>
        <div className="row-main" style={{ gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 650, lineHeight: 1.3 }}>{x.title}</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.42, color: 'var(--muted)' }}>{x.text}</span>
          {(x.date || x.place || x.source) && <span className="tiny">{[x.date && fmtShort(x.date), x.place, x.source].filter(Boolean).join(' · ')}</span>}
        </div>
        <button type="button" className="x-btn" aria-label={`${x.title} verwerfen`} onClick={() => mark('verworfen', 'Verworfen')}>
          <Icon name="x" size={12} color="var(--chev)" />
        </button>
      </div>
      <div className="nudge-actions">
        {x.url && <a className="pill" href={x.url} target="_blank" rel="noreferrer">{x.art === 'event' ? 'Ansehen' : 'Öffnen'} <Icon name="link" size={13} /></a>}
        {x.art === 'event' && <button type="button" className="pill on" onClick={keepEvent}>Interessiert</button>}
        {x.art === 'projekt' && <button type="button" className="pill on" onClick={startProject}>Projekt starten</button>}
        {(x.art === 'aufgabe' || x.art === 'link') && (
          <>
            <button type="button" className="pill on" onClick={() => plan('heute')}>Heute</button>
            <button type="button" className="pill" onClick={() => plan('morgen')}>Morgen</button>
          </>
        )}
      </div>
    </article>
  );
}

function Question({ box }) {
  const def = BOXES.find((d) => d.id === box.id);
  if (!box.question) return null;
  const answer = (a, label) => {
    logAnswer(box.question, a, box.id);
    if (a === 'ja') logActivity(def.areas[0], box.question);
    update((b) => {
      const x = b.boxes.find((y) => y.id === box.id);
      if (x) x.answered = label;
    });
  };
  if (box.answered) return <span className="tiny" style={{ display: 'flex', gap: 6 }}><Icon name="check" size={12} /> {box.question} – {box.answered}</span>;
  return (
    <div className="coach-q">
      <span style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35 }}>{box.question}</span>
      <div className="nudge-actions" style={{ paddingLeft: 0 }}>
        <button type="button" className="pill on" onClick={() => { answer('ja', 'Ja'); toast('Stark!'); }}>Ja</button>
        <button type="button" className="pill" onClick={() => answer('noch nicht', 'Noch nicht')}>Noch nicht</button>
        <button type="button" className="pill" onClick={() => { answer('erzählt per Sprache', 'Erzählt'); listen(`Zu deiner Frage „${box.question}“: `); }}>
          <Icon name="mic" size={13} /> Erzählen
        </button>
      </div>
    </div>
  );
}

function BoxBody({ s, box }) {
  return (
    <>
      <Question box={box} />
      {box.items.map((x) => <Nudge key={x.id} s={s} x={x} boxId={box.id} />)}
    </>
  );
}
const openCount = (box) => box.items.filter((x) => x.status === 'offen').length + (box.question && !box.answered ? 1 : 0);

export default function Coach({ s }) {
  const { briefing: b, busy: isBusy, error: err } = useBriefing();
  const [sel, setSel] = useState(null);
  const hasKey = !!getAi().apiKey;

  // Kommt von selbst: beim ersten Öffnen am Tag
  useEffect(() => {
    if (hasKey && autoCoach() && (!b || b.date !== today()) && !running) runCoach(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boxes = b?.boxes || [];
  const current = boxes.find((x) => x.id === sel) || boxes.find((x) => openCount(x) > 0) || boxes[0];
  const idx = boxes.indexOf(current);
  const next = boxes.slice(idx + 1).find((x) => openCount(x) > 0) || boxes[idx + 1];
  const allDone = boxes.length > 0 && boxes.every((x) => openCount(x) === 0);

  return (
    <section className="card checkin coach">
      <div className="sec-h" style={{ padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span>
          Dein Coach
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => listen()} aria-label="Dem Coach erzählen">
            <Icon name="mic" size={15} />
          </button>
          {hasKey && (
            <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => runCoach(s)} disabled={isBusy} aria-label="Neues Briefing holen">
              <Icon name="refresh" size={15} />
            </button>
          )}
        </span>
      </div>

      {isBusy && (
        <div className="coach-busy">
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="sub">Ich gehe deine Themen durch und suche passendes Material … (ca. 30 Sek.)</span>
        </div>
      )}
      {!isBusy && b?.summary && <p className="coach-summary">{b.summary}</p>}
      {!isBusy && b && b.date !== today() && <span className="tiny">Stand: {relDays(diffDays(b.date, today()))}</span>}

      {!isBusy && boxes.length > 0 && (
        <>
          <div className="box-tabs" role="tablist" aria-label="Themen">
            {boxes.map((x) => {
              const def = BOXES.find((d) => d.id === x.id);
              const n = openCount(x);
              return (
                <button key={x.id} type="button" role="tab" aria-selected={x === current} className={x === current ? 'box-tab on' : 'box-tab'} onClick={() => setSel(x.id)}>
                  <Icon name={def.icon} size={14} /> {def.title}
                  {n > 0 ? <span className="badge">{n}</span> : <Icon name="check" size={12} />}
                </button>
              );
            })}
          </div>
          {current && <BoxBody s={s} box={current} />}
          {next && next !== current && (
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-end', fontSize: 15 }} onClick={() => setSel(next.id)}>
              Weiter: {BOXES.find((d) => d.id === next.id).title} →
            </button>
          )}
          {allDone && <span className="sub">Alles durch – stark. Morgen kommt das nächste Briefing von selbst.</span>}
        </>
      )}

      {!isBusy && !b && hasKey && (
        <>
          <span className="sub" style={{ lineHeight: 1.45 }}>Dein Coach geht jeden Tag deine Themen durch – Weiterbildung, Karriere, Menschen, Ausgehen, News, Gesundheit – pusht dich mit kleinen Schritten und bringt passendes Material mit.</span>
          <button type="button" className="btn small" onClick={() => runCoach(s)}>Jetzt Briefing holen</button>
        </>
      )}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {!hasKey && <a href="#/einstellungen" className="link-btn">API-Schlüssel hinterlegen</a>}

      <div className="coach-foot">
        <button type="button" className="tell" onClick={() => listen()}>
          <Icon name="mic" size={16} /> Erzähl mir, wie es läuft
        </button>
        <a href="#/gedaechtnis" className="tiny" style={{ color: 'var(--accent)' }}>Was Life über dich weiß ({(s.memory || []).length})</a>
      </div>
    </section>
  );
}

// Die Coach-Box eines Lebensbereichs (auf der Bereichsseite)
export function CoachBox({ s, areaId }) {
  const { briefing: b } = useBriefing();
  const def = boxOfArea(areaId);
  const box = def && b?.boxes?.find((x) => x.id === def.id);
  if (!box || openCount(box) === 0) return null;
  return (
    <section className="card checkin coach">
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
        <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span>
        Coach: {def.title}
        {b.date !== today() && <span className="tiny" style={{ fontWeight: 400 }}>· {relDays(diffDays(b.date, today()))}</span>}
      </span>
      <BoxBody s={s} box={box} />
    </section>
  );
}
