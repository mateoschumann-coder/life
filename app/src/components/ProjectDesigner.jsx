// Projekt im Gespräch mit der KI gestalten: Bausteine und Aufgaben vorschlagen lassen, per Häkchen übernehmen
import { useEffect, useRef, useState } from 'react';
import { askDesigner, getAi } from '../lib/ai';
import { addBlocks, BLOCK_TYPES, makeBlock } from '../lib/blocks';
import { addTask } from '../lib/actions';
import { fmtShort } from '../lib/dates';
import { Icon, Sheet, toast } from './ui';

const KEY = (id) => `life-app-design-${id}`;
const load = (id) => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY(id)) || '[]');
  } catch {
    return [];
  }
};

function describeBlock(b) {
  const parts = [BLOCK_TYPES[b.typ]?.label || b.typ];
  if (b.einheit) parts.push(b.einheit);
  if (b.ziel) parts.push((b.typ === 'budget' ? 'Limit ' : 'Ziel ') + b.ziel);
  if (b.punkte?.length) parts.push(b.punkte.slice(0, 3).join(', ') + (b.punkte.length > 3 ? ' …' : ''));
  return parts.join(' · ');
}

function Suggestion({ item, onApply }) {
  const blocks = item.input?.bausteine || [];
  const tasks = item.input?.aufgaben || [];
  const [off, setOff] = useState({});
  const done = item.status === 'applied';
  const row = (key, title, meta, icon) => (
    <label key={key} className="option">
      <input type="checkbox" disabled={done} checked={!off[key]} onChange={(e) => setOff({ ...off, [key]: !e.target.checked })} />
      <span style={{ color: 'var(--accent)', marginTop: 1 }}><Icon name={icon} size={17} /></span>
      <span className="row-main">
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        {meta && <span className="tiny">{meta}</span>}
      </span>
    </label>
  );
  return (
    <div className="options" style={{ borderTop: 0, paddingTop: 0 }}>
      {blocks.length > 0 && <b style={{ fontSize: 14 }}>Bausteine</b>}
      {blocks.map((b, i) => row('b' + i, b.titel, [describeBlock(b), b.warum].filter(Boolean).join(' – '), BLOCK_TYPES[b.typ]?.icon || 'edit'))}
      {tasks.length > 0 && <b style={{ fontSize: 14 }}>Erste Aufgaben</b>}
      {tasks.map((x, i) => row('a' + i, x.titel, x.faellig ? `fällig ${fmtShort(x.faellig)}` : '', 'check'))}
      {done ? (
        <span className="tiny" style={{ color: 'var(--accent)' }}>Übernommen</span>
      ) : (
        <button type="button" className="btn small" onClick={() => onApply(blocks.filter((_, i) => !off['b' + i]), tasks.filter((_, i) => !off['a' + i]))}>
          Auswahl übernehmen
        </button>
      )}
    </div>
  );
}

export default function ProjectDesigner({ s, project, open, onClose }) {
  const [items, setItems] = useState(() => load(project.id));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);
  const hasKey = !!getAi().apiKey;

  const save = (next) => {
    setItems(next);
    try {
      sessionStorage.setItem(KEY(project.id), JSON.stringify(next));
    } catch {}
  };
  const send = async (msg, base = items) => {
    const next = [...base, { role: 'user', text: msg }];
    save(next);
    setText('');
    setBusy(true);
    setErr(null);
    try {
      const r = await askDesigner(s, project, next);
      save([...next, { role: 'assistant', text: r.text, toolUseId: r.toolUseId, input: r.input, status: 'offen' }]);
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  // Beim ersten Öffnen direkt einen Vorschlag holen
  useEffect(() => {
    if (open && hasKey && items.length === 0 && !busy) send('Gestalte bitte dieses Projekt für mich.', []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [items, busy]);

  const apply = (idx, blocks, tasks) => {
    if (blocks.length) addBlocks(project.id, blocks.map(makeBlock));
    tasks.forEach((x) => addTask({ title: x.titel, projectId: project.id, due: x.faellig || null }));
    save(items.map((it, i) => (i === idx ? { ...it, status: 'applied' } : it)));
    toast(`${blocks.length} Bausteine, ${tasks.length} Aufgaben übernommen`);
  };

  return (
    <Sheet open={open} title="Mit KI gestalten" onClose={onClose}>
      {!hasKey && (
        <div className="notice">Für den KI-Gestalter braucht es einen API-Schlüssel. <a href="#/einstellungen" style={{ color: 'var(--accent)' }}>Zu den Einstellungen</a></div>
      )}
      <div className="designer">
        {items.filter((it, i) => !(i === 0 && it.role === 'user' && it.text.startsWith('Gestalte bitte'))).map((it) => {
          const idx = items.indexOf(it);
          return it.role === 'user' ? (
            <div key={idx} className="bubble me">{it.text}</div>
          ) : (
            <div key={idx} className="bubble ai">
              {it.text && <span style={{ whiteSpace: 'pre-wrap' }}>{it.text}</span>}
              {it.input && <Suggestion item={it} onApply={(b, t) => apply(idx, b, t)} />}
            </div>
          );
        })}
        {busy && <div className="bubble ai"><span className="sub">Ich überlege mir passende Bausteine …</span></div>}
        {err && <div className="sub" style={{ color: 'var(--danger)' }}>{err}</div>}
        <div ref={endRef} />
      </div>
      {hasKey && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) send(text.trim()); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. „Ziel: Halbmarathon im März“" aria-label="Nachricht an die KI" />
          <button type="submit" className="btn small" disabled={!text.trim() || busy} aria-label="Senden"><Icon name="send" size={16} color="currentColor" /></button>
        </form>
      )}
    </Sheet>
  );
}
