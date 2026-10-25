// Speicher der App: alle Daten liegen als ein Objekt im Browser-Speicher deines Geräts.
// Später wird hier die Cloud-Synchronisation (Supabase) angeschlossen.
import { useSyncExternalStore } from 'react';
import { AREA_ICONS, seed } from './seed';

const KEY = 'life-app-v1';
const listeners = new Set();

function migrate(s) {
  const base = seed();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  // Version 0.2: Symbole für Lebensbereiche
  s.areas.forEach((a) => {
    if (!a.icon) a.icon = AREA_ICONS[a.id] || 'circle';
  });
  s.version = base.version;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Laden fehlgeschlagen', e);
  }
  return seed();
}

let state = load();
let timer = null;

function flush() {
  clearTimeout(timer);
  timer = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
  }
}

function persist() {
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) flush();
  });
}

export const store = {
  get: () => state,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  // Änderungen: fn bekommt eine Kopie, die verändert werden darf
  update(fn) {
    const draft = structuredClone(state);
    fn(draft);
    state = draft;
    persist();
    listeners.forEach((l) => l());
  },
  replace(next) {
    state = migrate(next);
    flush();
    listeners.forEach((l) => l());
  },
};

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get);
}

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

// Bitte das Betriebssystem, die Daten nicht automatisch zu löschen
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
