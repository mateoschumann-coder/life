// Zuhause: Listen pro Raum/Kategorie (Haushalt, Einrichtung, Kleidung) und regelmäßige Erinnerungen (Miete, WLAN …)
import { store, uid } from './store';
import { addDays, fmtLong, today } from './dates';
import { searchWithTool } from './outings';

export const LISTS = {
  haushalt: { title: 'Haushalt', icon: 'home', cats: ['Bad', 'Küche', 'Wohnzimmer', 'Schlafzimmer', 'Allgemein'], placeholder: 'z.B. Duschvorhang waschen' },
  einrichtung: { title: 'Einrichtung', icon: 'sparkle', cats: ['Wohnzimmer', 'Schlafzimmer', 'Küche', 'Bad', 'Arbeitsplatz', 'Balkon'], placeholder: 'z.B. Stehlampe fürs Lesen', search: true },
  kleidung: { title: 'Kleidung', icon: 'shirt', cats: ['Oberteile', 'Hosen', 'Schuhe', 'Jacken', 'Sport', 'Accessoires'], placeholder: 'z.B. Leichte Regenjacke', search: true, kinds: { brauche: 'Brauche ich', weggeben: 'Weggeben' } },
};
const norm = (x) => String(x || '').trim().toLowerCase();
export const listOf = (s, key) => s.home?.[key] || { cats: LISTS[key].cats, items: [] };

function ensure(s, key) {
  if (!s.home) s.home = {};
  if (!s.home[key]) s.home[key] = { cats: [...LISTS[key].cats], items: [] };
  return s.home[key];
}
export function addHomeItem(key, { text, cat, kind = 'brauche', price = '', url = '', note = '' }) {
  const t = String(text || '').trim();
  if (!t || !LISTS[key]) return null;
  const id = uid();
  store.update((s) => {
    const l = ensure(s, key);
    const c = l.cats.find((x) => norm(x) === norm(cat)) || cat || l.cats[0];
    if (c && !l.cats.includes(c)) l.cats.push(c);
    if (l.items.some((x) => !x.done && norm(x.text) === norm(t))) return;
    l.items.push({ id, cat: c, text: t, kind, price, url, note, done: false, createdAt: today() });
  });
  return id;
}
export function updateHomeItem(key, id, patch) {
  store.update((s) => {
    const it = ensure(s, key).items.find((x) => x.id === id);
    if (it) Object.assign(it, patch, patch.done ? { doneAt: today() } : {});
  });
}
export function removeHomeItem(key, id) {
  store.update((s) => {
    const l = ensure(s, key);
    l.items = l.items.filter((x) => x.id !== id);
  });
}
export function setHomeCats(key, cats) {
  store.update((s) => {
    ensure(s, key).cats = cats;
  });
}

// ---------- Erinnerungen ----------
export const EVERY = { woche: 'jede Woche', monat: 'jeden Monat', quartal: 'alle 3 Monate', jahr: 'jedes Jahr' };
export const REMINDER_PRESETS = [
  { title: 'Miete bezahlen', every: 'monat' },
  { title: 'WLAN bezahlen', every: 'monat' },
  { title: 'Strom/Gas bezahlen', every: 'monat' },
  { title: 'Handyvertrag prüfen', every: 'jahr' },
  { title: 'Bettwäsche wechseln', every: 'woche' },
];
const advance = (k, every) => {
  if (every === 'woche') return addDays(k, 7);
  const d = new Date(k + 'T12:00:00');
  d.setMonth(d.getMonth() + (every === 'jahr' ? 12 : every === 'quartal' ? 3 : 1));
  return d.toISOString().slice(0, 10);
};
export function addReminder({ title, every = 'monat', next = today(), note = '', area = 'zuhause' }) {
  const t = String(title || '').trim();
  if (!t) return null;
  const id = uid();
  store.update((s) => {
    if (!s.reminders) s.reminders = [];
    s.reminders.push({ id, title: t, every: EVERY[every] ? every : 'monat', next, note, area, log: [] });
  });
  return id;
}
export function doneReminder(id) {
  store.update((s) => {
    const r = s.reminders.find((x) => x.id === id);
    if (!r) return;
    r.log = [...(r.log || []), today()].slice(-24);
    let n = advance(r.next, r.every);
    while (n <= today()) n = advance(n, r.every); // falls lange überfällig
    r.next = n;
  });
}
export function updateReminder(id, patch) {
  store.update((s) => Object.assign(s.reminders.find((x) => x.id === id) || {}, patch));
}
export function deleteReminder(id) {
  store.update((s) => {
    s.reminders = s.reminders.filter((x) => x.id !== id);
  });
}

// ---------- KI-Suche nach passenden Dingen (Einrichtung, Kleidung) ----------
const PRODUCT_TOOL = {
  name: 'vorschlaege_zeigen',
  description: 'Gibt passende Produkt-Ideen strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      vorschlaege: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string', description: 'Kurz, z.B. „Stehlampe mit Leselicht, dimmbar“' },
            preis: { type: 'string', description: 'Ungefährer Preis mit Währung, falls bekannt' },
            shop: { type: 'string' },
            warum: { type: 'string', description: '1 Satz, warum es passt' },
            url: { type: 'string', description: 'Nur aus den Suchergebnissen, nie erfinden' },
          },
          required: ['titel', 'warum'],
        },
      },
    },
    required: ['vorschlaege'],
  },
};
export async function suggestItems(s, key, cat, query) {
  const l = listOf(s, key);
  const system = `Du hilfst Mateo (lebt in Buenos Aires) bei „${LISTS[key].title}“${cat ? `, Kategorie ${cat}` : ''}. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Was schon auf seiner Liste steht: ${JSON.stringify(l.items.filter((x) => !x.done).map((x) => x.text))}
Suche höchstens 3-mal (gern Mercado Libre, lokale Läden in Buenos Aires, gute Ratgeber/Tests) und gib dann mit "vorschlaege_zeigen" 4 bis 6 konkrete, sinnvolle Vorschläge zurück – praktisch, gutes Preis-Leistungs-Verhältnis, mit ungefährem Preis. Deutsch, kurz.`;
  const input = await searchWithTool({ system, user: query || `Was wäre für ${cat || LISTS[key].title} sinnvoll?`, tool: PRODUCT_TOOL, maxUses: 3 });
  return (input.vorschlaege || []).filter((v) => v && v.titel).map((v, i) => ({
    id: 'v' + i + Date.now().toString(36), text: v.titel, price: v.preis || '', shop: v.shop || '', why: v.warum || '', url: /^https?:\/\//.test(v.url || '') ? v.url : '',
  }));
}
