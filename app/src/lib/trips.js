// Reisen: Ideen sammeln („Wohin könnte ich?“) und festgelegte Reisen mit Vorlage planen
// (Stationen, Transport, Orte auf der Karte, Unterlagen, To-dos und Packliste nach Kategorien, KI-Planer)
import { store, uid } from './store';
import { diffDays, fmtLong, today } from './dates';
import { searchWithTool } from './outings';
import { normalizeTrip } from './normalize';

const norm = (x) => String(x || '').trim().toLowerCase();
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');
const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');

export const PACK_TEMPLATE = {
  Kleidung: ['T-Shirts', 'Hosen / Shorts', 'Unterwäsche', 'Socken', 'Pullover / Jacke', 'Schlafsachen', 'Bequeme Schuhe'],
  Sportkleidung: ['Laufschuhe', 'Laufshirt und -hose', 'Sportsocken', 'Sportuhr + Ladekabel'],
  Badekleidung: ['Badehose', 'Strandtuch', 'Sonnenbrille', 'Flip-Flops'],
  Elektronik: ['Handy-Ladekabel', 'Powerbank', 'Kopfhörer', 'Reisestecker / Adapter', 'Laptop + Ladegerät'],
  'Bad & Pflege': ['Zahnbürste und Zahnpasta', 'Deo', 'Duschgel / Shampoo', 'Sonnencreme', 'Rasierer', 'Reiseapotheke', 'Pflaster'],
  Reisedokumente: ['Reisepass / Ausweis', 'Tickets (offline gespeichert)', 'Buchungsbestätigung Unterkunft', 'Kreditkarte + etwas Bargeld', 'Reiseversicherung', 'Führerschein (falls Mietwagen)'],
  Kleinigkeiten: ['Trinkflasche', 'Kleiner Rucksack', 'Snacks für unterwegs', 'Ohrstöpsel und Schlafmaske', 'Regenjacke / Schirm', 'Beutel für Schmutzwäsche'],
};
export const TODO_TEMPLATE = {
  Buchen: ['Hin- und Rückreise buchen', 'Unterkunft buchen', 'Transport zwischen den Stationen klären', 'Aktivitäten mit Reservierung buchen', 'Reiseversicherung prüfen'],
  'Vor der Reise': ['Einreise und Dokumente prüfen (Pass gültig?)', 'Kreditkarte fürs Ausland prüfen', 'Bargeld / Währung besorgen', 'Offline-Karten herunterladen', 'Wetter checken', 'Wohnung / Haustier versorgen'],
  'Letzter Tag': ['Packen', 'Online einchecken', 'Tickets offline speichern', 'Wohnung: Fenster, Herd, Müll'],
};
export const PLACE_KINDS = { unterkunft: 'Unterkunft', restaurant: 'Restaurant', sehenswuerdigkeit: 'Sehenswürdigkeit', aktivitaet: 'Aktivität', sonstiges: 'Sonstiges' };
export const PLACE_CAT = { unterkunft: 'Unterkunft', restaurant: 'Restaurant', sehenswuerdigkeit: 'Kultur', aktivitaet: 'Natur', sonstiges: 'Sonstiges' };
export const MODES = { flug: 'Flug', bus: 'Bus', auto: 'Auto / Mietwagen', zug: 'Zug', faehre: 'Fähre', sonstiges: 'Sonstiges' };

const items = (tpl) => Object.entries(tpl).flatMap(([cat, list]) => list.map((text) => ({ id: uid(), text, cat, done: false })));


export function addTrip({ name, dest = '', from = '', to = '', budget = '', status = 'geplant', idea = '' }) {
  const t = String(name || dest || '').trim();
  if (!t) return null;
  const id = uid();
  store.update((s) => {
    s.trips.push(normalizeTrip({
      id, name: t, dest: dest || t, from, to, budget: Number(budget) || 0, currency: 'USD', notes: '', status, idea,
      todo: status === 'geplant' ? items(TODO_TEMPLATE) : [], packen: status === 'geplant' ? items(PACK_TEMPLATE) : [], createdAt: today(),
    }));
  });
  return id;
}
// Aus einer Idee wird eine festgelegte Reise: Vorlagen für To-dos und Packliste kommen dazu
export function commitTrip(id, { from = '', to = '' } = {}) {
  store.update((s) => {
    const tr = s.trips.find((x) => x.id === id);
    if (!tr) return;
    tr.status = 'geplant';
    if (from) tr.from = from;
    if (to) tr.to = to;
    for (const x of items(TODO_TEMPLATE)) if (!tr.todo.some((y) => norm(y.text) === norm(x.text))) tr.todo.push(x);
    for (const x of items(PACK_TEMPLATE)) if (!tr.packen.some((y) => norm(y.text) === norm(x.text))) tr.packen.push(x);
  });
}
export const updateTrip = (id, patch) => store.update((s) => Object.assign(s.trips.find((x) => x.id === id) || {}, patch));
export const removeTrip = (id) => store.update((s) => { s.trips = s.trips.filter((x) => x.id !== id); });

// Allgemeine Listen-Funktionen (todo, packen, stops, places, transport, docs, expenses)
export function addEntry(tripId, list, obj) {
  const id = uid();
  store.update((s) => {
    const tr = s.trips.find((x) => x.id === tripId);
    if (tr) tr[list].push({ id, ...obj });
  });
  return id;
}
export const updateEntry = (tripId, list, id, patch) => store.update((s) => Object.assign(s.trips.find((x) => x.id === tripId)?.[list].find((x) => x.id === id) || {}, patch));
export const removeEntry = (tripId, list, id) => store.update((s) => {
  const tr = s.trips.find((x) => x.id === tripId);
  if (tr) tr[list] = tr[list].filter((x) => x.id !== id);
});
export function addCheck(tripId, list, text, cat = 'Sonstiges') {
  const t = String(text || '').trim();
  if (!t) return;
  store.update((s) => {
    const tr = s.trips.find((x) => x.id === tripId);
    if (tr && !tr[list].some((x) => norm(x.text) === norm(t))) tr[list].push({ id: uid(), text: t, cat, done: false });
  });
}
export function addExpense(tripId, { text, amount }) {
  if (!String(text || '').trim() || !Number(amount)) return;
  addEntry(tripId, 'expenses', { text: text.trim(), amount: Number(amount), date: today() });
}

// Koordinaten weltweit (OpenStreetMap Nominatim, kostenlos; max. 1 Anfrage pro Sekunde)
let last = 0;
export async function geocodeWorld(q) {
  const wait = Math.max(0, last + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=de&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const r = (await res.json())[0];
    return r ? { lat: Number(r.lat), lon: Number(r.lon) } : null;
  } catch {
    return null;
  }
}
// Ort/Station ohne Koordinaten nachträglich verorten
const km = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
// Mittelpunkt der Reise (Ziel) einmal verorten – Karte zeigt dann immer die Gegend, auch ohne Orte
export async function locateTrip(tripId) {
  const tr = store.get().trips.find((x) => x.id === tripId);
  if (!tr || tr.lat != null || !(tr.dest || tr.name)) return null;
  const r = await geocodeWorld(tr.dest || tr.name);
  if (r) updateTrip(tripId, r);
  return r;
}
// Ort/Station verorten: zuerst über OpenStreetMap (zuverlässig), KI-Koordinaten nur als Notlösung und nur, wenn sie in der Nähe des Ziels liegen
export async function locateEntry(tripId, list, id, force = false) {
  const tr = store.get().trips.find((x) => x.id === tripId);
  const e = tr?.[list].find((x) => x.id === id);
  if (!e || (e.lat != null && !force && !e.aiPos)) return;
  const stop = list === 'places' ? tr.stops.find((x) => x.id === e.stopId) : null;
  const where = stop?.name || tr.dest || tr.name;
  const tries = (list === 'stops' ? [e.name, `${e.name}, ${where}`] : [e.address && `${e.address}${where ? `, ${where}` : ''}`, `${e.name}, ${where}`, e.name]).filter(Boolean);
  const center = tr.lat != null ? { lat: tr.lat, lon: tr.lon } : null;
  for (const q of tries) {
    const r = await geocodeWorld(q);
    if (r && (!center || km(center, r) < 1500)) return updateEntry(tripId, list, id, { ...r, aiPos: false });
  }
  if (e.aiPos && center && km(center, e) > 1500) updateEntry(tripId, list, id, { lat: null, lon: null, aiPos: false });
}
// Alles ohne (sichere) Position nachschlagen
export async function locateAll(tripId) {
  await locateTrip(tripId);
  const tr = store.get().trips.find((x) => x.id === tripId);
  if (!tr) return 0;
  const todo = [...tr.stops.filter((x) => x.lat == null || x.aiPos).map((x) => ['stops', x.id]), ...tr.places.filter((x) => x.lat == null || x.aiPos).map((x) => ['places', x.id])];
  for (const [list, id] of todo) await locateEntry(tripId, list, id);
  const after = store.get().trips.find((x) => x.id === tripId);
  return [...after.stops, ...after.places].filter((x) => x.lat == null).length;
}

// ---------- Routen-Varianten (Skizzen, bevor eine Route feststeht) ----------
export function addVariant(tripId, { name, summary = '', stops = [] }) {
  const id = uid();
  store.update((s) => {
    const t = s.trips.find((x) => x.id === tripId);
    if (!t) return;
    t.variants = t.variants || [];
    t.variants.push({ id, name: String(name || `Route ${t.variants.length + 1}`).trim(), summary, stops: stops.filter((x) => x && x.name).map((x) => ({ name: String(x.name).trim(), nights: Number(x.nights) || null, note: x.note || '' })), chosen: false });
  });
  return id;
}
export const removeVariant = (tripId, id) => store.update((s) => { const t = s.trips.find((x) => x.id === tripId); if (t) t.variants = t.variants.filter((v) => v.id !== id); });
// Variante wählen: ihre Abschnitte werden die Stationen der Route (vorhandene gleiche Stationen bleiben samt Orten erhalten)
export function chooseVariant(tripId, id) {
  const added = [];
  store.update((s) => {
    const t = s.trips.find((x) => x.id === tripId);
    const v = t?.variants.find((x) => x.id === id);
    if (!v) return;
    // Bisherige Route nicht verlieren: wenn sie in keiner Variante steckt, als eigene Variante sichern
    const sig = (list) => list.map((x) => norm(x.name)).join('|');
    if (t.stops.length && !t.variants.some((x) => sig(x.stops) === sig(t.stops))) {
      t.variants.unshift({ id: uid(), name: 'Bisherige Route', summary: 'automatisch gesichert', stops: t.stops.map((x) => ({ name: x.name, nights: null, note: x.note || '' })), chosen: false });
    }
    t.variants.forEach((x) => { x.chosen = x.id === id; });
    t.stops = v.stops.map((x) => {
      const old = t.stops.find((y) => norm(y.name) === norm(x.name));
      if (old) return { ...old, note: old.note || [x.nights && `${x.nights} Nächte`, x.note].filter(Boolean).join(' · ') };
      const nid = uid();
      added.push(nid);
      return { id: nid, name: x.name, from: '', to: '', note: [x.nights && `${x.nights} Nächte`, x.note].filter(Boolean).join(' · ') };
    });
  });
  (async () => { for (const sid of added) await locateEntry(tripId, 'stops', sid); })();
}

// ---------- KI: Wohin könnte ich? ----------
// ---------- KI: Reiseführer „Wohin könnte ich?“ (v0.40: Gespräch, kurze Vorschläge, mehrere als einzelne Ideen übernehmen) ----------
// Preisvergleich mehrerer Ziele (Flug ab Mateos Flughafen + Unterkunft pro Nacht) – v0.43
const VERGLEICH = {
  type: 'array',
  description: 'Nur wenn Mateo Preise vergleichen will: eine Zeile pro Ziel',
  items: {
    type: 'object',
    properties: {
      ziel: { type: 'string' },
      land: { type: 'string' },
      ab: { type: 'string', description: 'Abflughafen, z.B. EZE' },
      flug: { type: 'string', description: 'z.B. „ab ca. 420 USD hin & zurück, LATAM, 2 h 40, Stand Suche“' },
      unterkunft: { type: 'string', description: 'z.B. „Airbnb ab ca. 45 USD/Nacht, Hotel ab 70“' },
      gesamt: { type: 'string', description: 'grobe Summe für die Reise pro Person, wenn Dauer bekannt' },
      url_flug: { type: 'string', description: 'Link aus Suchergebnissen' },
      url_unterkunft: { type: 'string', description: 'Link aus Suchergebnissen' },
    },
    required: ['ziel'],
  },
};
// Abflughafen: pro Reise einstellbar (tr.airport), sonst Standard aus dem Profil (v0.44)
export const airportsOf = (s, tr) => tr?.airport || s.profile?.airports || 'Buenos Aires (EZE oder AEP)';
export const airbnbUrl = (ziel, from, to) => `https://www.airbnb.com/s/${encodeURIComponent(ziel)}/homes${from && to ? `?checkin=${from}&checkout=${to}` : ''}`;
// fehlende Links ergänzen, damit man die echten Preise mit einem Tipp sieht
export function fixVergleich(rows, s, tr) {
  const from = airportsOf(s, tr);
  return (rows || []).filter((x) => x && x.ziel).map((x) => ({
    ...x,
    url_flug: okUrl(x.url_flug) || flightUrl(x.ab || from, x.ziel, tr?.from),
    url_unterkunft: okUrl(x.url_unterkunft) || airbnbUrl(x.ziel, tr?.from, tr?.to),
  }));
}
const GUIDE_TOOL = {
  name: 'reiseziele',
  description: 'Antwort an Mateo plus Reiseziel-Vorschläge, die er einzeln als Idee übernehmen kann.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Kurze Antwort wie ein Reiseführer, gern eine Rückfrage' },
      ziele: {
        type: 'array',
        description: '0–5 Ziele. Die Liste zeigt nur Ziel, Land und "kurz" – die anderen Felder landen ausführlich in der gespeicherten Idee.',
        items: {
          type: 'object',
          properties: {
            ziel: { type: 'string', description: 'Ort/Region, z.B. „Florianópolis“' },
            land: { type: 'string' },
            kurz: { type: 'string', description: 'Höchstens 6 Wörter, z.B. „Strände, Surfen, Inselflair“' },
            warum: { type: 'string', description: '2–3 Sätze: was dort besonders ist und warum es zu Mateo passt' },
            highlights: { type: 'array', items: { type: 'string' }, description: '3–5 Dinge, die man dort sehen/erleben kann, je ein paar Wörter' },
            dauer: { type: 'string', description: 'Empfohlene Dauer, z.B. „4–5 Tage“' },
            anreise: { type: 'string', description: 'Von Buenos Aires: Verkehrsmittel, ca. Dauer und Preis' },
            beste_zeit: { type: 'string' },
            budget: { type: 'string', description: 'grobe Kosten pro Person' },
            url: { type: 'string', description: 'Link nur aus Suchergebnissen, nie erfinden' },
          },
          required: ['ziel', 'kurz'],
        },
      },
    },
    required: ['antwort'],
  },
};
export async function tripGuide(s, history, { web = false, smart = false } = {}) {
  const system = `Du bist Mateos persönlicher Reiseführer in der App „Life“. Er lebt in Buenos Aires. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Schon auf seiner Liste (geplant oder Idee, nicht wiederholen): ${JSON.stringify(s.trips.map((x) => x.name))}
Arbeitsweise:
- Wie ein guter Reiseführer im Gespräch: Wenn der Wunsch noch vage ist, darfst du kurz nachfragen (Zeitraum/Dauer, Strand/Stadt/Natur, Budget, allein/zu zweit) – musst aber nicht; meist direkt 3–5 abwechslungsreiche Ziele vorschlagen (gern ein überraschendes) und höchstens eine Frage stellen.
- Auf Nachfragen eingehen: vergleichen, Alternativen, „mehr wie X“, „günstiger“ – dann neue Ziele unter "ziele".
- Mateo will zwischen Zielen entscheiden: jedes Ziel eigenständig, nicht mehrere Orte in einem Eintrag zusammenfassen.
- Pro Ziel: "kurz" (höchstens 6 Wörter, das sieht er in der Liste) und dafür ausführlich warum, highlights, dauer, anreise ab Buenos Aires, beste_zeit, budget – das wird beim Übernehmen in die Idee geschrieben.
- Hier geht es ums Finden von Zielen. Genaue Flug- und Unterkunftspreise prüft Mateo später mit dem Knopf „Preise“ bei seinen Ideen – darauf kannst du kurz hinweisen.
- ${web ? 'Du darfst höchstens 2-mal im Internet suchen (aktuelle Tipps, Events, Saison). Links nur aus Suchergebnissen.' : 'Du suchst diesmal NICHT im Internet: antworte aus deinem Wissen, ohne URLs.'}
Antworte immer mit "reiseziele". Deutsch.`;
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  return searchWithTool({ system, messages, tool: GUIDE_TOOL, maxUses: web ? 2 : 0, label: 'Reiseziele finden', smart });
}
export const ideaText = (z) => [
  z.kurz,
  z.warum,
  z.highlights?.length ? `Highlights: ${z.highlights.join(', ')}` : '',
  z.dauer && `Dauer: ${z.dauer}`,
  z.anreise && `Anreise: ${z.anreise}`,
  z.beste_zeit && `Beste Zeit: ${z.beste_zeit}`,
  z.budget && `Kosten: ${z.budget}`,
  okUrl(z.url) && `Mehr: ${okUrl(z.url)}`,
].filter(Boolean).join('\n');
// Optionen einer Reise-Idee (v0.43, Mateo): mehrere Ziele für DIESELBE Reise sammeln, vergleichen, mit ✕ rauswerfen, eins festlegen
const optInfo = (x) => ({
  ziel: x.ziel, land: x.land || '', kurz: x.kurz || '', info: ideaText({ ...x, kurz: '' }),
  ...(x.flug ? { flug: x.flug } : {}), ...(x.unterkunft ? { unterkunft: x.unterkunft } : {}), ...(x.gesamt ? { gesamt: x.gesamt } : {}),
  ...(x.url_flug ? { urlFlug: x.url_flug } : {}), ...(x.url_unterkunft ? { urlStay: x.url_unterkunft } : {}),
});
export function addOptions(tripId, list) {
  let n = 0;
  store.update((s) => {
    const t = s.trips.find((x) => x.id === tripId);
    if (!t) return;
    t.options = t.options || [];
    for (const x of list || []) {
      if (!x?.ziel) continue;
      const add = optInfo(x);
      const old = t.options.find((o) => norm(o.ziel) === norm(x.ziel));
      if (old) {
        // Preise/Infos ergänzen statt doppelt anlegen
        for (const [k, v] of Object.entries(add)) if (v && (!old[k] || ['flug', 'unterkunft', 'gesamt', 'urlFlug', 'urlStay'].includes(k))) old[k] = v;
      } else {
        t.options.push({ id: uid(), ...add });
        n++;
      }
    }
  });
  return n;
}
export const removeOption = (tripId, id) => store.update((s) => {
  const t = s.trips.find((x) => x.id === tripId);
  if (t) t.options = (t.options || []).filter((o) => o.id !== id);
});
// Auf eine Option festlegen: Ziel der Reise, Infos in die Idee, die anderen Optionen fallen weg
export function chooseOption(tripId, id) {
  store.update((s) => {
    const t = s.trips.find((x) => x.id === tripId);
    const o = t?.options.find((x) => x.id === id);
    if (!o) return;
    t.dest = [o.ziel, o.land].filter(Boolean).join(', ');
    t.idea = [o.kurz, o.info, o.flug && `Flug: ${o.flug}`, o.unterkunft && `Unterkunft: ${o.unterkunft}`, o.gesamt && `Gesamt: ${o.gesamt}`].filter(Boolean).join('\n');
    t.options = [];
    t.lat = null;
    t.lon = null;
  });
  locateTrip(tripId);
}
// Gruppen (v0.45, Mateo): Ideen für dieselbe Reise unter einer Überschrift sammeln – jede Idee bleibt eigenständig (Orte, Routen …)
export const groupsOf = (s) => [...new Set(s.trips.filter((x) => x.status === 'idee' && x.group).map((x) => x.group))];
export function groupIdeas(ids, name) {
  const g = String(name || '').trim();
  if (!g) return;
  store.update((s) => { for (const x of s.trips) if (ids.includes(x.id)) x.group = g; });
}
export const ungroup = (g) => store.update((s) => { for (const x of s.trips) if (x.group === g) x.group = ''; });
export const renameGroup = (g, name) => store.update((s) => { for (const x of s.trips) if (x.group === g) x.group = String(name || '').trim(); });
// Preise (aus einem Vergleich) an einer Reise speichern
const priceOf = (v) => Object.fromEntries(Object.entries({ flug: v.flug, unterkunft: v.unterkunft, gesamt: v.gesamt, urlFlug: okUrl(v.url_flug), urlStay: okUrl(v.url_unterkunft), ab: v.ab }).filter(([, x]) => x));
const sameDest = (tr, ziel) => [tr.name, tr.dest, (tr.dest || '').split(',')[0]].some((x) => norm(x) === norm(ziel));
// Preise nachsehen (v0.46, Mateo): Knopf an einer Gruppe oder Idee – Flug hin & zurück + Unterkunft pro Nacht für jedes Ziel, mit Websuche
const PRICE_TOOL = {
  name: 'preise_zeigen',
  description: 'Gibt aktuelle Flug- und Unterkunftspreise pro Ziel zurück.',
  input_schema: { type: 'object', properties: { hinweis: { type: 'string', description: '1 Satz, z.B. welches Ziel am günstigsten ist' }, vergleich: VERGLEICH }, required: ['vergleich'] },
};
export async function comparePrices(s, trips, { from = '', to = '', airport = '', people = 1 } = {}) {
  const ab = airport.trim() || airportsOf(s, trips[0]);
  const ziele = trips.map((x) => x.dest || x.name);
  const nights = from && to ? Math.max(1, diffDays(from, to)) : null;
  const system = `Du recherchierst für Mateo aktuelle Reisepreise. Heute ist ${fmtLong(today())}.
Ziele: ${JSON.stringify(ziele)}. Abflug ab: ${ab}. Zeitraum: ${from && to ? `${from} bis ${to} (${nights} Nächte)` : 'flexibel – nimm einen typischen Zeitraum in den nächsten 2–3 Monaten und nenne ihn'}. Personen: ${people}.
Suche höchstens 4-mal im Internet, bündle die Ziele (z.B. „vuelos Buenos Aires Florianópolis Salvador ${from ? from.slice(0, 7) : ''} precio“, „airbnb Florianópolis precio noche“). Dann rufe "preise_zeigen" auf: genau eine Zeile pro Ziel (gleiche Schreibweise wie oben) mit Flug hin & zurück pro Person (Airline/Direktflug?, Dauer, für welches Datum), Unterkunft pro Nacht (Airbnb und ggf. Hotel/Pousada), Summe pro Person${nights ? ` für ${nights} Nächte` : ''}. Preise als „ca. … USD (Stand Suche)“. Links nur aus Suchergebnissen, nie erfinden. Deutsch, kurz.`;
  const r = await searchWithTool({ system, user: 'Bitte Preise vergleichen.', tool: PRICE_TOOL, maxUses: 4, label: 'Reisepreise vergleichen' });
  const rows = fixVergleich(r.vergleich, s, { from, to, airport: ab });
  store.update((st) => {
    for (const v of rows) {
      const t = st.trips.find((x) => trips.some((y) => y.id === x.id) && sameDest(x, v.ziel));
      if (t) t.prices = { ...priceOf(v), when: from && to ? `${from}|${to}` : '', checked: today() };
    }
  });
  return { rows, hinweis: r.hinweis || '' };
}
// Aus dem Reiseführer-Chat: jedes gewählte Ziel wird eine eigene Idee, optional in einer Gruppe; Preisvergleiche ergänzen vorhandene Ideen
export function applyGuide(sel, { group = '' } = {}) {
  const g = String(group || '').trim();
  let n = 0;
  for (const z of [...(sel.ziele || []), ...(sel.vergleich || [])]) {
    if (!z?.ziel) continue;
    const st = store.get();
    const old = st.trips.find((x) => x.status === 'idee' && sameDest(x, z.ziel) && (!g || x.group === g || !x.group));
    if (old) {
      updateTrip(old.id, { ...(g ? { group: g } : {}), ...(z.flug || z.unterkunft ? { prices: { ...(old.prices || {}), ...priceOf(z) } } : {}), ...(!old.idea && (z.warum || z.kurz) ? { idea: ideaText(z) } : {}) });
      continue;
    }
    const id = addTrip({ name: z.ziel, dest: [z.ziel, z.land].filter(Boolean).join(', '), status: 'idee', idea: ideaText(z) });
    updateTrip(id, { group: g, ...(z.flug || z.unterkunft ? { prices: priceOf(z) } : {}) });
    n++;
  }
  return n;
}

// ---------- KI: Reise-Planer (Gespräch mit Vorschlägen) ----------
const PLAN_TOOL = {
  name: 'reise_planen',
  description: 'Antwort an Mateo plus konkrete Vorschläge, die er mit einem Tipp übernehmen kann.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Kurze Antwort/Einschätzung (2–6 Sätze), gern mit einer Rückfrage, wenn etwas Wichtiges fehlt' },
      stationen: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, von: { type: 'string', description: 'JJJJ-MM-TT' }, bis: { type: 'string' }, notiz: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } }, required: ['name'] }, description: 'Mögliche Route/Stationen in Reihenfolge' },
      transport: { type: 'array', items: { type: 'object', properties: { von: { type: 'string' }, nach: { type: 'string' }, art: { type: 'string', enum: Object.keys(MODES) }, dauer: { type: 'string' }, preis: { type: 'string' }, notiz: { type: 'string' }, url: { type: 'string' } }, required: ['von', 'nach'] }, description: 'Transportmöglichkeiten mit Dauer und Preis' },
      orte: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, art: { type: 'string', enum: Object.keys(PLACE_KINDS) }, station: { type: 'string', description: 'Name der Station, zu der der Ort gehört' }, notiz: { type: 'string' }, adresse: { type: 'string' }, url: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } }, required: ['name', 'art'] }, description: 'Unterkünfte, Restaurants, Sehenswürdigkeiten, Aktivitäten' },
      todo: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, kategorie: { type: 'string', description: `z.B. ${Object.keys(TODO_TEMPLATE).join(', ')}` } }, required: ['text'] } },
      packen: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, kategorie: { type: 'string', description: `z.B. ${Object.keys(PACK_TEMPLATE).join(', ')}` } }, required: ['text'] } },
      entfernen: { type: 'array', items: { type: 'string' }, description: 'Punkte der Packliste/To-dos, die für diese Reise nicht passen (genauer Text)' },
      vergleich: VERGLEICH,
      varianten: {
        type: 'array',
        description: 'Routen-Varianten als Skizze (1–2 pro Antwort): Name + Abschnitte in Reihenfolge',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kurz, z.B. „Küste entspannt“' },
            kurz: { type: 'string', description: 'Halbsatz, wofür die Route steht' },
            abschnitte: { type: 'array', items: { type: 'object', properties: { ort: { type: 'string' }, naechte: { type: 'integer' }, notiz: { type: 'string', description: 'ganz kurz, z.B. „Strände, Bus 3 h“' } }, required: ['ort'] } },
          },
          required: ['name', 'abschnitte'],
        },
      },
    },
    required: ['antwort'],
  },
};
export const tripSnapshot = (tr) => ({
  name: tr.name, ziel: tr.dest, abflug: tr.airport || undefined, status: tr.status === 'idee' ? 'Idee (noch nicht festgelegt)' : 'festgelegt', von: tr.from, bis: tr.to, idee: tr.idea || undefined, budget: tr.budget ? `${tr.budget} ${tr.currency}` : undefined,
  stationen: tr.stops.map((x) => ({ name: x.name, von: x.from, bis: x.to })),
  transport: tr.transport.map((x) => `${x.from} → ${x.to} (${MODES[x.mode] || x.mode}${x.status === 'gebucht' ? ', gebucht' : ''})`),
  orte: tr.places.map((x) => `${x.name} (${PLACE_KINDS[x.kind]}${x.status === 'fest' ? ', gemerkt' : ''})`),
  preise: tr.prices ? [tr.prices.flug && `Flug ${tr.prices.flug}`, tr.prices.unterkunft && `Unterkunft ${tr.prices.unterkunft}`].filter(Boolean).join(' · ') : undefined,
  gruppe: tr.group || undefined,
  routen_varianten: (tr.variants || []).map((v) => `${v.name}${v.chosen ? ' (gewählt)' : ''}: ${v.stops.map((x) => `${x.name}${x.nights ? ` ${x.nights}N` : ''}`).join(' → ')}`),
  todo: tr.todo.map((x) => x.text), packen: tr.packen.map((x) => x.text), notizen: tr.notes || undefined,
});
export const flightUrl = (from, to, date) => `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from} to ${to}${date ? ` on ${date}` : ''}`)}`;
const stayUrl = (name, where, tr) => {
  const st = tr.stops.find((y) => norm(y.name) === norm(where));
  const ci = st?.from || tr.from;
  const co = st?.to || tr.to;
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${name}, ${where}`)}${ci ? `&checkin=${ci}` : ''}${co ? `&checkout=${co}` : ''}`;
};
export async function tripAssist(s, tr, history, { web = false, smart = false } = {}) {
  const system = `Du bist Mateos Reiseplaner in der App „Life“. Er lebt in Buenos Aires. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Aktueller Stand der Reise: ${JSON.stringify(tripSnapshot(tr))}
Arbeitsweise:
- ${tr.status === 'idee' ? `Die Reise ist noch eine Idee. Führe ein echtes Gespräch und baue Schritt für Schritt auf:
  1) Erst verstehen: Was will Mateo sehen/erleben, wie lange, welcher Reisestil? Frag gezielt nach (1–2 Fragen), statt gleich viel vorzuschlagen.
  2) Dann ORTE: schlage wenige (2–4) passende Orte/Regionen vor, je mit kurzem „was es dort gibt“ (unter "orte", art sehenswuerdigkeit/aktivitaet, notiz = 3–6 Wörter), damit er versteht, was ihn erwartet. Gemerkte Orte im Stand sind gesetzt.
  3) Erst wenn Orte klar sind: ROUTEN-VARIANTEN unter "varianten" (1–2 pro Antwort, je mit Abschnitten in Reihenfolge und Nächten), gern unterschiedlich (z.B. „entspannt“ vs. „viel sehen“). Vorhandene Varianten kennst du aus dem Stand – baue darauf auf, ändere/vergleiche sie auf Wunsch, wiederhole sie nicht.
  4) Transport zwischen den Abschnitten erst, wenn eine Variante interessant ist. Keine "stationen" vorschlagen – die entstehen, wenn Mateo eine Variante wählt.` : 'Die Reise steht: hilf konkret zu planen (Stationen, Transport, Unterkunft, Restaurants, Sehenswürdigkeiten) und die Listen anzupassen. Will Mateo die Route überdenken, vergleichen oder Alternativen sehen, skizziere 1–2 Routen-Varianten unter "varianten" (aufbauend auf vorhandenen, nicht wiederholen) – die aktuelle Route bleibt, bis er eine Variante wählt; dann keine "stationen" vorschlagen.'}
- ${web ? `Du darfst höchstens 3-mal im Internet suchen – gezielt für das, was aktuell sein muss:
  · FLÜGE/BUS/FÄHRE: konkrete Verbindungen unter "transport" mit Anbieter/Airline, Dauer, aktuellem Preis (mit Datum, für das er gilt) und Link aus den Suchergebnissen (z.B. Google Flights, Skyscanner, Busbud, Anbieter-Seite). Reisedaten aus dem Stand nutzen.
  · UNTERKÜNFTE: 3–5 konkrete Unterkünfte unter "orte" (art unterkunft) mit Preis pro Nacht, Lage und Link (Booking, Airbnb, Hostelworld, eigene Website); passend zu Stil/Budget.
  · Sehenswürdigkeiten/Restaurants kennst du meist selbst – dafür nur suchen, wenn nach etwas Aktuellem gefragt ist (Öffnungszeiten, neue Orte).
  Preise immer als „ca. … (Stand Suche)“. Links nur aus Suchergebnissen, nie erfinden.` : 'Du suchst diesmal NICHT im Internet: antworte aus deinem Wissen (Sehenswürdigkeiten, Restaurants, Routen gehen gut), gib keine URLs an. Preise nur als grobe Schätzung kennzeichnen; für aktuelle Flug-/Unterkunftspreise sag kurz, dass Mateo „🔍 Nochmal mit Internet suchen“ tippen kann.'}
- ${tr.status === 'idee' ? 'Packliste und To-dos kommen erst beim Festlegen dazu: schlage dafür noch nichts vor (kein "packen", "todo", "entfernen").' : 'Die Packliste und To-dos haben eine Standard-Vorlage. Passe sie an Ziel, Jahreszeit, Dauer und Aktivitäten an: Fehlendes unter "packen"/"todo", Unpassendes (z.B. Badekleidung bei Winterreise) unter "entfernen".'}
- Abflug ab ${airportsOf(s, tr)}. ${tr.group ? `Diese Idee gehört zur Gruppe „${tr.group}“ mit den Alternativen: ${JSON.stringify(s.trips.filter((x) => x.group === tr.group && x.id !== tr.id).map((x) => x.dest || x.name))}. ` : ''}${tr.prices ? `Bekannte Preise: ${JSON.stringify(tr.prices)}. ` : ''}Preisvergleiche macht Mateo über den Knopf „Preise“ – schlag dafür nichts vor.
- Nichts vorschlagen, was schon im Stand steht. Bei Orten wenn möglich lat/lon angeben.
- Fehlt Wichtiges (Zeitraum, Budget, Reisestil, wer kommt mit), frag kurz nach – mach trotzdem schon erste Vorschläge.
Antworte immer mit "reise_planen". Deutsch, konkret, kurz.`;
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  const r = await searchWithTool({ system, messages, tool: PLAN_TOOL, maxUses: web ? 3 : 0, label: 'Reise-Planer', smart });
  // Ohne Link: Such-Links bauen (Google Flights, Booking) – damit man die aktuellen Preise mit einem Tipp sieht
  for (const x of r.transport || []) if (!okUrl(x.url) && x.von && x.nach) x.url = x.art === 'flug' ? flightUrl(x.von, x.nach, tr.from) : `https://www.google.com/search?q=${encodeURIComponent(`${x.art === 'sonstiges' ? '' : MODES[x.art] || ''} ${x.von} ${x.nach} pasaje precio`.trim())}`;
  for (const x of r.orte || []) if (!okUrl(x.url) && x.art === 'unterkunft') x.url = stayUrl(x.name, x.station || tr.dest || tr.name, tr);
  if (r.vergleich) r.vergleich = fixVergleich(r.vergleich, s, tr);
  return r;
}

// Ausgewählte Vorschläge übernehmen
export function applyTripProposal(tripId, sel) {
  const s = store.get();
  const tr = s.trips.find((x) => x.id === tripId);
  if (!tr) return;
  const added = { places: [], stops: [] };
  store.update((st) => {
    const t = st.trips.find((x) => x.id === tripId);
    for (const x of sel.stationen || []) {
      if (t.stops.some((y) => norm(y.name) === norm(x.name))) continue;
      const id = uid();
      t.stops.push({ id, name: x.name, from: okDate(x.von), to: okDate(x.bis), note: x.notiz || '', ...(typeof x.lat === 'number' && typeof x.lon === 'number' ? { lat: x.lat, lon: x.lon, aiPos: true } : {}) });
      added.stops.push(id);
    }
    for (const x of sel.transport || []) t.transport.push({ id: uid(), from: x.von, to: x.nach, mode: MODES[x.art] ? x.art : 'sonstiges', date: '', time: '', note: [x.dauer, x.preis, x.notiz].filter(Boolean).join(' · '), url: okUrl(x.url), status: 'option' });
    for (const x of sel.orte || []) {
      if (t.places.some((y) => norm(y.name) === norm(x.name))) continue;
      const stop = t.stops.find((y) => norm(y.name) === norm(x.station));
      const id = uid();
      t.places.push({ id, name: x.name, kind: PLACE_KINDS[x.art] ? x.art : 'sonstiges', stopId: stop?.id || '', note: x.notiz || '', address: x.adresse || '', url: okUrl(x.url), status: 'option', ...(typeof x.lat === 'number' && typeof x.lon === 'number' ? { lat: x.lat, lon: x.lon, aiPos: true } : {}) });
      added.places.push(id);
    }
    for (const x of sel.todo || []) if (!t.todo.some((y) => norm(y.text) === norm(x.text))) t.todo.push({ id: uid(), text: x.text, cat: x.kategorie || 'Sonstiges', done: false });
    for (const x of sel.packen || []) if (!t.packen.some((y) => norm(y.text) === norm(x.text))) t.packen.push({ id: uid(), text: x.text, cat: x.kategorie || 'Sonstiges', done: false });
    for (const v of sel.vergleich || []) {
      // passende Reise finden: diese oder eine Idee aus derselben Gruppe
      const target = sameDest(t, v.ziel) ? t : st.trips.find((x) => x.id !== t.id && t.group && x.group === t.group && sameDest(x, v.ziel));
      if (target) target.prices = { ...(target.prices || {}), ...priceOf(v) };
    }
    for (const v of sel.varianten || []) {
      t.variants = t.variants || [];
      t.variants.push({ id: uid(), name: v.name || `Route ${t.variants.length + 1}`, summary: v.kurz || '', stops: (v.abschnitte || []).filter((x) => x && x.ort).map((x) => ({ name: x.ort, nights: x.naechte || null, note: x.notiz || '' })), chosen: false });
    }
    if (sel.entfernen?.length) {
      const rm = new Set(sel.entfernen.map(norm));
      t.packen = t.packen.filter((y) => !rm.has(norm(y.text)));
      t.todo = t.todo.filter((y) => !rm.has(norm(y.text)));
    }
  });
  // fehlende Koordinaten im Hintergrund nachschlagen
  (async () => {
    await locateTrip(tripId);
    for (const id of added.stops) await locateEntry(tripId, 'stops', id);
    for (const id of added.places) await locateEntry(tripId, 'places', id);
  })();
}
