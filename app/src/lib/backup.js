// Sicherung (Export/Import) als reine Funktionen – dadurch automatisch testbar (test/backup.test.mjs).
// Eine Sicherung ist der komplette Datenstand als JSON; „Komplett“ nimmt zusätzlich die
// Geräte-Einstellungen (life-*-Schlüssel aus localStorage, z.B. KI-Schlüssel, Aussehen) als `_device` mit.

export const DATA_KEY = 'life-app-v1';
// Diese Schlüssel gehören nicht in eine Sicherung: der Datenstand selbst, Zwischenspeicher, Rettungs-/Auto-Kopien
const SKIP = (k) => k === DATA_KEY || k.startsWith('life-td-') || k.startsWith('life-app-v1-');

export function deviceData(storage) {
  const d = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith('life-') && !SKIP(k)) d[k] = storage.getItem(k);
    }
  } catch {}
  return d;
}

export function makeBackup(state, { device = null } = {}) {
  const out = { ...state, _backup: { app: 'life', at: new Date().toISOString(), version: state.version } };
  if (device) out._device = device;
  return JSON.stringify(out, null, 2);
}

// Prüft eine Sicherungsdatei. Wirft einen verständlichen Fehler, wenn sie nicht passt.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(String(text || ''));
  } catch {
    throw new Error('Die Datei ist kein lesbares JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Die Datei enthält keine Life-Daten.');
  if (!Array.isArray(data.areas) || !Array.isArray(data.pillars)) throw new Error('Das ist keine Life-Sicherung (Bereiche fehlen).');
  const { _device: device, _backup: meta, ...state } = data;
  return { state, device: device && typeof device === 'object' ? device : null, meta: meta || null };
}

// Kurze Zusammenfassung zum Prüfen vor dem Laden („48 Personen · 120 Aufgaben …“)
export function summarize(s) {
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  return [
    [n(s.tasks), 'Aufgaben'], [n(s.people), 'Personen'], [n(s.places), 'Orte'], [n(s.events), 'Events'],
    [n(s.trips), 'Reisen'], [n(s.recipes), 'Rezepte'], [n(s.library), 'Bibliothek'], [n(s.gatherings), 'Treffen'],
  ].filter(([c]) => c > 0).map(([c, l]) => `${c} ${l}`).join(' · ') || 'keine Einträge';
}

export function writeDevice(storage, device) {
  if (!device) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(device)) {
    if (k.startsWith('life-') && !SKIP(k) && typeof v === 'string') {
      try { storage.setItem(k, v); n++; } catch {}
    }
  }
  return n;
}
