// Eigene Events: zu Hause oder woanders – mit Vorlage (To-dos) und KI-Planer im Gespräch
import { store, uid } from './store';
import { fmtLong, today } from './dates';
import { searchWithTool } from './outings';
import { normalizeGathering } from './normalize';

const norm = (x) => String(x || '').trim().toLowerCase();
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');

export const KINDS = { zuhause: 'Zu Hause', auswaerts: 'Woanders' };
// v0.91 (Mateo): Reihenfolge Planen → (Einkauf) → Vorbereiten → Sonstiges; nur kurze To-dos, die zum Teil passen
export const PHASES = ['Planen', 'Vorbereiten', 'Sonstiges'];
// v1.03 (Mateo): Vorlagen sind vollständige Listen (To-dos je Phase + Einkauf) und bearbeitbar; Standard = „Leer“
const Z = (planen, vorbereiten, sonst) => ({ Planen: planen, Vorbereiten: vorbereiten, Sonstiges: sonst });
export const TODO_TEMPLATES = {
  zuhause: Z(['Termin festlegen', 'Leute einladen', 'Essen überlegen'], ['Aufräumen', 'Essen vorbereiten', 'Getränke kalt stellen'], ['Nachher aufräumen']),
  auswaerts: Z(['Termin festlegen', 'Leute einladen', 'Ort aussuchen', 'Reservieren'], ['Adresse schicken', 'Reservierung bestätigen'], ['Rechnung teilen']),
};
const withBase = (kind, extra) => Object.fromEntries(PHASES.map((p) => [p, [...new Set([...(TODO_TEMPLATES[kind][p] || []), ...(extra[p] || [])])]]));
export const OCCASIONS = {
  leer: { label: 'Leer – selbst füllen', emoji: '✏️', kind: null, empty: true, todos: {}, shop: {} },
  allgemein: { label: 'Allgemein', emoji: '📋', kind: 'zuhause', todos: withBase('zuhause', {}), shop: {} },
  allgemein_aus: { label: 'Allgemein', emoji: '📋', kind: 'auswaerts', todos: withBase('auswaerts', {}), shop: {} },
  asado: { label: 'Asado / Grillen', emoji: '🔥', kind: 'zuhause', todos: withBase('zuhause', { Planen: ['Fleisch bestellen', 'Grill checken'], Vorbereiten: ['Feuer anmachen', 'Chimichurri machen'] }), shop: { Essen: ['Vacío', 'Chorizo', 'Morcilla', 'Provoleta', 'Brot', 'Salat', 'Chimichurri'], Getränke: ['Bier', 'Wein', 'Fernet', 'Cola', 'Wasser', 'Eis'], Sonstiges: ['Kohle', 'Grillanzünder', 'Servietten'] } },
  geburtstag: { label: 'Geburtstag', emoji: '🎂', kind: 'zuhause', todos: withBase('zuhause', { Planen: ['Torte bestellen'], Vorbereiten: ['Dekorieren'] }), shop: { Essen: ['Torte', 'Snacks', 'Chips', 'Fingerfood'], Getränke: ['Sekt', 'Bier', 'Softdrinks', 'Wasser', 'Eis'], Sonstiges: ['Kerzen', 'Deko', 'Servietten', 'Pappbecher'] } },
  abendessen: { label: 'Abendessen', emoji: '🍝', kind: 'zuhause', mottos: ['Italienisch', 'Mexikanisch', 'Fondue', 'Raclette', 'Asiatisch', 'Tapas'], todos: withBase('zuhause', { Planen: ['Allergien abfragen'], Vorbereiten: ['Tisch decken'] }), shop: { Essen: ['Vorspeise', 'Hauptgericht', 'Dessert', 'Brot'], Getränke: ['Wein', 'Wasser'], Sonstiges: ['Servietten', 'Kerzen'] } },
  party: { label: 'Party', emoji: '🎉', kind: 'zuhause', mottos: ['80er', '90er', 'Halloween', 'Bad Taste', 'Weiß', 'Karaoke'], todos: withBase('zuhause', { Planen: ['Nachbarn informieren'], Vorbereiten: ['Musikbox laden', 'Platz schaffen', 'Playlist'] }), shop: { Essen: ['Chips', 'Nüsse', 'Pizza'], Getränke: ['Bier', 'Fernet', 'Cola', 'Gin', 'Tonic', 'Wasser', 'Eis'], Sonstiges: ['Pappbecher', 'Müllbeutel'] } },
  spieleabend: { label: 'Spieleabend', emoji: '🎲', kind: 'zuhause', mottos: ['Brettspiele', 'Poker', 'Quiz', 'Werwolf', 'Videospiele'], todos: withBase('zuhause', { Vorbereiten: ['Spiele raussuchen'] }), shop: { Essen: ['Chips', 'Salzstangen', 'Popcorn', 'Pizza'], Getränke: ['Bier', 'Softdrinks', 'Wasser'] } },
  filmabend: { label: 'Filmabend', emoji: '🎬', kind: 'zuhause', todos: withBase('zuhause', { Planen: ['Film wählen'], Vorbereiten: ['TV testen', 'Decken bereitlegen'] }), shop: { Essen: ['Popcorn', 'Chips', 'Schokolade'], Getränke: ['Softdrinks', 'Bier'] } },
  brunch: { label: 'Brunch', emoji: '🥐', kind: 'zuhause', todos: withBase('zuhause', { Vorbereiten: ['Tisch decken', 'Kaffee vorbereiten'] }), shop: { Essen: ['Brötchen', 'Medialunas', 'Eier', 'Käse', 'Aufschnitt', 'Obst', 'Joghurt', 'Marmelade'], Getränke: ['Kaffee', 'Orangensaft', 'Sekt'] } },
  // v1.05 (Mateo): „Woanders“ hat eigene Vorlagen – welche Art von Unternehmung? Mit Motto-Ideen und Mitbringen
  essen: { label: 'Restaurant', emoji: '🍽', kind: 'auswaerts', todos: Z(['Termin festlegen', 'Küche / Motto wählen', 'Restaurant aussuchen', 'Reservieren', 'Leute einladen'], ['Reservierung bestätigen', 'Adresse schicken'], ['Rechnung teilen']), shop: {}, mottos: ['Parrilla', 'Italienisch', 'Sushi', 'Mexikanisch', 'Bodegón', 'Vegetarisch', 'Rooftop', 'Tapas'] },
  bar: { label: 'Bar / Ausgehen', emoji: '🍸', kind: 'auswaerts', todos: Z(['Termin festlegen', 'Bar aussuchen', 'Leute einladen', 'Tisch reservieren'], ['Treffpunkt schicken', 'Heimweg klären'], ['Rechnung teilen']), shop: {}, mottos: ['Cocktailbar', 'Rooftop', 'Craft-Bier', 'Weinbar', 'Live-Musik', 'Speakeasy', 'Club danach'] },
  picknick: { label: 'Picknick', emoji: '🧺', kind: 'auswaerts', todos: Z(['Termin festlegen', 'Park aussuchen', 'Leute einladen', 'Wer bringt was'], ['Wetter checken', 'Essen vorbereiten', 'Getränke kühlen', 'Korb packen'], ['Müll mitnehmen']), shop: {}, bring: ['Decke', 'Essen', 'Getränke', 'Becher', 'Besteck', 'Servietten', 'Müllbeutel', 'Musikbox'], mottos: ['Frühstück im Park', 'Sonnenuntergang', 'Wein & Käse', 'Mate & Facturas', 'Am Wasser'] },
  ausflug: { label: 'Tagesausflug', emoji: '🥾', kind: 'auswaerts', todos: Z(['Ziel aussuchen', 'Termin festlegen', 'Leute einladen', 'Anfahrt planen', 'Tickets checken'], ['Treffpunkt & Uhrzeit schicken', 'Wetter checken', 'Proviant packen'], ['Fotos teilen', 'Kosten teilen']), shop: {}, bring: ['Wasser', 'Snacks', 'Sonnencreme', 'Jacke'], mottos: ['Wandern', 'Strand', 'Weingut', 'Tigre / Delta', 'Estancia', 'Städtchen erkunden', 'Fahrradtour'] },
  kurztrip: { label: 'Kurztrip / Wochenende', emoji: '🧳', kind: 'auswaerts', todos: Z(['Ziel aussuchen', 'Termin festlegen', 'Budget klären', 'Unterkunft buchen', 'Anreise buchen'], ['Plan vor Ort', 'Dokumente checken', 'Packen'], ['Kosten teilen', 'Fotos teilen']), shop: {}, mottos: ['Uruguay', 'Strand', 'Berge', 'Städtetrip', 'Wellness', 'Natur & Ruhe'] },
  kultur: { label: 'Konzert & Kultur', emoji: '🎤', kind: 'auswaerts', todos: Z(['Event aussuchen', 'Tickets kaufen', 'Leute einladen'], ['Treffpunkt ausmachen', 'Anfahrt klären'], ['Danach noch was trinken?']), shop: {}, mottos: ['Konzert', 'Theater', 'Stand-up', 'Museum', 'Kino', 'Fußballspiel', 'Festival'] },
  aktivitaet: { label: 'Sport & Aktivität', emoji: '🏓', kind: 'auswaerts', todos: Z(['Aktivität wählen', 'Platz / Kurs buchen', 'Leute einladen'], ['Ausrüstung packen', 'Treffpunkt schicken'], ['Kosten teilen']), shop: {}, mottos: ['Padel', 'Fußball', 'Bowling', 'Escape Room', 'Klettern', 'Kajak', 'Laufen'] },
};
// Vorlagen = Standard + eigene Änderungen (s.profile.evTpl) − ausgeblendete (s.profile.evTplHidden)
export function templatesOf(s) {
  const own = s?.profile?.evTpl || {};
  const hidden = s?.profile?.evTplHidden || [];
  const out = {};
  for (const [k, o] of Object.entries(OCCASIONS)) if (!hidden.includes(k) || k === 'leer') out[k] = own[k] ? { ...o, ...own[k], empty: k === 'leer' } : o;
  for (const [k, o] of Object.entries(own)) if (!OCCASIONS[k]) out[k] = { ...o, own: true };
  return out;
}
// v1.05: Standard-Vorlage je Art (⭐ im Auswahl-Fenster änderbar)
export const DEFAULT_STD = { zuhause: 'allgemein', auswaerts: 'allgemein_aus' };
export function stdTpl(kind, s = store.get()) {
  const k = s?.profile?.evTplStd?.[kind];
  const all = templatesOf(s);
  if (k && all[k] && (!all[k].kind || all[k].kind === kind)) return k;
  return all[DEFAULT_STD[kind]] ? DEFAULT_STD[kind] : 'leer';
}
export const setStdTpl = (kind, key) => store.update((s) => { s.profile = { ...(s.profile || {}), evTplStd: { ...(s.profile?.evTplStd || {}), [kind]: key } }; });
export const occasionsFor = (kind, s = store.get()) => Object.entries(templatesOf(s)).filter(([, o]) => !o.kind || o.kind === kind);
const occOf = (type) => (type ? templatesOf(store.get())[type] || null : null);
export const occasionOf = occOf;
export function saveTemplate(key, data) {
  const k = key || `t${uid().slice(0, 6)}`;
  store.update((s) => {
    s.profile = { ...(s.profile || {}) };
    s.profile.evTpl = { ...(s.profile.evTpl || {}), [k]: { label: data.label || 'Vorlage', emoji: data.emoji || '📋', kind: data.kind || null, todos: data.todos || {}, shop: data.shop || {}, mottos: data.mottos || [], bring: data.bring || [] } };
    s.profile.evTplHidden = (s.profile.evTplHidden || []).filter((x) => x !== k);
  });
  return k;
}
export function removeTemplate(key) {
  store.update((s) => {
    s.profile = { ...(s.profile || {}) };
    const own = { ...(s.profile.evTpl || {}) };
    delete own[key];
    s.profile.evTpl = own;
    if (OCCASIONS[key]) s.profile.evTplHidden = [...new Set([...(s.profile.evTplHidden || []), key])];
  });
}
export const resetTemplates = () => store.update((s) => { s.profile = { ...(s.profile || {}), evTpl: {}, evTplHidden: [] }; });
const findOccasion = (txt) => {
  const n = norm(txt);
  if (!n) return null;
  if (OCCASIONS[n]) return n;
  const hit = Object.entries(OCCASIONS).find(([k, o]) => k !== 'leer' && !k.startsWith('allgemein') && (n.includes(k) || norm(o.label).split(/[ /]+/).some((w) => w.length > 3 && n.includes(w))));
  if (hit) return hit[0];
  if (/grill|parrill/.test(n)) return 'asado';
  if (/cumple|birthday/.test(n)) return 'geburtstag';
  if (/cena|dinner/.test(n)) return 'abendessen';
  return null;
};
export const VENUE_STATUS = { idee: 'Idee', angefragt: 'Angefragt', reserviert: 'Reserviert', abgelehnt: 'Passt nicht' };
export const SHOP_CATS = ['Essen', 'Getränke', 'Sonstiges'];

// Vorlage = vollständige Liste der gewählten Vorlage, in Phasen-Reihenfolge (v1.03)
const todos = (kind, type) => {
  const o = occOf(type);
  if (!o || o.empty) return [];
  const t = o.todos || {};
  const cats = [...new Set([...PHASES, ...Object.keys(t)])];
  return cats.flatMap((cat) => [...new Set(t[cat] || [])].map((text) => ({ id: uid(), text, cat, done: false })));
};
const bringItems = (type) => (occOf(type)?.bring || []).map((text) => ({ id: uid(), text, who: '', done: false }));
const shopItems = (type) => Object.entries(occOf(type)?.shop || {}).flatMap(([cat, list]) => list.map((text) => ({ id: uid(), text, cat, who: '', done: false })));
export const todoCats = (g) => [...new Set([...PHASES, ...g.todos.map((x) => x.cat).filter(Boolean)])];


export function addGathering({ name, date = '', time = '', place = '', desc = '', kind = 'zuhause', expected = '', type = '' }) {
  const t = String(name || '').trim() || 'Neues Event';
  const id = uid();
  const k = occOf(type)?.kind || kind;
  store.update((s) => {
    s.gatherings.push(normalizeGathering({ id, name: t, date, time, place, desc, kind: k, type: type || '', expected, todos: todos(k, type), shopping: k === 'zuhause' ? shopItems(type) : [], bring: bringItems(type), createdAt: today() }));
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
    const oldB = new Set(bringItems(g.type).map((x) => norm(x.text)));
    g.bring = (g.bring || []).filter((x) => x.done || x.who || !oldB.has(norm(x.text)));
    g.todos = g.todos.filter((x) => x.done || !oldT.has(norm(x.text)));
    g.shopping = g.shopping.filter((x) => x.done || !oldS.has(norm(x.text)));
    const o = occOf(type);
    if (o?.kind && o.kind !== g.kind) g.kind = o.kind;
    g.type = type;
    for (const x of todos(g.kind, type)) if (!g.todos.some((y) => norm(y.text) === norm(x.text))) g.todos.push(x);
    if (g.kind === 'zuhause') for (const x of shopItems(type)) if (!g.shopping.some((y) => norm(y.text) === norm(x.text))) g.shopping.push(x);
    for (const x of bringItems(type)) if (!g.bring.some((y) => norm(y.text) === norm(x.text))) g.bring.push(x);
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
    for (const text of splitList(a.todos)) if (!g.todos.some((x) => norm(x.text) === norm(text))) g.todos.push({ id: uid(), text, cat: 'Planen', done: false });
    for (const text of splitList(a.bring)) if (!g.bring.some((x) => norm(x.text) === norm(text))) g.bring.push({ id: uid(), text, who: '', done: false });
  });
  return id;
}
// Art wechseln: Vorlage der neuen Art ergänzen, unerledigte Punkte der alten Vorlage entfernen
// v1.04: Art wechseln merkt sich die Vorlage je Art (zurückwechseln holt sie wieder); passt sie nicht, gilt „Leer“
export const tplForKind = (type, kind, memo = {}) => {
  if (memo[kind] !== undefined) return memo[kind];
  const o = occOf(type);
  if (o && o.kind === kind) return type;
  if (o && !o.kind && !o.empty) return type; // Vorlage für beide Arten bleibt
  return stdTpl(kind); // sonst automatisch die Standard-Vorlage der neuen Art
};
export function setKind(gId, kind) {
  const g0 = store.get().gatherings.find((x) => x.id === gId);
  if (!g0 || g0.kind === kind) return;
  const next = tplForKind(g0.type, kind, g0.tplByKind || {});
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g) return;
    g.tplByKind = { ...(g.tplByKind || {}), [g.kind]: g.type || 'leer' };
    g.kind = kind;
  });
  setOccasion(gId, next);
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

// ---------- Einladung (v0.91): allgemeiner Text + automatisch Wann/Wo/Adresse mit Google-Maps-Link ----------
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const mapsLink = (g) => { const q = [g.place && !/^bei mir$/i.test(g.place) ? g.place : '', g.address].filter(Boolean).join(', '); return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''; };
export function inviteDetails(g) {
  const d = g.date ? new Date(`${g.date}T12:00:00`) : null;
  const when = d ? `${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${g.time ? `, ${g.time} Uhr` : ''}` : g.time ? `${g.time} Uhr` : '';
  return [when && `📅 Wann: ${when}`, (g.place || g.address) && `📍 Wo: ${[g.place, g.address].filter(Boolean).join(' – ')}`, mapsLink(g) && `🗺 ${mapsLink(g)}`].filter(Boolean).join('\n');
}
export function inviteText(g) {
  const body = String(g.invite || '').trim() || `Hey! Ich lade euch ein: ${g.name}${g.motto ? ` (${g.motto})` : ''}. Bist du dabei?`;
  const det = inviteDetails(g);
  return det ? `${body}\n\n${det}` : body;
}

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
      einkaufen: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: 'GENAU EIN Artikel, 1–3 Wörter, keine Erklärung, kein Zweck, keine Klammern, z.B. „Bier“, „Chips“, „2 kg Vacío“, „Servietten“' }, kategorie: { type: 'string', enum: SHOP_CATS } }, required: ['text'] } },
      mitbringen: { type: 'array', items: { type: 'string' }, description: 'Was Gäste mitbringen könnten' },
      todos: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: 'GANZ kurz, 2–4 Wörter, z.B. „Leute einladen“, „Tisch decken“ – keine Erklärungen, keine Klammern' }, kategorie: { type: 'string', enum: PHASES, description: 'Planen = vorher klären/organisieren, Vorbereiten = kurz vorher/am Tag, Sonstiges = danach/Rest. Einkäufe NICHT hier, sondern bei "einkaufen".' } }, required: ['text', 'kategorie'] } },
      ueberblick: { type: 'object', description: 'Nur wenn Mateo Datum/Uhrzeit/Ort/Adresse/Gästezahl nennt: diese Felder ausfüllen', properties: { datum: { type: 'string', description: 'JJJJ-MM-TT' }, uhrzeit: { type: 'string', description: 'HH:MM' }, ort: { type: 'string', description: 'Name des Ortes, z.B. „bei mir“, „Bar Uptown“' }, adresse: { type: 'string', description: 'Straße und Nummer, Stadt' }, gaeste: { type: 'string', description: 'ungefähre Zahl' } } },
      orte: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, adresse: { type: 'string' }, warum: { type: 'string' }, preis: { type: 'string' }, reservierung: { type: 'string', description: 'Wie reservieren: Telefon, Website, Mindestgruppe …' }, telefon: { type: 'string' }, url: { type: 'string' } }, required: ['name'] }, description: 'Nur bei Events woanders: passende Locations' },
      einladung: { type: 'string', description: 'Nur wenn gewünscht: ALLGEMEINE WhatsApp-Einladung an alle (keine Namen einzelner Gäste, keine Anrede einer Person), ohne Markdown. Wann/Wo/Adresse NICHT in den Text schreiben – die App hängt sie mit Google-Maps-Link automatisch unten an.' },
    },
    required: ['antwort'],
  },
};
export const gatherSnapshot = (g) => ({
  name: g.name, art: KINDS[g.kind], anlass: occOf(g.type)?.label, datum: g.date || 'offen', uhrzeit: g.time || undefined, ort: g.place || undefined, adresse: g.address || undefined, beschreibung: g.desc || undefined,
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

// To-dos immer kurz: Erklärungen in Klammern / nach Doppelpunkt oder Gedankenstrich abschneiden
// v0.93: Einkaufs-Artikel ganz kurz (Mateo: „Sonstiges“-Texte waren super lang)
export const shortItem = (x) => { let t = String(x || '').trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*[:–—].*$/, '').replace(/\s+-\s.*$/, '').replace(/\s+(für|zum|zur|damit|falls|als|wegen)\s.*$/i, '').replace(/[.!]+$/, '').trim(); const w = t.split(/\s+/); if (w.length > 4) t = w.slice(0, 4).join(' '); return t || String(x || '').trim().slice(0, 30); };
export const shortTodo = (x) => { let t = String(x || '').trim(); if (t.length > 32) t = t.replace(/\s*[(:–—].*$/, '').replace(/\s+-\s.*$/, '').trim(); return t; };
export function applyGatherProposal(gId, sel) {
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (!g) return;
    const has = (list, t, k = 'text') => g[list].some((y) => norm(y[k]) === norm(t));
    for (const x of sel.einkaufen || []) { const text = shortItem(x.text); if (text && !has('shopping', text)) g.shopping.push({ id: uid(), text, cat: SHOP_CATS.includes(x.kategorie) ? x.kategorie : 'Sonstiges', who: '', done: false }); }
    for (const x of sel.mitbringen || []) if (!has('bring', x)) g.bring.push({ id: uid(), text: x, who: '', done: false });
    for (const x of sel.todos || []) { const text = shortTodo(x.text); if (text && !has('todos', text)) g.todos.push({ id: uid(), text, cat: PHASES.includes(x.kategorie) ? x.kategorie : 'Sonstiges', done: false }); }
    const ov = sel.ueberblick?.[0];
    if (ov) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(ov.datum || '')) g.date = ov.datum;
      if (/^\d{1,2}:\d{2}$/.test(ov.uhrzeit || '')) g.time = ov.uhrzeit.padStart(5, '0');
      if (ov.ort) g.place = ov.ort;
      if (ov.adresse) g.address = ov.adresse;
      if (ov.gaeste) g.expected = String(ov.gaeste);
    }
    for (const x of sel.orte || []) if (!has('venues', x.name, 'name')) g.venues.push({ id: uid(), name: x.name, address: x.adresse || '', note: [x.warum, x.preis, x.reservierung].filter(Boolean).join(' · '), phone: x.telefon || '', url: okUrl(x.url), status: 'idee' });
    if (sel.ideen?.length) {
      const idea = sel.ideen[0];
      g.motto = idea.titel;
      if (!g.desc && idea.beschreibung) g.desc = idea.beschreibung;
    }
    if (sel.einladung) g.invite = sel.einladung;
  });
}

// v0.95 (Mateo): WhatsApp-Gruppen merken (Gruppen-Link aus WhatsApp: Gruppeninfo → „Per Link einladen“ → Link kopieren)
export function addWaGroup(name, link) {
  const n = String(name || '').trim();
  let l = String(link || '').trim();
  if (!n) return null;
  if (l && !/^https?:\/\//i.test(l)) l = `https://${l}`;
  const id = uid();
  store.update((s) => { s.waGroups = [...(s.waGroups || []), { id, name: n, link: l }]; });
  return id;
}
export const removeWaGroup = (id) => store.update((s) => { s.waGroups = (s.waGroups || []).filter((x) => x.id !== id); });

// v1.04: Vorlage mit der KI ändern (sprechen oder tippen), ohne Internet
const TPL_TOOL = {
  name: 'vorlage',
  description: 'Überarbeitete Event-Vorlage',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      emoji: { type: 'string' },
      planen: { type: 'array', items: { type: 'string' } },
      vorbereiten: { type: 'array', items: { type: 'string' } },
      sonstiges: { type: 'array', items: { type: 'string' } },
      essen: { type: 'array', items: { type: 'string' } },
      getraenke: { type: 'array', items: { type: 'string' } },
      einkauf_sonstiges: { type: 'array', items: { type: 'string' } },
      mottos: { type: 'array', items: { type: 'string' }, description: 'Motto-/Art-Ideen, je 1–3 Wörter' },
      mitbringen: { type: 'array', items: { type: 'string' }, description: 'Was jemand mitbringen sollte (v.a. woanders)' },
    },
    required: ['planen', 'vorbereiten', 'sonstiges'],
  },
};
export async function editTemplateAI(t, wish) {
  const r = await searchWithTool({
    system: `Du überarbeitest eine Event-Vorlage für Mateo (lebt in Buenos Aires). Ändere sie genau so, wie er es sagt; was er nicht erwähnt, bleibt gleich. To-dos GANZ kurz (2–4 Wörter), Einkauf je Artikel ein Eintrag, ohne Mengen. Planen = vorher organisieren (z.B. Termin festlegen), Vorbereiten = kurz vorher/am Tag, Sonstiges = danach. ${t.kind === 'auswaerts' ? 'Event ist woanders (Restaurant, Picknick, Ausflug, Kurztrip …) – kein Einkauf; stattdessen ggf. „mitbringen“. Denk an die Art der Unternehmung.' : ''} Motto-Ideen unter „mottos“. Antworte nur mit "vorlage".`,
    user: `Vorlage jetzt: ${JSON.stringify({ name: t.label, emoji: t.emoji, planen: t.todos.Planen, vorbereiten: t.todos.Vorbereiten, sonstiges: t.todos.Sonstiges, essen: t.shop.Essen, getraenke: t.shop['Getränke'], einkauf_sonstiges: t.shop.Sonstiges, mottos: t.mottos, mitbringen: t.bring })}\nÄnderungswunsch: ${wish}`,
    tool: TPL_TOOL,
    maxUses: 0,
    maxTokens: 1500,
    label: 'Vorlage mit KI',
  });
  return {
    label: r.name || t.label,
    emoji: r.emoji || t.emoji,
    todos: { Planen: r.planen || [], Vorbereiten: r.vorbereiten || [], Sonstiges: r.sonstiges || [] },
    mottos: r.mottos || t.mottos || [],
    bring: r.mitbringen || t.bring || [],
    shop: { Essen: r.essen || t.shop.Essen || [], 'Getränke': r.getraenke || t.shop['Getränke'] || [], Sonstiges: r.einkauf_sonstiges || t.shop.Sonstiges || [] },
  };
}
