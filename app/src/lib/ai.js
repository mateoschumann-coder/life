// KI-Assistent: Verbindung zur Claude-API direkt vom iPhone aus.
// Der API-Schlüssel liegt NUR im Speicher dieses Geräts (nie im Code, nie in Sicherungen).
import { addDays, today, fmtLong } from './dates';
import { areaOf, habitProgress, lastContact } from './logic';

const AI_KEY = 'life-app-ai';
const CHAT_KEY = 'life-app-chat';

export const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Schnell und günstig', sub: 'Claude Haiku 5.5', price: { in: 0.1, out: 0.5 } },
  { id: 'claude-sonnet-5-5', label: 'Gründlich', sub: 'Claude Sonnet 5.5', price: { in: 2, out: 10 } },
];

export function getAi() {
  try {
    return { apiKey: '', model: MODELS[0].id, usage: {}, ...JSON.parse(localStorage.getItem(AI_KEY) || '{}') };
  } catch {
    return { apiKey: '', model: MODELS[0].id, usage: {} };
  }
}
export function saveAi(patch) {
  const next = { ...getAi(), ...patch };
  localStorage.setItem(AI_KEY, JSON.stringify(next));
  return next;
}

// Kosten pro Monat mitschreiben (geschätzt aus den Token-Zahlen der API)
function trackUsage(model, usage) {
  const m = MODELS.find((x) => x.id === model) || MODELS[0];
  const month = today().slice(0, 7);
  const ai = getAi();
  const u = ai.usage[month] || { requests: 0, cost: 0 };
  u.requests += 1;
  u.cost += ((usage?.input_tokens || 0) * m.price.in + (usage?.output_tokens || 0) * m.price.out) / 1e6;
  saveAi({ usage: { ...ai.usage, [month]: u } });
}
export function monthUsage() {
  return getAi().usage[today().slice(0, 7)] || { requests: 0, cost: 0 };
}

export function loadChat() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveChat(items) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(items.slice(-40)));
}

// Das Werkzeug, mit dem die KI Änderungen VORSCHLÄGT (nichts wird ohne Bestätigung gespeichert)
const ACTION_TYPES = [
  'aufgabe_anlegen', 'aufgabe_erledigen', 'aufgabe_aendern', 'projekt_anlegen', 'rhythmus_anlegen', 'rhythmus_abhaken',
  'person_anlegen', 'person_aendern', 'kontakt_notieren', 'aktivitaet_eintragen', 'ressource_anlegen', 'event_anlegen', 'radar_eintrag', 'app_wunsch',
];
export const TOOL = {
  name: 'aenderungen_vorschlagen',
  description:
    'Schlägt Mateo konkrete Änderungen an seiner App vor. Mateo sieht die Vorschläge als Karte und bestätigt sie. Nutze nur IDs aus dem Kontext. Für neue Einträge passende bereich_id/unterbereich_id wählen.',
  input_schema: {
    type: 'object',
    properties: {
      aktionen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            typ: { type: 'string', enum: ACTION_TYPES },
            titel: { type: 'string', description: 'Titel von Aufgabe, Ressource, Radar-Eintrag oder App-Wunsch' },
            name: { type: 'string', description: 'Name von Projekt, Rhythmus, Person oder Event' },
            bereich_id: { type: 'string' },
            unterbereich_id: { type: 'string' },
            projekt_id: { type: 'string' },
            aufgabe_id: { type: 'string' },
            rhythmus_id: { type: 'string' },
            person_id: { type: 'string' },
            vorlage_id: { type: 'string' },
            faellig: { type: 'string', description: 'Datum JJJJ-MM-TT' },
            uhrzeit: { type: 'string', description: 'Uhrzeit HH:MM (optional, für Aufgaben)' },
            datum: { type: 'string', description: 'Datum JJJJ-MM-TT' },
            idee: { type: 'boolean' },
            aufgaben: { type: 'array', items: { type: 'string' }, description: 'Aufgaben für ein neues Projekt' },
            anzahl: { type: 'integer', description: 'Wie oft pro Zeitraum; 0 = freies Fokus-Thema ohne feste Zahl' },
            zeitraum: { type: 'string', enum: ['woche', 'monat'] },
            kategorie: { type: 'string', enum: ['familie', 'freunde', 'neu', 'beruflich'] },
            geburtstag: { type: 'string', description: 'JJJJ-MM-TT' },
            telefon: { type: 'string' },
            kontakt_alle_tage: { type: 'integer' },
            kennengelernt_bei: { type: 'string' },
            nachfassen_am: { type: 'string' },
            notiz: { type: 'string' },
            url: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            ort: { type: 'string' },
            reise: { type: 'boolean' },
            warum: { type: 'string' },
            thema: { type: 'string' },
          },
          required: ['typ'],
        },
      },
    },
    required: ['aktionen'],
  },
};

// Kompakter Überblick über Mateos Daten, damit die KI sinnvoll vorschlagen kann
export function buildSystem(s) {
  const t = today();
  const areas = s.areas.map((a) => ({
    id: a.id, name: a.name, saeule: a.pillarId, unterbereiche: a.subs.map((x) => ({ id: x.id, name: x.name })),
  }));
  const projects = s.projects.filter((p) => p.status === 'aktiv').map((p) => ({ id: p.id, name: p.name, bereich: p.areaId, faellig: p.due }));
  const tasks = s.tasks.filter((x) => !x.done).slice(-80).map((x) => ({
    id: x.id, titel: x.title, bereich: x.areaId, projekt: x.projectId, faellig: x.due, uhrzeit: x.time || undefined, idee: x.idea || undefined,
  }));
  const habits = s.habits.map((h) => {
    const p = habitProgress(s, h, t);
    return { id: h.id, name: h.name, bereich: h.areaId, ziel: h.count ? `${h.count}x/${h.period}` : 'frei', stand: h.count ? `${p.done}/${p.count}` : undefined, zuletzt: p.last || undefined, heute: p.today };
  });
  const people = s.people.map((p) => ({
    id: p.id, name: p.name, kategorie: p.category, geburtstag: p.birthday || undefined, kontakt_alle_tage: p.contactEvery || undefined,
    letzter_kontakt: lastContact(p) || undefined, nachfassen: p.followUp || undefined,
  }));
  const data = {
    heute: t,
    bereiche: areas,
    projekte: projects,
    offene_aufgaben: tasks,
    rhythmen: habits,
    personen: people,
    vorlagen: s.templates.map((x) => ({ id: x.id, name: x.name })),
    radar_themen: s.radar.topics,
    events: s.events.map((e) => ({ name: e.name, datum: e.date, status: e.stage })),
  };
  return `Du bist der persönliche Assistent in Mateos Life-App. Heute ist ${fmtLong(t)} (${t}). Mateo lebt in Buenos Aires.

So arbeitest du:
- Antworte auf Deutsch, strukturiert und auf den Punkt: so ausführlich wie nötig, so kurz wie möglich. Meist 3–6 Sätze oder eine gegliederte Liste mit bis zu 7 Punkten; bei Analysen, Rückblicken oder Planungen darf es länger sein, aber immer klar gegliedert. Keine Floskeln („Gern!“, „Natürlich“), keine Wiederholung seiner Frage.
- Deine Antworten werden oft vorgelesen: schreibe natürliche Sätze; für Listen einfache Zeilen mit „–“, keine Tabellen, kein Fettdruck, keine Überschriften mit #.
- Wenn Mateo etwas eintragen, ändern oder planen will, rufe das Werkzeug "aenderungen_vorschlagen" auf. Sag in deinem Text kurz, was du vorschlägst. Behaupte nie, etwas sei schon gespeichert: Mateo muss erst bestätigen.
- Fasse zusammengehörige Änderungen in EINEM Vorschlag zusammen.
- Nutze nur IDs aus den Daten unten. Wähle für neue Einträge immer den passendsten Lebensbereich und, wenn klar, den Unterbereich.
- Relative Angaben wie "morgen" oder "Freitag" rechnest du in ein Datum JJJJ-MM-TT um.
- Wenn etwas unklar ist, stelle EINE kurze Rückfrage statt zu raten.
- Die Grundordnung (Säulen, Lebensbereiche) änderst du nie. Du kannst nichts im Internet buchen oder Nachrichten verschicken.
- Wenn Mateo die App selbst verändern möchte (Design, neue Funktionen, Fehler), kannst du das nicht direkt. Schlage dann die Aktion "app_wunsch" mit einem klaren titel vor; die Wunschliste setzt Claude später im Code um.
- Fragen zu seinen Daten (z.B. "Was steht heute an?", "Wem sollte ich schreiben?") beantwortest du direkt aus den Daten.

Mateos aktuelle Daten (JSON):
${JSON.stringify(data)}`;
}

// Gesprächsverlauf in das Format der API umwandeln.
// Ein Vorschlag (tool_use) braucht in der nächsten Nachricht ein Ergebnis (tool_result).
export function toApiMessages(items) {
  const msgs = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.role === 'user') {
      const prev = items[i - 1];
      const content = [];
      if (prev && prev.role === 'assistant' && prev.toolUseId) {
        content.push({ type: 'tool_result', tool_use_id: prev.toolUseId, content: resultText(prev) });
      }
      content.push({ type: 'text', text: it.text });
      msgs.push({ role: 'user', content });
    } else {
      const content = [];
      if (it.text) content.push({ type: 'text', text: it.text });
      if (it.toolUseId) content.push({ type: 'tool_use', id: it.toolUseId, name: TOOL.name, input: { aktionen: it.actions || [] } });
      if (content.length) msgs.push({ role: 'assistant', content });
    }
  }
  return msgs;
}
function resultText(item) {
  if (item.status === 'applied') return `Mateo hat bestätigt. Gespeichert: ${(item.appliedLabels || []).join('; ') || 'nichts'}.`;
  if (item.status === 'rejected') return 'Mateo hat den Vorschlag verworfen.';
  return 'Mateo hat noch nicht entschieden und schreibt weiter.';
}

export async function askClaude(s, items) {
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
    body: JSON.stringify({
      model: ai.model,
      max_tokens: 1600,
      system: buildSystem(s),
      tools: [TOOL],
      messages: toApiMessages(items),
    }),
  });
  if (!res.ok) {
    let msg = '';
    try {
      msg = (await res.json())?.error?.message || '';
    } catch {}
    throw new Error(explainError(res.status, msg));
  }
  const data = await res.json();
  trackUsage(ai.model, data.usage);
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  const tool = data.content.find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  return { text, toolUseId: tool?.id || null, actions: tool?.input?.aktionen || [] };
}

function explainError(status, msg) {
  if (status === 401) return 'Der API-Schlüssel ist ungültig. Bitte in den Einstellungen prüfen.';
  if (status === 403) return 'Der Schlüssel hat keine Berechtigung. Bitte in der Anthropic-Konsole prüfen.';
  if (status === 429) return 'Zu viele Anfragen oder Monatslimit erreicht. Kurz warten oder das Limit in der Konsole prüfen.';
  if (status === 529 || status === 503) return 'Die KI ist gerade überlastet. Bitte gleich noch einmal versuchen.';
  if (/credit|balance/i.test(msg)) return 'Kein Guthaben mehr auf dem API-Konto. Bitte in der Anthropic-Konsole aufladen.';
  return `Fehler ${status}${msg ? ': ' + msg : ''}`;
}

export const areaName = (s, id) => areaOf(s, id)?.name;

// Gemeinsamer Aufruf der Claude-API (für Check-in und Projekt-Gestalter)
async function callApi(body) {
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
    throw new Error(explainError(res.status, msg));
  }
  const data = await res.json();
  trackUsage(ai.model, data.usage);
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  return { text, tools: data.content.filter((c) => c.type === 'tool_use') };
}

// Kurzer Verbindungstest (kostet weniger als 0,01 Cent)
export async function testKey(apiKey, model) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: 'user', content: 'Hallo' }] }),
  });
  if (!res.ok) {
    let msg = '';
    try {
      msg = (await res.json())?.error?.message || '';
    } catch {}
    throw new Error(explainError(res.status, msg));
  }
  return true;
}

// KI-Check: kurzer, strukturierter Rückblick mit konkreten Anstößen (ohne Werkzeuge)
export async function askReview(s) {
  const ai = getAi();
  if (!ai.apiKey) throw new Error('KEIN_SCHLUESSEL');
  const t = today();
  const back = (n) => addDays(t, -n);
  const d7 = back(7);
  const d30 = back(30);
  const areas = s.areas.filter((a) => !a.paused).map((a) => {
    const habitIds = new Set(s.habits.filter((h) => h.areaId === a.id).map((h) => h.id));
    const projIds = new Set(s.projects.filter((p) => p.areaId === a.id).map((p) => p.id));
    const dates = [
      ...s.checkins.filter((c) => habitIds.has(c.habitId)).map((c) => c.date),
      ...s.tasks.filter((x) => x.done && x.doneAt && (x.areaId === a.id || projIds.has(x.projectId))).map((x) => x.doneAt),
      ...s.activities.filter((x) => x.areaId === a.id).map((x) => x.date),
    ];
    return {
      bereich: a.name,
      letzte_aktivitaet: dates.length ? dates.sort().at(-1) : null,
      aktivitaeten_7_tage: dates.filter((d) => d >= d7).length,
      aktivitaeten_30_tage: dates.filter((d) => d >= d30).length,
      offene_aufgaben: s.tasks.filter((x) => !x.done && x.areaId === a.id).length,
      projekte: s.projects.filter((p) => p.areaId === a.id && p.status === 'aktiv').map((p) => {
        const ts = s.tasks.filter((x) => x.projectId === p.id);
        return { name: p.name, erledigt: ts.filter((x) => x.done).length, gesamt: ts.length, naechste: ts.find((x) => !x.done)?.title };
      }),
    };
  });
  const focus = s.habits.map((h) => {
    const ds = s.checkins.filter((c) => c.habitId === h.id).map((c) => c.date);
    return { thema: h.name, ziel: h.count ? `${h.count}x pro ${h.period}` : 'frei, ohne feste Zahl', letzte: ds.sort().at(-1) || null, tage_7: ds.filter((d) => d >= d7).length, tage_30: ds.filter((d) => d >= d30).length };
  });
  const overdue = s.tasks.filter((x) => !x.done && x.due && x.due < t).map((x) => x.title);
  const ids = {
    bereiche: s.areas.map((a) => ({ id: a.id, name: a.name })),
    projekte: s.projects.filter((p) => p.status === 'aktiv').map((p) => ({ id: p.id, name: p.name, bereich_id: p.areaId })),
  };
  const system = `Du bist Mateos persönlicher Coach in seiner Life-App. Heute ist ${fmtLong(t)}.
Mateo mag keine starren Zahlen und kein schlechtes Gewissen. Er will ehrlich sehen, wo er vorankommt, und konkret angestoßen werden.

1. Schreib einen kurzen Check-in auf Deutsch in genau dieser Form (nur Text, keine Sternchen, kein Markdown):
Gut gelaufen:
– 1 bis 3 Punkte, konkret mit Bereich oder Projekt
Eingeschlafen:
– 1 bis 3 Punkte, freundlich, ohne Vorwurf
Höchstens 8 Zeilen.

2. Rufe danach IMMER das Werkzeug "optionen_vorschlagen" auf: 3 bis 5 konkrete, kleine nächste Schritte, die Mateo mit einem Tipp als To-do übernehmen kann (z.B. die nächste offene Aufgabe eines Projekts, „20 Min Portugiesisch-Podcast“, „Lukas wegen Kaffee schreiben“). Jeder Schritt in höchstens 10 Minuten bis 1 Stunde machbar, als klarer Auftrag formuliert. Wähle bereich_id und, falls passend, projekt_id aus den IDs. Bevorzuge Eingeschlafenes.

Nutze nur die Daten unten; erfinde keine Fakten. Wenn kaum Daten vorhanden sind, sag das kurz und schlage Einstiegsschritte vor.`;
  const { text, tools } = await callApi({
    max_tokens: 1000,
    system,
    tools: [OPTIONS_TOOL],
    messages: [{ role: 'user', content: `Meine Daten (JSON): ${JSON.stringify({ bereiche: areas, fokus_themen: focus, ueberfaellige_aufgaben: overdue, ids })}\n\nWie stehe ich gerade da, und was sind gute nächste Schritte?` }],
  });
  const tool = tools.find((c) => c.name === OPTIONS_TOOL.name);
  const options = (tool?.input?.optionen || [])
    .filter((o) => o && o.titel)
    .map((o, i) => ({
      id: 'o' + i,
      title: String(o.titel),
      why: o.warum || '',
      areaId: s.areas.some((a) => a.id === o.bereich_id) ? o.bereich_id : null,
      projectId: s.projects.some((p) => p.id === o.projekt_id) ? o.projekt_id : null,
      status: 'offen',
    }));
  const review = { date: t, text, options };
  saveReview(review);
  return review;
}
const OPTIONS_TOOL = {
  name: 'optionen_vorschlagen',
  description: 'Konkrete nächste Schritte, die Mateo mit einem Tipp als To-do für heute oder morgen übernehmen kann.',
  input_schema: {
    type: 'object',
    properties: {
      optionen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string', description: 'Kurzer, klarer Auftrag, z.B. „Kapitel 3 Python-Kurs (30 Min)“' },
            warum: { type: 'string', description: 'Ein kurzer Halbsatz, warum gerade jetzt' },
            bereich_id: { type: 'string' },
            projekt_id: { type: 'string' },
          },
          required: ['titel'],
        },
      },
    },
    required: ['optionen'],
  },
};
export function saveReview(review) {
  try {
    localStorage.setItem('life-app-review', JSON.stringify(review));
  } catch {}
}
export function lastReview() {
  try {
    return JSON.parse(localStorage.getItem('life-app-review') || 'null');
  } catch {
    return null;
  }
}


// ---------- Projekte mit der KI gestalten ----------
export const DESIGN_TOOL = {
  name: 'projekt_gestalten',
  description: 'Schlägt Bausteine (Inhalte, Graphen) und Aufgaben NUR für dieses eine Projekt vor. Mateo wählt per Häkchen aus, was übernommen wird.',
  input_schema: {
    type: 'object',
    properties: {
      bausteine: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            typ: { type: 'string', enum: ['kennzahl', 'liste', 'zaehler', 'meilensteine', 'budget', 'notiz'] },
            titel: { type: 'string' },
            einheit: { type: 'string', description: 'Für kennzahl/budget, z.B. km, kg, Min, $' },
            ziel: { type: 'number', description: 'Zielwert (kennzahl/zaehler) oder Limit (budget)' },
            punkte: { type: 'array', items: { type: 'string' }, description: 'Startpunkte für liste/meilensteine' },
            text: { type: 'string', description: 'Inhalt für notiz' },
            warum: { type: 'string', description: 'Ein Halbsatz, wofür der Baustein hilft' },
          },
          required: ['typ', 'titel'],
        },
      },
      aufgaben: {
        type: 'array',
        items: {
          type: 'object',
          properties: { titel: { type: 'string' }, faellig: { type: 'string', description: 'JJJJ-MM-TT, optional' } },
          required: ['titel'],
        },
      },
    },
  },
};

export async function askDesigner(s, project, items) {
  const t = today();
  const area = areaOf(s, project.areaId);
  const existing = {
    name: project.name,
    bereich: area?.name,
    unterbereich: area?.subs.find((x) => x.id === project.subId)?.name,
    faellig: project.due,
    bausteine: (project.blocks || []).map((b) => ({ typ: b.type, titel: b.title })),
    aufgaben: s.tasks.filter((x) => x.projectId === project.id).map((x) => x.title),
    notizen: project.notes || undefined,
  };
  const system = `Du hilfst Mateo, ein Projekt in seiner Life-App zu gestalten. Heute ist ${fmtLong(t)} (${t}). Mateo lebt in Buenos Aires.
Ein Projekt besteht aus frei kombinierbaren Bausteinen:
– kennzahl: eine Zahl mit Verlauf als Graph (z.B. Wochenkilometer, Lernminuten, Gewicht), mit einheit und optional ziel
– liste: Punkte zum Abhaken (z.B. Ideen, Packliste, Bücher)
– zaehler: zählt etwas hoch, optional mit ziel (z.B. Bewerbungen, Treffen)
– meilensteine: wichtige Etappen
– budget: Ausgaben gegen ein Limit (ziel = Limit, einheit z.B. $ oder ARS)
– notiz: freier Text, z.B. Ziel oder Plan
Projekte müssen nicht in Prozent messbar sein. Wähle nur, was für DIESES Projekt wirklich hilft: meist 2 bis 4 Bausteine, keine Doppelungen mit vorhandenen.

So gehst du vor:
– Ist das Projekt noch unklar, stelle zuerst höchstens 2 kurze Fragen (Ziel? bis wann? was soll man sehen können?).
– Sonst rufe das Werkzeug "projekt_gestalten" auf: Bausteine mit kurzem warum, plus 3 bis 6 erste konkrete Aufgaben (bei Zeitbezug mit Datum).
– Text auf Deutsch, kurz und klar, ohne Markdown. Behaupte nie, etwas sei schon angelegt: Mateo wählt aus und bestätigt.
– Wenn Mateo Änderungen wünscht, schlage die angepasste Auswahl erneut vor.

Das Projekt bisher (JSON): ${JSON.stringify(existing)}`;
  const messages = [];
  items.forEach((it, i) => {
    if (it.role === 'user') {
      const prev = items[i - 1];
      const content = [];
      if (prev?.toolUseId) content.push({ type: 'tool_result', tool_use_id: prev.toolUseId, content: prev.status === 'applied' ? 'Mateo hat seine Auswahl übernommen.' : 'Mateo hat noch nichts übernommen.' });
      content.push({ type: 'text', text: it.text });
      messages.push({ role: 'user', content });
    } else {
      const content = [];
      if (it.text) content.push({ type: 'text', text: it.text });
      if (it.toolUseId) content.push({ type: 'tool_use', id: it.toolUseId, name: DESIGN_TOOL.name, input: it.input || {} });
      if (content.length) messages.push({ role: 'assistant', content });
    }
  });
  const { text, tools } = await callApi({ max_tokens: 1600, system, tools: [DESIGN_TOOL], messages });
  const tool = tools.find((c) => c.name === DESIGN_TOOL.name);
  return { text, toolUseId: tool?.id || null, input: tool?.input || null };
}
