// KI-Assistent: Verbindung zur Claude-API direkt vom iPhone aus.
// Der API-Schlüssel liegt NUR im Speicher dieses Geräts (nie im Code, nie in Sicherungen).
import { today, fmtLong } from './dates';
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
            datum: { type: 'string', description: 'Datum JJJJ-MM-TT' },
            idee: { type: 'boolean' },
            aufgaben: { type: 'array', items: { type: 'string' }, description: 'Aufgaben für ein neues Projekt' },
            anzahl: { type: 'integer' },
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
    id: x.id, titel: x.title, bereich: x.areaId, projekt: x.projectId, faellig: x.due, idee: x.idea || undefined,
  }));
  const habits = s.habits.map((h) => {
    const p = habitProgress(s, h, t);
    return { id: h.id, name: h.name, bereich: h.areaId, ziel: `${h.count}x/${h.period}`, stand: `${p.done}/${p.count}`, heute: p.today };
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
- Antworte auf Deutsch, strukturiert und knapp: höchstens 3 kurze Sätze ODER eine kurze Liste mit maximal 5 Stichpunkten. Keine Einleitung („Gern!“, „Natürlich“), keine Wiederholung seiner Frage, kein Fazit. Ordentlich, aber nie lange Texte.
- Deine Antworten werden oft vorgelesen: schreibe natürlich gesprochene Sätze, keine Tabellen, keine Überschriften, kein Markdown.
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
      max_tokens: 900,
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
