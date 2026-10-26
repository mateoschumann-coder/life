// Vorschlagskarte des Assistenten: abhaken, selbst bearbeiten (Stift), übernehmen oder verwerfen
import { useState } from 'react';
import { describe } from '../lib/apply';
import { canUndo, decide, editAction, toggleSelected, undo } from '../lib/chat';
import { Icon, toast } from './ui';

// Felder, die man vor dem Übernehmen selbst ändern kann (Reihenfolge = Anzeige)
const FIELDS = {
  name: 'Name', titel: 'Titel', text: 'Text', fakt: 'Merken', wunsch: 'Wunsch', datum: 'Datum (JJJJ-MM-TT)', bis_datum: 'Bis (JJJJ-MM-TT)', uhrzeit: 'Uhrzeit',
  ort: 'Ort', adresse: 'Adresse', stadt: 'Stadt', gastgeber: 'Wer lädt ein', mitbringen: 'Ich bringe mit', firma: 'Firma', autor: 'Autor', betrag: 'Betrag',
  notiz: 'Notiz', beschreibung: 'Beschreibung', url: 'Link', artikel: 'Artikel (mit Komma)', zutaten: 'Zutaten (mit Komma)',
};
function Editor({ action, onSave, onCancel }) {
  const keys = Object.keys(FIELDS).filter((k) => typeof action[k] === 'string' || typeof action[k] === 'number' || (Array.isArray(action[k]) && action[k].every((x) => typeof x === 'string')));
  if (!keys.some((k) => ['name', 'titel', 'text', 'fakt', 'wunsch'].includes(k))) {
    const main = ['name', 'titel', 'text'].find((k) => k in FIELDS);
    keys.unshift(main);
  }
  const [f, setF] = useState(() => Object.fromEntries(keys.map((k) => [k, Array.isArray(action[k]) ? action[k].join(', ') : String(action[k] ?? '')])));
  const save = () => {
    const patch = {};
    for (const k of keys) {
      if (Array.isArray(action[k]) || k === 'artikel' || k === 'zutaten') patch[k] = f[k].split(',').map((x) => x.trim()).filter(Boolean);
      else if (typeof action[k] === 'number') patch[k] = Number(f[k]) || 0;
      else if (f[k].trim() || action[k] !== undefined) patch[k] = f[k].trim();
    }
    onSave(patch);
  };
  return (
    <div className="prop-edit">
      {keys.map((k) => (
        <label key={k} className="field" style={{ gap: 3 }}>
          <span>{FIELDS[k]}</span>
          {k === 'notiz' || k === 'beschreibung' ? <textarea className="input" rows={2} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn small" onClick={save}>Fertig</button>
        <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
}

export default function Proposal({ s, item }) {
  const [editing, setEditing] = useState(null);
  const open = item.status === 'open';
  const canApply = item.actions.some((a, i) => item.selected?.[i] && describe(s, a).ok);
  return (
    <div className="proposal">
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>{item.auto ? 'Ausgeführt' : 'Vorschlag'}</span>
      {item.actions.map((a, i) => {
        const info = describe(s, a);
        if (editing === i) return <Editor key={i} action={a} onCancel={() => setEditing(null)} onSave={(patch) => { editAction(item.id, i, patch); setEditing(null); }} />;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <label className="prop-row" style={{ opacity: info.ok ? 1 : 0.5, flex: 1 }}>
              <input type="checkbox" checked={!!item.selected?.[i] && info.ok} disabled={!open || !info.ok} onChange={() => toggleSelected(item.id, i)} />
              <span>{info.label}{!info.ok && ` (${info.reason || 'nicht möglich'})`}</span>
            </label>
            {open && <button type="button" className="x-btn" onClick={() => setEditing(i)} aria-label="Vorschlag bearbeiten"><Icon name="edit" size={14} color="var(--accent)" /></button>}
          </div>
        );
      })}
      {open && (
        <div className="btn-row">
          <button
            type="button"
            className="btn small"
            disabled={!canApply || editing !== null}
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
