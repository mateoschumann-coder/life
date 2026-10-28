// v0.97: einklappbare Liste „Rausgenommen“ – zurückholen oder endgültig löschen
import { useState } from 'react';
import { purgeRemoved } from '../lib/actions';
import { toast } from './ui';

export default function RemovedList({ items, storeKey, onRestore, meta, label = 'Rausgenommen' }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <section className="group">
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 4 }} onClick={() => setOpen(!open)}>{open ? `▴ ${label} ausblenden` : `▾ ${label} (${items.length})`}</button>
      {open && (
        <div className="list">
          {items.map((x) => (
            <div key={x.id} className="row compact">
              <span className="row-main">
                <span className="row-title plain" style={{ color: 'var(--muted)' }}>{x.name}</span>
                {meta && meta(x) && <span className="row-meta">{meta(x)}</span>}
              </span>
              <button type="button" className="pill" onClick={() => { onRestore(x.id); toast('Wieder in der Liste'); }}>↩ Zurück</button>
              <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`„${x.name}“ endgültig löschen?`) && purgeRemoved(storeKey, x.id)} aria-label={`${x.name} endgültig löschen`}>Löschen</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
