// v1.57/1.58 (Mateo): Informiert bleiben → 🎬 Unterhaltung. Was läuft im Fernsehen/Stream und im Kino?
//   🔍 Was kommt: Kategorien antippen → Links sofort (gratis) + „Mit KI suchen“ → „Interessiert mich“
//   ⭐ Will ich sehen: gemerkte Rennen/Spiele/Filme – erscheinen am Tag (und vorher) auf Heute
//   📍 Wo schauen?: Sender/Stream, eigene Orte „Zum Schauen“ (Sportbar, Kino) und KI-Suche nach Bars bzw. Kinozeiten
import { useEffect, useState } from 'react';
import { fmtShort, parseKey, today } from '../lib/dates';
import { addShow, archiveShow, catEmoji, catName, findWatchPlaces, isCinema, lastShowSearch, restoreShow, saveShowCats, saveShowSearch, searchShows, showCatsOf, toggleShow, updateShow, watchSub } from '../lib/shows';
import { addPlace } from '../lib/actions';
import { placeCity, routeUrl } from '../lib/outings';
import { getAi } from '../lib/ai';
import { takeFlag } from '../lib/flags';
import SearchCard from '../components/SearchCard';
import SourceLinks from '../components/SourceLinks';
import AiFill from '../components/AiFill';
import RemindPicker from '../components/RemindPicker';
import { RemovedButton } from '../components/RemovedList';
import { Field, Icon, Info, Sheet, toast } from '../components/ui';

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

// Kategorien: antippen = filtern; ✎ = hinzufügen/entfernen (gespeichert in s.profile.showCats)
function CatChips({ s, value, onChange }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const cats = showCatsOf(s);
  const toggle = (c) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <>
      <div className={edit ? 'chips' : 'chips chips-scroll'}>
        {!edit && <button type="button" className={value.length ? 'chip soft' : 'chip on'} onClick={() => onChange([])}>Alle</button>}
        {cats.map((c) => (
          <button key={c} type="button" className={edit ? 'chip soft editing' : value.includes(c) ? 'chip on' : 'chip soft'} onClick={() => (edit ? (saveShowCats(cats.filter((x) => x !== c)), onChange(value.filter((x) => x !== c))) : toggle(c))} aria-label={edit ? `${c} entfernen` : c}>
            {c}{edit && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className={edit ? 'chip on' : 'chip soft'} onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Kategorien bearbeiten'}>{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
      </div>
      {edit && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t && !cats.includes(t)) saveShowCats([...cats, t]); setText(''); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. 🏀 NBA, 🥊 Boxen, 🎭 Theater-Stream" aria-label="Neue Kategorie" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      )}
      {edit && <Info>Antippen entfernt eine Kategorie. Ein Emoji am Anfang wird zum Symbol.</Info>}
    </>
  );
}

const EMPTY = { name: '', cat: '', date: '', time: '', where: '', url: '', note: '', remind: '' };
const initOf = (x) => ({ ...EMPTY, ...x, remind: x.remind ?? '' });
export function ShowSheet({ s, init, onClose }) {
  const [f, setF] = useState(EMPTY);
  const [key, setKey] = useState(null);
  const k = init ? JSON.stringify(init) : null;
  if (k !== key) { setKey(k); if (init) setF(initOf(init)); }
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const editId = init?.id;
  const cats = showCatsOf(s);
  const save = () => {
    if (editId) updateShow(editId, f); else addShow(f);
    toast(editId ? 'Gespeichert' : f.date ? 'Eingetragen – steht am Tag (und vorher) auf Heute' : 'Eingetragen');
    onClose(true);
  };
  return (
    <Sheet open={!!init} title={editId ? 'Bearbeiten' : 'Unterhaltung eintragen'} onClose={() => onClose(false)}>
      <AiFill key={key} title="Etwas zum Anschauen (Fußballspiel, Formel-1-Rennen, Kinofilm, Serie)" values={{ name: f.name, cat: f.cat, date: f.date, time: f.time, where: f.where, url: f.url, note: f.note }} onResult={(r) => set(r)}
        fields={{ name: 'Was (z.B. „River – Boca“, „GP Brasilien“, „Dune 3“)', cat: { d: 'Kategorie', enum: cats }, date: 'Datum YYYY-MM-DD', time: 'Uhrzeit HH:MM', where: 'Sender/Stream/Kino', url: 'Link', note: 'Kurze Notiz' }}
        placeholder="z.B. „Sonntag 14 Uhr Formel 1 Brasilien auf Fox“" autoSave={editId ? null : () => !!(f.name.trim() && f.date) && (save(), true)} />
      <Field label="Was?"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="z.B. Boca – River" /></Field>
      <div className="chips">{cats.map((c) => <button key={c} type="button" className={f.cat === c ? 'chip on' : 'chip soft'} onClick={() => set({ cat: f.cat === c ? '' : c })}>{c}</button>)}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label={isCinema(f.cat) ? 'Datum (Kinobesuch/-start)' : 'Datum'}><input className="input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Uhrzeit"><input className="input" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} style={{ maxWidth: 140 }} /></Field>
      </div>
      <Field label={isCinema(f.cat) ? 'Kino' : 'Wo läuft es?'}><input className="input" value={f.where} onChange={(e) => set({ where: e.target.value })} placeholder={isCinema(f.cat) ? 'z.B. Cinemark Palermo' : 'z.B. ESPN, Disney+, F1 TV'} /></Field>
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
              <a className="pill" href={kino ? `https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${item.name} horarios`)}` : routeUrl(p.address || p.name, city)} target="_blank" rel="noreferrer">{kino ? 'Zeiten ↗' : 'Route'}</a>
              <button type="button" className="pill" onClick={() => pick(p.name)}>✓ Hier</button>
            </div>
          ))}
        </div>
      )}
      <div className="chips">
        <a className="link-chip" href={`https://www.google.com/search?q=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer">Google ↗</a>
        <a className="link-chip" href={`https://www.google.com/maps/search/${encodeURIComponent(kino ? `cine ${city}` : `bar para ver fútbol ${city}`)}`} target="_blank" rel="noreferrer">Google Maps ↗</a>
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
                <a className="pill" href={routeUrl(o.address || o.name, city)} target="_blank" rel="noreferrer">Route</a>
                {o.url && <a className="pill" href={o.url} target="_blank" rel="noreferrer" aria-label={`${o.name} öffnen`}><Icon name="link" size={14} /></a>}
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
  const [view, setViewS] = useState(() => { try { return localStorage.getItem('life-app-tv-view') || 'find'; } catch { return 'find'; } });
  const setView = (v) => { setViewS(v); try { localStorage.setItem('life-app-tv-view', v); } catch {} };
  const [watch, setWatch] = useState(null);
  const [form, setForm] = useState(null);
  const [cats, setCats] = useState(() => { try { return JSON.parse(localStorage.getItem('life-app-tv-cats') || '[]'); } catch { return []; } });
  const pickCats = (v) => { setCats(v); try { localStorage.setItem('life-app-tv-cats', JSON.stringify(v)); } catch {} };
  const [q, setQ] = useState(() => takeFlag('life-search-q') || '');
  const [search, setSearch] = useState(lastShowSearch);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  useEffect(() => { const id = takeFlag('life-open-show'); const x = id && (s.shows || []).find((y) => y.id === id); if (x) setForm(x); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const known = showCatsOf(s);
  const activeCats = cats.filter((c) => known.includes(c));
  // Suchbegriff für die Links: eigener Text, sonst die gewählten Kategorien
  const linkQ = q.trim() || activeCats.map(catName).join(' ');

  const run = async (text) => {
    if (busy) return;
    const query = text.trim() || (activeCats.length ? `Was läuft in den nächsten 2 Wochen: ${activeCats.map(catName).join(', ')}` : 'Was läuft in den nächsten 2 Wochen in meinen Kategorien (Sport im TV, Kino, Serien)?');
    setBusy(true); setErr(null);
    try { setSearch(await searchShows(s, query, city, activeCats)); setQ(''); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const mark = (id, status) => {
    const next = { ...search, results: search.results.map((r) => (r.id === id ? { ...r, status } : r)) };
    saveShowSearch(next); setSearch(next);
  };
  const take = (r) => {
    const id = addShow({ name: r.name, cat: r.cat, date: r.date, time: r.time, where: r.where, url: r.url, note: [KIND_LABEL[r.kind], r.info].filter(Boolean).join(' · '), shows: r.shows });
    mark(r.id, 'gemerkt');
    toast(r.date ? 'Unter „Will ich sehen“ – steht am Tag (und vorher) auf Heute' : 'Unter „Will ich sehen“ gemerkt');
    return id;
  };
  // „Wo schauen?“ → Ort übernehmen: gemerkter Eintrag bekommt den Ort; ein Suchergebnis wird dabei gleich gemerkt
  const takeWatch = (item, name, times) => {
    const note = times ? `${name}: ${times}` : '';
    if (item.status) { const id = take(item); if (id) updateShow(id, { where: name, note: [KIND_LABEL[item.kind], item.info, note].filter(Boolean).join(' · ') }); return; }
    updateShow(item.id, { where: name, ...(note ? { note: [item.note, note].filter(Boolean).join('\n') } : {}) });
  };

  const mine = (s.shows || []).filter((x) => !activeCats.length || activeCats.includes(x.cat));
  const upcoming = mine.filter((x) => !x.done && (!x.date || x.date >= t)).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : a.date === b.date && (a.time || '99') < (b.time || '99') ? -1 : 1);
  const past = mine.filter((x) => x.done || (x.date && x.date < t)).sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1));
  const fresh = (search?.results || []).filter((r) => r.status === 'neu');

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
        {x.url && <a className="pill" href={x.url} target="_blank" rel="noreferrer">Link ↗</a>}
        {!x.done && <button type="button" className="pill" onClick={() => setWatch(x)}>📍 Wo schauen?</button>}
        <button type="button" className="pill" onClick={() => setForm(x)}>✎</button>
      </div>
    </div>
  );

  return (
    <>
      <ShowSheet s={s} init={form} onClose={() => setForm(null)} />
      <WatchSheet s={s} item={watch} city={city} onClose={() => setWatch(null)} onTake={(name, times) => takeWatch(watch, name, times)} />
      <div className="sub-switch">
        {[['find', '🔍 Was kommt'], ['mine', `⭐ Will ich sehen${(s.shows || []).filter((x) => !x.done && (!x.date || x.date >= t)).length ? ` · ${(s.shows || []).filter((x) => !x.done && (!x.date || x.date >= t)).length}` : ''}`]].map(([k, l]) => <button key={k} type="button" className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <CatChips s={s} value={activeCats} onChange={pickCats} />
      {view === 'find' && <>
        <SearchCard q={q} setQ={setQ} placeholder="z.B. Wann fährt die Formel 1? Was läuft im Kino?" mode="ki" busy={busy}
          onAi={run} aiCost="~4 ct"
          hint="🔗 Die Seiten darunter öffnen sich sofort mit deinem Suchbegriff bzw. den gewählten Kategorien – kostenlos. ✨ KI: sucht selbst im Internet und zeigt konkrete Termine (Uhrzeit in deiner Ortszeit, Sender) und Kinozeiten (ca. 3–5 Cent).">
          <SourceLinks embedded s={s} area="unterhaltung" city={city} query={linkQ} />
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich suche Spielpläne, TV-Programm und Kinozeiten … (ca. 20–30 Sek.)</span></div>}
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
                  <button type="button" className="pill" onClick={() => setWatch(r)}>📍 Wo?</button>
                  {r.url && <a className="pill" href={r.url} target="_blank" rel="noreferrer" aria-label={`${r.name} öffnen`}><Icon name="link" size={14} /></a>}
                </div>
              </article>
            ))}
            {search.results.length > 0 && fresh.length === 0 && <span className="sub" style={{ padding: '0 4px' }}>Alles durchgesehen – Gemerktes steht unter „Will ich sehen“.</span>}
          </section>
        )}
        {!getAi().apiKey && <Info>Ohne KI-Schlüssel funktionieren die Links trotzdem.</Info>}
      </>}
      {view === 'mine' && <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn tint small" style={{ flex: 1 }} onClick={() => setForm({ ...EMPTY, cat: activeCats.length === 1 ? activeCats[0] : '' })}>+ Eintragen</button>
          <RemovedButton items={s.removedShows || []} storeKey="removedShows" onRestore={restoreShow} meta={(x) => [x.date && fmtShort(x.date), x.where].filter(Boolean).join(' · ')} />
        </div>
        {upcoming.length === 0 && activeCats.length > 0 && (s.shows || []).some((x) => !x.done && (!x.date || x.date >= t)) && <div className="empty">Nichts in {activeCats.map(catName).join(', ')}. <button type="button" className="link-btn" onClick={() => pickCats([])}>Alle zeigen</button></div>}
        {upcoming.length === 0 && !(activeCats.length > 0 && (s.shows || []).some((x) => !x.done && (!x.date || x.date >= t))) && <div className="empty">Noch nichts gemerkt. Unter „Was kommt“ nach Formel 1, Fußball oder Kino suchen und „Interessiert mich“ tippen – oder selbst eintragen.</div>}
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
