// Karriere: mehrere Jobsuchen, Angebote (Such-Links günstig oder Websuche), Bewerbungs-Funnel,
// Analyse einer Stellenanzeige (was wird gesucht, was bringe ich mit, Checkliste) und Export für Claude
import { store, uid } from './store';
import { fmtLong, today } from './dates';
import { searchWithTool } from './outings';
import { aiLinks } from './links';
import { CAREER_DOCS } from './seed';

const norm = (x) => String(x || '').trim().toLowerCase();
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');
const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');

export const STAGES = [
  { id: 'gefunden', label: 'Gefunden', short: 'Gefunden' },
  { id: 'vorbereiten', label: 'Bewerbung vorbereiten', short: 'Vorbereiten' },
  { id: 'beworben', label: 'Beworben', short: 'Beworben' },
  { id: 'gespraech', label: 'Gespräche', short: 'Gespräch' },
  { id: 'angebot', label: 'Angebot', short: 'Angebot' },
  { id: 'abgesagt', label: 'Abgesagt / passt nicht', short: 'Aus' },
];
export const stageOf = (id) => STAGES.find((x) => x.id === id) || STAGES[0];
export const DEFAULT_DOCS = CAREER_DOCS;
export const DEFAULT_CHECK = ['Stellenanzeige gelesen und analysiert', 'Lebenslauf angepasst', 'Anschreiben geschrieben', 'Kontakt in der Firma gesucht (LinkedIn)', 'Bewerbung abgeschickt', 'Nachfassen nach 1 Woche'];

const items = (list) => list.map((text) => ({ id: uid(), text, done: false }));
export function ensureCareer(s) {
  if (!Array.isArray(s.jobSearches)) s.jobSearches = [];
  if (!Array.isArray(s.jobs)) s.jobs = [];
  if (!Array.isArray(s.careerDocs)) s.careerDocs = items(DEFAULT_DOCS);
}

// ---------- Suchen ----------
export function addSearch({ name, goal = '', location = 'Buenos Aires / remote' }) {
  const n = String(name || '').trim();
  if (!n) return null;
  const id = uid();
  store.update((s) => {
    ensureCareer(s);
    s.jobSearches.push({ id, name: n, goal, location, createdAt: today(), links: null, results: null });
  });
  return id;
}
export const updateSearch = (id, patch) => store.update((s) => Object.assign(s.jobSearches.find((x) => x.id === id) || {}, patch));
export const removeSearch = (id) => store.update((s) => {
  s.jobSearches = s.jobSearches.filter((x) => x.id !== id);
  s.jobs = s.jobs.filter((j) => j.searchId !== id || j.status !== 'gefunden');
});

// ---------- Jobs (Funnel) ----------
export function addJob({ searchId = null, title, company = '', url = '', location = '', note = '', deadline = '' }) {
  const t = String(title || '').trim();
  if (!t) return null;
  const s = store.get();
  if ((s.jobs || []).some((j) => norm(j.title) === norm(t) && norm(j.company) === norm(company))) return null;
  const id = uid();
  store.update((d) => {
    ensureCareer(d);
    d.jobs.push({ id, searchId, title: t, company, url: okUrl(url), location, note, deadline: okDate(deadline), status: 'gefunden', description: '', analysis: null, checklist: items(DEFAULT_CHECK), createdAt: today(), updatedAt: today() });
  });
  return id;
}
export const updateJob = (id, patch) => store.update((s) => Object.assign(s.jobs.find((x) => x.id === id) || {}, patch, { updatedAt: today() }));
export const removeJob = (id) => store.update((s) => { s.jobs = s.jobs.filter((x) => x.id !== id); });
export function toggleCheck(jobId, itemId) {
  store.update((s) => {
    const it = s.jobs.find((x) => x.id === jobId)?.checklist.find((x) => x.id === itemId);
    if (it) it.done = !it.done;
  });
}
export function addCheck(jobId, text) {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    const j = s.jobs.find((x) => x.id === jobId);
    if (j && !j.checklist.some((x) => norm(x.text) === norm(t))) j.checklist.push({ id: uid(), text: t, done: false });
  });
}
export const removeCheck = (jobId, itemId) => store.update((s) => {
  const j = s.jobs.find((x) => x.id === jobId);
  if (j) j.checklist = j.checklist.filter((x) => x.id !== itemId);
});

// ---------- Unterlagen ----------
export function addDoc(text) {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    ensureCareer(s);
    if (!s.careerDocs.some((x) => norm(x.text) === norm(t))) s.careerDocs.push({ id: uid(), text: t, done: false });
  });
}
export const toggleDoc = (id) => store.update((s) => { const d = s.careerDocs.find((x) => x.id === id); if (d) d.done = !d.done; });
export const removeDoc = (id) => store.update((s) => { s.careerDocs = s.careerDocs.filter((x) => x.id !== id); });

// ---------- KI ----------
const profile = (s) => JSON.stringify((s.memory || []).map((m) => m.text));
const searchText = (x) => `Suche „${x.name}“${x.goal ? ` – Ziel: ${x.goal}` : ''}${x.location ? ` – Ort: ${x.location}` : ''}`;

// Günstig: gezielte Such-Links (LinkedIn letzte 7 Tage, Google Jobs, Get on Board, Wellfound …)
export async function jobLinks(s, search) {
  const r = await aiLinks({
    s,
    system: `Du hilfst Mateo bei der Jobsuche. Heute ist ${fmtLong(today())}. Was du über ihn weißt: ${profile(s)}
${searchText(search)}
Wähle Suchbegriffe, die echte Stellentitel treffen (auf Englisch und Spanisch, z.B. „VC Analyst“, „Founder Associate“, „Chief of Staff AI startup“), und Google-Suchen nach Karriereseiten/Job-Boards von VCs und Startups (z.B. „site:jobs.ashbyhq.com …“, „site:boards.greenhouse.io …“).`,
    user: 'Welche Suchen bringen mir die neuesten passenden Angebote?',
    platforms: ['linkedin_jobs', 'google_jobs', 'getonbrd', 'wellfound', 'google'],
    label: 'Jobs: Such-Links',
    extra: (search.location || '').split('/')[0].trim() || 'Buenos Aires',
  });
  const v = { at: new Date().toISOString(), ...r };
  updateSearch(search.id, { links: v });
  return v;
}

const OFFERS_TOOL = {
  name: 'angebote_zeigen',
  description: 'Gibt gefundene Stellenangebote zurück.',
  input_schema: {
    type: 'object',
    properties: {
      hinweis: { type: 'string' },
      angebote: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, firma: { type: 'string' }, ort: { type: 'string' }, warum: { type: 'string', description: 'Halbsatz, warum es passt' }, datum: { type: 'string', description: 'Veröffentlicht, falls bekannt' }, url: { type: 'string', description: 'Nur aus den Suchergebnissen' } }, required: ['titel', 'firma'] } },
    },
    required: ['angebote'],
  },
};
// Gründlicher: konkrete Angebote per Websuche (max. 2 Suchen)
export async function jobOffersWeb(s, search) {
  const known = (s.jobs || []).map((j) => `${j.title} @ ${j.company}`);
  const system = `Du suchst für Mateo aktuelle Stellenangebote. Heute ist ${fmtLong(today())}. Was du über ihn weißt: ${profile(s)}
${searchText(search)}
Schon bekannt (nicht wiederholen): ${JSON.stringify(known)}
Suche höchstens 2-mal gezielt (Job-Boards, Karriereseiten) und gib 4–8 echte, möglichst frische Angebote mit Link aus den Suchergebnissen mit "angebote_zeigen" zurück. Deutsch, kurz.`;
  const r = await searchWithTool({ system, user: 'Finde die neuesten passenden Angebote.', tool: OFFERS_TOOL, maxUses: 2, label: 'Jobs: Websuche' });
  const v = { at: new Date().toISOString(), hint: r.hinweis || '', offers: (r.angebote || []).filter((x) => x && x.titel).map((x, i) => ({ id: 'o' + i + Date.now().toString(36), title: x.titel, company: x.firma || '', location: x.ort || '', why: x.warum || '', date: x.datum || '', url: okUrl(x.url) })) };
  updateSearch(search.id, { results: v });
  return v;
}

const ANALYSIS_TOOL = {
  name: 'analyse_geben',
  description: 'Analyse einer Stellenanzeige.',
  input_schema: {
    type: 'object',
    properties: {
      kurz: { type: 'string', description: '2–3 Sätze: Was ist das für eine Rolle, wie gut passt Mateo?' },
      passung: { type: 'integer', description: 'Passung 1–10' },
      gesucht: { type: 'array', items: { type: 'string' }, description: 'Was die Firma wirklich sucht (Kernanforderungen)' },
      mitbringen: { type: 'array', items: { type: 'string' }, description: 'Was Mateo konkret mitbringt (aus seinem Profil) – mit Beispielen' },
      luecken: { type: 'array', items: { type: 'string' }, description: 'Lücken und wie er sie schließt oder erklärt' },
      anschreiben: { type: 'array', items: { type: 'string' }, description: '3–5 Kernpunkte fürs Anschreiben' },
      fragen: { type: 'array', items: { type: 'string' }, description: 'Wahrscheinliche Interviewfragen' },
      checkliste: { type: 'array', items: { type: 'string' }, description: 'Konkrete Vorbereitungs-Schritte für genau diese Bewerbung' },
    },
    required: ['kurz', 'gesucht', 'mitbringen', 'checkliste'],
  },
};
export async function analyzeJob(s, job, { smart = false } = {}) {
  const system = `Du bist ein erfahrener Karriere-Coach (Startups, VC, KI). Heute ist ${fmtLong(today())}.
Was du über Mateo weißt: ${profile(s)}
Analysiere die Stelle ehrlich und konkret. Wenn keine Stellenanzeige eingefügt ist, arbeite mit Titel/Firma und deinem Wissen über die Firma und sag, dass die Anzeige die Analyse verbessert. Gib das Ergebnis mit "analyse_geben" zurück. Deutsch, ohne Markdown.`;
  const r = await searchWithTool({
    system, tool: ANALYSIS_TOOL, maxUses: 0, label: 'Job-Analyse', smart,
    user: JSON.stringify({ titel: job.title, firma: job.company, ort: job.location, link: job.url, stellenanzeige: job.description || '(nicht eingefügt)', notizen: job.note || undefined }),
  });
  const analysis = { date: today(), ...r };
  store.update((d) => {
    const j = d.jobs.find((x) => x.id === job.id);
    if (!j) return;
    j.analysis = analysis;
    for (const t of r.checkliste || []) if (!j.checklist.some((x) => norm(x.text) === norm(t))) j.checklist.push({ id: uid(), text: t, done: false });
  });
  return analysis;
}

// Text für den Chat mit Claude (claude.ai): alles Wichtige zur Stelle, zum Weiterarbeiten (Anschreiben, CV anpassen …)
export function claudeBrief(s, job) {
  const a = job.analysis || {};
  const list = (title, arr) => (arr?.length ? `\n## ${title}\n${arr.map((x) => `- ${x}`).join('\n')}` : '');
  return `Ich bewerbe mich auf folgende Stelle und möchte mit dir die Bewerbung vorbereiten (Anschreiben, Lebenslauf anpassen, Interview-Vorbereitung).

# ${job.title}${job.company ? ` – ${job.company}` : ''}
${[job.location, job.url].filter(Boolean).join(' · ')}
Status: ${stageOf(job.status).label}

## Über mich
${(s.memory || []).map((m) => `- ${m.text}`).join('\n') || '- (siehe meinen Lebenslauf)'}
${a.kurz ? `\n## Einschätzung\n${a.kurz}${a.passung ? ` (Passung ${a.passung}/10)` : ''}` : ''}${list('Was gesucht wird', a.gesucht)}${list('Was ich mitbringe', a.mitbringen)}${list('Lücken', a.luecken)}${list('Kernpunkte fürs Anschreiben', a.anschreiben)}${list('Mögliche Interviewfragen', a.fragen)}
${job.description ? `\n## Stellenanzeige\n${job.description}` : ''}${job.note ? `\n## Meine Notizen\n${job.note}` : ''}

Bitte fang mit einem Entwurf für das Anschreiben an (auf ${/argentin|buenos aires|latam/i.test(`${job.location} ${job.description}`) ? 'Spanisch oder Englisch – frag mich kurz' : 'Englisch'}), kurz und konkret.`;
}

// Chat pro Suche: Strategie, nächste Schritte, Angebote, Unterlagen
const CHAT_TOOL = {
  name: 'antwort_geben',
  description: 'Antwort plus Vorschläge zum Übernehmen.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Antwort (2–8 Sätze), ehrlich und konkret, gern mit Rückfrage' },
      angebote: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, firma: { type: 'string' }, url: { type: 'string' }, warum: { type: 'string' } }, required: ['titel'] }, description: 'Konkrete Stellen/Firmen zum Merken (nur echte)' },
      todos: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, tage_ab_heute: { type: 'integer' } }, required: ['text'] }, description: 'Nächste Schritte als Aufgaben' },
      unterlagen: { type: 'array', items: { type: 'string' }, description: 'Unterlagen, die er vorbereiten sollte' },
    },
    required: ['antwort'],
  },
};
// Allgemeiner Karriere-Coach (über alle Suchen, Bewerbungen und eigenen Projekte)
export async function careerChat(s, history, { web = false, smart = false } = {}) {
  const jobs = (s.jobs || []).map((j) => `${j.title} @ ${j.company} (${stageOf(j.status).label})`);
  const searches = (s.jobSearches || []).map(searchText);
  const projects = (s.sideProjects || []).map((p) => `${p.name} (${p.status})`);
  const docs = (s.careerDocs || []).map((d) => `${d.text}${d.done ? ' ✓' : ''}`);
  const system = `Du bist Mateos Karriere-Coach in der App „Life“. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${profile(s)}
Seine Jobsuchen: ${JSON.stringify(searches)}
Seine Bewerbungen: ${JSON.stringify(jobs)}
Eigene Projekte: ${JSON.stringify(projects)}
Unterlagen: ${JSON.stringify(docs)}
Hilf beim ganzen Funnel: Zielrollen schärfen, Firmen/Fonds finden, Unterlagen, Netzwerk/Ansprache, Nachfassen, Interviews. Konkrete nächste Schritte unter "todos", Firmen/Stellen unter "angebote", fehlende Unterlagen unter "unterlagen".
${web ? 'Du darfst höchstens 2-mal im Internet suchen; Links nur aus Suchergebnissen.' : 'Ohne Internet: aus deinem Wissen, keine URLs erfinden.'}
Antworte immer mit "antwort_geben". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: CHAT_TOOL, maxUses: web ? 2 : 0, label: 'Karriere-Chat', smart });
}
