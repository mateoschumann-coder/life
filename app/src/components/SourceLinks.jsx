// Karte „Meine Seiten“: Suchbegriff eintippen → Seite antippen → öffnet direkt mit der Suche (kostenlos, keine KI)
import { useState } from 'react';
import { addSource, allUrl, removeSource, restoreSources, SOURCE_AREAS, sourcesOf, sourceUrl } from '../lib/sources';
import { Icon } from './ui';

export default function SourceLinks({ s, area, city = '', defaultQuery = '' }) {
  const cfg = SOURCE_AREAS[area];
  const [q, setQ] = useState(defaultQuery);
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
  return (
    <section className="card" style={{ gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>🔗 {cfg.title}{cfg.perCity && city ? <span className="tiny" style={{ fontWeight: 500 }}> · {city}</span> : null}</span>
        <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setEdit(!edit)} aria-label={edit ? 'Fertig' : 'Seiten bearbeiten'}>{edit ? <Icon name="check" size={14} /> : <Icon name="edit" size={13} />}</button>
      </div>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={cfg.placeholder} aria-label={`Suchbegriff für ${cfg.title}`} />
      <div className="link-chips" style={{ marginTop: 0 }}>
        {list.map((x) => (
          <span key={x.id} className="src-chip">
            <a className="link-chip" href={sourceUrl(x, q, city)} target="_blank" rel="noreferrer">{x.name} ↗</a>
            {edit && <button type="button" className="city-x" onClick={() => removeSource(area, x.id)} aria-label={`${x.name} entfernen`}><Icon name="x" size={10} /></button>}
          </span>
        ))}
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
      {!edit && <span className="tiny">Kostenlos – öffnet die Seite direkt mit deinem Suchbegriff. Ohne Begriff öffnet sich die Startseite.</span>}
    </section>
  );
}
