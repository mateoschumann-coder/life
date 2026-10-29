// v0.88 (Mateo): überall in Eingabefeldern
//  ✕  = Inhalt mit einem Tipp löschen (erscheint rechts im Feld, solange es aktiv ist und Text hat)
//  ✨  = in größeren Textfeldern: diktierten/unsortierten Text von der KI ordnen lassen (↶ macht es rückgängig)
// Funktioniert ohne Änderungen an den einzelnen Bildschirmen: setzt den Wert wie eine Eingabe, React bekommt ein input-Ereignis.
import { getAi } from './ai';
import { searchWithTool } from './outings';
import { toast } from '../components/ui';

// v0.89 (Mateo): nicht schöner Fließtext, sondern klar gegliedert – Oberthemen, Unterthemen, Stichpunkte mit dem Wichtigsten
const PUNKTE = { type: 'array', items: { type: 'string' }, description: 'kurze Stichpunkte (meist 3–10 Wörter), das Wichtigste zuerst' };
const TIDY_TOOL = {
  name: 'text_gegliedert',
  description: 'Der Text, gegliedert in Themen, Unterthemen und Stichpunkte.',
  input_schema: {
    type: 'object',
    properties: {
      kern: { type: 'string', description: 'Optional: die wichtigste Aussage in einem kurzen Satz (nur bei längeren Texten)' },
      themen: {
        type: 'array',
        description: 'Oberthemen in sinnvoller Reihenfolge',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string', description: '1–4 Wörter' },
            punkte: PUNKTE,
            unterthemen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, punkte: PUNKTE }, required: ['titel', 'punkte'] }, description: 'Nur wenn ein Thema mehrere klar getrennte Aspekte hat' },
          },
          required: ['titel'],
        },
      },
    },
    required: ['themen'],
  },
};
// Gliederung → Text, der in jedem Feld lesbar bleibt (■ Oberthema, ▸ Unterthema, • Punkt)
export function outlineText(r) {
  const out = [];
  if (r?.kern) out.push(`💡 ${r.kern}`, '');
  for (const th of r?.themen || []) {
    out.push(`■ ${th.titel}`);
    for (const p of th.punkte || []) out.push(`• ${p}`);
    for (const u of th.unterthemen || []) {
      out.push(`  ▸ ${u.titel}`);
      for (const p of u.punkte || []) out.push(`    – ${p}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}
export async function tidyText(text, context = '') {
  const r = await searchWithTool({
    system: `Du gliederst Text, den Mateo eingesprochen oder schnell getippt hat${context ? ` (Feld: „${context}“)` : ''}.
Ziel: KEIN schöner Fließtext, sondern eine klare Gliederung zum Überfliegen:
- Oberthemen (1–4 Wörter) → darunter kurze Stichpunkte mit den wichtigsten Inhalten (das Wichtigste zuerst).
- Hat ein Thema mehrere klar getrennte Aspekte, Unterthemen mit eigenen Stichpunkten bilden.
- Bei längeren Texten oben die wichtigste Aussage als „kern“.
- Kurzer Text mit nur einem Gedanken: ein Thema mit 1–3 Stichpunkten.
Regeln: ALLE Inhalte behalten (Zahlen, Namen, Termine), nichts erfinden, Doppeltes zusammenfassen, Diktierfehler und Füllwörter entfernen. Gleiche Sprache wie der Text. Antworte nur mit "text_gegliedert".`,
    user: text,
    tool: TIDY_TOOL,
    maxUses: 0,
    maxTokens: 3000,
    label: 'Text ordnen',
  });
  return outlineText(r);
}

const OK_TYPES = /^(text|search|url|email|tel|number|)$/;
const usable = (el) => el && !el.readOnly && !el.disabled && el.dataset.noclear === undefined && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && OK_TYPES.test(el.type || '')));
function setValue(el, v) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// v1.16 (Mateo): Links, die man aus der App öffnet, werden automatisch kopiert und gemerkt;
// in Link-Feldern erscheint 📋 zum Einfügen (Zwischenablage, sonst der zuletzt geöffnete Link)
const LAST = 'life-app-lastlinks';
export const autoCopyOn = () => { try { return localStorage.getItem('life-app-autocopy') !== '0'; } catch { return true; } };
export const setAutoCopy = (on) => { try { localStorage.setItem('life-app-autocopy', on ? '1' : '0'); } catch {} };
export function lastLinks() { try { return JSON.parse(localStorage.getItem(LAST) || '[]'); } catch { return []; } }
function rememberLink(url) {
  if (!/^https?:\/\//i.test(url || '') || url.startsWith(location.origin)) return;
  try { localStorage.setItem(LAST, JSON.stringify([url, ...lastLinks().filter((u) => u !== url)].slice(0, 10))); } catch {}
  if (autoCopyOn()) { try { navigator.clipboard?.writeText(url).catch(() => {}); } catch {} }
}
const LINKISH = /link|url|http|webseite|website|adresse der seite|inserat/i;
const isLinkField = (el) => el && el.dataset.paste !== undefined || (el && (el.type === 'url' || LINKISH.test(`${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`)));

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
  const pasteBtn = mk('ft-paste', 'Link einfügen', '📋');
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && /^https?:/i.test(a.href) && !a.href.startsWith(location.origin)) rememberLink(a.href);
  }, true);
  const origOpen = window.open;
  window.open = function (url, ...rest) { if (typeof url === 'string') rememberLink(url); return origOpen.call(window, url, ...rest); };
  let cur = null;
  let busy = false;
  let undo = null; // { el, value } – nach ✨ Ordnen
  let cleared = null; // { el, value } – nach ✕ Leeren (dann wird ✕ zu ↶)
  // v0.93: Knöpfe sitzen als Geschwister direkt neben dem Feld (position: absolute) statt „fixed“ –
  // so scrollen sie mit dem Feld mit und springen auf dem iPhone nicht herum, wenn die Tastatur aufgeht.
  const park = () => {
    for (const b of [clearBtn, tidyBtn, pasteBtn]) {
      b.hidden = true;
      if (b.parentNode !== document.body) document.body.appendChild(b);
    }
  };
  // nicht in ein <label> setzen (sonst wird der Knopf Teil des Feldnamens) – dann direkt hinter das Label
  const anchorOf = (el) => (el.parentNode?.tagName === 'LABEL' && el.parentNode.parentNode ? el.parentNode : el);
  const attach = (b, el) => {
    const a = anchorOf(el);
    const prev = b === clearBtn ? a : clearBtn;
    if (b.parentNode !== a.parentNode || b.previousSibling !== prev) a.parentNode.insertBefore(b, prev.nextSibling);
  };
  const putAt = (b, x, y) => {
    b.style.left = '0px';
    b.style.top = '0px';
    const o = b.getBoundingClientRect();
    b.style.left = `${Math.round(x - o.left)}px`;
    b.style.top = `${Math.round(y - o.top)}px`;
  };
  const place = () => {
    const canRestore = cur && cleared && cleared.el === cur && !cur.value;
    const wantPaste = cur && document.contains(cur) && cur.parentNode && !cur.value && !canRestore && isLinkField(cur);
    if (wantPaste) {
      const rp = cur.getBoundingClientRect();
      if (rp.width >= 70 && rp.height > 0) {
        clearBtn.hidden = true; tidyBtn.hidden = true;
        const a = anchorOf(cur);
        if (pasteBtn.previousSibling !== a) a.parentNode.insertBefore(pasteBtn, a.nextSibling);
        pasteBtn.hidden = false;
        putAt(pasteBtn, rp.right - 32, cur.tagName === 'TEXTAREA' ? rp.top + 6 : rp.top + rp.height / 2 - 13);
        return;
      }
    }
    pasteBtn.hidden = true;
    const show = cur && document.contains(cur) && cur.parentNode && (cur.value || canRestore);
    const r = show ? cur.getBoundingClientRect() : null;
    if (!show || r.width < 70 || r.height === 0) {
      cur?.classList.remove('ft-on');
      park();
      return;
    }
    const area = cur.tagName === 'TEXTAREA';
    cur.classList.add('ft-on');
    attach(clearBtn, cur);
    clearBtn.hidden = false;
    clearBtn.textContent = canRestore ? '↶' : '✕';
    clearBtn.setAttribute('aria-label', canRestore ? 'Gelöschten Text zurückholen' : 'Feld leeren');
    const top = area ? r.top + 6 : r.top + r.height / 2 - 13;
    putAt(clearBtn, r.right - 32, top);
    const canTidy = area && getAi().apiKey && (cur.value.length >= 15 || (undo && undo.el === cur));
    if (canTidy) {
      attach(tidyBtn, cur);
      tidyBtn.hidden = false;
      tidyBtn.textContent = busy ? '…' : undo && undo.el === cur ? '↶' : '✨';
      tidyBtn.setAttribute('aria-label', undo && undo.el === cur ? 'Ordnen rückgängig' : 'Mit KI ordnen');
      putAt(tidyBtn, r.right - 64, top);
    } else {
      tidyBtn.hidden = true;
      if (tidyBtn.parentNode !== document.body) document.body.appendChild(tidyBtn);
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
    if (e.isTrusted && cleared && cleared.el === e.target && e.target.value) cleared = null;
    if (e.target === cur) place();
  }, true);
  window.addEventListener('resize', place);
  window.visualViewport?.addEventListener('resize', place);
  // Fokus im Feld lassen (sonst schließt sich die Tastatur und onBlur speichert zu früh)
  pasteBtn.addEventListener('click', async () => {
    const el = cur;
    if (!el) return;
    let txt = '';
    try { txt = (await navigator.clipboard?.readText()) || ''; } catch {}
    if (!txt.trim()) { txt = lastLinks()[0] || ''; if (txt) toast('Zuletzt geöffneter Link eingefügt'); }
    if (!txt.trim()) { toast('Nichts zum Einfügen – Link zuerst kopieren'); return; }
    setValue(el, txt.trim());
    el.focus();
    place();
  });
  for (const b of [clearBtn, tidyBtn, pasteBtn]) {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('touchstart', (e) => { e.preventDefault(); b.click(); }, { passive: false });
  }
  clearBtn.addEventListener('click', () => {
    if (!cur) return;
    undo = null;
    if (cleared && cleared.el === cur && !cur.value) {
      setValue(cur, cleared.value);
      cleared = null;
      cur.focus();
      place();
      return;
    }
    cleared = { el: cur, value: cur.value };
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
