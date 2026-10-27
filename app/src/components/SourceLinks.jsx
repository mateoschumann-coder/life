// Karte „Meine Seiten“: Suchbegriff eintippen → Seite antippen → öffnet direkt mit der Suche (kostenlos, keine KI)
import { useState } from 'react';
import { addSource, forgetSearch, isFixed, isNative, learnSearch, removeSource, restoreSources, SOURCE_AREAS, sourcesOf, sourceTerm, sourceUrl, tailorQueries } from '../lib/sources';
import { getAi } from '../lib/ai';
import { store } from '../lib/store';
import { Icon } from './ui';

// Umschalter „🔗 Links / ✨ KI-Suche“ (v0.65), gemerkt pro Bereich
const MODE_KEY = 'life-app-searchmode';
export function useSearchMode(area, fallback = 'ki') {
  const read = () => { try { return JSON.parse(localStorage.getItem(MODE_KEY) || '{}')[area] || fallback; } catch { return fallback; } };
  const [mode, setMode] = useState(read);
  const set = (m) => { setMode(m); try { const all = JSON.parse(localStorage.getItem(MODE_KEY) || '{}'); localStorage.setItem(MODE_KEY, JSON.stringify({ ...all, [area]: m })); } catch {} };
  return [mode, set];
}
export function ModeToggle({ mode, onChange }) {
  return (
    <div className="seg full" role="group" aria-label="Suchart">
      <button type="button" className={mode === 'links' ? 'on' : ''} aria-pressed={mode === 'links'} onClick={() => onChange('links')}>🔗 Links (kostenlos)</button>
      <button type="button" className={mode === 'ki' ? 'on' : ''} aria-pressed={mode === 'ki'} onClick={() => onChange('ki')}>✨ KI-Suche</button>
    </div>
  );
}

// embedded = ohne eigene Karte, Suchbegriff kommt von außen (query)
// Ablauf (v0.66): Satz eintippen → „Links erstellen“ → KI macht pro Seite einen passenden Begriff → Knöpfe öffnen die Suche der Seite
export default function SourceLinks({ s, area, city = '', defaultQuery = '', embedded = false, query, instant = false, siteQuery = null }) {
  const cfg = SOURCE_AREAS[area];
  const [own, setQ] = useState(defaultQuery);
  const q = query !== undefined ? query : own;
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [res, setRes] = useState(null); // { q, city, t }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [teach, setTeach] = useState(null); // Seite, deren Suche gerade eingerichtet wird
  const [teachUrl, setTeachUrl] = useState('');
  const [teachErr, setTeachErr] = useState('');
  const [teachOk, setTeachOk] = useState('');
  const list = sourcesOf(s, area, city);
  const hidden = (s.profile?.sources?.[area]?.hidden || []).length;
  const fresh = res && res.q === q.trim() && res.city === city;
  const make = async () => {
    const text = q.trim();
    if (!text) return;
    setErr(null);
    if (!getAi().apiKey) { setRes({ q: text, city, t: null }); return; }
    setBusy(true);
    try { setRes({ q: text, city, t: await tailorQueries(s, area, text, city, list) }); } catch (e) { setErr(e.message === 'KEIN_SCHLUESSEL' ? null : e.message); setRes({ q: text, city, t: null }); } finally { setBusy(false); }
  };
  const add = (e) => {
    e.preventDefault();
    addSource(area, name, link, city);
    setName(''); setLink('');
  };
  const Wrap = embedded ? 'div' : 'section';
  return (
    <Wrap className={embedded ? 'src-embed' : 'card'} style={{ gap: 8, display: 'flex', flexDirection: 'column' }}>
      {!embedded && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>🔗 {cfg.title}{cfg.perCity && city ? <span className="tiny" style={{ fontWeight: 500 }}> · {city}</span> : null}</span>
        </div>
        {query === undefined && cfg.chips && <div className="chips">{(cfg.chips).map((c) => <button key={c} type="button" className={q === c ? 'chip on' : 'chip soft'} style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => setQ(c)}>{c}</button>)}</div>}
        {query === undefined && <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') make(); }} placeholder={cfg.placeholder} aria-label={`Suchbegriff für ${cfg.title}`} />}
      </>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn small" style={{ flex: 1 }} onClick={make} disabled={!q.trim() || busy}>{busy ? 'Ich baue die Suchen …' : fresh ? '↻ Neu erstellen' : '🔗 Links erstellen'}</button>
        {edit ? <button type="button" className="pill on" style={{ fontSize: 13 }} onClick={() => setEdit(false)}>Fertig</button> : <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setEdit(true)} aria-label="Seiten bearbeiten"><Icon name="edit" size={13} /></button>}
      </div>
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {fresh && res.t?.gedanke && <span className="tiny" style={{ color: 'var(--text)' }}>🎯 {res.t.gedanke}</span>}
      {(fresh || edit || instant) && (
        <div className="link-chips" style={{ marginTop: 0, alignItems: 'center' }}>
          {list.map((x) => (
            <span key={x.id} className="src-chip">
              <a className="link-chip" style={isNative(x) ? undefined : { background: 'var(--card-2)', color: 'var(--text)' }} href={sourceUrl(x, fresh ? res.q : q, city, fresh ? res.t : null, siteQuery)} target="_blank" rel="noreferrer" title={fresh && res.t?.terms?.[x.id] ? res.t.terms[x.id] : ''}>{isFixed(x) ? '📌 ' : ''}{x.name}{isNative(x) ? '' : ' · G'} ↗</a>
              {edit && !x.build && <button type="button" className="city-x" style={x.tpl ? { background: 'var(--accent)', color: '#fff' } : undefined} onClick={() => { setTeach(x); setTeachUrl(''); setTeachErr(''); }} aria-label={`Direkte Suche für ${x.name} einrichten`}>🔧</button>}
              {edit && <button type="button" className="city-x" onClick={() => removeSource(area, x.id)} aria-label={`${x.name} entfernen`}><Icon name="x" size={10} /></button>}
            </span>
          ))}
        </div>
      )}
      {fresh && !edit && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 12.5 }} onClick={() => setShowTerms(!showTerms)}>Was genau gesucht wird {showTerms ? '▴' : '▾'}</button>}
      {fresh && !edit && showTerms && (
        <div className="terms-list">
          {list.map((x) => <span key={x.id}><b>{x.name}</b> {sourceTerm(x, res.q, city, res.t, siteQuery)}</span>)}
        </div>
      )}
      {teachOk && <span className="tiny" style={{ color: 'var(--text)', background: 'var(--card-2)', borderRadius: 10, padding: '8px 10px' }}>{teachOk} <button type="button" className="link-btn" style={{ fontSize: 12 }} onClick={() => setTeachOk('')}>OK</button></span>}
      {edit && teach && (
        <div className="take-box">
          <span style={{ fontWeight: 650, fontSize: 14 }}>🔧 Direkte Suche für {teach.name}</span>
          <span className="tiny" style={{ color: 'var(--text)' }}><b>Mit Suchfeld:</b> 1. <a href={teach.home || `https://${teach.domain}`} target="_blank" rel="noreferrer">{teach.name} öffnen ↗</a> · 2. dort nach <b>test</b> suchen · 3. Adresse der Ergebnisseite hier einfügen → der Knopf sucht künftig direkt dort.</span>
          <span className="tiny" style={{ color: 'var(--text)' }}><b>Ohne Suchfeld:</b> die passende Unterseite öffnen (z.B. Rennkalender) und deren Adresse einfügen → der Knopf öffnet immer diese Seite (📌).</span>
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); const er = learnSearch(area, teach.id, teachUrl); setTeachErr(er); if (!er) { const tp = sourcesOf(store.get(), area, city).find((y) => y.id === teach.id)?.tpl || ''; setTeachOk(tp.includes('{q}') ? `✓ ${teach.name} sucht jetzt direkt auf der Seite. Test: der Knopf sucht dort nach deinem Begriff.` : `📌 Gespeichert als feste Seite (in der Adresse war kein „test“). Der Knopf öffnet immer diese Seite, ohne zu suchen. Wolltest du eine Suche: auf der Seite nach test suchen und die Adresse der Ergebnisseite einfügen. Bleibt die Adresse dabei gleich, kann die Seite nicht per Link durchsucht werden.`); setTeach(null); } }}>
            <input className="input" value={teachUrl} onChange={(e) => setTeachUrl(e.target.value)} placeholder="https://…" aria-label="Adresse der Ergebnisseite" />
            <button type="submit" className="btn small" disabled={!teachUrl.trim()}>OK</button>
          </form>
          {teachErr && <span className="tiny" style={{ color: 'var(--danger)' }}>{teachErr}</span>}
          {teach.tpl && <span className="tiny">Jetzt: {teach.tpl.replace('{q}', '…')}</span>}
          {teach.tpl && <button type="button" className="link-btn" style={{ fontSize: 12.5, alignSelf: 'flex-start' }} onClick={() => { forgetSearch(area, teach.id); setTeach(null); }}>Wieder über Google suchen</button>}
        </div>
      )}
      {edit && (
        <>
          <form className="block-add" onSubmit={add}>
            <input className="input" style={{ flex: '1 1 90px', minWidth: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name der Seite" />
            <input className="input" style={{ flex: '2 1 120px', minWidth: 0 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link, z.B. paulinacocina.net" aria-label="Link der Seite" />
            <button type="submit" className="btn small" disabled={!link.trim()}>+</button>
          </form>
          <span className="tiny">🔧 = direkte Suche einrichten (sonst Google, nur auf dieser Seite).{cfg.perCity && city ? ` Neue Seiten gelten für ${city}.` : ''}{hidden ? ' ' : ''}{hidden ? <button type="button" className="link-btn" style={{ fontSize: 12 }} onClick={() => restoreSources(area)}>Entfernte Standard-Seiten zurückholen ({hidden})</button> : null}</span>
        </>
      )}
      {!edit && <span className="tiny">{instant && !fresh ? 'Antippen öffnet die Seite mit deinem Suchbegriff. „Links erstellen“ übersetzt ihn vorher passend pro Seite (ca. 0,03 Cent).' : fresh ? 'Blaue Knöpfe öffnen die Suche direkt auf der Seite bzw. in der App. Grau (· G) = Google, nur auf dieser Seite.' : `Schreib frei, was du suchst. Die KI macht daraus pro Seite den passenden Suchbegriff${cfg.perCity && city ? ` für ${city}` : ''} (ohne Internet, ca. 0,03 Cent).`}</span>}
    </Wrap>
  );
}
