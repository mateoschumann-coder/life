// v0.97: einklappbare Liste „Rausgenommen“ – zurückholen oder endgültig löschen
import { askDel } from '../lib/undo';
import { useState } from 'react';
import { purgeRemoved } from '../lib/actions';
import { Sheet, toast } from './ui';

export default function RemovedList({ items, storeKey, onRestore, meta, label = 'Rausgenommen' }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <section className="group">
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 4 }} onClick={() => setOpen(!open)}>{open ? `▴ ${label} ausblenden` : `▾ ${label} (${items.length})`}</button>
      {open && (
        <Rows items={items} storeKey={storeKey} onRestore={onRestore} meta={meta} />
      )}
    </section>
  );
}

function Rows({ items, storeKey, onRestore, meta }) {
  return (
    <div className="list">
      {items.map((x) => (
        <div key={(x._store || '') + x.id} className="row compact">
          <span className="row-main">
            <span className="row-title plain" style={{ color: 'var(--muted)' }}>{x.name}</span>
            {meta && meta(x) && <span className="row-meta">{meta(x)}</span>}
          </span>
          <button type="button" className="pill" onClick={() => { onRestore(x.id, x); toast('Wieder in der Liste'); }}>↩ Zurück</button>
          <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => askDel(`„${x.name}“ endgültig löschen?`) && purgeRemoved(x._store || storeKey, x.id)} aria-label={`${x.name} endgültig löschen`}>Löschen</button>
        </div>
      ))}
    </div>
  );
}

// v1.20: unauffälliger Knopf oben (z.B. neben dem Filter) → Fenster mit den rausgenommenen Einträgen
export function RemovedButton({ items, storeKey, onRestore, meta, label = 'Rausgenommen', always = false }) {
  const [open, setOpen] = useState(false);
  if (!items.length && !always) return null;
  return (
    <>
      <button type="button" className="removed-btn" onClick={() => setOpen(true)} aria-label={`${label} (${items.length}) anzeigen`} title={label}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></svg>
        {items.length}
      </button>
      <Sheet open={open} title={`${label} (${items.length})`} onClose={() => setOpen(false)}>
        {items.length ? <Rows items={items} storeKey={storeKey} onRestore={onRestore} meta={meta} /> : <div className="empty">Noch nichts gelöscht. Gelöschte Einträge landen hier und lassen sich zurückholen.</div>}
      </Sheet>
    </>
  );
}
