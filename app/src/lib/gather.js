// Eigene Events: zu Hause oder woanders – mit Vorlage (To-dos) und KI-Planer im Gespräch
import { store, uid } from './store';
import { fmtLong, today } from './dates';
import { searchWithTool } from './outings';
import { normalizeGathering } from './normalize';

const norm = (x) => String(x || '').trim().toLowerCase();
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');

export const KINDS = { zuhause: 'Zu Hause', auswaerts: 'Woanders' };
// v0.88 (Mateo): kurze To-dos, nacheinander – Grundliste pro Art + Zusätze je Anlass
export const TODO_TEMPLATES = {
  zuhause: {
    Planen: ['Leute einladen', 'Allergien abfragen', 'Menü festlegen'],
    Vorbereiten: ['Einkauf machen', 'Geschirr & Stühle checken', 'Aufräumen', 'Playlist'],
    'Am Tag': ['Essen vorbereiten', 'Getränke kalt stellen'],
    Danach: ['Nachher aufräumen', 'Fotos teilen'],
  },
  auswaerts: {
    Planen: ['Leute einladen', 'Ort finden', 'Preise checken'],
    Reservieren: ['Reservieren', 'Adresse an Gäste schicken'],
    'Kurz vorher': ['Gästezahl durchgeben', 'Reservierung bestätigen'],
    Danach: ['Rechnung teilen', 'Fotos teilen'],
  },
};
// Anlässe: Zusatz-To-dos und Standard-Einkauf (je ein Artikel pro Eintrag)
export const OCCASIONS = {
  leer: { label: 'Leer – selbst füllen', emoji: '⬜', kind: null, empty: true, todos: {}, shop: {} },
  asado: { label: 'Asado / Grillen', emoji: '🔥', kind: 'zuhause', todos: { Vorbereiten: ['Kohle kaufen', 'Fleisch bestellen'], 'Am Tag': ['Feuer anmachen'] }, shop: { Essen: ['Vacío', 'Chorizo', 'Morcilla', 'Provoleta', 'Brot', 'Salat', 'Chimichurri'], Getränke: ['Bier', 'Wein', 'Fernet', 'Cola', 'Wasser', 'Eis'], Sonstiges: ['Kohle', 'Grillanzünder', 'Servietten'] } },
  geburtstag: { label: 'Geburtstag', emoji: '🎂', kind: 'zuhause', todos: { Planen: ['Torte bestellen'], Vorbereiten: ['Deko kaufen', 'Kerzen besorgen'] }, shop: { Essen: ['Torte', 'Snacks', 'Chips', 'Fingerfood'], Getränke: ['Sekt', 'Bier', 'Softdrinks', 'Wasser', 'Eis'], Sonstiges: ['Kerzen', 'Deko', 'Servietten', 'Pappbecher'] } },
  abendessen: { label: 'Abendessen', emoji: '🍝', kind: 'zuhause', todos: { Vorbereiten: ['Tisch decken'] }, shop: { Essen: ['Vorspeise', 'Hauptgericht', 'Dessert', 'Brot'], Getränke: ['Wein', 'Wasser'], Sonstiges: ['Servietten', 'Kerzen'] } },
  party: { label: 'Party', emoji: '🎉', kind: 'zuhause', todos: { Planen: ['Nachbarn Bescheid sagen'], Vorbereiten: ['Musikbox laden', 'Platz schaffen'] }, shop: { Essen: ['Chips', 'Nüsse', 'Pizza'], Getränke: ['Bier', 'Fernet', 'Cola', 'Gin', 'Tonic', 'Wasser', 'Eis'], Sonstiges: ['Pappbecher', 'Müllbeutel'] } },
  spieleabend: { label: 'Spieleabend', emoji: '🎲', kind: 'zuhause', todos: { Vorbereiten: ['Spiele raussuchen'] }, shop: { Essen: ['Chips', 'Salzstangen', 'Popcorn', 'Pizza'], Getränke: ['Bier', 'Softdrinks', 'Wasser'] } },
  filmabend: { label: 'Filmabend', emoji: '🎬', kind: 'zuhause', todos: { Planen: ['Film auswählen'], Vorbereiten: ['TV/Beamer testen'] }, shop: { Essen: ['Popcorn', 'Chips', 'Schokolade'], Getränke: ['Softdrinks', 'Bier'] } },
  brunch: { label: 'Brunch', emoji: '🥐', kind: 'zuhause', todos: { Vorbereiten: ['Brötchen bestellen'] }, shop: { Essen: ['Brötchen', 'Medialunas', 'Eier', 'Käse', 'Aufschnitt', 'Obst', 'Joghurt', 'Marmelade'], Getränke: ['Kaffee', 'Orangensaft', 'Sekt'] } },
  essen: { label: 'Essen gehen', emoji: '🍽', kind: 'auswaerts', todos: { Reservieren: ['Tisch reservieren'] }, shop: {} },
  bar: { label: 'Bar / Ausgehen', emoji: '🍸', kind: 'auswaerts', todos: { Reservieren: ['Tisch reservieren'], 'Kurz vorher': ['Heimweg klären'] }, shop: {} },
  ausflug: { label: 'Ausflug', emoji: '🚐', kind: 'auswaerts', todos: { Planen: ['Treffpunkt festlegen', 'Transport klären'], 'Kurz vorher': ['Wetter checken', 'Proviant einpacken'] }, shop: {} },
  sonstiges: { label: 'Sonstiges', emoji: '✨', kind: null, todos: {}, shop: {} },
};
export const occasionsFor = (kind) => Object.entries(OCCASIONS).filter(([, o]) => !o.kind || o.kind === kind);
const occOf = (type) => OCCASIONS[type] || null;
const findOccasion = (txt) => {
  const n = norm(txt);
  if (!n) return null;
  if (OCCASIONS[n]) return n;
  const hit = Object.entries(OCCASIONS).find(([k, o]) => n.includes(k) || norm(o.label).split(/[ /]+/).some((w) => w.length > 3 && n.includes(w)));
  if (hit) return hit[0];
  if (/grill|parrill/.test(n)) return 'asado';
  if (/cumple|birthday/.test(n)) return 'geburtstag';
  if (/cena|dinner/.test(n)) return 'abendessen';
  return null;
};
export const VENUE_STATUS = { idee: 'Idee', angefragt: 'Angefragt', reserviert: 'Reserviert', abgelehnt: 'Passt nicht' };
export const SHOP_CATS = ['Essen', 'Getränke', 'Sonstiges'];

// Vorlage = Grundliste der Art + Zusätze des Anlasses, in Phasen-Reihenfolge
const todos = (kind, type) => {
  if (occOf(type)?.empty) return [];
  const base = TODO_TEMPLATES[kind] || TODO_TEMPLATES.zuhause;
  const extra = occOf(type)?.todos || {};
  const cats = [...new Set([...Object.keys(base), ...Object.keys(extra)])];
  return cats.flatMap((cat) => [...new Set([...(base[cat] || []), ...(extra[cat] || [])])].map((text) => ({ id: uid(), text, cat, done: false })));
};
const shopItems = (type) => Object.entries(occOf(type)?.shop || {}).flatMap(([cat, list]) => list.map((text) => ({ id: uid(), text, cat, who: '', done: false })));
export const todoCats = (g) => (occOf(g.type)?.empty ? [...new Set([...g.todos.map((x) => x.cat), 'To-dos'])] : [...new Set(todos(g.kind, g.type).map((x) => x.cat))]);


export function addGathering({ name, date = '', time = '', place = '', desc = '', kind = 'zuhause', expected = '', type = '' }) {
  const t = String(name || '').trim() || 'Neues Event';
  const id = uid();
  const k = occOf(type)?.kind || kind;
  store.update((s) => {
    s.gatherings.push(normalizeGathering({ id, name: t, date, time, place, desc, kind: k, type: type || '', expected, todos: todos(k, type), shopping: k === 'zuhause' ? shopItems(type) : [], createdAt: today() }));
  });
  return id;
}
// Anlass wechseln: Vorlage ergänzen, unberührte Punkte der alten Vorlage entfernen
export function setOccasion(gId, type) {
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g || g.type === type) return;
    const oldT = new Set(todos(g.kind, g.type).map((x) => norm(x.text)));
    const oldS = new Set(shopItems(g.type).map((x) => norm(x.text)));
    g.todos = g.todos.filter((x) => x.done || !oldT.has(norm(x.text)));
    g.shopping = g.shopping.filter((x) => x.done || !oldS.has(norm(x.text)));
    const o = occOf(type);
    if (o?.kind && o.kind !== g.kind) g.kind = o.kind;
    g.type = type;
    for (const x of todos(g.kind, type)) if (!g.todos.some((y) => norm(y.text) === norm(x.text))) g.todos.push(x);
    if (g.kind === 'zuhause') for (const x of shopItems(type)) if (!g.shopping.some((y) => norm(y.text) === norm(x.text))) g.shopping.push(x);
  });
}
// Assistent (v0.88): Event anlegen oder – wenn es schon eins mit dem Namen gibt – ergänzen, inkl. Gäste, Einkauf, To-dos
export function findGathering(s, name) {
  const n = norm(name);
  if (!n) return null;
  const open = s.gatherings.filter((g) => !g.done);
  return open.find((g) => norm(g.name) === n) || open.find((g) => norm(g.name).includes(n) || n.includes(norm(g.name))) || null;
}
const splitList = (v) => (Array.isArray(v) ? v : String(v || '').split(/,|\n| und /)).map((x) => String(x).trim()).filter(Boolean);
export function upsertGathering(s, a) {
  const type = findOccasion(a.anlass) || findOccasion(a.name) || '';
  let id = findGathering(s, a.name)?.id;
  const isNew = !id;
  if (!id) id = addGathering({ name: a.name, date: a.date || '', time: a.time || '', place: a.place || '', desc: a.desc || '', kind: a.kind === 'auswaerts' ? 'auswaerts' : 'zuhause', expected: a.expected ? String(a.expected) : '', type });
  store.update((st) => {
    const g = st.gatherings.find((x) => x.id === id);
    if (!g) return;
    if (!isNew) {
      for (const [k, v] of [['date', a.date], ['time', a.time], ['place', a.place], ['expected', a.expected && String(a.expected)]]) if (v) g[k] = v;
      if (a.desc && !g.desc) g.desc = a.desc;
    }
    if (a.motto) g.motto = a.motto;
    if (a.diet) g.diet = a.diet;
    if (a.budget) g.budget = a.budget;
    for (const name of splitList(a.guests)) {
      if (g.guests.some((x) => norm(x.name) === norm(name))) continue;
      const p = st.people.find((x) => norm(x.name) === norm(name)) || st.people.find((x) => norm(x.name).split(' ')[0] === norm(name));
      g.guests.push({ id: uid(), name: p?.name || name, personId: p?.id || null, status: a.guestStatus || 'offen' });
    }
    for (const text of splitList(a.shopping)) if (!g.shopping.some((x) => norm(x.text) === norm(text))) g.shopping.push({ id: uid(), text, cat: /bier|wein|fernet|cola|wasser|saft|sekt|gin|tonic|eis\b|soda|kaffee/i.test(text) ? 'Getränke' : /servietten|becher|kohle|deko|kerzen|teller|müll/i.test(text) ? 'Sonstiges' : 'Essen', who: '', done: false });
    for (const text of splitList(a.todos)) if (!g.todos.some((x) => norm(x.text) === norm(text))) g.todos.push({ id: uid(), text, cat: Object.keys(TODO_TEMPLATES[g.kind])[1] || 'Sonstiges', done: false });
    for (const text of splitList(a.bring)) if (!g.bring.some((x) => norm(x.text) === norm(text))) g.bring.push({ id: uid(), text, who: '', done: false });
  });
  return id;
}
// Art wechseln: Vorlage der neuen Art ergänzen, unerledigte Punkte der alten Vorlage entfernen
export function setKind(gId, kind) {
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g || g.kind === kind) return;
    const old = new Set(todos(g.kind, g.type).map((x) => norm(x.text)));
    g.todos = g.todos.filter((x) => x.done || !old.has(norm(x.text)));
    if (occOf(g.type)?.kind && occOf(g.type).kind !== kind) g.type = '';
    for (const x of todos(kind, g.type)) if (!g.todos.some((y) => norm(y.text) === norm(x.text))) g.todos.push(x);
    g.kind = kind;
  });
}
export function addItem(gId, list, obj) {
  const text = String(obj.text || obj.name || '').trim();
  if (!text) return;
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g) return;
    const key = list === 'venues' ? 'name' : 'text';
    if (g[list].some((x) => norm(x[key]) === norm(text))) return;
    g[list].push({ id: uid(), done: false, ...obj });
  });
}
export const updateItem = (gId, list, id, patch) => store.update((s) => Object.assign(s.gatherings.find((x) => x.id === gId)?.[list].find((x) => x.id === id) || {}, patch));
export const removeItem = (gId, list, id) => store.update((s) => {
  const g = s.gatherings.find((x) => x.id === gId);
  if (g) g[list] = g[list].filter((x) => x.id !== id);
});

// ---------- Gäste ----------
export const GUEST_STATUS = { offen: 'Noch nicht eingeladen', eingeladen: 'Eingeladen', zugesagt: 'Zugesagt', abgesagt: 'Abgesagt' };
export const updateGathering = (id, patch) => store.update((s) => Object.assign(s.gatherings.find((x) => x.id === id) || {}, patch));
export const removeGathering = (id) => store.update((s) => { s.gatherings = s.gatherings.filter((x) => x.id !== id); });
export function addGuest(gId, { name, personId = null }) {
  const t = String(name || '').trim();
  if (!t) return;
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g || g.guests.some((x) => norm(x.name) === norm(t))) return;
    g.guests.push({ id: uid(), name: t, personId, status: 'offen' });
  });
}
export const setGuest = (gId, guestId, patch) => store.update((s) => Object.assign(s.gatherings.find((x) => x.id === gId)?.guests.find((x) => x.id === guestId) || {}, patch));
export const removeGuest = (gId, guestId) => store.update((s) => {
  const g = s.gatherings.find((x) => x.id === gId);
  if (g) g.guests = g.guests.filter((x) => x.id !== guestId);
});

// ---------- KI-Planer ----------
const PLAN_TOOL = {
  name: 'event_planen',
  description: 'Antwort an Mateo plus konkrete Vorschläge, die er mit einem Tipp übernehmen kann.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Kurze Antwort (2–6 Sätze). Wenn Wichtiges fehlt, hier bis zu 3 kurze Rückfragen stellen.' },
      ideen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, beschreibung: { type: 'string' } }, required: ['titel'] }, description: 'Event-Ideen oder Mottos zur Auswahl' },
      einkaufen: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: 'GENAU EIN Artikel, kurz, Menge nur wenn nötig, z.B. „Bier (2 Kisten)“, „Chips“, „2 kg Vacío“' }, kategorie: { type: 'string', enum: SHOP_CATS } }, required: ['text'] } },
      mitbringen: { type: 'array', items: { type: 'string' }, description: 'Was Gäste mitbringen könnten' },
      todos: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: 'kurz, 2–4 Wörter, z.B. „Leute einladen“, „Einkauf machen“' }, kategorie: { type: 'string', description: 'Phase, z.B. Planen, Vorbereiten, Am Tag, Danach' } }, required: ['text'] } },
      orte: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, adresse: { type: 'string' }, warum: { type: 'string' }, preis: { type: 'string' }, reservierung: { type: 'string', description: 'Wie reservieren: Telefon, Website, Mindestgruppe …' }, telefon: { type: 'string' }, url: { type: 'string' } }, required: ['name'] }, description: 'Nur bei Events woanders: passende Locations' },
      einladung: { type: 'string', description: 'Nur wenn gewünscht oder genug Infos da sind: WhatsApp-Einladung ohne Markdown' },
    },
    required: ['antwort'],
  },
};
export const gatherSnapshot = (g) => ({
  name: g.name, art: KINDS[g.kind], anlass: occOf(g.type)?.label, datum: g.date || 'offen', uhrzeit: g.time || undefined, ort: g.place || undefined, beschreibung: g.desc || undefined,
  ungefaehre_gaeste: g.expected || 'noch unbekannt', motto: g.motto || undefined, einschraenkungen: g.diet || undefined, budget: g.budget || undefined,
  gaesteliste: g.guests.map((x) => `${x.name} (${x.status})`),
  einkauf: g.shopping.map((x) => x.text), mitbringen: g.bring.map((x) => `${x.text}${x.who ? ` – ${x.who}` : ''}`),
  todos: g.todos.map((x) => x.text), orte: g.venues.map((x) => `${x.name} (${x.status})`), einladung_vorhanden: !!g.invite,
});
export async function gatherAssist(s, g, history, { web = false, smart = false } = {}) {
  const system = `Du hilfst Mateo (lebt in Buenos Aires), ein eigenes Event zu planen. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Aktueller Stand: ${JSON.stringify(gatherSnapshot(g))}
Arbeitsweise:
- Denk mit: Was für ein Event könnte es werden (Ideen/Motto), was braucht es, was vergisst man leicht?
- ${g.kind === 'auswaerts' ? `Das Event ist WOANDERS: hilf, einen passenden Ort zu finden (${web ? 'Websuche höchstens 2-mal' : 'diesmal OHNE Internet – nenne bekannte Orte aus deinem Wissen ohne URL und sag, dass „Im Internet suchen“ aktuelle Infos bringt'}: Bars, Restaurants, Parks, Locations in Buenos Aires mit Gruppenreservierung, Preise, Einschränkungen), wie man reserviert und was man den Gästen schicken muss. Keine Einkaufsliste, außer es wird gewünscht.` : 'Das Event ist ZU HAUSE: Menü, Getränke (mit Mengen), Einkaufsliste nach Kategorien, was Gäste mitbringen können, Vorbereitung. Keine Websuche nötig – du kennst Rezepte, Mengen und Spiele.'}
- Rechne NICHT einfach mit der Länge der Gästeliste: maßgeblich ist die ungefähre Gästezahl. Ist sie unbekannt, frag danach (und nach Einschränkungen beim Essen wie vegetarisch/Allergien, Budget, Motto) – höchstens 3 kurze Fragen – und mach erst grobe Vorschläge.
- Einkauf und To-dos KURZ und einzeln: ein Artikel pro Eintrag („Bier“, „Chips“, „Kohle“), To-dos mit 2–4 Wörtern („Leute einladen“, „Sachen abschicken“, „Einkauf machen“).
- Nichts vorschlagen, was schon im Stand steht. Links nur aus Suchergebnissen.
Antworte immer mit "event_planen". Deutsch, konkret, kurz.`;
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  return searchWithTool({ system, messages, tool: PLAN_TOOL, maxUses: web ? 2 : 0, label: 'Event-Planer', smart });
}

export function applyGatherProposal(gId, sel) {
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g) return;
    const has = (list, t, k = 'text') => g[list].some((y) => norm(y[k]) === norm(t));
    for (const x of sel.einkaufen || []) if (!has('shopping', x.text)) g.shopping.push({ id: uid(), text: x.text, cat: SHOP_CATS.includes(x.kategorie) ? x.kategorie : 'Sonstiges', who: '', done: false });
    for (const x of sel.mitbringen || []) if (!has('bring', x)) g.bring.push({ id: uid(), text: x, who: '', done: false });
    for (const x of sel.todos || []) if (!has('todos', x.text)) g.todos.push({ id: uid(), text: x.text, cat: x.kategorie || 'Sonstiges', done: false });
    for (const x of sel.orte || []) if (!has('venues', x.name, 'name')) g.venues.push({ id: uid(), name: x.name, address: x.adresse || '', note: [x.warum, x.preis, x.reservierung].filter(Boolean).join(' · '), phone: x.telefon || '', url: okUrl(x.url), status: 'idee' });
    if (sel.ideen?.length) {
      const idea = sel.ideen[0];
      g.motto = idea.titel;
      if (!g.desc && idea.beschreibung) g.desc = idea.beschreibung;
    }
    if (sel.einladung) g.invite = sel.einladung;
  });
}
