// Ausgehen: Events und Orte mit KI-Websuche finden, Orte auf der Karte (OpenStreetMap)
import { addDays, fmtLong, today } from './dates';
import { explainError, getAi, trackUsage } from './ai';

const SEARCH_KEY = 'life-app-eventsearch';
const PLACE_KEY = 'life-app-placesearch';
const BA = { type: 'approximate', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' };

export const EVENT_CHIPS = ['Dieses Wochenende', 'Konzerte', 'Sport zum Mitmachen', 'Tech & Startups', 'Kostenlos', 'Neue Leute kennenlernen'];
export const PLACE_CHIPS = ['Cafés zum Arbeiten', 'Rooftop-Bars', 'Guter Brunch', 'Parrilla', 'Versteckte Bars', 'Laufstrecken'];

const load = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
export const lastEventSearch = () => load(SEARCH_KEY);
export const saveEventSearch = (v) => save(SEARCH_KEY, v);
export const lastPlaceSearch = () => load(PLACE_KEY);
export const savePlaceSearch = (v) => save(PLACE_KEY, v);

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
    if (res.status === 400 && /web_search|web search/i.test(msg)) throw new Error('Die Websuche ist in deinem Anthropic-Konto ausgeschaltet (Console → Einstellungen → Capabilities).');
    throw new Error(explainError(res.status, msg));
  }
  const data = await res.json();
  trackUsage(ai.model, data.usage);
  return data;
}

// Websuche + ein Werkzeug, das die Ergebnisse strukturiert zurückgibt
async function searchWithTool({ system, user, tool, maxUses }) {
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses, user_location: BA }, tool];
  const messages = [{ role: 'user', content: user }];
  let data;
  let found;
  for (let round = 0; round < 4; round++) {
    data = await post({ max_tokens: 3000, system, tools, messages });
    found = data.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
    if (found || data.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
  }
  if (!found) {
    // Ergebnisse noch einmal ausdrücklich als Liste anfordern (ohne weitere Suche)
    const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    data = await post({
      max_tokens: 3000,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: `${user}\n\nDeine Rechercheergebnisse:\n${text || '(keine)'}\n\nGib sie jetzt mit dem Werkzeug zurück.` }],
    });
    found = data.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
  }
  return found?.input || {};
}

const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');
const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const EVENT_TOOL = {
  name: 'events_zeigen',
  description: 'Gibt die gefundenen Events strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      hinweis: { type: 'string', description: 'Optional ein Satz, z.B. wenn wenig gefunden wurde' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            datum: { type: 'string', description: 'JJJJ-MM-TT; bei mehrtägigen Events der nächste Tag' },
            uhrzeit: { type: 'string', description: 'HH:MM, falls bekannt' },
            ort: { type: 'string', description: 'Location und Viertel, z.B. „Niceto Club, Palermo“' },
            preis: { type: 'string', description: 'z.B. „gratis“, „ab 15.000 ARS“, falls bekannt' },
            kategorie: { type: 'string', description: 'z.B. Konzert, Sport, Tech, Kultur, Party, Markt' },
            warum: { type: 'string', description: 'Halbsatz, warum es zu Mateo passt' },
            url: { type: 'string', description: 'Link aus den Suchergebnissen, nie erfinden' },
          },
          required: ['name'],
        },
      },
    },
    required: ['events'],
  },
};

export async function searchEvents(s, query) {
  const t = today();
  const system = `Du findest für Mateo Events in Buenos Aires. Heute ist ${fmtLong(t)} (${t}). Zeitraum: die nächsten 14 Tage (bis ${addDays(t, 14)}), außer die Anfrage sagt etwas anderes („dieses Wochenende“ = der kommende Freitag bis Sonntag).
Was du über Mateo weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Events, die er schon kennt (nicht wiederholen): ${JSON.stringify(s.events.map((e) => e.name))}

Vorgehen: Suche gezielt (z.B. auf Spanisch: „eventos Buenos Aires este fin de semana“, Passline, Eventbrite, Ticketek, Meetup, Agenda Cultural BA, Timeout Buenos Aires). Höchstens 4 Suchen. Danach rufe "events_zeigen" auf: 5 bis 10 konkrete Events mit Datum, sortiert nach Datum, die am besten zur Anfrage und zu Mateo passen. Nur echte Events aus den Suchergebnissen, keine erfundenen Daten oder Links. Texte auf Deutsch, kurz.`;
  const input = await searchWithTool({ system, user: `Anfrage: ${query}`, tool: EVENT_TOOL, maxUses: 4 });
  const results = (input.events || []).filter((e) => e && e.name).map((e, i) => ({
    id: 'e' + i + Date.now().toString(36),
    name: String(e.name),
    date: okDate(e.datum),
    time: /^\d{1,2}:\d{2}$/.test(e.uhrzeit || '') ? e.uhrzeit.padStart(5, '0') : '',
    place: e.ort || '',
    price: e.preis || '',
    category: e.kategorie || '',
    why: e.warum || '',
    url: okUrl(e.url),
    source: host(e.url),
    status: 'neu',
  })).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const v = { query, at: new Date().toISOString(), note: input.hinweis || '', results };
  saveEventSearch(v);
  return v;
}

const PLACE_TOOL = {
  name: 'orte_zeigen',
  description: 'Gibt gefundene Orte (Bars, Cafés, Restaurants …) strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      orte: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            kategorie: { type: 'string', enum: ['Café', 'Bar', 'Restaurant', 'Club', 'Kultur', 'Natur', 'Sport', 'Laden', 'Sonstiges'] },
            adresse: { type: 'string', description: 'Straße und Hausnummer, Viertel' },
            warum: { type: 'string', description: '1 Satz: was ist besonders' },
            url: { type: 'string', description: 'Link aus den Suchergebnissen (Website, Instagram, Artikel), nie erfinden' },
          },
          required: ['name', 'kategorie'],
        },
      },
    },
    required: ['orte'],
  },
};

export async function discoverPlaces(s, query) {
  const system = `Du findest für Mateo besondere Orte in Buenos Aires (Cafés, Bars, Restaurants, Kultur …).
Was du über Mateo weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Orte, die er schon gespeichert hat (nicht wiederholen): ${JSON.stringify(s.places.map((p) => p.name))}
Suche gezielt (höchstens 3 Suchen, gern auch auf Spanisch und in aktuellen Listen/Artikeln). Danach rufe "orte_zeigen" mit 5 bis 8 Orten auf, mit möglichst genauer Adresse. Nur echte Orte aus den Suchergebnissen. Texte auf Deutsch, kurz.`;
  const input = await searchWithTool({ system, user: `Suche: ${query}`, tool: PLACE_TOOL, maxUses: 3 });
  const results = (input.orte || []).filter((o) => o && o.name).map((o, i) => ({
    id: 'p' + i + Date.now().toString(36),
    name: String(o.name),
    category: o.kategorie || 'Sonstiges',
    address: o.adresse || '',
    why: o.warum || '',
    url: okUrl(o.url),
    status: 'neu',
  }));
  const v = { query, at: new Date().toISOString(), results };
  savePlaceSearch(v);
  return v;
}

// Adresse → Koordinaten (OpenStreetMap Nominatim, kostenlos; sparsam benutzen)
export async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&accept-language=de&viewbox=-58.65,-34.45,-58.25,-34.75&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Adresssuche nicht erreichbar');
  const list = await res.json();
  return list.map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), label: r.display_name }));
}

// Erst mit Adresse, dann nur mit Namen versuchen
export async function locate(name, address) {
  const tries = [address && `${address}, Buenos Aires`, `${name}, Buenos Aires`].filter(Boolean);
  for (const q of tries) {
    try {
      const r = await geocode(q);
      if (r.length) return r[0];
    } catch {}
  }
  return null;
}
