import { takeFlag } from '../lib/flags';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import SourceLinks, { ModeToggle, useSearchMode } from '../components/SourceLinks';
import { addDays, diffDays, fmtShort, today } from '../lib/dates';
import { addProject, addTask } from '../lib/actions';
import {
  addSession, addSport, addSportEvent, deleteSession, removeSportEvent, searchSportEvents, distOf, sportRegions, setSportRegions, sportPeriods, setSportPeriods, sportCoach, SPORT_EVENT_STATUS, updateSportEvent, fmtDuration, fmtPace, guessSportName, hasDistance, lastAnalysis, parseDuration, parseGarminCsv,
  removeSport, SPORT_PRESETS, updateSport, weekStats,
} from '../lib/health';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { DateRangeField } from '../components/DateRange';
import { getAi } from '../lib/ai';
import { cityHere, searchWithTool } from '../lib/outings';
import MiniChart from '../components/MiniChart';
import PaceCalc from '../components/PaceCalc';
import { RemovedButton } from '../components/RemovedList';
import { archiveSportEvent, restoreSportEvent } from '../lib/actions';
import { Back, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast, Info } from '../components/ui';
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
      <Info>Garmin Connect → Aktivitäten → „CSV exportieren“. Bis die iPhone-App kommt, oder sag einfach dem Assistenten „heute 12 km in 58 Minuten gelaufen“.</Info>
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
  const [regOpen, setRegOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [pBusy, setPBusy] = useState(false);
  const periods = sportPeriods(s);
  const [period, setPeriod] = useState(() => sportPeriods(s)[1] || sportPeriods(s)[0] || '');
  const [editPer, setEditPer] = useState(false);
  const [newPer, setNewPer] = useState('');
  const [newReg, setNewReg] = useState('');
  const [editSports, setEditSports] = useState(false);
  const [newSport, setNewSport] = useState('');
  const [q, setQ] = useState('');
  const [smode, setSmode] = useSearchMode('rennen');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (takeFlag('life-open-new-sport')) { setAdding(true); setF({ name: '', date: '', place: '', url: '', dist: '', sportId: pick[0] || s.sports[0]?.id || '' }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState({ name: '', date: '', place: '', url: '', sportId: '' });
  const [showPast, setShowPast] = useState(false);
  const [tab, setTabState] = useState(() => { try { return localStorage.getItem('life-app-sport-tab') || 'meine'; } catch { return 'meine'; } });
  const setTab = (v) => { setTabState(v); try { localStorage.setItem('life-app-sport-tab', v); } catch {} };
  const all = (s.sportEvents || []).filter((e) => s.sports.some((x) => x.id === e.sportId) && (!pick.length || pick.includes(e.sportId))).sort((a, b) => ((a.date || '9') < (b.date || '9') ? -1 : 1));
  const isPast = (e) => e.status === 'dabei' || (e.date && e.date < t);
  const liked = all.filter((e) => e.status === 'interessiert' && !isPast(e));
  const going = all.filter((e) => e.status === 'angemeldet' && !isPast(e));
  const past = all.filter(isPast).reverse();
  const missing = SPORT_PRESETS.filter((p) => !s.sports.some((x) => x.name === p.name));
  const toggle = (id) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);

  // Gefundenes Rennen aus Link/Text übernehmen (v0.67): KI ohne Internet füllt das Formular vor, Mateo prüft
  const takeOver = async () => {
    const text = paste.trim();
    const url = (text.match(/https?:\/\/\S+/) || [''])[0];
    const sportId = pick[0] || s.sports[0]?.id || '';
    if (!getAi().apiKey) { setF({ name: '', date: '', place: '', url, sportId }); setAdding(true); setTab('meine'); return; }
    setPBusy(true);
    try {
      const r = await parseSportText(s, text);
      const sp = s.sports.find((x) => x.name.toLowerCase() === String(r.sportart || '').toLowerCase());
      setF({ name: r.name || '', date: /^\d{4}-\d{2}-\d{2}$/.test(r.datum || '') ? r.datum : '', place: r.ort || '', dist: r.distanz || '', url: url || '', sportId: sp?.id || sportId });
      setAdding(true); setPaste(''); setTab('meine');
      toast(r.name ? 'Bitte kurz prüfen und „Notieren“ tippen' : 'Konnte von der Seite nichts lesen – bitte Name selbst eintragen (Link ist übernommen)');
    } catch (e) { toast(e.message); } finally { setPBusy(false); }
  };
  const [fBusy, setFBusy] = useState(false);
  // KI füllt die übrigen Felder aus dem, was schon eingetragen ist (Name/Link/Ort) – eigene Angaben bleiben
  const fillAi = async () => {
    setFBusy(true);
    try {
      const r = await parseSportText(s, [f.name, f.place, f.url].filter(Boolean).join(' · '));
      const sp = s.sports.find((x) => x.name.toLowerCase() === String(r.sportart || '').toLowerCase());
      setF((o) => ({ ...o, name: /^https?:/.test(o.name) ? r.name || o.name : o.name || r.name || '', url: o.url || ((o.name.match(/https?:\/\/\S+/) || [''])[0]), date: o.date || (/^\d{4}-\d{2}-\d{2}$/.test(r.datum || '') ? r.datum : ''), place: o.place || r.ort || '', dist: o.dist || r.distanz || '', sportId: o.sportId || sp?.id || '' }));
      toast(r.name || r.datum ? 'Ausgefüllt – bitte kurz prüfen' : 'Nichts gefunden – bitte selbst ergänzen');
    } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel.' : e.message); } finally { setFBusy(false); }
  };
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
        <span className="row-meta">{[when(e.date, t), e.place, distOf(e), e.result && `Ergebnis: ${e.result}`].filter(Boolean).join(' · ')}</span>
      </span>
      {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
      {children}
      <button type="button" className="x-btn" aria-label={`${e.name} rausnehmen`} onClick={() => { archiveSportEvent(e.id); toast('Rausgenommen – unten zurückholbar'); }}><Icon name="x" size={12} color="var(--chev)" /></button>
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
          </div>
        </div>

        {/* v0.93 (Mateo): Sportarten-Leiste zum Wischen, darunter Reiter Finden / Meine Events / Rechner */}
        {tab !== 'rechner' && <>
        <div className="box-tabs">
          <button type="button" className={!pick.length ? 'chip on' : 'chip'} onClick={() => setPick([])}>Alle</button>
          {s.sports.map((sp) => (
            <button key={sp.id} type="button" className={editSports ? 'chip editing' : pick.includes(sp.id) ? 'chip on' : 'chip'} style={{ whiteSpace: 'nowrap' }} onClick={() => (editSports ? confirm(`„${sp.name}“ entfernen? Die Events dazu bleiben gespeichert, werden aber ausgeblendet.`) && removeSport(sp.id) : toggle(sp.id))}>
              {sp.name}{editSports && <Icon name="x" size={11} />}
            </button>
          ))}
          <button type="button" className={editSports ? 'chip on' : 'chip'} onClick={() => setEditSports(!editSports)} aria-label="Sportarten bearbeiten">{editSports ? 'Fertig' : <Icon name="edit" size={14} />}</button>
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
        </>}
        <Segmented full options={[{ id: 'meine', label: `Meine Events${going.length + liked.length ? ` · ${going.length + liked.length}` : ''}` }, { id: 'finden', label: 'Events finden' }, { id: 'rechner', label: 'Rechner' }]} value={tab} onChange={setTab} label="Ansicht" />


        {tab === 'finden' && <section className="card checkin" style={{ gap: 10 }}>
          <button type="button" className="city-bar" onClick={() => setRegOpen(true)} aria-label="Regionen wählen">
            <span style={{ fontSize: 18 }}>📍</span>
            <span className="row-main"><span className="row-meta">Wo?</span><span className="row-title strong">{regPick.filter((r) => regions.includes(r)).join(', ') || 'Überall'}</span></span>
            <span className="pill" style={{ fontSize: 13 }}>Wechseln ▾</span>
          </button>
          <RegionSheet s={s} open={regOpen} onClose={() => setRegOpen(false)} regions={regions} pick={regPick} setPick={setRegPick} />
          <span className="tiny" style={{ marginBottom: -4 }}>Wann?</span>
          <div className="chips">
            {periods.map((x) => (
              <button key={x} type="button" className={editPer ? 'chip editing' : period === x ? 'chip on' : 'chip'} onClick={() => (editPer ? setSportPeriods(periods.filter((y) => y !== x)) : setPeriod(period === x ? '' : x))}>
                🗓 {x}{editPer && <Icon name="x" size={11} />}
              </button>
            ))}
            <button type="button" className={editPer ? 'chip on' : 'chip'} onClick={() => setEditPer(!editPer)} aria-label="Zeiträume bearbeiten">{editPer ? 'Fertig' : <Icon name="edit" size={14} />}</button>
          </div>
          {editPer && (
            <form className="block-add" onSubmit={(ev) => { ev.preventDefault(); const x = newPer.trim(); if (x && !periods.includes(x)) { setSportPeriods([...periods, x]); setPeriod(x); } setNewPer(''); }}>
              <input className="input" value={newPer} onChange={(ev) => setNewPer(ev.target.value)} placeholder="z.B. Frühling 2027, bis Juni, Herbst" aria-label="Neuer Zeitraum" />
              <button type="submit" className="btn small" disabled={!newPer.trim()}>+</button>
            </form>
          )}
          <ModeToggle mode={smode} onChange={setSmode} />
          <input className="input" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="z.B. „Maratón de Buenos Aires“ oder „Halbmarathon bis März“" aria-label="Wonach suchen" />
          {smode === 'links' && <SourceLinks embedded s={s} area="rennen" instant query={[q || 'carreras running', periodWords(period)].filter(Boolean).join(' ')} city={regPick.filter((r) => regions.includes(r)).join(', ')} siteQuery={q} />}
          {smode === 'links' && (
            <div className="take-box">
              <span style={{ fontWeight: 650, fontSize: 14 }}>Etwas gefunden? Hier übernehmen</span>
              <textarea className="input" style={{ minHeight: 64 }} value={paste} onChange={(ev) => setPaste(ev.target.value)} placeholder="Link oder Text vom Rennen einfügen (Name, Datum, Ort …)" aria-label="Link oder Text einfügen" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn small" style={{ flex: 1 }} disabled={!paste.trim() || pBusy} onClick={takeOver}>{pBusy ? 'Ich lese die Seite …' : '✨ Übernehmen'}</button>
                <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => { setAdding(true); setF({ name: '', date: '', place: '', url: '', dist: '', sportId: f.sportId || pick[0] || s.sports[0]?.id || '' }); setTab('meine'); }}>Selbst eintragen</button>
              </div>
              <Info>Bei einem Link öffnet die KI die Seite und liest Name, Datum, Ort und Distanz (ca. 0,1 Cent). Du prüfst und speicherst.</Info>
            </div>
          )}
          {smode === 'ki' && <>
          <div className="search-row">
            <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey || !s.sports.length} onClick={() => search(false)}>{busy === 'ki' ? '…' : 'Ohne Internet'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey || !s.sports.length} onClick={() => search(true)}>{busy === 'web' ? '…' : '🔍 Mit Internet'}</button>
          </div>
          <Info>Ohne Internet: bekannte, regelmäßige Events aus dem KI-Wissen (günstig). Mit Internet: aktuelle Termine mit Link – ein Renn-Name wird gezielt gesucht (ca. 3–5 Cent).</Info>
          </>}
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche aktuelle Termine …' : 'Ich überlege …'}</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {smode === 'ki' && !busy && res?.hint && <span className="sub">{res.hint}</span>}
          {smode === 'ki' && !busy && res?.events.map((e) => (
            <div key={e.id} className="option" style={{ alignItems: 'center' }}>
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 600 }}><SportTag s={s} id={e.sportId} />{e.name}</span>
                <span className="tiny">{[e.date && fmtShort(e.date), e.place, e.dist].filter(Boolean).join(' · ')}</span>
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
        </section>}

        {tab === 'meine' && <>
        {/* v0.98 (Mateo): „+ Event notieren“ hier unten statt oben rechts, mit KI-Ausfüllen */}
        {!adding && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><button type="button" className="btn tint small" onClick={() => { setAdding(true); setF({ name: '', date: '', place: '', url: '', dist: '', sportId: f.sportId || pick[0] || s.sports[0]?.id || '' }); }}>+ Event notieren</button><span style={{ marginLeft: 'auto' }} /><RemovedButton items={(s.removedSportEvents || []).filter((e) => !pick.length || pick.includes(e.sportId))} storeKey="removedSportEvents" onRestore={restoreSportEvent} meta={(e) => [e.date && fmtShort(e.date), e.place, s.sports.find((x) => x.id === e.sportId)?.name].filter(Boolean).join(' · ')} /></div>}
        {adding && (
          <form className="card" style={{ gap: 8 }} onSubmit={(ev) => { ev.preventDefault(); if (addSportEvent({ ...f })) toast('Notiert'); setF({ name: '', date: '', place: '', url: '', sportId: f.sportId }); setAdding(false); }}>
            <div className="chips">{s.sports.map((sp) => <button key={sp.id} type="button" className={f.sportId === sp.id ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, sportId: sp.id })}>{sp.name}</button>)}</div>
            <input className="input" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="Name oder Link, z.B. 21K de Buenos Aires" aria-label="Name" />
            <DateRangeField single from={f.date} to="" onChange={(v) => setF({ ...f, date: v.from })} placeholder="Datum (optional)" title="Datum" />
            <input className="input" value={f.place} onChange={(ev) => setF({ ...f, place: ev.target.value })} placeholder="Ort (optional)" aria-label="Ort" />
            <input className="input" value={f.dist || ''} onChange={(ev) => setF({ ...f, dist: ev.target.value })} placeholder="Distanz, z.B. 21 km (optional)" aria-label="Distanz" />
            <input className="input" value={f.url} onChange={(ev) => setF({ ...f, url: ev.target.value })} placeholder="Link zur Anmeldung (optional)" aria-label="Link" inputMode="url" />
            <button type="button" className="btn tint small" disabled={fBusy || !getAi().apiKey || !(f.name.trim() || f.url.trim())} onClick={fillAi}>{fBusy ? 'Ich suche die Daten …' : '✨ Rest mit KI ausfüllen'}</button>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn small" style={{ flex: 1 }} disabled={!f.name.trim() || !f.sportId}>Notieren</button>
              <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => setAdding(false)}>Abbrechen</button>
            </span>
          </form>
        )}
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
          {likedBySport.length === 0 && <div className="list"><div className="empty">Noch nichts gemerkt. Unter „Events finden“ suchen und „Merken“ tippen.</div></div>}
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
        </>}
        {tab === 'rechner' && (
          <section className="card" style={{ gap: 10 }}>
            <span className="label" style={{ padding: 0 }}>Zeitrechner</span>
            <PaceCalc />
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

// „Wo?“ für Sport-Events (v0.67): wie die Stadt-Auswahl bei Ausgehen – suchen/anlegen, Mein Standort, mehrere wählbar
function RegionSheet({ open, onClose, regions, pick, setPick }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const match = regions.filter((r) => !q.trim() || r.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = regions.some((r) => r.toLowerCase() === q.trim().toLowerCase());
  const add = (r) => { if (!regions.includes(r)) setSportRegions([...regions, r]); if (!pick.includes(r)) setPick([...pick, r]); setQ(''); };
  const here = async () => {
    setBusy(true);
    try { const r = await cityHere(); add(r.city); if (r.country && !regions.includes(r.country)) setSportRegions([...regions.filter((x) => x !== r.city), r.city, r.country]); toast(`Standort: ${r.city}`); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} title="Wo suchen?" onClose={onClose}>
      <button type="button" className="btn sec" style={{ background: 'var(--card-2)' }} disabled={busy} onClick={here}>{busy ? 'Suche deinen Standort …' : '📍 Mein Standort'}</button>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stadt, Land oder Region suchen/eingeben" aria-label="Region suchen" />
      {q.trim() && !exact && <button type="button" className="btn" onClick={() => add(q.trim())}>+ „{q.trim()}“ hinzufügen</button>}
      <span className="tiny">Antippen = auswählen (mehrere möglich).</span>
      <div className="list">
        {match.map((r) => (
          <div key={r} className="row" style={{ minHeight: 48, gap: 6 }}>
            <button type="button" className="row-main" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={() => setPick(pick.includes(r) ? pick.filter((x) => x !== r) : [...pick, r])}>
              <span className="row-title strong">{pick.includes(r) ? '✓ ' : ''}{r}</span>
            </button>
            <button type="button" className="x-btn" onClick={() => { setSportRegions(regions.filter((x) => x !== r)); setPick(pick.filter((x) => x !== r)); }} aria-label={`${r} entfernen`}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn" onClick={onClose}>Fertig</button>
    </Sheet>
  );
}

const PARSE_RACE = { name: 'rennen_lesen', description: 'Daten eines Rennens', input_schema: { type: 'object', properties: { name: { type: 'string' }, datum: { type: 'string', description: 'YYYY-MM-DD, nur wenn erkennbar' }, ort: { type: 'string' }, distanz: { type: 'string', description: 'z.B. „21 km“ oder „10K, 21K“' }, sportart: { type: 'string' } }, required: ['name'] } };
// Zeitraum als Suchwörter für Google (v0.70): „Nächste 3 Monate“ → „noviembre OR diciembre OR enero 2027“
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function periodWords(p) {
  if (!p) return '';
  const d = new Date();
  const months = (n) => { const out = []; for (let i = 0; i < n; i++) { const x = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(MES[x.getMonth()]); } const y = new Date(d.getFullYear(), d.getMonth() + n - 1, 1).getFullYear(); return `${out.join(' OR ')} ${y}`; };
  const l = p.toLowerCase();
  if (l.includes('diesen monat')) return months(1);
  const m = l.match(/(\d+)\s*monat/);
  if (m) return months(Math.min(+m[1], 6));
  if (l.includes('nächstes jahr')) return String(d.getFullYear() + 1);
  if (l.includes('dieses jahr')) return String(d.getFullYear());
  return p;
}

async function parseSportText(s, text) {
  const hasUrl = /https?:\/\//.test(text);
  const base = { system: `Lies die Daten eines Sport-Events (Rennen) aus Mateos Nachricht.${hasUrl ? ' Enthält sie einen Link, öffne ihn mit web_fetch und lies Name, Datum, Ort und Distanzen von der Seite. Klappt das nicht, nutze die Wörter in der Adresse.' : ''} Nichts erfinden, Unbekanntes leer lassen. Heute ist ${today()}. Sportarten: ${s.sports.map((x) => x.name).join(', ')}. Antworte mit "rennen_lesen".`, user: text, tool: PARSE_RACE, maxUses: 0, maxTokens: 1500, label: 'Rennen übernehmen' };
  if (!hasUrl) return searchWithTool(base);
  try { return await searchWithTool({ ...base, fetch: true }); } catch { return searchWithTool(base); }
}
