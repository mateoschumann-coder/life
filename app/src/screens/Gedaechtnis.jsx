import { useState } from 'react';
import { useStore } from '../lib/store';
import { addMemory, deleteMemory, updateMemory } from '../lib/actions';
import { areaOf } from '../lib/logic';
import { Back, Icon, Sheet, TabBar, toast } from '../components/ui';
import { applyActions, describe } from '../lib/apply';
import { listen } from '../components/Coach';

// Was Life über Mateo weiß: daraus macht der Coach seine Anstöße
export default function Gedaechtnis() {
  const s = useStore();
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="tell" onClick={() => listen()}>
            <Icon name="mic" size={16} /> Von mir erzählen
          </button>
          <button type="button" className="tell" onClick={() => setImportOpen(true)}>
            <Icon name="plus" size={16} /> Grundlage einfügen
          </button>
        </div>
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
      <ImportSheet s={s} open={importOpen} onClose={() => setImportOpen(false)} />
      <TabBar />
    </>
  );
}

// Grundlage einfügen: ein von Claude vorbereiteter Block (Liste von Aktionen) wird geprüft und nach Auswahl übernommen
function parseImport(text) {
  const raw = text.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : data.aktionen;
  if (!Array.isArray(list)) throw new Error('Kein gültiger Block');
  return list.filter((a) => a && a.typ);
}
function ImportSheet({ s, open, onClose }) {
  const [text, setText] = useState('');
  const [actions, setActions] = useState(null);
  const [off, setOff] = useState({});
  const [err, setErr] = useState(null);
  const check = (t = text) => {
    try {
      setActions(parseImport(t));
      setOff({});
      setErr(null);
    } catch {
      setErr('Das sieht nicht wie ein Life-Block aus. Bitte den ganzen Block aus dem Chat kopieren (von { bis }).');
    }
  };
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setText(t);
      check(t);
    } catch {
      toast('Bitte lange ins Feld tippen und „Einsetzen“ wählen');
    }
  };
  const infos = (actions || []).map((a) => describe(s, a));
  const chosen = (actions || []).filter((a, i) => infos[i].ok && !off[i]);
  const apply = () => {
    const labels = applyActions(chosen);
    toast(`${labels.length} Einträge übernommen`);
    setText('');
    setActions(null);
    onClose();
  };
  return (
    <Sheet open={open} title="Grundlage einfügen" onClose={onClose}>
      {!actions && (
        <>
          <span className="sub" style={{ lineHeight: 1.45 }}>Füge hier den Block ein, den Claude dir im Chat vorbereitet hat. Du siehst danach jeden Eintrag und entscheidest, was übernommen wird.</span>
          <button type="button" className="btn sec" onClick={paste}>Aus Zwischenablage einfügen</button>
          <textarea className="input" style={{ minHeight: 140, fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"life_import": 1, "aktionen": [ … ]}' aria-label="Block einfügen" />
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          <button type="button" className="btn" onClick={() => check()} disabled={!text.trim()}>Prüfen</button>
        </>
      )}
      {actions && (
        <>
          <span className="sub">{chosen.length} von {actions.length} Einträgen ausgewählt</span>
          <div className="proposal" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            {actions.map((a, i) => (
              <label key={i} className="prop-row" style={{ opacity: infos[i].ok ? 1 : 0.5 }}>
                <input type="checkbox" checked={infos[i].ok && !off[i]} disabled={!infos[i].ok} onChange={() => setOff({ ...off, [i]: !off[i] })} />
                <span>{infos[i].label}{!infos[i].ok && ` (${infos[i].reason || 'nicht möglich'})`}</span>
              </label>
            ))}
          </div>
          <button type="button" className="btn" onClick={apply} disabled={!chosen.length}>{chosen.length} übernehmen</button>
          <button type="button" className="btn sec" onClick={() => setActions(null)}>Zurück</button>
        </>
      )}
    </Sheet>
  );
}
