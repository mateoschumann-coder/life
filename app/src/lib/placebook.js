// Orte-Verzeichnis (v0.91, Mateo): feste Anlaufstellen pro Bereich – Küche (Supermarkt, Metzgerei …),
// Vorsorge (Ärzte, Therapie, Apotheke …). Kategorien + optionale Unterkategorien, eigene ergänzbar.
// Daten: s.placeBook[book] = { cats: [eigene {id,label,emoji,subs}], hidden: [ids], subs: {catId: [eigene Unterkategorien]}, items: [...] }
import { store, uid } from './store';

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
export const findBookItem = (s, book, id) => bookOf(s, book).items.find((x) => x.id === id) || null;

export const bookMaps = (x) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([x.name, x.address].filter(Boolean).join(', '))}`;
export const telOf = (p) => String(p || '').replace(/[^\d+]/g, '');
export const sameName = (a, b) => norm(a) === norm(b);
