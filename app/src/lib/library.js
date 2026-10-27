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

export function addMaterial({ title, kind = 'buch', subId = null, author = '', url = '', note = '', why = '', status = 'will', cat = null }) {
  const t = String(title || '').trim();
  if (!t) return null;
  const s = store.get();
  if (s.library.some((m) => norm(m.title) === norm(t))) return null;
  const id = uid();
  store.update((d) => {
    d.library.push({ id, title: t, kind: KINDS[kind] ? kind : 'buch', cat: cat || (kind === 'podcast' && d.libCats.some((c) => c.id === 'podcasts') ? 'podcasts' : d.libCats[0]?.id || 'bibliothek'), subId, author, url, note, why, status, rating: 0, addedAt: today(), startedAt: status === 'aktiv' ? today() : null, finishedAt: null });
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
// Such-Link statt (teurer) Websuche: Podcast → Spotify, Video → YouTube, sonst Google
export const linkFor = (title, author, kind) => {
  const q = encodeURIComponent(`${title} ${author || ''}`.trim());
  if (kind === 'podcast') return `https://open.spotify.com/search/${q}/podcasts`;
  if (kind === 'video') return `https://www.youtube.com/results?search_query=${q}`;
  return `https://www.google.com/search?q=${q}`;
};
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');
const toReco = (r, i, fallbackKind) => {
  const kind = KINDS[r.art] ? r.art : fallbackKind || 'buch';
  return { id: 'e' + i + Date.now().toString(36), title: r.titel, kind, author: r.autor || '', why: r.warum || '', url: okUrl(r.url) || linkFor(r.titel, r.autor, kind) };
};
const catText = (cat) => (cat?.kind ? `Kategorie „${cat.name}“: empfiehl NUR ${KINDS[cat.kind].label === 'Podcast' ? 'Podcasts (ganze Shows oder einzelne starke Folgen)' : `Material der Art „${KINDS[cat.kind].label}“`}.` : cat ? `Kategorie „${cat.name}“: abwechslungsreich (Bücher, lange Artikel, Videos/Vorträge, Kurse${cat.id === 'bibliothek' ? '' : ', Podcasts'}).` : '');

// Kategorien (Bibliothek, Podcasts, eigene)
export function addLibCat(name, kind = '') {
  const n = String(name || '').trim();
  if (!n) return null;
  const id = uid();
  store.update((s) => { s.libCats.push({ id, name: n, kind: KINDS[kind] ? kind : '', icon: KINDS[kind]?.icon || 'bulb' }); });
  return id;
}
export function removeLibCat(id) {
  store.update((s) => {
    s.libCats = s.libCats.filter((c) => c.id !== id);
    s.library = s.library.filter((m) => m.cat !== id);
  });
}

export async function recommend(s, topicName, wish = '', { web = false, cat = null } = {}) {
  const have = s.library.map((m) => m.title);
  const system = `Du empfiehlst Mateo hochwertiges Material zum Thema „${topicName}“. ${catText(cat)} Er ist neugierig, analytisch, mag fundierte Erklärungen statt Oberflächlichem und liest/hört gern auf Deutsch oder Englisch.
Was du über ihn weißt: ${JSON.stringify(s.memory.map((m) => m.text))}
Was er schon hat (nicht wiederholen): ${JSON.stringify(have)}
${web ? 'Suche höchstens 2-mal gezielt im Internet (aktuelle Empfehlungen, neue Folgen/Bücher) und gib Links aus den Suchergebnissen an.' : 'Antworte aus deinem Wissen (ohne Internet; nur Werke, die es sicher gibt). Gib KEINE URLs an – die App erzeugt selbst einen Such-Link.'}
Gib mit "empfehlungen_zeigen" 5 bis 6 abwechslungsreiche Empfehlungen zurück. Kurz, auf Deutsch.`;
  const tool = web ? { ...RECO_TOOL, input_schema: JSON.parse(JSON.stringify(RECO_TOOL.input_schema)) } : RECO_TOOL;
  if (web) tool.input_schema.properties.empfehlungen.items.properties.url = { type: 'string', description: 'Link aus den Suchergebnissen' };
  const input = await searchWithTool({ system, user: wish ? `Wunsch: ${wish}` : `Was sollte ich zu ${topicName} lesen, hören oder ansehen?`, tool, maxUses: web ? 2 : 0, label: 'Lern-Empfehlungen' });
  return (input.empfehlungen || []).filter((r) => r && r.titel).map((r, i) => toReco(r, i, cat?.kind));
}

// Chat pro Kategorie: Gespräch über Lernen, mit Empfehlungen zum Übernehmen
const LIB_CHAT_TOOL = {
  name: 'antwort_geben',
  description: 'Antwort plus Empfehlungen zum Merken.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Antwort (2–8 Sätze), gern mit Rückfrage' },
      empfehlungen: RECO_TOOL.input_schema.properties.empfehlungen,
    },
    required: ['antwort'],
  },
};
export async function libChat(s, cat, history, { web = false, smart = false } = {}) {
  const topics = topicsOf(s).map((t) => t.name);
  const mine = s.library.filter((m) => m.cat === cat.id).map((m) => `${m.title} (${STATUS[m.status]}${m.rating ? `, ${m.rating}★` : ''}${m.note ? `, Notiz: ${m.note}` : ''})`);
  const system = `Du bist Mateos Lern-Begleiter in der App „Life“ für „${cat.name}“. ${catText(cat)}
Seine Themen: ${JSON.stringify(topics)}. Was er in dieser Kategorie hat: ${JSON.stringify(mine)}
Was du über ihn weißt: ${JSON.stringify(s.memory.map((m) => m.text))}
Hilf ihm, Neues zu entdecken, Gelesenes/Gehörtes einzuordnen und dranzubleiben. Konkrete Vorschläge unter "empfehlungen".
${web ? 'Du darfst höchstens 2-mal im Internet suchen; Links nur aus Suchergebnissen.' : 'Ohne Internet: aus deinem Wissen, keine URLs.'}
Antworte immer mit "antwort_geben". Deutsch, kein Markdown.`;
  const r = await searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: LIB_CHAT_TOOL, maxUses: web ? 2 : 0, label: `Chat: ${cat.name}`, smart });
  return r;
}

// ---------- v0.72: KI-Zusammenfassung, Notizen & Learnings pro Material ----------
const SUMMARY_TOOL = {
  name: 'zusammenfassung',
  description: 'Kompakte Zusammenfassung eines Buchs/Materials.',
  input_schema: {
    type: 'object',
    properties: {
      kern: { type: 'string', description: 'Worum geht es? 2–3 Sätze' },
      punkte: { type: 'array', items: { type: 'string' }, description: '5–8 wichtigste Gedanken/Thesen, je 1 Satz' },
      fuer_dich: { type: 'string', description: '1–2 Sätze: was davon für Mateo (Profil) besonders relevant ist' },
      unsicher: { type: 'boolean', description: 'true, wenn du das Werk nicht sicher kennst' },
    },
    required: ['kern', 'punkte'],
  },
};
export async function summarizeMaterial(s, m) {
  const fetchable = /^https?:\/\//.test(m.url || '') && ['artikel', 'video', 'podcast', 'kurs'].includes(m.kind);
  const base = {
    system: `Fasse für Mateo das Material zusammen: ${KINDS[m.kind]?.label || 'Buch'} „${m.title}“${m.author ? ` von ${m.author}` : ''}.${fetchable ? ` Wenn möglich, öffne den Link mit web_fetch und fasse den Inhalt der Seite zusammen.` : ' Aus deinem Wissen.'} Kennst du das Werk nicht sicher, sag das (unsicher = true) und erfinde nichts. Was du über Mateo weißt: ${JSON.stringify((s.memory || []).map((x) => x.text)).slice(0, 1500)}. Deutsch, kein Markdown. Antworte mit "zusammenfassung".`,
    user: fetchable ? `${m.title}\n${m.url}` : m.title,
    tool: SUMMARY_TOOL,
    maxUses: 0,
    maxTokens: 2000,
    label: 'Zusammenfassung',
  };
  let r;
  if (fetchable) { try { r = await searchWithTool({ ...base, fetch: true }); } catch { r = await searchWithTool(base); } } else r = await searchWithTool(base);
  if (!r?.kern) throw new Error('Keine Zusammenfassung bekommen – bitte nochmal versuchen.');
  const summary = { kern: r.kern, punkte: r.punkte || [], fuerDich: r.fuer_dich || '', unsicher: !!r.unsicher, at: today() };
  updateMaterial(m.id, { summary });
  return summary;
}

export function addNote(id, text) {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    const m = s.library.find((x) => x.id === id);
    if (m) m.notes = [...(m.notes || []), { id: uid(), text: t, at: today() }];
  });
}
export function removeNote(id, noteId) {
  store.update((s) => {
    const m = s.library.find((x) => x.id === id);
    if (m) m.notes = (m.notes || []).filter((n) => n.id !== noteId);
  });
}
const LEARN_TOOL = {
  name: 'learnings',
  description: 'Notizen strukturiert.',
  input_schema: {
    type: 'object',
    properties: {
      kernaussage: { type: 'string', description: 'Die eine wichtigste Erkenntnis, 1 Satz' },
      themen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, punkte: { type: 'array', items: { type: 'string' } } }, required: ['titel', 'punkte'] }, description: '2–5 Themen mit Mateos Punkten, sauber formuliert' },
      anwenden: { type: 'array', items: { type: 'string' }, description: '1–3 konkrete Ideen, wie Mateo das umsetzen kann' },
    },
    required: ['themen'],
  },
};
export async function structureNotes(s, m) {
  const notes = (m.notes || []).map((n) => n.text);
  if (m.note) notes.unshift(m.note);
  if (!notes.length) throw new Error('Erst ein paar Notizen eintragen.');
  const r = await searchWithTool({
    system: `Ordne Mateos Notizen zu „${m.title}“${m.author ? ` (${m.author})` : ''} in klare Learnings. Nur seine Gedanken verwenden, nichts aus dem Buch dazuerfinden; Formulierungen glätten, Doppeltes zusammenfassen. Deutsch, kein Markdown. Antworte mit "learnings".`,
    user: notes.map((x) => `- ${x}`).join('\n'),
    tool: LEARN_TOOL,
    maxUses: 0,
    maxTokens: 2000,
    label: 'Learnings strukturieren',
  });
  const learnings = { kernaussage: r.kernaussage || '', themen: r.themen || [], anwenden: r.anwenden || [], at: today() };
  updateMaterial(m.id, { learnings });
  return learnings;
}
