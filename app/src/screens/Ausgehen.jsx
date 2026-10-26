import { useEffect, useState } from 'react';
import { store, useStore } from '../lib/store';
import { addDays, fmtShort, parseKey, today } from '../lib/dates';
import { addEvent, addPlace, addTask, deleteEvent, deletePlace, PLACE_CATS, PLACE_SUBCATS, setEventStage, updatePlace } from '../lib/actions';
import {
  citiesOf, cityOf, cityPos, discoverPlaces, parsePlaces, eventCity, eventLinks, lastEventLinks, EVENT_CHIPS, EVENT_PREF_PRESETS, geocode, HOME_CITY, lastEventSearch, lastPlaceSearch, locate, locateCity, PLACE_CHIPS, placeCity, saveEventSearch, savePlaceSearch, searchEvents,
} from '../lib/outings';
import LinkList from '../components/LinkList';
import { getAi } from '../lib/ai';
import MapView, { CAT_COLOR } from '../components/MapView';
import { Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const TAB_KEY = 'life-app-ausgehen-tab';

// Eigene Such-Kategorien: Knöpfe hinzufügen, entfernen (gespeichert in s.profile.chips)
function SearchChips({ s, kind, defaults, disabled, onPick }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const chips = s.profile?.chips?.[kind] ?? defaults;
  const save = (list) => store.update((d) => {
    d.profile = { ...d.profile, chips: { ...(d.profile?.chips || {}), [kind]: list } };
  });
  return (
    <>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className={edit ? 'chip soft editing' : 'chip soft'} disabled={!edit && disabled} onClick={() => (edit ? save(chips.filter((x) => x !== c)) : onPick(c))} aria-label={edit ? `${c} entfernen` : c}>
            {c}{edit && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className="chip soft" onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Kategorien bearbeiten'}>
          {edit ? 'Fertig' : <Icon name="edit" size={14} />}
        </button>
      </div>
      {edit && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t && !chips.includes(t)) save([...chips, t]); setText(''); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'events' ? 'z.B. Jazz, Padel, Weinproben …' : 'z.B. Sushi, Buchläden, Coworking …'} aria-label="Neue Kategorie" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      )}
      {edit && <span className="tiny">Antippen entfernt eine Kategorie. Eigene Knöpfe suchen genau danach.</span>}
    </>
  );
}

// Städte (v0.40): zwischen Buenos Aires, Frankfurt … wechseln – gilt für Events und Orte, bearbeitbar
function CityChips({ s }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const list = citiesOf(s);
  const cur = cityOf(s);
  const pick = (c) => store.update((d) => { d.profile = { ...d.profile, city: c }; });
  const save = (l) => store.update((d) => { d.profile = { ...d.profile, cities: l }; });
  const remove = (c) => {
    if (list.length <= 1) return toast('Mindestens eine Stadt bleibt');
    const n = s.places.filter((p) => placeCity(p) === c).length;
    if (n && !confirm(`„${c}“ entfernen? Deine ${n} Orte dort bleiben gespeichert und tauchen wieder auf, wenn du die Stadt neu hinzufügst.`)) return;
    save(list.filter((x) => x !== c));
  };
  const add = (e) => {
    e.preventDefault();
    const c = text.trim();
    if (c && !list.some((x) => x.toLowerCase() === c.toLowerCase())) {
      save([...list, c]);
      pick(c);
      locateCity(store, c);
    }
    setText('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="box-tabs">
        {list.map((c) => (
          <button key={c} type="button" className={edit ? 'chip soft editing' : c === cur ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => (edit ? remove(c) : pick(c))} aria-label={edit ? `${c} entfernen` : c} aria-pressed={!edit && c === cur}>
            📍 {c}{edit && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className="chip soft" onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Städte bearbeiten'}>{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
      </div>
      {edit && (
        <form className="block-add" onSubmit={add}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. Frankfurt, Montevideo, Lissabon" aria-label="Neue Stadt" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      )}
      {edit && <span className="tiny">Antippen entfernt eine Stadt. Events-Suche, Orte-Liste, Karte und „Neue Orte entdecken“ richten sich nach der gewählten Stadt.</span>}
    </div>
  );
}

function DateBadge({ date }) {
  if (!date) return <span className="date-badge"><span className="tiny">offen</span></span>;
  const d = parseKey(date);
  return (
    <span className="date-badge">
      <span className="tiny">{wd.format(d)}</span>
      <b>{d.getDate()}</b>
    </span>
  );
}
const errText = (e) => (e.message === 'KEIN_SCHLUESSEL' ? 'Für die Suche braucht es einen API-Schlüssel (Einstellungen).' : e.message);

// Vorlieben für die Event-Suche (Musikstile, Themen …)
function Prefs({ s }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const prefs = s.profile?.eventPrefs || [];
  const save = (list) => store.update((d) => {
    d.profile = { ...d.profile, eventPrefs: list };
  });
  const toggle = (p) => save(prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p]);
  const all = [...new Set([...EVENT_PREF_PRESETS, ...prefs])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setOpen(!open)}>
        Meine Vorlieben{prefs.length ? `: ${prefs.slice(0, 4).join(', ')}${prefs.length > 4 ? ' …' : ''}` : ' festlegen'} {open ? '▴' : '▾'}
      </button>
      {open && (
        <>
          <span className="tiny">Danach sucht die KI gezielt – und auch nach Geheimtipps, die dazu passen.</span>
          <div className="chips">{all.map((p) => <button key={p} type="button" className={prefs.includes(p) ? 'chip on' : 'chip soft'} onClick={() => toggle(p)}>{p}</button>)}</div>
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t && !prefs.includes(t)) save([...prefs, t]); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Eigene, z.B. Cumbia, Elektro-Swing, Schach" aria-label="Eigene Vorliebe" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        </>
      )}
    </div>
  );
}

// ---------- Events ----------
function Events({ s, city }) {
  const t = today();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(lastEventSearch);
  const [links, setLinks] = useState(lastEventLinks);
  const mode = 'web';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;

  // web = konkrete Events per Websuche (ca. 3–5 Cent); sonst Such-Links (unter 0,5 Cent)
  const run = async (query, web = true) => {
    if (!query.trim() || busy) return;
    setBusy(web ? 'web' : 'links');
    setErr(null);
    try {
      if (web) setSearch(await searchEvents(s, query.trim(), city));
      else setLinks(await eventLinks(s, query.trim()));
      setQ('');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const mark = (id, status) => {
    const next = { ...search, results: search.results.map((r) => (r.id === id ? { ...r, status } : r)) };
    saveEventSearch(next);
    setSearch(next);
  };
  const take = (r, stage) => {
    addEvent({ name: r.name, date: r.date, place: r.place, stage, url: r.url, time: r.time, price: r.price, note: r.why, city: city === HOME_CITY ? '' : city });
    if (r.date) addTask({ title: `${stage === 'zugesagt' ? '' : 'Vielleicht: '}${r.name}`, areaId: 'erlebnisse', due: r.date, time: r.time || null, url: r.url || null });
    mark(r.id, stage);
    toast(stage === 'zugesagt' ? 'Zugesagt und im Kalender' : 'Gemerkt' + (r.date ? ' und am Tag eingetragen' : ''));
  };

  const mine = s.events.filter((e) => e.stage !== 'besucht' && !e.travel && eventCity(e) === city);
  const shown = search && (search.city || HOME_CITY) === city ? search : null;
  const upcoming = mine.filter((e) => !e.date || e.date >= t).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const past = mine.filter((e) => e.date && e.date < t);
  const fresh = (shown?.results || []).filter((r) => r.status === 'neu');

  return (
    <>
      <section className="card" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Was ist los in {city}?</span>
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z.B. Techno am Samstag, Laufevents …" aria-label="Wonach suchen" />
          <div className="search-row">
            <button type="submit" className="btn small" style={{ flex: 1 }} disabled={!q.trim() || !!busy || !hasKey}>{busy ? '…' : '🔍 Events suchen'}</button>
          </div>
        </form>
        <SearchChips s={s} kind="events" defaults={EVENT_CHIPS} disabled={!!busy || !hasKey} onPick={(c) => run(c)} />
        <span className="tiny">Die KI sucht selbst im Internet (Passline, Eventbrite, Instagram & Co.) und zeigt dir konkrete Events passend zu deinen Vorlieben – ca. 3–5 Cent pro Suche.</span>
        <Prefs s={s} />
        {!hasKey && <a href="#/einstellungen" className="link-btn">API-Schlüssel hinterlegen</a>}
        {busy && (
          <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche auf Passline, Eventbrite, Meetup & Co. … (ca. 20–30 Sek.)' : 'Ich überlege gezielte Suchen … (ca. 5 Sek.)'}</span></div>
        )}
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      </section>

      {!busy && mode === 'links' && links && (
        <section className="card" style={{ gap: 10 }}>
          <h2 className="h2" style={{ fontSize: 19 }}>Such-Links: „{links.query}“</h2>
          <LinkList links={links.links} hint={links.hint} />
        </section>
      )}

      {!busy && mode === 'web' && shown && (
        <section className="group">
          <div className="sec-h">
            <h2 className="h2" style={{ fontSize: 19 }}>„{shown.query}“</h2>
            <span className="tiny">{fresh.length} neu</span>
          </div>
          {shown.note && <span className="sub" style={{ padding: '0 4px' }}>{shown.note}</span>}
          {shown.results.length === 0 && <div className="notice">Nichts Passendes gefunden. Probier eine andere Formulierung.</div>}
          {fresh.map((r) => (
            <article key={r.id} className="nudge">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <DateBadge date={r.date} />
                <div className="row-main" style={{ gap: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 650, lineHeight: 1.3 }}>{r.name}</span>
                  <span className="tiny">{[r.time, r.place, r.price, r.source].filter(Boolean).join(' · ')}</span>
                  {r.why && <span style={{ fontSize: 14.5, lineHeight: 1.4, color: 'var(--muted)' }}>{r.tip && <b className="tip-badge">Geheimtipp</b>}{r.why}</span>}
                </div>
                <button type="button" className="x-btn" aria-label={`${r.name} ausblenden`} onClick={() => mark(r.id, 'weg')}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
              <div className="nudge-actions" style={{ paddingLeft: 56 }}>
                <button type="button" className="pill on" onClick={() => take(r, 'interessiert')}>Interessiert</button>
                <button type="button" className="pill" onClick={() => take(r, 'zugesagt')}>Bin dabei</button>
                {r.url && <a className="pill" href={r.url} target="_blank" rel="noreferrer" aria-label={`${r.name} auf ${r.source || 'der Website'} öffnen`}><Icon name="link" size={14} /></a>}
              </div>
            </article>
          ))}
          {shown.results.length > 0 && fresh.length === 0 && <span className="sub" style={{ padding: '0 4px' }}>Alle Ergebnisse durchgesehen.</span>}
        </section>
      )}

      <section className="group">
        <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Meine Events{city !== HOME_CITY ? ` in ${city}` : ''}</h2></div>
        <div className="list">
          {upcoming.length === 0 && past.length === 0 && <div className="empty">Noch nichts vorgemerkt. Such oben oder tippe beim Coach auf „Interessiert“.</div>}
          {past.map((e) => (
            <div key={e.id} className="row" style={{ minHeight: 64 }}>
              <DateBadge date={e.date} />
              <div className="row-main">
                <span className="row-title plain">{e.name}</span>
                <span className="row-meta">Warst du da?</span>
              </div>
              <button type="button" className="pill on" onClick={() => { setEventStage(e.id, 'besucht'); toast('Schön! Als besucht gespeichert'); }}>Ja</button>
              <button type="button" className="pill" onClick={() => deleteEvent(e.id)}>Nein</button>
            </div>
          ))}
          {upcoming.map((e) => (
            <div key={e.id} className="row" style={{ minHeight: 64 }}>
              <DateBadge date={e.date} />
              <div className="row-main">
                {e.url ? <a className="row-title plain" href={e.url} target="_blank" rel="noreferrer">{e.name}</a> : <span className="row-title plain">{e.name}</span>}
                <span className="row-meta">{[e.stage === 'zugesagt' ? 'Dabei' : e.stage === 'interessiert' ? 'Interessiert' : 'Entdeckt', e.time, e.place].filter(Boolean).join(' · ')}</span>
              </div>
              {e.stage !== 'zugesagt' && <button type="button" className="pill" onClick={() => { setEventStage(e.id, 'zugesagt'); toast('Zugesagt'); }}>Bin dabei</button>}
              <button type="button" className="x-btn" aria-label={`${e.name} entfernen`} onClick={() => deleteEvent(e.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------- Orte ----------
function Stars({ value, onChange, size = 18 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} role={onChange ? 'radiogroup' : undefined} aria-label="Bewertung">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(value === n ? 0 : n)} aria-label={`${n} Sterne`} style={{ border: 0, background: 'none', padding: 0, color: n <= value ? '#F5B225' : 'var(--line)', fontSize: size, lineHeight: 1 }}>★</button>
      ))}
    </span>
  );
}

function PlaceSheet({ open, onClose, place, s, city }) {
  const blank = { name: '', category: 'Café', subcat: '', note: '', rating: 0, status: 'will', lat: null, lon: null, address: '', url: '', city };
  const [f, setF] = useState(blank);
  const [hits, setHits] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setF(place ? { ...blank, ...place } : blank);
      setHits(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place?.id]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const find = async () => {
    setBusy(true);
    try {
      const c = f.city || city || HOME_CITY;
      const r = await geocode(`${f.address || f.name}, ${c}`, c);
      setHits(r);
      if (!r.length) toast('Nichts gefunden – Adresse genauer eingeben');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    if (place) updatePlace(place.id, f);
    else addPlace(f);
    toast(place ? 'Gespeichert' : 'Ort gespeichert');
    onClose();
  };
  return (
    <Sheet open={open} title={place ? 'Ort bearbeiten' : 'Neuer Ort'} onClose={onClose}>
      <Field label="Name"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="z.B. Café Crisol" /></Field>
      {citiesOf(s).length > 1 && (
        <div className="field">
          <span>Stadt</span>
          <div className="chips">{citiesOf(s).map((c) => <button key={c} type="button" className={(f.city || HOME_CITY) === c ? 'chip on' : 'chip soft'} onClick={() => set({ city: c, lat: null, lon: null })}>{c}</button>)}</div>
        </div>
      )}
      <div className="field">
        <span>Adresse oder Viertel</span>
        <div className="block-add">
          <input className="input" value={f.address} onChange={(e) => set({ address: e.target.value, lat: null, lon: null })} placeholder="z.B. Gorriti 4800, Palermo" />
          <button type="button" className="btn small" onClick={find} disabled={busy || !(f.address || f.name).trim()}>{busy ? '…' : 'Finden'}</button>
        </div>
        {f.lat != null && <span className="tiny" style={{ paddingLeft: 4, color: 'var(--accent)' }}>Auf der Karte gefunden</span>}
        {hits && hits.length > 0 && f.lat == null && (
          <div className="list">
            {hits.map((h, i) => (
              <button key={i} type="button" className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => { set({ lat: h.lat, lon: h.lon }); setHits(null); }}>
                <span className="row-main"><span className="row-meta" style={{ fontSize: 14 }}>{h.label}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <span>Art</span>
        <div className="chips">
          {PLACE_CATS.map((c) => <button key={c} type="button" className={f.category === c ? 'chip on' : 'chip'} onClick={() => set({ category: c, subcat: f.category === c ? f.subcat : '' })}>{c}</button>)}
        </div>
      </div>
      <div className="field">
        <span>Genauer (optional)</span>
        <div className="chips">
          {[...new Set([...(PLACE_SUBCATS[f.category] || []), ...(s?.places || []).filter((p) => p.category === f.category && p.subcat).map((p) => p.subcat)])].map((c) => <button key={c} type="button" className={f.subcat === c ? 'chip on' : 'chip soft'} onClick={() => set({ subcat: f.subcat === c ? '' : c })}>{c}</button>)}
        </div>
        <input className="input" value={f.subcat} onChange={(e) => set({ subcat: e.target.value })} placeholder="Eigene Unterart, z.B. Bar mit Terrasse" />
      </div>
      <Segmented full options={[{ id: 'will', label: 'Will ich hin' }, { id: 'war', label: 'War schon da' }]} value={f.status} onChange={(v) => set({ status: v })} label="Status" />
      {f.status === 'war' && <div className="field"><span>Wie fandest du es?</span><Stars value={f.rating} onChange={(v) => set({ rating: v })} size={26} /></div>}
      <Field label="Notiz"><textarea className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="z.B. Bester Flat White, gut zum Arbeiten, Terrasse" /></Field>
      <Field label="Link (optional)"><input className="input" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="Instagram, Website …" /></Field>
      <button type="button" className="btn" onClick={save} disabled={!f.name.trim()}>Speichern</button>
      {place && <button type="button" className="btn danger" onClick={() => { if (confirm(`„${place.name}“ löschen?`)) { deletePlace(place.id); onClose(); } }}>Löschen</button>}
    </Sheet>
  );
}

// Mehrere Orte auf einmal: Text einfügen oder diktieren → KI zieht die Orte heraus → abhaken → in die Liste der gewählten Stadt
function PlaceImport({ open, city, onClose }) {
  const [text, setText] = useState('');
  const [list, setList] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async () => {
    setBusy(true); setErr(null);
    try { const l = await parsePlaces(text, city); setList(l); setPick(Object.fromEntries(l.map((x) => [x.id, true]))); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    const chosen = list.filter((x) => pick[x.id]);
    const ids = chosen.map((x) => [x, addPlace({ ...x, city })]);
    toast(`${chosen.length} Orte in ${city} gespeichert`);
    setText(''); setList(null); onClose();
    for (const [x, id] of ids) { const pos = await locate(x.name, x.address, city); if (pos) updatePlace(id, { lat: pos.lat, lon: pos.lon }); }
  };
  return (
    <Sheet open={open} title={`Orte in ${city} einfügen`} onClose={onClose}>
      {!list ? (
        <>
          <span className="sub">Füg eine Liste ein (z.B. aus Notizen, WhatsApp, einem Artikel) oder diktier sie über die Tastatur. Die KI sortiert jeden Ort ein – mit deinen Notizen.</span>
          <textarea className="input" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'z.B. „Café Crisol in Palermo – bester Flat White. Don Julio, Parrilla, war super. Floreria Atlántico Cocktailbar, will ich hin.“'} aria-label="Text mit Orten" />
          <button type="button" className="btn" onClick={run} disabled={busy || !text.trim() || !getAi().apiKey}>{busy ? 'Ich sortiere …' : '✨ Orte herausziehen'}</button>
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        </>
      ) : (
        <>
          {list.length === 0 && <span className="sub">Keine Orte gefunden.</span>}
          {list.map((x) => (
            <label key={x.id} className="option">
              <input type="checkbox" checked={!!pick[x.id]} onChange={() => setPick({ ...pick, [x.id]: !pick[x.id] })} />
              <span className="row-main">
                <span style={{ fontWeight: 600 }}>{x.name}</span>
                <span className="tiny">{[x.subcat || x.category, x.address, x.status === 'war' ? 'War schon da' : 'Will hin'].filter(Boolean).join(' · ')}</span>
                {x.note && <span className="tiny" style={{ color: 'var(--text)' }}>{x.note}</span>}
              </span>
            </label>
          ))}
          <button type="button" className="btn" onClick={save} disabled={!list.some((x) => pick[x.id])}>{list.filter((x) => pick[x.id]).length} Orte speichern</button>
          <button type="button" className="link-btn" onClick={() => setList(null)}>Zurück zum Text</button>
        </>
      )}
    </Sheet>
  );
}

function Orte({ s, city }) {
  const [importOpen, setImportOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [status, setStatus] = useState('alle');
  const [cat, setCat] = useState(null);
  const [sub, setSub] = useState(null);
  const [sheet, setSheet] = useState(null); // null | 'neu' | place
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(lastPlaceSearch);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;

  const here = s.places.filter((p) => placeCity(p) === city);
  const list = here.filter((p) => (status === 'alle' || p.status === status) && (!cat || p.category === cat) && (!sub || p.subcat === sub));
  const subs = cat ? [...new Set(here.filter((p) => p.category === cat && p.subcat).map((p) => p.subcat))] : [];
  const groups = PLACE_CATS.map((c) => ({ c, items: list.filter((p) => p.category === c).sort((a, b) => (a.subcat || 'zz').localeCompare(b.subcat || 'zz')) })).filter((g) => g.items.length);
  const cats = [...new Set(here.map((p) => p.category))];
  const selected = here.find((p) => p.id === sel);
  const shown = search && (search.city || HOME_CITY) === city ? search : null;
  useEffect(() => { locateCity(store, city); setCat(null); setSub(null); setSel(null); }, [city]);

  const run = async (query) => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      setSearch(await discoverPlaces(s, query.trim(), city));
      setQ('');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const keep = async (r) => {
    const next = { ...search, results: search.results.map((x) => (x.id === r.id ? { ...x, status: 'gemerkt' } : x)) };
    setSearch(next);
    savePlaceSearch(next);
    const pos = await locate(r.name, r.address, city);
    const id = addPlace({ name: r.name, category: r.category, subcat: r.subcat, note: r.why, address: r.address, url: r.url, status: 'will', lat: pos?.lat ?? null, lon: pos?.lon ?? null, city });
    toast(pos ? 'Gemerkt und auf der Karte' : 'Gemerkt (ohne Kartenpunkt)');
    if (pos) setSel(id);
  };
  const routeUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat != null ? `${p.lat},${p.lon}` : `${p.name} ${p.address} ${placeCity(p)}`)}`;

  return (
    <>
      <MapView places={list} selectedId={sel} onSelect={setSel} center={cityPos(s, city)} zoom={12} />
      {selected && (
        <article className="nudge">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="cat-dot" style={{ background: CAT_COLOR[selected.category] }} />
            <div className="row-main" style={{ gap: 3 }}>
              <span style={{ fontSize: 17, fontWeight: 650 }}>{selected.name}</span>
              <span className="tiny">{[selected.category, selected.subcat, selected.status === 'war' ? 'War schon da' : 'Will ich hin', selected.address].filter(Boolean).join(' · ')}</span>
              {selected.rating > 0 && <Stars value={selected.rating} />}
              {selected.note && <span style={{ fontSize: 14.5, lineHeight: 1.4 }}>{selected.note}</span>}
            </div>
            <button type="button" className="x-btn" aria-label="Schließen" onClick={() => setSel(null)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
          <div className="nudge-actions" style={{ paddingLeft: 24 }}>
            <a className="pill on" href={routeUrl(selected)} target="_blank" rel="noreferrer">Route</a>
            {selected.url && <a className="pill" href={selected.url} target="_blank" rel="noreferrer">Link <Icon name="link" size={13} /></a>}
            {selected.status === 'will' && <button type="button" className="pill" onClick={() => { updatePlace(selected.id, { status: 'war' }); setSheet(selected); }}>War da</button>}
            <button type="button" className="pill" onClick={() => setSheet(selected)}>Bearbeiten</button>
          </div>
        </article>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Segmented options={[{ id: 'alle', label: 'Alle' }, { id: 'will', label: 'Will hin' }, { id: 'war', label: 'War da' }]} value={status} onChange={setStatus} label="Filter" />
        <button type="button" className="btn small sec" style={{ marginLeft: 'auto', background: 'var(--card-2)' }} onClick={() => setImportOpen(true)}>📋 Liste</button>
        <button type="button" className="btn small" onClick={() => setSheet('neu')}>+ Ort</button>
      </div>
      {cats.length > 0 && (
        <div className="box-tabs">
          <button type="button" className={!cat ? 'chip on' : 'chip soft'} onClick={() => { setCat(null); setSub(null); }}>Alle Arten</button>
          {PLACE_CATS.filter((c) => cats.includes(c)).map((c) => <button key={c} type="button" className={cat === c ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => { setCat(cat === c ? null : c); setSub(null); }}>{c} {here.filter((p) => p.category === c).length}</button>)}
        </div>
      )}
      {subs.length > 0 && (
        <div className="chips">
          <button type="button" className={!sub ? 'chip on' : 'chip soft'} onClick={() => setSub(null)}>Alle {cat}s</button>
          {subs.map((c) => <button key={c} type="button" className={sub === c ? 'chip on' : 'chip soft'} onClick={() => setSub(sub === c ? null : c)}>{c}</button>)}
        </div>
      )}
      {list.length === 0 && <div className="list"><div className="empty">Noch keine Orte{cat ? ` in „${cat}“` : ''} in {city}. Füg deine Lieblingsorte hinzu, sag dem Assistenten „Merk dir die Bar … in Palermo“ oder lass dir unten neue vorschlagen.</div></div>}
      {groups.map((g) => (
        <section key={g.c} className="group">
          {!cat && <h2 className="label" style={{ padding: '0 4px' }}>{g.c} · {g.items.length}</h2>}
          <div className="list">
            {g.items.map((p) => (
              <button key={p.id} type="button" className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => { setSel(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span className="cat-dot" style={{ background: CAT_COLOR[p.category] }} />
                <span className="row-main">
                  <span className="row-title plain">{p.name}</span>
                  <span className="row-meta">{[p.subcat || p.category, p.status === 'war' ? (p.rating ? '★'.repeat(p.rating) : 'War da') : 'Will hin', p.lat == null && 'ohne Karte'].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="card" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Neue Orte in {city} entdecken</span>
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); run(q); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z.B. Specialty Coffee in Palermo" aria-label="Orte suchen" />
          <button type="submit" className="btn small" disabled={!q.trim() || busy || !hasKey} aria-label="Suchen"><Icon name="search" size={16} color="currentColor" /></button>
        </form>
        <SearchChips s={s} kind="places" defaults={PLACE_CHIPS} disabled={busy || !hasKey} onPick={run} />
        {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich suche Empfehlungen … (ca. 20 Sek.)</span></div>}
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        {!busy && shown && shown.results.filter((r) => r.status === 'neu').map((r) => (
          <div key={r.id} className="option" style={{ alignItems: 'center' }}>
            <span className="cat-dot" style={{ background: CAT_COLOR[r.category] || CAT_COLOR.Sonstiges }} />
            <span className="row-main">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
              <span className="tiny">{[r.subcat || r.category, r.address].filter(Boolean).join(' · ')}</span>
              {r.why && <span className="tiny" style={{ color: 'var(--text)' }}>{r.why}</span>}
            </span>
            {r.url && <a className="x-btn" href={r.url} target="_blank" rel="noreferrer" aria-label={`${r.name} öffnen`}><Icon name="link" size={15} color="var(--accent)" /></a>}
            <button type="button" className="pill on" onClick={() => keep(r)}>Merken</button>
          </div>
        ))}
      </section>
      <PlaceImport open={importOpen} city={city} onClose={() => setImportOpen(false)} />
      <PlaceSheet s={s} city={city} open={!!sheet} place={sheet && sheet !== 'neu' ? s.places.find((p) => p.id === sheet.id) : null} onClose={() => setSheet(null)} />
    </>
  );
}

export default function Ausgehen() {
  const s = useStore();
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) || 'events';
    } catch {
      return 'events';
    }
  });
  const choose = (v) => {
    setTab(v);
    try {
      localStorage.setItem(TAB_KEY, v);
    } catch {}
  };
  const soon = s.events.filter((e) => e.stage === 'zugesagt' && e.date >= today() && e.date <= addDays(today(), 7));
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="eyebrow">{soon.length ? `Diese Woche: ${soon.map((e) => `${e.name} (${fmtShort(e.date)})`).join(', ')}` : 'Events und Lieblingsorte'}</span>
          <h1 className="h1">Ausgehen</h1>
        </div>
        <Segmented full options={[{ id: 'events', label: 'Events' }, { id: 'orte', label: 'Orte' }]} value={tab} onChange={choose} label="Ansicht" />
        <CityChips s={s} />
        {tab === 'events' ? <Events s={s} city={cityOf(s)} /> : <Orte s={s} city={cityOf(s)} />}
      </main>
      <TabBar active="ausgehen" />
    </>
  );
}
