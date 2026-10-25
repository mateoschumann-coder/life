import { useState } from 'react';
import { useStore } from '../lib/store';
import { deleteTemplate, saveTemplate } from '../lib/actions';
import { Back, Chevron, Field, Sheet, TabBar, toast } from '../components/ui';

export default function Vorlagen() {
  const s = useStore();
  const [edit, setEdit] = useState(null); // { id?, name, text }

  const open = (t) => setEdit(t ? { id: t.id, name: t.name, text: t.tasks.join('\n') } : { name: '', text: '' });
  const save = () => {
    saveTemplate({ id: edit.id, name: edit.name, tasks: edit.text.split('\n') });
    setEdit(null);
    toast('Vorlage gespeichert');
  };

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/einstellungen" label="Einstellungen" />
          <h1 className="h1">Vorlagen</h1>
        </div>
        <span className="sub" style={{ padding: '0 4px', lineHeight: 1.45 }}>
          Vorlagen legen beim Erstellen eines Projekts automatisch Aufgaben an. Du kannst auch jedes fertige Projekt mit „Als Vorlage speichern“ hierher übernehmen.
        </span>
        <section className="list">
          {s.templates.length === 0 && <div className="empty">Noch keine Vorlagen.</div>}
          {s.templates.map((t) => (
            <button key={t.id} type="button" className="row" style={{ background: 'none', border: 0, textAlign: 'left', width: '100%' }} onClick={() => open(t)}>
              <span className="row-main">
                <span className="row-title">{t.name}</span>
                <span className="row-meta">{t.tasks.length} Aufgaben{t.tasks.length ? ` · ${t.tasks.slice(0, 3).join(', ')}${t.tasks.length > 3 ? ' …' : ''}` : ''}</span>
              </span>
              <Chevron />
            </button>
          ))}
        </section>
        <button type="button" className="btn tint" onClick={() => open(null)}>Neue Vorlage</button>
      </main>

      <Sheet open={!!edit} title={edit?.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'} onClose={() => setEdit(null)}>
        {edit && (
          <>
            <Field label="Name">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="z.B. Event besuchen" />
            </Field>
            <Field label="Aufgaben (eine pro Zeile)">
              <textarea className="input" style={{ minHeight: 180 }} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder={'Ziel festlegen\nMaterial sammeln\n…'} />
            </Field>
            <button type="button" className="btn" onClick={save} disabled={!edit.name.trim()}>Speichern</button>
            {edit.id && (
              <button type="button" className="btn danger" onClick={() => { if (confirm('Vorlage löschen?')) { deleteTemplate(edit.id); setEdit(null); } }}>Vorlage löschen</button>
            )}
          </>
        )}
      </Sheet>
      <TabBar />
    </>
  );
}
