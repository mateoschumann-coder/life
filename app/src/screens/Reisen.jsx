import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addCheck, addEntry, addExpense, addTrip, applyTripProposal, commitTrip, locateEntry, MODES, PACK_TEMPLATE, PLACE_CAT, PLACE_KINDS,
  removeEntry, removeTrip, TODO_TEMPLATE, tripAssist, tripInspiration, updateEntry, updateTrip,
  addVariant, removeVariant, chooseVariant, locateAll, locateTrip} from '../lib/trips';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import GroupedChecklist from '../components/GroupedChecklist';
import PlanChat from '../components/PlanChat';
import MapView from '../components/MapView';
import { DateRangeField, rangeText } from '../components/DateRange';
import { Back, Chevron, Field, Icon, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const COLOR = '#2FA36B';
const INSPO_KEY = 'life-app-tripinspo';
const INSPO_CHIPS = ['Langes Wochenende', 'Strand & Sonne', 'Berge & Wandern', 'Städtetrip', 'Mit dem Bus erreichbar', 'Günstig', 'Überrasch mich'];
const fmtMoney = (n, c) => `${Math.round(n).toLocaleString('de-DE')} ${c}`;
const tint = { background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR };
const loadInspo = () => {
  try {
    return JSON.parse(localStorage.getItem(INSPO_KEY) || 'null');
  } catch {
    return null;
  }
};

// ---------- Übersicht: geplante Reisen, Ideen, „Wohin könnte ich?“ ----------
function Inspiration({ s }) {
  const [wish, setWish] = useState('');
  const [res, setRes] = useState(loadInspo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const ask = async (q) => {
    setBusy(true);
    setErr(null);
    try {
      const ziele = await tripInspiration(s, q);
      const v = { query: q, ziele };
      setRes(v);
      try {
        localStorage.setItem(INSPO_KEY, JSON.stringify(v));
      } catch {}
      setWish('');
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const keep = (z) => {
    addTrip({ name: z.ziel, dest: [z.ziel, z.land].filter(Boolean).join(', '), status: 'idee', idea: [z.warum, z.dauer && `Dauer: ${z.dauer}`, z.anreise && `Anreise: ${z.anreise}`, z.beste_zeit && `Beste Zeit: ${z.beste_zeit}`, z.budget && `Kosten: ${z.budget}`].filter(Boolean).join('\n') });
    const v = { ...res, ziele: res.ziele.filter((x) => x.id !== z.id) };
    setRes(v);
    try {
      localStorage.setItem(INSPO_KEY, JSON.stringify(v));
    } catch {}
    toast(`„${z.ziel}“ bei den Ideen gemerkt`);
  };
  return (
    <section className="card checkin" style={{ gap: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
        <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> Wohin könnte ich?
      </span>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); ask(wish.trim()); }}>
        <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="z.B. „5 Tage im Dezember, Natur, max. 300 USD“" aria-label="Reisewunsch" />
        <button type="submit" className="btn small" disabled={busy || !wish.trim() || !getAi().apiKey}>{busy ? '…' : 'Los'}</button>
      </form>
      {!busy && <div className="box-tabs">{INSPO_CHIPS.map((c) => <button key={c} type="button" className="chip soft" style={{ whiteSpace: 'nowrap' }} disabled={!getAi().apiKey} onClick={() => ask(c)}>{c}</button>)}</div>}
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich suche passende Ziele ab Buenos Aires … (ca. 30 Sek.)</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {!busy && res?.ziele?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="tiny">Vorschläge zu „{res.query}“</span>
          {res.ziele.map((z) => (
            <div key={z.id} className="option" style={{ flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                <Icon name="plane" size={16} color={COLOR} />
                <b style={{ flex: 1, fontSize: 16 }}>{z.ziel}{z.land ? `, ${z.land}` : ''}</b>
                {z.url && <a className="x-btn" href={z.url} target="_blank" rel="noreferrer" aria-label="Mehr lesen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              </span>
              <span className="sub" style={{ fontSize: 14 }}>{z.warum}</span>
              <span className="tiny">{[z.dauer, z.anreise, z.beste_zeit && `Beste Zeit: ${z.beste_zeit}`, z.budget].filter(Boolean).join(' · ')}</span>
              <button type="button" className="pill on" style={{ alignSelf: 'flex-start' }} onClick={() => keep(z)}>Als Idee merken</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TripList({ s }) {
  const t = today();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ dest: '', from: '', to: '', budget: '', status: 'geplant' });
  const trips = [...s.trips].sort((a, b) => (a.from || '9') < (b.from || '9') ? -1 : 1);
  const planned = trips.filter((x) => x.status !== 'idee' && (!x.to || x.to >= t));
  const ideas = trips.filter((x) => x.status === 'idee');
  const past = trips.filter((x) => x.status !== 'idee' && x.to && x.to < t);
  const save = () => {
    const id = addTrip({ name: f.dest, dest: f.dest, from: f.from, to: f.to, budget: f.budget, status: f.status });
    setOpen(false);
    setF({ dest: '', from: '', to: '', budget: '', status: 'geplant' });
    go(`/reisen/${id}`);
  };
  const Row = ({ tr }) => (
    <a href={`#/reisen/${tr.id}`} className="row" style={{ minHeight: 62 }}>
      <span className="block-icon" style={tint}><Icon name={tr.status === 'idee' ? 'bulb' : 'plane'} size={16} /></span>
      <span className="row-main">
        <span className="row-title strong">{tr.name}</span>
        <span className="row-meta">
          {tr.status === 'idee'
            ? [tr.stops.length && `${tr.stops.length} Stationen`, tr.places.length && `${tr.places.length} Orte`, (tr.idea || '').split('\n')[0]].filter(Boolean).join(' · ') || 'Noch nichts recherchiert'
            : [tr.from && rangeText(tr.from, tr.to), tr.from && tr.from > t && `in ${diffDays(t, tr.from)} Tagen`, `${tr.todo.filter((x) => !x.done).length} offen`].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Chevron />
    </a>
  );
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/freizeit" label="Freizeit und Erlebnisse" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Reisen</h1>
            <button type="button" className="btn small" onClick={() => setOpen(true)}>+ Reise</button>
          </div>
        </div>
        <section className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>Geplant</h2>
          <div className="list">
            {planned.length === 0 && <div className="empty">Noch keine Reise festgelegt. Jede Reise bekommt eine Vorlage: Stationen, Transport, Orte auf der Karte, Unterlagen, To-dos und Packliste.</div>}
            {planned.map((tr) => <Row key={tr.id} tr={tr} />)}
          </div>
        </section>
        <Inspiration s={s} />
        <section className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>Ideen – noch nicht festgelegt</h2>
          <div className="list">
            {ideas.length === 0 && <div className="empty">Hier landen mögliche Reisen. Darin kannst du mit der KI Route, Transport und Aktivitäten recherchieren – und sie dann festlegen.</div>}
            {ideas.map((tr) => <Row key={tr.id} tr={tr} />)}
          </div>
        </section>
        {past.length > 0 && (
          <section className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>Vergangene Reisen</h2>
            <div className="list">{[...past].reverse().map((tr) => <Row key={tr.id} tr={tr} />)}</div>
          </section>
        )}
      </main>
      <Sheet open={open} title="Neue Reise" onClose={() => setOpen(false)}>
        <Field label="Wohin?"><input className="input" value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })} placeholder="z.B. Florianópolis" /></Field>
        <div className="seg-mini">
          {[['geplant', 'Steht fest'], ['idee', 'Erst mal Idee']].map(([k, l]) => <button key={k} type="button" className={f.status === k ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, status: k })}>{l}</button>)}
        </div>
        <Field label="Zeitraum (optional)"><DateRangeField from={f.from} to={f.to} onChange={(v) => setF({ ...f, ...v })} /></Field>
        <Field label="Budget in USD (optional)"><input className="input" inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
        <button type="button" className="btn" onClick={save} disabled={!f.dest.trim()}>{f.status === 'idee' ? 'Als Idee anlegen' : 'Reise anlegen'}</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

// ---------- Route: Stationen + Transport ----------
function Route({ tr }) {
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState(null);
  const [tf, setTf] = useState({ from: '', to: '', mode: 'bus' });
  const addStop = () => {
    const id = addEntry(tr.id, 'stops', { name: name.trim(), from: '', to: '', note: '' });
    setName('');
    locateEntry(tr.id, 'stops', id);
  };
  const move = (i, d) => {
    const list = [...tr.stops];
    const [x] = list.splice(i, 1);
    list.splice(i + d, 0, x);
    updateTrip(tr.id, { stops: list });
  };
  return (
    <>
      <section className="group">
        <h2 className="label" style={{ padding: '0 4px' }}>Stationen</h2>
        <div className="list">
          {tr.stops.length === 0 && <div className="empty">Noch keine Route. Wähle unter „Routen“ eine Variante oder trag Stationen selbst ein.</div>}
          {tr.stops.map((st, i) => {
            const n = tr.places.filter((p) => p.stopId === st.id).length;
            const stay = tr.places.find((p) => p.stopId === st.id && p.kind === 'unterkunft' && p.status === 'fest');
            return (
              <div key={st.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <button type="button" className="row" style={{ minHeight: 58 }} onClick={() => setOpenId(openId === st.id ? null : st.id)}>
                  <span className="step-no">{i + 1}</span>
                  <span className="row-main">
                    <span className="row-title strong">{st.name}</span>
                    <span className="row-meta">{[st.from && rangeText(st.from, st.to), stay ? `🏠 ${stay.name}` : null, n && `${n} Orte`, st.note].filter(Boolean).join(' · ') || 'Antippen zum Bearbeiten'}</span>
                  </span>
                  <Chevron />
                </button>
                {openId === st.id && (
                  <div className="stop-edit">
                    <DateRangeField from={st.from} to={st.to} onChange={(v) => updateEntry(tr.id, 'stops', st.id, v)} placeholder="Wann bist du dort?" />
                    <input className="input" defaultValue={st.note} key={st.id + 'n'} placeholder="Notiz, z.B. „2 Nächte, Strandtag“" onBlur={(e) => e.target.value !== st.note && updateEntry(tr.id, 'stops', st.id, { note: e.target.value })} aria-label="Notiz" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="pill" disabled={i === 0} onClick={() => move(i, -1)}>↑ Früher</button>
                      <button type="button" className="pill" disabled={i === tr.stops.length - 1} onClick={() => move(i, 1)}>↓ Später</button>
                      <span style={{ flex: 1 }} />
                      <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`Station „${st.name}“ löschen?`) && removeEntry(tr.id, 'stops', st.id)}>Löschen</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addStop(); }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Station, z.B. Garopaba" aria-label="Neue Station" />
            <button type="submit" className="btn small" disabled={!name.trim()}>+</button>
          </form>
        </div>
      </section>
      <section className="group">
        <h2 className="label" style={{ padding: '0 4px' }}>Transport</h2>
        <div className="list">
          {tr.transport.length === 0 && <div className="empty">Wie kommst du hin und zwischen den Stationen weiter? Optionen sammeln, dann als „gebucht“ markieren.</div>}
          {tr.transport.map((x) => (
            <div key={x.id} className="row" style={{ minHeight: 58 }}>
              <span className="block-icon" style={tint}><Icon name={x.mode === 'flug' ? 'plane' : x.mode === 'auto' ? 'pin' : 'refresh'} size={15} /></span>
              <span className="row-main">
                <span className="row-title strong">{x.from} → {x.to}</span>
                <span className="row-meta">{[MODES[x.mode], x.date && fmtShort(x.date), x.note].filter(Boolean).join(' · ')}</span>
              </span>
              {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              <button type="button" className={x.status === 'gebucht' ? 'pill on' : 'pill'} onClick={() => updateEntry(tr.id, 'transport', x.id, { status: x.status === 'gebucht' ? 'option' : 'gebucht' })}>{x.status === 'gebucht' ? '✓ Gebucht' : 'Option'}</button>
              <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeEntry(tr.id, 'transport', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
            </div>
          ))}
          <form className="stop-edit" onSubmit={(e) => { e.preventDefault(); addEntry(tr.id, 'transport', { from: tf.from.trim(), to: tf.to.trim(), mode: tf.mode, date: '', time: '', note: '', url: '', status: 'option' }); setTf({ from: tf.to, to: '', mode: tf.mode }); }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={tf.from} onChange={(e) => setTf({ ...tf, from: e.target.value })} placeholder="Von" aria-label="Von" />
              <input className="input" value={tf.to} onChange={(e) => setTf({ ...tf, to: e.target.value })} placeholder="Nach" aria-label="Nach" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" value={tf.mode} onChange={(e) => setTf({ ...tf, mode: e.target.value })} aria-label="Verkehrsmittel">{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <button type="submit" className="btn small" disabled={!tf.from.trim() || !tf.to.trim()}>+ Strecke</button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

// ---------- Orte: Karte + Liste ----------
function Places({ tr }) {
  const [kind, setKind] = useState('alle');
  const [locating, setLocating] = useState(false);
  const missing = [...tr.stops, ...tr.places].filter((x) => x.lat == null).length;
  useEffect(() => { locateTrip(tr.id); }, [tr.id]);
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({ name: '', kind: 'restaurant', stopId: '', address: '', url: '' });
  const [adding, setAdding] = useState(false);
  const list = tr.places.filter((p) => kind === 'alle' || p.kind === kind);
  const mapPts = [
    ...tr.stops.filter((x) => x.lat != null).map((x) => ({ id: x.id, name: x.name, lat: x.lat, lon: x.lon, category: 'Station' })),
    ...list.filter((p) => p.lat != null).map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, category: PLACE_CAT[p.kind], status: p.status === 'fest' ? 'war' : 'will' })),
  ];
  const save = () => {
    const id = addEntry(tr.id, 'places', { name: f.name.trim(), kind: f.kind, stopId: f.stopId, address: f.address.trim(), url: /^https?:\/\//.test(f.url) ? f.url.trim() : '', note: '', status: 'fest' });
    locateEntry(tr.id, 'places', id);
    setF({ ...f, name: '', address: '', url: '' });
    setAdding(false);
  };
  const stopName = (id) => tr.stops.find((x) => x.id === id)?.name;
  const route = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat != null ? `${p.lat},${p.lon}` : [p.name, p.address, stopName(p.stopId) || tr.dest].filter(Boolean).join(', '))}`;
  return (
    <>
      <MapView places={mapPts} selectedId={sel} onSelect={setSel} height={280} center={tr.lat != null ? { lat: tr.lat, lon: tr.lon } : null} />
      {missing > 0 && (
        <button type="button" className="btn tint small" disabled={locating} onClick={async () => { setLocating(true); const left = await locateAll(tr.id); setLocating(false); toast(left ? `${left} ohne Position – Adresse ergänzen hilft` : 'Alle auf der Karte'); }}>
          {locating ? 'Suche Positionen …' : `📍 ${missing} ${missing === 1 ? 'Ort' : 'Orte'} auf der Karte suchen`}
        </button>
      )}
      <div className="box-tabs">
        {[['alle', 'Alle'], ...Object.entries(PLACE_KINDS)].map(([k, v]) => {
          const n = k === 'alle' ? tr.places.length : tr.places.filter((p) => p.kind === k).length;
          return (k === 'alle' || n > 0) && <button key={k} type="button" className={kind === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setKind(k)}>{v} {n}</button>;
        })}
      </div>
      <div className="list">
        {list.length === 0 && <div className="empty">Unterkunft, Restaurants, Sehenswürdigkeiten … selbst eintragen oder unten von der KI vorschlagen lassen. „Merken ✓“ = steht fest.</div>}
        {list.map((p) => (
          <div key={p.id} className="row" style={{ minHeight: 60, background: sel === p.id ? 'var(--accent-bg)' : undefined }}>
            <button type="button" className="row-main" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => setSel(p.id)}>
              <span className="row-title strong">{p.kind === 'unterkunft' ? '🏠 ' : ''}{p.name}</span>
              <span className="row-meta">{[PLACE_KINDS[p.kind], stopName(p.stopId), p.note, p.address].filter(Boolean).join(' · ')}</span>
            </button>
            {p.url && <a className="x-btn" href={p.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
            <a className="x-btn" href={route(p)} target="_blank" rel="noreferrer" aria-label="In Google Maps öffnen"><Icon name="pin" size={15} color="var(--accent)" /></a>
            <button type="button" className={p.status === 'fest' ? 'pill on' : 'pill'} onClick={() => updateEntry(tr.id, 'places', p.id, { status: p.status === 'fest' ? 'option' : 'fest' })}>{p.status === 'fest' ? '✓' : 'Merken'}</button>
            <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeEntry(tr.id, 'places', p.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
      </div>
      {!adding ? <button type="button" className="btn tint" onClick={() => setAdding(true)}>+ Ort selbst eintragen</button> : (
        <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, z.B. Pousada Mar Azul" aria-label="Name" autoFocus />
          <div className="box-tabs">{Object.entries(PLACE_KINDS).map(([k, v]) => <button key={k} type="button" className={f.kind === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setF({ ...f, kind: k })}>{v}</button>)}</div>
          {tr.stops.length > 0 && <select className="input" value={f.stopId} onChange={(e) => setF({ ...f, stopId: e.target.value })} aria-label="Station"><option value="">Keine Station</option>{tr.stops.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Adresse (für die Karte, optional)" aria-label="Adresse" />
          <input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Link (Booking, Google Maps, Website …)" aria-label="Link" inputMode="url" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn tint" style={{ flex: 1 }} onClick={() => setAdding(false)}>Abbrechen</button>
            <button type="submit" className="btn" style={{ flex: 2 }} disabled={!f.name.trim()}>Speichern</button>
          </div>
        </form>
      )}
    </>
  );
}

// ---------- Unterlagen: Tickets, Buchungen, Versicherung (als Link + Notiz) ----------
function Docs({ tr }) {
  const [f, setF] = useState({ title: '', url: '', note: '' });
  return (
    <>
      <div className="list">
        {tr.docs.length === 0 && <div className="empty">Buchungsbestätigungen, Tickets, Versicherung … mit Link (z.B. aus Google Drive oder der Mail) und Buchungsnummer.</div>}
        {tr.docs.map((d) => (
          <div key={d.id} className="row" style={{ minHeight: 56 }}>
            <span className="block-icon" style={tint}><Icon name="book" size={15} /></span>
            <span className="row-main">
              <span className="row-title strong">{d.title}</span>
              {d.note && <span className="row-meta" style={{ userSelect: 'text' }}>{d.note}</span>}
            </span>
            {d.url && <a className="x-btn" href={d.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
            <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeEntry(tr.id, 'docs', d.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
      </div>
      <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addEntry(tr.id, 'docs', { title: f.title.trim(), url: /^https?:\/\//.test(f.url) ? f.url.trim() : '', note: f.note.trim() }); setF({ title: '', url: '', note: '' }); }}>
        <span className="label" style={{ padding: 0 }}>Unterlage hinzufügen</span>
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z.B. Flug Hinreise" aria-label="Titel" />
        <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Buchungsnummer, Uhrzeit, Sitzplatz …" aria-label="Notiz" />
        <input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Link (optional)" aria-label="Link" inputMode="url" />
        <button type="submit" className="btn small" disabled={!f.title.trim()}>Hinzufügen</button>
      </form>
    </>
  );
}

function Budget({ tr }) {
  const spent = tr.expenses.reduce((n, x) => n + x.amount, 0);
  return (
    <>
      <section className="card" style={{ gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700 }}>{fmtMoney(spent, tr.currency)}</span>
        <span className="sub">{tr.budget ? `von ${fmtMoney(tr.budget, tr.currency)} · ${spent > tr.budget ? `${fmtMoney(spent - tr.budget, tr.currency)} drüber` : `${fmtMoney(tr.budget - spent, tr.currency)} übrig`}` : 'Kein Budget festgelegt'}</span>
        {tr.budget > 0 && <div className="progress"><div style={{ width: `${Math.min(100, (spent / tr.budget) * 100)}%`, background: spent > tr.budget ? 'var(--danger)' : COLOR }} /></div>}
        <label className="field" style={{ margin: 0 }}><span>Budget ({tr.currency})</span><input className="input" inputMode="numeric" defaultValue={tr.budget || ''} key={tr.id + 'b'} onBlur={(e) => updateTrip(tr.id, { budget: Number(e.target.value) || 0 })} /></label>
      </section>
      <SimpleList
        items={tr.expenses.map((x) => ({ ...x, done: false }))}
        onAdd={(text, amount) => addExpense(tr.id, { text, amount: String(amount).replace(',', '.') })}
        onToggle={() => {}}
        onRemove={(id) => removeEntry(tr.id, 'expenses', id)}
        meta={(x) => `${fmtMoney(x.amount, tr.currency)} · ${fmtShort(x.date)}`}
        placeholder="Wofür? z.B. Flug"
        extraInput="Betrag"
      />
    </>
  );
}

// ---------- Routen-Varianten: Skizzen vergleichen, eine wählen ----------
function Variants({ tr, onChosen }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const vs = tr.variants || [];
  return (
    <>
      <div className="list">
        {vs.length === 0 && <div className="empty">Noch keine Varianten. Lass dir unten von der KI zwei Routen skizzieren (z.B. „entspannt“ und „viel sehen“) oder trag selbst eine ein.</div>}
        {vs.map((v) => {
          const nights = v.stops.reduce((n, x) => n + (x.nights || 0), 0);
          return (
            <div key={v.id} className="variant">
              <div className="sec-h" style={{ padding: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{v.chosen ? '✓ ' : ''}{v.name}</span>
                <span className="tiny">{v.stops.length} Abschnitte{nights ? ` · ${nights} Nächte` : ''}</span>
              </div>
              {v.summary && <span className="tiny">{v.summary}</span>}
              <div className="variant-steps">
                {v.stops.map((x, i) => (
                  <span key={i} className="variant-step">
                    <span className="step-no" style={{ width: 20, height: 20, fontSize: 11 }}>{i + 1}</span>
                    <span><b>{x.name}</b>{x.nights ? ` · ${x.nights} N.` : ''}{x.note ? <span className="tiny"> · {x.note}</span> : null}</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={v.chosen ? 'pill on' : 'pill'} onClick={() => { chooseVariant(tr.id, v.id); toast(`„${v.name}“ ist jetzt deine Route`); onChosen?.(); }}>{v.chosen ? 'Gewählt' : 'Diese Route wählen'}</button>
                <span style={{ flex: 1 }} />
                <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`Variante „${v.name}“ löschen?`) && removeVariant(tr.id, v.id)}>Löschen</button>
              </div>
            </div>
          );
        })}
      </div>
      <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addVariant(tr.id, { name: name.trim(), stops: text.split(/→|->|,|\n/).map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(.*?)\s*\(?(\d+)\s*(n|nächte|nights)?\)?$/i); return m && m[2] ? { name: m[1], nights: Number(m[2]) } : { name: x }; }) }); setText(''); setName(''); }}>
        <span className="label" style={{ padding: 0 }}>Eigene Variante</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, z.B. Küste entspannt" aria-label="Name der Variante" />
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Orte mit Komma, z.B. Floripa 3, Garopaba 2, Imbituba 2" aria-label="Abschnitte" />
        <button type="submit" className="btn small" disabled={!text.trim()}>Variante speichern</button>
      </form>
    </>
  );
}

const PLAN_GROUPS = [
  { key: 'varianten', label: 'Als Routen-Variante speichern', title: (x) => x.name, meta: (x) => [(x.abschnitte || []).map((a) => `${a.ort}${a.naechte ? ` (${a.naechte} N.)` : ''}`).join(' → '), x.kurz].filter(Boolean).join(' · ') },
  { key: 'stationen', label: 'Stationen', title: (x) => x.name, meta: (x) => [x.von && x.bis ? `${fmtShort(x.von)} – ${fmtShort(x.bis)}` : '', x.notiz].filter(Boolean).join(' · ') },
  { key: 'transport', label: 'Transport', title: (x) => `${x.von} → ${x.nach}`, meta: (x) => [MODES[x.art], x.dauer, x.preis, x.notiz].filter(Boolean).join(' · ') },
  { key: 'orte', label: 'Orte', title: (x) => x.name, meta: (x) => [PLACE_KINDS[x.art], x.station, x.notiz].filter(Boolean).join(' · ') },
  { key: 'todo', label: 'To-dos', title: (x) => x.text, meta: (x) => x.kategorie },
  { key: 'packen', label: 'Packliste ergänzen', title: (x) => x.text, meta: (x) => x.kategorie },
  { key: 'entfernen', label: 'Von den Listen streichen', title: (x) => x },
];

function TripDetail({ s, tr }) {
  const t = today();
  const isIdea = tr.status === 'idee';
  const tabs = isIdea
    ? [['orte', 'Orte'], ['varianten', 'Routen'], ['route', 'Gewählte Route'], ['notizen', 'Notizen']]
    : [['route', 'Route'], ['orte', 'Orte'], ['todo', 'To-dos'], ['packen', 'Packen'], ['docs', 'Unterlagen'], ['budget', 'Budget'], ['notizen', 'Notizen'], ...((tr.variants || []).length ? [['varianten', 'Varianten']] : [])];
  const [tab, setTab] = useState(isIdea ? 'orte' : 'route');
  const [commit, setCommit] = useState(false);
  const [range, setRange] = useState({ from: tr.from, to: tr.to });
  const cur = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  const days = tr.from ? diffDays(t, tr.from) : null;
  const spent = tr.expenses.reduce((n, x) => n + x.amount, 0);
  const count = { varianten: (tr.variants || []).length, todo: tr.todo.filter((x) => !x.done).length, packen: tr.packen.filter((x) => !x.done).length, orte: tr.places.length, route: tr.stops.length, docs: tr.docs.length };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/reisen" label="Reisen" />
          <input className="input title-input" defaultValue={tr.name} key={tr.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== tr.name && updateTrip(tr.id, { name: e.target.value.trim() })} aria-label="Name" />
          <span className="tiny">{isIdea ? '💡 Idee – noch nicht festgelegt' : '✈️ Festgelegt'}{tr.dest && tr.dest !== tr.name ? ` · ${tr.dest}` : ''}</span>
        </div>

        {isIdea ? (
          <section className="card" style={{ gap: 10 }}>
            {tr.idea && <span className="sub" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{tr.idea}</span>}
            <span className="tiny">So geht's: 1. Orte sammeln (was willst du sehen?) · 2. Routen-Varianten skizzieren und vergleichen · 3. eine Route wählen · 4. festlegen – dann kommen To-dos, Packliste und Unterlagen dazu. Die KI unten hilft bei jedem Schritt.</span>
            <button type="button" className="btn" onClick={() => setCommit(true)}>Reise festlegen</button>
          </section>
        ) : (
          <section className="card countdown" style={{ gap: 10 }}>
            <div className="stat-row">
              <div><span className="tiny">{days !== null && days > 0 ? 'Noch' : 'Start'}</span><b>{days !== null && days > 0 ? `${days} Tage` : tr.from ? fmtShort(tr.from) : '–'}</b></div>
              <div><span className="tiny">Offen</span><b>{count.todo} To-dos</b></div>
              <div><span className="tiny">Budget</span><b style={{ color: tr.budget && spent > tr.budget ? 'var(--danger)' : undefined }}>{tr.budget ? `${Math.round((spent / tr.budget) * 100)} %` : '–'}</b></div>
            </div>
            <DateRangeField from={tr.from} to={tr.to} onChange={(v) => updateTrip(tr.id, v)} title="Reisezeitraum" />
          </section>
        )}


        <div className="box-tabs main-tabs">
          {tabs.map(([k, l]) => <button key={k} type="button" className={cur === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(k)}>{l}{count[k] ? ` ${count[k]}` : ''}</button>)}
        </div>
        {cur === 'varianten' && <Variants tr={tr} onChosen={() => setTab('route')} />}
        {cur === 'route' && <Route tr={tr} />}
        {cur === 'orte' && <Places tr={tr} />}
        {cur === 'todo' && <GroupedChecklist items={tr.todo} cats={Object.keys(TODO_TEMPLATE)} onAdd={(text, cat) => addCheck(tr.id, 'todo', text, cat)} onToggle={(id) => updateEntry(tr.id, 'todo', id, { done: !tr.todo.find((x) => x.id === id).done })} onRemove={(id) => removeEntry(tr.id, 'todo', id)} onTemplate={() => commitTrip(tr.id)} placeholder="Neues To-do" />}
        {cur === 'packen' && <GroupedChecklist items={tr.packen} cats={Object.keys(PACK_TEMPLATE)} onAdd={(text, cat) => addCheck(tr.id, 'packen', text, cat)} onToggle={(id) => updateEntry(tr.id, 'packen', id, { done: !tr.packen.find((x) => x.id === id).done })} onRemove={(id) => removeEntry(tr.id, 'packen', id)} onTemplate={() => commitTrip(tr.id)} placeholder="Einpacken" />}
        {cur === 'docs' && <Docs tr={tr} />}
        {cur === 'budget' && <Budget tr={tr} />}
        {cur === 'notizen' && (
          <section className="card" style={{ gap: 6 }}>
            <textarea className="input" style={{ minHeight: 140 }} defaultValue={tr.notes} key={tr.id + 'notes'} placeholder="Alles Weitere: Kontakte, Ideen, Gedanken …" onBlur={(e) => e.target.value !== tr.notes && updateTrip(tr.id, { notes: e.target.value })} />
          </section>
        )}
        <PlanChat
          title={isIdea ? 'Mit KI recherchieren' : 'Mit KI planen'}
          intro={isIdea ? 'Erzähl, was dich reizt (Strände, Städte, Natur …) und wie lange du Zeit hast. Ich frage kurz nach, schlage erst Orte vor und dann Routen-Varianten zum Vergleichen.' : 'Sag z.B.: „Ich mache viel Sport dort, es wird kalt“ – ich passe Packliste und To-dos an. Oder: „Such mir eine Unterkunft in der Nähe vom Strand“.'}
          history={tr.chat}
          prefKey="reise"
          onSave={(chat) => updateTrip(tr.id, { chat })}
          onAsk={(hist, o) => tripAssist(s, tr, hist, o)}
          webChips={['Wie komme ich hin?', 'Beste Reisezeit und Kosten?', 'Unterkunft finden', 'Restaurant-Tipps', 'Transport zwischen den Stationen']}
          groups={PLAN_GROUPS}
          onApply={(sel) => applyTripProposal(tr.id, sel)}
          chips={isIdea ? ['Was gibt es dort zu sehen?', 'Schlag mir 2 Routen vor', 'Vergleich meine Routen', 'Wie komme ich hin?'] : ['Packliste anpassen', 'Unterkunft finden', 'Restaurant-Tipps', 'Sehenswürdigkeiten', 'Transport zwischen den Stationen', 'Was fehlt noch?']}
        />
        <button type="button" className="btn danger" onClick={() => { if (confirm(`Reise „${tr.name}“ löschen?`)) { removeTrip(tr.id); go('/reisen'); } }}>{isIdea ? 'Idee löschen' : 'Reise löschen'}</button>
      </main>
      <Sheet open={commit} title="Reise festlegen" onClose={() => setCommit(false)}>
        <span className="sub">Wann reist du? Danach bekommst du To-dos und eine Packliste nach Kategorien – die KI kann sie anpassen.</span>
        <DateRangeField from={range.from} to={range.to} onChange={setRange} />
        <button type="button" className="btn" onClick={() => { commitTrip(tr.id, range); setCommit(false); setTab('todo'); toast('Reise festgelegt – Vorlage ist da'); }}>Festlegen</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Reisen({ id }) {
  const s = useStore();
  if (!id) return <TripList s={s} />;
  const tr = s.trips.find((x) => x.id === id);
  return tr ? <TripDetail s={s} tr={tr} /> : <Missing />;
}
