import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, diffDays, fmtShort, today } from '../lib/dates';
import { addProject, addTask } from '../lib/actions';
import {
  addSession, addSport, addSportEvent, deleteSession, removeSportEvent, searchSportEvents, sportCoach, SPORT_EVENT_STATUS, updateSportEvent, fmtDuration, fmtPace, guessSportName, hasDistance, lastAnalysis, parseDuration, parseGarminCsv,
  removeSport, SPORT_PRESETS, updateSport, weekStats,
} from '../lib/health';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { DateRangeField } from '../components/DateRange';
import { getAi } from '../lib/ai';
import MiniChart from '../components/MiniChart';
import PaceCalc from '../components/PaceCalc';
import { Back, Chevron, Field, Icon, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const GREEN = '#2FA36B';
const sportSubId = (s) => s.areas.find((a) => a.id === 'koerper')?.subs.find((x) => x.name === 'Sport')?.id || null;

function weekSummary(s, sport) {
  const w = weekStats(s, sport.id, 1)[0];
  if (!w.count) return 'Diese Woche noch nichts';
  return [hasDistance(sport) && w.value ? `${String(w.value).replace('.', ',')} km` : null, `${w.count} ${w.count === 1 ? 'Einheit' : 'Einheiten'}`, w.minutes ? fmtDuration(w.minutes) + ' h' : null].filter(Boolean).join(' · ');
}

// ---------- Übersicht: Sportarten ----------
function SportList({ s }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const missing = SPORT_PRESETS.filter((p) => !s.sports.some((x) => x.name === p.name));
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/koerper" label="Körperliche Gesundheit" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Sport</h1>
            {s.sports.length > 0 && <button type="button" className="link-btn" onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Bearbeiten'}</button>}
          </div>
        </div>
        {s.sports.length === 0 && <div className="notice">Füg deine Sportarten hinzu. Jede bekommt ihre eigene Seite mit Einheiten, Verlauf, Projekten/Rennen und KI-Analyse.</div>}
        <div className="list">
          {s.sports.map((sp) => (
            <div key={sp.id} className="row" style={{ minHeight: 64 }}>
              <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: GREEN }}><Icon name={sp.icon || 'heart'} size={17} /></span>
              <a href={`#/sport/${sp.id}`} className="row-main">
                <span className="row-title strong">{sp.name}</span>
                <span className="row-meta">{weekSummary(s, sp)}</span>
              </a>
              {edit ? (
                <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`„${sp.name}“ entfernen? Die Einheiten bleiben gespeichert.`) && removeSport(sp.id)}>Entfernen</button>
              ) : <Chevron />}
            </div>
          ))}
        </div>
        <section className="card" style={{ gap: 10 }}>
          <span className="label" style={{ padding: 0 }}>Sportart hinzufügen</span>
          {missing.length > 0 && (
            <div className="chips">
              {missing.map((p) => <button key={p.name} type="button" className="chip soft" onClick={() => { addSport(p.name); toast(`${p.name} hinzugefügt`); }}>+ {p.name}</button>)}
            </div>
          )}
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (addSport(text)) toast('Hinzugefügt'); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Eigene, z.B. Klettern" aria-label="Eigene Sportart" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        </section>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

// ---------- Eine Sportart ----------
function SessionForm({ sport }) {
  const [f, setF] = useState({ date: today(), distance: '', time: '', hr: '', notes: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dist = hasDistance(sport);
  const save = (e) => {
    e.preventDefault();
    addSession({ sportId: sport.id, date: f.date, distance: dist ? parseFloat(f.distance.replace(',', '.')) || null : null, duration: parseDuration(f.time), hr: f.hr, notes: f.notes });
    setF({ date: today(), distance: '', time: '', hr: '', notes: '' });
    toast('Einheit gespeichert');
  };
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="calc-grid">
        <label className="field"><span>Datum</span><input className="input" type="date" value={f.date} onChange={set('date')} /></label>
        {dist && <label className="field"><span>km</span><input className="input" inputMode="decimal" value={f.distance} onChange={set('distance')} placeholder="12,5" /></label>}
        <label className="field"><span>Zeit</span><input className="input" value={f.time} onChange={set('time')} placeholder={dist ? '1:02:30' : '45'} /></label>
        <label className="field"><span>Ø Puls</span><input className="input" inputMode="numeric" value={f.hr} onChange={set('hr')} placeholder="150" /></label>
      </div>
      <input className="input" value={f.notes} onChange={set('notes')} placeholder="Notiz, z.B. „Intervalle 6×1 km, Beine schwer“" aria-label="Notiz" />
      <button type="submit" className="btn small" disabled={dist ? !f.distance && !f.time : !f.time && !f.notes}>Einheit speichern</button>
    </form>
  );
}

function GarminImport({ s, sport }) {
  const ref = useRef(null);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rows = parseGarminCsv(await file.text());
    if (!rows.length) {
      toast('Keine Aktivitäten erkannt – bitte die CSV aus Garmin Connect nehmen');
      return;
    }
    let n = 0;
    rows.forEach((r) => {
      const name = guessSportName(r.type);
      const sportId = name === sport.name ? sport.id : addSport(name);
      if (addSession({ sportId, date: r.date, distance: r.distance, duration: r.duration, hr: r.hr, notes: r.title, source: 'garmin', ext: r.ext })) n++;
    });
    toast(`${n} Aktivitäten importiert`);
    e.target.value = '';
  };
  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => ref.current?.click()}>Garmin-Export (CSV) importieren</button>
      <span className="tiny">Garmin Connect → Aktivitäten → „CSV exportieren“. Bis die iPhone-App kommt, oder sag einfach dem Assistenten „heute 12 km in 58 Minuten gelaufen“.</span>
    </>
  );
}

function ProjectSheet({ s, sport, open, onClose }) {
  const [f, setF] = useState({ name: '', date: '', goal: '' });
  const save = () => {
    addProject({ name: f.name, areaId: 'koerper', subId: sportSubId(s), due: f.date || null, extra: { sportId: sport.id, goalTime: f.goal || '' } });
    setF({ name: '', date: '', goal: '' });
    onClose();
    toast('Angelegt');
  };
  return (
    <Sheet open={open} title={sport.kind === 'laufen' ? 'Rennen oder Projekt' : 'Projekt'} onClose={onClose}>
      <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={sport.kind === 'laufen' ? 'z.B. Maratón de Buenos Aires' : 'z.B. 10 Klimmzüge schaffen'} /></Field>
      <Field label="Datum (optional)"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      {sport.kind === 'laufen' && <Field label="Zielzeit (optional)"><input className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="3:20:00" /></Field>}
      <button type="button" className="btn" onClick={save} disabled={!f.name.trim()}>Anlegen</button>
    </Sheet>
  );
}



// ---------- Coach-Vorschläge übernehmen ----------
const COACH_GROUPS = [
  { key: 'einheiten', label: 'Einheiten einplanen', title: (x) => x.titel, meta: (x) => (x.tage_ab_heute != null ? fmtShort(addDays(today(), Math.max(0, x.tage_ab_heute))) : 'heute') },
  { key: 'uebungen', label: 'Übungen (als Aufgabe mit Video-Suche)', title: (x) => x.titel, meta: (x) => x.warum },
  { key: 'events', label: 'Events merken', title: (x) => x.name, meta: (x) => [x.datum && fmtShort(x.datum), x.ort].filter(Boolean).join(' · ') },
];
function applyCoach(sport, sel) {
  for (const x of sel.einheiten || []) addTask({ title: x.titel, areaId: 'koerper', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
  for (const x of sel.uebungen || []) addTask({ title: x.titel, areaId: 'koerper', due: today(), url: `https://www.youtube.com/results?search_query=${encodeURIComponent(x.titel)}` });
  for (const x of sel.events || []) addSportEvent({ sportId: sport.id, name: x.name, date: x.datum, place: x.ort, url: x.url });
}

// ---------- Events dieser Sportart: notieren und suchen ----------
const NEXT_STATUS = { interessiert: 'angemeldet', angemeldet: 'dabei', dabei: 'interessiert' };
function SportEvents({ s, sport }) {
  const t = today();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', date: '', place: '', url: '' });
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const list = (s.sportEvents || []).filter((e) => e.sportId === sport.id).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const upcoming = list.filter((e) => e.status !== 'dabei' && (!e.date || e.date >= t));
  const past = list.filter((e) => e.status === 'dabei' || (e.date && e.date < t));
  const search = async (web) => {
    setBusy(web ? 'web' : 'ki');
    setErr(null);
    try {
      setRes(await searchSportEvents(s, sport.id, q.trim(), { web }));
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    if (addSportEvent({ sportId: sport.id, ...f })) toast('Event notiert');
    setF({ name: '', date: '', place: '', url: '' });
    setAdding(false);
  };
  const Row = ({ e }) => (
    <div className="row" style={{ minHeight: 60 }}>
      <span className="row-main">
        <span className="row-title strong">{e.name}</span>
        <span className="row-meta">{[e.date ? `${fmtShort(e.date)}${e.date >= t ? ` · in ${diffDays(t, e.date)} Tagen` : ''}` : 'Datum offen', e.place, e.result && `Ergebnis: ${e.result}`, e.note].filter(Boolean).join(' · ')}</span>
      </span>
      {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
      <button type="button" className={e.status === 'interessiert' ? 'pill' : 'pill on'} onClick={() => {
        const next = NEXT_STATUS[e.status];
        const patch = { status: next };
        if (next === 'dabei') { const r = prompt('Wie lief es? (z.B. Zeit oder Platz – optional)', e.result || ''); if (r !== null) patch.result = r; }
        updateSportEvent(e.id, patch);
      }}>{SPORT_EVENT_STATUS[e.status]}</button>
      <button type="button" className="x-btn" aria-label="Löschen" onClick={() => confirm(`„${e.name}“ löschen?`) && removeSportEvent(e.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
    </div>
  );
  return (
    <section className="group">
      <div className="sec-h">
        <h2 className="h2" style={{ fontSize: 19 }}>Events</h2>
        <button type="button" className="link-btn" onClick={() => setAdding(!adding)}>{adding ? 'Abbrechen' : '+ Notieren'}</button>
      </div>
      {adding && (
        <form className="card" style={{ gap: 8 }} onSubmit={(ev) => { ev.preventDefault(); save(); }}>
          <input className="input" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder={sport.kind === 'laufen' ? 'z.B. 21K de Buenos Aires' : 'z.B. Turnier im Club'} aria-label="Name" autoFocus />
          <DateRangeField single from={f.date} to="" onChange={(v) => setF({ ...f, date: v.from })} placeholder="Datum (optional)" title="Datum" />
          <input className="input" value={f.place} onChange={(ev) => setF({ ...f, place: ev.target.value })} placeholder="Ort (optional)" aria-label="Ort" />
          <input className="input" value={f.url} onChange={(ev) => setF({ ...f, url: ev.target.value })} placeholder="Link zur Anmeldung (optional)" aria-label="Link" inputMode="url" />
          <button type="submit" className="btn small" disabled={!f.name.trim()}>Notieren</button>
        </form>
      )}
      <div className="list">
        {upcoming.length === 0 && <div className="empty">Noch keine Events. Notier dir Rennen, Turniere oder Lauftreffs – oder such unten nach neuen.</div>}
        {upcoming.map((e) => <Row key={e.id} e={e} />)}
      </div>
      {past.length > 0 && (
        <>
          <span className="label" style={{ padding: '4px 4px 0' }}>Vorbei</span>
          <div className="list">{[...past].reverse().map((e) => <Row key={e.id} e={e} />)}</div>
        </>
      )}
      <section className="card" style={{ gap: 10 }}>
        <span className="label" style={{ padding: 0 }}>Events finden</span>
        <input className="input" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={sport.kind === 'laufen' ? 'z.B. „10K oder Halbmarathon bis März“' : `z.B. „${sport.name} Turniere für Anfänger“`} aria-label="Wonach suchen" />
        <div className="search-row">
          <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => search(false)}>{busy === 'ki' ? '…' : 'Ohne Internet'}</button>
          <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => search(true)}>{busy === 'web' ? '…' : '🔍 Mit Internet'}</button>
        </div>
        <span className="tiny">Ohne Internet: bekannte, regelmäßige Events aus dem KI-Wissen (günstig). Mit Internet: aktuelle Termine mit Link (ca. 2–3 Cent).</span>
        {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche aktuelle Termine …' : 'Ich überlege …'}</span></div>}
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        {!busy && res?.hint && <span className="sub">{res.hint}</span>}
        {!busy && res?.events.map((e) => (
          <div key={e.id} className="option" style={{ alignItems: 'center' }}>
            <span className="row-main">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{e.name}</span>
              <span className="tiny">{[e.date && fmtShort(e.date), e.place, e.note].filter(Boolean).join(' · ')}</span>
            </span>
            {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
            <button type="button" className="pill on" onClick={() => { addSportEvent({ sportId: sport.id, ...e }); setRes({ ...res, events: res.events.filter((x) => x.id !== e.id) }); toast('Notiert'); }}>Merken</button>
          </div>
        ))}
      </section>
    </section>
  );
}

function SportDetail({ s, sport }) {
  const [projOpen, setProjOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(sport.kind === 'laufen' && !s.sessions.some((x) => x.sportId === sport.id));
  const t = today();
  const dist = hasDistance(sport);
  const weeks = weekStats(s, sport.id, 12);
  const thisWeek = weeks.at(-1);
  const sessions = s.sessions.filter((x) => x.sportId === sport.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const projects = s.projects.filter((p) => p.sportId === sport.id && p.status === 'aktiv').sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
  const long = dist ? Math.max(0, ...sessions.filter((x) => x.date >= addDays(t, -28)).map((x) => x.distance || 0)) : 0;
  const chart = weeks.map((w) => ({ date: w.date, value: dist ? w.value : Math.round(w.minutes) }));

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/sport" label="Sport" />
          <div className="title-row">
            <span className="block-icon" style={{ width: 40, height: 40, borderRadius: 12, background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: GREEN }}><Icon name={sport.icon || 'heart'} size={22} /></span>
            <h1 className="h1 sm">{sport.name}</h1>
          </div>
          <input className="input goal-input" defaultValue={sport.goal} key={sport.id} placeholder="Dein Ziel, z.B. Marathon unter 3:20" onBlur={(e) => e.target.value !== sport.goal && updateSport(sport.id, { goal: e.target.value })} aria-label="Ziel" />
        </div>

        {projects.filter((p) => p.due && p.due >= t).slice(0, 1).map((p) => (
          <a key={p.id} href={`#/projekt/${p.id}`} className="card countdown">
            <span className="tiny">Nächstes Ziel</span>
            <span style={{ fontSize: 19, fontWeight: 700 }}>{p.name}</span>
            <span className="sub">noch <b style={{ color: GREEN, fontSize: 22 }}>{diffDays(t, p.due)}</b> Tage · {fmtShort(p.due)}{p.goalTime ? ` · Ziel ${p.goalTime}` : ''}</span>
          </a>
        ))}

        <section className="card" style={{ gap: 8 }}>
          <div className="stat-row">
            <div><span className="tiny">Diese Woche</span><b>{dist ? `${String(thisWeek.value).replace('.', ',')} km` : `${thisWeek.count}×`}</b></div>
            <div><span className="tiny">Zeit</span><b>{thisWeek.minutes ? fmtDuration(thisWeek.minutes) : '–'}</b></div>
            {dist ? <div><span className="tiny">Längster (4 Wo.)</span><b>{long ? `${String(long).replace('.', ',')} km` : '–'}</b></div> : <div><span className="tiny">Einheiten gesamt</span><b>{sessions.length}</b></div>}
          </div>
          <span className="label" style={{ padding: 0 }}>{dist ? 'Kilometer pro Woche' : 'Minuten pro Woche'} · 12 Wochen</span>
          <MiniChart entries={chart} color={GREEN} unit={dist ? 'km' : 'min'} />
        </section>

        <PlanChat
          title={`Dein ${sport.kind === 'laufen' ? 'Lauf-' : ''}Coach`}
          intro="Frag mich zu deinem Training: Wo stehst du, was solltest du diese Woche machen, welche Übungen helfen? Ich kenne deine Einheiten, Ziele, Rennen und Verletzungen."
          history={chatOf(s, `sport:${sport.id}`)}
          onSave={(h) => saveChatOf(`sport:${sport.id}`, h)}
          onAsk={(hist, o) => sportCoach(s, sport.id, hist, o)}
          prefKey="sport"
          groups={COACH_GROUPS}
          onApply={(sel) => applyCoach(sport, sel)}
          chips={['Wie stehe ich gerade da?', 'Plan für nächste Woche', 'Übungen für Kraft & Mobilität', 'Was sollte ich verbessern?']}
          webChips={[]}
        />

        <SportEvents s={s} sport={sport} />

        <section className="group">
          <div className="sec-h">
            <h2 className="h2" style={{ fontSize: 19 }}>{sport.kind === 'laufen' ? 'Rennen & Projekte' : 'Projekte'}</h2>
            <button type="button" className="link-btn" onClick={() => setProjOpen(true)}>+ Neu</button>
          </div>
          <div className="list">
            {projects.length === 0 && <div className="empty">{sport.kind === 'laufen' ? 'Trag dein nächstes Rennen ein – mit Datum und Zielzeit.' : 'Z.B. ein Ziel für die nächsten Wochen.'}</div>}
            {projects.map((p) => (
              <a key={p.id} href={`#/projekt/${p.id}`} className="row">
                <span className="row-main">
                  <span className="row-title plain">{p.name}</span>
                  <span className="row-meta">{[p.due && `${fmtShort(p.due)}${p.due >= t ? ` · in ${diffDays(t, p.due)} Tagen` : ''}`, p.goalTime && `Ziel ${p.goalTime}`].filter(Boolean).join(' · ') || 'Ohne Datum'}</span>
                </span>
                <Chevron />
              </a>
            ))}
          </div>
        </section>

        <section className="card" style={{ gap: 10 }}>
          <span className="label" style={{ padding: 0 }}>Einheit eintragen</span>
          <SessionForm sport={sport} />
          <GarminImport s={s} sport={sport} />
        </section>

        {sport.kind === 'laufen' && (
          <section className="card" style={{ gap: 10 }}>
            <button type="button" className="sec-h" style={{ padding: 0, border: 0, background: 'none', width: '100%', color: 'inherit' }} onClick={() => setCalcOpen(!calcOpen)} aria-expanded={calcOpen}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}><Icon name="calc" size={17} /> Zeitrechner</span>
              <span className="tiny">{calcOpen ? 'zuklappen' : 'öffnen'}</span>
            </button>
            {calcOpen && <PaceCalc />}
          </section>
        )}

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Letzte Einheiten</h2></div>
          <div className="list">
            {sessions.length === 0 && <div className="empty">Noch keine Einheiten.</div>}
            {sessions.slice(0, 20).map((x) => (
              <div key={x.id} className="row">
                <span className="date-badge" style={{ background: 'color-mix(in srgb, #2FA36B 12%, transparent)', color: GREEN }}><b style={{ fontSize: 16 }}>{new Date(x.date + 'T12:00:00').getDate()}</b><span className="tiny" style={{ color: 'inherit' }}>{fmtShort(x.date).replace(/^\d+\.\s*/, '')}</span></span>
                <span className="row-main">
                  <span className="row-title plain">{[x.distance && `${String(x.distance).replace('.', ',')} km`, x.duration && fmtDuration(x.duration)].filter(Boolean).join(' · ') || x.notes || 'Einheit'}</span>
                  <span className="row-meta">{[x.distance && x.duration && fmtPace(x.duration / x.distance), x.hr && `♥ ${x.hr}`, x.distance || x.duration ? x.notes : null, x.source === 'garmin' && 'Garmin'].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" className="x-btn" aria-label="Einheit löschen" onClick={() => deleteSession(x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <ProjectSheet s={s} sport={sport} open={projOpen} onClose={() => setProjOpen(false)} />
      <TabBar active="bereiche" />
    </>
  );
}

export default function Sport({ id }) {
  const s = useStore();
  if (!id) return <SportList s={s} />;
  const sport = s.sports.find((x) => x.id === id);
  if (!sport) return <Missing />;
  return <SportDetail s={s} sport={sport} />;
}
