import { useEffect, useState } from 'react';
import { store, useStore } from '../lib/store';
import { addDays, fmtShort, parseKey, today } from '../lib/dates';
import { addEvent, addPlace, addTask, deleteEvent, deletePlace, PLACE_CATS, PLACE_SUBCATS, setEventStage, updatePlace } from '../lib/actions';
import {
  allCities, citiesOf, cityOf, countryOf, hoodsOf, locateCountry, mapsUrl, cityHere, PLACE_PRICES, PLACE_TAGS, ALL_TAGS, cityPos, discoverPlaces, parsePlaces, eventCity, eventLinks, lastEventLinks, EVENT_CHIPS, EVENT_PREF_PRESETS, findPlace, geocode, HOME_CITY, lastEventSearch, lastPlaceSearch, locate, locateCity, PLACE_CHIPS, placeCity, saveEventSearch, savePlaceSearch, searchEvents,
} from '../lib/outings';
import LinkList from '../components/LinkList';
import SourceLinks, { ModeToggle, useSearchMode } from '../components/SourceLinks';
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
        <button type="button" className={edit ? 'chip on' : 'chip soft'} onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Kategorien bearbeiten'}>
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
// Stadt (v0.65): eine Zeile mit der aktuellen Stadt, „Wechseln“ öffnet die Liste aller Städte (Suche, nach Land)
function CityChips({ s }) {
  const [open, setOpen] = useState(false);
  const cur = cityOf(s);
  const known = allCities(s);
  useEffect(() => { known.forEach((c) => locateCountry(store, c)); }, [known.join('|')]);
  return (
    <>
      <button type="button" className="city-bar" onClick={() => setOpen(true)} aria-label="Stadt wechseln">
        <span style={{ fontSize: 18 }}>📍</span>
        <span className="row-main"><span className="row-title strong">{cur}</span><span className="row-meta">{countryOf(s, cur) || ' '}</span></span>
        <span className="pill" style={{ fontSize: 13 }}>Wechseln ▾</span>
      </button>
      <AllCitiesSheet s={s} open={open} onClose={() => setOpen(false)} pick={(c) => { store.update((d) => { d.profile = { ...d.profile, city: c, allCities: [...new Set([...(d.profile?.allCities || []), c])] }; }); locateCity(store, c); locateCountry(store, c); setOpen(false); }} />
    </>
  );
}
// Alle Städte nach Land: oben suchen oder neu anlegen, antippen = wechseln; Löschen nur ohne gespeicherte Orte/Events
function AllCitiesSheet({ s, open, onClose, pick }) {
  const [q, setQ] = useState('');
  const cur = cityOf(s);
  const known = allCities(s);
  const nPlaces = (c) => s.places.filter((p) => placeCity(p) === c).length;
  const nEvents = (c) => s.events.filter((e) => e.city && eventCity(e) === c).length;
  const match = known.filter((c) => !q.trim() || `${c} ${countryOf(s, c)}`.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = {};
  for (const c of match) (groups[countryOf(s, c) || 'Weitere'] = groups[countryOf(s, c) || 'Weitere'] || []).push(c);
  const lands = Object.keys(groups).sort((a, b) => (a === 'Weitere') - (b === 'Weitere') || a.localeCompare(b, 'de'));
  const exact = known.some((c) => c.toLowerCase() === q.trim().toLowerCase());
  const setLand = (c) => {
    const v = prompt(`In welchem Land liegt „${c}“?`, countryOf(s, c));
    if (v != null) store.update((d) => { d.profile = { ...d.profile, cityCountry: { ...(d.profile?.cityCountry || {}), [c]: v.trim() } }; });
  };
  const del = (c) => {
    if (!confirm(`„${c}“ ganz löschen?`)) return;
    store.update((d) => { d.profile = { ...d.profile, cities: (d.profile?.cities || []).filter((x) => x !== c), allCities: (d.profile?.allCities || []).filter((x) => x !== c) }; });
  };
  const choose = (c) => { setQ(''); pick(c); };
  const [locBusy, setLocBusy] = useState(false);
  const here = async () => {
    setLocBusy(true);
    try {
      const r = await cityHere();
      store.update((d) => { d.profile = { ...d.profile, cityCountry: { ...(d.profile?.cityCountry || {}), ...(r.country ? { [r.city]: r.country } : {}) }, cityPos: { ...(d.profile?.cityPos || {}), [r.city]: { lat: r.lat, lon: r.lon } } }; });
      choose(r.city);
      toast(`Standort: ${r.city}`);
    } catch (e) { toast(e.message); } finally { setLocBusy(false); }
  };
  return (
    <Sheet open={open} title="Stadt wählen" onClose={onClose}>
      <button type="button" className="btn sec" style={{ background: 'var(--card-2)' }} disabled={!!locBusy} onClick={here}>{locBusy ? 'Suche deinen Standort …' : '📍 Mein Standort'}</button>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stadt suchen oder neu eingeben" aria-label="Stadt suchen" />
      {q.trim() && !exact && <button type="button" className="btn" onClick={() => choose(q.trim())}>+ „{q.trim()}“ als neue Stadt</button>}
      {lands.map((land) => (
        <div key={land} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label" style={{ padding: 0 }}>{land}</span>
          <div className="list">
            {groups[land].sort((a, b) => a.localeCompare(b, 'de')).map((c) => {
              const n = nPlaces(c), ev = nEvents(c);
              return (
                <div key={c} className="row" style={{ minHeight: 50, gap: 6 }}>
                  <button type="button" className="row-main" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={() => choose(c)}>
                    <span className="row-title strong">{c === cur ? '✓ ' : ''}{c}</span>
                    <span className="row-meta">{[n && `${n} ${n === 1 ? 'Ort' : 'Orte'}`, ev && `${ev} Events`].filter(Boolean).join(' · ') || 'noch leer'}</span>
                  </button>
                  <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setLand(c)} aria-label={`Land von ${c} ändern`}><Icon name="edit" size={13} /></button>
                  {!n && !ev && c !== HOME_CITY && c !== cur && <button type="button" className="x-btn" onClick={() => del(c)} aria-label={`${c} löschen`}><Icon name="x" size={12} color="var(--chev)" /></button>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Sheet>
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
  const [smode, setSmode] = useSearchMode('events');
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
        <ModeToggle mode={smode} onChange={setSmode} />
        <form onSubmit={(e) => { e.preventDefault(); if (smode === 'ki') run(q); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z.B. Techno am Samstag, Laufevents …" aria-label="Wonach suchen" />
          {smode === 'ki' && (
            <div className="search-row">
              <button type="submit" className="btn small" style={{ flex: 1 }} disabled={!q.trim() || !!busy || !hasKey}>{busy ? '…' : '🔍 Events suchen'}</button>
            </div>
          )}
        </form>
        <SearchChips s={s} kind="events" defaults={EVENT_CHIPS} disabled={smode === 'ki' && (!!busy || !hasKey)} onPick={(c) => (smode === 'ki' ? run(c) : setQ(c))} />
        {smode === 'links' ? <SourceLinks embedded s={s} area="events" city={city} query={q} /> : (
          <>
            <span className="tiny">Die KI sucht selbst im Internet (Passline, Eventbrite, Instagram & Co.) und zeigt dir konkrete Events passend zu deinen Vorlieben – ca. 3–5 Cent pro Suche.</span>
            <Prefs s={s} />
            {!hasKey && <a href="#/einstellungen" className="link-btn">API-Schlüssel hinterlegen</a>}
          </>
        )}
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

      {!busy && smode === 'ki' && shown && (
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

function PlaceSheet({ open, onClose, place, s, city, defaultCat, defaultStatus, defaultHood = '' }) {
  const blank = { name: '', category: defaultCat || 'Café', subcat: '', note: '', rating: 0, status: defaultStatus === 'war' ? 'war' : 'will', lat: null, lon: null, address: '', url: '', city, hood: defaultHood, tags: [], price: 0 };
  const [tagText, setTagText] = useState('');
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
      const r = await findPlace(s, f.name, f.address, c);
      setHits(r);
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
      {allCities(s).length > 1 && (
        <Field label="Stadt">
          <select className="input" value={f.city || HOME_CITY} onChange={(e) => set({ city: e.target.value, lat: null, lon: null, hood: '' })}>
            {allCities(s).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      )}
      <div className="field">
        <span>Stadtviertel</span>
        {hoodsOf(s, f.city || HOME_CITY).length > 0 && <div className="chips">{hoodsOf(s, f.city || HOME_CITY).map((h) => <button key={h} type="button" className={f.hood === h ? 'chip on' : 'chip soft'} onClick={() => set({ hood: f.hood === h ? '' : h })}>{h}</button>)}</div>}
        <input className="input" value={f.hood || ''} onChange={(e) => set({ hood: e.target.value })} placeholder="z.B. Palermo, San Telmo" />
      </div>
      <div className="field">
        <span>Adresse</span>
        <div className="block-add">
          <input className="input" value={f.address} onChange={(e) => set({ address: e.target.value, lat: null, lon: null })} placeholder="z.B. Gorriti 4800, Palermo" />
          <button type="button" className="btn small" onClick={find} disabled={busy || !(f.address || f.name).trim()}>{busy ? '…' : 'Finden'}</button>
        </div>
        {f.lat != null && <span className="tiny" style={{ paddingLeft: 4, color: 'var(--accent)' }}>Auf der Karte gefunden</span>}
        {hits && hits.length === 0 && f.lat == null && (
          <span className="tiny" style={{ paddingLeft: 4 }}>Nichts gefunden (auch nicht beim zweiten Dienst). Tipp: Straße + Hausnummer ohne Zusätze. <a href={mapsUrl(f.name, f.address, f.city || city || HOME_CITY)} target="_blank" rel="noreferrer">In Google Maps suchen ↗</a></span>
        )}
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
      <div className="field">
        <span>Tags (zum Filtern)</span>
        {[...Object.entries(PLACE_TAGS), ['Eigene', [...new Set([...(f.tags || []), ...(s?.places || []).flatMap((p) => p.tags || [])])].filter((x) => !ALL_TAGS.includes(x))]].filter(([, l]) => l.length).map(([g, l]) => (
          <div key={g} className="chips" style={{ alignItems: 'center' }}>
            <span className="tiny" style={{ minWidth: 62 }}>{g}</span>
            {l.map((x) => { const on = (f.tags || []).includes(x); return <button key={x} type="button" className={on ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5 }} onClick={() => set({ tags: on ? f.tags.filter((y) => y !== x) : [...(f.tags || []), x] })}>{x}</button>; })}
          </div>
        ))}
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const v = tagText.trim(); if (v && !(f.tags || []).includes(v)) set({ tags: [...(f.tags || []), v] }); setTagText(''); }}>
          <input className="input" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Eigener Tag, z.B. Live-Musik" aria-label="Eigener Tag" />
          <button type="submit" className="btn small" disabled={!tagText.trim()}>+</button>
        </form>
      </div>
      <div className="field">
        <span>Preis</span>
        <div className="chips">{Object.entries(PLACE_PRICES).map(([k, v]) => <button key={k} type="button" className={f.price === Number(k) ? 'chip on' : 'chip soft'} onClick={() => set({ price: f.price === Number(k) ? 0 : Number(k) })}>{v}</button>)}</div>
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
// Orte per KI aus Text (v0.63): Status für alle oder je Ort, Erklärung + Google-Maps-Link zum Prüfen
function PlaceImport({ open, city, onClose, defaultStatus }) {
  const [text, setText] = useState('');
  const [list, setList] = useState(null);
  const [pick, setPick] = useState({});
  const [st, setSt] = useState({});
  const [all, setAll] = useState('text');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { if (open) setAll(defaultStatus === 'will' || defaultStatus === 'war' ? defaultStatus : 'text'); }, [open, defaultStatus]);
  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const l = await parsePlaces(text, city);
      setList(l);
      setPick(Object.fromEntries(l.map((x) => [x.id, true])));
      setSt(Object.fromEntries(l.map((x) => [x.id, all === 'text' ? x.status : all])));
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const setAllTo = (v) => { setAll(v); if (list) setSt(Object.fromEntries(list.map((x) => [x.id, v === 'text' ? x.status : v]))); };
  const save = async () => {
    const chosen = list.filter((x) => pick[x.id]);
    const ids = chosen.map((x) => { const { info, ...rest } = x; return [x, addPlace({ ...rest, status: st[x.id] || x.status, city })]; });
    toast(`${chosen.length} Orte in ${city} gespeichert`);
    setText(''); setList(null); onClose();
    for (const [x, id] of ids) { const pos = await locate(x.name, x.address, city); if (pos) updatePlace(id, { lat: pos.lat, lon: pos.lon }); }
  };
  const statusSeg = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="label" style={{ padding: 0 }}>Für alle Orte</span>
      <Segmented full label="Status für alle" value={all} onChange={setAllTo} options={[{ id: 'text', label: 'Wie im Text' }, { id: 'will', label: 'Will hin' }, { id: 'war', label: 'War schon' }]} />
    </div>
  );
  return (
    <Sheet open={open} title={`✨ Orte in ${city} einfügen`} onClose={onClose}>
      {!list ? (
        <>
          <span className="sub">Füg eine Liste ein (z.B. aus Notizen, WhatsApp, einem Artikel) oder diktier sie über die Tastatur. Die KI erkennt jeden Ort und ordnet Art, Viertel und Tags zu.</span>
          <textarea className="input" style={{ minHeight: 140 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'z.B. „Café Crisol in Palermo – bester Flat White. Don Julio, Parrilla, war super. Floreria Atlántico Cocktailbar.“'} aria-label="Text mit Orten" />
          {statusSeg}
          <button type="button" className="btn" onClick={run} disabled={busy || !text.trim() || !getAi().apiKey}>{busy ? 'Ich sortiere …' : '✨ Orte erkennen'}</button>
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        </>
      ) : (
        <>
          <span className="sub">{list.length ? `${list.length} ${list.length === 1 ? 'Ort' : 'Orte'} erkannt. Prüf mit „Maps ↗“, ob es der richtige ist, und tipp auf den Status, um ihn zu ändern.` : 'Keine Orte gefunden.'}</span>
          {list.length > 0 && statusSeg}
          {list.map((x) => (
            <div key={x.id} className="option" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!pick[x.id]} onChange={() => setPick({ ...pick, [x.id]: !pick[x.id] })} aria-label={`${x.name} übernehmen`} />
              <span className="row-main" style={{ gap: 3 }}>
                <span style={{ fontWeight: 650 }}>{x.name}</span>
                <span className="tiny">{[x.category, x.subcat, x.hood && `🏘 ${x.hood}`, x.address].filter(Boolean).join(' · ')}</span>
                {x.info && <span className="tiny" style={{ color: /nicht sicher/i.test(x.info) ? 'var(--danger)' : 'var(--text)' }}>💡 {x.info}</span>}
                {(x.tags || []).length > 0 && <span className="tiny">🏷 {x.tags.join(', ')}</span>}
                <span style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  <button type="button" className={(st[x.id] || x.status) === 'war' ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5 }} onClick={() => setSt({ ...st, [x.id]: (st[x.id] || x.status) === 'war' ? 'will' : 'war' })}>{(st[x.id] || x.status) === 'war' ? '✓ War schon' : '☆ Will hin'}</button>
                  <a className="link-chip" href={mapsUrl(x.name, x.address, city)} target="_blank" rel="noreferrer">Maps ↗</a>
                </span>
              </span>
            </div>
          ))}
          <button type="button" className="btn" onClick={save} disabled={!list.some((x) => pick[x.id])}>{list.filter((x) => pick[x.id]).length} Orte speichern</button>
          <button type="button" className="link-btn" onClick={() => setList(null)}>Zurück zum Text</button>
        </>
      )}
    </Sheet>
  );
}

function Orte({ s, city }) {
  const [pmode, setPmode] = useSearchMode('orte');
  const [importOpen, setImportOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [status, setStatus] = useState('alle');
  const [cat, setCat] = useState(null);
  const [sub, setSub] = useState(null);
  const [hoodSel, setHoodSel] = useState([]);
  const [catSel, setCatSel] = useState([]);
  const [subSel, setSubSel] = useState([]);
  const [starSel, setStarSel] = useState([]);
  const [priceSel, setPriceSel] = useState([]);
  const [tagSel, setTagSel] = useState([]);
  const [fsheet, setFsheet] = useState(null); // 'viertel' | 'art' | 'sterne' | 'mehr'
  const [newHood, setNewHood] = useState('');
  const [sheet, setSheet] = useState(null); // null | 'neu' | place
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(lastPlaceSearch);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;

  const here = s.places.filter((p) => placeCity(p) === city);
  const catOf = (p) => (PLACE_CATS.includes(p.category) ? p.category : 'Sonstiges');
  const hoods = hoodsOf(s, city);
  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const list = here.filter((p) => (status === 'alle' || p.status === status) && (!catSel.length || catSel.includes(catOf(p))) && (!subSel.length || subSel.includes(p.subcat))
    && (!hoodSel.length || hoodSel.includes(p.hood)) && (!starSel.length || starSel.includes(p.rating || 0)) && (!priceSel.length || priceSel.includes(p.price || 0)) && tagSel.every((x) => (p.tags || []).includes(x)));
  const addHood = (v) => {
    if (v && v.trim()) store.update((d) => { const h = d.profile?.hoods || {}; d.profile = { ...d.profile, hoods: { ...h, [city]: [...new Set([...(h[city] || []), v.trim()])] } }; });
  };
  const nActive = hoodSel.length + catSel.length + subSel.length + starSel.length + priceSel.length + tagSel.length;
  const resetAll = () => { setHoodSel([]); setCatSel([]); setSubSel([]); setStarSel([]); setPriceSel([]); setTagSel([]); };
  const label = (base, sel) => (sel.length === 0 ? base : sel.length === 1 ? String(sel[0]) : `${sel[0]} +${sel.length - 1}`);
  const subsAll = [...new Set(here.filter((p) => (!catSel.length || catSel.includes(catOf(p))) && p.subcat).map((p) => p.subcat))];
  const usedTags = [...new Set(here.flatMap((p) => p.tags || []))];
  const subs = cat ? [...new Set(here.filter((p) => catOf(p) === cat && p.subcat).map((p) => p.subcat))] : [];
  const groups = PLACE_CATS.map((c) => ({ c, items: list.filter((p) => catOf(p) === c).sort((a, b) => (a.subcat || 'zz').localeCompare(b.subcat || 'zz')) })).filter((g) => g.items.length);
  const cats = [...new Set(here.map(catOf))];
  const shown = search && (search.city || HOME_CITY) === city ? search : null;
  useEffect(() => { locateCity(store, city); setSel(null); resetAll(); }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const id = addPlace({ name: r.name, category: r.category, subcat: r.subcat, note: r.why, address: r.address, hood: r.hood || '', tags: r.tags || [], price: r.price || 0, url: r.url, status: 'will', lat: pos?.lat ?? null, lon: pos?.lon ?? null, city });
    toast('In deiner Liste gemerkt');
  };
  const routeUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat != null ? `${p.lat},${p.lon}` : `${p.name} ${p.address} ${placeCity(p)}`)}`;

  return (
    <>
      {/* v0.66 (Mateo): kompakt – vier Filter-Knöpfe, jeder öffnet eine Auswahl (mehrere möglich) */}
      <div className="filter-row">
        <button type="button" className={hoodSel.length ? 'chip on' : 'chip soft'} onClick={() => setFsheet('viertel')}>🏘 {label('Viertel', hoodSel)}</button>
        <button type="button" className={catSel.length || subSel.length ? 'chip on' : 'chip soft'} onClick={() => setFsheet('art')}>🍽 {label('Art', [...catSel, ...subSel])}</button>
        <button type="button" className={starSel.length ? 'chip on' : 'chip soft'} onClick={() => setFsheet('sterne')}>★ {starSel.length ? starSel.map((n) => n || 'ohne').join(', ') : 'Sterne'}</button>
        <button type="button" className={priceSel.length || tagSel.length ? 'chip on' : 'chip soft'} onClick={() => setFsheet('mehr')}>⚙︎ Mehr{priceSel.length + tagSel.length ? ` (${priceSel.length + tagSel.length})` : ''}</button>
      </div>
      {nActive > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13, marginTop: -6 }} onClick={resetAll}>✕ Alle Filter zurücksetzen · {list.length} von {here.length} Orten</button>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Segmented options={[{ id: 'alle', label: 'Alle' }, { id: 'will', label: 'Will hin' }, { id: 'war', label: 'War da' }]} value={status} onChange={setStatus} label="Filter" />
        <button type="button" className="btn small sec" style={{ marginLeft: 'auto', background: 'var(--card-2)' }} onClick={() => setImportOpen(true)} aria-label="Orte per KI aus Text einfügen">✨ KI</button>
        <button type="button" className="btn small" onClick={() => setSheet('neu')}>+ Ort</button>
      </div>
      {list.length === 0 && <div className="list"><div className="empty">{nActive ? 'Keine Orte passen zu den Filtern.' : `Noch keine Orte in ${city}.`} Tipp auf „+ Ort“, füg mit „✨ KI“ gleich mehrere aus einem Text ein oder lass dir unten neue vorschlagen.</div></div>}
      {groups.map((g) => (
        <section key={g.c} className="group">
          {catSel.length !== 1 && <h2 className="label" style={{ padding: '0 4px' }}>{g.c} · {g.items.length}</h2>}
          <div className="list">
            {g.items.map((p) => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <button type="button" className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => setSel(sel === p.id ? null : p.id)}>
                  <span className="cat-dot" style={{ background: CAT_COLOR[p.category] }} />
                  <span className="row-main">
                    <span className="row-title plain">{p.name}</span>
                    <span className="row-meta">{[p.subcat || p.category, p.hood, p.price ? '$'.repeat(p.price) : '', p.status === 'war' ? (p.rating ? '★'.repeat(p.rating) : 'War da') : 'Will hin'].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="tiny">{sel === p.id ? '▴' : '▾'}</span>
                </button>
                {sel === p.id && (
                  <div style={{ padding: '0 16px 12px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {p.rating > 0 && <Stars value={p.rating} />}
                    {p.address && <span className="tiny">{p.address}</span>}
                    {(p.tags || []).length > 0 && <div className="chips">{p.tags.map((x) => <span key={x} className="chip soft" style={{ fontSize: 12 }}>{x}</span>)}</div>}
                    {p.note && <span style={{ fontSize: 14.5, lineHeight: 1.4 }}>{p.note}</span>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <a className="pill on" href={routeUrl(p)} target="_blank" rel="noreferrer">Route</a>
                      {p.url && <a className="pill" href={p.url} target="_blank" rel="noreferrer">Link <Icon name="link" size={13} /></a>}
                      {p.status === 'will' && <button type="button" className="pill" onClick={() => { updatePlace(p.id, { status: 'war' }); setSheet(p); }}>War da</button>}
                      <button type="button" className="pill" onClick={() => setSheet(p)}>Bearbeiten</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Neue Orte in {city} entdecken</span>
        <ModeToggle mode={pmode} onChange={setPmode} />
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (pmode === 'ki') run(q); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z.B. Specialty Coffee in Palermo" aria-label="Orte suchen" />
          {pmode === 'ki' && <button type="submit" className="btn small" disabled={!q.trim() || busy || !hasKey} aria-label="Suchen"><Icon name="search" size={16} color="currentColor" /></button>}
        </form>
        <SearchChips s={s} kind="places" defaults={PLACE_CHIPS} disabled={pmode === 'ki' && (busy || !hasKey)} onPick={(c) => (pmode === 'ki' ? run(c) : setQ(c))} />
        {pmode === 'links' && <SourceLinks embedded s={s} area="orte" city={city} query={q} />}
        {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich suche Empfehlungen … (ca. 20 Sek.)</span></div>}
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        {pmode === 'ki' && !busy && shown && shown.results.filter((r) => r.status === 'neu').map((r) => (
          <div key={r.id} className="option" style={{ alignItems: 'center' }}>
            <span className="cat-dot" style={{ background: CAT_COLOR[r.category] || CAT_COLOR.Sonstiges }} />
            <span className="row-main">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
              <span className="tiny">{[r.subcat || r.category, r.hood, r.address].filter(Boolean).join(' · ')}</span>
              {r.why && <span className="tiny" style={{ color: 'var(--text)' }}>{r.why}</span>}
            </span>
            {r.url && <a className="x-btn" href={r.url} target="_blank" rel="noreferrer" aria-label={`${r.name} öffnen`}><Icon name="link" size={15} color="var(--accent)" /></a>}
            <button type="button" className="pill on" onClick={() => keep(r)}>Merken</button>
          </div>
        ))}
      </section>
      <Sheet open={!!fsheet} title={{ viertel: 'Stadtviertel', art: 'Art', sterne: 'Sterne', mehr: 'Weitere Filter' }[fsheet] || ''} onClose={() => setFsheet(null)}>
        {fsheet === 'viertel' && (
          <>
            <div className="chips">{hoods.map((h) => <button key={h} type="button" className={hoodSel.includes(h) ? 'chip on' : 'chip soft'} onClick={() => tog(hoodSel, setHoodSel, h)}>{h} {here.filter((p) => p.hood === h).length}</button>)}</div>
            {!hoods.length && <span className="tiny">Noch keine Viertel – leg eins an oder trag es bei einem Ort ein.</span>}
            <form className="block-add" onSubmit={(e) => { e.preventDefault(); addHood(newHood); setNewHood(''); }}>
              <input className="input" value={newHood} onChange={(e) => setNewHood(e.target.value)} placeholder={`Neues Viertel in ${city}`} aria-label="Neues Viertel" />
              <button type="submit" className="btn small" disabled={!newHood.trim()}>+</button>
            </form>
          </>
        )}
        {fsheet === 'art' && (
          <>
            <div className="chips">{PLACE_CATS.filter((c) => cats.includes(c)).map((c) => <button key={c} type="button" className={catSel.includes(c) ? 'chip on' : 'chip soft'} onClick={() => { tog(catSel, setCatSel, c); setSubSel([]); }}>{c} {here.filter((p) => catOf(p) === c).length}</button>)}</div>
            {subsAll.length > 0 && <><span className="label" style={{ padding: 0 }}>Genauer</span><div className="chips">{subsAll.map((c) => <button key={c} type="button" className={subSel.includes(c) ? 'chip on' : 'chip soft'} onClick={() => tog(subSel, setSubSel, c)}>{c}</button>)}</div></>}
          </>
        )}
        {fsheet === 'sterne' && (
          <div className="chips">{[5, 4, 3, 2, 1, 0].map((n) => <button key={n} type="button" className={starSel.includes(n) ? 'chip on' : 'chip soft'} onClick={() => tog(starSel, setStarSel, n)}>{n ? '★'.repeat(n) : 'Noch ohne Bewertung'} {here.filter((p) => (p.rating || 0) === n).length}</button>)}</div>
        )}
        {fsheet === 'mehr' && (
          <>
            <div className="field"><span>Preis</span><div className="chips">{Object.entries(PLACE_PRICES).map(([k, v]) => <button key={k} type="button" className={priceSel.includes(Number(k)) ? 'chip on' : 'chip soft'} onClick={() => tog(priceSel, setPriceSel, Number(k))}>{v}</button>)}</div></div>
            {[...Object.entries(PLACE_TAGS), ['Eigene', usedTags.filter((x) => !ALL_TAGS.includes(x))]].filter(([, l]) => l.length).map(([g, l]) => (
              <div key={g} className="field">
                <span>{g}</span>
                <div className="chips">{l.map((x) => <button key={x} type="button" className={tagSel.includes(x) ? 'chip on' : 'chip soft'} style={usedTags.includes(x) ? undefined : { opacity: 0.6 }} onClick={() => tog(tagSel, setTagSel, x)}>{x}</button>)}</div>
              </div>
            ))}
            <span className="tiny">Bei Tags werden nur Orte gezeigt, die alle gewählten Tags haben.</span>
          </>
        )}
        <button type="button" className="btn" onClick={() => setFsheet(null)}>{list.length} {list.length === 1 ? 'Ort' : 'Orte'} zeigen</button>
      </Sheet>
      <PlaceImport open={importOpen} city={city} defaultStatus={status} onClose={() => setImportOpen(false)} />
      <PlaceSheet s={s} city={city} defaultCat={catSel.length === 1 ? catSel[0] : null} defaultHood={hoodSel.length === 1 ? hoodSel[0] : ''} defaultStatus={status} open={!!sheet} place={sheet && sheet !== 'neu' ? s.places.find((p) => p.id === sheet.id) : null} onClose={() => setSheet(null)} />
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
