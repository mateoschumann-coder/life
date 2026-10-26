// Speicher der App: alle Daten liegen als ein Objekt im Browser-Speicher deines Geräts.
// Später wird hier die Cloud-Synchronisation (Supabase) angeschlossen.
import { useSyncExternalStore } from 'react';
import { AREA_ICONS, seed } from './seed';
import { normalizeGathering, normalizeTrip } from './normalize';

const KEY = 'life-app-v1';
const listeners = new Set();

function migrate(s) {
  const base = seed();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  // Version 0.2: Symbole für Lebensbereiche
  s.areas.forEach((a) => {
    if (!a.icon) a.icon = AREA_ICONS[a.id] || 'circle';
  });
  // Version 0.3: Farbwelt „Salbei und Sand“ (alte Standardfarben ersetzen)
  // Version 0.6: Kai-Farben (ersetzt alle bisherigen Standardfarben)
  const OLD = { '#6E62D6': 0, '#D2642E': 1, '#13805F': 2, '#7A8F6A': 0, '#C4876B': 1, '#5F7C99': 2 };
  s.pillars.forEach((p) => {
    if (p.color in OLD) p.color = base.pillars[OLD[p.color]].color;
  });
  // Version 0.15: „Mentale Gesundheit“ wird „Lernen & Wissen“ (Themen = Unterbereiche); leere alte Unterbereiche weg
  const mental = s.areas.find((a) => a.id === 'mental');
  if (mental && mental.name === 'Mentale Gesundheit') {
    mental.name = 'Lernen & Wissen';
    mental.icon = 'bulb';
    const used = (subId) => [s.tasks, s.habits, s.projects, s.resources].some((list) => list.some((x) => x.subId === subId));
    mental.subs = mental.subs.filter((x) => !['Reflexion', 'Erholung', 'Achtsamkeit'].includes(x.name) || used(x.id));
    ['Geschichte', 'Physik', 'Geopolitik', 'Wirtschaft'].forEach((n, i) => {
      if (!mental.subs.some((x) => x.name === n)) mental.subs.push({ id: 'w' + i + Date.now().toString(36), name: n });
    });
  }
  // Version 0.16: Finanzen vorerst pausiert (Mateo, 26.10.2026) – nur einmal, danach frei änderbar
  if (!s.profile?.mig016) {
    const fin = s.areas.find((a) => a.id === 'finanzen');
    if (fin) fin.paused = true;
    s.profile = { ...(s.profile || {}), mig016: true };
  }
  // Version 0.21: Reisen (Ideen, Stationen, Orte, Transport, Unterlagen) und Events (zu Hause / woanders)
  s.trips.forEach(normalizeTrip);
  s.gatherings.forEach(normalizeGathering);
  // Version 0.23: Material bekommt eine Kategorie (Podcasts → „Podcasts“, sonst „Bibliothek“)
  s.library.forEach((m) => { if (!m.cat) m.cat = m.kind === 'podcast' && s.libCats.some((c) => c.id === 'podcasts') ? 'podcasts' : s.libCats[0]?.id || 'bibliothek'; });
  // Version 0.29: Mahlzeit-Kategorien für Rezepte (einmalig)
  if (!s.profile?.mig029) {
    for (const c of ['Frühstück', 'Mittagessen', 'Abendessen', 'Snacks']) if (!s.recipeCats.includes(c)) s.recipeCats.push(c);
    s.profile = { ...(s.profile || {}), mig029: true };
  }
  // Version 0.31: Finanzen ans Ende von „Persönlich“ (einmalig)
  if (!s.profile?.mig031) {
    const i = s.areas.findIndex((a) => a.id === 'finanzen');
    if (i >= 0) {
      const [fin] = s.areas.splice(i, 1);
      let last = -1;
      s.areas.forEach((a, j) => { if (a.pillarId === fin.pillarId) last = j; });
      s.areas.splice(last + 1, 0, fin);
    }
    s.profile = { ...(s.profile || {}), mig031: true };
  }
  // Version 0.29: Bewerbungs-Phasen „Gefunden/Vorbereiten“ → „Interessiert“
  (s.jobs || []).forEach((j) => { if (j.status === 'gefunden' || j.status === 'vorbereiten') j.status = 'interessiert'; });
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
