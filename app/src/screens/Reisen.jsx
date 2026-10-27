import { Fragment, useEffect, useState } from 'react';
import { store, useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addCheck, addEntry, addExpense, addTrip, applyTripProposal, commitTrip, locateEntry, MODES, PACK_TEMPLATE, PLACE_CAT, PLACE_KINDS,
  removeEntry, removeTrip, TODO_TEMPLATE, tripAssist, tripGuide, applyGuide, updateEntry, updateTrip, airportsOf, comparePrices, defaultSetup, fixSetup, directLinks, nightsOf, setGroupTime, ensureIata, setupOf, TRIP_CURRENCIES, tripCur, TRAVEL_MODES, LEVELS, STAY_TYPES,
  addVariant, removeVariant, chooseVariant, locateAll, locateTrip, tripKind, FOCI, addSpotTo, removeSpotFrom, chooseSpot, suggestSpots, buildVariants, variantTransport, appendFromVariant, rome2rio, updateVariant, addVariantStop, removeVariantStop, moveVariantStop, updateVariantStop, legOf, setVariantLeg, addVariantItem, removeVariantItem, addEmptyVariant, insertStop, editVariant } from '../lib/trips';
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
  ) : <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14, textAlign: 'left', flex: 1, minWidth: 0 }} onClick={() => { setV(tr ? tr.airport || '' : airportsOf(s)); setEdit(true); }}>✈️ ab {airportsOf(s, tr)} ✎</button>;
}
// Wohin mit den gewählten Zielen? Jedes wird eine eigene Idee – optional zusammen in einer Gruppe (z.B. „Strandurlaub Januar“)
function TargetSheet({ s, sel, onClose }) {
  const groups = groupsOf(s);
  const [name, setName] = useState('');
  const [time, setTime] = useState({ from: '', to: '', nights: 0 });
  const done = (group) => { const n = applyGuide(sel, { group }); if (group && nightsOf(time)) setGroupTime(group, time); onClose(); toast(n ? `${n} ${n === 1 ? 'Idee' : 'Ideen'} gespeichert${group ? ` in „${group}“` : ''}` : 'Bei den Ideen aktualisiert'); };
  return (
    <Sheet open={!!sel} title="Als Ideen speichern" onClose={onClose}>
      <span className="sub">Jedes Ziel wird eine eigene Idee, in der du Orte und Routen planen kannst. Gehören sie zur selben Reise, pack sie in eine Gruppe – dann stehen sie unten zusammen.</span>
      <TimeFields f={time} setF={setTime} />
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
// ✈️🏠 Preise nachsehen (v0.49): Reisende mit eigenem Startort + Verkehrsmittel + Preisklasse, gemeinsame Unterkunft
function Seg({ options, value, onChange }) {
  return <div className="mini-seg">{Object.entries(options).map(([k, l]) => <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
// Wann / wie lange? Datum (am besten) oder nur Anzahl Nächte – eins von beiden ist nötig
function TimeFields({ f, setF }) {
  const n = nightsOf(f);
  return (
    <div className="field">
      <span>Wann und wie lange? <b style={{ color: n ? undefined : 'var(--danger)' }}>{n ? `${n} Nächte` : '(nötig)'}</b></span>
      <DateRangeField from={f.from} to={f.to} onChange={(v) => setF({ ...f, ...v })} title="Reisezeitraum" />
      {!(f.from && f.to) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tiny">oder nur Dauer:</span>
          <span className="stepper">
            <button type="button" onClick={() => setF({ ...f, nights: Math.max(1, (Number(f.nights) || 7) - 1) })} aria-label="Weniger Nächte">−</button>
            <b>{f.nights || '–'}</b>
            <button type="button" onClick={() => setF({ ...f, nights: (Number(f.nights) || 6) + 1 })} aria-label="Mehr Nächte">+</button>
          </span>
          <span className="tiny">Nächte</span>
        </div>
      )}
    </div>
  );
}
function PriceSheet({ s, trips, title, onClose }) {
  const first = trips?.[0];
  const [f, setF] = useState(() => defaultSetup(s, first));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [key, setKey] = useState(null);
  const k = trips ? trips.map((x) => x.id).join() : null;
  if (k !== key) { setKey(k); setRes(null); setErr(null); if (first) setF(setupOf(s, first)); }
  const setT = (i, patch) => setF({ ...f, travelers: f.travelers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const run = async (web) => {
    setBusy(web ? 'web' : 'quick'); setErr(null);
    try { await comparePrices(s, trips, f, { web }); toast(web ? 'Preise gesucht und gespeichert' : 'Geschätzt und gespeichert'); onClose(); } catch (e) { setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!trips} title={title || 'Preise nachsehen'} onClose={onClose}>
      <TimeFields f={f} setF={setF} />
      <span className="label" style={{ padding: 0 }}>Wer reist von wo? ({f.travelers.reduce((n, x) => n + x.count, 0)} Personen)</span>
      {f.travelers.map((tv, i) => (
        <div key={i} className="traveler">
          <div className="start-field">
            <input className="input" value={tv.start} onChange={(e) => setT(i, { start: e.target.value })} placeholder="Startort, z.B. Frankfurt" aria-label="Startort" />
            {tv.start && <button type="button" className="clear-btn" onClick={() => setT(i, { start: '' })} aria-label="Startort löschen"><Icon name="x" size={12} /></button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="stepper">
              <button type="button" onClick={() => setT(i, { count: Math.max(1, tv.count - 1) })} aria-label="Weniger Personen">−</button>
              <b>{tv.count}</b>
              <button type="button" onClick={() => setT(i, { count: tv.count + 1 })} aria-label="Mehr Personen">+</button>
            </span>
            <span className="tiny" style={{ flex: 1 }}>{tv.count === 1 ? 'Person' : 'Personen'} von hier</span>
            {f.travelers.length > 1 && <button type="button" className="x-btn" onClick={() => setF({ ...f, travelers: f.travelers.filter((_, j) => j !== i) })} aria-label="Startort entfernen"><Icon name="x" size={12} color="var(--chev)" /></button>}
          </div>
          <Seg options={TRAVEL_MODES} value={tv.mode} onChange={(v) => setT(i, { mode: v })} />
          <Seg options={LEVELS} value={tv.level} onChange={(v) => setT(i, { level: v })} />
        </div>
      ))}
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setF({ ...f, travelers: [...f.travelers, { start: '', count: 1, mode: 'flug', level: f.travelers[0]?.level || 'normal' }] })}>+ Weiterer Startort</button>
      <span className="label" style={{ padding: 0 }}>Unterkunft (gemeinsam)</span>
      <Seg options={STAY_TYPES} value={f.stayType} onChange={(v) => setF({ ...f, stayType: v })} />
      <Seg options={LEVELS} value={f.stayLevel} onChange={(v) => setF({ ...f, stayLevel: v })} />
      {!res && (trips || []).length > 0 && (
        <>
          <span className="label" style={{ padding: 0 }}>Direkt nachsehen (kostenlos)</span>
          <div className="list">{trips.map((x) => <div key={x.id} className="row" style={{ minHeight: 44 }}><span className="row-main"><span className="row-title strong">{x.name}</span><DirectLinks s={s} tr={x} setup={f} /></span></div>)}</div>
        </>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={() => run(false)} disabled={!!busy || !getAi().apiKey || !nightsOf(f) || f.travelers.some((x) => !x.start.trim())}>{busy ? 'Schätze …' : 'Schnell schätzen'}</button>
      </div>
      <span className="tiny">Grobe Schätzung zum Vergleichen der Ziele (unter 1 Cent). Echte Preise zeigen die Links oben – kostenlos.</span>
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {res && (
        <>
          {res.hinweis && <span className="sub">{res.hinweis}</span>}
          <div className="list">
            {(trips || []).map((x) => {
              const fresh = s.trips.find((y) => y.id === x.id) || x;
              return <div key={x.id} className="row" style={{ minHeight: 50 }}><span className="row-main"><span className="row-title strong">{x.name}</span><PriceRow p={fresh.prices} /><DirectLinks s={s} tr={fresh} setup={f} /></span></div>;
            })}
          </div>
        </>
      )}
    </Sheet>
  );
}
// „✈️ ab Buenos Aires (2) · ✈️ Frankfurt · 🚌 Montevideo“ – aus den Preis-Einstellungen der Idee
const startsText = (s, tr) => {
  const st = setupOf(s, tr);
  return st.travelers.map((x, i) => `${TRAVEL_MODES[x.mode]?.slice(0, 2) || '✈️'} ${i === 0 ? 'ab ' : ''}${String(x.start || '?').replace(/\s*\(.*?\)/g, '')}${x.count > 1 ? ` (${x.count})` : ''}`).join(' · ');
};
// Kurzer Preis aus den gespeicherten Angaben (ältere Einträge: Zahl aus dem Text holen)
const PRICE_RE = /~?\s*(?:ca\.?\s*)?(?:ab\s*)?\d[\d.,]*\s*(?:USD|US\$|\$|€|EUR|ARS|R\$)/i;
const shortP = (main, text) => (main || ((text || '').match(PRICE_RE)?.[0] || '')).replace(/^ab\s*/i, '~').replace(/\s*\/\s*Nacht/i, '').replace(/^ca\.?\s*/i, '~').trim();
const three = (p) => p ? [shortP(p.anreiseSum || p.flugPreis, p.flug), shortP(p.stayNight || p.stayPreis, p.unterkunft), shortP(p.total || p.perPerson || p.gesamt, p.gesamt)] : ['', '', ''];
// Drei Zahlen klein nebeneinander: Anreise · Unterkunft/Nacht · Gesamt p. P.
// Zahl aus „~1.250 USD“ / „ca. 380 USD“ holen
const num = (x) => { const m = String(x || '').replace(/(\d)[.,](\d{3})\b/g, '$1$2').match(/\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
const curSign0 = (c) => (c === 'EUR' ? '€' : c === 'USD' ? 'US$' : c);
const cur = (x) => (String(x || '').match(/USD|US\$|€|EUR|ARS|R\$/) || ['USD'])[0];
// Pro Startort (v0.57): Reise p. P. · Anteil Unterkunft (Nacht × Nächte ÷ Personen) · Gesamt p. P.
export function perOrigin(p) {
  if (!p) return [];
  const night = num(p.stayNight);
  const people = p.people || (p.anreise || []).reduce((n, x) => n + (x.count || 1), 0) || 1;
  const share = night && p.nights ? (night * p.nights) / people : 0;
  const c = cur(p.stayNight || p.total || p.anreise?.[0]?.preis);
  if (p.anreise?.length) {
    return p.anreise.map((x) => {
      const t = num(x.preis);
      return t == null ? null : { von: String(x.von || x.person || '').replace(/\s*\(.*?\)/g, ''), count: x.count || 1, travel: Math.round(t), stay: Math.round(share), sum: Math.round(t + share), cur: cur(x.preis) || c };
    }).filter(Boolean);
  }
  const tot = num(p.total);
  return tot ? [{ von: '', count: people, travel: null, stay: Math.round(share) || null, sum: Math.round(tot / people), cur: cur(p.total) }] : [];
}
export const perPerson = (p) => (p?.anreise?.length > 1 ? perOrigin(p) : []);
const fmtN = (n) => n.toLocaleString('de-DE');
// Ideen-Liste: Preis pro Person (bei mehreren Startorten Spanne von–bis)
function TotalChip({ p }) {
  const rows = perOrigin(p);
  const pre = p.est ? '≈' : '~';
  let txt;
  if (rows.length) {
    const lo = Math.min(...rows.map((x) => x.sum)), hi = Math.max(...rows.map((x) => x.sum));
    txt = `${pre}${fmtN(lo)}${hi !== lo ? `–${fmtN(hi)}` : ''} ${rows[0].cur}`;
  } else {
    const g = three(p)[2];
    if (!g) return null;
    txt = p.est ? `≈${g.replace(/^~\s*/, '')}` : g;
  }
  return <span className="total-chip">{txt}<i>pro Person{p.nights ? ` · ${p.nights} N.` : ''}</i></span>;
}
// In der Idee: Transport · Unterkunft (alle Nächte) · Gesamt
const stayTotal = (p) => { const n = num(p.stayNight); return n && p.nights ? `~${Math.round(n * p.nights).toLocaleString('de-DE')} ${cur(p.stayNight)}` : shortP(p.stayNight || p.stayPreis, p.unterkunft); };
function PriceRow({ p, detail }) {
  const [a, u0, g] = three(p);
  const u = detail && p.stayNight ? stayTotal(p) : u0;
  if (!a && !u && !g) return null;
  const pp = detail ? [] : perPerson(p);
  return (
    <>
    <span className="price-row3">
      <span><i>{detail ? 'Transport' : p.anreise?.some((x, i) => i > 0 || x.count > 1) || p.people > 1 ? 'Anreise' : 'Flug'}</i>{a || '–'}</span>
      <span><i>{detail ? 'Unterkunft' : 'Nacht'}</i>{u || '–'}</span>
      <span className="sum"><i>Gesamt{p.nights ? ` · ${p.nights} N.` : ''}</i>{p.est && g ? `≈${g.replace(/^~\s*/, '')}` : g || '–'}</span>
    </span>
    {pp.length > 0 && (
      <span className="pp-row">
        {pp.map((x) => <span key={x.von}><i>p. P. ab {x.von}{x.count > 1 ? ` (${x.count})` : ''}</i>{p.est ? '≈' : '~'}{x.sum.toLocaleString('de-DE')} {x.cur}</span>)}
      </span>
    )}
    </>
  );
}
// Kostenlose Direkt-Links zum Vergleichen (Google Flights, Bus/Zug, Airbnb, Booking)
function DirectLinks({ s, tr, setup }) {
  const { travel, stay } = directLinks(s, tr, setup);
  const st = setupOf(s, tr, setup);
  const fly = st.travelers.filter((x) => x.mode === 'flug').map((x) => x.start);
  useEffect(() => { if (fly.length && getAi().apiKey) ensureIata(s, [...fly, tr.dest || tr.name]); }, [fly.join('|'), tr.dest]);
  return (
    <div className="link-chips">
      {[...travel, ...stay].map((l) => <a key={l.url} className="link-chip" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
    </div>
  );
}
// Pro Startort eine Zeile (pro Person): Reise | Unterkunft | Gesamt; mit „Details“ steht die Erklärung direkt unter der jeweiligen Zeile
function OriginGrid({ p, detail }) {
  const rows = perOrigin(p);
  if (!rows.length) return null;
  const one = rows.length === 1;
  return (
    <div className="origin-grid">
      <span className="h">{one ? 'Pro Person' : 'Pro Person ab'}</span><span className="h">Reise</span><span className="h">Unterkunft</span><span className="h">Gesamt</span>
      {rows.map((x, i) => {
        const src = (p.anreise || [])[i];
        return (
          <Fragment key={i}>
            <span className="o">{one ? (x.von ? `ab ${x.von}` : '') : x.von || 'alle'}{x.count > 1 ? ` (${x.count})` : ''}</span>
            <span>{x.travel != null ? fmtN(x.travel) : '–'}</span>
            <span>{x.stay ? fmtN(x.stay) : '–'}</span>
            <span className="sum">{p.est ? '≈' : '~'}{fmtN(x.sum)} {curSign0(x.cur)}</span>
            {detail && (src?.details || src?.preis) && <span className="d">{src.preis ? `Anreise ${src.preis} hin & zurück` : ''}{src.details ? `${src.preis ? ' · ' : ''}${src.details}` : ''}</span>}
          </Fragment>
        );
      })}
      {detail && p.stayNight && <span className="d">Unterkunft: {p.stayNight}/Nacht × {p.nights} N. ÷ {p.people || 1} {p.people === 1 ? 'Person' : 'Personen'}{rows[0].stay ? ` = ${fmtN(rows[0].stay)} ${curSign0(rows[0].cur)} p. P.` : ''}{p.unterkunft ? ` · ${p.unterkunft}` : ''}</span>}
    </div>
  );
}
// In der Idee: Preise pro Person je Startort, „Details“ klappt die Erklärung je Zeile auf
function CostCard({ s, tr, onSearch }) {
  const [open, setOpen] = useState(false);
  const p = tr.prices;
  const has = perOrigin(p).length > 0 || !!three(p)[2];
  return (
    <section className="card" style={{ gap: 8, padding: '12px 14px' }}>
      {has ? (perOrigin(p).length ? <OriginGrid p={p} detail={open} /> : <PriceRow p={p} detail />) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {has ? <button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={() => setOpen(!open)}>Details {open ? '▴' : '▾'}</button> : <span className="tiny" style={{ flex: 1 }}>Preise schätzen oder direkt nachsehen:</span>}
        {has && p.total && <span className="tiny" style={{ flex: 1, textAlign: 'right' }}>Ganze Reise: {p.est ? '≈' : ''}{three(p)[2].replace(/^~\s*/, p.est ? '' : '~')}</span>}
        <button type="button" className="pill" style={{ fontSize: 12.5, padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={onSearch}>{has ? '↻ Neu' : 'Schätzen'}</button>
      </div>
      {open && has && p.checked && <span className="tiny">Stand {fmtShort(p.checked)}{p.when ? ` · ${rangeText(...p.when.split('|'))}` : ''}{p.est ? ' · geschätzt' : ''}</span>}
      <span className="tiny" style={{ marginTop: 2 }}>Direkt nachsehen (kostenlos):</span>
      <DirectLinks s={s} tr={tr} />
    </section>
  );
}
function Inspiration({ s }) {
  const [pending, setPending] = useState(null);
  return (
    <>
      <PlanChat
        title="Wohin könnte ich?"
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
        <span className="row-meta" style={tr.status === 'idee' && !tr.stops.length && !tr.places.length ? { display: 'none' } : undefined}>
          {tr.status === 'idee'
            ? [tr.stops.length && `${tr.stops.length} Stationen`, tr.places.length && `${tr.places.length} Orte`].filter(Boolean).join(' · ')
            : [tr.from && rangeText(tr.from, tr.to), tr.from && tr.from > t && `in ${diffDays(t, tr.from)} Tagen`, `${tr.todo.filter((x) => !x.done).length} offen`].filter(Boolean).join(' · ')}
        </span>
        {tr.status === 'idee' && tr.prices && <TotalChip p={tr.prices} />}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="tiny">Preise in</span>
            {Object.entries(TRIP_CURRENCIES).map(([k, l]) => <button key={k} type="button" className={tripCur(s) === k ? 'chip on' : 'chip soft'} style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => store.update((d) => { d.profile = { ...d.profile, tripCurrency: k }; })}>{l}</button>)}
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
                  </button>
                  <button type="button" className="pill" style={{ fontSize: 12.5, padding: '4px 9px', whiteSpace: 'nowrap' }} onClick={() => setPriceFor({ trips: items, title: `Preise: ${g}` })}>✈️🏠 Preise</button>
                  <button type="button" className="x-btn" aria-label={`Gruppe ${g} umbenennen`} onClick={() => { const n = prompt('Neuer Name der Gruppe', g); if (n && n.trim()) renameGroup(g, n); }}><Icon name="edit" size={13} color="var(--muted)" /></button>
                  <button type="button" className="x-btn" aria-label={`Gruppe ${g} auflösen`} onClick={() => confirm(`Gruppe „${g}“ auflösen? Die Ideen bleiben erhalten.`) && ungroup(g)}><Icon name="x" size={13} color="var(--chev)" /></button>
                </div>
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
function StopDetail({ tr, st, i }) {
  const [pname, setPname] = useState('');
  const [pkind, setPkind] = useState('unterkunft');
  const places = tr.places.filter((p) => p.stopId === st.id);
  const move = (d) => { const list = [...tr.stops]; const [x] = list.splice(i, 1); list.splice(i + d, 0, x); updateTrip(tr.id, { stops: list }); };
  return (
    <>
      <DateRangeField from={st.from} to={st.to} onChange={(v) => updateEntry(tr.id, 'stops', st.id, v)} placeholder="Wann bist du dort?" />
      <input className="input" defaultValue={st.note} key={st.id + 'n' + (st.note || '')} placeholder="Notiz, z.B. „2 Nächte, Strandtag“" onBlur={(e) => e.target.value !== st.note && updateEntry(tr.id, 'stops', st.id, { note: e.target.value })} aria-label="Notiz" />
      <span className="label" style={{ padding: 0 }}>Hier sammeln</span>
      {places.map((p) => (
        <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14.5, flex: 1 }}>{p.status === 'fest' ? '✓ ' : ''}{PLACE_KINDS[p.kind] ? `${PLACE_KINDS[p.kind]}: ` : ''}{p.name}</span>
          <button type="button" className={p.status === 'fest' ? 'pill on' : 'pill'} style={{ fontSize: 12 }} onClick={() => updateEntry(tr.id, 'places', p.id, { status: p.status === 'fest' ? 'option' : 'fest' })}>{p.status === 'fest' ? 'Fest' : 'Option'}</button>
          <button type="button" className="x-btn" aria-label={`${p.name} entfernen`} onClick={() => removeEntry(tr.id, 'places', p.id)}><Icon name="x" size={11} color="var(--chev)" /></button>
        </div>
      ))}
      <div className="chips">{Object.entries(PLACE_KINDS).filter(([k]) => k !== 'sonstiges').map(([k, l]) => <button key={k} type="button" className={pkind === k ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => setPkind(k)}>{l}</button>)}</div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); const id = addEntry(tr.id, 'places', { name: pname.trim(), kind: pkind, stopId: st.id, note: '', address: '', url: '', status: 'option' }); setPname(''); locateEntry(tr.id, 'places', id); }}>
        <input className="input" value={pname} onChange={(e) => setPname(e.target.value)} placeholder="Name" aria-label="Ort sammeln" />
        <button type="submit" className="btn small" disabled={!pname.trim()}>+</button>
      </form>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="pill" disabled={i === 0} onClick={() => move(-1)}>↑</button>
        <button type="button" className="pill" disabled={i === tr.stops.length - 1} onClick={() => move(1)}>↓</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`Station „${st.name}“ löschen?`) && removeEntry(tr.id, 'stops', st.id)}>Löschen</button>
      </div>
    </>
  );
}
const between = (tr, a, b) => tr.transport.filter((x) => x.from?.toLowerCase() === a.toLowerCase() && x.to?.toLowerCase() === b.toLowerCase());
function TransportRow({ tr, x }) {
  return (
    <div className="row" style={{ minHeight: 52, padding: '6px 0' }}>
      <span className="row-main">
        <span className="row-title strong" style={{ fontSize: 14.5 }}>{MODE_ICON[x.mode] || '➡️'} {x.from} → {x.to}</span>
        <span className="row-meta">{[MODES[x.mode], x.date && fmtShort(x.date), x.note].filter(Boolean).join(' · ')}</span>
      </span>
      {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
      <button type="button" className={x.status === 'gebucht' ? 'pill on' : 'pill'} onClick={() => updateEntry(tr.id, 'transport', x.id, { status: x.status === 'gebucht' ? 'option' : 'gebucht' })}>{x.status === 'gebucht' ? '✓ Gebucht' : 'Option'}</button>
      <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeEntry(tr.id, 'transport', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
    </div>
  );
}
function LegDetail({ tr, a, b }) {
  const [mode, setMode] = useState('bus');
  const [note, setNote] = useState('');
  const list = between(tr, a, b);
  return (
    <>
      {list.map((x) => <TransportRow key={x.id} tr={tr} x={x} />)}
      <div className="chips">{Object.entries(MODES).map(([k, l]) => <button key={k} type="button" className={mode === k ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => setMode(k)}>{MODE_ICON[k]} {l}</button>)}</div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); addEntry(tr.id, 'transport', { from: a, to: b, mode, date: '', time: '', note: note.trim(), url: rome2rio(a, b), status: 'option' }); setNote(''); }}>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dauer, Preis, Anbieter …" aria-label="Transport-Notiz" />
        <button type="submit" className="btn small">+ Option</button>
      </form>
      <a className="link-btn" style={{ fontSize: 13, alignSelf: 'flex-start' }} href={rome2rio(a, b)} target="_blank" rel="noreferrer">Echte Verbindungen auf Rome2rio ↗</a>
    </>
  );
}
function Route({ tr }) {
  const [tf, setTf] = useState({ from: '', to: '', mode: 'flug' });
  const stops = tr.stops;
  const inTimeline = (x) => stops.some((st, i) => i < stops.length - 1 && x.from?.toLowerCase() === st.name.toLowerCase() && x.to?.toLowerCase() === stops[i + 1].name.toLowerCase());
  const other = tr.transport.filter((x) => !inTimeline(x));
  return (
    <>
      <section className="card" style={{ gap: 6 }}>
        <span className="label" style={{ padding: 0 }}>{tripKind(tr) === 'ort' ? 'Ziel' : 'Finale Route'}</span>
        <Timeline
          items={stops}
          name={(st) => st.name}
          meta={(st) => { const n = tr.places.filter((p) => p.stopId === st.id).length; const stay = tr.places.find((p) => p.stopId === st.id && p.kind === 'unterkunft' && p.status === 'fest'); return [st.from && rangeText(st.from, st.to), stay ? `🏠 ${stay.name}` : null, n && `${n} gesammelt`, st.note].filter(Boolean).join(' · '); }}
          leg={(i) => { const l = between(tr, stops[i].name, stops[i + 1].name); if (!l.length) return null; const b = l.find((x) => x.status === 'gebucht') || l[0]; return { icon: MODE_ICON[b.mode] || '➡️', text: [b.status === 'gebucht' ? '✓ gebucht' : `${l.length} Option${l.length > 1 ? 'en' : ''}`, b.note].filter(Boolean).join(' · ') }; }}
          renderDetail={(st, i) => <StopDetail tr={tr} st={st} i={i} />}
          renderLeg={(i) => <LegDetail tr={tr} a={stops[i].name} b={stops[i + 1].name} />}
          onInsert={(name, at) => insertStop(tr.id, name, at)}
          addPlaceholder="Station hinzufügen, z.B. Garopaba"
        />
        {!stops.length && tripKind(tr) !== 'ort' && <span className="tiny">Tipp: Unter „Varianten“ ganze Routen oder einzelne Orte hierher übernehmen.</span>}
      </section>
      <section className="group">
        <h2 className="label" style={{ padding: '0 4px' }}>An- & Abreise / weitere Verbindungen</h2>
        <div className="list" style={{ padding: '0 16px' }}>
          {other.length === 0 && <div className="empty" style={{ padding: '12px 0' }}>z.B. Flug Buenos Aires → erste Station.</div>}
          {other.map((x) => <TransportRow key={x.id} tr={tr} x={x} />)}
          <form className="stop-edit" style={{ padding: '8px 0' }} onSubmit={(e) => { e.preventDefault(); addEntry(tr.id, 'transport', { from: tf.from.trim(), to: tf.to.trim(), mode: tf.mode, date: '', time: '', note: '', url: '', status: 'option' }); setTf({ from: tf.to, to: '', mode: tf.mode }); }}>
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

const errMsg = (e) => (e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
const MODE_ICON = { flug: '✈️', bus: '🚌', auto: '🚗', zug: '🚆', faehre: '⛴️', sonstiges: '➡️' };

// v0.73: Ein-Ort-Reise – mögliche Ziele sammeln und vergleichen, eines festlegen
function Spots({ s, tr }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState([]);
  const list = tr.spots || [];
  const ask = async () => {
    setBusy(true);
    try { setSugg(await suggestSpots(s, tr)); } catch (e) { toast(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="list">
        {list.length === 0 && <div className="empty">Weißt du schon, wohin? Dann trag den Ort ein und leg ihn fest. Unsicher? Sammle hier mehrere Orte und vergleiche sie – auch mit der KI unten („Vergleich meine Orte“).</div>}
        {list.map((x) => (
          <div key={x.id} className="row" style={{ minHeight: 56 }}>
            <span className="row-main">
              <span className="row-title strong">{x.chosen ? '✓ ' : ''}{x.name}</span>
              {(x.note || (x.tags || []).length > 0) && <span className="row-meta">{[...(x.tags || []), x.note].filter(Boolean).join(' · ')}</span>}
            </span>
            <button type="button" className={x.chosen ? 'pill on' : 'pill'} onClick={() => { chooseSpot(tr.id, x.id); toast(`Ziel: ${x.name}`); }}>{x.chosen ? 'Gewählt' : 'Festlegen'}</button>
            <button type="button" className="x-btn" aria-label={`${x.name} entfernen`} onClick={() => removeSpotFrom(tr.id, 'spots', x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
        <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addSpotTo(tr.id, 'spots', { name }); setName(''); }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ort, z.B. Punta del Este" aria-label="Ort zum Vergleichen" />
          <button type="submit" className="btn small" disabled={!name.trim()}>+</button>
        </form>
      </div>
      <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={ask} disabled={busy || !getAi().apiKey}>{busy ? 'Ich überlege …' : `✨ Orte zum Vergleichen vorschlagen${tr.region || tr.dest ? ` (${tr.region || tr.dest})` : ''}`}</button>
      {sugg.length > 0 && <SuggList items={sugg} onTake={(x) => { addSpotTo(tr.id, 'spots', { name: x.name, note: x.was, tags: x.typ ? [x.typ] : [] }); setSugg(sugg.filter((y) => y !== x)); }} onClose={() => setSugg([])} />}
    </>
  );
}

function SuggList({ items, onTake, onClose }) {
  return (
    <section className="card" style={{ gap: 8 }}>
      <div className="sec-h" style={{ padding: 0 }}><span className="label" style={{ padding: 0 }}>Vorschläge – antippen zum Übernehmen</span><button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={onClose}>Schließen</button></div>
      {items.map((x) => (
        <div key={x.name} className="option" style={{ alignItems: 'center' }}>
          <span className="row-main">
            <span style={{ fontWeight: 600, fontSize: 15 }}>{x.name}{x.naechte ? <span className="tiny"> · {x.naechte} N.</span> : null}</span>
            <span className="tiny">{[x.typ, x.was].filter(Boolean).join(' · ')}</span>
          </span>
          <button type="button" className="pill on" onClick={() => onTake(x)}>+ Sammeln</button>
        </div>
      ))}
    </section>
  );
}

// v0.73: Rundreise – Region + Schwerpunkte → Orte sammeln → daraus Varianten
function Pool({ s, tr, onVariants }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(null);
  const [sugg, setSugg] = useState([]);
  const [sel, setSel] = useState([]);
  const [vname, setVname] = useState('');
  const pool = tr.pool || [];
  const focus = tr.focus || [];
  const ask = async () => {
    setBusy('sugg');
    try { setSugg(await suggestSpots(s, tr)); } catch (e) { toast(errMsg(e)); } finally { setBusy(null); }
  };
  const build = async () => {
    setBusy('build');
    try { const n = await buildVariants(s, tr); toast(`${n} Varianten gebaut`); onVariants?.(); } catch (e) { toast(errMsg(e)); } finally { setBusy(null); }
  };
  const tog = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <>
      <section className="card" style={{ gap: 10 }}>
        <Field label="Wohin ungefähr? (Land, Region oder Stadt)"><input className="input" defaultValue={tr.region || tr.dest || ''} key={tr.id + 'rg'} placeholder="z.B. Südbrasilien, Patagonien, Japan" onBlur={(e) => e.target.value !== (tr.region || '') && updateTrip(tr.id, { region: e.target.value.trim() })} /></Field>
        <div className="field">
          <span>Was willst du vor allem?</span>
          <div className="chips">{FOCI.map((f) => <button key={f} type="button" className={focus.includes(f) ? 'chip on' : 'chip soft'} style={{ fontSize: 13, padding: '5px 10px' }} onClick={() => updateTrip(tr.id, { focus: focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f] })}>{f}</button>)}</div>
        </div>
        <button type="button" className="btn small" onClick={ask} disabled={!!busy || !getAi().apiKey}>{busy === 'sugg' ? 'Ich suche passende Orte …' : '✨ Orte vorschlagen'}</button>
      </section>
      {sugg.length > 0 && <SuggList items={sugg} onTake={(x) => { addSpotTo(tr.id, 'pool', { name: x.name, note: x.was, tags: x.typ ? [x.typ] : [], nights: x.naechte || null }); setSugg(sugg.filter((y) => y !== x)); }} onClose={() => setSugg([])} />}
      <section className="group">
        <div className="sec-h"><h2 className="label" style={{ padding: '0 4px' }}>Gesammelte Orte · {pool.length}</h2>{pool.length > 0 && <span className="tiny">antippen = für eine Variante auswählen</span>}</div>
        <div className="list">
          {pool.length === 0 && <div className="empty">Noch nichts gesammelt. Lass dir oben Orte vorschlagen oder trag eigene ein.</div>}
          {pool.map((x) => {
            const i = sel.indexOf(x.id);
            return (
              <div key={x.id} className="row" style={{ minHeight: 54 }}>
                <button type="button" className="step-no" style={{ border: 0, background: i >= 0 ? 'var(--accent)' : 'var(--card-2)', color: i >= 0 ? '#fff' : 'var(--chev)', cursor: 'pointer' }} onClick={() => tog(x.id)} aria-label={`${x.name} auswählen`}>{i >= 0 ? i + 1 : '+'}</button>
                <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => tog(x.id)}>
                  <span className="row-title strong">{x.name}{x.nights ? <span className="tiny"> · {x.nights} N.</span> : null}</span>
                  {(x.note || (x.tags || []).length > 0) && <span className="row-meta">{[...(x.tags || []), x.note].filter(Boolean).join(' · ')}</span>}
                </button>
                <button type="button" className="x-btn" aria-label={`${x.name} entfernen`} onClick={() => { removeSpotFrom(tr.id, 'pool', x.id); setSel(sel.filter((y) => y !== x.id)); }}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            );
          })}
          <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addSpotTo(tr.id, 'pool', { name }); setName(''); }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eigenen Ort hinzufügen" aria-label="Eigener Ort" />
            <button type="submit" className="btn small" disabled={!name.trim()}>+</button>
          </form>
        </div>
      </section>
      {sel.length > 0 && (
        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Neue Variante aus {sel.length} {sel.length === 1 ? 'Ort' : 'Orten'} (Reihenfolge = Auswahl)</span>
          <span className="tiny" style={{ color: 'var(--text)' }}>{sel.map((id) => pool.find((x) => x.id === id)?.name).filter(Boolean).join(' → ')}</span>
          <input className="input" value={vname} onChange={(e) => setVname(e.target.value)} placeholder="Name, z.B. Mehr Strand" aria-label="Name der Variante" />
          <button type="button" className="btn small" onClick={() => { addVariant(tr.id, { name: vname.trim() || undefined, stops: sel.map((id) => pool.find((x) => x.id === id)).filter(Boolean).map((x) => ({ name: x.name, nights: x.nights, note: x.note })) }); setSel([]); setVname(''); toast('Variante gespeichert'); onVariants?.(); }}>Als Variante speichern</button>
        </section>
      )}
      {pool.length >= 2 && <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={build} disabled={!!busy || !getAi().apiKey}>{busy === 'build' ? 'Ich baue Routen …' : '✨ 2 Varianten aus den gesammelten Orten bauen'}</button>}
    </>
  );
}


// ---------- v0.74: Zeitleiste wie bei Google Maps – Ort, Linie mit Transport, nächster Ort ----------
function Timeline({ items, name, meta, leg, renderDetail, renderLeg, onInsert, addPlaceholder = 'Ort hinzufügen, z.B. Garopaba' }) {
  const [openStop, setOpenStop] = useState(null);
  const [openLeg, setOpenLeg] = useState(null);
  const [insertAt, setInsertAt] = useState(null);
  const [text, setText] = useState('');
  const n = items.length;
  const add = (at) => { onInsert(text, at); setText(''); setInsertAt(null); };
  const insertForm = (at) => (
    <form className="tl-detail" onSubmit={(e) => { e.preventDefault(); add(at); }}>
      <div className="block-add">
        <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={addPlaceholder} aria-label="Ort einfügen" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </div>
    </form>
  );
  return (
    <div className="tl">
      {n === 0 && <span className="tiny" style={{ padding: '4px 0' }}>Noch keine Orte – unten den ersten hinzufügen.</span>}
      {items.map((x, i) => {
        const l = i < n - 1 ? leg(i) : null;
        return (
          <Fragment key={i + name(x)}>
            <div className="tl-node">
              <button type="button" className="tl-dot" onClick={() => setOpenStop(openStop === i ? null : i)} aria-label={`${name(x)} öffnen`}>{i + 1}</button>
              <button type="button" className="tl-main" onClick={() => setOpenStop(openStop === i ? null : i)}>
                <span style={{ fontWeight: 650, fontSize: 15.5 }}>{name(x)}</span>
                {meta(x, i) && <span className="tiny">{meta(x, i)}</span>}
              </button>
              <span className="tiny">{openStop === i ? '▴' : '▾'}</span>
            </div>
            {openStop === i && <div className={i < n - 1 ? 'tl-detail line' : 'tl-detail'}>{renderDetail(x, i)}</div>}
            {i < n - 1 && (
              <div className="tl-link">
                <button type="button" className="tl-leg" onClick={() => setOpenLeg(openLeg === i ? null : i)}>{l ? `${l.icon} ${l.text}` : '＋ Transport'}</button>
                <button type="button" className="tl-plus" onClick={() => { setInsertAt(insertAt === i + 1 ? null : i + 1); setText(''); }} aria-label="Ort dazwischen einfügen">＋</button>
              </div>
            )}
            {i < n - 1 && openLeg === i && <div className="tl-detail line">{renderLeg(i)}</div>}
            {i < n - 1 && insertAt === i + 1 && insertForm(i + 1)}
          </Fragment>
        );
      })}
      <form className="tl-node" onSubmit={(e) => { e.preventDefault(); if (insertAt === null || insertAt >= n) add(n); }}>
        <span className="tl-dot add">＋</span>
        <input className="input" value={insertAt === null || insertAt >= n ? text : ''} onFocus={() => setInsertAt(null)} onChange={(e) => setText(e.target.value)} placeholder={addPlaceholder} aria-label="Ort am Ende hinzufügen" />
        <button type="submit" className="btn small" disabled={!text.trim() || (insertAt !== null && insertAt < n)}>+</button>
      </form>
    </div>
  );
}

const ITEM_KINDS = { unterkunft: '🏠', essen: '🍽', sehen: '👀', tun: '🎯' };
const ITEM_LABEL = { unterkunft: 'Unterkunft', essen: 'Essen', sehen: 'Sehen', tun: 'Tun' };
function Nights({ value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="pill" onClick={() => onChange(Math.max(0, (value || 0) - 1) || null)} aria-label="Eine Nacht weniger">−</button>
      <b style={{ minWidth: 60, textAlign: 'center' }}>{value ? `${value} ${value === 1 ? 'Nacht' : 'Nächte'}` : 'Nächte?'}</b>
      <button type="button" className="pill" onClick={() => onChange((value || 0) + 1)} aria-label="Eine Nacht mehr">+</button>
    </span>
  );
}
function VariantStopDetail({ tr, v, x, i }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState('sehen');
  const items = x.items || [];
  return (
    <>
      <Nights value={x.nights} onChange={(nv) => updateVariantStop(tr.id, v.id, i, { nights: nv })} />
      <input className="input" defaultValue={x.note || ''} key={v.id + i + 'n' + (x.note || '')} placeholder="Notiz, z.B. Strände, Lagoa" onBlur={(e) => e.target.value !== (x.note || '') && updateVariantStop(tr.id, v.id, i, { note: e.target.value })} aria-label="Notiz" />
      <span className="label" style={{ padding: 0 }}>Hier sammeln</span>
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14.5, flex: 1 }}>{ITEM_KINDS[it.kind] || '•'} {it.text}</span>
          <button type="button" className="x-btn" aria-label={`${it.text} entfernen`} onClick={() => removeVariantItem(tr.id, v.id, i, it.id)}><Icon name="x" size={11} color="var(--chev)" /></button>
        </div>
      ))}
      <div className="chips">{Object.entries(ITEM_LABEL).map(([k, l]) => <button key={k} type="button" className={kind === k ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => setKind(k)}>{ITEM_KINDS[k]} {l}</button>)}</div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); addVariantItem(tr.id, v.id, i, text, kind); setText(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'unterkunft' ? 'z.B. Pousada am Strand' : kind === 'essen' ? 'z.B. Ostras in Ribeirão' : kind === 'tun' ? 'z.B. Surfkurs' : 'z.B. Lagoa da Conceição'} aria-label="Etwas sammeln" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="pill" disabled={i === 0} onClick={() => moveVariantStop(tr.id, v.id, i, -1)}>↑</button>
        <button type="button" className="pill" disabled={i === v.stops.length - 1} onClick={() => moveVariantStop(tr.id, v.id, i, 1)}>↓</button>
        <button type="button" className="pill on" onClick={() => { const nAdd = appendFromVariant(tr.id, v.id, [i]); toast(nAdd ? `${x.name} an die finale Route angehängt` : 'Ist schon in der finalen Route'); }}>→ In finale Route</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => removeVariantStop(tr.id, v.id, i)}>Entfernen</button>
      </div>
    </>
  );
}
function VariantLegDetail({ tr, v, a, b }) {
  const l = legOf(v.legs, a, b) || {};
  const set = (patch) => setVariantLeg(tr.id, v.id, a, b, patch);
  return (
    <>
      <span className="tiny">{a} → {b}</span>
      <div className="chips">{Object.entries(MODES).map(([k, lab]) => <button key={k} type="button" className={l.mode === k ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => set({ mode: k })}>{MODE_ICON[k]} {lab}</button>)}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" defaultValue={l.dur || ''} key={a + b + 'd' + (l.dur || '')} placeholder="Dauer, z.B. 3 h" onBlur={(e) => e.target.value !== (l.dur || '') && set({ dur: e.target.value })} aria-label="Dauer" />
        <input className="input" defaultValue={l.price || ''} key={a + b + 'p' + (l.price || '')} placeholder="Preis" onBlur={(e) => e.target.value !== (l.price || '') && set({ price: e.target.value })} aria-label="Preis" />
      </div>
      <input className="input" defaultValue={l.note || ''} key={a + b + 'n' + (l.note || '')} placeholder="Notiz, z.B. Anbieter, Abfahrt" onBlur={(e) => e.target.value !== (l.note || '') && set({ note: e.target.value })} aria-label="Notiz" />
      <a className="link-btn" style={{ fontSize: 13, alignSelf: 'flex-start' }} href={rome2rio(a, b)} target="_blank" rel="noreferrer">Echte Verbindungen auf Rome2rio ↗</a>
    </>
  );
}
const legChip = (l) => (l ? { icon: MODE_ICON[l.mode] || '➡️', text: [l.dur, l.price].filter(Boolean).join(' · ') || MODES[l.mode] || 'Transport' } : null);

function VariantCard({ s, tr, v, vi, isIdea, onChosen, onCommit }) {
  const [busy, setBusy] = useState(null);
  const [wish, setWish] = useState('');
  const nights = v.stops.reduce((n, x) => n + (x.nights || 0), 0);
  const legs = async () => { setBusy('legs'); try { await variantTransport(s, tr, v.id); } catch (e) { toast(errMsg(e)); } finally { setBusy(null); } };
  const ai = async () => { if (!wish.trim()) return; setBusy('ai'); try { await editVariant(s, tr, v.id, wish.trim()); setWish(''); } catch (e) { toast(errMsg(e)); } finally { setBusy(null); } };
  return (
    <section className="card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="eyebrow" style={{ fontSize: 11, flex: 1 }}>Variante {vi + 1}{v.chosen ? ' · ✓ ist die finale Route' : ''}</span>
        <span className="tiny">{v.stops.length} Orte{nights ? ` · ${nights} N.` : ''}</span>
      </div>
      <input className="input title-input" style={{ fontSize: 19 }} defaultValue={v.name} key={v.id + v.name} onBlur={(e) => e.target.value.trim() && e.target.value !== v.name && updateVariant(tr.id, v.id, { name: e.target.value.trim() })} aria-label="Name der Variante" />
      {(v.aiNote || v.summary) && <span className="tiny" style={{ color: 'var(--text)' }}>{v.aiNote ? `✨ ${v.aiNote}` : v.summary}</span>}
      <Timeline
        items={v.stops}
        name={(x) => x.name}
        meta={(x) => [x.nights && `${x.nights} N.`, (x.items || []).length && `${x.items.length} gesammelt`, x.note].filter(Boolean).join(' · ')}
        leg={(i) => legChip(legOf(v.legs, v.stops[i].name, v.stops[i + 1].name))}
        renderDetail={(x, i) => <VariantStopDetail tr={tr} v={v} x={x} i={i} />}
        renderLeg={(i) => <VariantLegDetail tr={tr} v={v} a={v.stops[i].name} b={v.stops[i + 1].name} />}
        onInsert={(name, at) => addVariantStop(tr.id, v.id, name, at)}
      />
      {v.stops.length > 1 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={legs} disabled={!!busy || !getAi().apiKey}>{busy === 'legs' ? 'Ich schätze die Strecken …' : v.legs?.length ? '↻ Transport neu schätzen (KI)' : '🚌 Transport zwischen allen Orten schätzen (KI)'}</button>}
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); ai(); }}>
        <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="✨ KI: z.B. „mehr Strand“, „2 Nächte weniger“" aria-label={`KI für Variante ${vi + 1}`} />
        <button type="submit" className="btn small" disabled={!wish.trim() || !!busy || !getAi().apiKey}>{busy === 'ai' ? '…' : '✨'}</button>
      </form>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={v.chosen ? 'pill on' : 'pill'} disabled={!v.stops.length} onClick={() => { chooseVariant(tr.id, v.id); toast(`„${v.name}“ ist jetzt die finale Route`); onChosen?.(); }}>{v.chosen ? 'Ist die finale Route' : 'Ganze Variante als finale Route'}</button>
        {isIdea && <button type="button" className="pill on" disabled={!v.stops.length} onClick={() => { chooseVariant(tr.id, v.id); onCommit(); }}>Zur Reise machen</button>}
        <span style={{ flex: 1 }} />
        <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`Variante „${v.name}“ löschen?`) && removeVariant(tr.id, v.id)}>Löschen</button>
      </div>
    </section>
  );
}
function Variants({ s, tr, onChosen, onCommit }) {
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const vs = tr.variants || [];
  const build = async () => { setBusy(true); try { const n = await buildVariants(s, tr, wish.trim()); setWish(''); toast(`${n} Varianten erstellt`); } catch (e) { toast(errMsg(e)); } finally { setBusy(false); } };
  return (
    <>
      <section className="card" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>✨ Varianten erstellen</span>
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); build(); }}>
          <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder={`z.B. „eine entspannt, eine mit viel Kultur“`} aria-label="Wunsch für die Varianten" />
          <button type="submit" className="btn small" disabled={busy || !getAi().apiKey}>{busy ? '…' : '✨'}</button>
        </form>
        <span className="tiny">Die KI baut 2 Varianten{(tr.pool || []).length ? ' aus deinen gesammelten Orten' : ''}. Oder selbst: <button type="button" className="link-btn" style={{ fontSize: 12.5 }} onClick={() => addEmptyVariant(tr.id)}>+ Leere Variante</button></span>
      </section>
      {vs.length === 0 && <div className="list"><div className="empty">Noch keine Variante. Lass dir oben welche bauen oder leg eine leere an und füg Orte hinzu.</div></div>}
      {vs.map((v, vi) => <VariantCard key={v.id} s={s} tr={tr} v={v} vi={vi} isIdea={!!onCommit} onChosen={onChosen} onCommit={onCommit} />)}
      {vs.length > 0 && <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => addEmptyVariant(tr.id)}>+ Weitere Variante</button>}
    </>
  );
}

const PLAN_GROUPS = [
  { key: 'kandidaten', label: 'Zu den Orten (sammeln / vergleichen)', title: (x) => x.name, meta: (x) => [x.typ, x.was, x.naechte && `${x.naechte} N.`].filter(Boolean).join(' · ') },
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
  const kind = tripKind(tr);
  const planTabs = [['todo', 'To-dos'], ['packen', 'Packen'], ['docs', 'Unterlagen'], ['budget', 'Budget'], ['notizen', 'Notizen']];
  const tabs = kind === 'ort'
    ? (isIdea ? [['vergleich', 'Orte vergleichen'], ['orte', 'Vor Ort'], ['notizen', 'Notizen']] : [['vergleich', 'Ziel'], ['route', 'Anreise'], ['orte', 'Vor Ort'], ...planTabs])
    : (isIdea ? [['sammeln', 'Orte sammeln'], ['varianten', 'Varianten'], ['route', 'Finale Route'], ['orte', 'Orte'], ['notizen', 'Notizen']] : [['route', 'Finale Route'], ['sammeln', 'Orte sammeln'], ['varianten', 'Varianten'], ['orte', 'Orte'], ...planTabs]);
  const [tab, setTab] = useState(null);
  const [commit, setCommit] = useState(false);
  const [priceFor, setPriceFor] = useState(null);
  const [range, setRange] = useState({ from: tr.from, to: tr.to });
  const cur = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  const days = tr.from ? diffDays(t, tr.from) : null;
  const spent = tr.expenses.reduce((n, x) => n + x.amount, 0);
  const count = { sammeln: (tr.pool || []).length, vergleich: (tr.spots || []).length, varianten: (tr.variants || []).length, todo: tr.todo.filter((x) => !x.done).length, packen: tr.packen.filter((x) => !x.done).length, orte: tr.places.length, route: tr.stops.length, docs: tr.docs.length };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/reisen" label="Reisen" />
          <input className="input title-input" defaultValue={tr.name} key={tr.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== tr.name && updateTrip(tr.id, { name: e.target.value.trim() })} aria-label="Name" />
          <span className="tiny">{isIdea ? '💡 Idee' : '✈️ Festgelegt'}{tr.dest && tr.dest !== tr.name ? ` · ${tr.dest}` : ''}{tr.group ? ` · 📁 ${tr.group}` : ''}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="link-btn" style={{ fontSize: 14, textAlign: 'left', flex: 1, minWidth: 0 }} onClick={() => setPriceFor(tr.group ? s.trips.filter((x) => x.group === tr.group) : [tr])}>{startsText(s, tr)} ✎</button>
            {isIdea && <button type="button" className="pill on" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => setCommit(true)}>Reise festlegen</button>}
          </div>
        </div>

        {isIdea ? (
          <CostCard s={s} tr={tr} onSearch={() => setPriceFor(tr.group ? s.trips.filter((x) => x.group === tr.group) : [tr])} />
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


        <div className="seg full" role="group" aria-label="Art der Reise">
          <button type="button" className={kind === 'ort' ? 'on' : ''} aria-pressed={kind === 'ort'} onClick={() => { if (kind === 'ort') return; updateTrip(tr.id, { kind: 'ort' }); setTab(null); toast('Umgestellt – deine Rundreise-Planung bleibt gespeichert'); }}>📍 An einem Ort</button>
          <button type="button" className={kind === 'rundreise' ? 'on' : ''} aria-pressed={kind === 'rundreise'} onClick={() => { if (kind === 'rundreise') return; updateTrip(tr.id, { kind: 'rundreise' }); setTab(null); toast('Umgestellt – nichts geht verloren'); }}>🗺 Rundreise</button>
        </div>
        {kind === 'ort' && ((tr.pool || []).length > 0 || (tr.variants || []).length > 0) && <span className="tiny" style={{ padding: '0 4px', marginTop: -6 }}>🗺 Gespeichert bleibt deine Rundreise-Planung ({[(tr.pool || []).length && `${tr.pool.length} Orte`, (tr.variants || []).length && `${tr.variants.length} Varianten`].filter(Boolean).join(', ')}) – mit „Rundreise“ ist alles wieder da.</span>}
        {kind === 'rundreise' && (tr.spots || []).length > 0 && <span className="tiny" style={{ padding: '0 4px', marginTop: -6 }}>📍 Gespeichert bleiben {tr.spots.length} Orte zum Vergleichen – unter „An einem Ort“.</span>}
        <div className="box-tabs main-tabs">
          {tabs.map(([k, l]) => <button key={k} type="button" className={cur === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(k)}>{l}{count[k] ? ` ${count[k]}` : ''}</button>)}
        </div>
        {cur === 'vergleich' && <Spots s={s} tr={tr} />}
        {cur === 'sammeln' && <Pool s={s} tr={tr} onVariants={() => setTab('varianten')} />}
        {cur === 'varianten' && <Variants s={s} tr={tr} onChosen={() => setTab('route')} onCommit={isIdea ? () => setCommit(true) : null} />}
        {cur === 'route' && <Route tr={tr} />}
        {cur === 'orte' && <Places tr={tr} />}
        {cur === 'todo' && <GroupedChecklist items={tr.todo} cats={Object.keys(TODO_TEMPLATE)} onAdd={(text, cat) => addCheck(tr.id, 'todo', text, cat)} onToggle={(id) => updateEntry(tr.id, 'todo', id, { done: !tr.todo.find((x) => x.id === id).done })} onRemove={(id) => removeEntry(tr.id, 'todo', id)} onTemplate={() => commitTrip(tr.id)} placeholder="Neues To-do" />}
        {cur === 'packen' && <GroupedChecklist items={tr.packen} cats={Object.keys(PACK_TEMPLATE)} onAdd={(text, cat) => addCheck(tr.id, 'packen', text, cat)} onToggle={(id) => updateEntry(tr.id, 'packen', id, { done: !tr.packen.find((x) => x.id === id).done })} onRemove={(id) => removeEntry(tr.id, 'packen', id)} onTemplate={() => commitTrip(tr.id)} placeholder="Einpacken" />}
        {cur === 'docs' && <Docs tr={tr} />}
        {cur === 'budget' && <Budget tr={tr} />}
        {cur === 'notizen' && isIdea && (
          <section className="card" style={{ gap: 6 }}>
            <textarea className="input" style={{ minHeight: 140, fontSize: 15 }} defaultValue={tr.idea} key={tr.id + 'idea' + (tr.idea || '').length} placeholder="Alles sammeln: was es dort gibt, Anreise, beste Zeit …" onBlur={(e) => e.target.value !== tr.idea && updateTrip(tr.id, { idea: e.target.value })} aria-label="Notizen zur Idee" />
          </section>
        )}
        {cur === 'notizen' && (!isIdea || tr.notes) && (
          <section className="card" style={{ gap: 6 }}>
            <textarea className="input" style={{ minHeight: 140 }} defaultValue={tr.notes} key={tr.id + 'notes'} placeholder="Alles Weitere: Kontakte, Ideen, Gedanken …" onBlur={(e) => e.target.value !== tr.notes && updateTrip(tr.id, { notes: e.target.value })} />
          </section>
        )}
        <PlanChat
          title={isIdea ? 'Mit KI recherchieren' : 'Mit KI planen'}
          intro={isIdea ? (kind === 'ort' ? 'Erzähl, was dir wichtig ist (Strand, Ruhe, Essen …). Ich schlage Orte zum Vergleichen vor und sage, was für welchen spricht.' : 'Erzähl, was dich reizt und wie lange du Zeit hast. Ich schlage Orte für deine Sammlung vor und baue daraus Routen-Varianten.') : 'Sag z.B.: „Ich mache viel Sport dort, es wird kalt“ – ich passe Packliste und To-dos an. Oder: „Such mir eine Unterkunft in der Nähe vom Strand“.'}
          history={tr.chat}
          prefKey="reise"
          onSave={(chat) => updateTrip(tr.id, { chat })}
          onAsk={(hist, o) => tripAssist(s, tr, hist, o)}
          webChips={isIdea ? [] : ['Flüge suchen', 'Unterkunft suchen', 'Bus & Fähren zwischen den Stationen']}
          autoWeb={TRAVEL_WEB}
          groups={PLAN_GROUPS}
          onApply={(sel) => applyTripProposal(tr.id, sel)}
          chips={kind === 'ort' ? (isIdea ? ['Vergleich meine Orte', 'Welcher Ort passt zu mir?', 'Was gibt es dort zu tun?'] : ['Unterkunft-Lage: wo am besten?', 'Sehenswürdigkeiten', 'Restaurant-Tipps', 'Packliste anpassen']) : (isIdea ? ['Mehr Orte für die Sammlung', 'Vergleich meine Varianten', 'Was gibt es dort zu sehen?'] : ['Alternative Route als Variante', 'Sehenswürdigkeiten', 'Restaurant-Tipps', 'Packliste anpassen', 'Was fehlt noch?'])}
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
