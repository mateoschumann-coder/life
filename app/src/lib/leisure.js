// Freizeit: Hobbys (mit KI-Ideen) und Reisen (je eigenes Dashboard); Sozial: eigene Treffen organisieren
import { store, uid } from './store';
import { fmtLong, today } from './dates';
import { callApi } from './ai';
import { searchWithTool } from './outings';

const norm = (x) => String(x || '').trim().toLowerCase();

// ---------- Hobbys ----------
export const HOBBY_KINDS = { idee: 'Idee', song: 'Song', video: 'Video', buch: 'Buch', uebung: 'Übung', link: 'Link' };
export function addHobby(name, level = '') {
  const t = String(name || '').trim();
  if (!t) return null;
  const ex = store.get().hobbies.find((h) => norm(h.name) === norm(t));
  if (ex) return ex.id;
  const id = uid();
  store.update((s) => {
    s.hobbies.push({ id, name: t, level, goal: '', items: [], createdAt: today() });
  });
  return id;
}
export const updateHobby = (id, patch) => store.update((s) => Object.assign(s.hobbies.find((h) => h.id === id) || {}, patch));
export const removeHobby = (id) => store.update((s) => { s.hobbies = s.hobbies.filter((h) => h.id !== id); });
export function addHobbyItem(hobbyId, { title, kind = 'idee', why = '', url = '' }) {
  const t = String(title || '').trim();
  if (!t) return null;
  const id = uid();
  store.update((s) => {
    const h = s.hobbies.find((x) => x.id === hobbyId);
    if (!h || h.items.some((x) => norm(x.title) === norm(t))) return;
    h.items.push({ id, title: t, kind: HOBBY_KINDS[kind] ? kind : 'idee', why, url, status: 'offen', addedAt: today() });
  });
  return id;
}
export function updateHobbyItem(hobbyId, itemId, patch) {
  store.update((s) => {
    const h = s.hobbies.find((x) => x.id === hobbyId);
    const it = h?.items.find((x) => x.id === itemId);
    if (!it) return;
    Object.assign(it, patch);
    if (patch.status === 'geschafft') s.activities.push({ id: uid(), areaId: 'freizeit', date: today(), note: `${h.name}: ${it.title}` });
  });
}
export const removeHobbyItem = (hobbyId, itemId) => store.update((s) => {
  const h = s.hobbies.find((x) => x.id === hobbyId);
  if (h) h.items = h.items.filter((x) => x.id !== itemId);
});

const HOBBY_TOOL = {
  name: 'ideen_zeigen',
  description: 'Gibt konkrete Ideen/Material für ein Hobby zurück.',
  input_schema: {
    type: 'object',
    properties: {
      ideen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string', description: 'z.B. „Wonderwall – Oasis“ oder „Lerne die Sizilianische Verteidigung“' },
            art: { type: 'string', enum: Object.keys(HOBBY_KINDS) },
            warum: { type: 'string', description: '1 Satz: warum passt es zu seinem Niveau/Geschmack' },
            url: { type: 'string', description: 'Nur aus den Suchergebnissen (Video, Tabs, Artikel), nie erfinden' },
          },
          required: ['titel', 'art', 'warum'],
        },
      },
    },
    required: ['ideen'],
  },
};
export async function hobbyIdeas(s, hobbyId, wish = '') {
  const h = s.hobbies.find((x) => x.id === hobbyId);
  const system = `Du bist ein inspirierender Mentor für Mateos Hobby „${h.name}“${h.level ? ` (Niveau: ${h.level})` : ''}${h.goal ? `, Ziel: ${h.goal}` : ''}. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Was er schon gemacht hat / auf der Liste hat: ${JSON.stringify(h.items.map((x) => `${x.title} (${x.status})`))}
Suche höchstens 2-mal (z.B. YouTube-Lektionen, Tabs, Bücher, Übungen) und gib dann mit "ideen_zeigen" 5 bis 6 abwechslungsreiche, konkrete Ideen zurück, die ihn weiterbringen und Spaß machen – passend zu Niveau und Geschmack, nichts doppelt. Deutsch, kurz.`;
  const input = await searchWithTool({ system, user: wish ? `Wunsch: ${wish}` : `Neue Ideen für ${h.name}`, tool: HOBBY_TOOL, maxUses: 2 });
  return (input.ideen || []).filter((x) => x && x.titel).map((x, i) => ({ id: 'h' + i + Date.now().toString(36), title: x.titel, kind: HOBBY_KINDS[x.art] ? x.art : 'idee', why: x.warum || '', url: /^https?:\/\//.test(x.url || '') ? x.url : '' }));
}

// ---------- Reisen ----------
export const TRIP_SECTIONS = { todo: 'Zu erledigen', packen: 'Packliste', ideen: 'Ideen vor Ort' };
export function addTrip({ name, dest = '', from = '', to = '', budget = '' }) {
  const t = String(name || dest || '').trim();
  if (!t) return null;
  const id = uid();
  store.update((s) => {
    s.trips.push({
      id, name: t, dest: dest || t, from, to, budget: Number(budget) || 0, currency: 'USD', notes: '', status: 'geplant',
      todo: ['Flug/Bus buchen', 'Unterkunft buchen', 'Reiseversicherung prüfen'].map((x) => ({ id: uid(), text: x, done: false })),
      packen: [], ideen: [], expenses: [], createdAt: today(),
    });
  });
  return id;
}
export const updateTrip = (id, patch) => store.update((s) => Object.assign(s.trips.find((x) => x.id === id) || {}, patch));
export const removeTrip = (id) => store.update((s) => { s.trips = s.trips.filter((x) => x.id !== id); });
export function addTripItem(tripId, section, { text, note = '', url = '' }) {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    const tr = s.trips.find((x) => x.id === tripId);
    if (!tr || tr[section].some((x) => norm(x.text) === norm(t))) return;
    tr[section].push({ id: uid(), text: t, note, url, done: false });
  });
}
export const toggleTripItem = (tripId, section, id) => store.update((s) => {
  const it = s.trips.find((x) => x.id === tripId)?.[section].find((x) => x.id === id);
  if (it) it.done = !it.done;
});
export const removeTripItem = (tripId, section, id) => store.update((s) => {
  const tr = s.trips.find((x) => x.id === tripId);
  if (tr) tr[section] = tr[section].filter((x) => x.id !== id);
});
export function addExpense(tripId, { text, amount }) {
  if (!String(text || '').trim() || !Number(amount)) return;
  store.update((s) => {
    s.trips.find((x) => x.id === tripId)?.expenses.push({ id: uid(), text: text.trim(), amount: Number(amount), date: today() });
  });
}
export const removeExpense = (tripId, id) => store.update((s) => {
  const tr = s.trips.find((x) => x.id === tripId);
  if (tr) tr.expenses = tr.expenses.filter((x) => x.id !== id);
});

const TRIP_TOOL = {
  name: 'reise_vorschlaege',
  description: 'Gibt Vorschläge für die Reise zurück.',
  input_schema: {
    type: 'object',
    properties: {
      ideen: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, notiz: { type: 'string' }, url: { type: 'string' } }, required: ['text'] }, description: 'Orte, Erlebnisse, Essen – konkret, mit kurzer Notiz' },
      todo: { type: 'array', items: { type: 'string' }, description: 'Was vorher zu erledigen ist (Buchungen, Dokumente, Impfungen …)' },
      packen: { type: 'array', items: { type: 'string' }, description: 'Packliste passend zu Ziel, Jahreszeit und Dauer' },
    },
  },
};
export async function tripIdeas(s, tripId, wish = '') {
  const tr = s.trips.find((x) => x.id === tripId);
  const system = `Du planst mit Mateo (lebt in Buenos Aires) seine Reise „${tr.name}“ nach ${tr.dest}${tr.from ? ` vom ${tr.from}` : ''}${tr.to ? ` bis ${tr.to}` : ''}. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Bereits auf seinen Listen: ${JSON.stringify({ todo: tr.todo.map((x) => x.text), packen: tr.packen.map((x) => x.text), ideen: tr.ideen.map((x) => x.text) })}
Suche höchstens 3-mal (aktuelle Tipps, Einreise, Wetter zur Reisezeit, besondere Orte jenseits der Touristenpfade) und gib dann mit "reise_vorschlaege" zurück: 5–8 Ideen vor Ort (gern auch Geheimtipps, passend zu seinen Interessen, z.B. Laufstrecken), fehlende To-dos und eine kompakte Packliste. Nichts wiederholen, was schon auf den Listen steht. Deutsch, kurz.`;
  return searchWithTool({ system, user: wish || 'Mach mir Vorschläge für diese Reise.', tool: TRIP_TOOL, maxUses: 3 });
}

// ---------- Eigene Treffen / Events ----------
export const GUEST_STATUS = { offen: 'Noch nicht eingeladen', eingeladen: 'Eingeladen', zugesagt: 'Zugesagt', abgesagt: 'Abgesagt' };
export function addGathering({ name, date = '', time = '', place = '', desc = '' }) {
  const t = String(name || '').trim();
  if (!t) return null;
  const id = uid();
  store.update((s) => {
    s.gatherings.push({ id, name: t, date, time, place, desc, invite: '', guests: [], shopping: [], todos: ['Termin festlegen', 'Einladung verschicken'].map((x) => ({ id: uid(), text: x, done: false })), createdAt: today() });
  });
  return id;
}
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
export function addGatherItem(gId, section, text, who = '') {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    const g = s.gatherings.find((x) => x.id === gId);
    if (g && !g[section].some((x) => norm(x.text) === norm(t))) g[section].push({ id: uid(), text: t, who, done: false });
  });
}
export const toggleGatherItem = (gId, section, id) => store.update((s) => {
  const it = s.gatherings.find((x) => x.id === gId)?.[section].find((x) => x.id === id);
  if (it) it.done = !it.done;
});
export const removeGatherItem = (gId, section, id) => store.update((s) => {
  const g = s.gatherings.find((x) => x.id === gId);
  if (g) g[section] = g[section].filter((x) => x.id !== id);
});

// KI: Einladungstext + Einkaufs-/To-do-Vorschläge
const PLAN_TOOL = {
  name: 'treffen_planen',
  description: 'Einladungstext und Vorschläge für das Treffen.',
  input_schema: {
    type: 'object',
    properties: {
      einladung: { type: 'string', description: 'Kurze, herzliche WhatsApp-Einladung auf Deutsch (oder Spanisch, falls gewünscht), mit Datum, Uhrzeit, Ort; Bitte um Zu-/Absage' },
      einkaufen: { type: 'array', items: { type: 'string' }, description: 'Was besorgt werden sollte, mit Mengen passend zur Gästezahl' },
      todos: { type: 'array', items: { type: 'string' } },
    },
    required: ['einladung'],
  },
};
export async function planGathering(s, gId, wish = '') {
  const g = s.gatherings.find((x) => x.id === gId);
  const system = `Du hilfst Mateo, ein eigenes Treffen zu organisieren. Heute ist ${fmtLong(today())}. Schreibe eine kurze, persönliche Einladung (WhatsApp-tauglich, ohne Markdown) und schlage vor, was zu besorgen und zu erledigen ist – passend zur Art des Treffens und ${g.guests.length || 'einer unbekannten Zahl von'} Gästen. Nichts wiederholen, was schon auf den Listen steht. Antworte mit "treffen_planen".`;
  const { tools } = await callApi({
    max_tokens: 1500, system, tools: [PLAN_TOOL], tool_choice: { type: 'tool', name: PLAN_TOOL.name },
    messages: [{ role: 'user', content: JSON.stringify({ treffen: g.name, beschreibung: g.desc, datum: g.date, uhrzeit: g.time, ort: g.place, gaeste: g.guests.map((x) => x.name), schon_einkaufen: g.shopping.map((x) => x.text), schon_todos: g.todos.map((x) => x.text), wunsch: wish || undefined }) }],
  });
  return tools.find((c) => c.name === PLAN_TOOL.name)?.input || {};
}
