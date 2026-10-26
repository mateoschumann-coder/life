// Vorschlagskarte des Assistenten: abhaken, übernehmen oder verwerfen
import { describe } from '../lib/apply';
import { canUndo, decide, toggleSelected, undo } from '../lib/chat';
import { toast } from './ui';

export default function Proposal({ s, item }) {
  const open = item.status === 'open';
  const canApply = item.actions.some((a, i) => item.selected?.[i] && describe(s, a).ok);
  return (
    <div className="proposal">
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>{item.auto ? 'Ausgeführt' : 'Vorschlag'}</span>
      {item.actions.map((a, i) => {
        const info = describe(s, a);
        return (
          <label key={i} className="prop-row" style={{ opacity: info.ok ? 1 : 0.5 }}>
            <input type="checkbox" checked={!!item.selected?.[i] && info.ok} disabled={!open || !info.ok} onChange={() => toggleSelected(item.id, i)} />
            <span>{info.label}{!info.ok && ` (${info.reason || 'nicht möglich'})`}</span>
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
      {item.status === 'applied' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ {item.auto ? 'Erledigt' : 'Übernommen'}</span>
          {canUndo(item.id) && <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => { undo(item.id); toast('Rückgängig gemacht'); }}>Rückgängig</button>}
        </div>
      )}
      {item.status === 'rejected' && <span className="sub">Verworfen</span>}
      {item.status === 'skipped' && <span className="sub">Nicht übernommen</span>}
    </div>
  );
}
