// Zuhause: Listen pro Raum/Kategorie (Haushalt, Einrichtung, Kleidung) und regelmäßige Erinnerungen (Miete, WLAN …)
import { store, uid } from './store';
import { addDays, fmtLong, today } from './dates';
import { searchWithTool } from './outings';

export const LISTS = {
  haushalt: { title: 'To-dos', icon: 'home', cats: ['Putzen', 'Aufräumen', 'Müll', 'Wäsche', 'Reparieren', 'Allgemein'], placeholder: 'z.B. Bad putzen' },
  einrichtung: { title: 'Einrichtung', icon: 'sparkle', cats: ['Wohnzimmer', 'Schlafzimmer', 'Küche', 'Bad', 'Arbeitsplatz', 'Balkon'], placeholder: 'z.B. Stehlampe fürs Lesen', search: true, kinds: { brauche: 'Will ich haben', weggeben: 'Weggeben' } },
  kleidung: { title: 'Kleidung', icon: 'shirt', cats: ['Oberteile', 'Hosen', 'Schuhe', 'Jacken', 'Sport', 'Accessoires'], placeholder: 'z.B. Leichte Regenjacke', search: true, kinds: { brauche: 'Will ich haben', weggeben: 'Weggeben' } },
};
const norm = (x) => String(x || '').trim().toLowerCase();
const OLD_HAUSHALT = ['Bad', 'Küche', 'Wohnzimmer', 'Schlafzimmer', 'Allgemein'];
// v1.02: alte Raum-Kategorien der Haushalt-Liste → neue Aufgaben-Kategorien, solange noch nichts eingetragen ist
const fresh = (key, l) => (key === 'haushalt' && l && !l.items.length && l.cats.join('|') === OLD_HAUSHALT.join('|') ? { ...l, cats: LISTS.haushalt.cats } : l);
export const listOf = (s, key) => fresh(key, s.home?.[key]) || { cats: LISTS[key].cats, items: [] };

function ensure(s, key) {
  if (!s.home) s.home = {};
  if (!s.home[key]) s.home[key] = { cats: [...LISTS[key].cats], items: [] };
  s.home[key] = fresh(key, s.home[key]);
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
            suchbegriff: { type: 'string', description: 'Kurzer Suchbegriff auf Spanisch für Mercado Libre, z.B. „lampara de pie led regulable“' },
            warum: { type: 'string', description: '1 Satz, warum es passt' },
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
Antworte aus deinem Wissen (ohne Internet) mit "vorschlaege_zeigen": 4 bis 6 konkrete, sinnvolle Vorschläge zurück – praktisch, gutes Preis-Leistungs-Verhältnis, mit ungefährem Preis (falls du ihn grob kennst). Deutsch, kurz. Links: Gib KEINE URLs an (du suchst nicht im Internet) – die App erzeugt selbst einen Such-Link zum Titel.`;
  const input = await searchWithTool({ system, user: query || `Was wäre für ${cat || LISTS[key].title} sinnvoll?`, tool: PRODUCT_TOOL, maxUses: 0, label: 'Zuhause-Ideen' });
  return (input.vorschlaege || []).filter((v) => v && v.titel).map((v, i) => ({
    id: 'v' + i + Date.now().toString(36), text: v.titel, price: v.preis || '', shop: v.shop || '', why: v.warum || '', url: `https://listado.mercadolibre.com.ar/${encodeURIComponent((v.suchbegriff || v.titel).replace(/[,–]/g, ' ').trim().replace(/\s+/g, '-'))}`,
  }));
}

// ---------- v1.02: Weggeben – verkaufen (KI schreibt die Anzeige) oder an jemanden geben ----------
const SELL_TOOL = {
  name: 'anzeige',
  description: 'Verkaufsanzeige für einen gebrauchten Gegenstand',
  input_schema: {
    type: 'object',
    properties: {
      titel: { type: 'string', description: 'kurzer Anzeigentitel auf Spanisch (Argentinien), max. 60 Zeichen' },
      text: { type: 'string', description: 'Anzeigentext auf Spanisch, 3–6 kurze Zeilen: Zustand, Maße/Größe falls genannt, Abholung in Buenos Aires' },
      preis: { type: 'string', description: 'realistischer Preisvorschlag in ARS für gebraucht, z.B. „ARS 45.000“' },
      tipps: { type: 'string', description: '1–2 Sätze auf Deutsch: Fotos, wo am besten verkaufen' },
    },
    required: ['titel', 'text'],
  },
};
export async function sellListing(s, item, extra = '') {
  return searchWithTool({
    system: `Du schreibst für Mateo (lebt in Buenos Aires) eine ehrliche, kurze Verkaufsanzeige für Mercado Libre / Facebook Marketplace. Nichts erfinden, was er nicht sagt (Marke, Zustand) – lieber neutral formulieren. Antworte mit "anzeige".`,
    user: `Gegenstand: ${item.text}${item.note ? ` – Notiz: ${item.note}` : ''}${extra ? ` – Details: ${extra}` : ''}`,
    tool: SELL_TOOL,
    maxUses: 0,
    maxTokens: 1500,
    label: 'Verkaufsanzeige',
  });
}
export const SELL_LINKS = [
  { label: 'Mercado Libre: verkaufen ↗', url: 'https://www.mercadolibre.com.ar/vender' },
  { label: 'Facebook Marketplace ↗', url: 'https://www.facebook.com/marketplace/create/item' },
];
// Such-Links zum Kaufen (kostenlos)
export function shopLinks(key, q) {
  const e = encodeURIComponent;
  const t = String(q || '').trim();
  const ml = `https://listado.mercadolibre.com.ar/${e(t.replace(/\s+/g, '-'))}`;
  const base = [
    { label: 'Mercado Libre ↗', url: ml },
    { label: 'Google Shopping ↗', url: `https://www.google.com/search?tbm=shop&q=${e(t)}` },
  ];
  if (key === 'kleidung') return [...base, { label: 'Dafiti ↗', url: `https://www.dafiti.com.ar/catalog/?q=${e(t)}` }, { label: 'Zara ↗', url: `https://www.zara.com/ar/es/search?searchTerm=${e(t)}` }, { label: 'Pinterest (Ideen) ↗', url: `https://www.pinterest.com/search/pins/?q=${e(t + ' outfit')}` }];
  return [...base, { label: 'Sodimac ↗', url: `https://www.sodimac.com.ar/sodimac-ar/search?Ntt=${e(t)}` }, { label: 'Easy ↗', url: `https://www.easy.com.ar/${e(t)}?_q=${e(t)}&map=ft` }, { label: 'Pinterest (Ideen) ↗', url: `https://www.pinterest.com/search/pins/?q=${e(t + ' deco')}` }];
}

// v1.50 (Mateo): Liste einsprechen – die KI zerlegt das Gesagte in Einträge mit Kategorie
// und macht bei Bedarf Vorschläge („Ich brauche was für den Balkon“ → Ideen zum Antippen).
const SPEAK_TOOL = {
  name: 'liste_einsprechen',
  description: 'Einträge und Vorschläge aus Mateos Gesprochenem',
  input_schema: {
    type: 'object',
    properties: {
      eintraege: { type: 'array', description: 'Was Mateo ausdrücklich auf die Liste setzen will', items: { type: 'object', properties: { text: { type: 'string', description: 'kurz, 1–5 Wörter, erster Buchstabe groß' }, kategorie: { type: 'string' }, art: { type: 'string', enum: ['brauche', 'weggeben'] } }, required: ['text'] } },
      vorschlaege: { type: 'array', description: 'Nur wenn Mateo nach Ideen fragt oder etwas Ungefähres beschreibt: 3–6 konkrete Vorschläge', items: { type: 'object', properties: { text: { type: 'string' }, kategorie: { type: 'string' }, warum: { type: 'string', description: 'max. 8 Wörter' } }, required: ['text'] } },
    },
  },
};
export async function speakToList(s, key, text, { kind = 'brauche', cat = '' } = {}) {
  const l = listOf(s, key);
  const def = LISTS[key];
  const system = `Mateo spricht etwas für seine Liste „${def.title}“ (Bereich Zuhause) ein. Kategorien: ${l.cats.join(', ')}.${def.kinds ? ` Arten: brauche (will ich haben) oder weggeben. Aktuell gewählt: ${kind}.` : ''}${cat ? ` Gewählte Kategorie: ${cat}.` : ''}
Regeln: Zerlege, was er ausdrücklich nennt, in einzelne kurze Einträge (ohne Füllwörter, Deutsch, erster Buchstabe groß) und ordne jeden der passendsten Kategorie zu (nur aus der Liste). Fragt er nach Ideen oder beschreibt er etwas Ungefähres („mein Balkon soll gemütlicher werden“, „was brauche ich für den Winter?“), mach 3–6 konkrete Vorschläge statt Einträge. Schon auf der Liste: ${l.items.filter((x) => !x.done).map((x) => x.text).slice(0, 40).join(', ') || 'nichts'} – nicht doppelt.`;
  const r = await searchWithTool({ system, user: text, tool: SPEAK_TOOL, maxUses: 0, maxTokens: 900, label: 'Zuhause einsprechen' });
  const fixCat = (c) => l.cats.find((x) => norm(x) === norm(c)) || cat || (l.cats.includes('Allgemein') ? 'Allgemein' : l.cats[0]);
  return {
    items: (r?.eintraege || []).filter((x) => x?.text).map((x) => ({ text: String(x.text).trim(), cat: fixCat(x.kategorie), kind: def.kinds ? (x.art === 'weggeben' ? 'weggeben' : x.art === 'brauche' ? 'brauche' : kind) : 'brauche' })),
    ideas: (r?.vorschlaege || []).filter((x) => x?.text).map((x) => ({ id: uid(), text: String(x.text).trim(), cat: fixCat(x.kategorie), why: x.warum || '' })),
  };
}
