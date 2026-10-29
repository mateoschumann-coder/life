// v1.25 (Mateo): „✨ Mit KI ausfüllen“ oben in Formularen – erzählen, Text oder Link einfügen → KI füllt die Felder
import { useState } from 'react';
import { getAi } from '../lib/ai';
import { canDictate, useDictation } from '../lib/dictate';
import { toast } from './ui';

export default function AiFill({ placeholder = 'Erzähl kurz oder füg Link/Text ein …', onFill, hint }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const mic = useDictation(txt, setTxt);
  const run = async () => {
    mic.stop();
    setBusy(true);
    try { await onFill(txt.trim()); setTxt(''); setOpen(false); toast('Ausgefüllt – bitte kurz prüfen'); }
    catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es den KI-Schlüssel (Einstellungen)' : e.message); }
    setBusy(false);
  };
  if (!open) return <button type="button" className="btn tint small" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>✨ Mit KI ausfüllen</button>;
  return (
    <div className="card" style={{ gap: 8, background: 'var(--card-2)', boxShadow: 'none', padding: 12 }}>
      <textarea className="input" style={{ minHeight: 70 }} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={placeholder} autoFocus />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" style={{ flex: 1 }} disabled={!txt.trim() || busy || !getAi().apiKey} onClick={run}>{busy ? 'Ich lese …' : '✨ Ausfüllen'}</button>
        {canDictate && <button type="button" className={mic.on ? 'btn small' : 'btn small tint'} onClick={mic.toggle} aria-label="Einsprechen">{mic.on ? '■ Stopp' : '🎙'}</button>}
        <button type="button" className="btn small sec" style={{ background: 'var(--card)' }} onClick={() => setOpen(false)}>Abbrechen</button>
      </div>
      {hint && <span className="tiny">{hint}</span>}
    </div>
  );
}
