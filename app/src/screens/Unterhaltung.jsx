// Hobbys → Unterhaltung (v1.57 Ausgehen, v1.58 Informiert bleiben, seit v1.59 bei Hobbys; Mateo)
//   oben: 🎬 Filme · 📺 Fernsehen · ⚽ Sport
//   darunter: ⭐ Merkliste (links) | 🔍 Finden (rechts)
//   Finden: Suchfeld mit ⚡ Schnellzugriff (Kategorien der Art, bearbeitbar), Links passend zur Art (sofort, gratis), „✨ Mit KI suchen“
//   📍 Wo schauen?: Sender/Stream, eigene Orte „Zum Schauen“ (Sportbar, Kino) und KI-Suche nach Bars bzw. Kinozeiten
import { useEffect, useState } from 'react';
import { fmtShort, parseKey, today } from '../lib/dates';
import { addShow, archiveShow, catEmoji, catName, findWatchPlaces, lastShowSearch, restoreShow, saveShowSearch, saveTypeCats, searchShows, SHOW_TYPES, showType, toggleShow, typeCatsOf, updateShow, watchSub } from '../lib/shows';
import { addPlace } from '../lib/actions';
import { placeCity, routeUrl } from '../lib/outings';
import { SOURCE_AREAS } from '../lib/sources';
import { CityChips } from './Ausgehen';
import { getAi } from '../lib/ai';
import { takeFlag } from '../lib/flags';
import SearchCard from '../components/SearchCard';
import SourceLinks from '../components/SourceLinks';
import QuickSheet from '../components/QuickSheet';
import AiFill from '../components/AiFill';
import RemindPicker from '../components/RemindPicker';
import { RemovedButton } from '../components/RemovedList';
import { Field, Icon, Info, Segmented, Sheet, toast, LinkBtn, RouteBtn, MapBtn } from '../components/ui';

const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const mon = new Intl.DateTimeFormat('de-DE', { month: 'short' });
function DateBadge({ date, label }) {
  if (!date) return <span className="date-badge"><span className="tiny">{label || 'offen'}</span></span>;
  const d = parseKey(date);
  return (
    <span className="date-badge">
      <span className="tiny">{wd.format(d).replace('.', '')}</span>
      <b>{d.getDate()}</b>
      <span className="tiny db-mon">{mon.format(d).replace('.', '')}</span>
    </span>
  );
}
const errText = (e) => (e.message === 'KEIN_SCHLUESSEL' ? 'Für die Suche braucht es einen API-Schlüssel (Einstellungen).' : e.message);
const KIND_LABEL = { im_kino: 'Läuft im Kino', demnaechst: 'Bald im Kino' };
const TYPE_NAME = { film: 'Filme', tv: 'Fernsehen', sport: 'Sport' };

// ⚡ Schnellzugriff: Kategorien der Art antippen = in die Suche übernehmen; ✎ = hinzufügen/entfernen (s.profile.showTypeCats)
function QuickCats({ s, type, onPick }) {
  return (
    <QuickSheet label="⚡" title={`Schnell suchen: ${TYPE_NAME[type]}`}>
      {(close) => <QuickCatsBody s={s} type={type} onPick={(c) => { close(); onPick(c); }} />}
    </QuickSheet>
  );
}
function QuickCatsBody({ s, type, onPick }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const cats = typeCatsOf(s, type);
  return (
    <>
      <div className="chips">
        {cats.map((c) => (
          <button key={c} type="button" className={edit ? 'chip soft editing' : 'chip soft'} onClick={() => (edit ? saveTypeCats(type, cats.filter((x) => x !== c)) : onPick(c))} aria-label={edit ? `${c} entfernen` : c}>
            {c}{edit && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className={edit ? 'chip on' : 'chip soft'} onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Kategorien bearbeiten'}>{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
      </div>
      {edit && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t && !cats.includes(t)) saveTypeCats(type, [...cats, t]); setText(''); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={type === 'sport' ? 'z.B. 🥊 Boxen, 🏐 Volleyball, Boca Juniors' : type === 'film' ? 'z.B. 👻 Horror, Animation' : 'z.B. 🍳 Kochshows, True Crime'} aria-label="Neue Kategorie" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      )}
      {edit ? <Info>Antippen entfernt eine Kategorie. Ein Emoji am Anfang wird zum Symbol.</Info> : <Info>Antippen übernimmt die Kategorie ins Suchfeld – die Links passen sich an.</Info>}
    </>
  );
}

const EMPTY = { name: '', type: 'sport', cat: '', date: '', time: '', where: '', url: '', note: '', remind: '' };
const initOf = (x) => ({ ...EMPTY, ...x, type: showType(x.name ? x : { type: x.type }), remind: x.remind ?? '' });
export function ShowSheet({ s, init, onClose }) {
  const [f, setF] = useState(EMPTY);
  const [key, setKey] = useState(null);
  const k = init ? JSON.stringify(init) : null;
  if (k !== key) { setKey(k); if (init) setF(initOf(init)); }
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const editId = init?.id;
  const cats = typeCatsOf(s, f.type);
  const film = f.type === 'film';
  const save = () => {
    if (editId) updateShow(editId, f); else addShow(f);
    toast(editId ? 'Gespeichert' : f.date ? 'Eingetragen – steht am Tag (und vorher) auf Heute' : 'Eingetragen');
    onClose(true);
  };
  return (
    <Sheet open={!!init} title={editId ? 'Bearbeiten' : 'Unterhaltung eintragen'} onClose={() => onClose(false)}>
      <AiFill key={key} title="Etwas zum Anschauen (Fußballspiel, Formel-1-Rennen, Kinofilm, Serie)" values={{ name: f.name, type: f.type, cat: f.cat, date: f.date, time: f.time, where: f.where, url: f.url, note: f.note }} onResult={(r) => set(r)}
        fields={{ name: 'Was (z.B. „River – Boca“, „GP Brasilien“, „Dune 3“)', type: { d: 'film = Kino/Film, tv = Serie/Doku/Show, sport = Sport-Übertragung', enum: ['film', 'tv', 'sport'] }, cat: 'Kategorie, z.B. Fußball, Formel 1, Läuft im Kino, Neue Serien', date: 'Datum YYYY-MM-DD', time: 'Uhrzeit HH:MM', where: 'Sender/Stream/Kino', url: 'Link', note: 'Kurze Notiz' }}
        placeholder="z.B. „Sonntag 14 Uhr Formel 1 Brasilien auf Fox“" autoSave={editId ? null : () => !!(f.name.trim() && f.date) && (save(), true)} />
      <Segmented full options={SHOW_TYPES} value={f.type} onChange={(v) => set({ type: v, cat: '' })} label="Art" />
      <Field label="Was?"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={film ? 'z.B. Dune: Teil Drei' : f.type === 'tv' ? 'z.B. The Bear, Staffel 5' : 'z.B. Boca – River'} /></Field>
      <div className="chips">{cats.map((c) => <button key={c} type="button" className={f.cat === c ? 'chip on' : 'chip soft'} onClick={() => set({ cat: f.cat === c ? '' : c })}>{c}</button>)}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label={film ? 'Datum (Kinobesuch/-start)' : f.type === 'tv' ? 'Start' : 'Datum'}><input className="input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Uhrzeit"><input className="input" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} style={{ maxWidth: 140 }} /></Field>
      </div>
      <Field label={film ? 'Kino / Dienst' : 'Wo läuft es?'}><input className="input" value={f.where} onChange={(e) => set({ where: e.target.value })} placeholder={film ? 'z.B. Cinemark Palermo oder Netflix' : f.type === 'tv' ? 'z.B. Netflix, Max, Disney+' : 'z.B. ESPN, Disney+, F1 TV'} /></Field>
      {f.date && <RemindPicker s={s} value={f.remind} onChange={(v) => set({ remind: v })} />}
      <Field label="Link"><input className="input" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="Tickets / Stream / Infos" /></Field>
      <Field label="Notiz"><textarea className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      <button type="button" className="btn" disabled={!f.name.trim()} onClick={save}>Speichern</button>
      {editId && <button type="button" className="btn danger" onClick={() => { archiveShow(editId); toast('Rausgenommen – in der Kiste zurückholbar'); onClose(true); }}>Rausnehmen</button>}
    </Sheet>
  );
}

function Showtimes({ list, flat }) {
  if (!list?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: flat ? 0 : 56 }}>
      {list.map((v, i) => <span key={i} className="tiny">🎟 <b style={{ fontWeight: 600 }}>{v.kino}</b>{v.zeiten ? ` · ${v.zeiten}` : ''}</span>)}
    </div>
  );
}

// „Wo schauen?“ – für Sport: Sender + Sportbars; für Filme: Kinos mit Uhrzeiten
function WatchSheet({ s, item, city, onClose, onTake }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [key, setKey] = useState(null);
  if ((item?.id || null) !== key) { setKey(item?.id || null); setRes(null); setErr(null); }
  if (!item) return <Sheet open={false} title="" onClose={onClose} />;
  const sub = watchSub(item);
  const kino = sub === 'Kino';
  const mine = (s.places || []).filter((p) => placeCity(p) === city && ((p.category === 'Zum Schauen' && (!p.subcat || p.subcat === sub || (!kino && p.subcat === 'Public Viewing'))) || (p.subcat || '').toLowerCase() === sub.toLowerCase()));
  const q = kino ? `${item.name} cartelera ${city}` : `bares para ver ${item.name} ${city}`;
  const run = async () => {
    setBusy(true); setErr(null);
    try { setRes(await findWatchPlaces(s, item, city)); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const pick = (name, times) => { onTake(name, times); toast(`Eingetragen: ${name}`); onClose(); };
  // Serien/Shows: nur Sender/Stream – keine Orte
  if (showType(item) === 'tv') {
    return (
      <Sheet open title="📍 Wo schauen?" onClose={onClose}>
        <span style={{ fontWeight: 650 }}>{item.name}</span>
        {item.where ? <div className="take-box" style={{ fontSize: 15 }}>📺 Läuft auf: <b>{item.where}</b></div> : <span className="tiny">Noch kein Dienst eingetragen.</span>}
        <div className="chips">
          <a className="link-chip" href={`https://www.justwatch.com/ar/buscar?q=${encodeURIComponent(item.name)}`} target="_blank" rel="noreferrer">JustWatch ↗</a>
          <a className="link-chip" href={`https://www.google.com/search?q=${encodeURIComponent(`${item.name} dónde ver`)}`} target="_blank" rel="noreferrer">Google „dónde ver“ ↗</a>
        </div>
        <Info>JustWatch zeigt, bei welchem Dienst in Argentinien es läuft. Den Dienst trägst du über ✎ beim Eintrag ein.</Info>
      </Sheet>
    );
  }
  const keep = (o) => { addPlace({ name: o.name, category: 'Zum Schauen', subcat: sub, address: o.address, hood: o.hood, note: o.info, url: o.url, city }); toast(`${o.name} unter Orte → Zum Schauen gemerkt`); };
  const known = (name) => (s.places || []).some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  return (
    <Sheet open title="📍 Wo schauen?" onClose={onClose}>
      <span style={{ fontWeight: 650 }}>{item.name}</span>
      <span className="tiny">{[item.date && fmtShort(item.date), item.time && `${item.time} Uhr`, city].filter(Boolean).join(' · ')}</span>
      {!kino && item.where && <div className="take-box" style={{ fontSize: 15 }}>📺 Im TV/Stream: <b>{item.where}</b></div>}
      <Showtimes list={item.shows} flat />
      <span className="label" style={{ padding: 0 }}>{kino ? '🎟 Deine Kinos' : '🍺 Deine Sportbars'}</span>
      {mine.length === 0 && <span className="tiny">Noch keine gespeichert – unten suchen und „📌 Merken“ tippen (landen in Ausgehen → Orte → Zum Schauen).</span>}
      {mine.length > 0 && (
        <div className="list">
          {mine.map((p) => (
            <div key={p.id} className="row compact">
              <span className="row-main"><span className="row-title plain">{p.name}</span><span className="row-meta">{[p.hood, p.note].filter(Boolean).join(' · ')}</span></span>
              {kino ? <LinkBtn href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${item.name} horarios`)}`} label="Zeiten" /> : <RouteBtn href={routeUrl(p.address || p.name, city)} />}
              <button type="button" className="pill" onClick={() => pick(p.name)}>✓ Hier</button>
            </div>
          ))}
        </div>
      )}
      <div className="chips">
        <a className="link-chip" href={`https://www.google.com/search?q=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer">Google ↗</a>
        <MapBtn href={`https://www.google.com/maps/search/${encodeURIComponent(kino ? `cine ${city}` : `bar para ver fútbol ${city}`)}`} label="In Maps suchen" />
        {kino && <a className="link-chip" href="https://www.cinemarkhoyts.com.ar/" target="_blank" rel="noreferrer">Cinemark ↗</a>}
        {kino && <a className="link-chip" href="https://www.todoshowcase.com/" target="_blank" rel="noreferrer">Showcase ↗</a>}
        {kino && <a className="link-chip" href="https://www.cinepolis.com.ar/" target="_blank" rel="noreferrer">Cinépolis ↗</a>}
      </div>
      <button type="button" className="btn" disabled={busy || !getAi().apiKey} onClick={run}>{busy ? 'Suche …' : kino ? '✨ Kinos und Uhrzeiten suchen' : '✨ Bars suchen, die das zeigen'}</button>
      {!getAi().apiKey && <a href="#/einstellungen" className="link-btn" style={{ fontSize: 13 }}>Für die KI: Schlüssel hinterlegen</a>}
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{kino ? 'Ich suche Kinoprogramme …' : 'Ich suche Bars mit Leinwand …'} (ca. 20 Sek.)</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {res && !busy && (
        <div className="list">
          {res.note && <span className="tiny" style={{ padding: '6px 12px' }}>{res.note}</span>}
          {res.list.length === 0 && <div className="empty">Nichts gefunden – probier die Links oben.</div>}
          {res.list.map((o) => (
            <div key={o.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <span className="row-main"><span className="row-title plain">{o.name}</span><span className="row-meta">{[o.hood, o.info].filter(Boolean).join(' · ')}</span>{o.times && <span className="tiny">🕒 {o.times}</span>}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="pill" onClick={() => pick(o.name, o.times)}>✓ Hier schaue ich</button>
                {!known(o.name) && <button type="button" className="pill" onClick={() => keep(o)}>📌 Merken</button>}
                <RouteBtn href={routeUrl(o.address || o.name, city)} />
                {o.url && <LinkBtn href={o.url} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export default function Unterhaltung({ s, city }) {
  const t = today();
  const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const [type, setTypeS] = useState(() => { const v = ls('life-app-tv-type', 'sport'); return ['film', 'tv', 'sport'].includes(v) ? v : 'sport'; });
  const [view, setViewS] = useState(() => (ls('life-app-tv-view', 'mine') === 'find' ? 'find' : 'mine'));
  const setView = (v) => { setViewS(v); put('life-app-tv-view', v); };
  const [watch, setWatch] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState(() => takeFlag('life-search-q') || '');
  const [search, setSearch] = useState(() => lastShowSearch(type));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const chooseType = (v) => { setTypeS(v); put('life-app-tv-type', v); setSearch(lastShowSearch(v)); setQ(''); setErr(null); };
  useEffect(() => { const id = takeFlag('life-open-show'); const x = id && (s.shows || []).find((y) => y.id === id); if (x) setForm(x); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (text) => {
    if (busy) return;
    const query = text.trim() || `Was kommt in den nächsten 2 Wochen? (${typeCatsOf(s, type).map(catName).join(', ')})`;
    setBusy(true); setErr(null);
    try { const res = await searchShows(s, query, city, type); const v = { ...res, query: text.trim() || `Was kommt: ${TYPE_NAME[type]}` }; saveShowSearch(v); setSearch(v); setQ(''); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const mark = (id, status) => {
    const next = { ...search, results: search.results.map((r) => (r.id === id ? { ...r, status } : r)) };
    saveShowSearch(next); setSearch(next);
  };
  const take = (r) => {
    const id = addShow({ name: r.name, type: r.type || type, cat: r.cat, date: r.date, time: r.time, where: r.where, url: r.url, note: [KIND_LABEL[r.kind], r.info].filter(Boolean).join(' · '), shows: r.shows });
    mark(r.id, 'gemerkt');
    toast(r.date ? 'Auf der Merkliste – steht am Tag (und vorher) auf Heute' : 'Auf der Merkliste');
    return id;
  };
  // „Wo schauen?“ → Ort übernehmen: gemerkter Eintrag bekommt den Ort; ein Suchergebnis wird dabei gleich gemerkt
  const takeWatch = (item, name, times) => {
    const note = times ? `${name}: ${times}` : '';
    if (item.status) { const id = take(item); if (id) updateShow(id, { where: name, note: [KIND_LABEL[item.kind], item.info, note].filter(Boolean).join(' · ') }); return; }
    updateShow(item.id, { where: name, ...(note ? { note: [item.note, note].filter(Boolean).join('\n') } : {}) });
  };

  const ofType = (s.shows || []).filter((x) => showType(x) === type);
  const upcoming = ofType.filter((x) => !x.done && (!x.date || x.date >= t)).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : a.date === b.date && (a.time || '99') < (b.time || '99') ? -1 : 1);
  const past = ofType.filter((x) => x.done || (x.date && x.date < t)).sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1));
  const fresh = (search?.results || []).filter((r) => r.status === 'neu');
  const area = `tv_${type}`;

  const Row = (x) => (
    <div key={x.id} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '10px 12px 10px 16px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <DateBadge date={x.date} label={catEmoji(x.cat) || 'offen'} />
        <button type="button" className="row-main" style={{ gap: 2, border: 0, background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }} onClick={() => setForm(x)} aria-label={`${x.name} bearbeiten`}>
          <span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.name}</span>
          <span className="row-meta">{[x.time && `${x.time} Uhr`, x.where, catName(x.cat)].filter(Boolean).join(' · ') || (x.date ? '' : 'Ohne Datum')}</span>
          {x.note && <span className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{x.note}</span>}
        </button>
        <button type="button" className="x-btn" aria-label={`${x.name} rausnehmen`} onClick={() => { archiveShow(x.id); toast('Rausgenommen – in der Kiste zurückholbar'); }}><Icon name="x" size={12} color="var(--chev)" /></button>
      </div>
      <Showtimes list={x.shows} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 56 }}>
        <button type="button" className="pill" onClick={() => { toggleShow(x.id); if (!x.done) toast('Abgehakt'); }}>{x.done ? '↩ Nicht gesehen' : '✓ Gesehen'}</button>
        {!x.done && <button type="button" className="pill" onClick={() => setWatch(x)}>📍 Wo schauen?</button>}
        {x.url && <LinkBtn href={x.url} />}
      </div>
    </div>
  );

  return (
    <>
      <ShowSheet s={s} init={form} onClose={() => setForm(null)} />
      <WatchSheet s={s} item={watch} city={city} onClose={() => setWatch(null)} onTake={(name, times) => takeWatch(watch, name, times)} />
      <Segmented full options={SHOW_TYPES} value={type} onChange={chooseType} label="Art" />
      {/* v1.60 (Mateo): Stadt wählbar (für Kinos, Sportbars, Ortszeit) – gleiche Stadt wie in Ausgehen */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div className="sub-switch" style={{ flex: '1 1 auto', minWidth: 0 }}>
        {[['mine', `⭐ Merkliste${upcoming.length ? ` ${upcoming.length}` : ''}`], ['find', '🔍 Finden']].map(([k, l]) => <button key={k} type="button" className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div style={{ flex: '0 1 38%', minWidth: 0, display: 'flex' }}><CityChips s={s} compact /></div>
      </div>
      {view === 'find' && <>
        <SearchCard q={q} setQ={setQ} placeholder={SOURCE_AREAS[area].placeholder} mode="ki" busy={busy}
          quick={<QuickCats s={s} type={type} onPick={(c) => setQ(catName(c))} />}
          onAi={run} aiCost="~4 ct"
          hint={`⚡ = deine ${TYPE_NAME[type]}-Kategorien (bearbeitbar). 🔗 Die Seiten darunter öffnen sich sofort mit deinem Suchbegriff – kostenlos. ✨ KI: sucht selbst im Internet und zeigt konkrete ${type === 'sport' ? 'Termine mit Uhrzeit (deine Ortszeit) und Sender' : type === 'film' ? 'Filme (im Kino, bald im Kino, neu im Streaming)' : 'neue Serien, Staffeln und Dokus mit Starttermin und Dienst'} (ca. 3–5 Cent).`}>
          <SourceLinks key={area} embedded s={s} area={area} city={city} query={q} autoTailor />
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{type === 'sport' ? 'Ich suche Spielpläne und TV-Programm …' : type === 'film' ? 'Ich suche Kinoprogramm und Filmstarts …' : 'Ich suche neue Serien und Staffeln …'} (ca. 20–30 Sek.)</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        </SearchCard>
        {!busy && search && (
          <section className="group">
            <div className="sec-h">
              <h2 className="h2" style={{ fontSize: 19 }}>„{search.query}“</h2>
              <span className="tiny">{fresh.length} neu</span>
            </div>
            {search.note && <span className="sub" style={{ padding: '0 4px' }}>{search.note}</span>}
            {search.results.length === 0 && <div className="notice">Nichts gefunden. Probier eine andere Formulierung.</div>}
            {fresh.map((r) => (
              <article key={r.id} className="nudge">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <DateBadge date={r.date} label={r.kind === 'im_kino' ? 'läuft' : catEmoji(r.cat) || 'offen'} />
                  <div className="row-main" style={{ gap: 2 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 650, lineHeight: 1.3 }}>{r.name}</span>
                    <span className="tiny">{[r.time && `${r.time} Uhr`, r.where, KIND_LABEL[r.kind], r.info].filter(Boolean).join(' · ')}</span>
                  </div>
                  <button type="button" className="x-btn" aria-label={`${r.name} ausblenden`} onClick={() => mark(r.id, 'weg')}><Icon name="x" size={12} color="var(--chev)" /></button>
                </div>
                <Showtimes list={r.shows} />
                <div className="nudge-actions" style={{ paddingLeft: 56 }}>
                  <button type="button" className="pill" onClick={() => take(r)}>⭐ Interessiert mich</button>
                  <button type="button" className="pill" onClick={() => setWatch({ ...r, type: r.type || type })}>📍 Wo?</button>
                  {r.url && <LinkBtn href={r.url} />}
                </div>
              </article>
            ))}
            {search.results.length > 0 && fresh.length === 0 && <span className="sub" style={{ padding: '0 4px' }}>Alles durchgesehen – Gemerktes steht auf der Merkliste.</span>}
          </section>
        )}
      </>}
      {view === 'mine' && <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn tint small" style={{ flex: 1 }} onClick={() => setForm({ ...EMPTY, type })}>+ Eintragen</button>
          <RemovedButton items={(s.removedShows || []).filter((x) => showType(x) === type)} storeKey="removedShows" onRestore={restoreShow} meta={(x) => [x.date && fmtShort(x.date), x.where].filter(Boolean).join(' · ')} />
        </div>
        {upcoming.length === 0 && <div className="empty">Noch nichts gemerkt. Rechts unter „🔍 Finden“ suchen und „Interessiert mich“ tippen – oder selbst eintragen.</div>}
        {upcoming.length > 0 && <div className="list">{upcoming.map(Row)}</div>}
        {past.length > 0 && (
          <>
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setPastOpen(!pastOpen)}>Gesehen / vorbei ({past.length}) {pastOpen ? '▴' : '▾'}</button>
            {pastOpen && <div className="list">{past.map(Row)}</div>}
          </>
        )}
      </>}
    </>
  );
}
