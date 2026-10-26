// Coach: kommt aktiv auf Mateo zu. Einmal am Tag (beim ersten Öffnen) geht er die Themen-Boxen
// nacheinander durch (Weiterbildung, Karriere, Menschen, Ausgehen, News, Gesundheit …), sucht gezielt
// im Internet nach Material und gibt pro Box 1–3 kleine Anstöße und eine kurze Frage.
import { addDays, fmtLong, today } from './dates';
import { allAreaStatuses, peopleOverdue, upcomingBirthdays } from './logic';
import { explainError, getAi, trackUsage } from './ai';

const KEY = 'life-app-coach';
const LOG_KEY = 'life-app-coach-log';
export const ARTEN = ['aufgabe', 'projekt', 'event', 'link'];

// Die Themen-Boxen des Coachs, in dieser Reihenfolge
export const BOXES = [
  { id: 'lernen', title: 'Weiterbildung', icon: 'book', areas: ['entwicklung'], hint: 'Kleine, leichte Lern-Anstöße (Portugiesisch, Italienisch, Python/ML, KI anwenden, eigene Projekte), gern mit konkretem Material: Video, Podcast, Übung, Artikel, Mini-Projekt für heute. Nicht kompliziert.' },
  { id: 'karriere', title: 'Karriere & Jobsuche', icon: 'briefcase', areas: ['karriere'], hint: 'Fragen, wie es bei der Jobsuche läuft; ein konkreter nächster Schritt (Bewerbung, Kontakt anschreiben, Unterlagen); gern eine passende Chance oder ein Event aus der Suche (Startups/VC, KI-nahe Rollen).' },
  { id: 'menschen', title: 'Menschen', icon: 'users', areas: ['familie', 'freunde', 'neue'], hint: 'Wem er sich mal wieder melden sollte, Geburtstage, Ideen für ein Treffen.' },
  { id: 'ausgehen', title: 'Ausgehen & Treffen', icon: 'pin', areas: ['erlebnisse'], hint: '1–2 Events in Buenos Aires aus der Websuche, passend zu seinen Vorlieben (gern auch ein Geheimtipp), ein Ort von seiner Will-hin-Liste, oder ein Anstoß für sein eigenes geplantes Treffen (Einladungen raus? Einkauf?) bzw. die Idee, mal wieder selbst etwas zu organisieren.' },
  { id: 'freizeit', title: 'Hobbys & Reisen', icon: 'plane', areas: ['freizeit'], hint: 'Zu einem seiner Hobbys ein konkreter Anstoß mit Material (z.B. ein neuer Song zum Lernen, ein Schach-Video), offene To-dos einer anstehenden Reise.' },
  { id: 'news', title: 'Informiert bleiben', icon: 'news', areas: ['informiert'], hint: '1–2 aktuelle, wirklich interessante Neuigkeiten zu seinen Themen, mit 1–2 Sätzen Zusammenfassung im text und Link.' },
  { id: 'wissen', title: 'Lernen & Wissen', icon: 'bulb', areas: ['mental'], hint: 'Neugier-Themen (Geschichte, Physik, Geopolitik …): ans aktuelle Buch erinnern („20 Min lesen?“), passend zu seinen Themen ein konkretes neues Buch/Video/Artikel vorschlagen (art link mit url).' },
  { id: 'gesundheit', title: 'Gesundheit & Sport', icon: 'heart', areas: ['koerper'], hint: 'Training (seine Sportarten, Einheiten, nächste Rennen), aktive Verletzungen ernst nehmen (z.B. passendes Übungsvideo, Pause), fällige Vorsorge-Termine, Erholung.' },
  { id: 'alltag', title: 'Zuhause', icon: 'home', areas: ['zuhause'], hint: 'Fällige Erinnerungen (Miete, WLAN …), 1 Punkt aus der Haushaltsliste, Rezeptidee (gern Airfryer), Erinnerung an die Einkaufsliste – nur wenn sinnvoll.' },
];
export const boxOfArea = (areaId) => BOXES.find((b) => b.areas.includes(areaId));

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
export const lastBriefing = () => {
  const b = load(KEY, null);
  return b && Array.isArray(b.boxes) ? b : null; // alte Form (ohne Boxen) ignorieren
};
export const saveBriefing = (b) => save(KEY, b);
export const autoCoach = () => getAi().autoCoach !== false;

// Antworten auf Coach-Fragen merken (fließen in den nächsten Durchgang ein)
export function logAnswer(question, answer, boxId) {
  const log = load(LOG_KEY, []);
  log.push({ date: today(), box: boxId, frage: question, antwort: answer });
  save(LOG_KEY, log.slice(-30));
}

const NUDGE = {
  type: 'object',
  properties: {
    art: { type: 'string', enum: ARTEN, description: 'aufgabe = konkreter Schritt als To-do · projekt = Idee für ein neues Projekt · event = Veranstaltung aus der Suche · link = Artikel, Video, Übung, News aus der Suche' },
    titel: { type: 'string', description: 'Kurz, z.B. „20 Min Portugiesisch-Podcast“' },
    text: { type: 'string', description: '1 bis 2 Sätze, persönlich und locker („Mach doch heute …“, „Seit 9 Tagen …“). Bei News: Zusammenfassung.' },
    aufgabe: { type: 'string', description: 'Titel des To-dos beim Übernehmen' },
    bereich_id: { type: 'string' },
    projekt_id: { type: 'string' },
    projekt_name: { type: 'string', description: 'Nur bei art=projekt' },
    url: { type: 'string', description: 'Nur Links aus deinen Suchergebnissen, nie erfinden' },
    quelle: { type: 'string' },
    datum: { type: 'string', description: 'Bei Events: JJJJ-MM-TT' },
    ort: { type: 'string' },
  },
  required: ['art', 'titel', 'text'],
};
const COACH_TOOL = {
  name: 'briefing_geben',
  description: 'Gibt Mateo sein tägliches Briefing: Lagebild und Themen-Boxen mit kleinen Anstößen und je einer kurzen Frage.',
  input_schema: {
    type: 'object',
    properties: {
      lagebild: { type: 'string', description: '1 bis 2 Sätze: Wie steht Mateo gerade da? Persönlich, motivierend, ehrlich.' },
      boxen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            box: { type: 'string', enum: BOXES.map((b) => b.id) },
            frage: { type: 'string', description: 'Optional: eine kurze, persönliche Coach-Frage, z.B. „Hast du diese Woche schon Portugiesisch gemacht?“ oder „Wie läuft die Jobsuche?“' },
            anstoesse: { type: 'array', items: NUDGE, description: '1 bis 3 Anstöße' },
          },
          required: ['box', 'anstoesse'],
        },
      },
    },
    required: ['boxen'],
  },
};

function coachData(s) {
  const t = today();
  const d7 = addDays(t, -7);
  const statuses = allAreaStatuses(s, t).filter((x) => !x.area.paused);
  return {
    heute: t,
    wochentag: fmtLong(t),
    was_ich_ueber_mateo_weiss: (s.memory || []).map((m) => m.text),
    letzte_antworten_auf_deine_fragen: load(LOG_KEY, []).slice(-12),
    bereiche: statuses.map(({ area, status }) => ({ id: area.id, name: area.name, zuletzt_aktiv: status.last, status: status.text, unterbereiche: area.subs.map((x) => x.name) })),
    projekte: s.projects.filter((p) => p.status === 'aktiv').map((p) => {
      const ts = s.tasks.filter((x) => x.projectId === p.id);
      return {
        id: p.id, name: p.name, bereich_id: p.areaId, faellig: p.due || undefined,
        offen: ts.filter((x) => !x.done).map((x) => x.title).slice(0, 5),
        erledigt_7_tage: ts.filter((x) => x.done && x.doneAt >= d7).length,
        bausteine: (p.blocks || []).map((b) => b.title),
      };
    }),
    offene_aufgaben: s.tasks.filter((x) => !x.done && !x.projectId).slice(-30).map((x) => ({ titel: x.title, faellig: x.due || undefined, bereich: x.areaId || undefined })),
    ueberfaellig: s.tasks.filter((x) => !x.done && x.due && x.due < t).map((x) => x.title),
    fokus_themen: s.habits.map((h) => {
      const ds = s.checkins.filter((c) => c.habitId === h.id).map((c) => c.date).sort();
      return { thema: h.name, bereich_id: h.areaId, letzte: ds.at(-1) || null, tage_7: ds.filter((d) => d >= d7).length };
    }),
    menschen_ueberfaellig: peopleOverdue(s, t).filter((x) => x.ratio >= 1).slice(0, 5).map((x) => ({ name: x.person.name, tage_seit_kontakt: x.since, rhythmus_tage: x.person.contactEvery })),
    geburtstage_bald: upcomingBirthdays(s, t, 14).map((x) => ({ name: x.person.name, in_tagen: x.inDays })),
    news_themen: s.radar.topics,
    events_gemerkt: s.events.filter((e) => e.stage !== 'besucht').map((e) => ({ name: e.name, datum: e.date })),
    orte_will_hin: (s.places || []).filter((p) => p.status === 'will').map((p) => p.name).slice(0, 10),
    sport: (s.sports || []).map((sp) => {
      const ss = s.sessions.filter((x) => x.sportId === sp.id);
      return { sportart: sp.name, ziel: sp.goal || undefined, einheiten_7_tage: ss.filter((x) => x.date >= d7).length, km_7_tage: Math.round(ss.filter((x) => x.date >= d7).reduce((n, x) => n + (x.distance || 0), 0)), letzte: ss.map((x) => x.date).sort().at(-1) || null, rennen: s.projects.filter((p) => p.sportId === sp.id && p.status === 'aktiv').map((p) => ({ name: p.name, datum: p.due, zielzeit: p.goalTime })) };
    }),
    verletzungen_aktiv: (s.healthItems || []).filter((h) => h.type === 'verletzung' && h.status !== 'ausgeheilt').map((h) => h.title),
    vorsorge_faellig: (s.healthItems || []).filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt' && h.date && h.date <= addDays(t, 14)).map((h) => ({ titel: h.title, datum: h.date })),
    einkaufsliste_offen: (s.shopping?.items || []).filter((x) => !x.done).length,
    rezepte: (s.recipes || []).map((r) => r.title).slice(0, 15),
    erinnerungen_bald: (s.reminders || []).filter((r) => r.next <= addDays(t, 5)).map((r) => ({ titel: r.title, datum: r.next })),
    zuhause_offen: Object.fromEntries(Object.entries(s.home || {}).map(([k, l]) => [k, (l.items || []).filter((x) => !x.done).map((x) => `${x.cat}: ${x.text}`).slice(0, 8)])),
    hobbys: (s.hobbies || []).map((h) => ({ hobby: h.name, niveau: h.level || undefined, geschmack: h.goal || undefined, offen: h.items.filter((x) => x.status !== 'geschafft').map((x) => x.title).slice(0, 5), geschafft: h.items.filter((x) => x.status === 'geschafft').map((x) => x.title).slice(-5) })),
    reisen_bald: (s.trips || []).filter((tr) => !tr.to || tr.to >= t).map((tr) => ({ reise: tr.name, von: tr.from, offen: tr.todo.filter((x) => !x.done).map((x) => x.text) })),
    eigene_treffen: (s.gatherings || []).filter((g) => !g.date || g.date >= t).map((g) => ({ name: g.name, datum: g.date, gaeste: g.guests.length, zugesagt: g.guests.filter((x) => x.status === 'zugesagt').length, nicht_eingeladen: g.guests.filter((x) => x.status === 'offen').length, einkauf_offen: g.shopping.filter((x) => !x.done).length })),
    event_vorlieben: s.profile?.eventPrefs || [],
    bibliothek_gerade: (s.library || []).filter((m) => m.status === 'aktiv').map((m) => m.title),
    bibliothek_will: (s.library || []).filter((m) => m.status === 'will').map((m) => m.title).slice(0, 10),
    wissensthemen: (s.areas.find((a) => a.id === 'mental')?.subs || []).map((x) => x.name),
  };
}

function systemPrompt() {
  const boxes = BOXES.map((b) => `– ${b.id} (${b.title}, Bereiche ${b.areas.join('/')}): ${b.hint}`).join('\n');
  return `Du bist Mateos persönlicher Coach in seiner Life-App. Mateo lebt in Buenos Aires. Heute ist ${fmtLong(today())} (${today()}).
Mateo will vorankommen, nicht perfekt organisiert sein, und wenig Zeit in der App verbringen. Du gehst seine Themen der Reihe nach durch, pushst ihn gezielt und lieferst ein bisschen Material dazu. Es muss nicht kompliziert sein: kleine, machbare Schritte.

Deine Themen-Boxen (in dieser Reihenfolge):
${boxes}

So gehst du vor:
1. Lies seine Daten, was du über ihn weißt und seine letzten Antworten auf deine Fragen.
2. Nutze die Websuche höchstens 4-mal, gezielt für Material mit echtem Mehrwert (Events, News zu seinen Themen, eine Lernquelle/Übung/Video, evtl. eine Job-Chance). Führe ALLE Suchen zuerst aus und rufe "briefing_geben" erst ganz am Ende allein auf.
3. Rufe "briefing_geben" auf: kurzes lagebild und 4 bis 6 Boxen (nur Boxen mit sinnvollem Inhalt; lernen, karriere und menschen fast immer). Pro Box 1 bis 3 Anstöße, höchstens 1 Idee für ein neues Projekt insgesamt. Gib in 2 bis 4 Boxen eine kurze, persönliche frage, um zu erfahren, wie es läuft (darauf antwortet er mit Ja/Nein oder per Sprache).
4. Ton: locker, persönlich, ermutigend („Mach doch heute mal …“, „Hast du diese Woche …?“). Keine Vorwürfe, kein schlechtes Gewissen.
5. Erfinde keine Fakten und keine Links. Wenn kaum Daten da sind, gib Einstiegs-Anstöße und frage nach seinen Zielen.
Alles auf Deutsch, ohne Markdown.`;
}

async function post(body) {
  const ai = getAi();
  if (!ai.apiKey) throw new Error('KEIN_SCHLUESSEL');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ai.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: ai.model, ...body }),
  });
  if (!res.ok) {
    let msg = '';
    try {
      msg = (await res.json())?.error?.message || '';
    } catch {}
    if (res.status === 400 && /web_search|web search/i.test(msg)) throw new Error('SUCHE_AUS');
    throw new Error(explainError(res.status, msg));
  }
  const data = await res.json();
  trackUsage(ai.model, data.usage);
  return data;
}

export async function askCoach(s, { search = true } = {}) {
  const tools = [COACH_TOOL];
  if (search) tools.unshift({ type: 'web_search_20250305', name: 'web_search', max_uses: 4, user_location: { type: 'approximate', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' } });
  const messages = [{ role: 'user', content: `Meine Daten (JSON): ${JSON.stringify(coachData(s))}\n\nGeh meine Themen durch: Was sind heute meine Anstöße?` }];
  let data;
  let tool;
  try {
    for (let round = 0; round < 4; round++) {
      data = await post({ max_tokens: 8000, system: systemPrompt(), tools, messages });
      tool = data.content.find((c) => c.type === 'tool_use' && c.name === COACH_TOOL.name);
      if (tool && data.stop_reason === 'max_tokens') tool = null;
      if (tool || data.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: data.content });
    }
  } catch (e) {
    if (e.message === 'SUCHE_AUS' && search) return askCoach(s, { search: false });
    throw e;
  }
  if (!tool) {
    // Gespräch mit den bisherigen Suchergebnissen fortsetzen und das Briefing verlangen
    const prev = data.content.filter((c) => c.type !== 'tool_use');
    const cont = prev.length ? [...messages, { role: 'assistant', content: prev }, { role: 'user', content: 'Gib jetzt das Briefing mit briefing_geben – kompakt, ohne weitere Suche.' }] : messages;
    data = await post({ max_tokens: 8000, system: systemPrompt(), tools, tool_choice: { type: 'tool', name: COACH_TOOL.name }, messages: cont });
    tool = data.content.find((c) => c.type === 'tool_use' && c.name === COACH_TOOL.name);
  }
  if (!tool) throw new Error('Das Briefing ist nicht angekommen. Bitte noch einmal auf den Pfeil tippen.');
  const input = tool?.input || {};
  const validUrl = (u) => (/^https?:\/\//.test(u || '') ? u : null);
  const host = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };
  let n = 0;
  const boxes = (input.boxen || [])
    .filter((x) => x && BOXES.some((b) => b.id === x.box))
    .map((x) => {
      const def = BOXES.find((b) => b.id === x.box);
      return {
        id: x.box,
        question: x.frage || null,
        answered: null,
        items: (x.anstoesse || []).filter((a) => a && a.titel).map((a) => {
          const areaId = s.areas.some((y) => y.id === a.bereich_id) ? a.bereich_id : def.areas[0];
          return {
            id: 'c' + n++,
            art: ARTEN.includes(a.art) ? a.art : 'aufgabe',
            title: String(a.titel),
            text: a.text || '',
            task: a.aufgabe || a.titel,
            areaId,
            projectId: s.projects.some((p) => p.id === a.projekt_id) ? a.projekt_id : null,
            projectName: a.projekt_name || null,
            url: validUrl(a.url),
            source: a.quelle || host(a.url),
            date: /^\d{4}-\d{2}-\d{2}$/.test(a.datum || '') ? a.datum : null,
            place: a.ort || null,
            status: 'offen',
          };
        }),
      };
    })
    .filter((x) => x.items.length || x.question)
    .sort((a, b) => BOXES.findIndex((d) => d.id === a.id) - BOXES.findIndex((d) => d.id === b.id));
  const b = { date: today(), at: new Date().toISOString(), summary: input.lagebild || '', boxes, searched: search };
  saveBriefing(b);
  return b;
}
