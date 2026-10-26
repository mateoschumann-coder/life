// Bibliothek („Lernen & Wissen“): Material pro Thema; Themen sind die Unterbereiche des Bereichs „mental“
import { store, uid } from './store';
import { today } from './dates';
import { searchWithTool } from './outings';

export const KINDS = {
  buch: { label: 'Buch', icon: 'book' },
  artikel: { label: 'Artikel', icon: 'news' },
  video: { label: 'Video', icon: 'play' },
  podcast: { label: 'Podcast', icon: 'mic' },
  kurs: { label: 'Kurs', icon: 'bulb' },
};
export const STATUS = { will: 'Will ich', aktiv: 'Gerade dabei', fertig: 'Fertig' };
export const topicsOf = (s) => s.areas.find((a) => a.id === 'mental')?.subs || [];
const norm = (x) => String(x || '').trim().toLowerCase();

export function findTopic(s, nameOrId) {
  const list = topicsOf(s);
  return list.find((t) => t.id === nameOrId) || list.find((t) => norm(t.name) === norm(nameOrId)) || null;
}
// Thema finden oder neu anlegen
export function ensureTopic(name) {
  const t = String(name || '').trim();
  if (!t) return null;
  const found = findTopic(store.get(), t);
  if (found) return found.id;
  const id = uid();
  store.update((s) => {
    s.areas.find((a) => a.id === 'mental')?.subs.push({ id, name: t });
  });
  return id;
}
export function removeTopic(id) {
  store.update((s) => {
    const a = s.areas.find((x) => x.id === 'mental');
    if (a) a.subs = a.subs.filter((x) => x.id !== id);
  });
}

export function addMaterial({ title, kind = 'buch', subId = null, author = '', url = '', note = '', why = '', status = 'will' }) {
  const t = String(title || '').trim();
  if (!t) return null;
  const s = store.get();
  if (s.library.some((m) => norm(m.title) === norm(t))) return null;
  const id = uid();
  store.update((d) => {
    d.library.push({ id, title: t, kind: KINDS[kind] ? kind : 'buch', subId, author, url, note, why, status, rating: 0, addedAt: today(), startedAt: status === 'aktiv' ? today() : null, finishedAt: null });
  });
  return id;
}
export function updateMaterial(id, patch) {
  store.update((s) => {
    const m = s.library.find((x) => x.id === id);
    if (!m) return;
    if (patch.status === 'aktiv' && !m.startedAt) patch.startedAt = today();
    if (patch.status === 'fertig') {
      patch.finishedAt = today();
      s.activities.push({ id: uid(), areaId: 'mental', date: today(), note: `Fertig: ${m.title}` });
    }
    Object.assign(m, patch);
  });
}
export function deleteMaterial(id) {
  store.update((s) => {
    s.library = s.library.filter((x) => x.id !== id);
  });
}

const RECO_TOOL = {
  name: 'empfehlungen_zeigen',
  description: 'Gibt Lese-/Lern-Empfehlungen strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      empfehlungen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string' },
            art: { type: 'string', enum: Object.keys(KINDS) },
            autor: { type: 'string', description: 'Autor, Kanal oder Anbieter' },
            warum: { type: 'string', description: '1 Satz: warum lohnt es sich für Mateo' },
          },
          required: ['titel', 'art', 'warum'],
        },
      },
    },
    required: ['empfehlungen'],
  },
};
export async function recommend(s, topicName, wish = '') {
  const have = s.library.map((m) => m.title);
  const system = `Du empfiehlst Mateo hochwertiges Material zum Thema „${topicName}“: Bücher, lange Artikel, gute Videos/Vorträge, Podcasts, Kurse. Er ist neugierig, analytisch, mag fundierte Erklärungen statt Oberflächlichem und liest gern auf Deutsch oder Englisch.
Was du über ihn weißt: ${JSON.stringify(s.memory.map((m) => m.text))}
Was er schon hat (nicht wiederholen): ${JSON.stringify(have)}
Antworte aus deinem Wissen (ohne Internet; nur Werke, die es sicher gibt) mit "empfehlungen_zeigen": 5 bis 6 abwechslungsreiche Empfehlungen zurück (mindestens 2 Bücher). Kurz, auf Deutsch. Links: Gib KEINE URLs an (du suchst nicht im Internet) – die App erzeugt selbst einen Such-Link zum Titel.`;
  const input = await searchWithTool({ system, user: wish ? `Wunsch: ${wish}` : `Was sollte ich zu ${topicName} lesen, hören oder ansehen?`, tool: RECO_TOOL, maxUses: 0, label: 'Lern-Empfehlungen' });
  return (input.empfehlungen || []).filter((r) => r && r.titel).map((r, i) => ({
    id: 'e' + i + Date.now().toString(36), title: r.titel, kind: KINDS[r.art] ? r.art : 'buch', author: r.autor || '', why: r.warum || '', url: ['video', 'podcast'].includes(r.art) ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.titel} ${r.autor || ''}`)}` : `https://www.google.com/search?q=${encodeURIComponent(`${r.titel} ${r.autor || ''}`)}`,
  }));
}
