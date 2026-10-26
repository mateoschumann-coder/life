// Eigene Events: zu Hause oder woanders – mit Vorlage (To-dos) und KI-Planer im Gespräch
import { store, uid } from './store';
import { fmtLong, today } from './dates';
import { searchWithTool } from './outings';
import { normalizeGathering } from './normalize';

const norm = (x) => String(x || '').trim().toLowerCase();
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');

export const KINDS = { zuhause: 'Zu Hause', auswaerts: 'Woanders' };
export const TODO_TEMPLATES = {
  zuhause: {
    Planen: ['Ungefähre Gästezahl festlegen', 'Motto / Art des Abends überlegen', 'Einladung verschicken', 'Essenswünsche und Allergien abfragen', 'Menü festlegen', 'Getränke planen'],
    Vorbereiten: ['Einkaufen', 'Genug Teller, Gläser, Besteck und Stühle?', 'Wohnung aufräumen', 'Musik / Playlist', 'Eis besorgen'],
    'Am Tag': ['Essen vorbereiten', 'Getränke kalt stellen'],
    Danach: ['Aufräumen', 'Fotos teilen'],
  },
  auswaerts: {
    Planen: ['Ungefähre Gästezahl festlegen', 'Einschränkungen klären (Essen, Budget, Erreichbarkeit)', 'Orte finden und vergleichen', 'Verfügbarkeit und Preise prüfen'],
    Reservieren: ['Reservieren (anrufen / online)', 'Anzahlung oder Mindestverzehr klären', 'Ort, Adresse und Uhrzeit an Gäste schicken'],
    'Kurz vorher': ['Gästezahl final durchgeben', 'Reservierung am Vortag bestätigen', 'Anfahrt klären'],
    Danach: ['Rechnung aufteilen', 'Fotos teilen'],
  },
};
export const VENUE_STATUS = { idee: 'Idee', angefragt: 'Angefragt', reserviert: 'Reserviert', abgelehnt: 'Passt nicht' };
export const SHOP_CATS = ['Essen', 'Getränke', 'Sonstiges'];

const todos = (kind) => Object.entries(TODO_TEMPLATES[kind] || TODO_TEMPLATES.zuhause).flatMap(([cat, list]) => list.map((text) => ({ id: uid(), text, cat, done: false })));


export function addGathering({ name, date = '', time = '', place = '', desc = '', kind = 'zuhause', expected = '' }) {
  const t = String(name || '').trim() || 'Neues Event';
  const id = uid();
  store.update((s) => {
    s.gatherings.push(normalizeGathering({ id, name: t, date, time, place, desc, kind, expected, todos: todos(kind), createdAt: today() }));
  });
  return id;
}
// Art wechseln: Vorlage der neuen Art ergänzen, unerledigte Punkte der alten Vorlage entfernen
export function setKind(gId, kind) {
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g || g.kind === kind) return;
    const old = new Set(todos(g.kind).map((x) => norm(x.text)));
    g.todos = g.todos.filter((x) => x.done || !old.has(norm(x.text)));
    for (const x of todos(kind)) if (!g.todos.some((y) => norm(y.text) === norm(x.text))) g.todos.push(x);
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
      einkaufen: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: 'mit Menge, z.B. „2 kg Vacío“' }, kategorie: { type: 'string', enum: SHOP_CATS } }, required: ['text'] } },
      mitbringen: { type: 'array', items: { type: 'string' }, description: 'Was Gäste mitbringen könnten' },
      todos: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, kategorie: { type: 'string' } }, required: ['text'] } },
      orte: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, adresse: { type: 'string' }, warum: { type: 'string' }, preis: { type: 'string' }, reservierung: { type: 'string', description: 'Wie reservieren: Telefon, Website, Mindestgruppe …' }, telefon: { type: 'string' }, url: { type: 'string' } }, required: ['name'] }, description: 'Nur bei Events woanders: passende Locations' },
      einladung: { type: 'string', description: 'Nur wenn gewünscht oder genug Infos da sind: WhatsApp-Einladung ohne Markdown' },
    },
    required: ['antwort'],
  },
};
export const gatherSnapshot = (g) => ({
  name: g.name, art: KINDS[g.kind], datum: g.date || 'offen', uhrzeit: g.time || undefined, ort: g.place || undefined, beschreibung: g.desc || undefined,
  ungefaehre_gaeste: g.expected || 'noch unbekannt', motto: g.motto || undefined, einschraenkungen: g.diet || undefined, budget: g.budget || undefined,
  gaesteliste: g.guests.map((x) => `${x.name} (${x.status})`),
  einkauf: g.shopping.map((x) => x.text), mitbringen: g.bring.map((x) => `${x.text}${x.who ? ` – ${x.who}` : ''}`),
  todos: g.todos.map((x) => x.text), orte: g.venues.map((x) => `${x.name} (${x.status})`), einladung_vorhanden: !!g.invite,
});
export async function gatherAssist(s, g, history) {
  const system = `Du hilfst Mateo (lebt in Buenos Aires), ein eigenes Event zu planen. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Aktueller Stand: ${JSON.stringify(gatherSnapshot(g))}
Arbeitsweise:
- Denk mit: Was für ein Event könnte es werden (Ideen/Motto), was braucht es, was vergisst man leicht?
- ${g.kind === 'auswaerts' ? 'Das Event ist WOANDERS: hilf, einen passenden Ort zu finden (Websuche, höchstens 3-mal: Bars, Restaurants, Parks, Locations in Buenos Aires mit Gruppenreservierung, Preise, Einschränkungen), wie man reserviert und was man den Gästen schicken muss. Keine Einkaufsliste, außer es wird gewünscht.' : 'Das Event ist ZU HAUSE: Menü, Getränke (mit Mengen), Einkaufsliste nach Kategorien, was Gäste mitbringen können, Vorbereitung. Websuche nur, wenn nötig (z.B. Rezepte, Spiele).'}
- Rechne NICHT einfach mit der Länge der Gästeliste: maßgeblich ist die ungefähre Gästezahl. Ist sie unbekannt, frag danach (und nach Einschränkungen beim Essen wie vegetarisch/Allergien, Budget, Motto) – höchstens 3 kurze Fragen – und mach erst grobe Vorschläge.
- Nichts vorschlagen, was schon im Stand steht. Links nur aus Suchergebnissen.
Antworte immer mit "event_planen". Deutsch, konkret, kurz.`;
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  return searchWithTool({ system, messages, tool: PLAN_TOOL, maxUses: g.kind === 'auswaerts' ? 3 : 2 });
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
