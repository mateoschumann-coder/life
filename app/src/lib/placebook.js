// Orte-Verzeichnis (v0.91, Mateo): feste Anlaufstellen pro Bereich – Küche (Supermarkt, Metzgerei …),
// Vorsorge (Ärzte, Therapie, Apotheke …). Kategorien + optionale Unterkategorien, eigene ergänzbar.
// Daten: s.placeBook[book] = { cats: [eigene {id,label,emoji,subs}], hidden: [ids], subs: {catId: [eigene Unterkategorien]}, items: [...] }
import { store, uid } from './store';
import { HOME_CITY, searchWithTool } from './outings';

export const BOOKS = {
  kueche: [
    { id: 'supermarkt', label: 'Supermarkt', emoji: '🛒' },
    { id: 'metzgerei', label: 'Metzgerei', emoji: '🥩' },
    { id: 'baeckerei', label: 'Bäckerei', emoji: '🥖' },
    { id: 'gemuese', label: 'Obst & Gemüse', emoji: '🥕' },
    { id: 'markt', label: 'Markt', emoji: '🧺' },
    { id: 'fisch', label: 'Fisch', emoji: '🐟' },
    { id: 'feinkost', label: 'Feinkost & Bio', emoji: '🧀', subs: ['Bio-Laden', 'Dietética', 'Käse', 'Feinkost'] },
    { id: 'getraenke', label: 'Getränke & Wein', emoji: '🍷' },
    { id: 'spezial', label: 'Asia & Spezial', emoji: '🥢', subs: ['Asia', 'Deutsch', 'Italienisch', 'Mexikanisch'] },
    { id: 'drogerie', label: 'Drogerie', emoji: '🧴' },
    { id: 'haushalt', label: 'Haushaltswaren', emoji: '🏠' },
  ],
  // v1.02: Zuhause → Einrichtung / Kleidung (pro Stadt)
  einrichtung: [
    { id: 'moebel', label: 'Möbel', emoji: '🛋', subs: ['Sofas', 'Betten', 'Tische & Stühle', 'Regale'] },
    { id: 'deko', label: 'Deko', emoji: '🖼' },
    { id: 'lampen', label: 'Lampen', emoji: '💡' },
    { id: 'textil', label: 'Textilien', emoji: '🧺', subs: ['Bettwäsche', 'Teppiche', 'Vorhänge'] },
    { id: 'kueche', label: 'Küche & Haushalt', emoji: '🍳' },
    { id: 'baumarkt', label: 'Baumarkt', emoji: '🔨' },
    { id: 'pflanzen', label: 'Pflanzen', emoji: '🪴' },
    { id: 'second', label: 'Second Hand & Antik', emoji: '♻️' },
  ],
  kleidung: [
    { id: 'mode', label: 'Mode', emoji: '👕', subs: ['Basics', 'Elegant', 'Streetwear'] },
    { id: 'schuhe', label: 'Schuhe', emoji: '👟' },
    { id: 'sport', label: 'Sportbekleidung', emoji: '🏃' },
    { id: 'outlet', label: 'Outlet', emoji: '🏷' },
    { id: 'second', label: 'Second Hand', emoji: '♻️' },
    { id: 'accessoires', label: 'Accessoires', emoji: '🕶' },
    { id: 'schneider', label: 'Schneider & Reparatur', emoji: '🧵' },
  ],
  vorsorge: [
    { id: 'arzt', label: 'Ärzte', emoji: '🩺', subs: ['Hausarzt', 'Zahnarzt', 'Augenarzt', 'Hautarzt', 'Orthopäde', 'HNO', 'Kardiologe', 'Sportmedizin'] },
    { id: 'therapie', label: 'Therapie', emoji: '💆', subs: ['Physiotherapie', 'Osteopathie', 'Massage', 'Psychotherapie'] },
    { id: 'apotheke', label: 'Apotheke', emoji: '💊' },
    { id: 'labor', label: 'Labor & Diagnostik', emoji: '🧪', subs: ['Blutabnahme', 'Röntgen / MRT', 'Ultraschall'] },
    { id: 'klinik', label: 'Klinik & Notfall', emoji: '🏥', subs: ['Krankenhaus', 'Notaufnahme / Guardia'] },
    { id: 'sport', label: 'Sport & Fitness', emoji: '🏋️', subs: ['Gym', 'Laufgruppe', 'Schwimmbad'] },
  ],
};

const norm = (x) => String(x || '').trim().toLowerCase();
export const bookOf = (s, book) => ({ cats: [], hidden: [], subs: {}, items: [], ...(s.placeBook?.[book] || {}) });
const upd = (book, fn) => store.update((s) => {
  s.placeBook = { ...(s.placeBook || {}) };
  s.placeBook[book] = bookOf(s, book);
  fn(s.placeBook[book]);
});

export function bookCats(s, book) {
  const b = bookOf(s, book);
  return [...(BOOKS[book] || []).filter((c) => !b.hidden.includes(c.id)), ...b.cats].map((c) => ({ ...c, subs: [...new Set([...(c.subs || []), ...(b.subs[c.id] || [])])] }));
}
export function addBookCat(book, label) {
  const l = String(label || '').trim();
  if (!l) return null;
  const id = `c${uid().slice(0, 8)}`;
  upd(book, (b) => { b.cats.push({ id, label: l, emoji: '📍', subs: [] }); });
  return id;
}
export const removeBookCat = (book, id) => upd(book, (b) => {
  if ((BOOKS[book] || []).some((c) => c.id === id)) b.hidden = [...new Set([...b.hidden, id])];
  else b.cats = b.cats.filter((c) => c.id !== id);
});
export const restoreBookCats = (book) => upd(book, (b) => { b.hidden = []; });
export const addBookSub = (book, catId, sub) => upd(book, (b) => {
  const n = String(sub || '').trim();
  if (n) b.subs = { ...b.subs, [catId]: [...new Set([...(b.subs[catId] || []), n])] };
});

export function addBookItem(book, item) {
  const name = String(item.name || '').trim();
  if (!name) return null;
  const id = uid();
  upd(book, (b) => { b.items.push({ id, cat: '', sub: '', address: '', phone: '', url: '', note: '', fav: false, ...item, name, createdAt: Date.now() }); });
  return id;
}
export const updateBookItem = (book, id, patch) => upd(book, (b) => Object.assign(b.items.find((x) => x.id === id) || {}, patch));
export const removeBookItem = (book, id) => upd(book, (b) => { b.items = b.items.filter((x) => x.id !== id); });
// v1.0: schon eingegebene Viertel („Wo ungefähr?“) merken → beim nächsten Mal als Knöpfe
export function bookAreas(s, book) {
  const n = {};
  for (const x of bookOf(s, book).items) { const a = String(x.area || '').trim(); if (a) n[a] = (n[a] || 0) + 1; }
  for (const a of s.profile?.bookAreas || []) if (!n[a]) n[a] = 0.5;
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b, 'de'));
}
export const rememberArea = (area) => store.update((s) => {
  const a = String(area || '').trim();
  if (!a) return;
  s.profile = { ...(s.profile || {}), bookAreas: [...new Set([...(s.profile?.bookAreas || []), a])] };
});
export const forgetArea = (area) => store.update((s) => {
  s.profile = { ...(s.profile || {}), bookAreas: (s.profile?.bookAreas || []).filter((x) => x !== area) };
});
export const findBookItem = (s, book, id) => bookOf(s, book).items.find((x) => x.id === id) || null;

export const bookMaps = (x) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([x.name, x.address || x.area].filter(Boolean).join(', '))}`;
export const telOf = (p) => String(p || '').replace(/[^\d+]/g, '');
export const sameName = (a, b) => norm(a) === norm(b);

// v0.93: Status (War schon / Will hin) und Bewertung wie bei Ausgehen-Orten
export const BOOK_STATUS = [{ id: 'war', label: 'War schon' }, { id: 'will', label: 'Will hin' }];
export const mapsSearch = (name, area, city) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, area, city].filter(Boolean).join(', '))}`;

const FIND_TOOL = {
  name: 'ort_daten',
  description: 'Gefundene Treffer zu einem Laden/Arzt/Ort',
  input_schema: {
    type: 'object',
    properties: {
      treffer: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            adresse: { type: 'string', description: 'Straße Nr., Viertel – leer, wenn unbekannt' },
            telefon: { type: 'string' },
            website: { type: 'string', description: 'nur aus den Suchergebnissen, sonst leer' },
            info: { type: 'string', description: 'ganz kurz, z.B. „Filiale in Palermo“ – höchstens 6 Wörter' },
          },
          required: ['name'],
        },
      },
      hinweis: { type: 'string', description: 'nur wenn nichts Passendes gefunden wurde' },
    },
    required: ['treffer'],
  },
};
// KI sucht im Internet (1 Suche, ca. 1 Cent) nach Adresse, Telefon, Website
export async function findBookPlace(s, { name, area, kind }) {
  const city = s.profile?.city || HOME_CITY;
  return searchWithTool({
    system: `Du findest für Mateo einen bestimmten Ort (${kind || 'Laden / Praxis'}) in ${city}. Er nennt den Namen und ungefähr, wo er ist. Such einmal im Internet und gib 1–3 passende Treffer mit Adresse, Telefon und Website zurück (Filialen in der genannten Gegend zuerst). Nichts erfinden – Unbekanntes leer lassen. Antworte nur mit "ort_daten".`,
    user: `${name}${area ? ` – ungefähr: ${area}` : ''} (${city})`,
    tool: FIND_TOOL,
    maxUses: 1,
    maxTokens: 3000,
    label: 'Ort finden',
    city,
  });
}

// v1.01: „Termin finden“ – KI sucht passende Ärzte/Praxen in der Gegend (1 Websuche, ca. 1 Cent)
export async function searchDoctors(s, { what, area }) {
  const city = s.profile?.city || HOME_CITY;
  return searchWithTool({
    system: `Du suchst für Mateo passende Ärzte/Praxen/Therapeuten in ${city}. Such einmal im Internet (z.B. Doctoralia, Google Maps, Praxis-Websites) und gib 3–5 Treffer mit Adresse, Telefon und Website zurück – in der genannten Gegend zuerst, gern mit Online-Terminbuchung. Nichts erfinden, Unbekanntes leer lassen. Antworte nur mit "ort_daten".`,
    user: `${what}${area ? ` – Gegend: ${area}` : ''} (${city})`,
    tool: FIND_TOOL,
    maxUses: 1,
    maxTokens: 3000,
    label: 'Termin finden',
    city,
  });
}
// kostenlose Such-Links
export function doctorLinks(what, area, city = HOME_CITY) {
  const q = [what, area].filter(Boolean).join(' ');
  const e = encodeURIComponent;
  return [
    { label: 'Doctoralia ↗', url: `https://www.doctoralia.com.ar/buscar?q=${e(what || '')}&loc=${e(area || city)}` },
    { label: 'Google Maps ↗', url: `https://www.google.com/maps/search/?api=1&query=${e([q, city].filter(Boolean).join(', '))}` },
    { label: 'Google: Turno online ↗', url: `https://www.google.com/search?q=${e(`${q} ${city} turno online`)}` },
  ];
}
