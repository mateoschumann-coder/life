import { useState } from 'react';
import { useStore } from '../lib/store';
import { addMemory, deleteMemory, updateMemory } from '../lib/actions';
import { areaOf } from '../lib/logic';
import { Back, Icon, TabBar, toast } from '../components/ui';
import { listen } from '../components/Coach';

// Was Life über Mateo weiß: daraus macht der Coach seine Anstöße
export default function Gedaechtnis() {
  const s = useStore();
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(null);
  const mem = s.memory || [];
  const groups = {};
  mem.forEach((m) => {
    const k = areaOf(s, m.areaId)?.name || 'Allgemein';
    (groups[k] = groups[k] || []).push(m);
  });

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/heute" label="Heute" />
          <h1 className="h1">Was Life über dich weiß</h1>
        </div>
        <span className="sub" style={{ padding: '0 4px', lineHeight: 1.45 }}>
          Daraus macht dein Coach seine Anstöße. Es füllt sich von selbst, wenn du dem Assistenten erzählst, was du vorhast, magst oder wie es läuft. Falsches einfach löschen oder antippen und ändern.
        </span>
        <button type="button" className="tell" style={{ alignSelf: 'flex-start' }} onClick={() => listen()}>
          <Icon name="mic" size={16} /> Von mir erzählen
        </button>
        {mem.length === 0 && (
          <div className="notice">
            Noch leer. Erzähl dem Assistenten z.B.: „Ich laufe im Mai einen Marathon, mein Knie zwickt manchmal. Ich lerne Italienisch und will ein ML-Projekt auf GitHub bringen. Ich mag Techno-Konzerte und Startup-Meetups.“
          </div>
        )}
        {Object.entries(groups).map(([name, list]) => (
          <section key={name} className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>{name}</h2>
            <div className="list">
              {list.map((m) => (
                <div key={m.id} className="row">
                  {edit === m.id ? (
                    <input className="input" autoFocus defaultValue={m.text} onBlur={(e) => { if (e.target.value.trim()) updateMemory(m.id, e.target.value.trim()); setEdit(null); }} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} aria-label="Eintrag ändern" />
                  ) : (
                    <button type="button" className="row-main" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setEdit(m.id)}>
                      <span className="row-title plain">{m.text}</span>
                    </button>
                  )}
                  <button type="button" className="x-btn" aria-label={`${m.text} löschen`} onClick={() => { deleteMemory(m.id); toast('Gelöscht'); }}>
                    <Icon name="x" size={14} color="var(--chev)" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); addMemory(text); setText(''); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Selbst ergänzen, z.B. „Mag Airfryer-Rezepte“" aria-label="Neuer Eintrag" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      </main>
      <TabBar />
    </>
  );
}
