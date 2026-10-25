// Vorschlagskarte des Assistenten: abhaken, übernehmen oder verwerfen
import { describe } from '../lib/apply';
import { decide, toggleSelected } from '../lib/chat';
import { toast } from './ui';

export default function Proposal({ s, item }) {
  const open = item.status === 'open';
  const canApply = item.actions.some((a, i) => item.selected?.[i] && describe(s, a).ok);
  return (
    <div className="proposal">
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Vorschlag</span>
      {item.actions.map((a, i) => {
        const info = describe(s, a);
        return (
          <label key={i} className="prop-row" style={{ opacity: info.ok ? 1 : 0.5 }}>
            <input type="checkbox" checked={!!item.selected?.[i] && info.ok} disabled={!open || !info.ok} onChange={() => toggleSelected(item.id, i)} />
            <span>{info.label}{!info.ok && ' (nicht möglich)'}</span>
          </label>
        );
      })}
      {open && (
        <div className="btn-row">
          <button
            type="button"
            className="btn small"
            disabled={!canApply}
            onClick={() => {
              const n = decide(item.id, true);
              toast(n === 1 ? '1 Änderung gespeichert' : `${n} Änderungen gespeichert`);
            }}
          >
            Übernehmen
          </button>
          <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => decide(item.id, false)}>Verwerfen</button>
        </div>
      )}
      {item.status === 'applied' && <span className="sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Übernommen</span>}
      {item.status === 'rejected' && <span className="sub">Verworfen</span>}
      {item.status === 'skipped' && <span className="sub">Nicht übernommen</span>}
    </div>
  );
}
