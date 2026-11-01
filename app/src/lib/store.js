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
  // Version 0.45: „Optionen“ einer Reise-Idee werden wieder eigene Ideen – zusammengehalten durch eine Gruppe (einmalig)
  if (!s.profile?.mig045) {
    const add = [];
    for (const tr of s.trips) {
      if (!(tr.options || []).length) continue;
      for (const o of tr.options) {
        add.push(normalizeTrip({ id: Math.random().toString(36).slice(2, 10), name: o.ziel, dest: [o.ziel, o.land].filter(Boolean).join(', '), status: 'idee', group: tr.name,
          info: [o.kurz, o.info].filter(Boolean).join('\n'), prices: { flug: o.flug, unterkunft: o.unterkunft, gesamt: o.gesamt, urlFlug: o.urlFlug, urlStay: o.urlStay }, createdAt: tr.createdAt }));
      }
      tr.options = [];
      tr.group = tr.name;
      tr.dropMe = tr.status === 'idee' && !tr.stops.length && !tr.places.length && !(tr.variants || []).length && !tr.idea;
    }
    s.trips = [...s.trips.filter((x) => !x.dropMe), ...add];
    s.profile = { ...(s.profile || {}), mig045: true };
  }
  // Version 0.91: KI-Texte aus den Notizen alter Reise-Ideen in die KI-Infos verschieben – Notizen gehören Mateo (einmalig)
  if (!s.profile?.mig091) {
    const KI = /(Warum|Highlights|Beste Zeit|Reisezeit|Anreise|Kosten|Dauer|Flug|Unterkunft|Gesamt)\s*:/;
    for (const tr of s.trips) {
      if (tr.idea && KI.test(tr.idea)) {
        tr.info = [tr.info, tr.idea].filter(Boolean).join('\n');
        tr.idea = '';
      }
    }
    s.profile = { ...(s.profile || {}), mig091: true };
  }
  // Version 0.94: importierte Kontakte bekamen automatisch „monatlich melden“ → alle waren sofort fällig.
  // Rhythmus nur bei Freunden mit Standard 30 Tage und noch keinem notierten Kontakt entfernen (einmalig)
  // Version 1.04: Hobbys sind aufgebaut wie Weiterentwicklung (To-dos + Material) – alte Ideen umziehen (einmalig)
  // v1.37 (Mateo): „Körperliche Gesundheit“ heißt überall nur noch „Gesundheit“
  if (!s.profile?.mig137) {
    const a = (s.areas || []).find((x) => x.id === 'koerper');
    if (a && a.name === 'Körperliche Gesundheit') a.name = 'Gesundheit';
    s.profile = { ...(s.profile || {}), mig137: true };
  }
  if (!s.profile?.mig104) {
    const LAST = { song: 2, video: 2, buch: 2, uebung: 2, link: 0 };
    for (const h of s.hobbies || []) {
      h.hobby = true;
      h.todos = h.todos || [];
      h.materials = h.materials || [];
      for (const it of h.items || []) {
        const done = it.status === 'geschafft';
        if (!it.kind || it.kind === 'idee') h.todos.push({ id: it.id, text: it.title, done, doneAt: done ? it.doneAt || null : null });
        else h.materials.push({ id: it.id, type: it.kind, title: it.title, author: '', url: it.url || '', note: it.why || it.note || '', stage: done ? LAST[it.kind] ?? 0 : 0, addedAt: it.addedAt || '' });
      }
      if ((h.items || []).length) h.itemsOld = h.items;
      h.items = [];
    }
    s.profile = { ...(s.profile || {}), mig104: true };
  }
  if (!s.profile?.mig094) {
    for (const p of s.people || []) if (p.category === 'freunde' && p.contactEvery === 30 && !(p.contacts || []).length) p.contactEvery = null;
    s.profile = { ...(s.profile || {}), mig094: true };
  }
  // Version 0.34: Finanzen ist jetzt ein Rechner – alte Rhythmen/Fokus-Themen dort entfernen (einmalig)
  if (!s.profile?.mig034) {
    s.habits = (s.habits || []).filter((h) => h.areaId !== 'finanzen');
    s.profile = { ...(s.profile || {}), mig034: true };
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

// ---------- Laden und Speichern (v1.52: abgesichert) ----------
// Grundsatz: Echte Daten werden NIE durch leere Anfangsdaten überschrieben.
// - Lässt sich der gespeicherte Stand nicht lesen (kaputt) oder nicht umstellen (Migrationsfehler),
//   startet die App im Rettungsmodus: Speichern ist gesperrt, die Rohdaten bleiben unangetastet
//   und werden zusätzlich unter RESCUE_KEY gesichert. Die Oberfläche bietet Sicherung laden / Rohdaten herunterladen.
// - Scheitert das Speichern (z.B. Speicher voll), merkt sich die App den Fehler und zeigt ihn an.
// - Einmal am Tag wird der zuletzt erfolgreich geladene Stand als automatische Sicherung (AUTO_KEY) behalten.
export const RESCUE_KEY = 'life-app-v1-rescue';
export const AUTO_KEY = 'life-app-v1-auto';
const status = { mode: 'ok', loadError: '', saveError: '', savedAt: 0 };
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);

function keepAutoBackup(raw) {
  const st = ls();
  if (!st || !raw) return;
  try {
    const prev = JSON.parse(st.getItem(AUTO_KEY) || 'null');
    const day = new Date().toISOString().slice(0, 10);
    if (prev && prev.day === day) return; // höchstens einmal am Tag
    if (raw.length > 2_000_000) return; // sehr große Stände nicht doppelt ablegen (Speicher-Grenze)
    st.setItem(AUTO_KEY, JSON.stringify({ day, raw }));
  } catch {}
}

function load() {
  const st = ls();
  let raw = null;
  try { raw = st ? st.getItem(KEY) : null; } catch (e) { raw = null; status.loadError = String(e?.message || e); }
  if (!raw) return seed(); // wirklich noch nichts gespeichert → neuer Start ist richtig
  let parsed;
  try {
    parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.areas)) throw new Error('Unerwartetes Format');
  } catch (e) {
    return enterRescue(raw, `Gespeicherte Daten sind beschädigt (${e.message})`);
  }
  try {
    const s = migrate(parsed);
    keepAutoBackup(raw);
    return s;
  } catch (e) {
    console.error('Umstellen fehlgeschlagen', e);
    return enterRescue(raw, `Daten konnten nicht auf die neue Version umgestellt werden (${e.message})`);
  }
}

function enterRescue(raw, why) {
  status.mode = 'rescue';
  status.loadError = why;
  try { if (ls() && !ls().getItem(RESCUE_KEY)) ls().setItem(RESCUE_KEY, raw); } catch {}
  return seed();
}

let state = load();
let timer = null;

function flush() {
  clearTimeout(timer);
  timer = null;
  if (status.mode === 'rescue') return; // Rettungsmodus: nichts überschreiben
  const st = ls();
  if (!st) return;
  try {
    st.setItem(KEY, JSON.stringify(state));
    if (status.saveError) { status.saveError = ''; notifyStatus(); }
    status.savedAt = Date.now();
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
    const full = /quota|exceeded|full/i.test(String(e?.name) + String(e?.message));
    status.saveError = full ? 'Der Speicher auf diesem Gerät ist voll.' : `Speichern ist fehlgeschlagen (${e?.message || e}).`;
    notifyStatus();
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

// Zustand des Speichers für die Oberfläche (Rettungsmodus, Speicherfehler)
const statusListeners = new Set();
let statusSnap = { ...status };
function notifyStatus() { statusSnap = { ...status }; statusListeners.forEach((l) => l()); }
export const storage = {
  get: () => statusSnap,
  subscribe(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
  retry() { flush(); },
  rescueRaw() { try { return ls()?.getItem(RESCUE_KEY) || ls()?.getItem(KEY) || ''; } catch { return ''; } },
  autoBackup() { try { return JSON.parse(ls()?.getItem(AUTO_KEY) || 'null'); } catch { return null; } },
  // Rettungsmodus verlassen, indem ein gültiger Stand (Sicherung) geladen wird
  restore(data) {
    const next = migrate(structuredClone(data));
    status.mode = 'ok';
    status.loadError = '';
    state = next;
    flush();
    try { ls()?.removeItem(RESCUE_KEY); } catch {}
    notifyStatus();
    listeners.forEach((l) => l());
  },
  // Bewusst leer neu starten (alte Rohdaten bleiben unter RESCUE_KEY liegen)
  startFresh() {
    status.mode = 'ok';
    status.loadError = '';
    state = seed();
    flush();
    notifyStatus();
    listeners.forEach((l) => l());
  },
};
export function useStorageStatus() {
  return useSyncExternalStore(storage.subscribe, storage.get);
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
    state = migrate(structuredClone(next));
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
