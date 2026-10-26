// Weiterentwicklung: Skills (Sprachen, Python/ML, KI …) mit täglichen kleinen Impulsen und Übungs-Chat.
// Ziel: jeden Tag kurz dranbleiben, nichts Kompliziertes. Ohne Websuche (Videos über YouTube-Suchlinks).
import { store, uid } from './store';
import { addDays, fmtLong, today } from './dates';
import { searchWithTool } from './outings';

const norm = (x) => String(x || '').trim().toLowerCase();
export const SKILL_PRESETS = [
  { name: 'Portugiesisch', kind: 'sprache', lang: 'pt-BR' },
  { name: 'Italienisch', kind: 'sprache', lang: 'it-IT' },
  { name: 'Spanisch', kind: 'sprache', lang: 'es-AR' },
  { name: 'Python', kind: 'tech' },
  { name: 'Machine Learning', kind: 'tech' },
  { name: 'KI anwenden', kind: 'tech' },
];
const LANGS = { portug: 'pt-BR', italien: 'it-IT', spani: 'es-AR', englisch: 'en-US', franz: 'fr-FR' };
const guessLang = (name) => Object.entries(LANGS).find(([k]) => norm(name).includes(k))?.[1] || '';

export function addSkill(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const s = store.get();
  if ((s.skills || []).some((x) => norm(x.name) === norm(n))) return null;
  const preset = SKILL_PRESETS.find((p) => norm(p.name) === norm(n));
  const lang = preset?.lang || guessLang(n);
  const id = uid();
  store.update((d) => {
    d.skills = d.skills || [];
    d.skills.push({ id, name: n, kind: preset?.kind || (lang ? 'sprache' : 'tech'), lang, level: '', goal: '', log: [], createdAt: today() });
  });
  return id;
}
export const updateSkill = (id, patch) => store.update((s) => Object.assign((s.skills || []).find((x) => x.id === id) || {}, patch));
export const removeSkill = (id) => store.update((s) => { s.skills = (s.skills || []).filter((x) => x.id !== id); });
// Heute dran gewesen (an/aus); zählt auch als Aktivität im Bereich Weiterentwicklung
export function togglePractice(id, day = today()) {
  store.update((s) => {
    const sk = (s.skills || []).find((x) => x.id === id);
    if (!sk) return;
    if (sk.log.includes(day)) sk.log = sk.log.filter((d) => d !== day);
    else {
      sk.log.push(day);
      if (!s.activities.some((a) => a.areaId === 'entwicklung' && a.date === day && a.note === sk.name)) s.activities.push({ id: uid(), areaId: 'entwicklung', date: day, note: sk.name });
    }
  });
}
export const practicedToday = (sk) => (sk.log || []).includes(today());
export function streak(sk) {
  let n = 0;
  let d = practicedToday(sk) ? today() : addDays(today(), -1);
  while ((sk.log || []).includes(d)) { n++; d = addDays(d, -1); }
  return n;
}
export const lastDays = (sk, n = 7) => Array.from({ length: n }, (_, i) => addDays(today(), i - n + 1)).map((d) => ({ d, on: (sk.log || []).includes(d) }));

// ---------- Tages-Impulse ----------
const KEY = 'life-app-impulse';
export const ARTEN = { gespraech: 'Sprechen mit der KI', video: 'Video', podcast: 'Podcast', uebung: 'Übung', lesen: 'Lesen', projekt: 'Mini-Projekt' };
export function loadImpulses() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
export function saveImpulses(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}
const IMPULSE_TOOL = {
  name: 'impulse_geben',
  description: 'Gibt kleine Tages-Impulse pro Skill zurück.',
  input_schema: {
    type: 'object',
    properties: {
      impulse: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'Name des Skills genau wie angegeben' },
            art: { type: 'string', enum: Object.keys(ARTEN) },
            titel: { type: 'string', description: 'Kurz und einladend, z.B. „10 Min auf Portugiesisch über dein Wochenende reden“' },
            text: { type: 'string', description: '1 Satz, was genau zu tun ist' },
            suchbegriff: { type: 'string', description: 'Bei video/podcast: YouTube-Suchbegriff in der Zielsprache, z.B. „podcast italiano facile principianti“' },
            start: { type: 'string', description: 'Bei gespraech: erster Satz an die KI, mit dem Mateo das Gespräch beginnt (in der Zielsprache bzw. auf Deutsch bei Tech)' },
            minuten: { type: 'integer' },
          },
          required: ['skill', 'art', 'titel'],
        },
      },
    },
    required: ['impulse'],
  },
};
export async function makeImpulses(s, onlySkillId = null) {
  const skills = (s.skills || []).filter((x) => !onlySkillId || x.id === onlySkillId);
  const info = skills.map((x) => ({ skill: x.name, art: x.kind, niveau: x.level || 'unbekannt', ziel: x.goal || undefined, zuletzt: x.log.slice(-1)[0] || 'noch nie', tage_letzte_woche: lastDays(x).filter((d) => d.on).length }));
  const system = `Du bist Mateos freundlicher Lern-Anstupser in der App „Life“. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Ziel: Er soll jeden Tag kurz dranbleiben – nichts Kompliziertes, 5–20 Minuten, abwechslungsreich und motivierend.
Gib ${onlySkillId ? '3 verschiedene Impulse für diesen Skill' : 'pro Skill genau 1 Impuls (bei länger vernachlässigten gern besonders einladend)'} mit "impulse_geben" zurück.
Bei Sprachen abwechseln: mit der KI sprechen (art gespraech, mit start-Satz in der Sprache), Video/Podcast in der Sprache (suchbegriff), kleine Übung. Bei Tech: kleine Übung, Mini-Projekt, Video (suchbegriff auf Englisch), Lesen. Keine URLs. Deutsch (außer start/suchbegriff).`;
  const r = await searchWithTool({ system, user: JSON.stringify(info), tool: IMPULSE_TOOL, maxUses: 0, label: 'Lern-Impulse' });
  const list = (r.impulse || []).map((x, i) => {
    const sk = skills.find((y) => norm(y.name) === norm(x.skill)) || skills[0];
    return { id: 'i' + i + Date.now().toString(36), skillId: sk?.id, art: ARTEN[x.art] ? x.art : 'uebung', title: x.titel, text: x.text || '', start: x.start || '', minutes: x.minuten || null, url: x.suchbegriff ? `https://www.youtube.com/results?search_query=${encodeURIComponent(x.suchbegriff)}` : '', done: false };
  }).filter((x) => x.skillId);
  if (onlySkillId) return list;
  const v = { date: today(), items: list };
  saveImpulses(v);
  return v;
}
export function markImpulse(id, done = true) {
  const v = loadImpulses();
  if (!v) return null;
  const next = { ...v, items: v.items.map((x) => (x.id === id ? { ...x, done } : x)) };
  saveImpulses(next);
  return next;
}

// ---------- Übungs-Chat ----------
const CHAT_TOOL = {
  name: 'antwort_geben',
  description: 'Antwort plus optionale Übungen zum Merken.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Deine Antwort' },
      uebungen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, suchbegriff: { type: 'string', description: 'Optional YouTube-Suchbegriff' } }, required: ['titel'] }, description: 'Optional: Übungen/Videos als Aufgaben für die nächsten Tage' },
    },
    required: ['antwort'],
  },
};
const LANG_NAME = { 'pt-BR': 'brasilianisches Portugiesisch', 'it-IT': 'Italienisch', 'es-AR': 'argentinisches Spanisch', 'en-US': 'Englisch', 'fr-FR': 'Französisch' };
export async function skillChat(s, sk, history, { web = false, smart = false } = {}) {
  const lang = LANG_NAME[sk.lang];
  const system = sk.kind === 'sprache' && lang
    ? `Du bist Mateos Gesprächspartner zum Üben von ${lang}. Niveau: ${sk.level || 'unbekannt – schätze es aus seinen Nachrichten'}. Ziel: ${sk.goal || 'locker sprechen können'}.
So arbeitest du: Antworte in ${lang}, natürlich und kurz (2–4 Sätze), passend zu seinem Niveau, und stell eine Frage, damit das Gespräch weitergeht. Er spricht oft per Spracheingabe – kleine Tippfehler ignorieren. Wenn er Fehler macht, hänge ans Ende eine Zeile „💡 Korrektur: …“ auf Deutsch mit den 1–2 wichtigsten Verbesserungen. Wenn er auf Deutsch schreibt oder um Erklärung bittet, erkläre auf Deutsch. Unter "uebungen" nur auf Wunsch etwas vorschlagen.
Antworte immer mit "antwort_geben". Kein Markdown.`
    : `Du bist Mateos Tutor für „${sk.name}“. Niveau: ${sk.level || 'unbekannt'}. Ziel: ${sk.goal || '(offen)'}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Erkläre klar mit kleinen Beispielen (Code knapp, als Text), stelle kleine Übungsaufgaben und gib Feedback. Konkrete Übungen für die nächsten Tage unter "uebungen".
${web ? 'Du darfst höchstens 1-mal im Internet suchen.' : 'Ohne Internet, keine URLs.'} Antworte immer mit "antwort_geben". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: CHAT_TOOL, maxUses: web && sk.kind !== 'sprache' ? 1 : 0, label: `Üben: ${sk.name}`, smart });
}

// Ideen-Chat: Was könnte ich auf Basis dessen, was ich schon mache, noch lernen/tun? (ohne Internet)
const IDEA_TOOL = {
  name: 'antwort_geben',
  description: 'Antwort plus Vorschläge.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Antwort (2–8 Sätze), konkret und motivierend' },
      skills: { type: 'array', items: { type: 'string' }, description: 'Neue Skills, die er hinzufügen könnte (kurzer Name, z.B. „SQL“)' },
      aufgaben: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, tage_ab_heute: { type: 'integer' } }, required: ['text'] }, description: 'Konkrete kleine Schritte' },
    },
    required: ['antwort'],
  },
};
export async function ideaChat(s, history, { smart = false } = {}) {
  const info = (s.skills || []).map((x) => `${x.name} (${x.level || 'Niveau offen'}, ${lastDays(x).filter((d) => d.on).length}×/Woche)`);
  const system = `Du bist Mateos Lern-Berater in der App „Life“. Heute ist ${fmtLong(today())}.
Was er gerade übt: ${JSON.stringify(info)}
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Gib Ideen, was er auf Basis dessen, was er schon macht, noch lernen oder ausprobieren könnte – und wie man Dinge clever verbindet (z.B. Sprache + Hobby, Python + eigenes Interesse). Konkret, klein anfangen. Neue Skills unter "skills", erste Schritte unter "aufgaben". Ohne Internet, keine URLs. Antworte immer mit "antwort_geben". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: IDEA_TOOL, maxUses: 0, label: 'Lern-Ideen', smart });
}
