import { useEffect, useState } from 'react';
import { store, useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addCheck, addEntry, addExpense, addTrip, applyTripProposal, commitTrip, locateEntry, MODES, PACK_TEMPLATE, PLACE_CAT, PLACE_KINDS,
  removeEntry, removeTrip, TODO_TEMPLATE, tripAssist, tripGuide, applyGuide, updateEntry, updateTrip, airportsOf, comparePrices,
  addVariant, removeVariant, chooseVariant, locateAll, locateTrip} from '../lib/trips';
import { getAi } from '../lib/ai';
import { groupIdeas, groupsOf, renameGroup, ungroup } from '../lib/trips';
import { chatOf, saveChatOf } from '../lib/chats';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import GroupedChecklist from '../components/GroupedChecklist';
import PlanChat from '../components/PlanChat';
import MapView from '../components/MapView';
import { DateRangeField, rangeText } from '../components/DateRange';
import { Back, Chevron, Field, Icon, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const COLOR = '#2FA36B';
// Bei diesen Wörtern sucht der Reise-Chat automatisch im Internet (aktuelle Preise, Verbindungen, Unterkünfte)
const TRAVEL_WEB = /fl(u|ü)g|fliegen|unterkunft|unterkünfte|hotel|hostel|airbnb|booking|posada|preis|kostet|ticket|buchen|\bbus|fähre|zug\b|verbindung/i;
const INSPO_CHIPS = ['Langes Wochenende', 'Strand & Sonne', 'Berge & Wandern', 'Städtetrip', 'Mit dem Bus erreichbar', 'Günstig', 'Überrasch mich'];
const fmtMoney = (n, c) => `${Math.round(n).toLocaleString('de-DE')} ${c}`;
const tint = { background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR };

// ---------- Übersicht: geplante Reisen, Ideen, „Wohin könnte ich?“ ----------
// v0.40 (Mateo): Reiseführer im Gespräch, kurze Vorschläge; mehrere ankreuzen → jede wird eine eigene Idee mit ausführlichem Text
const VERGLEICH_GROUP = {
  key: 'vergleich', label: 'Preisvergleich – Preise bei den Ideen speichern', title: (x) => `${x.ziel}${x.land ? `, ${x.land}` : ''}`,
  meta: (x) => [x.flug && `✈️ ${x.flug}`, x.unterkunft && `🏠 ${x.unterkunft}`, x.gesamt && `Σ ${x.gesamt}`].filter(Boolean).join(' · '),
  links: (x) => [x.url_flug && { label: '✈️ Flüge', url: x.url_flug }, x.url_unterkunft && { label: '🏠 Unterkunft', url: x.url_unterkunft }].filter(Boolean),
};
const GUIDE_GROUPS = [
  { key: 'ziele', label: 'Als Idee speichern', title: (x) => `${x.ziel}${x.land ? `, ${x.land}` : ''}`, meta: (x) => [x.kurz, x.dauer].filter(Boolean).join(' · ') },
];
// Abflughafen für Preisvergleiche (gemerkt im Profil)
// mit tr: Abflughafen nur für diese Reise (leer = Standard)
function Airport({ s, tr }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(tr ? tr.airport || '' : airportsOf(s));
  const save = () => {
    if (tr) updateTrip(tr.id, { airport: v.trim() });
    else store.update((d) => { d.profile = { ...d.profile, airports: v.trim() || 'Buenos Aires (EZE oder AEP)' }; });
    setEdit(false);
  };
  return edit ? (
    <form className="block-add" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <input className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder={tr ? `Leer = Standard (${airportsOf(s)})` : 'z.B. Buenos Aires (EZE) oder Montevideo'} aria-label="Abflughafen" />
      <button type="submit" className="btn small">OK</button>
    </form>
  ) : <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => { setV(tr ? tr.airport || '' : airportsOf(s)); setEdit(true); }}>✈️ Abflug ab: {airportsOf(s, tr)}{tr && !tr.airport ? ' (Standard)' : ''} ✎</button>;
}
// Wohin mit den gewählten Zielen? Jedes wird eine eigene Idee – optional zusammen in einer Gruppe (z.B. „Strandurlaub Januar“)
function TargetSheet({ s, sel, onClose }) {
  const groups = groupsOf(s);
  const [name, setName] = useState('');
  const done = (group) => { const n = applyGuide(sel, { group }); onClose(); toast(n ? `${n} ${n === 1 ? 'Idee' : 'Ideen'} gespeichert${group ? ` in „${group}“` : ''}` : 'Bei den Ideen aktualisiert'); };
  return (
    <Sheet open={!!sel} title="Als Ideen speichern" onClose={onClose}>
      <span className="sub">Jedes Ziel wird eine eigene Idee, in der du Orte und Routen planen kannst. Gehören sie zur selben Reise, pack sie in eine Gruppe – dann stehen sie unten zusammen.</span>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); done(name.trim()); }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Gruppe, z.B. Strandurlaub Januar" aria-label="Name der Gruppe" />
        <button type="submit" className="btn small" disabled={!name.trim()}>Speichern</button>
      </form>
      {groups.length > 0 && (
        <>
          <span className="label" style={{ padding: 0 }}>Oder in eine vorhandene Gruppe</span>
          <div className="list">
            {groups.map((g) => (
              <button key={g} type="button" className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => done(g)}>
                <span className="row-main"><span className="row-title strong">📁 {g}</span><span className="row-meta">{s.trips.filter((x) => x.group === g).length} Ideen</span></span>
                <Chevron />
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className="btn sec" style={{ background: 'var(--card-2)' }} onClick={() => done('')}>Ohne Gruppe speichern</button>
    </Sheet>
  );
}
// ✈️🏠 Preise nachsehen für eine Gruppe oder eine einzelne Idee (Websuche, ca. 3–5 Cent)
function PriceSheet({ s, trips, title, onClose }) {
  const first = trips?.[0];
  const [f, setF] = useState({ from: '', to: '', airport: '', people: '1' });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [key, setKey] = useState(null);
  const k = trips ? trips.map((x) => x.id).join() : null;
  if (k !== key) { setKey(k); setRes(null); setErr(null); if (first) setF({ from: first.from || '', to: first.to || '', airport: first.airport || '', people: '1' }); }
  const run = async () => {
    setBusy(true); setErr(null);
    try { setRes(await comparePrices(s, trips, { ...f, people: Number(f.people) || 1 })); } catch (e) { setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!trips} title={title || 'Preise nachsehen'} onClose={onClose}>
      <span className="sub">{trips?.length > 1 ? `Flug hin & zurück und Unterkunft für ${trips.map((x) => x.name).join(', ')} – nebeneinander.` : 'Flug hin & zurück und Unterkunft pro Nacht.'} Die KI sucht im Internet (ca. 3–5 Cent).</span>
      <Field label="Zeitraum (optional)"><DateRangeField from={f.from} to={f.to} onChange={(v) => setF({ ...f, ...v })} title="Reisezeitraum" /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Abflug ab"><input className="input" value={f.airport} onChange={(e) => setF({ ...f, airport: e.target.value })} placeholder={airportsOf(s, first)} /></Field>
        <Field label="Personen"><input className="input" inputMode="numeric" style={{ width: 70 }} value={f.people} onChange={(e) => setF({ ...f, people: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      <button type="button" className="btn" onClick={run} disabled={busy || !getAi().apiKey}>{busy ? 'Ich suche Preise … (ca. 30 Sek.)' : '🔍 Preise suchen'}</button>
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {res && (
        <>
          {res.hinweis && <span className="sub">{res.hinweis}</span>}
          <PriceTable rows={res.rows.map((v) => ({ id: v.ziel, name: v.ziel, prices: { flug: v.flug, unterkunft: v.unterkunft, gesamt: v.gesamt, urlFlug: v.url_flug, urlStay: v.url_unterkunft } }))} />
          <span className="tiny">Gespeichert – die Preise stehen jetzt bei den Ideen.</span>
        </>
      )}
    </Sheet>
  );
}
function PriceTable({ rows }) {
  const list = rows.filter((x) => x.prices && (x.prices.flug || x.prices.unterkunft));
  if (!list.length) return null;
  return (
    <div className="price-table">
      {list.map((x) => (
        <div key={x.id} className="price-row">
          <b>{x.name}</b>
          {x.prices.flug && <span>✈️ {x.prices.flug}{x.prices.urlFlug && <> · <a href={x.prices.urlFlug} target="_blank" rel="noreferrer">Flüge</a></>}</span>}
          {x.prices.unterkunft && <span>🏠 {x.prices.unterkunft}{x.prices.urlStay && <> · <a href={x.prices.urlStay} target="_blank" rel="noreferrer">Unterkünfte</a></>}</span>}
          {x.prices.gesamt && <span>Σ {x.prices.gesamt}</span>}
        </div>
      ))}
    </div>
  );
}
function Inspiration({ s }) {
  const [pending, setPending] = useState(null);
  return (
    <>
      <PlanChat
        title="Wohin könnte ich?"
        intro="Ich bin dein Reiseführer: Sag, worauf du Lust hast – oder tipp unten einen Vorschlag an. Kreuz danach die Ziele an, die dich reizen – jedes wird eine eigene Idee, auf Wunsch zusammen in einer Gruppe. Preise prüfst du danach mit „✈️🏠 Preise“ bei der Gruppe oder Idee."
        history={chatOf(s, 'reiseziele')}
        prefKey="reiseziele"
        onSave={(h) => saveChatOf('reiseziele', h)}
        onAsk={(hist, o) => tripGuide(s, hist, o)}
        groups={GUIDE_GROUPS}
        onApply={(sel) => setPending(sel)}
        chips={INSPO_CHIPS}
        placeholder="z.B. 5 Tage im Dezember, Natur, max. 300 USD"
      />
      <TargetSheet s={s} sel={pending} onClose={() => setPending(null)} />
    </>
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
  const [grouping, setGrouping] = useState(false);
  const [picked, setPicked] = useState([]);
  const [gname, setGname] = useState('');
  const doGroup = () => {
    groupIdeas(picked, gname);
    setGrouping(false); setPicked([]); setGname('');
    toast(`In Gruppe „${gname.trim()}“ – jede Idee bleibt, wie sie ist`);
  };
  const [closed, setClosed] = useState({});
  const [priceFor, setPriceFor] = useState(null);
  const groups = groupsOf(s);
  const loose = ideas.filter((x) => !x.group);
  const Row = ({ tr, idea }) => grouping && idea ? (
    <label className="row" style={{ minHeight: 62 }}>
      <input type="checkbox" style={{ width: 22, height: 22, accentColor: COLOR }} checked={picked.includes(tr.id)} onChange={() => setPicked(picked.includes(tr.id) ? picked.filter((x) => x !== tr.id) : [...picked, tr.id])} />
      <span className="row-main"><span className="row-title strong">{tr.name}</span><span className="row-meta">{tr.group ? `📁 ${tr.group}` : tr.dest || ''}</span></span>
    </label>
  ) : (
    <div className="row" style={{ minHeight: 62, gap: 0 }}>
    <a href={`#/reisen/${tr.id}`} className="row" style={{ minHeight: 62, flex: 1, padding: 0, border: 0 }}>
      <span className="block-icon" style={tint}><Icon name={tr.status === 'idee' ? 'bulb' : 'plane'} size={16} /></span>
      <span className="row-main">
        <span className="row-title strong">{tr.name}</span>
        <span className="row-meta">
          {tr.status === 'idee'
            ? [tr.prices?.flug && `✈️ ${tr.prices.flug}`, tr.prices?.unterkunft && `🏠 ${tr.prices.unterkunft}`, tr.stops.length && `${tr.stops.length} Stationen`, tr.places.length && `${tr.places.length} Orte`, (tr.idea || '').split('\n')[0]].filter(Boolean).join(' · ') || 'Noch nichts recherchiert'
            : [tr.from && rangeText(tr.from, tr.to), tr.from && tr.from > t && `in ${diffDays(t, tr.from)} Tagen`, `${tr.todo.filter((x) => !x.done).length} offen`].filter(Boolean).join(' · ')}
        </span>
      </span>
      {!idea && <Chevron />}
    </a>
    {idea && <button type="button" className="x-btn" aria-label={`${tr.name} entfernen`} onClick={() => confirm(`Idee „${tr.name}“ entfernen?`) && removeTrip(tr.id)}><Icon name="x" size={13} color="var(--chev)" /></button>}
    </div>
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
          <div className="sec-h" style={{ padding: '0 4px' }}>
            <h2 className="label" style={{ padding: 0 }}>Ideen – noch nicht festgelegt</h2>
            {ideas.length > 0 && <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => { setGrouping(!grouping); setPicked([]); }}>{grouping ? 'Abbrechen' : 'Gruppieren'}</button>}
          </div>
          {grouping && <span className="tiny" style={{ padding: '0 4px' }}>Wähle Ideen für dieselbe Reise und gib der Gruppe einen Namen (oder den einer vorhandenen Gruppe). Jede Idee bleibt mit Orten und Routen erhalten.</span>}
          {ideas.length === 0 && <div className="list"><div className="empty">Hier landen mögliche Reisen. Darin kannst du mit der KI Route, Transport und Aktivitäten recherchieren – und sie dann festlegen.</div></div>}
          {groups.map((g) => {
            const items = ideas.filter((x) => x.group === g);
            const isClosed = closed[g] && !grouping;
            return (
              <div key={g} className="list">
                <div className="row group-head">
                  <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => setClosed({ ...closed, [g]: !closed[g] })}>
                    <span className="row-title strong">📁 {g} {isClosed ? '▸' : '▾'}</span>
                    <span className="row-meta">{items.length} {items.length === 1 ? 'Idee' : 'Ideen'}: {items.map((x) => x.name).join(', ')}</span>
                  </button>
                  <button type="button" className="pill" style={{ fontSize: 12.5, padding: '4px 9px', whiteSpace: 'nowrap' }} onClick={() => setPriceFor({ trips: items, title: `Preise: ${g}` })}>✈️🏠 Preise</button>
                  <button type="button" className="x-btn" aria-label={`Gruppe ${g} umbenennen`} onClick={() => { const n = prompt('Neuer Name der Gruppe', g); if (n && n.trim()) renameGroup(g, n); }}><Icon name="edit" size={13} color="var(--muted)" /></button>
                  <button type="button" className="x-btn" aria-label={`Gruppe ${g} auflösen`} onClick={() => confirm(`Gruppe „${g}“ auflösen? Die Ideen bleiben erhalten.`) && ungroup(g)}><Icon name="x" size={13} color="var(--chev)" /></button>
                </div>
                {!isClosed && items.some((x) => x.prices && (x.prices.flug || x.prices.unterkunft)) && <div style={{ padding: '4px 12px 8px' }}><PriceTable rows={items} /></div>}
                {!isClosed && items.map((tr) => <div key={tr.id} style={{ paddingLeft: 14 }}><Row tr={tr} idea /></div>)}
              </div>
            );
          })}
          {loose.length > 0 && <div className="list">{loose.map((tr) => <Row key={tr.id} tr={tr} idea />)}</div>}
          {grouping && groups.length > 0 && <div className="chips">{groups.map((g) => <button key={g} type="button" className={gname === g ? 'chip on' : 'chip soft'} onClick={() => setGname(g)}>📁 {g}</button>)}</div>}
          {grouping && (
            <form className="block-add" onSubmit={(e) => { e.preventDefault(); doGroup(); }}>
              <input className="input" value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Name, z.B. Strandurlaub Januar" aria-label="Name der gruppierten Idee" />
              <button type="submit" className="btn small" disabled={!picked.length || !gname.trim()}>Gruppieren ({picked.length})</button>
            </form>
          )}
        </section>
        {past.length > 0 && (
          <section className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>Vergangene Reisen</h2>
            <div className="list">{[...past].reverse().map((tr) => <Row key={tr.id} tr={tr} />)}</div>
          </section>
        )}
      </main>
      <PriceSheet s={s} trips={priceFor?.trips ? priceFor.trips.map((x) => s.trips.find((y) => y.id === x.id) || x) : null} title={priceFor?.title} onClose={() => setPriceFor(null)} />
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
function Variants({ tr, onChosen, onCommit }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const vs = tr.variants || [];
  return (
    <>
      <div className="list">
        {vs.length === 0 && <div className="empty">Noch keine Varianten. Lass dir unten von der KI zwei Routen skizzieren (z.B. „entspannt“ und „viel sehen“) oder trag selbst eine ein.</div>}
        {vs.length > 1 && <span className="tiny" style={{ padding: '0 4px' }}>Vergleiche die Varianten, entwickle sie unten mit der KI weiter („Variante 2 mit einem Tag mehr in …“) und wähle am Ende eine.</span>}
        {vs.map((v, vi) => {
          const nights = v.stops.reduce((n, x) => n + (x.nights || 0), 0);
          return (
            <div key={v.id} className="variant">
              <span className="eyebrow" style={{ fontSize: 11 }}>Variante {vi + 1}</span>
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
                {onCommit && <button type="button" className="pill on" onClick={() => { chooseVariant(tr.id, v.id); onCommit(); }}>Zur Reise machen</button>}
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
    ? [['varianten', 'Varianten'], ['route', 'Route'], ['orte', 'Orte'], ...(tr.notes ? [['notizen', 'Notizen']] : [])]
    : [['route', 'Route'], ['varianten', 'Varianten'], ['orte', 'Orte'], ['todo', 'To-dos'], ['packen', 'Packen'], ['docs', 'Unterlagen'], ['budget', 'Budget'], ['notizen', 'Notizen']];
  const [tab, setTab] = useState(isIdea ? 'varianten' : 'route');
  const [commit, setCommit] = useState(false);
  const [priceFor, setPriceFor] = useState(null);
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
          <span className="tiny">{isIdea ? '💡 Idee' : '✈️ Festgelegt'}{tr.dest && tr.dest !== tr.name ? ` · ${tr.dest}` : ''}{tr.group ? ` · 📁 ${tr.group}` : ''}</span>
          <Airport s={s} tr={tr} key={tr.id + 'ap'} />
        </div>

        {isIdea ? (
          <section className="card" style={{ gap: 8 }}>
            <span className="label" style={{ padding: 0 }}>Infos</span>
            <textarea className="input" style={{ minHeight: 90, fontSize: 15 }} defaultValue={tr.idea} key={tr.id + 'idea' + (tr.idea || '').length} placeholder="Alles sammeln: was es dort gibt, Kosten, Anreise, beste Zeit …" onBlur={(e) => e.target.value !== tr.idea && updateTrip(tr.id, { idea: e.target.value })} aria-label="Infos zur Idee" />
            <PriceTable rows={tr.group ? s.trips.filter((x) => x.group === tr.group) : [tr]} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn small" onClick={() => setCommit(true)}>Reise festlegen</button>
              <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => setPriceFor(tr.group ? s.trips.filter((x) => x.group === tr.group) : [tr])}>✈️🏠 Preise{tr.group ? ' der Gruppe' : ''}</button>
            </div>
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
        {cur === 'varianten' && <Variants tr={tr} onChosen={() => setTab('route')} onCommit={isIdea ? () => setCommit(true) : null} />}
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
          webChips={isIdea ? [] : ['Flüge suchen', 'Unterkunft suchen', 'Bus & Fähren zwischen den Stationen']}
          autoWeb={TRAVEL_WEB}
          groups={PLAN_GROUPS}
          onApply={(sel) => applyTripProposal(tr.id, sel)}
          chips={isIdea ? ['Was gibt es dort zu sehen?', 'Schlag mir 2 Routen vor', 'Vergleich meine Routen'] : ['Alternative Route als Variante', 'Sehenswürdigkeiten', 'Restaurant-Tipps', 'Packliste anpassen', 'Was fehlt noch?']}
        />
        <button type="button" className="btn danger" onClick={() => { if (confirm(`Reise „${tr.name}“ löschen?`)) { removeTrip(tr.id); go('/reisen'); } }}>{isIdea ? 'Idee löschen' : 'Reise löschen'}</button>
      </main>
      <PriceSheet s={s} trips={priceFor} title={tr.group ? `Preise: ${tr.group}` : `Preise: ${tr.name}`} onClose={() => setPriceFor(null)} />
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
