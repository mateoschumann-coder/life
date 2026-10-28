// Freie Notizen (v0.91, Mateo): leicht leeren und – falls aus Versehen gelöscht/überschrieben – mit „↶ Rückgängig“ zurückholen.
// Speichert beim Verlassen des Feldes; merkt sich in dieser Sitzung die vorherigen Fassungen.
import { useState } from 'react';

export default function NotesArea({ value = '', onSave, placeholder, minHeight = 140, label = 'Notizen', style }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const [hist, setHist] = useState([]);
  if (value !== synced) { setSynced(value); setText(value); }
  const commit = (next) => {
    if (next === value) return;
    if (value) setHist((h) => [...h.slice(-9), value]);
    setSynced(next);
    onSave(next);
  };
  const undo = () => {
    const prev = hist[hist.length - 1];
    if (prev === undefined) return;
    setHist(hist.slice(0, -1));
    setText(prev);
    setSynced(prev);
    onSave(prev);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea className="input" style={{ minHeight, fontSize: 15, ...style }} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => commit(text)} placeholder={placeholder} aria-label={label} />
      {(text || hist.length > 0) && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hist.length > 0 && <button type="button" className="pill" onClick={undo}>↶ Rückgängig</button>}
          {text && <button type="button" className="pill" onClick={() => { setText(''); commit(''); }}>Leeren</button>}
        </div>
      )}
    </div>
  );
}
