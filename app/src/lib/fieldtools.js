// v0.88 (Mateo): überall in Eingabefeldern
//  ✕  = Inhalt mit einem Tipp löschen (erscheint rechts im Feld, solange es aktiv ist und Text hat)
//  ✨  = in größeren Textfeldern: diktierten/unsortierten Text von der KI ordnen lassen (↶ macht es rückgängig)
// Funktioniert ohne Änderungen an den einzelnen Bildschirmen: setzt den Wert wie eine Eingabe, React bekommt ein input-Ereignis.
import { getAi } from './ai';
import { searchWithTool } from './outings';
import { toast } from '../components/ui';

const TIDY_TOOL = {
  name: 'text_geordnet',
  description: 'Gibt den geordneten Text zurück.',
  input_schema: { type: 'object', properties: { text: { type: 'string', description: 'Der geordnete Text – nur der Text, ohne Einleitung' } }, required: ['text'] },
};
export async function tidyText(text, context = '') {
  const r = await searchWithTool({
    system: `Du ordnest Text, den Mateo eingesprochen oder schnell getippt hat${context ? ` (Feld: „${context}“)` : ''}.
Regeln: ALLE Inhalte behalten, nichts erfinden, nichts weglassen, keine Einleitung, keine Bewertung. Gleiche Sprache wie der Text.
Diktier- und Tippfehler korrigieren, Füllwörter streichen, Zusammengehöriges zusammenfassen und sinnvoll sortieren.
Mehrere Gedanken → kurze Stichpunkte mit „• “ (bei klaren Themen eine kurze Zwischenzeile „Thema:“ davor). Ein einzelner Gedanke → ein sauberer Satz.
Kein Markdown (keine **, keine #). Antworte nur mit "text_geordnet".`,
    user: text,
    tool: TIDY_TOOL,
    maxUses: 0,
    maxTokens: 2500,
    label: 'Text ordnen',
  });
  return String(r?.text || '').trim();
}

const OK_TYPES = /^(text|search|url|email|tel|number|)$/;
const usable = (el) => el && !el.readOnly && !el.disabled && el.dataset.noclear === undefined && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && OK_TYPES.test(el.type || '')));
function setValue(el, v) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function installFieldTools() {
  if (typeof document === 'undefined' || window.__fieldTools) return;
  window.__fieldTools = true;
  const mk = (cls, label, txt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `field-tool ${cls}`;
    b.setAttribute('aria-label', label);
    b.textContent = txt;
    b.hidden = true;
    document.body.appendChild(b);
    return b;
  };
  const clearBtn = mk('ft-clear', 'Feld leeren', '✕');
  const tidyBtn = mk('ft-tidy', 'Mit KI ordnen', '✨');
  let cur = null;
  let busy = false;
  let undo = null; // { el, value }
  const place = () => {
    const show = cur && document.contains(cur) && cur.value;
    const r = show ? cur.getBoundingClientRect() : null;
    if (!show || r.width < 80 || r.height === 0) {
      clearBtn.hidden = true;
      tidyBtn.hidden = true;
      cur?.classList.remove('ft-on');
      return;
    }
    const area = cur.tagName === 'TEXTAREA';
    cur.classList.add('ft-on');
    clearBtn.hidden = false;
    const top = area ? r.top + 6 : r.top + r.height / 2 - 13;
    clearBtn.style.top = `${top}px`;
    clearBtn.style.left = `${r.right - 32}px`;
    const canTidy = area && getAi().apiKey && (cur.value.length >= 15 || (undo && undo.el === cur));
    tidyBtn.hidden = !canTidy;
    if (canTidy) {
      tidyBtn.style.top = `${top}px`;
      tidyBtn.style.left = `${r.right - 64}px`;
      tidyBtn.textContent = busy ? '…' : undo && undo.el === cur ? '↶' : '✨';
      tidyBtn.setAttribute('aria-label', undo && undo.el === cur ? 'Ordnen rückgängig' : 'Mit KI ordnen');
    }
  };
  document.addEventListener('focusin', (e) => {
    if (cur && cur !== e.target) cur.classList.remove('ft-on');
    cur = usable(e.target) ? e.target : null;
    place();
  });
  document.addEventListener('focusout', () => setTimeout(() => {
    if (busy) return;
    if (document.activeElement !== cur) {
      cur?.classList.remove('ft-on');
      cur = null;
      place();
    }
  }, 0));
  document.addEventListener('input', (e) => {
    if (e.isTrusted && undo && undo.el === e.target) undo = null; // eigene Eingabe → kein Rückgängig mehr
    if (e.target === cur) place();
  }, true);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
  window.visualViewport?.addEventListener('resize', place);
  window.visualViewport?.addEventListener('scroll', place);
  // Fokus im Feld lassen (sonst schließt sich die Tastatur und onBlur speichert zu früh)
  for (const b of [clearBtn, tidyBtn]) {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('touchstart', (e) => { e.preventDefault(); b.click(); }, { passive: false });
  }
  clearBtn.addEventListener('click', () => {
    if (!cur) return;
    undo = null;
    setValue(cur, '');
    cur.focus();
    place();
  });
  tidyBtn.addEventListener('click', async () => {
    const el = cur;
    if (!el || busy) return;
    if (undo && undo.el === el) {
      const v = undo.value;
      undo = null;
      setValue(el, v);
      el.focus();
      place();
      return;
    }
    const before = el.value;
    busy = true;
    place();
    try {
      const out = await tidyText(before, el.getAttribute('aria-label') || el.placeholder || '');
      if (out && el.value === before) {
        setValue(el, out);
        undo = { el, value: before };
      }
    } catch (e) {
      const msg = e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel.' : e.message;
      toast(msg);
    } finally {
      busy = false;
      if (document.contains(el)) el.focus();
      place();
    }
  });
}
