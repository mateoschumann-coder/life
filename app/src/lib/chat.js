// Gemeinsamer Zustand des Assistenten: Der große Chat und der schwebende Knopf
// teilen sich dasselbe Gespräch, Sprache und Vorlesen.
import { useSyncExternalStore } from 'react';
import { askClaude, getAi, loadChat, saveAi, saveChat } from './ai';
import { applyActions, describe, lastProjectId } from './apply';
import { go } from './router';
import { store } from './store';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let state = { items: loadChat(), busy: false, listening: false, draft: '', mode: 'assistent' }; // v0.95: Coach entfernt – nur noch der Assistent
const listeners = new Set();
const snapshots = new Map(); // Stand vor einer Änderung → „Rückgängig“ (nur in dieser Sitzung)
const set = (patch) => {
  state = { ...state, ...patch };
  if (patch.items) saveChat(state.items);
  listeners.forEach((l) => l());
};
export const chat = {
  get: () => state,
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
export function useChat() {
  return useSyncExternalStore(chat.subscribe, chat.get);
}
export const setDraft = (draft) => set({ draft });
export const clearChat = () => set({ items: [] });
export function setMode() {
  saveAi({ chatMode: 'assistent' });
  set({ mode: 'assistent' });
}

// Nachricht senden
export async function send(text) {
  const content = (text ?? state.draft).trim();
  if (!content || state.busy) return;
  const base = state.items.map((it) => (it.status === 'open' ? { ...it, status: 'skipped' } : it));
  const withUser = [...base, { id: newId(), role: 'user', text: content, mode: state.mode }];
  set({ items: withUser, draft: '' });
  await run(withUser);
}
async function run(withUser) {
  set({ busy: true });
  try {
    const r = await askClaude(store.get(), withUser, withUser.at(-1)?.mode || state.mode);
    let reply = {
      id: newId(), role: 'assistant', text: r.text, toolUseId: r.toolUseId, actions: r.actions,
      selected: r.actions.map(() => true), status: r.toolUseId ? 'open' : null, failed: r.failed || undefined,
    };
    set({ items: [...withUser, reply], busy: false });
    // Einstellung „Direkt ausführen“: ohne Nachfrage übernehmen (mit Rückgängig-Knopf)
    if (reply.status === 'open' && getAi().autoApply) decide(reply.id, true, { auto: true });
    if (getAi().speak) speak(r.text || (r.actions.length ? 'Ich habe dir einen Vorschlag gemacht.' : ''));
  } catch (e) {
    const msg = e.message === 'KEIN_SCHLUESSEL' ? 'Es ist noch kein API-Schlüssel hinterlegt.'
      : /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Keine Verbindung zur KI (Internet weg oder App im Hintergrund). Tippe auf „Nochmal senden“.'
      : e.message;
    set({ items: [...withUser, { id: newId(), role: 'assistant', text: '', error: msg }], busy: false });
  }
}
// Letzte eigene Nachricht erneut schicken (z.B. nach Fehler oder leerer Antwort)
export function resend() {
  if (state.busy) return;
  const items = [...state.items];
  while (items.length && items.at(-1).role === 'assistant') items.pop();
  if (!items.length) return;
  run(items);
}
// Gibt es eine Nachricht ohne brauchbare Antwort?
export function needsRetry(items) {
  const last = items.at(-1);
  return !!last && (last.role === 'user' || (last.role === 'assistant' && (last.error || last.failed || (!last.text && !(last.actions || []).length))));
}

// Vorschlag übernehmen oder verwerfen
export function decide(itemId, apply, { auto = false } = {}) {
  const s = store.get();
  let count = 0;
  let madeProject = false;
  const items = state.items.map((it) => {
    if (it.id !== itemId) return it;
    if (!apply) return { ...it, status: 'rejected' };
    const chosen = it.actions.filter((a, i) => it.selected[i] && describe(s, a).ok);
    snapshots.set(it.id, s);
    const labels = applyActions(chosen);
    count = labels.length;
    madeProject = chosen.some((a) => a.typ === 'projekt_anlegen');
    return { ...it, status: 'applied', appliedLabels: labels, auto };
  });
  set({ items });
  // Neues Projekt gleich öffnen, damit man es sieht
  if (madeProject && lastProjectId) setTimeout(() => go(`/projekt/${lastProjectId}`), auto ? 600 : 300);
  return count;
}
export const canUndo = (itemId) => snapshots.has(itemId);
export function undo(itemId) {
  const snap = snapshots.get(itemId);
  if (!snap) return;
  store.replace(snap);
  snapshots.delete(itemId);
  set({ items: state.items.map((it) => (it.id === itemId ? { ...it, status: 'rejected', appliedLabels: [] } : it)) });
}
// Vorschlag vor dem Übernehmen selbst ändern (z.B. Tippfehler im Namen)
export function editAction(itemId, idx, patch) {
  set({ items: state.items.map((it) => (it.id === itemId ? { ...it, actions: it.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)) } : it)) });
}
export function toggleSelected(itemId, idx) {
  set({ items: state.items.map((it) => (it.id === itemId ? { ...it, selected: it.selected.map((v, i) => (i === idx ? !v : v)) } : it)) });
}

// Spracheingabe
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const speechAvailable = !!SR;
let rec = null;
let want = null; // { continuous, onError, until } solange weiter zugehört werden soll
// onError bekommt eine verständliche Meldung
export function startListening({ continuous = false, onError } = {}) {
  want = continuous ? { continuous, onError, until: Date.now() + 10 * 60 * 1000 } : null;
  return begin({ continuous, onError });
}
// Das iPhone beendet die Spracherkennung bei Pausen oder nach ca. 1 Minute von selbst.
// Bei langen Sprachnachrichten wird deshalb automatisch weiter zugehört (der Text bleibt erhalten).
function begin({ continuous, onError }) {
  if (!SR) {
    onError?.('Hier nicht verfügbar – nutze das Mikrofon der Tastatur');
    return false;
  }
  stopSpeaking();
  try {
    rec?.abort?.();
  } catch {}
  rec = new SR();
  rec.lang = 'de-DE';
  rec.interimResults = true;
  rec.continuous = continuous;
  const base = state.draft.trim() ? state.draft.trim() + ' ' : '';
  rec.onresult = (e) => {
    let said = '';
    for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
    set({ draft: base + said });
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      want = null;
      onError?.('Mikrofon nicht erlaubt – bitte erlauben oder das Mikrofon der Tastatur nutzen');
    }
    else if (e.error !== 'aborted' && e.error !== 'no-speech') onError?.('Spracheingabe fehlgeschlagen – bitte noch einmal versuchen');
  };
  const me = rec;
  rec.onend = () => {
    if (me !== rec) return;
    if (want && Date.now() < want.until) {
      setTimeout(() => { if (want && me === rec) begin(want); }, 150);
      return;
    }
    want = null;
    set({ listening: false });
  };
  set({ listening: true });
  try {
    rec.start();
    return true;
  } catch {
    set({ listening: false });
    return false;
  }
}
export function stopListening() {
  want = null;
  try {
    rec?.stop();
  } catch {}
  set({ listening: false });
}

// Vorlesen (Sprachausgabe des iPhones)
export function unlockSpeech() {
  // iOS erlaubt Sprachausgabe erst nach einem Tipp; ein leerer Satz schaltet sie frei
  if (typeof speechSynthesis === 'undefined') return;
  try {
    const u = new SpeechSynthesisUtterance('');
    speechSynthesis.speak(u);
  } catch {}
}
export function speak(text) {
  if (!text || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>]/g, ''));
    u.lang = 'de-DE';
    const voice = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('de'));
    if (voice) u.voice = voice;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {}
}
export function stopSpeaking() {
  try {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  } catch {}
}
export function setSpeak(on) {
  saveAi({ speak: on });
  if (!on) stopSpeaking();
  set({});
}
