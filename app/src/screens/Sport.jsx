import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, diffDays, fmtShort, today } from '../lib/dates';
import { addProject, addTask } from '../lib/actions';
import {
  addSession, addSport, addSportEvent, deleteSession, removeSportEvent, searchSportEvents, sportRegions, setSportRegions, sportPeriods, setSportPeriods, sportCoach, SPORT_EVENT_STATUS, updateSportEvent, fmtDuration, fmtPace, guessSportName, hasDistance, lastAnalysis, parseDuration, parseGarminCsv,
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

// ---------- Sport = eine Event-Seite für alle Sportarten (Mateo, v0.30) ----------
// Oben suchen (eine, mehrere oder alle Sportarten), darunter: Gemerkt (nach Sportart), Ich nehme teil, Vorbei
function SportTag({ s, id }) {
  const sp = s.sports.find((x) => x.id === id);
  return sp ? <span className="link-tag" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: GREEN }}>{sp.name}</span> : null;
}
const when = (d, t) => (d ? `${fmtShort(d)}${d >= t ? ` · in ${diffDays(t, d)} Tagen` : ''}` : 'Datum offen');

function SportsPage({ s }) {
  const t = today();
  const [pick, setPick] = useState([]); // leer = alle
  const regions = sportRegions(s);
  const [regPick, setRegPick] = useState(() => [sportRegions(s)[0]].filter(Boolean));
  const [editReg, setEditReg] = useState(false);
  const periods = sportPeriods(s);
  const [period, setPeriod] = useState(() => sportPeriods(s)[1] || sportPeriods(s)[0] || '');
  const [editPer, setEditPer] = useState(false);
  const [newPer, setNewPer] = useState('');
  const [newReg, setNewReg] = useState('');
  const [editSports, setEditSports] = useState(false);
  const [newSport, setNewSport] = useState('');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', date: '', place: '', url: '', sportId: '' });
  const [showPast, setShowPast] = useState(false);
  const all = (s.sportEvents || []).filter((e) => s.sports.some((x) => x.id === e.sportId)).sort((a, b) => ((a.date || '9') < (b.date || '9') ? -1 : 1));
  const isPast = (e) => e.status === 'dabei' || (e.date && e.date < t);
  const liked = all.filter((e) => e.status === 'interessiert' && !isPast(e));
  const going = all.filter((e) => e.status === 'angemeldet' && !isPast(e));
  const past = all.filter(isPast).reverse();
  const missing = SPORT_PRESETS.filter((p) => !s.sports.some((x) => x.name === p.name));
  const toggle = (id) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);

  const search = async (web) => {
    setBusy(web ? 'web' : 'ki');
    setErr(null);
    try {
      setRes(await searchSportEvents(s, pick, q.trim(), { web, regions: regPick.filter((r) => regions.includes(r)), period: periods.includes(period) ? period : '' }));
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const done = (e) => {
    const r = prompt('Wie lief es? (z.B. Zeit oder Platz – optional)', e.result || '');
    updateSportEvent(e.id, { status: 'dabei', ...(r !== null ? { result: r } : {}) });
    toast('Stark!');
  };
  const Row = ({ e, children }) => (
    <div className="row" style={{ minHeight: 60 }}>
      <span className="row-main">
        <span className="row-title strong">{e.name}</span>
        <span className="row-meta">{[when(e.date, t), e.place, e.result && `Ergebnis: ${e.result}`, e.note].filter(Boolean).join(' · ')}</span>
      </span>
      {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
      {children}
      <button type="button" className="x-btn" aria-label={`${e.name} löschen`} onClick={() => confirm(`„${e.name}“ löschen?`) && removeSportEvent(e.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
    </div>
  );
  const likedBySport = s.sports.map((sp) => ({ sp, list: liked.filter((e) => e.sportId === sp.id) })).filter((g) => g.list.length);

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/koerper" label="Körperliche Gesundheit" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Sport-Events</h1>
            <button type="button" className="link-btn" onClick={() => { setAdding(!adding); setF({ ...f, sportId: f.sportId || pick[0] || s.sports[0]?.id || '' }); }}>{adding ? 'Abbrechen' : '+ Notieren'}</button>
          </div>
        </div>

        {adding && (
          <form className="card" style={{ gap: 8 }} onSubmit={(ev) => { ev.preventDefault(); if (addSportEvent({ ...f })) toast('Notiert'); setF({ name: '', date: '', place: '', url: '', sportId: f.sportId }); setAdding(false); }}>
            <div className="chips">{s.sports.map((sp) => <button key={sp.id} type="button" className={f.sportId === sp.id ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, sportId: sp.id })}>{sp.name}</button>)}</div>
            <input className="input" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="z.B. 21K de Buenos Aires" aria-label="Name" autoFocus />
            <DateRangeField single from={f.date} to="" onChange={(v) => setF({ ...f, date: v.from })} placeholder="Datum (optional)" title="Datum" />
            <input className="input" value={f.place} onChange={(ev) => setF({ ...f, place: ev.target.value })} placeholder="Ort (optional)" aria-label="Ort" />
            <input className="input" value={f.url} onChange={(ev) => setF({ ...f, url: ev.target.value })} placeholder="Link zur Anmeldung (optional)" aria-label="Link" inputMode="url" />
            <button type="submit" className="btn small" disabled={!f.name.trim() || !f.sportId}>Notieren</button>
          </form>
        )}

        <section className="card checkin" style={{ gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="search" size={15} color="currentColor" /></span> Events finden
          </span>
          <div className="chips">
            <button type="button" className={!pick.length ? 'chip on' : 'chip'} onClick={() => setPick([])}>Alle</button>
            {s.sports.map((sp) => (
              <button key={sp.id} type="button" className={editSports ? 'chip editing' : pick.includes(sp.id) ? 'chip on' : 'chip'} onClick={() => (editSports ? confirm(`„${sp.name}“ entfernen? Die Events dazu bleiben gespeichert, werden aber ausgeblendet.`) && removeSport(sp.id) : toggle(sp.id))}>
                {sp.name}{editSports && <Icon name="x" size={11} />}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setEditSports(!editSports)} aria-label="Sportarten bearbeiten">{editSports ? 'Fertig' : <Icon name="edit" size={14} />}</button>
          </div>
          {editSports && (
            <>
              {missing.length > 0 && <div className="chips">{missing.map((p) => <button key={p.name} type="button" className="chip soft" onClick={() => addSport(p.name)}>+ {p.name}</button>)}</div>}
              <form className="block-add" onSubmit={(ev) => { ev.preventDefault(); addSport(newSport); setNewSport(''); }}>
                <input className="input" value={newSport} onChange={(ev) => setNewSport(ev.target.value)} placeholder="Eigene Sportart, z.B. Klettern" aria-label="Eigene Sportart" />
                <button type="submit" className="btn small" disabled={!newSport.trim()}>+</button>
              </form>
            </>
          )}
          {s.sports.length === 0 && !editSports && <span className="sub">Tippe auf den Stift und füg deine Sportarten hinzu.</span>}
          <span className="tiny" style={{ marginBottom: -4 }}>Wo?</span>
          <div className="chips">
            {regions.map((r) => (
              <button key={r} type="button" className={editReg ? 'chip editing' : regPick.includes(r) ? 'chip on' : 'chip'} onClick={() => (editReg ? (setSportRegions(regions.filter((x) => x !== r)), setRegPick(regPick.filter((x) => x !== r))) : setRegPick(regPick.includes(r) ? regPick.filter((x) => x !== r) : [...regPick, r]))}>
                📍 {r}{editReg && <Icon name="x" size={11} />}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setEditReg(!editReg)} aria-label="Regionen bearbeiten">{editReg ? 'Fertig' : <Icon name="edit" size={14} />}</button>
          </div>
          {editReg && (
            <form className="block-add" onSubmit={(ev) => { ev.preventDefault(); const r = newReg.trim(); if (r && !regions.includes(r)) { setSportRegions([...regions, r]); setRegPick([...regPick, r]); } setNewReg(''); }}>
              <input className="input" value={newReg} onChange={(ev) => setNewReg(ev.target.value)} placeholder="z.B. Córdoba, Mendoza, Uruguay" aria-label="Neue Region" />
              <button type="submit" className="btn small" disabled={!newReg.trim()}>+</button>
            </form>
          )}
          <span className="tiny" style={{ marginBottom: -4 }}>Wann?</span>
          <div className="chips">
            {periods.map((x) => (
              <button key={x} type="button" className={editPer ? 'chip editing' : period === x ? 'chip on' : 'chip'} onClick={() => (editPer ? setSportPeriods(periods.filter((y) => y !== x)) : setPeriod(period === x ? '' : x))}>
                🗓 {x}{editPer && <Icon name="x" size={11} />}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setEditPer(!editPer)} aria-label="Zeiträume bearbeiten">{editPer ? 'Fertig' : <Icon name="edit" size={14} />}</button>
          </div>
          {editPer && (
            <form className="block-add" onSubmit={(ev) => { ev.preventDefault(); const x = newPer.trim(); if (x && !periods.includes(x)) { setSportPeriods([...periods, x]); setPeriod(x); } setNewPer(''); }}>
              <input className="input" value={newPer} onChange={(ev) => setNewPer(ev.target.value)} placeholder="z.B. Frühling 2027, bis Juni, Herbst" aria-label="Neuer Zeitraum" />
              <button type="submit" className="btn small" disabled={!newPer.trim()}>+</button>
            </form>
          )}
          <input className="input" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="z.B. „Maratón de Buenos Aires“ oder „Halbmarathon bis März“" aria-label="Wonach suchen" />
          <div className="search-row">
            <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey || !s.sports.length} onClick={() => search(false)}>{busy === 'ki' ? '…' : 'Ohne Internet'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey || !s.sports.length} onClick={() => search(true)}>{busy === 'web' ? '…' : '🔍 Mit Internet'}</button>
          </div>
          <span className="tiny">Ohne Internet: bekannte, regelmäßige Events aus dem KI-Wissen (günstig). Mit Internet: aktuelle Termine mit Link – ein Renn-Name wird gezielt gesucht (ca. 3–5 Cent).</span>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche aktuelle Termine …' : 'Ich überlege …'}</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && res?.hint && <span className="sub">{res.hint}</span>}
          {!busy && res?.events.map((e) => (
            <div key={e.id} className="option" style={{ alignItems: 'center' }}>
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 600 }}><SportTag s={s} id={e.sportId} />{e.name}</span>
                <span className="tiny">{[e.date && fmtShort(e.date), e.place, e.note].filter(Boolean).join(' · ')}</span>
              </span>
              {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              {(() => {
                const saved = (s.sportEvents || []).find((x) => x.sportId === e.sportId && x.name.trim().toLowerCase() === e.name.trim().toLowerCase());
                return saved
                  ? <button type="button" className="pill" onClick={() => { removeSportEvent(saved.id); toast('Nicht mehr gemerkt'); }} aria-label={`${e.name} nicht mehr merken`}>Gemerkt ✓</button>
                  : <button type="button" className="pill on" onClick={() => { addSportEvent({ ...e }); toast('Gemerkt'); }}>Merken</button>;
              })()}
            </div>
          ))}
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Ich nehme teil</h2><span className="tiny">{going.length}</span></div>
          <div className="list">
            {going.length === 0 && <div className="empty">Noch nichts. Bei einem gemerkten Event auf „Anmelden“ tippen, sobald du dabei bist.</div>}
            {going.map((e) => (
              <Row key={e.id} e={e}>
                <span style={{ flexShrink: 0 }}><SportTag s={s} id={e.sportId} /></span>
                {e.date && e.date <= t ? <button type="button" className="pill on" onClick={() => done(e)}>Dabei ✓</button> : <button type="button" className="pill" onClick={() => updateSportEvent(e.id, { status: 'interessiert' })} aria-label="Doch nicht angemeldet">↩</button>}
              </Row>
            ))}
          </div>
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Gemerkt</h2><span className="tiny">{liked.length}</span></div>
          {likedBySport.length === 0 && <div className="list"><div className="empty">Noch nichts gemerkt. Such oben nach Events und tippe auf „Merken“.</div></div>}
          {likedBySport.map(({ sp, list }) => (
            <div key={sp.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label" style={{ padding: '0 4px', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={sp.icon || 'heart'} size={14} color={GREEN} />{sp.name} ({list.length})</span>
              <div className="list">{list.map((e) => <Row key={e.id} e={e}><button type="button" className="pill on" onClick={() => { updateSportEvent(e.id, { status: 'angemeldet' }); toast('Unter „Ich nehme teil“'); }}>Anmelden</button></Row>)}</div>
            </div>
          ))}
        </section>

        {past.length > 0 && (
          <section className="group">
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 4 }} onClick={() => setShowPast(!showPast)}>{showPast ? 'Vorbei ausblenden' : `Vorbei (${past.length})`}</button>
            {showPast && <div className="list">{past.map((e) => (
              <Row key={e.id} e={e}>
                <span style={{ flexShrink: 0 }}><SportTag s={s} id={e.sportId} /></span>
                {e.status !== 'dabei' && <button type="button" className="pill" onClick={() => done(e)}>War dabei</button>}
              </Row>
            ))}</div>}
          </section>
        )}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Sport() {
  const s = useStore();
  return <SportsPage s={s} />;
}
