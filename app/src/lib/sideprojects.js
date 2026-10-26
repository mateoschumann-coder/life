// Karriere: eigene Projekte (z.B. ML-Projekt, Portfolio, Startup-Idee) – messbar über Meilensteine und Arbeitszeit
import { store, uid } from './store';
import { addDays, fmtLong, startOfWeek, today } from './dates';
import { searchWithTool } from './outings';

const norm = (x) => String(x || '').trim().toLowerCase();
export const SP_STATUS = { idee: 'Idee', aktiv: 'Aktiv', pausiert: 'Pausiert', fertig: 'Fertig' };

export function addSideProject({ name, goal = '' }) {
  const n = String(name || '').trim();
  if (!n) return null;
  const id = uid();
  store.update((s) => {
    s.sideProjects = s.sideProjects || [];
    s.sideProjects.push({ id, name: n, goal, status: 'aktiv', link: '', showcase: '', milestones: [], log: [], createdAt: today() });
  });
  return id;
}
export const updateSideProject = (id, patch) => store.update((s) => Object.assign((s.sideProjects || []).find((x) => x.id === id) || {}, patch));
export const removeSideProject = (id) => store.update((s) => { s.sideProjects = (s.sideProjects || []).filter((x) => x.id !== id); });
export function addMilestone(id, text) {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    const p = (s.sideProjects || []).find((x) => x.id === id);
    if (p && !p.milestones.some((m) => norm(m.text) === norm(t))) p.milestones.push({ id: uid(), text: t, done: false, doneAt: null });
  });
}
export function toggleMilestone(id, mId) {
  store.update((s) => {
    const m = (s.sideProjects || []).find((x) => x.id === id)?.milestones.find((x) => x.id === mId);
    if (m) { m.done = !m.done; m.doneAt = m.done ? today() : null; }
  });
}
export const removeMilestone = (id, mId) => store.update((s) => {
  const p = (s.sideProjects || []).find((x) => x.id === id);
  if (p) p.milestones = p.milestones.filter((m) => m.id !== mId);
});
// Arbeitszeit eintragen (zählt auch als Aktivität im Bereich Karriere)
export function logWork(id, minutes, note = '') {
  if (!minutes) return;
  store.update((s) => {
    const p = (s.sideProjects || []).find((x) => x.id === id);
    if (!p) return;
    p.log.push({ id: uid(), date: today(), minutes: Number(minutes), note });
    if (p.status === 'idee' || p.status === 'pausiert') p.status = 'aktiv';
    s.activities.push({ id: uid(), areaId: 'karriere', date: today(), note: `${p.name}: ${minutes} Min` });
  });
}
export const removeLog = (id, logId) => store.update((s) => {
  const p = (s.sideProjects || []).find((x) => x.id === id);
  if (p) p.log = p.log.filter((l) => l.id !== logId);
});

// Kennzahlen
export function stats(p) {
  const t = today();
  const done = p.milestones.filter((m) => m.done).length;
  const week0 = startOfWeek(t);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(week0, (i - 7) * 7);
    const to = addDays(from, 6);
    return { date: from, value: p.log.filter((l) => l.date >= from && l.date <= to).reduce((n, l) => n + l.minutes, 0) };
  });
  const last = p.log.map((l) => l.date).sort().pop() || null;
  return {
    pct: p.milestones.length ? Math.round((done / p.milestones.length) * 100) : 0,
    done, total: p.milestones.length,
    thisWeek: weeks[7].value,
    month: p.log.filter((l) => l.date >= addDays(t, -27)).reduce((n, l) => n + l.minutes, 0),
    totalMin: p.log.reduce((n, l) => n + l.minutes, 0),
    sessions: p.log.length,
    last, weeks,
  };
}
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h` : `${m} Min`);

// KI-Begleiter pro Projekt
const TOOL = {
  name: 'antwort_geben',
  description: 'Antwort plus Vorschläge zum Übernehmen.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Antwort (2–8 Sätze), konkret, gern mit Rückfrage' },
      meilensteine: { type: 'array', items: { type: 'string' }, description: 'Messbare Meilensteine, z.B. „Daten bereinigt und erste Grafik“' },
      todos: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, tage_ab_heute: { type: 'integer' } }, required: ['text'] }, description: 'Kleine nächste Schritte (30–90 Min)' },
    },
    required: ['antwort'],
  },
};
export async function sideProjectChat(s, p, history, { web = false, smart = false } = {}) {
  const st = stats(p);
  const system = `Du bist Mateos Mentor für sein eigenes Projekt „${p.name}“ in der App „Life“. Heute ist ${fmtLong(today())}.
Ziel des Projekts: ${p.goal || '(noch offen – hilf es zu schärfen)'}. Wofür es ihm beruflich helfen soll: ${p.showcase || '(offen)'}
Stand: Status ${SP_STATUS[p.status]}, Meilensteine ${JSON.stringify(p.milestones.map((m) => `${m.text}${m.done ? ' ✓' : ''}`))}, Arbeitszeit diese Woche ${st.thisWeek} Min, letzte 4 Wochen ${st.month} Min, zuletzt gearbeitet ${st.last || 'noch nie'}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Hilf ihm, messbar voranzukommen: klare, kleine Meilensteine, der nächste konkrete Schritt, wie er das Projekt sichtbar macht (GitHub, LinkedIn, Portfolio). Vorschläge unter "meilensteine" und "todos".
${web ? 'Du darfst höchstens 1-mal im Internet suchen.' : 'Ohne Internet, keine URLs.'} Antworte immer mit "antwort_geben". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: TOOL, maxUses: web ? 1 : 0, label: 'Eigene Projekte', smart });
}
