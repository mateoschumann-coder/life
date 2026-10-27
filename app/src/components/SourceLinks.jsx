// Karte „Meine Seiten“: Suchbegriff eintippen → Seite antippen → öffnet direkt mit der Suche (kostenlos, keine KI)
import { useState } from 'react';
import { addSource, allUrl, removeSource, restoreSources, SOURCE_AREAS, sourcesOf, sourceUrl } from '../lib/sources';
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
export default function SourceLinks({ s, area, city = '', defaultQuery = '', embedded = false, query }) {
  const cfg = SOURCE_AREAS[area];
  const [own, setQ] = useState(defaultQuery);
  const q = query !== undefined ? query : own;
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const list = sourcesOf(s, area, city);
  const hidden = (s.profile?.sources?.[area]?.hidden || []).length;
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
        <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Seiten bearbeiten'}>{edit ? <Icon name="check" size={14} /> : <Icon name="edit" size={13} />}</button>
      </div>
      {query === undefined && <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={cfg.placeholder} aria-label={`Suchbegriff für ${cfg.title}`} />}
      </>}
      <div className="link-chips" style={{ marginTop: 0, alignItems: 'center' }}>
        {list.map((x) => (
          <span key={x.id} className="src-chip">
            <a className="link-chip" href={sourceUrl(x, q, city)} target="_blank" rel="noreferrer">{x.name} ↗</a>
            {edit && <button type="button" className="city-x" onClick={() => removeSource(area, x.id)} aria-label={`${x.name} entfernen`}><Icon name="x" size={10} /></button>}
          </span>
        ))}
        {embedded && <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Seiten bearbeiten'}>{edit ? <Icon name="check" size={13} /> : <Icon name="edit" size={12} />}</button>}
        {!edit && q.trim() && list.length > 1 && <a className="link-chip" style={{ background: 'var(--card-2)', color: 'var(--text)' }} href={allUrl(list, q, cfg.perCity ? city : '')} target="_blank" rel="noreferrer">🔎 Alle auf einmal (Google)</a>}
      </div>
      {edit && (
        <>
          <form className="block-add" onSubmit={add}>
            <input className="input" style={{ flex: '1 1 90px', minWidth: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name der Seite" />
            <input className="input" style={{ flex: '2 1 120px', minWidth: 0 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link, z.B. paulinacocina.net" aria-label="Link der Seite" />
            <button type="submit" className="btn small" disabled={!link.trim()}>+</button>
          </form>
          <span className="tiny">Eigene Seiten werden über Google nur auf dieser Seite durchsucht.{cfg.perCity && city ? ` Neue Seiten gelten für ${city}.` : ''}{hidden ? ' ' : ''}{hidden ? <button type="button" className="link-btn" style={{ fontSize: 12 }} onClick={() => restoreSources(area)}>Entfernte Standard-Seiten zurückholen ({hidden})</button> : null}</span>
        </>
      )}
      {!edit && <span className="tiny">{embedded ? 'Begriff oben eintippen, dann eine Seite antippen – sie öffnet sich direkt mit der Suche.' : 'Kostenlos – öffnet die Seite direkt mit deinem Suchbegriff. Ohne Begriff öffnet sich die Startseite.'}</span>}
    </Wrap>
  );
}
