// v1.25/v1.30 (Mateo): „🎙 Mit KI ausfüllen“ ganz oben in Formularen.
// Ein Tipp = sofort sprechen (oder ✍️ schreiben). Was schon im Formular steht, nutzt die KI mit.
// Zwei Arten: onFill(text) (eigener Leser) oder fields + values + onResult (allgemeiner Formular-Füller).
import { useEffect, useRef, useState } from 'react';
import { getAi } from '../lib/ai';
import { fillForm } from '../lib/formfill';
import { canDictate, useDictation } from '../lib/dictate';
import { Icon, toast } from './ui';

const filledText = (values, fields) => Object.entries(values || {})
  .filter(([k, v]) => (!fields || fields[k]) && v != null && typeof v !== 'object' && String(v).trim() && !/^(id|key)$/.test(k))
  .map(([k, v]) => `${k}: ${v}`).join(', ');

export default function AiFill({ placeholder = 'Erzähl kurz oder füg Link/Text ein …', onFill, hint, fields, values, onResult, title = 'Eintrag', aiHint = '', autoOpen = false }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const mic = useDictation(txt, setTxt);
  const txtRef = useRef(txt); txtRef.current = txt;
  const ctx = filledText(values, fields);
  const hasKey = !!getAi().apiKey;
  useEffect(() => { if (autoOpen) talk(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const talk = () => { setOpen(true); if (canDictate) mic.start(); };
  const run = async () => {
    mic.stop();
    await new Promise((r) => setTimeout(r, 80));
    const said = txtRef.current.trim();
    setBusy(true);
    try {
      if (fields) {
        const r = await fillForm({ title, fields, values, text: said, hint: aiHint });
        if (!Object.keys(r).length) throw new Error('Nichts erkannt – erzähl etwas mehr');
        onResult(r);
      } else {
        await onFill([said, ctx && `(Schon im Formular: ${ctx})`].filter(Boolean).join('\n'));
      }
      setTxt(''); setOpen(false); toast('Ausgefüllt – kurz prüfen');
    } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es den KI-Schlüssel (Einstellungen)' : e.message); }
    setBusy(false);
  };
  if (!hasKey) return null;
  if (!open) return (
    <div className="aifill-row">
      <button type="button" className="btn tint small" style={{ flex: 1 }} onClick={talk}>🎙 Mit KI ausfüllen</button>
      <button type="button" className="btn tint small" onClick={() => setOpen(true)} aria-label="Für die KI schreiben">✍️</button>
      {ctx && <button type="button" className="btn tint small" onClick={run} disabled={busy} aria-label="Rest mit KI ausfüllen">{busy ? '…' : '✨ Rest'}</button>}
    </div>
  );
  return (
    <div className="card" style={{ gap: 8, background: 'var(--card-2)', boxShadow: 'none', padding: 12 }}>
      <textarea className="input" style={{ minHeight: 70 }} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={mic.on ? '🎙 Ich höre zu, auch bei Pausen … ⏹ = fertig, dann fülle ich aus' : placeholder} autoFocus={!mic.on} />
      {/* v1.32: gleiche Anordnung wie alle KI-Boxen – links 🎙, rechts ausführen */}
      <div className="ai-input-row">
        {/* v1.48 (Mateo): das Mikro hört auch über Pausen weiter zu, bis du Stopp tippst – Stopp füllt dann gleich aus */}
        {canDictate && <button type="button" className={mic.on ? 'mic on' : 'mic'} onClick={() => { if (mic.on) { mic.stop(); if (txtRef.current.trim()) setTimeout(run, 120); } else mic.start(); }} aria-label={mic.on ? 'Stopp und ausfüllen' : 'Einsprechen'}><Icon name={mic.on ? 'stop' : 'mic'} size={18} /></button>}
        <button type="button" className="link-btn" style={{ fontSize: 14, flex: 1, textAlign: 'left' }} onClick={() => { mic.stop(); setOpen(false); }}>Abbrechen</button>
        <button type="button" className="btn small" disabled={(!txt.trim() && !ctx && !mic.on) || busy} onClick={run}>{busy ? 'Ich fülle aus …' : txt.trim() || mic.on ? '✨ Ausfüllen' : '✨ Rest ausfüllen'}</button>
      </div>
      {(hint || ctx) && <span className="tiny">{ctx ? 'Was schon im Formular steht, nutzt die KI mit. ' : ''}{hint || ''}</span>}
    </div>
  );
}
