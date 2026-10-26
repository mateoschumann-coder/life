// Coach: kommt aktiv auf Mateo zu. Einmal am Tag (beim ersten Öffnen) schaut die KI alles durch,
// sucht gezielt im Internet (Events, News, Videos, Rezepte) und gibt 4–6 Anstöße mit Knopf.
import { addDays, fmtLong, today } from './dates';
import { allAreaStatuses, peopleOverdue, upcomingBirthdays } from './logic';
import { explainError, getAi, trackUsage } from './ai';

const KEY = 'life-app-coach';
export const ARTEN = ['aufgabe', 'projekt', 'event', 'link'];

export function lastBriefing() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
export function saveBriefing(b) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {}
}
export const autoCoach = () => getAi().autoCoach !== false;

const COACH_TOOL = {
  name: 'anstoesse_geben',
  description: 'Gibt Mateo 4 bis 6 konkrete Anstöße für heute, jeweils mit einer Aktion, die er mit einem Tipp übernehmen kann.',
  input_schema: {
    type: 'object',
    properties: {
      lagebild: { type: 'string', description: '1 bis 2 Sätze: Wie steht Mateo gerade da? Persönlich, motivierend, ehrlich.' },
      anstoesse: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            art: { type: 'string', enum: ARTEN, description: 'aufgabe = konkreter Schritt als To-do · projekt = Idee für ein neues Projekt · event = Veranstaltung aus der Suche · link = Artikel, Video, Rezept aus der Suche' },
            titel: { type: 'string', description: 'Kurze Überschrift, z.B. „Hauspreis-Projekt weiterbringen“' },
            text: { type: 'string', description: '1 bis 2 Sätze, persönlich („Du wolltest …“), warum jetzt und was genau' },
            aufgabe: { type: 'string', description: 'Titel des To-dos, das beim Übernehmen angelegt wird, z.B. „30 Min: Feature Engineering Hauspreis-Projekt“' },
            bereich_id: { type: 'string' },
            projekt_id: { type: 'string', description: 'Bei Bezug zu einem bestehenden Projekt' },
            projekt_name: { type: 'string', description: 'Nur bei art=projekt: Name des neuen Projekts' },
            url: { type: 'string', description: 'Nur Links aus deinen Suchergebnissen, nie erfinden' },
            quelle: { type: 'string', description: 'Name der Seite, z.B. „Eventbrite“' },
            datum: { type: 'string', description: 'Bei Events: JJJJ-MM-TT' },
            ort: { type: 'string', description: 'Bei Events' },
          },
          required: ['art', 'titel', 'text'],
        },
      },
    },
    required: ['anstoesse'],
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
    bereiche: statuses.map(({ area, status }) => ({
      id: area.id,
      name: area.name,
      zuletzt_aktiv: status.last,
      status: status.text,
      unterbereiche: area.subs.map((x) => x.name),
    })),
    projekte: s.projects.filter((p) => p.status === 'aktiv').map((p) => {
      const ts = s.tasks.filter((x) => x.projectId === p.id);
      return {
        id: p.id, name: p.name, bereich_id: p.areaId, faellig: p.due || undefined,
        offen: ts.filter((x) => !x.done).map((x) => x.title).slice(0, 5),
        erledigt_7_tage: ts.filter((x) => x.done && x.doneAt >= d7).length,
        bausteine: (p.blocks || []).map((b) => b.title),
        zuletzt: p.lastActivity || undefined,
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
  };
}

function systemPrompt(s) {
  return `Du bist Mateos persönlicher Coach in seiner Life-App. Mateo lebt in Buenos Aires. Heute ist ${fmtLong(today())} (${today()}).
Mateo will vorankommen, nicht perfekt organisiert sein. Er will wenig Zeit in der App verbringen. Deine Aufgabe: auf ihn zukommen mit wenigen, wirklich wertvollen Anstößen, die er mit einem Tipp übernimmt.

So gehst du vor:
1. Lies seine Daten und vor allem, was du über ihn weißt.
2. Nutze die Websuche höchstens 3-mal, gezielt und nur wo es echten Mehrwert bringt, z.B.:
   – Events in Buenos Aires in den nächsten 7 Tagen, passend zu seinen Interessen (Sport, Konzerte, Tech/Startup-Meetups …)
   – Neues zu einem seiner News-Themen (mit Link)
   – ein konkretes Video, eine Übung, ein Rezept oder eine Lernquelle zu einem seiner Ziele (z.B. 15-Min-Dehnvideo fürs Knie, Airfryer-Rezept, Python-Übung)
   Führe ALLE Suchen zuerst aus. Rufe das Werkzeug "anstoesse_geben" erst ganz am Ende auf, allein.
3. Rufe "anstoesse_geben" mit einem kurzen lagebild und 4 bis 6 Anstößen auf, gemischt über seine Lebensbereiche:
   – mindestens 1 zum Weiterkommen bei Projekten oder beim Lernen (konkreter nächster Schritt, 15–60 Min)
   – mindestens 1 sozialer (Menschen, Geburtstage, Treffen), wenn die Daten es hergeben
   – 1 bis 2 aus der Websuche mit url
   – höchstens 1 Idee für ein neues Projekt (art "projekt"), nur wenn sie wirklich zu ihm passt
4. Jeder Anstoß ist persönlich („Du wolltest …“, „Seit 9 Tagen …“), konkret und machbar. Keine Vorwürfe, kein schlechtes Gewissen.
5. Erfinde keine Fakten und keine Links. Wenn kaum Daten da sind, gib Einstiegs-Anstöße und schlage vor, ihm kurz von seinen Zielen zu erzählen.
Schreib außerhalb des Werkzeugs keinen langen Text. Alles auf Deutsch, ohne Markdown.`;
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
  if (search) {
    tools.unshift({ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' } });
  }
  const messages = [{ role: 'user', content: `Meine Daten (JSON): ${JSON.stringify(coachData(s))}\n\nWas sind heute meine besten Anstöße?` }];
  let data;
  let tool;
  try {
    // Lange Suchen können pausieren: dann die Antwort unverändert zurückschicken und weitermachen
    for (let round = 0; round < 4; round++) {
      data = await post({ max_tokens: 2500, system: systemPrompt(s), tools, messages });
      tool = data.content.find((c) => c.type === 'tool_use' && c.name === COACH_TOOL.name);
      if (tool || data.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: data.content });
    }
  } catch (e) {
    // Websuche im Konto ausgeschaltet: ohne Suche noch einmal
    if (e.message === 'SUCHE_AUS' && search) return askCoach(s, { search: false });
    throw e;
  }
  if (!tool) {
    // Notfall: das Werkzeug ausdrücklich verlangen
    messages.push({ role: 'assistant', content: data.content });
    messages.push({ role: 'user', content: 'Bitte rufe jetzt anstoesse_geben auf.' });
    data = await post({ max_tokens: 2000, system: systemPrompt(s), tools: [COACH_TOOL], tool_choice: { type: 'tool', name: COACH_TOOL.name }, messages: messages.map((m) => (m.role === 'assistant' ? { ...m, content: m.content.filter((c) => c.type === 'text' && c.text) } : m)).filter((m) => m.content.length) });
    tool = data.content.find((c) => c.type === 'tool_use' && c.name === COACH_TOOL.name);
  }
  const input = tool?.input || {};
  const validUrl = (u) => (/^https?:\/\//.test(u || '') ? u : null);
  const items = (input.anstoesse || []).filter((a) => a && a.titel).map((a, i) => ({
    id: 'c' + i,
    art: ARTEN.includes(a.art) ? a.art : 'aufgabe',
    title: String(a.titel),
    text: a.text || '',
    task: a.aufgabe || a.titel,
    areaId: s.areas.some((x) => x.id === a.bereich_id) ? a.bereich_id : null,
    projectId: s.projects.some((p) => p.id === a.projekt_id) ? a.projekt_id : null,
    projectName: a.projekt_name || null,
    url: validUrl(a.url),
    source: a.quelle || (validUrl(a.url) ? new URL(a.url).hostname.replace(/^www\./, '') : null),
    date: /^\d{4}-\d{2}-\d{2}$/.test(a.datum || '') ? a.datum : null,
    place: a.ort || null,
    status: 'offen',
  }));
  const searches = data?.usage?.server_tool_use?.web_search_requests || 0;
  const b = { date: today(), at: new Date().toISOString(), summary: input.lagebild || '', items, searched: search, searches };
  saveBriefing(b);
  return b;
}
