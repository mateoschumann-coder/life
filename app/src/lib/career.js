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
  { id: 'interessiert', label: 'Interessiert', short: 'Interessiert' },
  { id: 'beworben', label: 'Beworben', short: 'Beworben' },
  { id: 'rueckmeldung', label: 'Positive Rückmeldung', short: 'Rückmeldung' },
  { id: 'gespraech', label: 'Gespräche', short: 'Gespräche' },
  { id: 'angebot', label: 'Angebot', short: 'Angebot' },
  { id: 'abgesagt', label: 'Absage / passt nicht', short: 'Absage' },
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
  s.jobs = s.jobs.filter((j) => j.searchId !== id || j.status !== 'interessiert');
});

// ---------- Jobs (Funnel) ----------
export function addJob({ searchId = null, title, company = '', url = '', location = '', note = '', deadline = '', status = 'interessiert', description = '', about = '', mode = '', salary = '', tasks = [], reqs = [] }) {
  const t = String(title || '').trim();
  if (!t) return null;
  const s = store.get();
  if ((s.jobs || []).some((j) => norm(j.title) === norm(t) && norm(j.company) === norm(company))) return null;
  const id = uid();
  store.update((d) => {
    ensureCareer(d);
    d.jobs.push({ id, searchId, title: t, company, url: okUrl(url), location, note, deadline: okDate(deadline), status: STAGES.some((x) => x.id === status) ? status : 'interessiert', description: String(description || ''), about, mode, salary, tasks: Array.isArray(tasks) ? tasks : [], reqs: Array.isArray(reqs) ? reqs : [], analysis: null, checklist: [], createdAt: today(), updatedAt: today() });
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
    materialize(j, j.status);
    for (const t of r.checkliste || []) if (!j.checks[j.status].some((x) => norm(x.text) === norm(t))) j.checks[j.status].push({ id: uid(), text: shortStep(t), done: false });
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

// ---------- Trichter per Gespräch (ohne Internet, günstig) ----------
// Mateo erzählt („Bei Kaszek beworben, Mercado Libre hat abgesagt …“) oder fügt eine Anzeige ein → Änderungen am Trichter
const FUNNEL_TOOL = {
  name: 'trichter_aktualisieren',
  description: 'Antwort plus Änderungen am Bewerbungs-Trichter.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: '1–4 Sätze: kurz bestätigen, was du einträgst; nur nachfragen, wenn etwas Wichtiges fehlt (z.B. Firma)' },
      aenderungen: {
        type: 'array',
        description: 'Eine Zeile pro Stelle, die neu ist oder sich geändert hat',
        items: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'ID, wenn es eine bekannte Stelle ist' },
            titel: { type: 'string' },
            firma: { type: 'string' },
            phase: { type: 'string', enum: ['interessiert', 'beworben', 'rueckmeldung', 'gespraech', 'angebot', 'abgesagt'] },
            notiz: { type: 'string', description: 'Kurz, z.B. „2. Gespräch am Donnerstag mit CEO“' },
            ort: { type: 'string' },
            url: { type: 'string', description: 'Nur wenn Mateo einen Link genannt hat' },
          },
          required: ['titel', 'phase'],
        },
      },
    },
    required: ['antwort'],
  },
};
export async function funnelChat(s, search, history) {
  const known = (s.jobs || []).filter((j) => j.searchId === search.id || !j.searchId).map((j) => ({ id: j.id, titel: j.title, firma: j.company, phase: j.status }));
  const system = `Du pflegst Mateos Bewerbungs-Trichter für die ${searchText(search)}. Heute ist ${fmtLong(today())}.
Phasen: interessiert → beworben → rueckmeldung (positive Rückmeldung, es geht weiter) → gespraech → angebot; abgesagt = Absage oder passt nicht.
Bekannte Stellen: ${JSON.stringify(known)}
Mateo erzählt, wie es läuft, oder fügt eine Stellenanzeige ein. Mach daraus Einträge unter "aenderungen": bekannte Stellen mit job_id und neuer Phase, neue Stellen ohne job_id. Bei einer eingefügten Anzeige: Titel, Firma, Ort herauslesen, Phase interessiert (außer er sagt etwas anderes). Erfinde keine Stellen. Antworte immer mit "trichter_aktualisieren". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: FUNNEL_TOOL, maxUses: 0, maxTokens: 1500, label: 'Trichter-Chat' });
}
// Änderungen übernehmen; lange eingefügte Texte werden bei neuen Stellen als Anzeige gespeichert
export function applyFunnel(search, list, pasted = '') {
  const s = store.get();
  let n = 0;
  for (const x of list || []) {
    if (!x || !x.titel) continue;
    const phase = STAGES.some((st) => st.id === x.phase) ? x.phase : 'interessiert';
    const j = (s.jobs || []).find((y) => y.id === x.job_id) || (s.jobs || []).find((y) => norm(y.title) === norm(x.titel) && (!x.firma || norm(y.company) === norm(x.firma))) || (x.firma ? (s.jobs || []).find((y) => norm(y.company) === norm(x.firma) && y.searchId === search.id) : null);
    if (j) {
      updateJob(j.id, { status: phase, note: x.notiz ? [j.note, `${today()}: ${x.notiz}`].filter(Boolean).join('\n') : j.note });
      n++;
    } else if (addJob({ searchId: search.id, title: x.titel, company: x.firma || '', location: x.ort || '', url: x.url || '', note: x.notiz ? `${today()}: ${x.notiz}` : '', status: phase, description: list.length === 1 && pasted.length > 300 ? pasted : '' })) n++;
  }
  return n;
}

// v0.73: Stellenanzeigen per Link oder Text übernehmen – auch mehrere auf einmal – mit Steckbrief
export const WORK_MODES = { remote: '🏠 Remote', hybrid: '🔀 Hybrid', vor_ort: '🏢 Vor Ort' };
const JOB_ITEM = {
  type: 'object',
  properties: {
    titel: { type: 'string', description: 'Jobtitel' },
    firma: { type: 'string' },
    ueber_firma: { type: 'string', description: '1 Satz: was die Firma macht' },
    ort: { type: 'string', description: 'Stadt/Land' },
    arbeitsmodell: { type: 'string', enum: ['remote', 'hybrid', 'vor_ort', ''] },
    gehalt: { type: 'string', description: 'Gehalt/Spanne, falls genannt' },
    aufgaben: { type: 'array', items: { type: 'string' }, description: 'Jobprofil: 3–7 Hauptaufgaben, je kurz' },
    anforderungen: { type: 'array', items: { type: 'string' }, description: 'Anforderungen: 3–8, je kurz (Muss vor Kann)' },
    frist: { type: 'string', description: 'Bewerbungsfrist YYYY-MM-DD, falls genannt' },
    link: { type: 'string', description: 'Link zur Anzeige, falls bekannt' },
    anzeige: { type: 'string', description: 'Der Anzeigentext ohne Navigation/Werbung (max. ca. 3500 Zeichen, nicht zusammenfassen)' },
  },
  required: ['titel'],
};
const JOBS_TOOL = { name: 'stellen_lesen', description: 'Eine oder mehrere Stellenanzeigen.', input_schema: { type: 'object', properties: { stellen: { type: 'array', items: JOB_ITEM } }, required: ['stellen'] } };
const toJob = (r, fallbackText = '') => ({
  title: r?.titel || '', company: r?.firma || '', about: r?.ueber_firma || '', location: r?.ort || '', mode: WORK_MODES[r?.arbeitsmodell] ? r.arbeitsmodell : '', salary: r?.gehalt || '',
  tasks: (r?.aufgaben || []).filter(Boolean), reqs: (r?.anforderungen || []).filter(Boolean),
  deadline: /^\d{4}-\d{2}-\d{2}$/.test(r?.frist || '') ? r.frist : '', url: /^https?:\/\//.test(r?.link || '') ? r.link : '', description: r?.anzeige || fallbackText,
});
export async function importJobs(s, input) {
  const text = String(input || '').trim();
  const urls = [...new Set(text.match(/https?:\/\/\S+/g) || [])];
  const onlyUrls = urls.length && !text.replace(/https?:\/\/\S+/g, '').trim();
  const base = {
    system: `Lies Stellenanzeigen für Mateo aus – eine Stelle pro Eintrag unter "stellen".${onlyUrls ? ` Öffne jeden Link mit web_fetch und lies die Anzeige. Klappt ein Link nicht (z.B. Anmeldung nötig), nutze die Wörter in der Adresse, setze link und lass "anzeige" leer.` : ' Er hat Text eingefügt (eine oder mehrere Anzeigen); Links im Text gehören zur jeweiligen Stelle.'} Fülle den Steckbrief (Firma, Ort, Arbeitsmodell, Gehalt, Aufgaben, Anforderungen) knapp auf Deutsch. Nichts erfinden, Unbekanntes leer lassen. Antworte mit "stellen_lesen".`,
    user: text.slice(0, 20000),
    tool: JOBS_TOOL,
    maxUses: 0,
    maxTokens: 6000,
    label: 'Stellen übernehmen',
  };
  let r;
  if (onlyUrls) { try { r = await searchWithTool({ ...base, fetch: true, fetchMax: Math.min(8, urls.length + 1) }); } catch { r = await searchWithTool(base); } } else r = await searchWithTool(base);
  const list = (r?.stellen || []).map((x, i) => { const j = toJob(x); if (!j.url && urls.length === (r.stellen || []).length) j.url = urls[i]; if (!j.description && !onlyUrls && (r.stellen || []).length === 1) j.description = text.slice(0, 4000); return j; }).filter((j) => j.title);
  if (!list.length) throw new Error('Keine Stelle erkannt. Am besten den Anzeigentext einfügen.');
  return list;
}
// Steckbrief einer vorhandenen Stelle aus ihrem Anzeigentext füllen
export async function fillJobProfile(s, job) {
  const src = [job.description, job.url].filter(Boolean).join('\n');
  if (!src.trim()) throw new Error('Erst den Anzeigentext oder Link einfügen.');
  const [x] = await importJobs(s, job.description ? job.description : job.url);
  const patch = {};
  for (const k of ['company', 'about', 'location', 'mode', 'salary', 'deadline']) if (x[k] && !job[k]) patch[k] = x[k];
  if (x.tasks.length) patch.tasks = x.tasks;
  if (x.reqs.length) patch.reqs = x.reqs;
  if (!job.description && x.description) patch.description = x.description;
  updateJob(job.id, patch);
  return patch;
}

// ---------- v0.92 (Mateo): Checkliste pro Phase, Vorbereitung pro Stelle, To-dos + Vorbereitung pro Suche ----------
const shortStep = (x) => { let s = String(x || '').trim(); if (s.length > 40) s = s.replace(/\s*[(:–—].*$/, '').trim(); return s; };
export const STAGE_CHECKS = {
  interessiert: ['Anzeige genau lesen', 'Passung prüfen', 'Lebenslauf anpassen', 'Anschreiben schreiben', 'Kontakt in der Firma suchen', 'Bewerbung abschicken'],
  beworben: ['Bestätigung abwarten', 'Recruiter auf LinkedIn vernetzen', 'Nach 1 Woche nachfassen'],
  rueckmeldung: ['Termin vereinbaren', 'Gesprächspartner herausfinden', 'Eigene Bewerbung nochmal lesen'],
  gespraech: ['Interviewer recherchieren', 'Eigene Story üben', 'STAR-Beispiele vorbereiten', 'Rückfragen vorbereiten', 'Technik / Outfit checken', 'Danke-Mail schicken'],
  angebot: ['Angebot prüfen', 'Gehalt verhandeln', 'Starttermin klären', 'Anderen Firmen Bescheid geben'],
  abgesagt: ['Feedback erfragen', 'Learnings notieren', 'Kontakt halten'],
};
const tplChecks = (st) => (STAGE_CHECKS[st] || []).map((text, i) => ({ id: `tpl-${st}-${i}`, text, done: false }));
// Liste einer Phase: gespeichert – sonst alte Checkliste (für die aktuelle Phase) – sonst Vorlage
export function checksOf(j, st) {
  if (j.checks?.[st]) return j.checks[st];
  if (st === j.status && (j.checklist || []).length) return j.checklist;
  return tplChecks(st);
}
function materialize(j, st) {
  j.checks = j.checks || {};
  if (!j.checks[st]) j.checks[st] = checksOf(j, st).map((x) => ({ ...x }));
}
export const stageCheck = {
  toggle: (jobId, st, id) => store.update((s) => { const j = s.jobs.find((x) => x.id === jobId); if (!j) return; materialize(j, st); const it = j.checks[st].find((x) => x.id === id); if (it) it.done = !it.done; }),
  add: (jobId, st, text) => { const tx = shortStep(text); if (!tx) return; store.update((s) => { const j = s.jobs.find((x) => x.id === jobId); if (!j) return; materialize(j, st); if (!j.checks[st].some((x) => norm(x.text) === norm(tx))) j.checks[st].push({ id: uid(), text: tx, done: false }); }); },
  remove: (jobId, st, id) => store.update((s) => { const j = s.jobs.find((x) => x.id === jobId); if (!j) return; materialize(j, st); j.checks[st] = j.checks[st].filter((x) => x.id !== id); }),
};
export const checkCount = (j) => { const l = checksOf(j, j.status); return { done: l.filter((x) => x.done).length, all: l.length }; };

// Allgemeine Listen mit Teilen (cat): Vorbereitung einer Stelle, To-dos und Vorbereitung einer Suche
export const JOB_PREP = {
  Unternehmen: ['Geschäftsmodell verstehen', 'Aktuelle News lesen', 'Produkt ausprobieren', 'Wettbewerber kennen'],
  Rolle: ['Anforderungen mit mir abgleichen', 'Passende Beispiele sammeln'],
  Menschen: ['Recruiter ansehen (LinkedIn)', 'Interviewer recherchieren', 'Kontakt im Team suchen'],
  Fragen: ['Eigene Fragen notieren', 'Gehaltsvorstellung festlegen'],
};
export const SEARCH_TODOS = {
  Unterlagen: ['Lebenslauf aktualisieren', 'Anschreiben-Vorlage', 'LinkedIn-Profil anpassen', 'Zeugnisse sammeln', 'Arbeitsproben / Portfolio'],
  Suche: ['Job-Alerts einrichten', 'Zielfirmen-Liste', 'Jobportale auswählen'],
  Netzwerk: ['Kontakte anschreiben', 'Event / Meetup besuchen'],
};
export const SEARCH_PREP = {
  Fähigkeiten: ['Typische Anforderungen sammeln', 'Lücken schließen', 'Tools sicher beherrschen'],
  'Markt & Branche': ['Wichtigste Firmen kennen', 'Gehaltsniveau kennen', 'Trends kennen'],
  Rolle: ['Arbeitsalltag verstehen', 'Mit Leuten in der Rolle sprechen'],
};
const catItems = (tpl) => Object.entries(tpl).flatMap(([cat, list]) => list.map((text) => ({ id: uid(), text, cat, done: false })));
const LISTS = { prep: { coll: 'jobs', tpl: JOB_PREP }, todos: { coll: 'jobSearches', tpl: SEARCH_TODOS }, sprep: { coll: 'jobSearches', tpl: SEARCH_PREP } };
// Liste holen (Vorlage beim ersten Mal anlegen)
export function listOf(obj, key) { return obj[key] || null; }
export function ensureList(kind, id) {
  const { coll, tpl } = LISTS[kind];
  const field = kind === 'sprep' ? 'prep' : kind;
  store.update((s) => { const o = (s[coll] || []).find((x) => x.id === id); if (o && !o[field]) o[field] = catItems(tpl); });
}
export const catList = {
  add: (kind, id, text, cat) => { const { coll } = LISTS[kind]; const field = kind === 'sprep' ? 'prep' : kind; const tx = shortStep(text); if (!tx) return; store.update((s) => { const o = (s[coll] || []).find((x) => x.id === id); if (!o) return; o[field] = o[field] || []; if (!o[field].some((x) => norm(x.text) === norm(tx))) o[field].push({ id: uid(), text: tx, cat, done: false }); }); },
  toggle: (kind, id, itemId) => { const { coll } = LISTS[kind]; const field = kind === 'sprep' ? 'prep' : kind; store.update((s) => { const it = ((s[coll] || []).find((x) => x.id === id)?.[field] || []).find((x) => x.id === itemId); if (it) it.done = !it.done; }); },
  remove: (kind, id, itemId) => { const { coll } = LISTS[kind]; const field = kind === 'sprep' ? 'prep' : kind; store.update((s) => { const o = (s[coll] || []).find((x) => x.id === id); if (o) o[field] = (o[field] || []).filter((x) => x.id !== itemId); }); },
};

// KI: Vorbereitung für die ganze Suche vorschlagen (ohne Internet)
const PREP_TOOL = {
  name: 'vorbereitung_vorschlagen',
  description: 'Konkrete, kurze Punkte zur Vorbereitung.',
  input_schema: { type: 'object', properties: { punkte: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: 'GANZ kurz, 2–6 Wörter, z.B. „SQL-Window-Functions üben“' }, teil: { type: 'string' } }, required: ['text', 'teil'] } } }, required: ['punkte'] },
};
export async function suggestSearchPrep(s, search) {
  const jobs = (s.jobs || []).filter((j) => j.searchId === search.id);
  const r = await searchWithTool({
    system: `Du bist Karriere-Coach. Mateo sucht Jobs als „${search.name}“${search.goal ? ` (wichtig: ${search.goal})` : ''}. Was du über ihn weißt: ${profile(s)}
Schlag 6–10 konkrete Punkte vor, was er beherrschen/wissen sollte, um sich für solche Stellen gut zu bewerben – Fähigkeiten (konkrete Tools/Methoden), Markt & Branche (Firmen, Gehälter, Trends), Rolle (Alltag, typische Cases). Nutze die Anforderungen der gespeicherten Stellen. Nichts doppeln, was schon auf der Liste steht. Teil = einer von: Fähigkeiten, Markt & Branche, Rolle.`,
    user: JSON.stringify({ anforderungen: jobs.flatMap((j) => j.reqs || []).slice(0, 40), schon_auf_der_liste: (search.prep || []).map((x) => x.text) }),
    tool: PREP_TOOL, maxUses: 0, maxTokens: 1500, label: 'Jobsuche: Vorbereitung',
  });
  return r?.punkte || [];
}

// KI-Recherche zu einer Stelle: Firma, News, Kultur, Menschen, Interviewfragen – mit Internet (bis 3 Suchen) oder ohne
const RESEARCH_TOOL = {
  name: 'recherche_geben',
  description: 'Recherche zur Bewerbung, kurz und konkret.',
  input_schema: {
    type: 'object',
    properties: {
      firma: { type: 'string', description: '2–3 Sätze: Was macht die Firma, Größe, Finanzierung/Eigentümer, Markt' },
      news: { type: 'array', items: { type: 'string' }, description: 'Aktuelle Entwicklungen (mit Monat/Jahr), max. 4' },
      kultur: { type: 'string', description: 'Werte, Arbeitsweise, was sie bei Kandidaten mögen – 1–2 Sätze' },
      menschen: { type: 'array', items: { type: 'string' }, description: 'Wer wahrscheinlich interviewt (Rollen, ggf. Namen aus öffentlichen Quellen) und worauf achten' },
      fragen: { type: 'array', items: { type: 'string' }, description: 'Wahrscheinliche Interviewfragen, max. 6' },
      eigene_fragen: { type: 'array', items: { type: 'string' }, description: 'Kluge Rückfragen, die Mateo stellen kann, max. 4' },
      vorbereitung: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', description: '2–5 Wörter' }, teil: { type: 'string', enum: Object.keys(JOB_PREP) } }, required: ['text', 'teil'] }, description: 'Konkrete Vorbereitungs-Punkte für die Checkliste' },
      quellen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, url: { type: 'string' } }, required: ['url'] }, description: 'Nur echte Links aus den Suchergebnissen' },
    },
    required: ['firma'],
  },
};
export async function researchJob(s, job, { web = true } = {}) {
  const r = await searchWithTool({
    system: `Du bereitest Mateo auf eine Bewerbung vor. Heute ist ${fmtLong(today())}. Was du über ihn weißt: ${profile(s)}
Recherchiere ${web ? 'mit der Websuche (höchstens 3 Suchen: Firma + News, Firma + Kultur/Glassdoor/Interview, Personen/Team auf LinkedIn)' : 'aus deinem Wissen (ohne Internet – sag bei Unsicherheit „vermutlich“)'} und gib kurz und konkret zurück: Firma, aktuelle News, Kultur, Menschen (wer interviewt wohl, worauf achten), wahrscheinliche Fragen, kluge Rückfragen, Vorbereitungs-Punkte. Deutsch, ohne Markdown. Antworte mit "recherche_geben".`,
    user: JSON.stringify({ stelle: job.title, firma: job.company, ort: job.location, link: job.url || undefined, anzeige: (job.description || '').slice(0, 3000) || undefined, aufgaben: job.tasks, anforderungen: job.reqs }),
    tool: RESEARCH_TOOL, maxUses: web ? 3 : 0, maxTokens: 4000, label: web ? 'Bewerbung: Recherche (Internet)' : 'Bewerbung: Recherche',
  });
  const okUrl2 = (u) => (/^https?:\/\//.test(u || '') ? u : '');
  const research = { date: today(), web, ...r, quellen: (r.quellen || []).filter((q) => okUrl2(q.url)) };
  store.update((d) => {
    const j = d.jobs.find((x) => x.id === job.id);
    if (!j) return;
    j.research = research;
    j.prep = j.prep || catItems(JOB_PREP);
    for (const x of r.vorbereitung || []) { const tx = shortStep(x.text); if (tx && !j.prep.some((y) => norm(y.text) === norm(tx))) j.prep.push({ id: uid(), text: tx, cat: JOB_PREP[x.teil] ? x.teil : 'Unternehmen', done: false }); }
  });
  return research;
}
