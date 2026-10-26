import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, diffDays, fmtShort, today } from '../lib/dates';
import { addProject, addTask } from '../lib/actions';
import {
  addSession, addSport, analyzeSport, deleteSession, fmtDuration, fmtPace, guessSportName, hasDistance, lastAnalysis, parseDuration, parseGarminCsv,
  removeSport, SPORT_PRESETS, updateSport, weekStats,
} from '../lib/health';
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

function Analysis({ s, sport }) {
  const [a, setA] = useState(() => lastAnalysis(sport.id));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setA(await analyzeSport(s, sport.id));
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const plan = (x) => {
    addTask({ title: x.titel, areaId: 'koerper', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
    toast(`Eingeplant für ${fmtShort(addDays(today(), Math.max(0, x.tage_ab_heute || 0)))}`);
  };
  return (
    <section className="card checkin" style={{ gap: 10 }}>
      <div className="sec-h" style={{ padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> KI-Analyse
        </span>
        {a && <span className="tiny">{a.date === today() ? 'heute' : fmtShort(a.date)}</span>}
      </div>
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich schaue mir Ziel, Rennen und Daten an …</span></div>}
      {!busy && a && (
        <>
          <p className="coach-summary">{a.stand}</p>
          {a.prognose && <span className="sub"><b>Prognose:</b> {a.prognose}</span>}
          {a.staerken?.length > 0 && <div className="analysis-list"><b>Stark</b>{a.staerken.map((x, i) => <span key={i}>– {x}</span>)}</div>}
          {a.verbessern?.length > 0 && <div className="analysis-list"><b>Verbessern</b>{a.verbessern.map((x, i) => <span key={i}>– {x}</span>)}</div>}
          {a.naechste_einheiten?.length > 0 && (
            <div className="analysis-list">
              <b>Nächste Einheiten</b>
              {a.naechste_einheiten.map((x, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1 }}>{x.titel}{x.tage_ab_heute ? <span className="tiny"> · {fmtShort(addDays(today(), x.tage_ab_heute))}</span> : null}</span>
                  <button type="button" className="pill" onClick={() => plan(x)}>Planen</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      <button type="button" className="btn small" onClick={run} disabled={busy || !getAi().apiKey}>{a ? 'Neu analysieren' : 'Daten analysieren'}</button>
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

        <Analysis s={s} sport={sport} />

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
