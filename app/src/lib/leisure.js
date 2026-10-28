// Freizeit: Hobbys (mit KI-Ideen) und Reisen (je eigenes Dashboard); Sozial: eigene Treffen organisieren
import { store, uid } from './store';
import { fmtLong, today } from './dates';
import { callApi } from './ai';
import { searchWithTool } from './outings';

const norm = (x) => String(x || '').trim().toLowerCase();
// Statt (teurer) Websuche: Such-Link passend zur Art (Video/Song → YouTube, sonst Google)
export const searchLink = (title, kind) => (['song', 'video', 'uebung'].includes(kind) ? `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}` : `https://www.google.com/search?q=${encodeURIComponent(title)}`);

// ---------- Hobbys ----------
export const HOBBY_KINDS = { idee: 'Idee', song: 'Song', video: 'Video', buch: 'Buch', uebung: 'Übung', link: 'Link' };
export function addHobby(name, level = '') {
  const t = String(name || '').trim();
  if (!t) return null;
  const ex = store.get().hobbies.find((h) => norm(h.name) === norm(t));
  if (ex) return ex.id;
  const id = uid();
  store.update((s) => {
    s.hobbies.push({ id, name: t, level, goal: '', items: [], todos: [], materials: [], hobby: true, createdAt: today() });
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
    if (!h) return;
    // v1.04: Ideen → To-dos, Songs/Videos/… → Material (wie Weiterentwicklung)
    if (!HOBBY_KINDS[kind] || kind === 'idee') { h.todos = h.todos || []; if (!h.todos.some((x) => norm(x.text) === norm(t))) h.todos.push({ id, text: t, done: false }); return; }
    h.materials = h.materials || [];
    if (!h.materials.some((x) => norm(x.title) === norm(t))) h.materials.push({ id, type: kind, title: t, author: '', url, note: why, stage: 0, addedAt: today() });
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
                      },
          required: ['titel', 'art', 'warum'],
        },
      },
    },
    required: ['ideen'],
  },
};
export async function hobbyIdeas(s, hobbyId, wish = '', { web = false } = {}) {
  const h = s.hobbies.find((x) => x.id === hobbyId);
  const system = `Du bist ein inspirierender Mentor für Mateos Hobby „${h.name}“${h.level ? ` (Niveau: ${h.level})` : ''}${h.goal ? `, Ziel: ${h.goal}` : ''}. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Was er schon gemacht hat / auf der Liste hat: ${JSON.stringify(h.items.map((x) => `${x.title} (${x.status})`))}
${web ? 'Suche höchstens 2-mal im Internet (z.B. YouTube-Lektionen, Tabs, aktuelle Kurse) und gib Links aus den Suchergebnissen an.' : 'Antworte aus deinem Wissen (ohne Internet). Gib KEINE URLs an – die App erzeugt selbst einen Such-Link zum Titel.'}
Gib mit "ideen_zeigen" 5 bis 6 abwechslungsreiche, konkrete Ideen zurück, die ihn weiterbringen und Spaß machen – passend zu Niveau und Geschmack, nichts doppelt. Deutsch, kurz.`;
  const tool = web ? { ...HOBBY_TOOL, input_schema: JSON.parse(JSON.stringify(HOBBY_TOOL.input_schema)) } : HOBBY_TOOL;
  if (web) tool.input_schema.properties.ideen.items.properties.url = { type: 'string', description: 'Link aus den Suchergebnissen' };
  const input = await searchWithTool({ system, user: wish ? `Wunsch: ${wish}` : `Neue Ideen für ${h.name}`, tool, maxUses: web ? 2 : 0, label: 'Hobby-Ideen' });
  return (input.ideen || []).filter((x) => x && x.titel).map((x, i) => ({ id: 'h' + i + Date.now().toString(36), title: x.titel, kind: HOBBY_KINDS[x.art] ? x.art : 'idee', why: x.warum || '', url: /^https?:\/\//.test(x.url || '') ? x.url : searchLink(x.titel, x.art) }));
}

// Chat pro Hobby: Fragen, Üben, Motivation → Ideen übernehmen
const HOBBY_CHAT_TOOL = {
  name: 'antwort_geben',
  description: 'Antwort plus Ideen zum Merken.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Antwort (2–8 Sätze), gern mit Rückfrage' },
      ideen: HOBBY_TOOL.input_schema.properties.ideen,
    },
    required: ['antwort'],
  },
};
export async function hobbyChat(s, hobbyId, history, { web = false, smart = false } = {}) {
  const h = s.hobbies.find((x) => x.id === hobbyId);
  const system = `Du bist Mateos Mentor für sein Hobby „${h.name}“${h.level ? ` (Niveau: ${h.level})` : ''}${h.goal ? `, Ziel/Geschmack: ${h.goal}` : ''} in der App „Life“.
Seine Liste: ${JSON.stringify(h.items.map((x) => `${x.title} (${x.status})`))}
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Hilf ihm beim Üben und Weiterkommen: erkläre, gib Übungspläne, beantworte Fragen. Konkrete Dinge zum Merken (Songs, Videos, Bücher, Übungen) unter "ideen".
${web ? 'Du darfst höchstens 2-mal im Internet suchen; Links nur aus Suchergebnissen.' : 'Ohne Internet: aus deinem Wissen, keine URLs.'}
Antworte immer mit "antwort_geben". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: HOBBY_CHAT_TOOL, maxUses: web ? 2 : 0, label: 'Hobby-Chat', smart });
}

// Reisen und eigene Events liegen in trips.js und gather.js
export { addTrip } from './trips';
export { addGathering } from './gather';
