// Liste von Such-Links (von der KI vorgeschlagen, ohne Websuche)
import { Icon } from './ui';

export default function LinkList({ links, hint, onKeep, keepLabel = 'Merken' }) {
  if (!links?.length) return hint ? <span className="sub">{hint}</span> : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hint && <span className="sub">{hint}</span>}
      {links.map((l) => (
        <div key={l.id} className="option" style={{ alignItems: 'center' }}>
          <a href={l.url} target="_blank" rel="noreferrer" className="row-main" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}><span className="link-tag">{l.label}</span>{l.title}</span>
            {l.why && <span className="tiny">{l.why}</span>}
          </a>
          {onKeep && <button type="button" className="pill" onClick={() => onKeep(l)}>{keepLabel}</button>}
          <a className="x-btn" href={l.url} target="_blank" rel="noreferrer" aria-label={`${l.title} öffnen`}><Icon name="link" size={15} color="var(--accent)" /></a>
        </div>
      ))}
    </div>
  );
}
