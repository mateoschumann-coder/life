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

// Reisen und eigene Events liegen in trips.js und gather.js
export { addTrip } from './trips';
export { addGathering } from './gather';
