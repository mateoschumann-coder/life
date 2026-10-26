// Körperliche Gesundheit: Sportarten & Einheiten, Küche (Rezepte, Einkaufsliste), Vorsorge
import { store, uid } from './store';
import { addDays, fmtLong, today } from './dates';
import { callApi } from './ai';
import { searchWithTool } from './outings';

const now = () => new Date().toISOString();
const norm = (x) => String(x || '').trim().toLowerCase();

// ---------- Sport ----------
export const SPORT_PRESETS = [
  { name: 'Laufen', kind: 'laufen', icon: 'run' },
  { name: 'Krafttraining', kind: 'allgemein', icon: 'dumbbell' },
  { name: 'Radfahren', kind: 'distanz', icon: 'bike' },
  { name: 'Schwimmen', kind: 'distanz', icon: 'swim' },
  { name: 'Fußball', kind: 'allgemein', icon: 'ball' },
  { name: 'Padel', kind: 'allgemein', icon: 'ball' },
  { name: 'Yoga & Dehnen', kind: 'allgemein', icon: 'leaf' },
];
export const hasDistance = (sport) => sport && (sport.kind === 'laufen' || sport.kind === 'distanz');

export function addSport(name) {
  const t = String(name || '').trim();
  if (!t) return null;
  const preset = SPORT_PRESETS.find((p) => norm(p.name) === norm(t));
  const exists = store.get().sports.find((x) => norm(x.name) === norm(t));
  if (exists) return exists.id;
  const id = uid();
  store.update((s) => {
    s.sports.push({ id, name: preset?.name || t, kind: preset?.kind || 'allgemein', icon: preset?.icon || 'heart', goal: '', createdAt: now() });
  });
  return id;
}
export function updateSport(id, patch) {
  store.update((s) => Object.assign(s.sports.find((x) => x.id === id) || {}, patch));
}
export function removeSport(id) {
  store.update((s) => {
    s.sports = s.sports.filter((x) => x.id !== id);
  });
}
export const findSport = (s, nameOrId) => s.sports.find((x) => x.id === nameOrId) || s.sports.find((x) => norm(x.name) === norm(nameOrId)) || s.sports.find((x) => norm(nameOrId).includes(norm(x.name)) || norm(x.name).includes(norm(nameOrId)));

// Zeit „1:05:30“ / „55:20“ / „55“ → Minuten
export function parseDuration(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const parts = String(v).trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return parts[0];
}
export function fmtDuration(min) {
  if (!min && min !== 0) return '';
  const total = Math.round(min * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
export const fmtPace = (minPerKm) => (minPerKm ? `${fmtDuration(minPerKm)} /km` : '');

export function addSession({ sportId, date = today(), distance = null, duration = null, hr = null, notes = '', source = 'manuell', ext = null }) {
  if (!sportId) return null;
  const id = uid();
  store.update((s) => {
    if (ext && s.sessions.some((x) => x.ext === ext)) return; // Import: nichts doppelt
    s.sessions.push({ id, sportId, date, distance: distance ? Number(distance) : null, duration: duration ? Number(duration) : null, hr: hr ? Number(hr) : null, notes, source, ext, createdAt: now() });
    const area = s.areas.find((a) => a.id === 'koerper');
    if (area) s.activities.push({ id: uid(), areaId: 'koerper', date, note: '' });
  });
  return id;
}
export function deleteSession(id) {
  store.update((s) => {
    s.sessions = s.sessions.filter((x) => x.id !== id);
  });
}

// Garmin-Export (CSV aus Garmin Connect → Aktivitäten → „CSV exportieren“), englisch oder deutsch
export function parseGarminCsv(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some((x) => x !== '')) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => norm(h));
  const col = (...names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const iType = col('activity type', 'aktivitätstyp', 'aktivitätsart');
  const iDate = col('date', 'datum');
  const iDist = col('distance', 'distanz', 'strecke');
  const iTime = col('time', 'zeit', 'dauer');
  const iHr = col('avg hr', 'ø herzfrequenz', 'durchschnittliche herzfrequenz', 'ø hf');
  const iTitle = col('title', 'titel');
  if (iDate < 0) return [];
  return rows.slice(1).map((r) => {
    const date = (r[iDate] || '').slice(0, 10);
    const dist = parseFloat(String(r[iDist] || '').replace(/\./g, (m, o, str) => (str.includes(',') ? '' : '.')).replace(',', '.'));
    return {
      type: r[iType] || '',
      title: r[iTitle] || '',
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      distance: isNaN(dist) ? null : dist,
      duration: parseDuration(r[iTime]),
      hr: parseInt(r[iHr], 10) || null,
      ext: `garmin:${r[iDate]}:${r[iType]}`,
    };
  }).filter((x) => x.date);
}
// Garmin-Aktivitätstyp → Sportart
export function guessSportName(type) {
  const t = norm(type);
  if (/lauf|run|trail|treadmill|laufband/.test(t)) return 'Laufen';
  if (/rad|cycl|bike|bik/.test(t)) return 'Radfahren';
  if (/schwimm|swim|pool/.test(t)) return 'Schwimmen';
  if (/kraft|strength|gym/.test(t)) return 'Krafttraining';
  if (/yoga|pilates|stretch|dehn/.test(t)) return 'Yoga & Dehnen';
  return type || 'Sonstiges';
}

export function weekStats(s, sportId, weeks = 12) {
  const t = today();
  const d = new Date(t + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  const start = addDays(t, -dow - (weeks - 1) * 7);
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const from = addDays(start, w * 7);
    const to = addDays(from, 6);
    const list = s.sessions.filter((x) => x.sportId === sportId && x.date >= from && x.date <= to);
    out.push({ date: from, value: Math.round(list.reduce((n, x) => n + (x.distance || 0), 0) * 10) / 10, count: list.length, minutes: list.reduce((n, x) => n + (x.duration || 0), 0) });
  }
  return out;
}

// KI-Analyse einer Sportart (Ziele, Projekte/Rennen, Daten)
const ANALYSE_TOOL = {
  name: 'analyse_geben',
  description: 'Gibt die Trainingsanalyse strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      stand: { type: 'string', description: '2–4 Sätze: Wo steht Mateo gemessen an seinem Ziel?' },
      staerken: { type: 'array', items: { type: 'string' } },
      verbessern: { type: 'array', items: { type: 'string' }, description: 'Konkrete Verbesserungen, je 1 Satz' },
      naechste_einheiten: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, tage_ab_heute: { type: 'integer' } }, required: ['titel'] }, description: '3–5 konkrete nächste Einheiten, z.B. „Langer Lauf 28 km locker“' },
      prognose: { type: 'string', description: 'Optional: realistische Zielzeit-Prognose mit kurzer Begründung' },
    },
    required: ['stand', 'verbessern', 'naechste_einheiten'],
  },
};
export async function analyzeSport(s, sportId) {
  const sport = s.sports.find((x) => x.id === sportId);
  const t = today();
  const sessions = s.sessions.filter((x) => x.sportId === sportId && x.date >= addDays(t, -90)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const data = {
    heute: t,
    sportart: sport.name,
    ziel: sport.goal || undefined,
    projekte_und_rennen: s.projects.filter((p) => p.sportId === sportId && p.status === 'aktiv').map((p) => ({ name: p.name, datum: p.due, zielzeit: p.goalTime })),
    einheiten_90_tage: sessions.map((x) => ({ datum: x.date, km: x.distance, minuten: x.duration ? Math.round(x.duration) : null, pace: x.distance && x.duration ? fmtDuration(x.duration / x.distance) : null, puls: x.hr, notiz: x.notes || undefined })),
    wochen: weekStats(s, sportId, 12),
    verletzungen_aktiv: s.healthItems.filter((h) => h.type === 'verletzung' && h.status !== 'ausgeheilt').map((h) => h.title),
    was_ich_ueber_mateo_weiss: s.memory.map((m) => m.text),
  };
  const system = `Du bist ein erfahrener, ehrlicher ${sport.kind === 'laufen' ? 'Lauftrainer' : 'Trainer'} für Mateo. Heute ist ${fmtLong(t)}. Analysiere seine Daten im Verhältnis zu seinem Ziel und seinen Rennen/Projekten. Sei konkret (Umfang, Tempo, Regeneration, Verletzungsrisiko), motivierend und ohne Floskeln. Wenn Daten fehlen, sag kurz, was dir für eine bessere Analyse helfen würde. Gib das Ergebnis mit dem Werkzeug "analyse_geben" zurück. Deutsch, kein Markdown. Bei Schmerzen/Verletzungen: zur Vorsicht raten und ärztliche Abklärung empfehlen, keine Diagnosen.`;
  const { tools } = await callApi({ max_tokens: 2000, system, tools: [ANALYSE_TOOL], tool_choice: { type: 'tool', name: ANALYSE_TOOL.name }, messages: [{ role: 'user', content: JSON.stringify(data) }] });
  const r = tools.find((c) => c.name === ANALYSE_TOOL.name)?.input || {};
  const result = { date: t, ...r };
  try {
    localStorage.setItem(`life-app-analyse-${sportId}`, JSON.stringify(result));
  } catch {}
  return result;
}
export function lastAnalysis(sportId) {
  try {
    return JSON.parse(localStorage.getItem(`life-app-analyse-${sportId}`) || 'null');
  } catch {
    return null;
  }
}

// ---------- Küche ----------
export const DEFAULT_RECIPE_CATS = ['Airfryer', 'Schnell', 'Meal Prep'];
export function addRecipe({ title, category = 'Airfryer', ingredients = [], steps = '', url = '', minutes = null, note = '' }) {
  if (!String(title || '').trim()) return null;
  const id = uid();
  store.update((s) => {
    if (category && !s.recipeCats.includes(category)) s.recipeCats.push(category);
    s.recipes.push({ id, title: title.trim(), category, ingredients: ingredients.filter(Boolean), steps, url, minutes, note, createdAt: now() });
  });
  return id;
}
export function updateRecipe(id, patch) {
  store.update((s) => Object.assign(s.recipes.find((x) => x.id === id) || {}, patch));
}
export function deleteRecipe(id) {
  store.update((s) => {
    s.recipes = s.recipes.filter((x) => x.id !== id);
  });
}
export function setRecipeCats(list) {
  store.update((s) => {
    s.recipeCats = list;
  });
}

export function addShopping(names) {
  const list = (Array.isArray(names) ? names : [names]).map((n) => String(n || '').trim()).filter(Boolean);
  if (!list.length) return 0;
  let n = 0;
  store.update((s) => {
    list.forEach((name) => {
      if (s.shopping.items.some((x) => !x.done && norm(x.name) === norm(name))) return;
      s.shopping.items = s.shopping.items.filter((x) => !(x.done && norm(x.name) === norm(name)));
      s.shopping.items.push({ id: uid(), name, done: false, addedAt: now() });
      n++;
    });
  });
  return n;
}
export function toggleShopping(id) {
  store.update((s) => {
    const it = s.shopping.items.find((x) => x.id === id);
    if (!it) return;
    it.done = !it.done;
    // Gekauftes merken → später als Vorschlag
    if (it.done) s.shopping.history[norm(it.name)] = { name: it.name, count: (s.shopping.history[norm(it.name)]?.count || 0) + 1, last: today() };
  });
}
export function clearBought() {
  store.update((s) => {
    s.shopping.items = s.shopping.items.filter((x) => !x.done);
  });
}
export function removeShopping(id) {
  store.update((s) => {
    s.shopping.items = s.shopping.items.filter((x) => x.id !== id);
  });
}
export function shoppingSuggestions(s, max = 14) {
  const open = new Set(s.shopping.items.filter((x) => !x.done).map((x) => norm(x.name)));
  return Object.values(s.shopping.history).filter((h) => !open.has(norm(h.name))).sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1)).slice(0, max);
}

const RECIPE_TOOL = {
  name: 'rezepte_zeigen',
  description: 'Gibt gefundene Rezepte strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      rezepte: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string' },
            minuten: { type: 'integer' },
            zutaten: { type: 'array', items: { type: 'string' }, description: 'Mit Mengen, z.B. „2 Hähnchenbrustfilets“' },
            schritte: { type: 'string', description: 'Kurze nummerierte Schritte als Text, mit Temperatur/Zeit beim Airfryer' },
            url: { type: 'string', description: 'Quelle aus den Suchergebnissen, nie erfinden' },
            warum: { type: 'string' },
          },
          required: ['titel', 'zutaten', 'schritte'],
        },
      },
    },
    required: ['rezepte'],
  },
};
export async function findRecipes(s, query, category) {
  const system = `Du findest für Mateo Rezepte${category ? ` (Kategorie: ${category})` : ''}. Er lebt in Buenos Aires (Zutaten sollten dort leicht zu bekommen sein).
Was du über ihn weißt: ${JSON.stringify(s.memory.map((m) => m.text))}
Seine Rezepte (nicht wiederholen): ${JSON.stringify(s.recipes.map((r) => r.title))}
Suche höchstens 2-mal im Internet und gib dann mit "rezepte_zeigen" 3 bis 5 alltagstaugliche Rezepte zurück, auf Deutsch, mit Zutaten (mit Mengen für 2 Portionen) und kurzen Schritten.`;
  const input = await searchWithTool({ system, user: `Suche: ${query}`, tool: RECIPE_TOOL, maxUses: 2 });
  return (input.rezepte || []).filter((r) => r && r.titel).map((r, i) => ({
    id: 'r' + i + Date.now().toString(36),
    title: r.titel, minutes: r.minuten || null, ingredients: r.zutaten || [], steps: r.schritte || '', url: /^https?:\/\//.test(r.url || '') ? r.url : '', why: r.warum || '', category: category || 'Airfryer', temp: true,
  }));
}

// ---------- Vorsorge ----------
// type: termin (einmalig mit Datum) · routine (alle X Monate) · verletzung (mit Status)
export function addHealthItem({ title, type = 'termin', date = null, everyMonths = null, notes = '' }) {
  if (!String(title || '').trim()) return null;
  const id = uid();
  store.update((s) => {
    s.healthItems.push({ id, title: title.trim(), type, date, everyMonths: everyMonths ? Number(everyMonths) : null, notes, status: type === 'verletzung' ? 'aktiv' : 'offen', log: [], createdAt: now() });
  });
  return id;
}
export function updateHealthItem(id, patch) {
  store.update((s) => Object.assign(s.healthItems.find((x) => x.id === id) || {}, patch));
}
export function deleteHealthItem(id) {
  store.update((s) => {
    s.healthItems = s.healthItems.filter((x) => x.id !== id);
  });
}
const addMonths = (k, n) => {
  const d = new Date(k + 'T12:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
// Routine/Termin als erledigt markieren; Routinen rücken automatisch weiter
export function doneHealthItem(id) {
  store.update((s) => {
    const h = s.healthItems.find((x) => x.id === id);
    if (!h) return;
    h.log = [...(h.log || []), today()];
    if (h.type === 'routine' && h.everyMonths) h.date = addMonths(today(), h.everyMonths);
    else h.status = 'erledigt';
  });
}
export function healthDue(s, day, within = 0) {
  return s.healthItems.filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt' && h.date && h.date <= addDays(day, within));
}
