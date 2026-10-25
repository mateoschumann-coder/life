// Gemeinsamer Zustand des Assistenten: Der große Chat und der schwebende Knopf
// teilen sich dasselbe Gespräch, Sprache und Vorlesen.
import { useSyncExternalStore } from 'react';
import { askClaude, getAi, loadChat, saveAi, saveChat } from './ai';
import { applyActions, describe } from './apply';
import { store } from './store';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let state = { items: loadChat(), busy: false, listening: false, draft: '' };
const listeners = new Set();
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

// Nachricht senden
export async function send(text) {
  const content = (text ?? state.draft).trim();
  if (!content || state.busy) return;
  const base = state.items.map((it) => (it.status === 'open' ? { ...it, status: 'skipped' } : it));
  const withUser = [...base, { id: newId(), role: 'user', text: content }];
  set({ items: withUser, draft: '', busy: true });
  try {
    const r = await askClaude(store.get(), withUser);
    const reply = {
      id: newId(), role: 'assistant', text: r.text, toolUseId: r.toolUseId, actions: r.actions,
      selected: r.actions.map(() => true), status: r.toolUseId ? 'open' : null,
    };
    set({ items: [...withUser, reply], busy: false });
    if (getAi().speak) speak(r.text || (r.actions.length ? 'Ich habe dir einen Vorschlag gemacht.' : ''));
  } catch (e) {
    const msg = e.message === 'KEIN_SCHLUESSEL' ? 'Es ist noch kein API-Schlüssel hinterlegt.' : e.message;
    set({ items: [...withUser, { id: newId(), role: 'assistant', text: '', error: msg }], busy: false });
  }
}

// Vorschlag übernehmen oder verwerfen
export function decide(itemId, apply) {
  const s = store.get();
  let count = 0;
  const items = state.items.map((it) => {
    if (it.id !== itemId) return it;
    if (!apply) return { ...it, status: 'rejected' };
    const chosen = it.actions.filter((a, i) => it.selected[i] && describe(s, a).ok);
    const labels = applyActions(chosen);
    count = labels.length;
    return { ...it, status: 'applied', appliedLabels: labels };
  });
  set({ items });
  return count;
}
export function toggleSelected(itemId, idx) {
  set({ items: state.items.map((it) => (it.id === itemId ? { ...it, selected: it.selected.map((v, i) => (i === idx ? !v : v)) } : it)) });
}

// Spracheingabe
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const speechAvailable = !!SR;
let rec = null;
// onError bekommt eine verständliche Meldung
export function startListening({ continuous = false, onError } = {}) {
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
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') onError?.('Mikrofon nicht erlaubt – bitte erlauben oder das Mikrofon der Tastatur nutzen');
    else if (e.error !== 'aborted' && e.error !== 'no-speech') onError?.('Spracheingabe fehlgeschlagen – bitte noch einmal versuchen');
  };
  rec.onend = () => set({ listening: false });
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
