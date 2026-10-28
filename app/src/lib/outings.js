// Ausgehen: Events und Orte mit KI-Websuche finden, Orte auf der Karte (OpenStreetMap)
import { addDays, fmtLong, today } from './dates';
import { explainError, fitModel, getAi, MODELS, setCostLabel, trackUsage } from './ai';
const SMART_MODEL = 'claude-sonnet-5-5';
import { aiLinks } from './links';

const SEARCH_KEY = 'life-app-eventsearch';
const PLACE_KEY = 'life-app-placesearch';
const BA = { type: 'approximate', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' };
const locOf = (city) => (!city || city === 'Buenos Aires' ? BA : { type: 'approximate', city });

// Städte für Ausgehen (v0.40, Mateo): Knöpfe „Buenos Aires“, „Frankfurt“ … – bearbeitbar, gilt für Events und Orte
export const HOME_CITY = 'Buenos Aires';
export const placeCity = (p) => p.city || HOME_CITY;
export const eventCity = (e) => e.city || HOME_CITY;
export const citiesOf = (s) => (s.profile?.cities?.length ? s.profile.cities : [HOME_CITY]);
// Alle bekannten Städte (v0.62): Schnellauswahl + je angelegte + alle mit Orten/Events – eine Stadt mit Einträgen verschwindet nie
export const allCities = (s) => {
  const seen = new Map();
  for (const c of [...citiesOf(s), ...(s.profile?.allCities || []), ...(s.places || []).map(placeCity), ...(s.events || []).filter((e) => e.city).map(eventCity)]) {
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()];
};
export const cityOf = (s) => {
  const c = s.profile?.city;
  const all = allCities(s);
  return c && all.includes(c) ? c : citiesOf(s)[0];
};
// Tags für Orte (v0.65): danach lässt sich filtern
export const PLACE_TAGS = {
  Mahlzeit: ['Frühstück', 'Brunch', 'Mittagessen', 'Abendessen', 'Drinks', 'Snack'],
  Küche: ['Argentinisch', 'Fleisch', 'Italienisch', 'Pizza', 'Japanisch', 'Asiatisch', 'Peruanisch', 'Mexikanisch', 'Spanisch', 'Burger', 'Fisch', 'Vegetarisch', 'Vegan', 'Café & Kuchen'],
  Stimmung: ['Date', 'Mit Freunden', 'Zum Arbeiten', 'Terrasse', 'Live-Musik', 'Besonders'],
};
export const ALL_TAGS = Object.values(PLACE_TAGS).flat();
export const PLACE_PRICES = { 1: '$ Günstig', 2: '$$ Mittel', 3: '$$$ Teuer' };
// Stadtviertel einer Stadt: selbst angelegte + die aus gespeicherten Orten
export const hoodsOf = (s, city) => [...new Set([...(s.profile?.hoods?.[city] || []), ...(s.places || []).filter((p) => placeCity(p) === city && p.hood).map((p) => p.hood)])].sort((a, b) => a.localeCompare(b, 'de'));
export const countryOf = (s, c) => (c === HOME_CITY ? 'Argentinien' : s.profile?.cityCountry?.[c] || '');
// Land einer Stadt einmal über OpenStreetMap nachsehen und merken
export async function locateCountry(store, city) {
  if (!city || city === HOME_CITY || store.get().profile?.cityCountry?.[city]) return;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=de&q=${encodeURIComponent(city)}`).then((x) => x.json());
    const land = r?.[0]?.address?.country;
    if (land) store.update((d) => { d.profile = { ...d.profile, cityCountry: { ...(d.profile?.cityCountry || {}), [city]: land } }; });
  } catch {}
}
export const BA_POS = { lat: -34.6037, lon: -58.3816 };
// Mittelpunkt einer Stadt für die Karte (einmal über OpenStreetMap gesucht, dann gemerkt)
export async function locateCity(store, city) {
  if (!city || city === HOME_CITY || store.get().profile?.cityPos?.[city]) return;
  try {
    const r = await geocode(city, city);
    if (r[0]) store.update((d) => { d.profile = { ...d.profile, cityPos: { ...(d.profile?.cityPos || {}), [city]: { lat: r[0].lat, lon: r[0].lon } } }; });
  } catch {}
}
export const cityPos = (s, city) => (city === HOME_CITY ? BA_POS : s.profile?.cityPos?.[city] || null);

export const EVENT_CHIPS = ['Für mich diese Woche', 'Geheimtipps', 'Dieses Wochenende', 'Konzerte', 'Sport zum Mitmachen', 'Tech & Startups', 'Kostenlos', 'Neue Leute kennenlernen'];
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
    body: JSON.stringify(fitModel({ ...body, model: body.model || ai.model })),
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
  trackUsage(body.model || ai.model, data.usage);
  return data;
}

// Websuche + ein Werkzeug, das die Ergebnisse strukturiert zurückgibt
// maxUses = 0: ohne Websuche (viel günstiger) – die KI antwortet aus ihrem eigenen Wissen
// smart = true: gründlicheres Modell (Sonnet) statt des eingestellten
// fetch = true: die KI darf Links aus Mateos Nachricht lesen (web_fetch, nur Text-Kosten, keine Suchgebühr; v0.68)
export async function searchWithTool({ system, user, messages: history, tool, maxUses, maxTokens = 8000, label, smart = false, city, fetch: canFetch = false, fetchMax = 2 }) {
  if (label) setCostLabel(label);
  // Sicherheitsnetz: „required“ gehört in input_schema (sonst lehnt die API das Werkzeug ab)
  if (tool && tool.required) { const { required, ...rest } = tool; tool = { ...rest, input_schema: { ...rest.input_schema, required: rest.input_schema?.required || required } }; }
  // Chats mit Vorschlägen (Mateo, v0.35): kurze Antwort, die Vorschläge erscheinen als Häkchen-Liste darunter
  if (history && tool?.input_schema?.properties?.antwort) {
    tool = JSON.parse(JSON.stringify(tool));
    tool.input_schema.properties.antwort.description = 'KURZ: 1–2 Sätze (höchstens 3). Die Vorschläge NICHT im Text aufzählen – sie erscheinen als antippbare Liste. Nur eine Rückfrage, wenn wirklich nötig.';
    system = `${system}\n\nWICHTIG: Antworte immer kurz (1–2 Sätze, keine Aufzählungen, kein langer Text). Konkrete Vorschläge gehören in die Listen-Felder des Werkzeugs – kurz formuliert (wenige Wörter pro Punkt), damit Mateo sie einfach antippen kann.`;
  }
  const model = smart ? SMART_MODEL : undefined;
  // Sonnet 5.5 lehnt erzwungene Werkzeuge (tool_choice "tool") mit Fehler 400 ab und denkt immer mit (zählt zu max_tokens):
  // dort tool_choice "auto" + klare Anweisung + mehr Platz; fehlt das Werkzeug trotzdem, einmal nachfragen (v0.60)
  const force = smart ? { type: 'auto' } : { type: 'tool', name: tool.name };
  if (smart) {
    system = `${system}\n\nAntworte AUSSCHLIESSLICH, indem du das Werkzeug "${tool.name}" aufrufst – kein Text davor oder danach.`;
    maxTokens = Math.max(maxTokens * 2, 8000);
  }
  const messages = history ? [...history] : [{ role: 'user', content: user }];
  if (!maxUses && !canFetch) {
    let d = await post({ model, max_tokens: maxTokens, system, tools: [tool], tool_choice: force, messages });
    // Antwort abgeschnitten → einmal mit mehr Platz wiederholen statt halbe Daten zu nehmen
    if (d.stop_reason === 'max_tokens') d = await post({ model, max_tokens: Math.min(32000, maxTokens * 2), system, tools: [tool], tool_choice: force, messages });
    let f = d.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
    if (!f && smart) {
      d = await post({ model, max_tokens: maxTokens, system, tools: [tool], tool_choice: force, messages: [...messages, { role: 'assistant', content: d.content }, { role: 'user', content: `Bitte gib das Ergebnis jetzt mit dem Werkzeug "${tool.name}" zurück.` }] });
      f = d.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
    }
    if (!f) throw new Error('Keine Antwort erhalten. Bitte noch einmal versuchen.');
    return f.input || {};
  }
  const tools = [...(maxUses ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses, user_location: locOf(city) }] : []), ...(canFetch ? [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: fetchMax, max_content_tokens: 8000 }] : []), tool];
  let data;
  let found;
  const complete = (d) => {
    const f = d.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
    return f && d.stop_reason !== 'max_tokens' ? f : null; // abgeschnittene Antwort zählt nicht
  };
  for (let round = 0; round < 4; round++) {
    data = await post({ model, max_tokens: maxTokens, system, tools, messages });
    found = complete(data);
    if (found || data.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
  }
  if (!found) {
    // Die Suchergebnisse stecken in der bisherigen Antwort: Gespräch fortsetzen und das Werkzeug verlangen
    const prev = data.stop_reason === 'max_tokens' ? data.content.filter((c) => c.type !== 'tool_use') : data.content;
    const cont = prev.length ? [...messages, { role: 'assistant', content: prev }, { role: 'user', content: `Gib jetzt deine Ergebnisse mit "${tool.name}" zurück – kompakt, ohne weitere Suche.` }] : messages;
    data = await post({ model, max_tokens: smart ? 16000 : 8000, system, tools, tool_choice: force, messages: cont });
    found = data.content.find((c) => c.type === 'tool_use' && c.name === tool.name);
  }
  if (!found) throw new Error('Die Suche hat keine Ergebnisse geliefert. Bitte noch einmal versuchen.');
  return found.input || {};
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

export const EVENT_PREF_PRESETS = ['Rock', 'Latino', 'Techno', 'Jazz', 'Indie', 'Stand-up', 'Tech & Startups', 'Laufen & Sport', 'Kunst & Ausstellungen', 'Food-Märkte', 'Theater', 'Kino', 'Workshops'];

export async function searchEvents(s, query, city = HOME_CITY) {
  const t = today();
  const ba = city === HOME_CITY;
  const prefs = s.profile?.eventPrefs || [];
  const system = `Du bist Mateos persönlicher Event-Scout in ${city}. Heute ist ${fmtLong(t)} (${t}). Zeitraum: die nächsten 14 Tage (bis ${addDays(t, 14)}), außer die Anfrage sagt etwas anderes („dieses Wochenende“ = der kommende Freitag bis Sonntag).
Seine Vorlieben: ${prefs.length ? prefs.join(', ') : '(noch keine angegeben)'}
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Events, die er schon kennt (nicht wiederholen): ${JSON.stringify(s.events.map((e) => e.name))}

Ziel: Mateo will NICHT das, was er selbst in 2 Minuten bei Google findet, sondern eine kuratierte, abwechslungsreiche Auswahl, die wirklich zu ihm passt – inklusive Geheimtipps.
${ba ? `So suchst du (höchstens 3 Suchen – jede kostet Geld, also gezielt und jede mit einem anderen Blickwinkel, meist auf Spanisch):
1. Eine Suche, die 2 seiner konkreten Vorlieben kombiniert (z.B. „recital rock o fiesta latina Buenos Aires noviembre“), nicht nur allgemein „eventos“.
2. Eine Suche nach einer guten Sammel-Seite (Agenda/„qué hacer este finde“), die viele Events auf einmal listet.
3. Eine Suche nach Ungewöhnlichem: kleine Clubs und Bars mit Live-Musik, Ciclos, Ferias, Talleres, Open-Air, Kulturzentren (Centro Cultural Kirchner, Konex, Recoleta), Milongas, Meetups/Luma (Tech), Blogs/Medien wie „qué hacer este finde“, Resident Advisor, Alternativa Teatral, Agenda Cultural der Stadt, Time Out.` : `So suchst du (höchstens 3 Suchen – jede kostet Geld, also gezielt und jede mit einem anderen Blickwinkel, in der Landessprache von ${city}):
1. Eine Suche, die 2 seiner konkreten Vorlieben mit ${city} und dem Monat kombiniert, nicht nur allgemein „Events“.
2. Eine Suche nach einer guten lokalen Sammel-Seite (Stadtmagazin, Veranstaltungskalender, „was ist los“), die viele Events auf einmal listet.
3. Eine Suche nach Ungewöhnlichem: kleine Clubs und Bars mit Live-Musik, Kulturzentren, Märkte, Workshops, Open-Air, Meetups/Luma (Tech), Resident Advisor, Time Out, lokale Blogs.`}
Verschiedene Quellen: höchstens 2 Events aus derselben Website; insgesamt mindestens 4 verschiedene Quellen, wenn möglich.
Dann rufe "events_zeigen" auf: 6 bis 10 konkrete Events mit Datum, gemischt (bekannt + Geheimtipp), sortiert nach Datum. Markiere Geheimtipps mit geheimtipp=true. Im Feld warum: konkret, warum es zu SEINEN Vorlieben passt. Nur echte Events aus den Suchergebnissen, keine erfundenen Daten oder Links. Texte auf Deutsch, kurz.`;
  const tool = { ...EVENT_TOOL, input_schema: JSON.parse(JSON.stringify(EVENT_TOOL.input_schema)) };
  tool.input_schema.properties.events.items.properties.geheimtipp = { type: 'boolean', description: 'true = eher unbekannt/ungewöhnlich' };
  const input = await searchWithTool({ system, user: `Anfrage: ${query} (Stadt: ${city})`, tool, maxUses: 3, label: 'Events suchen', city });
  const perHost = {};
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
    tip: !!e.geheimtipp,
    status: 'neu',
  }))
    // Vielfalt sicherstellen: höchstens 3 Events pro Quelle
    .filter((r) => {
      const k = r.source || r.name;
      perHost[k] = (perHost[k] || 0) + 1;
      return !r.source || perHost[k] <= 3;
    })
    .sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const v = { query, city, at: new Date().toISOString(), note: input.hinweis || '', results };
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
            kategorie: { type: 'string', enum: ['Café', 'Bar', 'Restaurant', 'Club', 'Kultur', 'Natur', 'Sport', 'Laden', 'Sonstiges', 'Noch unklar'], description: '„Noch unklar“, wenn aus dem Text nicht klar ist, was für ein Ort es ist' },
            unterart: { type: 'string', description: 'Genauer, z.B. „Rooftop / Sky Bar“, „Pub“, „Cocktailbar“, „Parrilla“, „Specialty Coffee“' },
            adresse: { type: 'string', description: 'Straße und Hausnummer, Viertel' },
            viertel: { type: 'string', description: 'Stadtviertel, z.B. „Palermo“, „San Telmo“' },
            tags: { type: 'array', items: { type: 'string' }, description: 'passende Tags aus dieser Liste: ' + ['Frühstück', 'Brunch', 'Mittagessen', 'Abendessen', 'Drinks', 'Snack', 'Argentinisch', 'Fleisch', 'Italienisch', 'Pizza', 'Japanisch', 'Asiatisch', 'Peruanisch', 'Mexikanisch', 'Spanisch', 'Burger', 'Fisch', 'Vegetarisch', 'Vegan', 'Café & Kuchen', 'Date', 'Mit Freunden', 'Zum Arbeiten', 'Terrasse', 'Live-Musik', 'Besonders'].join(', ') },
            preis: { type: 'integer', description: 'Preisniveau 1 = günstig, 2 = mittel, 3 = teuer (nur wenn bekannt)' },
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

export async function discoverPlaces(s, query, city = HOME_CITY) {
  const system = `Du findest für Mateo besondere Orte in ${city} (Cafés, Bars, Restaurants, Kultur …).
Was du über Mateo weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Orte, die er dort schon gespeichert hat (nicht wiederholen): ${JSON.stringify(s.places.filter((p) => placeCity(p) === city).map((p) => p.name))}
Suche gezielt (höchstens 2 Suchen – jede kostet Geld –, gern in der Landessprache und in aktuellen Listen/Artikeln). Danach rufe "orte_zeigen" mit 5 bis 8 Orten auf, mit möglichst genauer Adresse. Nur echte Orte aus den Suchergebnissen. Texte auf Deutsch, kurz.`;
  const input = await searchWithTool({ system, user: `Suche: ${query} (Stadt: ${city})`, tool: PLACE_TOOL, maxUses: 2, label: 'Orte entdecken', city });
  const results = (input.orte || []).filter((o) => o && o.name).map((o, i) => ({
    id: 'p' + i + Date.now().toString(36),
    name: String(o.name),
    category: o.kategorie || 'Sonstiges',
    subcat: o.unterart || '',
    address: o.adresse || '',
    hood: o.viertel || '',
    tags: (o.tags || []).filter((x) => ALL_TAGS.includes(x)),
    price: [1, 2, 3].includes(o.preis) ? o.preis : 0,
    why: o.warum || '',
    url: okUrl(o.url),
    status: 'neu',
  }));
  const v = { query, city, at: new Date().toISOString(), results };
  savePlaceSearch(v);
  return v;
}

// Orte aus eingefügtem/diktiertem Text übernehmen (v0.46): KI ohne Internet zieht die Orte heraus, Mateo hakt ab
const PARSE_TOOL = {
  name: 'orte_aus_text',
  description: 'Alle Orte aus Mateos Text strukturiert.',
  input_schema: { type: 'object', properties: { orte: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string' },
    kategorie: PLACE_TOOL.input_schema.properties.orte.items.properties.kategorie,
    unterart: { type: 'string' },
    adresse: { type: 'string', description: 'nur wenn im Text oder sicher bekannt' },
    viertel: { type: 'string', description: 'Stadtviertel, wenn im Text oder sicher bekannt (z.B. „Palermo“)' },
    tags: { type: 'array', items: { type: 'string' }, description: 'passende Tags (Mahlzeit, Küche, Stimmung) nur aus: ' + ['Frühstück', 'Brunch', 'Mittagessen', 'Abendessen', 'Drinks', 'Snack', 'Argentinisch', 'Fleisch', 'Italienisch', 'Pizza', 'Japanisch', 'Asiatisch', 'Peruanisch', 'Mexikanisch', 'Spanisch', 'Burger', 'Fisch', 'Vegetarisch', 'Vegan', 'Café & Kuchen', 'Date', 'Mit Freunden', 'Zum Arbeiten', 'Terrasse', 'Live-Musik', 'Besonders'].join(', ') },
            preis: { type: 'integer', description: 'Preisniveau 1 = günstig, 2 = mittel, 3 = teuer (nur wenn bekannt)' },
    war_da: { type: 'boolean', description: 'true, wenn er schon dort war' },
    erkannt: { type: 'string', description: '1 kurzer Satz, was das für ein Ort ist und woran du ihn erkannt hast (z.B. „Bekannte Parrilla in Palermo, sehr beliebt“). Wenn du den Ort nicht sicher kennst: „Nicht sicher – bitte auf Google Maps prüfen“.' },
  }, required: ['name', 'kategorie'] } } }, required: ['orte'] },
};
export async function parsePlaces(text, city = HOME_CITY) {
  const r = await searchWithTool({
    system: `Mateo gibt dir einen Text (Liste, Notizen, Empfehlungen, Diktat) mit Orten in ${city}. Zieh JEDEN genannten Ort heraus (Cafés, Bars, Restaurants, Kultur …), ordne Kategorie, Unterart, Viertel und passende Tags zu. Nichts erfinden, keine Orte hinzufügen, die nicht im Text stehen. Schreib bei "erkannt" ehrlich, ob du den Ort kennst.`,
    user: text, tool: PARSE_TOOL, maxUses: 0, label: 'Orte aus Text',
  });
  return (r.orte || []).filter((o) => o?.name).map((o, i) => ({ id: 'x' + i, name: o.name, category: o.kategorie || 'Noch unklar', subcat: o.unterart || '', address: o.adresse || '', hood: o.viertel || '', tags: (o.tags || []).filter((x) => ALL_TAGS.includes(x)), price: [1, 2, 3].includes(o.preis) ? o.preis : 0, note: '', info: o.erkannt || '', status: o.war_da ? 'war' : 'will' }));
}

// Aktuellen Standort → Stadt + Land (iPhone-Standort, dann OpenStreetMap; kostenlos)
export function cityHere() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Standort nicht verfügbar'));
    navigator.geolocation.getCurrentPosition(async (p) => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=de&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then((x) => x.json());
        const a = r?.address || {};
        const city = a.city || a.town || a.village || a.municipality || a.state || '';
        if (!city) return reject(new Error('Stadt nicht erkannt'));
        resolve({ city: /buenos aires/i.test(city) ? HOME_CITY : city, country: a.country || '', lat: p.coords.latitude, lon: p.coords.longitude });
      } catch { reject(new Error('Stadt nicht erkannt')); }
    }, () => reject(new Error('Standort nicht freigegeben')), { timeout: 10000, maximumAge: 600000 });
  });
}

// v1.0: Aktueller Standort → Stadtviertel (für „Wo ungefähr?“ im Orte-Verzeichnis)
export function hoodHere() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Standort nicht verfügbar'));
    navigator.geolocation.getCurrentPosition(async (p) => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=es&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then((x) => x.json());
        const a = r?.address || {};
        const hood = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.borough || '';
        if (!hood) return reject(new Error('Viertel nicht erkannt'));
        resolve(hood);
      } catch { reject(new Error('Viertel nicht erkannt')); }
    }, () => reject(new Error('Standort nicht freigegeben')), { timeout: 10000, maximumAge: 300000 });
  });
}

// Google-Maps-Suche zum Prüfen eines Ortes (kostenlos)
export const mapsUrl = (name, address, city = HOME_CITY) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address, city].filter(Boolean).join(', '))}`;

// Adresse → Koordinaten (OpenStreetMap Nominatim, kostenlos; sparsam benutzen)
export async function geocode(q, city = HOME_CITY) {
  const ba = city === HOME_CITY ? '&countrycodes=ar&viewbox=-58.65,-34.45,-58.25,-34.75' : '';
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=de${ba}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Adresssuche nicht erreichbar');
  const list = await res.json();
  return list.map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), label: r.display_name }));
}

// Zweiter Dienst (v0.68): Photon (komoot, OSM-Daten, verzeiht Tippfehler besser)
async function photon(q, near) {
  const bias = near ? `&lat=${near.lat}&lon=${near.lon}` : '';
  const res = await fetch(`https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(q)}${bias}`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.features || []).map((f) => {
    const p = f.properties || {};
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const label = [p.name, street, p.district || p.locality, p.city, p.country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ');
    return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label };
  });
}
const far = (a, b) => b && (Math.abs(a.lat - b.lat) > 1.5 || Math.abs(a.lon - b.lon) > 1.5);
// Adresse für das Ort-Formular finden: mehrere Schreibweisen, dann Photon (v0.68)
export async function findPlace(s, name, address, city = HOME_CITY) {
  const near = cityPos(s, city);
  const tries = [...new Set([address && `${address}, ${city}`, address && name && `${name}, ${address}, ${city}`, name && `${name}, ${city}`, address && address.replace(/\s*\d+.*$/, '') !== address && `${address.replace(/\s*\d+.*$/, '')}, ${city}`].filter(Boolean))];
  let reached = false;
  for (const q of tries) {
    try {
      const r = (await geocode(q, city)).filter((x) => !far(x, near));
      reached = true;
      if (r.length) return r;
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1100)); // Nominatim: höchstens 1 Anfrage pro Sekunde
  }
  for (const q of tries.slice(0, 3)) {
    try {
      const r = (await photon(q, near)).filter((x) => !far(x, near));
      reached = true;
      if (r.length) return r;
    } catch {}
  }
  if (!reached) throw new Error('Adresssuche gerade nicht erreichbar');
  return [];
}

// Erst mit Adresse, dann nur mit Namen versuchen
export async function locate(name, address, city = HOME_CITY) {
  const tries = [address && `${address}, ${city}`, `${name}, ${city}`].filter(Boolean);
  for (const q of tries) {
    try {
      const r = await geocode(q, city);
      if (r.length) return r[0];
    } catch {}
  }
  return null;
}

// Günstige Event-Suche: gezielte Such-Links (Google Events, Instagram, Eventbrite, Meetup) statt Websuche
const LINKS_KEY = 'life-app-eventlinks';
export const lastEventLinks = () => load(LINKS_KEY);
export async function eventLinks(s, query) {
  const prefs = s.profile?.eventPrefs || [];
  const r = await aiLinks({
    s,
    system: `Du bist Mateos Event-Scout in Buenos Aires. Heute ist ${fmtLong(today())}. Seine Vorlieben: ${prefs.join(', ') || '(keine angegeben)'}. Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Mische: Google Events (Suchbegriff mit Zeitraum, z.B. „recitales rock buenos aires este fin de semana“), Instagram-Hashtags/Konten von Locations, Kollektiven und Kultur-Medien (z.B. Agenda-Accounts), Eventbrite und Meetup für Workshops/Tech/Sport.`,
    user: `Anfrage: ${query}`,
    platforms: ['google_events', 'google', 'instagram_tag', 'instagram_konto', 'eventbrite', 'meetup'],
    label: 'Events: Such-Links',
  });
  const v = { query, at: new Date().toISOString(), ...r };
  save(LINKS_KEY, v);
  return v;
}
