// Reisen: Ideen sammeln („Wohin könnte ich?“) und festgelegte Reisen mit Vorlage planen
// (Stationen, Transport, Orte auf der Karte, Unterlagen, To-dos und Packliste nach Kategorien, KI-Planer)
import { store, uid } from './store';
import { fmtLong, today } from './dates';
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
export async function locateEntry(tripId, list, id) {
  const tr = store.get().trips.find((x) => x.id === tripId);
  const e = tr?.[list].find((x) => x.id === id);
  if (!e || e.lat != null) return;
  const stop = list === 'places' ? tr.stops.find((x) => x.id === e.stopId) : null;
  const where = stop?.name || tr.dest;
  const tries = [e.address && `${e.address}`, `${e.name}, ${where}`, list === 'stops' && e.name].filter(Boolean);
  for (const q of tries) {
    const r = await geocodeWorld(q);
    if (r) return updateEntry(tripId, list, id, r);
  }
}

// ---------- KI: Wohin könnte ich? ----------
const INSPIRE_TOOL = {
  name: 'ziele_zeigen',
  description: 'Gibt Reiseziel-Ideen zurück.',
  input_schema: {
    type: 'object',
    properties: {
      ziele: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ziel: { type: 'string', description: 'Ort/Region, z.B. „Florianópolis“' },
            land: { type: 'string' },
            warum: { type: 'string', description: '1–2 Sätze, warum es zu Mateo und dem Wunsch passt' },
            dauer: { type: 'string', description: 'Empfohlene Dauer, z.B. „4–5 Tage“' },
            anreise: { type: 'string', description: 'Wie kommt man von Buenos Aires hin, ca. Dauer und Preis' },
            beste_zeit: { type: 'string' },
            budget: { type: 'string', description: 'grobe Kosten pro Person' },
            url: { type: 'string', description: 'Link aus den Suchergebnissen, nie erfinden' },
          },
          required: ['ziel', 'warum'],
        },
      },
    },
    required: ['ziele'],
  },
};
export async function tripInspiration(s, wish) {
  const known = s.trips.map((x) => x.name);
  const system = `Du bist Mateos Reise-Scout. Er lebt in Buenos Aires. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Schon auf seiner Liste (nicht wiederholen): ${JSON.stringify(known)}
Suche höchstens 3-mal und schlage 4–6 abwechslungsreiche Ziele vor (gern ein überraschendes dabei), passend zu seinem Wunsch, Reisezeit und Anreise ab Buenos Aires. Gib sie mit "ziele_zeigen" zurück. Deutsch, konkret, kurz.`;
  const r = await searchWithTool({ system, user: wish || 'Wohin könnte ich als Nächstes reisen?', tool: INSPIRE_TOOL, maxUses: 3 });
  return (r.ziele || []).map((z) => ({ ...z, id: uid(), url: okUrl(z.url) }));
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
    },
    required: ['antwort'],
  },
};
export const tripSnapshot = (tr) => ({
  name: tr.name, ziel: tr.dest, status: tr.status === 'idee' ? 'Idee (noch nicht festgelegt)' : 'festgelegt', von: tr.from, bis: tr.to, idee: tr.idea || undefined, budget: tr.budget ? `${tr.budget} ${tr.currency}` : undefined,
  stationen: tr.stops.map((x) => ({ name: x.name, von: x.from, bis: x.to })),
  transport: tr.transport.map((x) => `${x.from} → ${x.to} (${MODES[x.mode] || x.mode}${x.status === 'gebucht' ? ', gebucht' : ''})`),
  orte: tr.places.map((x) => `${x.name} (${PLACE_KINDS[x.kind]})`),
  todo: tr.todo.map((x) => x.text), packen: tr.packen.map((x) => x.text), notizen: tr.notes || undefined,
});
export async function tripAssist(s, tr, history) {
  const system = `Du bist Mateos Reiseplaner in der App „Life“. Er lebt in Buenos Aires. Heute ist ${fmtLong(today())}.
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Aktueller Stand der Reise: ${JSON.stringify(tripSnapshot(tr))}
Arbeitsweise:
- ${tr.status === 'idee' ? 'Die Reise ist noch eine Idee: hilf herauszufinden, welche Route/Stationen, Transportwege und Aktivitäten möglich sind, mit groben Kosten und Zeiten.' : 'Die Reise steht: hilf konkret zu planen (Stationen, Transport, Unterkunft, Restaurants, Sehenswürdigkeiten) und die Listen anzupassen.'}
- Suche höchstens 3-mal im Internet für aktuelle Infos (Verbindungen, Preise, Öffnungszeiten, gute Restaurants, Geheimtipps). Links nur aus Suchergebnissen.
- ${tr.status === 'idee' ? 'Packliste und To-dos kommen erst beim Festlegen dazu: schlage dafür noch nichts vor (kein "packen", "todo", "entfernen").' : 'Die Packliste und To-dos haben eine Standard-Vorlage. Passe sie an Ziel, Jahreszeit, Dauer und Aktivitäten an: Fehlendes unter "packen"/"todo", Unpassendes (z.B. Badekleidung bei Winterreise) unter "entfernen".'}
- Nichts vorschlagen, was schon im Stand steht. Bei Orten wenn möglich lat/lon angeben.
- Fehlt Wichtiges (Zeitraum, Budget, Reisestil, wer kommt mit), frag kurz nach – mach trotzdem schon erste Vorschläge.
Antworte immer mit "reise_planen". Deutsch, konkret, kurz.`;
  const messages = history.map((m) => ({ role: m.role, content: m.text }));
  return searchWithTool({ system, messages, tool: PLAN_TOOL, maxUses: 3 });
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
      t.stops.push({ id, name: x.name, from: okDate(x.von), to: okDate(x.bis), note: x.notiz || '', ...(typeof x.lat === 'number' && typeof x.lon === 'number' ? { lat: x.lat, lon: x.lon } : {}) });
      added.stops.push(id);
    }
    for (const x of sel.transport || []) t.transport.push({ id: uid(), from: x.von, to: x.nach, mode: MODES[x.art] ? x.art : 'sonstiges', date: '', time: '', note: [x.dauer, x.preis, x.notiz].filter(Boolean).join(' · '), url: okUrl(x.url), status: 'option' });
    for (const x of sel.orte || []) {
      if (t.places.some((y) => norm(y.name) === norm(x.name))) continue;
      const stop = t.stops.find((y) => norm(y.name) === norm(x.station));
      const id = uid();
      t.places.push({ id, name: x.name, kind: PLACE_KINDS[x.art] ? x.art : 'sonstiges', stopId: stop?.id || '', note: x.notiz || '', address: x.adresse || '', url: okUrl(x.url), status: 'option', ...(typeof x.lat === 'number' && typeof x.lon === 'number' ? { lat: x.lat, lon: x.lon } : {}) });
      added.places.push(id);
    }
    for (const x of sel.todo || []) if (!t.todo.some((y) => norm(y.text) === norm(x.text))) t.todo.push({ id: uid(), text: x.text, cat: x.kategorie || 'Sonstiges', done: false });
    for (const x of sel.packen || []) if (!t.packen.some((y) => norm(y.text) === norm(x.text))) t.packen.push({ id: uid(), text: x.text, cat: x.kategorie || 'Sonstiges', done: false });
    if (sel.entfernen?.length) {
      const rm = new Set(sel.entfernen.map(norm));
      t.packen = t.packen.filter((y) => !rm.has(norm(y.text)));
      t.todo = t.todo.filter((y) => !rm.has(norm(y.text)));
    }
  });
  // fehlende Koordinaten im Hintergrund nachschlagen
  (async () => {
    for (const id of added.stops) await locateEntry(tripId, 'stops', id);
    for (const id of added.places) await locateEntry(tripId, 'places', id);
  })();
}
