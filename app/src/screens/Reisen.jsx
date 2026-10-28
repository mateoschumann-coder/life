import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addCheck, addEntry, addExpense, addTrip, applyTripProposal, commitTrip, locateEntry, MODES, PACK_TEMPLATE, PLACE_CAT, PLACE_KINDS,
  removeEntry, removeTrip, TODO_TEMPLATE, tripAssist, tripGuide, applyGuide, updateEntry, updateTrip, airportsOf, comparePrices, defaultSetup, fixSetup, directLinks, nightsOf, setGroupTime, ensureIata, setupOf, TRIP_CURRENCIES, tripCur, TRAVEL_MODES, LEVELS, STAY_TYPES,
  addVariant, removeVariant, chooseVariant, locateAll, locateTrip, tripKind, FOCI, addSpotTo, removeSpotFrom, chooseSpot, suggestSpots, buildVariants, variantTransport, appendFromVariant, rome2rio, updateVariant, addVariantStop, removeVariantStop, moveVariantStop, updateVariantStop, legOf, setVariantLeg, addVariantItem, removeVariantItem, updateVariantItem, spotLinks, addEmptyVariant, insertStop, editVariant, suggestPosition, stopLinks, syncAutoTransport, ensureIata as ensureIataCodes, toOutings, moveStop, removeStop, reorderStop, reorderVariantStop, tripHome, skyUrl, legUrl, legsOf, fxText, fxPrices, addVariantLeg, updateVariantLeg, removeVariantLeg, parseLegText, setTripDates, restartFinalRoute, saveTripSetup } from '../lib/trips';
import { getAi } from '../lib/ai';
import { groupIdeas, groupsOf, renameGroup, ungroup, missingPack, fillPackTemplate, packSuggest } from '../lib/trips';
import { chatOf, saveChatOf } from '../lib/chats';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import GroupedChecklist from '../components/GroupedChecklist';
import NotesArea from '../components/NotesArea';
import PlanChat from '../components/PlanChat';
import MapView from '../components/MapView';
import { DateRangeField, rangeText } from '../components/DateRange';
import { Back, Chevron, Field, Icon, Sheet, TabBar, toast, Info } from '../components/ui';
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
  // v0.85: neuer Startort bei Rundreise → finale Route beginnt neu (bisherige wird Variante), sonst passt sich alles an
  const startOk = () => {
    for (const x of trips || []) {
      const cl = (z) => String(z || '').replace(/\s*\(.*?\)/g, '').split(',')[0].trim(); const old = cl(setupOf(s, x).travelers[0]?.start), neu = cl(f.travelers[0]?.start);
      if (old && neu && old.toLowerCase() !== neu.toLowerCase() && tripKind(x) === 'rundreise' && x.stops.length) {
        if (!confirm(`Startort von „${old}“ auf „${neu}“ ändern?\n\nDie finale Route von „${x.name}“ beginnt dann neu. Die bisherige wird als Variante „Bisherige Route (ab ${old})“ gesichert – alle Varianten bleiben.`)) return false;
        restartFinalRoute(x.id, `Bisherige Route (ab ${old})`);
      }
    }
    return true;
  };
  const save = () => { if (!startOk()) return; saveTripSetup(trips, f); toast('Übernommen – überall angepasst'); onClose(); };
  const run = async (web) => {
    if (!startOk()) return;
    setBusy(web ? 'web' : 'quick'); setErr(null);
    try { await comparePrices(s, trips, f, { web }); saveTripSetup(trips, f); toast(web ? 'Preise gesucht und gespeichert' : 'Geschätzt und gespeichert'); onClose(); } catch (e) { setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!trips} title={title || 'Preise nachsehen'} onClose={onClose}>
      <TimeFields f={f} setF={setF} />
      <span className="label" style={{ padding: 0 }}>Wer reist von wo? ({f.travelers.reduce((n, x) => n + x.count, 0)} Personen)</span>
      {f.travelers.map((tv, i) => (
        <div key={i} className="traveler">
          <div className="start-field">
            <input className="input" value={tv.start} onChange={(e) => setT(i, { start: e.target.value })} placeholder="Startort, z.B. Frankfurt" aria-label="Startort" data-noclear="" />
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
        <button type="button" className="btn sec" style={{ flex: 1, background: 'var(--card-2)', color: 'var(--text)' }} onClick={save} disabled={!!busy || f.travelers.some((x) => !x.start.trim())}>Übernehmen</button>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={() => run(false)} disabled={!!busy || !getAi().apiKey || !nightsOf(f) || f.travelers.some((x) => !x.start.trim())}>{busy ? 'Schätze …' : 'Schnell schätzen'}</button>
      </div>
      <Info>Grobe Schätzung zum Vergleichen der Ziele (unter 1 Cent). Echte Preise zeigen die Links oben – kostenlos.</Info>
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {res && (
        <>
          {res.hinweis && <span className="sub">{res.hinweis}</span>}
          <div className="list">
            {(trips || []).map((x) => {
              const fresh = s.trips.find((y) => y.id === x.id) || x;
              return <div key={x.id} className="row" style={{ minHeight: 50 }}><span className="row-main"><span className="row-title strong">{x.name}</span><PriceRow p={fxPrices(fresh.prices)} /><DirectLinks s={s} tr={fresh} setup={f} /></span></div>;
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
  const p = fxPrices(tr.prices);
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
        {tr.status === 'idee' && tr.prices && <TotalChip p={fxPrices(tr.prices)} />}
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
          {grouping && <Info>Wähle Ideen für dieselbe Reise und gib der Gruppe einen Namen (oder den einer vorhandenen Gruppe). Jede Idee bleibt mit Orten und Routen erhalten.</Info>}
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
function Route({ s, tr }) {
  const [openSt, setOpenSt] = useState(null);
  const [legAB, setLegAB] = useState(null);
  const [tf, setTf] = useState({ from: '', to: '', mode: 'flug' });
  const stops = tr.stops;
  const startKey = JSON.stringify([stops[0]?.name, stops[stops.length - 1]?.name, tr.priceSetup?.travelers?.[0]?.start, tr.priceSetup?.travelers?.[0]?.mode, tr.from, tr.to]);
  useEffect(() => { syncAutoTransport(tr.id); }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const hin = tr.transport.find((x) => x.auto === 'hin');
  const rueck = tr.transport.find((x) => x.auto === 'rueck');
  // An-/Rückreise: nur Such-Link + die selbst gespeicherten Verbindungen (keine Platzhalter-Buchung)
  const autoLine = (x, label) => {
    if (!x) return null;
    const back = x.auto === 'rueck';
    const st = back ? stops[stops.length - 1] : stops[0];
    const own = tr.transport.filter((y) => !y.auto && (back ? y.from?.toLowerCase() === x.from.toLowerCase() && y.to?.toLowerCase() === x.to.toLowerCase() : y.to?.toLowerCase() === x.to.toLowerCase()));
    const booked = own.find((y) => y.status === 'gebucht');
    return (
      <div className="tl-auto">
        <button type="button" className="tl-main" style={{ flex: 1, minWidth: 0, padding: 0 }} onClick={() => setLegAB({ a: x.from, b: x.to, date: x.date })}>
          <span><b>{MODE_ICON[x.mode] || '➡️'} {label}:</b> {x.from} → {x.to}{x.date ? ` · ${fmtShort(x.date)}` : ''}</span>
          <span className="tiny">{booked ? `✓ gebucht: ${booked.note || MODES[booked.mode]}` : own.length ? `${own.length} gespeichert – antippen` : 'Noch nichts gespeichert – antippen zum Eintragen'}</span>
        </button>
        {x.url && <a className="pill" style={{ fontSize: 12 }} href={x.url} target="_blank" rel="noreferrer">{x.mode === 'flug' ? 'Flüge ↗' : 'Suchen ↗'}</a>}
      </div>
    );
  };
  const inTimeline = (x) => stops.some((st, i) => i < stops.length - 1 && x.from?.toLowerCase() === st.name.toLowerCase() && x.to?.toLowerCase() === stops[i + 1].name.toLowerCase());
  const H0 = tripHome(s, tr);
  const isEnd = (x) => stops.length && ((x.from?.toLowerCase() === H0.home.toLowerCase() && x.to?.toLowerCase() === stops[0].name.toLowerCase()) || (x.to?.toLowerCase() === H0.home.toLowerCase() && x.from?.toLowerCase() === stops[stops.length - 1].name.toLowerCase()));
  const other = tr.transport.filter((x) => !inTimeline(x) && !x.auto && !isEnd(x));
  return (
    <>
      <section className="card" style={{ gap: 6 }}>
        <span className="label" style={{ padding: 0 }}>{tripKind(tr) === 'ort' ? 'Ziel' : 'Finale Route'}</span>
        {autoLine(hin, 'Anreise')}
        <Timeline
          items={stops}
          name={(st) => st.name}
          meta={(st) => { const n = tr.places.filter((p) => p.stopId === st.id).length; const stay = tr.places.find((p) => p.stopId === st.id && p.kind === 'unterkunft' && p.status === 'fest'); return [(st.from && rangeText(st.from, st.to)) || (st.nights && `${st.nights} N.`), stay ? `🏠 ${stay.name}` : null, n && `${n} gespeichert`, st.note].filter(Boolean).join(' · ') || 'Antippen: Anreise, Unterkunft, Restaurants …'; }}
          leg={(i) => { const l = between(tr, stops[i].name, stops[i + 1].name).filter((x) => !x.auto); if (!l.length) return null; const b = l.find((x) => x.status === 'gebucht') || l[0]; return { icon: MODE_ICON[b.mode] || '➡️', text: [b.status === 'gebucht' ? '✓ gebucht' : `${l.length} Option${l.length > 1 ? 'en' : ''}`, b.dur, fxText(b.price)].filter(Boolean).join(' · ') }; }}
          onOpen={(i) => setOpenSt(stops[i].id)}
          onLeg={(i) => setLegAB({ a: stops[i].name, b: stops[i + 1].name })}
          onInsert={(name, at) => insertStop(tr.id, name, at)}
          onReorder={(a, b) => reorderStop(tr.id, a, b)}
          onRemove={(i) => { const st = stops[i]; const n = tr.places.filter((p) => p.stopId === st.id).length; if (!n || confirm(`„${st.name}“ entfernen? ${n} gesammelte Orte bleiben in der Reise erhalten.`)) removeStop(tr.id, st.id); }}
          addPlaceholder="Station hinzufügen, z.B. Garopaba"
        />
        {autoLine(rueck, 'Rückreise')}
        {openSt && stops.some((x) => x.id === openSt) && <StopSheet s={s} tr={tr} v={null} i={stops.findIndex((x) => x.id === openSt)} onClose={() => setOpenSt(null)} />}
        {(hin || rueck) && <Info>An- und Rückreise kommen aus dem Startort (✎ oben) und passen sich an, wenn sich die erste oder letzte Station ändert.</Info>}
        {!stops.length && tripKind(tr) !== 'ort' && <Info>Tipp: Unter „Varianten“ ganze Routen oder einzelne Orte hierher übernehmen.</Info>}
      </section>
      {other.length > 0 && (
        <section className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>Weitere Verbindungen</h2>
          <div className="list" style={{ padding: '0 16px' }}>{other.map((x) => <TransportRow key={x.id} tr={tr} x={x} />)}</div>
        </section>
      )}
      {legAB && <LegSheet s={s} tr={tr} v={null} a={legAB.a} b={legAB.b} date={legAB.date} onClose={() => setLegAB(null)} />}
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
      <Info>Vorschläge und Vergleich: unten im KI-Chat („Vergleich meine Orte“).</Info>
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
function Timeline({ items, name, meta, leg, renderDetail, renderLeg, onLeg, onInsert, onOpen, onRemove, onReorder, addPlaceholder = 'Ort hinzufügen, z.B. Garopaba' }) {
  const [openStop, setOpenStop] = useState(null);
  const [openLeg, setOpenLeg] = useState(null);
  const [insertAt, setInsertAt] = useState(null);
  const [text, setText] = useState('');
  // v0.79: gedrückt halten → ziehen; Orte rücken live zur Seite
  const [drag, setDrag] = useState(null); // { from, cur, y }
  const dragRef = useRef(null);
  const slots = useRef(null);
  const nodes = useRef([]);
  const lastTouch = useRef(0);
  const blockClick = useRef(false);
  const n = items.length;
  const order = drag ? (() => { const o = items.map((_, j) => j); o.splice(drag.from, 1); o.splice(drag.cur, 0, drag.from); return o; })() : null;
  useLayoutEffect(() => {
    if (drag && !slots.current) { const mids = items.map((_, k) => { const r = nodes.current[k]?.getBoundingClientRect(); return r ? r.top + r.height / 2 : 0; }); slots.current = { mids, off: drag.y0 - mids[drag.from] }; }
  });
  const slotAt = (y, cur) => { const sl = slots.current; if (!sl) return cur; const vy = y - sl.off; let k = 0, best = Infinity; sl.mids.forEach((m, j) => { const d = Math.abs(m - vy); if (d < best) { best = d; k = j; } }); return k; };
  // v0.80: Griff oben in der Mitte – sofort ziehen, Seite scrollt dabei nicht (touch-action: none)
  const press = (e, i) => {
    if (!onReorder || n < 2) return;
    if (e.type === 'mousedown') { if (Date.now() - lastTouch.current < 800 || e.button !== 0) return; } else lastTouch.current = Date.now();
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const pt = e.touches ? e.touches[0] : e;
    const set = (d) => { dragRef.current = d; setDrag(d); };
    const move = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const q = ev.touches ? ev.touches[0] : ev;
      const d = dragRef.current; if (d) { if (Math.abs(q.clientY - d.y0) > 6) d.moved = true; set({ ...d, y: q.clientY, cur: slotAt(q.clientY, d.cur) }); }
    };
    const end = () => {
      window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end);
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end);
      const d = dragRef.current;
      if (d?.moved) { blockClick.current = true; setTimeout(() => { blockClick.current = false; }, 300); }
      if (d) { set(null); slots.current = null; if (d.cur !== d.from) onReorder(d.from, d.cur); }
    };
    slots.current = null; setOpenStop(null); setOpenLeg(null); setInsertAt(null);
    try { navigator.vibrate?.(10); } catch {}
    set({ from: i, cur: i, y: pt.clientY, y0: pt.clientY });
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  };
  const tap = (i) => { if (blockClick.current) return; if (onOpen) onOpen(i); else setOpenStop(openStop === i ? null : i); };
  const add = (at) => { onInsert(text, at); setText(''); setInsertAt(null); };
  const insertForm = (at) => (
    <form className="tl-detail" onSubmit={(e) => { e.preventDefault(); add(at); }}>
      <div className="block-add">
        <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={addPlaceholder} aria-label="Ort einfügen" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </div>
    </form>
  );
  const node = (x, i, k) => {
    const lifted = drag && drag.from === i;
    const st = lifted && slots.current ? { transform: `translateY(${drag.y - slots.current.off - slots.current.mids[k]}px) scale(1.02)`, background: 'var(--card)', boxShadow: '0 8px 24px rgba(0,0,0,.2)', borderRadius: 12, position: 'relative', zIndex: 5 } : undefined;
    return (
      <div className={['tl-node', drag && 'dragging', onReorder && n > 1 && 'has-grab'].filter(Boolean).join(' ')} ref={(el) => { nodes.current[k] = el; }} style={st}>
        {onReorder && n > 1 && <span className="tl-grab" role="button" aria-label={`${name(x)} verschieben`} onTouchStart={(e) => press(e, i)} onMouseDown={(e) => press(e, i)} onContextMenu={(e) => e.preventDefault()}><i /></span>}
        <button type="button" className="tl-dot" onClick={() => tap(i)} aria-label={`${name(x)} öffnen`}>{drag ? k + 1 : i + 1}</button>
        <button type="button" className="tl-main" onClick={() => tap(i)}>
          <span style={{ fontWeight: 650, fontSize: 15.5 }}>{name(x)}</span>
          {meta(x, i) && <span className="tiny">{meta(x, i)}</span>}
        </button>
        {onRemove && <button type="button" className="tl-x" style={drag ? { visibility: 'hidden' } : undefined} onClick={() => { onRemove(i); setOpenStop(null); setOpenLeg(null); }} aria-label={`${name(x)} entfernen`}>✕</button>}
        {onOpen ? <button type="button" className="x-btn" onClick={() => tap(i)} aria-label={`${name(x)} Details`}><Chevron /></button> : <span className="tiny">{openStop === i ? '▴' : '▾'}</span>}
      </div>
    );
  };
  return (
    <div className="tl">
      {n === 0 && <span className="tiny" style={{ padding: '4px 0' }}>Noch keine Orte – unten den ersten hinzufügen.</span>}
      {(order || items.map((_, j) => j)).map((i, k) => {
        const x = items[i];
        const l = i < n - 1 ? leg(i) : null;
        const hide = drag ? { visibility: 'hidden' } : undefined;
        return (
          <Fragment key={i + name(x)}>
            {node(x, i, k)}
            {!drag && !onOpen && openStop === i && <div className={i < n - 1 ? 'tl-detail line' : 'tl-detail'}>{renderDetail(x, i)}</div>}
            {i < n - 1 && (
              <div className="tl-link" style={hide}>
                <button type="button" className="tl-leg" onClick={() => (onLeg ? onLeg(i) : setOpenLeg(openLeg === i ? null : i))}>{l ? `${l.icon} ${l.text}` : '＋ Transport'}</button>
              </div>
            )}
            {!drag && !onLeg && i < n - 1 && openLeg === i && <div className="tl-detail line">{renderLeg(i)}</div>}
            {!drag && i < n - 1 && insertAt === i + 1 && insertForm(i + 1)}
          </Fragment>
        );
      })}
      {<form className="tl-node" style={drag ? { visibility: 'hidden' } : undefined} onSubmit={(e) => { e.preventDefault(); if (insertAt === null || insertAt >= n) add(n); }}>
        <span className="tl-dot add">＋</span>
        <input className="input" value={insertAt === null || insertAt >= n ? text : ''} onFocus={() => setInsertAt(null)} onChange={(e) => setText(e.target.value)} placeholder={addPlaceholder} aria-label="Ort am Ende hinzufügen" />
        <button type="submit" className="btn small" disabled={!text.trim() || (insertAt !== null && insertAt < n)}>+</button>
      </form>}
      {onReorder && n > 1 && <Info>Ort antippen = Anreise, Unterkünfte, Restaurants … planen. Reihenfolge: am Griff ━ oben ziehen.</Info>}
    </div>
  );
}

const ITEM_KINDS = { unterkunft: '🏠', essen: '🍽', sehen: '👀', tun: '🎯' };
const PLACE_ICON = { unterkunft: '🏠', restaurant: '🍽', sehenswuerdigkeit: '👀', aktivitaet: '🎯', sonstiges: '•' };
const ITEM_LABEL = { unterkunft: 'Unterkunft', essen: 'Essen', sehen: 'Sehen', tun: 'Ausflug' };
function Nights({ value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="pill" onClick={() => onChange(Math.max(0, (value || 0) - 1) || null)} aria-label="Eine Nacht weniger">−</button>
      <b style={{ minWidth: 60, textAlign: 'center' }}>{value ? `${value} ${value === 1 ? 'Nacht' : 'Nächte'}` : 'Nächte?'}</b>
      <button type="button" className="pill" onClick={() => onChange((value || 0) + 1)} aria-label="Eine Nacht mehr">+</button>
    </span>
  );
}
// v0.79: Ort-Seite – alles für einen Ort an einer Stelle (Variante und finale Route)
const SECS = [
  { key: 'anreise', icon: '✈️', label: 'Anreise', ph: 'Gefundenen Flug eintragen, z.B. LATAM 14:05, direkt', pick: ['Option', '✓ Gebucht'] },
  { key: 'rueck', icon: '🛫', label: 'Rückreise', ph: 'Gefundenen Rückflug eintragen, z.B. LATAM 22:10', pick: ['Option', '✓ Gebucht'] },
  { key: 'unterkunft', icon: '🏠', label: 'Unterkünfte', place: 'unterkunft', ph: 'Name oder Link einfügen', pick: ['Option', '✓ Gebucht'] },
  { key: 'sehen', icon: '👀', label: 'Sehenswürdigkeiten', place: 'sehenswuerdigkeit', ph: 'z.B. Verbotene Stadt', pick: ['Vielleicht', '✓ Fest'], reserve: true, out: true },
  { key: 'essen', icon: '🍽', label: 'Restaurants', place: 'restaurant', ph: 'z.B. Din Tai Fung', pick: ['Vielleicht', '✓ Fest'], reserve: true, out: true },
  { key: 'tun', icon: '🚐', label: 'Tagesausflüge & Aktivitäten', place: 'aktivitaet', ph: 'z.B. Große Mauer Mutianyu', pick: ['Vielleicht', '✓ Fest'], reserve: true, out: true },
];
const PLACE_SEC = { unterkunft: 'unterkunft', sehenswuerdigkeit: 'sehen', restaurant: 'essen', aktivitaet: 'tun', sonstiges: 'tun' };
const itemSec = (it) => (it.kind === 'anreise' || it.kind === 'rueck' ? it.kind : ITEM_LABEL[it.kind] ? it.kind : 'sehen');
const fromLink = (text, url) => { const t0 = text.trim(); if (/^https?:\/\//.test(t0) && !url.trim()) { let h = t0; try { h = new URL(t0).hostname.replace(/^www\./, ''); } catch {} return { text: h, url: t0 }; } return { text: t0, url: url.trim() }; };
const nightsBetween = (a, b) => (a && b ? Math.max(0, diffDays(a, b)) : null);

function stopApi(tr, v, i) {
  if (v) {
    const x = v.stops[i];
    const items = x.items || [];
    return {
      list: (key) => items.filter((it) => itemSec(it) === key).map((it) => ({ ...it })),
      add: (key, d) => addVariantItem(tr.id, v.id, i, d.text, key, d.url, { price: d.price || '' }),
      upd: (id, patch) => updateVariantItem(tr.id, v.id, i, id, patch),
      del: (id) => removeVariantItem(tr.id, v.id, i, id),
    };
  }
  const st = tr.stops[i];
  const home = (tr.priceSetup?.travelers?.[0]?.start || 'Buenos Aires').replace(/\s*\(.*?\)/g, '').split(',')[0].trim();
  const prev = i > 0 ? tr.stops[i - 1].name : (tr.priceSetup?.travelers?.[0]?.start || 'Buenos Aires').replace(/\s*\(.*?\)/g, '').split(',')[0].trim();
  return {
    list: (key) => key === 'anreise'
      ? tr.transport.filter((x) => !x.auto && x.to?.toLowerCase() === st.name.toLowerCase()).map((x) => ({ id: x.id, text: (!x.auto && x.note) || `${MODES[x.mode] || 'Transport'} ${x.from} → ${x.to}`, sub: x.auto === 'rueck' ? `${MODE_ICON[x.mode] || '➡️'} Rückreise · automatisch` : `${MODE_ICON[x.mode] || '➡️'} ab ${x.from}${x.auto ? ' · automatisch' : ''}`, url: x.url, price: x.price, picked: x.status === 'gebucht', auto: x.auto }))
      : key === 'rueck' ? tr.transport.filter((x) => !x.auto && x.from?.toLowerCase() === st.name.toLowerCase() && x.to?.toLowerCase() === home.toLowerCase()).map((x) => ({ id: x.id, text: x.note || `${MODES[x.mode] || 'Transport'} ${x.from} → ${x.to}`, sub: `${MODE_ICON[x.mode] || '➡️'} nach ${x.to}`, url: x.url, price: x.price, picked: x.status === 'gebucht' }))
      : tr.places.filter((p) => p.stopId === st.id && (PLACE_SEC[p.kind] || 'tun') === key).map((p) => ({ id: p.id, text: p.name, url: p.url, price: p.price, note: p.note, reserve: p.reserve, picked: p.status === 'fest' })),
    add: (key, d) => {
      if (key === 'rueck') { addEntry(tr.id, 'transport', { from: st.name, to: home, mode: (tr.priceSetup?.travelers?.[0]?.mode || 'flug'), date: tr.to || '', time: '', note: d.text, price: d.price || '', url: /^https?:\/\//.test(d.url) ? d.url : '', status: 'option' }); return; }
      if (key === 'anreise') { const mode = i === 0 && (tr.priceSetup?.travelers?.[0]?.mode || 'flug') === 'flug' ? 'flug' : 'bus'; addEntry(tr.id, 'transport', { from: prev, to: st.name, mode, date: '', time: '', note: d.text, price: d.price || '', url: /^https?:\/\//.test(d.url) ? d.url : '', status: 'option' }); return; }
      const id = addEntry(tr.id, 'places', { name: d.text, kind: SECS.find((s0) => s0.key === key).place, stopId: st.id, note: '', address: '', url: /^https?:\/\//.test(d.url) ? d.url : '', price: d.price || '', reserve: false, status: 'option' });
      locateEntry(tr.id, 'places', id);
    },
    upd: (id, patch) => {
      const isT = tr.transport.some((x) => x.id === id);
      const p = {};
      if (patch.text !== undefined) p[isT ? 'note' : 'name'] = patch.text;
      if (patch.picked !== undefined) p.status = patch.picked ? (isT ? 'gebucht' : 'fest') : 'option';
      for (const k of ['url', 'price', 'note', 'reserve']) if (patch[k] !== undefined) p[k] = patch[k];
      updateEntry(tr.id, isT ? 'transport' : 'places', id, p);
    },
    del: (id) => removeEntry(tr.id, tr.transport.some((x) => x.id === id) ? 'transport' : 'places', id),
  };
}

function StopItem({ e, sec, api, tr, city, links }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stop-item">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" className="tl-main" style={{ flex: 1, minWidth: 0 }} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span style={{ fontSize: 14.5, fontWeight: e.picked ? 650 : 500 }}>{e.text}</span>
          {(e.sub || e.price || e.reserve || e.note) && <span className="tiny">{[e.sub, fxText(e.price), e.reserve && '🎟 reservieren', !open && e.note].filter(Boolean).join(' · ')}</span>}
        </button>
        {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={14} color="var(--accent)" /></a>}
        <button type="button" className={e.picked ? 'pill on' : 'pill'} style={{ fontSize: 12, padding: '4px 9px', flexShrink: 0 }} onClick={() => api.upd(e.id, { picked: !e.picked })}>{e.picked ? sec.pick[1] : sec.pick[0]}</button>
      </div>
      {open && (
        <div className="stop-item-edit">
          <input className="input" defaultValue={e.text} key={e.id + 't' + e.text} onBlur={(ev) => ev.target.value.trim() && ev.target.value !== e.text && api.upd(e.id, { text: ev.target.value.trim() })} aria-label="Name" />
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" style={{ flex: '0 0 34%' }} defaultValue={e.price || ''} key={e.id + 'p' + (e.price || '')} placeholder="Preis" onBlur={(ev) => ev.target.value !== (e.price || '') && api.upd(e.id, { price: ev.target.value })} aria-label="Preis" />
            <input className="input" defaultValue={e.url || ''} key={e.id + 'u' + (e.url || '')} placeholder="Link" inputMode="url" onBlur={(ev) => ev.target.value !== (e.url || '') && api.upd(e.id, { url: ev.target.value.trim() })} aria-label="Link" />
          </div>
          {sec.key !== 'anreise' && <input className="input" defaultValue={e.note || ''} key={e.id + 'n' + (e.note || '')} placeholder="Notiz, z.B. Lage, Öffnungszeiten, Tipp" onBlur={(ev) => ev.target.value !== (e.note || '') && api.upd(e.id, { note: ev.target.value })} aria-label="Notiz" />}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {sec.reserve && <button type="button" className={e.reserve ? 'pill on' : 'pill'} style={{ fontSize: 12 }} onClick={() => api.upd(e.id, { reserve: !e.reserve })}>🎟 Reservierung nötig</button>}
            {sec.reserve && <a className="pill" style={{ fontSize: 12 }} href={links.reserve(e.text)} target="_blank" rel="noreferrer">Tickets/Reservierung prüfen ↗</a>}
            {sec.out && <button type="button" className="pill" style={{ fontSize: 12 }} onClick={() => toast(toOutings(e.text, SECS.find((s0) => s0.key === sec.key).place === 'restaurant' ? 'essen' : sec.key, city, { url: e.url, note: [e.note, `Von der Reise „${tr.name}“`].filter(Boolean).join(' · ') }) ? `In Ausgehen → Orte (${city}) gespeichert` : 'Ist schon in Ausgehen')}>→ Ausgehen</button>}
            <span style={{ flex: 1 }} />
            {!e.auto && <button type="button" className="pill" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={() => api.del(e.id)}>Entfernen</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function StopSection({ sec, api, tr, city, links, extraLinks, hint, allOpen }) {
  const list = api.list(sec.key);
  const [open, setOpen] = useState(allOpen || list.length > 0 || sec.key === 'anreise' || sec.key === 'unterkunft');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  return (
    <section className="stop-sec">
      <button type="button" className="stop-sec-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{sec.icon} {sec.label}</span>
        <span className="tiny">{list.length ? `${list.length} gespeichert` : ''} {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          {hint && <span className="tiny">{hint}</span>}
          {extraLinks?.length > 0 && <div className="link-chips" style={{ marginTop: 0 }}>{extraLinks.map((l) => <a key={l.url} className="link-chip" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>}
          {list.map((e) => <StopItem key={e.id} e={e} sec={sec} api={api} tr={tr} city={city} links={links} />)}
          <form className="block-add" onSubmit={(ev) => { ev.preventDefault(); const d = fromLink(text, url); if (!d.text) return; api.add(sec.key, d); setText(''); setUrl(''); }}>
            <input className="input" value={text} onChange={(ev) => setText(ev.target.value)} placeholder={sec.ph} aria-label={`${sec.label} speichern`} />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
          {text.trim() && !/^https?:/.test(text.trim()) && <input className="input" value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="Link (optional)" inputMode="url" aria-label="Link" />}
        </>
      )}
    </section>
  );
}

function StopBody({ s, tr, v, i, inline, only, ort, onClose }) {
  useEffect(() => { if (i === 0 && getAi().apiKey) { const nm = v ? v.stops[0]?.name : tr.stops[0]?.name; if (nm) ensureIataCodes(s, [tr.priceSetup?.travelers?.[0]?.start || 'Buenos Aires', nm]).catch(() => {}); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const x = v ? v.stops[i] : tr.stops[i];
  if (!x) return null;
  const api = stopApi(tr, v, i);
  const pv = v || { stops: tr.stops.map((y) => ({ name: y.name, nights: nightsBetween(y.from, y.to) })) };
  const one = ort || (!v && tr.stops.length === 1);
  const L = stopLinks(s, tr, pv, i, v ? null : { checkin: x.from || (one ? tr.from : ''), checkout: x.to || (one ? tr.to : '') });
  const links = spotLinks(tr, x.name);
  const inFinal = v && tr.stops.some((y) => y.name.toLowerCase() === x.name.toLowerCase());
  const total = v ? v.stops.length : tr.stops.length;
  const take = () => { const sug = suggestPosition(tr, v, i); appendFromVariant(tr.id, v.id, [i], sug.at); toast(`${x.name} ist jetzt Station ${Math.min(sug.at, tr.stops.length) + 1} der finalen Route – dort per Ziehen verschiebbar`); };
  const stayHint = `${L.people} ${L.people === 1 ? 'Person' : 'Personen'} · ${L.type} · ${L.level}${L.checkin ? ` · ${fmtShort(L.checkin)}–${fmtShort(L.checkout)}` : ' · ohne Datum'}`;
  const secProps = (k) => ({ allOpen: inline || !!only, sec: SECS.find((s0) => s0.key === k), api, tr, city: x.name, links });
  const SECX = {
    anreise: <StopSection key="anreise" {...secProps('anreise')} extraLinks={L.travel} hint={`ab ${L.prev} – Verbindungen ansehen, gute Optionen hier speichern`} />,
    unterkunft: <StopSection key="unterkunft" {...secProps('unterkunft')} extraLinks={L.stay} hint={`${stayHint} – ändern über „✎“ oben bei der Reise. Inserate hier mit Link speichern und vergleichen.`} />,
    sehen: <StopSection key="sehen" {...secProps('sehen')} extraLinks={links.sehen} />,
    essen: <StopSection key="essen" {...secProps('essen')} extraLinks={links.essen} />,
    tun: <StopSection key="tun" {...secProps('tun')} extraLinks={links.tun} />,
  };
  const isLast = v ? i === v.stops.length - 1 : (ort || i === tr.stops.length - 1);
  const H = tripHome(s, tr);
  const backDate = v ? (L.checkout || tr.to || '') : (x.to || (one ? tr.to : '') || '');
  const backLinks = H.mode === 'flug' ? [{ label: `✈️ Rückflug ${x.name} → ${H.home} (Skyscanner)`, url: skyUrl(s, x.name, H.home, backDate, '', L.people) }, { label: '🧭 Rome2rio', url: rome2rio(x.name, H.home) }] : [{ label: `🧭 ${x.name} → ${H.home} (Rome2rio)`, url: rome2rio(x.name, H.home) }];
  SECX.rueck = isLast ? <StopSection key="rueck" {...secProps('rueck')} extraLinks={backLinks} hint={`zurück nach ${H.home} – Verbindungen ansehen, gute Optionen hier speichern`} /> : null;
  if (only === 'anreise') return <>{SECX.anreise}{SECX.rueck}</>;
  if (only) return SECX[only] || null;
  return (
    <>
      {inline && <h2 style={{ margin: 0, fontSize: 20 }}>📍 {x.name}</h2>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {v ? <Nights value={x.nights} onChange={(nv) => updateVariantStop(tr.id, v.id, i, { nights: nv })} /> : <div style={{ flex: 1, minWidth: 200 }}>{inline && one ? <DateRangeField from={tr.from} to={tr.to} onChange={(val) => updateTrip(tr.id, val)} title="Reisezeitraum" placeholder="Wann bist du dort?" /> : <DateRangeField from={x.from} to={x.to} onChange={(val) => updateEntry(tr.id, 'stops', x.id, val)} placeholder="Wann bist du dort?" />}</div>}
        {!inline && <span className="tiny">{v ? `${v.name} · ` : ''}Ort {i + 1} von {total}{inFinal ? ' · ✓ in finaler Route' : ''}</span>}
      </div>
      {x.tip && <span className="tiny" style={{ color: 'var(--text)' }}>💡 {x.tip}</span>}
      {['anreise', 'unterkunft', 'sehen', 'essen', 'tun', 'rueck'].map((k) => SECX[k])}
      <section className="stop-sec">
        <span className="stop-sec-head" style={{ cursor: 'default' }}><span>📝 Notizen</span></span>
        <textarea className="input" rows={3} defaultValue={x.note || ''} key={(v ? v.id : 'f') + i + 'n' + (x.note || '')} placeholder="z.B. Viertel zum Wohnen, Wetter, was man nicht verpassen darf" onBlur={(e) => e.target.value !== (x.note || '') && (v ? updateVariantStop(tr.id, v.id, i, { note: e.target.value }) : updateEntry(tr.id, 'stops', x.id, { note: e.target.value }))} aria-label="Notiz" />
      </section>
      {v && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {!inFinal && <button type="button" className="btn small" onClick={take}>→ In die finale Route</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => { removeVariantStop(tr.id, v.id, i); onClose(); }}>Aus Variante entfernen</button>
        </div>
      )}
      {v && !inFinal && <Info>Alles Gespeicherte (Anreise, Unterkünfte, Orte mit Links) kommt mit in die finale Route.</Info>}
    </>
  );
}
function StopSheet({ s, tr, v, i, onClose }) {
  const x = v ? v.stops[i] : tr.stops[i];
  if (!x) return <Sheet open={false} onClose={onClose} />;
  return <Sheet open title={x.name} onClose={onClose}><StopBody s={s} tr={tr} v={v} i={i} onClose={onClose} /></Sheet>;
}
// v0.82: Reise „An einem Ort“ – erst die Stadt, dann Kategorien als Reiter (Anreise, Unterkünfte, Sehenswürdigkeiten, Restaurants, Ausflüge)
const COUNTRIES = 'afghanistan ägypten albanien algerien andorra angola argentinien armenien aserbaidschan äthiopien australien bahamas bangladesch belgien belize benin bhutan bolivien bosnien botswana brasilien bulgarien chile china costa rica dänemark deutschland dominikanische republik ecuador el salvador elfenbeinküste england estland fidschi finnland frankreich georgien ghana griechenland großbritannien guatemala honduras indien indonesien irak iran irland island israel italien jamaika japan jemen jordanien kambodscha kamerun kanada kap verde kasachstan katar kenia kirgisistan kolumbien kongo korea südkorea nordkorea kosovo kroatien kuba laos lettland libanon libyen litauen luxemburg madagaskar malawi malaysia malediven mali malta marokko mauritius mexiko moldau monaco mongolei montenegro mosambik myanmar namibia nepal neuseeland nicaragua niederlande holland nigeria nordmazedonien norwegen oman österreich pakistan panama paraguay peru philippinen polen portugal ruanda rumänien russland sambia saudi-arabien schottland schweden schweiz senegal serbien seychellen simbabwe singapur slowakei slowenien somalia spanien sri lanka südafrika sudan surinam syrien tadschikistan taiwan tansania thailand togo tschechien tunesien türkei turkmenistan uganda ukraine ungarn uruguay usa vereinigte staaten amerika usbekistan vanuatu venezuela vereinigte arabische emirate vae vietnam wales weißrussland belarus zypern brasil españa espagne spain france italy italia germany alemania japón japan china méxico mexico united states uk united kingdom portugal grecia greece thailand tailandia india marruecos morocco colombia perú peru'.split(' ');
const COUNTRY_SET = new Set([...COUNTRIES, 'costa rica', 'el salvador', 'sri lanka', 'kap verde', 'dominikanische republik', 'saudi-arabien', 'vereinigte staaten', 'vereinigte arabische emirate', 'united states', 'united kingdom', 'south korea', 'new zealand', 'nueva zelanda', 'estados unidos', 'reino unido', 'südost-asien', 'südostasien', 'europa', 'asien', 'afrika', 'südamerika', 'patagonien', 'patagonia', 'karibik']);
const isCountry = (name) => COUNTRY_SET.has(String(name || '').toLowerCase().replace(/\s*\(.*?\)/g, '').trim());
export function ortStopOf(tr) {
  const byId = tr.ortStopId && tr.stops.find((x) => x.id === tr.ortStopId);
  if (byId) return isCountry(byId.name) ? null : byId;
  return tr.stops.length === 1 && !isCountry(tr.stops[0].name) ? tr.stops[0] : null;
}
function OrtCitySetup({ tr }) {
  const guess = tr.dest && !isCountry(tr.dest) && !tr.stops.length ? tr.dest : '';
  const [city, setCity] = useState(guess);
  const land = isCountry(tr.dest) ? tr.dest : (tr.stops[0] && isCountry(tr.stops[0].name) ? tr.stops[0].name : '');
  const save = (name, existingId) => {
    const n = String(name || '').trim(); if (!n) return;
    let id = existingId;
    if (!id) {
      const countryStop = tr.stops.find((x) => isCountry(x.name));
      if (countryStop && tr.stops.length === 1) { updateEntry(tr.id, 'stops', countryStop.id, { name: n }); id = countryStop.id; }
      else id = insertStop(tr.id, n, 0);
    }
    updateTrip(tr.id, { ortStopId: id, dest: land ? `${n}, ${land}` : n });
  };
  const routeStops = tr.stops.filter((x) => !isCountry(x.name));
  return (
    <section className="card" style={{ gap: 8 }}>
      <span style={{ fontWeight: 650, fontSize: 16 }}>📍 Stadt muss noch festgelegt werden</span>
      <span className="tiny">{land ? `„${land}“ ist ein Land oder eine Region. ` : ''}In welcher Stadt bzw. an welchem Ort bist du? Danach erscheinen Anreise, Unterkünfte, Sehenswürdigkeiten, Restaurants und Ausflüge.</span>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); save(city); }}>
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={land ? `Stadt in ${land}, z.B. Shanghai` : 'z.B. Florianópolis'} aria-label="Stadt" autoFocus={!guess} />
        <button type="submit" className="btn small" disabled={!city.trim()}>Festlegen</button>
      </form>
      {routeStops.length > 1 && <><span className="tiny">Oder einen Ort aus deiner Rundreise nehmen:</span><div className="chips">{routeStops.map((x) => <button key={x.id} type="button" className="chip soft" onClick={() => save(x.name, x.id)}>{x.name}</button>)}</div></>}
    </section>
  );
}
function OrtHead({ tr, st }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(st.name);
  const startKey = JSON.stringify([st.name, tr.priceSetup?.travelers?.[0]?.start, tr.priceSetup?.travelers?.[0]?.mode, tr.from, tr.to]);
  useEffect(() => { syncAutoTransport(tr.id); }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card" style={{ gap: 8 }}>
      {edit ? (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (!val.trim()) return; updateEntry(tr.id, 'stops', st.id, { name: val.trim() }); setEdit(false); }}>
          <input className="input" autoFocus value={val} onChange={(e) => setVal(e.target.value)} aria-label="Stadt ändern" />
          <button type="submit" className="btn small">OK</button>
        </form>
      ) : (
        <button type="button" className="tl-main" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onClick={() => { setVal(st.name); setEdit(true); }} aria-label="Stadt ändern">
          <span style={{ fontWeight: 700, fontSize: 20 }}>📍 {st.name}</span><span className="tiny">✎</span>
        </button>
      )}
      <DateRangeField from={tr.from} to={tr.to} onChange={(val2) => setTripDates(tr.id, val2)} title="Reisezeitraum" placeholder="Wann bist du dort?" />
    </section>
  );
}
const VariantStopSheet = (props) => <StopSheet {...props} />;
// v0.85: Strecke antippen = eigene Seite mit mehreren gespeicherten Verbindungen (Link oder Beschreibung, Preis, Dauer)
function legApi(tr, v, a, b) {
  const same = (x, y) => String(x || '').toLowerCase() === String(y || '').toLowerCase();
  if (v) return {
    list: () => legsOf(v.legs, a, b).map((l) => ({ id: l.id, text: l.text || [MODES[l.mode], l.note].filter(Boolean).join(' · ') || 'Verbindung', mode: l.mode, dur: l.dur, price: l.price, url: l.url, picked: !!l.picked, est: !!l.est })),
    add: (d) => addVariantLeg(tr.id, v.id, { from: a, to: b, ...d }),
    upd: (id, p) => updateVariantLeg(tr.id, v.id, id, { ...p, ...(p.text !== undefined ? { est: false } : {}) }),
    del: (id) => removeVariantLeg(tr.id, v.id, id),
  };
  return {
    list: () => tr.transport.filter((x) => !x.auto && same(x.from, a) && same(x.to, b)).map((x) => ({ id: x.id, text: x.note || MODES[x.mode] || 'Verbindung', mode: x.mode, dur: x.dur, price: x.price, url: x.url, picked: x.status === 'gebucht' })),
    add: (d) => addEntry(tr.id, 'transport', { from: a, to: b, mode: d.mode, date: '', time: '', note: d.text, dur: d.dur || '', price: d.price || '', url: d.url || '', status: 'option' }),
    upd: (id, p) => { const q = { ...p }; if (p.text !== undefined) { q.note = p.text; delete q.text; } if (p.picked !== undefined) { q.status = p.picked ? 'gebucht' : 'option'; delete q.picked; } updateEntry(tr.id, 'transport', id, q); },
    del: (id) => removeEntry(tr.id, 'transport', id),
  };
}
function LegItem({ e, api }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stop-item">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" className="tl-main" style={{ flex: 1, minWidth: 0 }} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span style={{ fontSize: 14.5, fontWeight: e.picked ? 650 : 500 }}>{MODE_ICON[e.mode] || '➡️'} {e.text}</span>
          {(e.dur || e.price) && <span className="tiny">{[e.dur, fxText(e.price)].filter(Boolean).join(' · ')}</span>}
        </button>
        {e.url && <a className="x-btn" href={e.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={14} color="var(--accent)" /></a>}
        <button type="button" className={e.picked ? 'pill on' : 'pill'} style={{ fontSize: 12, padding: '4px 9px', flexShrink: 0 }} onClick={() => api.upd(e.id, { picked: !e.picked })}>{e.picked ? '✓ Gebucht' : 'Option'}</button>
      </div>
      {open && (
        <div className="stop-item-edit">
          <input className="input" defaultValue={e.text} key={e.id + 't' + e.text} onBlur={(ev) => ev.target.value.trim() && ev.target.value !== e.text && api.upd(e.id, { text: ev.target.value.trim() })} aria-label="Beschreibung" />
          <div className="chips">{Object.entries(MODES).map(([k, l]) => <button key={k} type="button" className={e.mode === k ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => api.upd(e.id, { mode: k })}>{MODE_ICON[k]} {l}</button>)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" defaultValue={e.dur || ''} key={e.id + 'd' + (e.dur || '')} placeholder="Dauer" onBlur={(ev) => ev.target.value !== (e.dur || '') && api.upd(e.id, { dur: ev.target.value })} aria-label="Dauer" />
            <input className="input" defaultValue={e.price || ''} key={e.id + 'p' + (e.price || '')} placeholder="Preis" onBlur={(ev) => ev.target.value !== (e.price || '') && api.upd(e.id, { price: ev.target.value })} aria-label="Preis" />
          </div>
          <input className="input" defaultValue={e.url || ''} key={e.id + 'u' + (e.url || '')} placeholder="Link" inputMode="url" onBlur={(ev) => ev.target.value !== (e.url || '') && api.upd(e.id, { url: ev.target.value.trim() })} aria-label="Link" />
          <button type="button" className="pill" style={{ fontSize: 12, color: 'var(--danger)', alignSelf: 'flex-end' }} onClick={() => api.del(e.id)}>Entfernen</button>
        </div>
      )}
    </div>
  );
}
function LegSheet({ s, tr, v, a, b, date, onClose }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState(() => (tripHome(s, tr).home.toLowerCase() === String(a).toLowerCase() || tripHome(s, tr).home.toLowerCase() === String(b).toLowerCase() ? tripHome(s, tr).mode : 'bus'));
  const api = legApi(tr, v, a, b);
  const list = api.list();
  const links = [
    { label: '✈️ Flüge (Skyscanner)', url: legUrl(s, tr, a, b, 'flug', date || '') },
    { label: '🧭 Alle Verbindungen (Rome2rio)', url: rome2rio(a, b) },
    { label: '🗺 Google Maps', url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}&travelmode=transit` },
  ];
  const add = (ev) => {
    ev.preventDefault();
    const d = fromLink(text, '');
    if (!d.text) return;
    const p = parseLegText(text);
    api.add({ text: d.text, url: d.url, mode, dur: p.dur, price: p.price });
    setText('');
  };
  return (
    <Sheet open title={`${a} → ${b}`} onClose={onClose}>
      <Info>Verbindungen ansehen und gute Optionen hier speichern – als Link oder Beschreibung (Preis und Dauer werden erkannt, z.B. „Zug G87, 4,5 h, 60 €“).</Info>
      <div className="link-chips" style={{ marginTop: 0 }}>{links.map((l) => <a key={l.url} className="link-chip" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
      <section className="stop-sec">
        <span className="stop-sec-head" style={{ cursor: 'default' }}><span>Gespeicherte Verbindungen</span><span className="tiny">{list.length || ''}</span></span>
        {list.length === 0 && <span className="tiny">Noch keine. Unten einen Link oder eine Beschreibung einfügen.</span>}
        {list.map((e) => <LegItem key={e.id} e={e} api={api} />)}
        <div className="chips">{Object.entries(MODES).map(([k, l]) => <button key={k} type="button" className={mode === k ? 'chip on' : 'chip soft'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => setMode(k)}>{MODE_ICON[k]} {l}</button>)}</div>
        <form className="block-add" onSubmit={add}>
          <input className="input" value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Link oder z.B. „Bus 13:00, 3 h, 25 €“" aria-label="Verbindung speichern" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      </section>
    </Sheet>
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
const legChip = (l, n = 1) => (l ? { icon: MODE_ICON[l.mode] || '➡️', text: [l.picked ? '✓ gebucht' : n > 1 ? `${n} Optionen` : '', l.dur, fxText(l.price)].filter(Boolean).join(' · ') || MODES[l.mode] || 'Transport' } : null);

function VariantCard({ s, tr, v, vi, isIdea, onChosen, onCommit }) {
  const [busy, setBusy] = useState(null);
  const [legAB, setLegAB] = useState(null);
  const [wish, setWish] = useState('');
  const [openI, setOpenI] = useState(null);
  const nights = v.stops.reduce((n, x) => n + (x.nights || 0), 0);
  const legs = async () => { setBusy('legs'); try { await variantTransport(s, tr, v.id); } catch (e) { toast(errMsg(e)); } finally { setBusy(null); } };
  const ai = async () => { if (!wish.trim()) return; setBusy('ai'); try { const a = await editVariant(s, tr, v.id, wish.trim()); setWish(''); toast(a ? `✨ ${a}` : 'Variante angepasst'); } catch (e) { toast(errMsg(e)); } finally { setBusy(null); } };
  return (
    <section className="card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="eyebrow" style={{ fontSize: 11, flex: 1 }}>Variante {vi + 1}{v.chosen ? ' · ✓ ist die finale Route' : ''}</span>
        <span className="tiny">{v.stops.length} Orte{nights ? ` · ${nights} N.` : ''}</span>
      </div>
      <input className="input title-input" style={{ fontSize: 19 }} defaultValue={v.name} key={v.id + v.name} onBlur={(e) => e.target.value.trim() && e.target.value !== v.name && updateVariant(tr.id, v.id, { name: e.target.value.trim() })} aria-label="Name der Variante" />
      {(v.aiNote || v.summary) && <span className="tiny" style={{ color: 'var(--text)' }}>{v.aiNote ? `✨ ${v.aiNote}` : v.summary}</span>}
      {v.stops.length > 0 && (() => { const H = tripHome(s, tr); const a = v.stops[0].name; const n = legsOf(v.legs, H.home, a).length; return H.home.toLowerCase() !== a.toLowerCase() && <div className="tl-auto"><button type="button" className="tl-main" style={{ flex: 1, minWidth: 0, padding: 0 }} onClick={() => setLegAB({ a: H.home, b: a, date: tr.from })}><span><b>{MODE_ICON[H.mode] || '➡️'} Anreise:</b> {H.home} → {a}{tr.from ? ` · ${fmtShort(tr.from)}` : ''}</span><span className="tiny">{n ? `${n} gespeichert – antippen` : 'Antippen zum Speichern'}</span></button><a className="pill" style={{ fontSize: 12 }} href={legUrl(s, tr, H.home, a, H.mode, tr.from || '')} target="_blank" rel="noreferrer">{H.mode === 'flug' ? 'Flüge ↗' : 'Suchen ↗'}</a></div>; })()}
      <Timeline
        items={v.stops}
        name={(x) => x.name}
        meta={(x) => [x.nights && `${x.nights} N.`, (x.items || []).length && `${x.items.length} gesammelt`, tr.stops.some((y) => y.name.toLowerCase() === x.name.toLowerCase()) && '✓ in finaler Route', x.note].filter(Boolean).join(' · ') || 'Antippen: Anreise, Unterkunft, Restaurants …'}
        leg={(i) => legChip(legOf(v.legs, v.stops[i].name, v.stops[i + 1].name), legsOf(v.legs, v.stops[i].name, v.stops[i + 1].name).length)}
        onLeg={(i) => setLegAB({ a: v.stops[i].name, b: v.stops[i + 1].name })}
        onOpen={(i) => setOpenI(i)}
        onReorder={(a, b) => reorderVariantStop(tr.id, v.id, a, b)}
        onRemove={(i) => removeVariantStop(tr.id, v.id, i)}
        renderDetail={() => null}
        renderLeg={(i) => <VariantLegDetail tr={tr} v={v} a={v.stops[i].name} b={v.stops[i + 1].name} />}
        onInsert={(name, at) => addVariantStop(tr.id, v.id, name, at)}
      />
      {v.stops.length > 0 && (() => { const H = tripHome(s, tr); const z = v.stops[v.stops.length - 1].name; const n = legsOf(v.legs, z, H.home).length; return H.home.toLowerCase() !== z.toLowerCase() && <div className="tl-auto"><button type="button" className="tl-main" style={{ flex: 1, minWidth: 0, padding: 0 }} onClick={() => setLegAB({ a: z, b: H.home, date: tr.to })}><span><b>{MODE_ICON[H.mode] || '➡️'} Rückreise:</b> {z} → {H.home}{tr.to ? ` · ${fmtShort(tr.to)}` : ''}</span><span className="tiny">{n ? `${n} gespeichert – antippen` : 'Antippen zum Speichern'}</span></button><a className="pill" style={{ fontSize: 12 }} href={legUrl(s, tr, z, H.home, H.mode, tr.to || '')} target="_blank" rel="noreferrer">{H.mode === 'flug' ? 'Flüge ↗' : 'Suchen ↗'}</a></div>; })()}
      {v.stops.length > 1 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={legs} disabled={!!busy || !getAi().apiKey}>{busy === 'legs' ? 'Ich schätze die Strecken …' : v.legs?.length ? '↻ Transport neu schätzen (KI)' : '🚌 Transport zwischen allen Orten schätzen (KI)'}</button>}
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); ai(); }}>
        <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="✨ KI: z.B. „mehr Strand“, „2 Nächte weniger“" aria-label={`KI für Variante ${vi + 1}`} />
        <button type="submit" className="btn small" style={{ whiteSpace: 'nowrap' }} disabled={!wish.trim() || !!busy || !getAi().apiKey}>{busy === 'ai' ? '…' : '✨ Ändern'}</button>
      </form>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={v.chosen ? 'pill on' : 'pill'} disabled={!v.stops.length || v.chosen} onClick={() => { if (tr.stops.length && !confirm(`Die finale Route (${tr.stops.map((x) => x.name).join(' → ')}) wird durch „${v.name}“ ersetzt. Die bisherige wird als Variante „Bisherige Route“ gesichert. Weiter?`)) return; chooseVariant(tr.id, v.id); toast(`Finale Route = „${v.name}“`); onChosen?.(); }}>{v.chosen ? '✓ Ist die finale Route' : 'Als finale Route übernehmen'}</button>
        {isIdea && <button type="button" className="pill on" disabled={!v.stops.length} onClick={() => { chooseVariant(tr.id, v.id); onCommit(); }}>Zur Reise machen</button>}
        <span style={{ flex: 1 }} />
        <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`Variante „${v.name}“ löschen?`) && removeVariant(tr.id, v.id)}>Löschen</button>
      </div>
      {openI !== null && v.stops[openI] && <VariantStopSheet s={s} tr={tr} v={v} i={openI} onClose={() => setOpenI(null)} />}
      {legAB && <LegSheet s={s} tr={tr} v={v} a={legAB.a} b={legAB.b} date={legAB.date} onClose={() => setLegAB(null)} />}
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
          <button type="submit" className="btn small" style={{ whiteSpace: 'nowrap' }} disabled={busy || !getAi().apiKey}>{busy ? 'Baue …' : '✨ Erstellen'}</button>
        </form>
        {!getAi().apiKey && <span className="tiny" style={{ color: 'var(--danger)' }}>Für die KI braucht es einen API-Schlüssel (Einstellungen).</span>}
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
    ? [['anreise', '✈️ Anreise'], ['unterkunft', '🏠 Unterkünfte'], ['sehen', '👀 Sehenswürdigkeiten'], ['essen', '🍽 Restaurants'], ['tun', '🚐 Ausflüge'], ...(isIdea ? [['notizen', 'Notizen']] : planTabs)]
    : (isIdea ? [['route', 'Finale Route'], ['varianten', 'Varianten'], ['sammeln', 'Orte sammeln'], ['notizen', 'Notizen']] : [['route', 'Finale Route'], ['varianten', 'Varianten'], ['sammeln', 'Orte sammeln'], ...planTabs]);
  const [tab, setTab] = useState(null);
  const [commit, setCommit] = useState(false);
  const [priceFor, setPriceFor] = useState(null);
  const [range, setRange] = useState({ from: tr.from, to: tr.to });
  const cur = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  const days = tr.from ? diffDays(t, tr.from) : null;
  const spent = tr.expenses.reduce((n, x) => n + x.amount, 0);
  const ortSt = kind === 'ort' ? ortStopOf(tr) : null;
  const autoCity = kind === 'ort' && !ortSt && !tr.stops.length && tr.dest && !isCountry(tr.dest.split(',')[0]) ? tr.dest.split(',')[0].trim() : '';
  useEffect(() => { if (autoCity) { const id = insertStop(tr.id, autoCity, 0); updateTrip(tr.id, { ortStopId: id }); } }, [autoCity]); // eslint-disable-line react-hooks/exhaustive-deps
  const ortApi = ortSt ? stopApi(tr, null, tr.stops.indexOf(ortSt)) : null;
  const count = { ...(ortApi ? Object.fromEntries(['anreise', 'unterkunft', 'sehen', 'essen', 'tun'].map((k) => [k, ortApi.list(k).length + (k === 'anreise' ? ortApi.list('rueck').length : 0)])) : {}), sammeln: (tr.pool || []).length, vergleich: (tr.spots || []).length, varianten: (tr.variants || []).length, todo: tr.todo.filter((x) => !x.done).length, packen: tr.packen.filter((x) => !x.done).length, orte: tr.places.length, docs: tr.docs.length };
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
            <DateRangeField from={tr.from} to={tr.to} onChange={(v) => setTripDates(tr.id, v)} title="Reisezeitraum" />
          </section>
        )}


        <div className="seg full" role="group" aria-label="Art der Reise">
          <button type="button" className={kind === 'ort' ? 'on' : ''} aria-pressed={kind === 'ort'} onClick={() => { if (kind === 'ort') return; updateTrip(tr.id, { kind: 'ort' }); setTab(null); toast('Umgestellt – nichts geht verloren, alles bleibt gespeichert'); }}>📍 An einem Ort</button>
          <button type="button" className={kind === 'rundreise' ? 'on' : ''} aria-pressed={kind === 'rundreise'} onClick={() => { if (kind === 'rundreise') return; updateTrip(tr.id, { kind: 'rundreise' }); setTab(null); toast('Umgestellt – nichts geht verloren, alles bleibt gespeichert'); }}>🗺 Rundreise</button>
        </div>
        {kind === 'ort' && ((tr.pool || []).length > 0 || (tr.variants || []).length > 0 || tr.stops.length > 1) && <span className="tiny" style={{ padding: '0 4px', marginTop: -6 }}>🗺 Gespeichert bleibt deine Planung für „Rundreise“ ({[tr.stops.length > 1 && `Route mit ${tr.stops.length} Orten`, (tr.pool || []).length && `${tr.pool.length} gesammelte Orte`, (tr.variants || []).length && `${tr.variants.length} Varianten`].filter(Boolean).join(', ')}) – mit „Rundreise“ ist alles wieder da.</span>}
        {kind === 'rundreise' && (() => { const os = tr.ortStopId && tr.stops.find((x) => x.id === tr.ortStopId); const n = os ? tr.places.filter((p) => p.stopId === os.id).length : 0; return os || (tr.spots || []).length > 0 ? <span className="tiny" style={{ padding: '0 4px', marginTop: -6 }}>📍 Gespeichert bleibt deine Planung für „An einem Ort“ ({[os && os.name, n && `${n} ${n === 1 ? "Eintrag" : "Einträge"}`, (tr.spots || []).length && `${tr.spots.length} Orte`].filter(Boolean).join(', ')}) – mit „An einem Ort“ ist alles wieder da.</span> : null; })()}
        {kind === 'ort' && !ortSt && <OrtCitySetup tr={tr} />}
        {ortSt && <OrtHead tr={tr} st={ortSt} />}
        {(kind !== 'ort' || ortSt) && <div className="box-tabs main-tabs">
          {tabs.map(([k, l]) => <button key={k} type="button" className={cur === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(k)}>{l}{count[k] ? ` ${count[k]}` : ''}</button>)}
        </div>}
        {ortSt && ['anreise', 'unterkunft', 'sehen', 'essen', 'tun'].includes(cur) && <section className="card" style={{ gap: 8 }}><StopBody s={s} tr={tr} v={null} i={tr.stops.indexOf(ortSt)} only={cur} ort /></section>}
        {cur === 'vergleich' && <Spots s={s} tr={tr} />}
        {cur === 'sammeln' && <Pool s={s} tr={tr} onVariants={() => setTab('varianten')} />}
        {cur === 'varianten' && <Variants s={s} tr={tr} onChosen={() => setTab('route')} onCommit={isIdea ? () => setCommit(true) : null} />}
        {cur === 'route' && <Route s={s} tr={tr} />}
        {cur === 'orte' && <Places tr={tr} />}
        {cur === 'todo' && <GroupedChecklist items={tr.todo} cats={Object.keys(TODO_TEMPLATE)} onAdd={(text, cat) => addCheck(tr.id, 'todo', text, cat)} onToggle={(id) => updateEntry(tr.id, 'todo', id, { done: !tr.todo.find((x) => x.id === id).done })} onRemove={(id) => removeEntry(tr.id, 'todo', id)} onTemplate={() => commitTrip(tr.id)} placeholder="Neues To-do" />}
        {cur === 'packen' && <><GroupedChecklist items={tr.packen} cats={Object.keys(PACK_TEMPLATE)} onAdd={(text, cat) => text.split(/,|\n/).forEach((x) => addCheck(tr.id, 'packen', x, cat))} onToggle={(id) => updateEntry(tr.id, 'packen', id, { done: !tr.packen.find((x) => x.id === id).done })} onRemove={(id) => removeEntry(tr.id, 'packen', id)} onTemplate={() => fillPackTemplate(tr.id)} placeholder="Einpacken" /><PackHelper s={s} tr={tr} /></>}
        {cur === 'docs' && <Docs tr={tr} />}
        {cur === 'budget' && <Budget tr={tr} />}
        {cur === 'notizen' && isIdea && (kind !== 'ort' || ortSt) && (
          <section className="card" style={{ gap: 6 }}>
            <NotesArea key={tr.id + 'idea'} value={tr.idea || ''} onSave={(v) => updateTrip(tr.id, { idea: v })} placeholder="Deine Notizen – frei, nur von dir." label="Notizen zur Idee" />
            {tr.info && <KiInfo text={tr.info} />}
          </section>
        )}
        {cur === 'notizen' && (!isIdea || tr.notes) && (kind !== 'ort' || ortSt) && (
          <section className="card" style={{ gap: 6 }}>
            <NotesArea key={tr.id + 'notes'} value={tr.notes || ''} onSave={(v) => updateTrip(tr.id, { notes: v })} placeholder="Deine Notizen – frei, nur von dir." />
          </section>
        )}
        {!['sammeln', 'varianten'].includes(cur) && <PlanChat
          title={isIdea ? 'Mit KI recherchieren' : 'Mit KI planen'}
          intro={isIdea ? (kind === 'ort' ? 'Frag mich zum Ort: in welchem Viertel wohnen, was man sehen muss, gute Restaurants, Ausflüge – ich schlage konkrete Einträge vor.' : 'Erzähl, was dich reizt und wie lange du Zeit hast. Ich schlage Orte für deine Sammlung vor und baue daraus Routen-Varianten.') : 'Sag z.B.: „Ich mache viel Sport dort, es wird kalt“ – ich passe Packliste und To-dos an. Oder: „Such mir eine Unterkunft in der Nähe vom Strand“.'}
          history={tr.chat}
          prefKey="reise"
          onSave={(chat) => updateTrip(tr.id, { chat })}
          onAsk={(hist, o) => tripAssist(s, tr, hist, o)}
          webChips={isIdea ? [] : ['Flüge suchen', 'Unterkunft suchen', 'Bus & Fähren zwischen den Stationen']}
          autoWeb={TRAVEL_WEB}
          groups={PLAN_GROUPS}
          onApply={(sel) => applyTripProposal(tr.id, sel)}
          chips={kind === 'ort' ? (isIdea ? ['In welchem Viertel wohnen?', 'Was muss ich sehen?', 'Restaurant-Tipps', 'Tagesausflüge'] : ['Unterkunft-Lage: wo am besten?', 'Sehenswürdigkeiten', 'Restaurant-Tipps', 'Packliste anpassen']) : (isIdea ? ['Mehr Orte für die Sammlung', 'Vergleich meine Varianten', 'Was gibt es dort zu sehen?'] : ['Alternative Route als Variante', 'Sehenswürdigkeiten', 'Restaurant-Tipps', 'Packliste anpassen', 'Was fehlt noch?'])}
        />}
        <button type="button" className="btn danger" onClick={() => { if (confirm(`Reise „${tr.name}“ löschen?`)) { removeTrip(tr.id); go('/reisen'); } }}>{isIdea ? 'Idee löschen' : 'Reise löschen'}</button>
      </main>
      <PriceSheet s={s} trips={priceFor} title={tr.group ? `Preise: ${tr.group}` : `Preise: ${tr.name}`} onClose={() => setPriceFor(null)} />
      <Sheet open={commit} title="Reise festlegen" onClose={() => setCommit(false)}>
        <span className="sub">Wann reist du? Danach bekommst du To-dos und eine Packliste nach Kategorien – die KI kann sie anpassen.</span>
        <DateRangeField from={range.from} to={range.to} onChange={setRange} />
        <button type="button" className="btn" onClick={() => { commitTrip(tr.id, range); if (range.from) setTripDates(tr.id, range); setCommit(false); setTab('todo'); toast('Reise festgelegt – Vorlage ist da'); }}>Festlegen</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

// v0.91: KI-Infos zur Idee getrennt von den eigenen Notizen (eingeklappt)
function KiInfo({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => setOpen(!open)}>💡 Infos der KI {open ? '▴' : '▾'}</button>
      {open && <div className="take-box" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{text}</div>}
    </div>
  );
}

// v0.88: Standardliste ergänzen + KI fragt, was für diese Reise noch fehlt
function PackHelper({ s, tr }) {
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState(null);
  const miss = missingPack(tr).length;
  const ask = async () => {
    setBusy(true);
    try { setSugg(await packSuggest(s, tr)); } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setBusy(false); }
  };
  const left = (sugg || []).filter((x) => !tr.packen.some((y) => y.text.toLowerCase() === x.text.toLowerCase()));
  return (
    <section className="card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {miss > 0 && tr.packen.length > 0 && <button type="button" className="btn small sec" onClick={() => toast(`${fillPackTemplate(tr.id)} Standard-Punkte ergänzt`)}>+ Standardliste ergänzen ({miss})</button>}
        <button type="button" className="btn small" onClick={ask} disabled={busy || !getAi().apiKey}>{busy ? 'Ich überlege …' : '✨ Was fehlt noch?'}</button>
      </div>
      {sugg && left.length === 0 && <span className="tiny">Nichts mehr – du hast an alles gedacht.</span>}
      {left.length > 0 && (
        <>
          <span className="tiny">Antippen = auf die Packliste</span>
          <div className="chips">{left.map((x) => <button key={x.text} type="button" className="chip" onClick={() => addCheck(tr.id, 'packen', x.text, x.kategorie || 'Sonstiges')} title={x.warum}>+ {x.text}{x.warum ? <span className="tiny"> · {x.warum}</span> : null}</button>)}</div>
        </>
      )}
    </section>
  );
}

export default function Reisen({ id }) {
  const s = useStore();
  if (!id) return <TripList s={s} />;
  const tr = s.trips.find((x) => x.id === id);
  return tr ? <TripDetail s={s} tr={tr} /> : <Missing />;
}
