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
export function sportData(s, sportId) {
  const sport = s.sports.find((x) => x.id === sportId);
  const t = today();
  const sessions = s.sessions.filter((x) => x.sportId === sportId && x.date >= addDays(t, -90)).sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    heute: t,
    sportart: sport.name,
    ziel: sport.goal || undefined,
    projekte_und_rennen: s.projects.filter((p) => p.sportId === sportId && p.status === 'aktiv').map((p) => ({ name: p.name, datum: p.due, zielzeit: p.goalTime })),
    einheiten_90_tage: sessions.map((x) => ({ datum: x.date, km: x.distance, minuten: x.duration ? Math.round(x.duration) : null, pace: x.distance && x.duration ? fmtDuration(x.duration / x.distance) : null, puls: x.hr, notiz: x.notes || undefined })),
    wochen: weekStats(s, sportId, 12),
    verletzungen_aktiv: s.healthItems.filter((h) => h.type === 'verletzung' && h.status !== 'ausgeheilt').map((h) => h.title),
    was_ich_ueber_mateo_weiss: s.memory.map((m) => m.text),
    events: (s.sportEvents || []).filter((e) => e.sportId === sportId).map((e) => ({ name: e.name, datum: e.date, status: e.status, ergebnis: e.result || undefined })),
  };
}
export async function analyzeSport(s, sportId) {
  const sport = s.sports.find((x) => x.id === sportId);
  const t = today();
  const sessions = s.sessions.filter((x) => x.sportId === sportId && x.date >= addDays(t, -90)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const data = sportData(s, sportId);

  const system = `Du bist ein erfahrener, ehrlicher ${sport.kind === 'laufen' ? 'Lauftrainer' : 'Trainer'} für Mateo. Heute ist ${fmtLong(t)}. Analysiere seine Daten im Verhältnis zu seinem Ziel und seinen Rennen/Projekten. Sei konkret (Umfang, Tempo, Regeneration, Verletzungsrisiko), motivierend und ohne Floskeln. Wenn Daten fehlen, sag kurz, was dir für eine bessere Analyse helfen würde. Gib das Ergebnis mit dem Werkzeug "analyse_geben" zurück. Deutsch, kein Markdown. Bei Schmerzen/Verletzungen: zur Vorsicht raten und ärztliche Abklärung empfehlen, keine Diagnosen.`;
  const { tools } = await callApi({ max_tokens: 2000, system, tools: [ANALYSE_TOOL], tool_choice: { type: 'tool', name: ANALYSE_TOOL.name }, messages: [{ role: 'user', content: JSON.stringify(data) }] }, 'Sport-Analyse');
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

// Einkaufs-Kategorien (v0.88, Mateos Liste): Hauptgruppe → Unterkategorie → Katalog-Artikel (zum Antippen).
// Zuordnung freier Einträge per Stichwort (Deutsch/Spanisch/Englisch) + Katalog-Namen; von Hand geänderte Zuordnung
// wird pro Artikel gemerkt (s.shopping.catMap). Artikel mit „?“ am Ende sind optional (im Katalog heller).
export const SHOP_GROUPS = [
  { id: 'essen', label: 'Essen', emoji: '🍽' },
  { id: 'kueche', label: 'Küchenartikel', emoji: '🍳' },
  { id: 'bad', label: 'Badeartikel', emoji: '🧴' },
  { id: 'anderes', label: 'Anderes', emoji: '📦' },
];
export const SHOP_CATS = [
  { id: 'obst', group: 'essen', label: 'Obst', emoji: '🍎', items: 'Äpfel|Bananen|Zitronen|Limetten|Orangen|Mandarinen/Clementinen|Birnen?|Weintrauben?|Erdbeeren?|Heidelbeeren?|Himbeeren?|Kiwi?|Mango?|Ananas?|Melone?|Grapefruit?|Granatapfel?|Kaki (Persimone)?|Avocados|Beeren (TK oder Import)?', words: 'apfel äpfel banane birne orange zitrone limette traube beere erdbeere heidelbeere himbeere mango ananas kiwi melone avocado mandarine clementine grapefruit kaki granatapfel obst manzana banana pera naranja limón mandarina pomelo uva frutilla fresa arándano palta kiwi granada fruta fruit' },
  { id: 'salat', group: 'essen', label: 'Gemüse – Salate', emoji: '🥬', items: 'Eisbergsalat|Kopfsalat|Mischsalat|Rucola|Feldsalat?|Spinat (frisch)?|Babyspinat?|Römersalat?|Radicchio?', words: 'salat rucola spinat feldsalat eisberg lechuga rúcula espinaca' },
  { id: 'gemuese', group: 'essen', label: 'Gemüse – Anderes', emoji: '🥕', items: 'Tomaten|Kirschtomaten|Gurken|Paprika (rot/gelb/grün)|Zwiebeln|Rote Zwiebeln|Knoblauch|Kartoffeln|Süßkartoffeln?|Karotten|Zucchini|Brokkoli|Blumenkohl?|Champignons|Lauch?|Frühlingszwiebeln|Sellerie?|Aubergine?|Mais (Kolben)?|Kürbis?|Ingwer|Petersilie|Basilikum|Schnittlauch?|Koriander?|Minze?', words: 'tomate tomaten gurke gurken paprika zwiebel zwiebeln knoblauch kartoffel kartoffeln süßkartoffel karotte karotten möhre brokkoli zucchini aubergine pilz pilze champignon lauch sellerie kürbis mais kräuter petersilie basilikum ingwer gemüse pepino morrón cebolla ajo papa batata zanahoria brócoli zapallito berenjena hongo champiñón puerro apio calabaza choclo perejil albahaca jengibre verdura vegetable' },
  { id: 'fleisch', group: 'essen', label: 'Fleisch & Fisch', emoji: '🥩', items: 'Hähnchenbrust|Hähnchenschenkel?|Hackfleisch (Rind)|Hackfleisch (gemischt)?|Rindersteak?|Schweinefilet?|Schnitzel?|Bratwurst?|Lachs|Fischfilets (z. B. Kabeljau)?|Thunfisch (frisch)?|Garnelen?', words: 'fleisch hähnchen hähnchenbrust huhn hühnchen pute rind hack hackfleisch steak schwein schinken salami wurst speck lachs kabeljau thunfisch fisch fischfilet garnele garnelen shrimp carne pollo pechuga milanesa bife vacío asado cerdo jamón salame chorizo panceta salmón atún pescado langostino chicken beef' },
  { id: 'aufschnitt', group: 'essen', label: 'Wurst & Aufschnitt', emoji: '🥓', items: 'Kochschinken|Salami|Putenbrust (Aufschnitt)|Schinken (roh)?|Leberwurst?|Wiener Würstchen?|Speck / Bacon|Chorizo?', words: 'schinken kochschinken salami aufschnitt leberwurst würstchen wiener speck bacon mortadella jamón salame fiambre panceta' },
  { id: 'veggie', group: 'essen', label: 'Vegetarische Proteine & Hülsenfrüchte', emoji: '🫘', items: 'Tofu|Kichererbsen|Rote Linsen|Schwarze Bohnen|Kidneybohnen|Weiße Bohnen?|Hummus|Falafel?|Tempeh?|Edamame?', words: 'kichererbsen bohnen linsen tofu tempeh seitan hummus garbanzos porotos lentejas' },
  { id: 'milch', group: 'essen', label: 'Milchalternativen, Milchprodukte & Eier', emoji: '🥛', items: 'Milch|Hafermilch|Butter|Eier|Naturjoghurt|Griechischer Joghurt|Quark|Skyr?|Sahne|Schmand / Saure Sahne?|Frischkäse|Gouda (Scheiben)|Mozzarella|Parmesan|Feta|Emmental (gerieben)|Halloumi?|Ricotta?', words: 'milch hafermilch mandelmilch sojamilch joghurt quark käse butter sahne frischkäse mozzarella parmesan feta skyr kefir ei eier leche yogur queso manteca crema huevo huevos ricota cheese egg' },
  { id: 'brot', group: 'essen', label: 'Brot & Backwaren', emoji: '🥖', items: 'Toastbrot|Vollkornbrot|Brötchen|Baguette?|Wraps / Tortillas|Knäckebrot?|Fladenbrot?|Croissants?|Medialunas?', words: 'brot brötchen toast baguette croissant wrap tortilla fladenbrot pan tostada medialuna factura pita bagel' },
  { id: 'pasta', group: 'essen', label: 'Pasta & Reis', emoji: '🍝', items: 'Spaghetti|Penne|Fusilli?|Lasagneplatten?|Reis (Basmati)|Reis (Jasmin)?|Risottoreis?|Couscous?|Bulgur?|Quinoa?|Gnocchi?|Mie-Nudeln?', words: 'nudeln pasta spaghetti penne reis quinoa couscous fideos arroz' },
  { id: 'vorrat', group: 'essen', label: 'Vorratsprodukte & Konserven', emoji: '🥫', items: 'Stückige Tomaten (Dose)|Passierte Tomaten|Tomatenmark|Kokosmilch|Mais (Dose)|Thunfisch (Dose)|Kichererbsen (Dose)|Gemüsebrühe|Hühnerbrühe?|Oliven?|Getrocknete Tomaten?|Gurken (Glas)?|Erdnussbutter|Nüsse (Mandeln, Walnüsse)', words: 'dose konserve tomatenmark kokosmilch mehl zucker brühe passata lata harina azúcar caldo' },
  { id: 'backen', group: 'essen', label: 'Backen', emoji: '🧁', items: 'Mehl|Zucker|Brauner Zucker?|Puderzucker?|Backpulver|Trockenhefe?|Vanillezucker?|Speisestärke|Kakaopulver?|Schokotropfen?|Haferflocken', words: 'mehl zucker backpulver hefe trockenhefe vanillezucker speisestärke kakao puderzucker harina azúcar levadura' },
  { id: 'wuerze', group: 'essen', label: 'Gewürze & Würzmittel', emoji: '🧂', items: 'Salz|Pfeffer|Olivenöl|Sonnenblumenöl / Rapsöl|Balsamico-Essig|Weißweinessig?|Senf|Ketchup|Mayonnaise|Sojasauce|Sriracha / Chili-Sauce?|Paprikapulver (edelsüß)|Paprika geräuchert?|Currypulver|Kreuzkümmel?|Oregano|Thymian?|Chiliflocken|Zimt|Muskat?|Honig|Pesto?', words: 'öl olivenöl essig salz pfeffer gewürz paprikapulver curry zimt senf ketchup mayo mayonnaise sojasauce sauce soße pesto aceite vinagre sal pimienta especia mostaza salsa' },
  { id: 'fruehstueck', group: 'essen', label: 'Frühstück & Aufstriche', emoji: '🥣', items: 'Müsli/Granola|Haferflocken|Cornflakes?|Marmelade|Honig|Nutella / Nussnougatcreme?|Erdnussbutter|Dulce de leche?|Kaffee (Bohnen/gemahlen)|Tee|Mate (Yerba)?', words: 'müsli granola haferflocken cornflakes honig marmelade erdnussbutter nutella aufstrich avena miel mermelada dulce de leche' },
  { id: 'snacks', group: 'essen', label: 'Snacks & Süßes', emoji: '🍫', items: 'Chips|Salzstangen|Erdnüsse|Popcorn?|Schokolade|Kekse|Gummibärchen?|Müsliriegel|Proteinriegel?|Reiswaffeln?|Alfajores?|Eis (Eiscreme)?', words: 'schokolade chips nüsse mandeln kekse riegel proteinriegel gummibärchen popcorn salzstangen cracker chocolate galletitas galletas maní almendras nueces barrita alfajor snack' },
  { id: 'getraenke', group: 'essen', label: 'Getränke', emoji: '🥤', items: 'Mineralwasser (mit Kohlensäure)|Mineralwasser (still)|Orangensaft|Apfelsaft?|Cola / Cola Zero|Limonade?|Bier|Wein (rot)?|Wein (weiß)?|Sekt?|Eistee?|Energydrink?|Tonic Water?', words: 'wasser mineralwasser saft cola bier wein sprudel limonade kaffee tee mate yerba energy agua jugo gaseosa cerveza vino café té soda fernet' },
  { id: 'tk', group: 'essen', label: 'Tiefkühl', emoji: '🧊', items: 'TK-Beeren|TK-Erbsen|TK-Spinat?|TK-Gemüsemischung|TK-Kräuter?|TK-Pizza|Pommes (TK)|Fischstäbchen?|Eiswürfel?|Speiseeis?', words: 'tiefkühl tk gefroren pizza eis eiscreme congelado helado' },
  { id: 'lagern', group: 'kueche', label: 'Lagerung & Zubereitung', emoji: '🥡', items: 'Frischhaltedosen|Frischhaltefolie|Alufolie|Backpapier|Gefrierbeutel|Zip-Beutel?|Küchenrolle|Servietten?', words: 'frischhaltedosen frischhaltefolie alufolie backpapier gefrierbeutel dosen tupper papel aluminio film' },
  { id: 'reinigung', group: 'kueche', label: 'Reinigung', emoji: '🧽', items: 'Spülmittel|Spülmaschinen-Tabs|Spülschwämme|Allzweckreiniger|Glasreiniger?|Badreiniger|WC-Reiniger|Entkalker?|Müllbeutel|Waschmittel|Weichspüler?|Fleckentferner?|Putztücher / Mikrofasertücher', words: 'spülmittel waschmittel müllbeutel schwamm putzmittel küchenrolle spültabs weichspüler detergente lavandina esponja bolsas residuos' },
  { id: 'koerper', group: 'bad', label: 'Körperpflege', emoji: '🧼', items: 'Duschgel|Shampoo|Spülung?|Seife / Handseife|Deo|Rasierklingen|Rasierschaum/-gel|Bodylotion|Gesichtscreme?|Sonnencreme|Lippenpflege?|Haargel / Wachs?', words: 'shampoo duschgel seife deo rasierer rasierklingen creme bodylotion sonnencreme haargel desodorante jabón champú' },
  { id: 'zahn', group: 'bad', label: 'Zahnpflege', emoji: '🪥', items: 'Zahnpasta|Zahnbürste|Zahnseide|Mundspülung?|Aufsteckbürsten (elektrisch)?', words: 'zahnpasta zahnbürste zahnseide mundspülung pasta dental cepillo' },
  { id: 'hygiene', group: 'bad', label: 'Hygiene', emoji: '🧻', items: 'Toilettenpapier|Feuchttücher|Wattestäbchen|Wattepads?|Taschentücher (Box)?|Pflaster|Kopfschmerztabletten?|Nagelschere?', words: 'feuchttücher wattestäbchen klopapier toilettenpapier wattepads papel higiénico' },
  { id: 'papier', group: 'anderes', label: 'Papierwaren', emoji: '🗒', items: 'Taschentücher|Küchenrolle?|Servietten?|Druckerpapier?', words: 'taschentücher servietten pañuelos servilletas' },
  { id: 'buero', group: 'anderes', label: 'Bürobedarf & Schreibwaren', emoji: '✏️', items: 'Stifte (Kuli, Marker)|Notizblock|Post-its?|Klebeband|Briefumschläge?|Batterien für Maus?', words: 'stifte kuli kugelschreiber marker papier block heft lapicera cuaderno' },
  { id: 'technik', group: 'anderes', label: 'Technik & Sonstiges', emoji: '🔋', items: 'Batterien (AA/AAA)|Glühbirnen / LED|Ladekabel (USB-C)?|Mehrfachsteckdose?|Kerzen?|Feuerzeug / Streichhölzer?', words: 'batterien batterie glühbirne glühbirnen kabel ladekabel pilas lamparita' },
  { id: 'sonstiges', group: 'anderes', label: 'Sonstiges', emoji: '🛒', items: '', words: '' },
];
const LEGACY_CAT = { drogerie: 'koerper', obst: 'obst' };
const catalogOf = (c) => (c.items ? c.items.split('|') : []).map((x) => ({ name: x.replace(/\?$/, ''), optional: x.endsWith('?') }));

// v0.89: Struktur bearbeitbar – s.shopping.structure = { groups: [{id,label,emoji}], cats: [{id,group,label,emoji,items:[{name,optional}]}] }
// Fehlt sie, gilt der Standard (Mateos Liste) + eigene Katalog-Artikel aus älteren Versionen (s.shopping.catalog).
const defaultStructure = (s) => ({
  v90: true,
  groups: SHOP_GROUPS.map((g) => ({ ...g })),
  cats: SHOP_CATS.map((c) => ({ id: c.id, group: c.group, label: c.label, emoji: c.emoji, items: [...catalogOf(c), ...((s?.shopping?.catalog?.[c.id]) || []).map((name) => ({ name, optional: false }))] })),
});
// v0.90: neue Standard-Artikel und -Unterkategorien einmalig in eine schon bearbeitete Struktur übernehmen
const NEW_V90 = ['aufschnitt', 'backen'];
function withDefaults90(st) {
  const out = JSON.parse(JSON.stringify(st));
  for (const c of SHOP_CATS) {
    let ex = out.cats.find((x) => x.id === c.id);
    if (!ex) {
      if (!NEW_V90.includes(c.id)) continue; // selbst gelöschte Unterkategorien nicht zurückholen
      const g = out.groups.find((x) => x.id === c.group) || out.groups[0];
      ex = { id: c.id, group: g.id, label: c.label, emoji: c.emoji, items: [] };
      const after = out.cats.findIndex((x) => x.id === (c.id === 'aufschnitt' ? 'fleisch' : 'vorrat'));
      out.cats.splice(after >= 0 ? after + 1 : out.cats.length, 0, ex);
    }
    for (const it of catalogOf(c)) if (!ex.items.some((x) => norm(x.name) === norm(it.name))) ex.items.push(it);
  }
  out.v90 = true;
  return out;
}
export function shopStructure(s) {
  let st = s?.shopping?.structure;
  if (st && st.groups?.length && !st.v90) {
    st = withDefaults90(st);
    setTimeout(() => store.update((x) => { if (x.shopping.structure && !x.shopping.structure.v90) x.shopping.structure = withDefaults90(x.shopping.structure); }), 0);
  }
  const base = st && st.groups?.length ? { v90: !!st.v90, groups: st.groups, cats: st.cats || [] } : defaultStructure(s);
  if (!base.cats.some((c) => c.id === 'sonstiges')) base.cats = [...base.cats, { id: 'sonstiges', group: base.groups[base.groups.length - 1]?.id, label: 'Sonstiges', emoji: '🛒', items: [] }];
  return base;
}
// geordnete Kategorien (nach Gruppen-Reihenfolge), „Sonstiges“ immer zuletzt
export function shopCats(s) {
  const st = shopStructure(s);
  const order = st.groups.map((g) => g.id);
  const cats = st.cats.filter((c) => c.id !== 'sonstiges');
  return [...order.flatMap((g) => cats.filter((c) => c.group === g)), ...cats.filter((c) => !order.includes(c.group)), st.cats.find((c) => c.id === 'sonstiges')];
}
const editStructure = (fn) => store.update((s) => {
  const st = JSON.parse(JSON.stringify(shopStructure(s)));
  fn(st);
  s.shopping.structure = st;
  delete s.shopping.catalog;
});
const sid = () => `x${uid().slice(0, 8)}`;
const move = (list, i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; };
export const shopEdit = {
  addGroup: (label) => editStructure((st) => { const l = String(label || '').trim(); if (l) st.groups.push({ id: sid(), label: l, emoji: '📦' }); }),
  updateGroup: (id, patch) => editStructure((st) => Object.assign(st.groups.find((g) => g.id === id) || {}, patch)),
  removeGroup: (id) => editStructure((st) => {
    if (st.groups.length <= 1) return;
    st.groups = st.groups.filter((g) => g.id !== id);
    st.cats = st.cats.filter((c) => c.group !== id || c.id === 'sonstiges');
    st.cats.forEach((c) => { if (c.group === id) c.group = st.groups[st.groups.length - 1].id; });
  }),
  moveGroup: (id, d) => editStructure((st) => move(st.groups, st.groups.findIndex((g) => g.id === id), d)),
  addCat: (group, label) => { let id = null; editStructure((st) => { const l = String(label || '').trim(); if (!l) return; id = sid(); st.cats.push({ id, group, label: l, emoji: '🛒', items: [] }); }); return id; },
  updateCat: (id, patch) => editStructure((st) => Object.assign(st.cats.find((c) => c.id === id) || {}, patch)),
  removeCat: (id) => editStructure((st) => { if (id !== 'sonstiges') st.cats = st.cats.filter((c) => c.id !== id); }),
  moveCat: (id, d) => editStructure((st) => {
    const c = st.cats.find((x) => x.id === id);
    if (!c) return;
    const same = st.cats.filter((x) => x.group === c.group);
    const i = same.indexOf(c);
    const other = same[i + d];
    if (!other) return;
    const a = st.cats.indexOf(c);
    const b = st.cats.indexOf(other);
    [st.cats[a], st.cats[b]] = [st.cats[b], st.cats[a]];
  }),
  addItem: (catId, name) => editStructure((st) => { const n = String(name || '').trim(); const c = st.cats.find((x) => x.id === catId); if (n && c && !c.items.some((x) => norm(x.name) === norm(n))) c.items.push({ name: n, optional: false }); }),
  removeItem: (catId, name) => editStructure((st) => { const c = st.cats.find((x) => x.id === catId); if (c) c.items = c.items.filter((x) => norm(x.name) !== norm(name)); }),
  toggleOptional: (catId, name) => editStructure((st) => { const it = st.cats.find((x) => x.id === catId)?.items.find((x) => norm(x.name) === norm(name)); if (it) it.optional = !it.optional; }),
  reset: () => store.update((s) => { delete s.shopping.structure; }),
};
// Katalog einer Kategorie
export const shopCatalog = (s, catId) => (shopStructure(s).cats.find((c) => c.id === catId)?.items || []);
export const addCatalogItem = (catId, name) => {
  shopEdit.addItem(catId, name);
  store.update((s) => { s.shopping.catMap = { ...(s.shopping.catMap || {}), [norm(name)]: catId }; });
};
export const removeCatalogItem = (catId, name) => shopEdit.removeItem(catId, name);
const ITEM_CAT = Object.fromEntries(SHOP_CATS.flatMap((c) => catalogOf(c).map((x) => [norm(x.name), c.id])));
const WORDS = SHOP_CATS.map((c) => [c.id, c.words.split(' ').filter(Boolean)]);
export function guessShopCat(name) {
  const n = norm(name);
  if (ITEM_CAT[n]) return ITEM_CAT[n];
  const toks = n.split(/[^a-zäöüßñáéíóú]+/).filter(Boolean);
  if (toks.length > 1 && WORDS.find(([, ws]) => ws.includes(n))) return WORDS.find(([, ws]) => ws.includes(n))[0]; // ganze Wortgruppe, z.B. „papel higiénico“
  for (const [id, ws] of WORDS) if (ws.some((w) => toks.includes(w))) return id;
  // längster Wortteil gewinnt (Erdnussbutter → Aufstrich statt Butter)
  let best = null;
  for (const [id, ws] of WORDS) for (const w of ws) if (w.length > 3 && n.includes(w) && (!best || w.length > best[1])) best = [id, w.length];
  if (best) return best[0];
  return 'sonstiges';
}
export function shopCatOf(s, it) {
  const cats = shopStructure(s).cats;
  const has = (c) => c && cats.some((x) => x.id === c);
  const valid = (c) => (has(c) ? c : has(LEGACY_CAT[c]) ? LEGACY_CAT[c] : null);
  const n = norm(it.name);
  const inCatalog = cats.find((c) => c.items.some((x) => norm(x.name) === n))?.id;
  const guess = guessShopCat(it.name);
  return valid(it.cat) || valid(s.shopping.catMap?.[n]) || inCatalog || (has(guess) ? guess : 'sonstiges');
}
export function setShoppingCat(id, cat) {
  store.update((s) => {
    const it = s.shopping.items.find((x) => x.id === id);
    if (!it) return;
    it.cat = cat;
    s.shopping.catMap = { ...(s.shopping.catMap || {}), [norm(it.name)]: cat };
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
export async function findRecipes(s, query, category, { web = false } = {}) {
  const system = `Du findest für Mateo Rezepte${category ? ` (Kategorie: ${category})` : ''}. Er lebt in Buenos Aires (Zutaten sollten dort leicht zu bekommen sein).
Was du über ihn weißt: ${JSON.stringify(s.memory.map((m) => m.text))}
Seine Rezepte (nicht wiederholen): ${JSON.stringify(s.recipes.map((r) => r.title))}
${web ? 'Suche höchstens 1-mal im Internet (eine gezielte Suche, z.B. auf Spanisch oder Englisch); url nur aus den Suchergebnissen.' : 'Ohne Internet: aus deinem Wissen, erprobte Rezepte mit realistischen Mengen, Zeiten und Temperaturen. Keine URLs.'}
Gib mit "rezepte_zeigen" 3 bis 5 alltagstaugliche Rezepte zurück, auf Deutsch, mit Zutaten (mit Mengen für 2 Portionen) und kurzen Schritten.`;
  const input = await searchWithTool({ system, user: `Suche: ${query}`, tool: RECIPE_TOOL, maxUses: web ? 1 : 0, label: web ? 'Rezepte (Internet)' : 'Rezepte (KI)' });
  return (input.rezepte || []).filter((r) => r && r.titel).map((r, i) => toRecipe(r, i, category));
}
const toRecipe = (r, i, category) => ({
  id: 'r' + i + Date.now().toString(36),
  title: r.titel, minutes: r.minuten || null, ingredients: r.zutaten || [], steps: r.schritte || '', url: /^https?:\/\//.test(r.url || '') ? r.url : '', why: r.warum || '', category: category || 'Airfryer', temp: true,
});

// Küchen-Chat: Was koche ich? Was kaufe ich ein? → Rezepte speichern, Einkaufsliste ergänzen
const KITCHEN_TOOL = {
  name: 'kueche_antwort',
  description: 'Antwort plus Rezepte und Einkaufsliste zum Übernehmen.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Antwort (2–8 Sätze), gern mit Rückfrage' },
      rezepte: RECIPE_TOOL.input_schema.properties.rezepte,
      einkaufen: { type: 'array', items: { type: 'string' }, description: 'Artikel für die Einkaufsliste, mit Menge' },
    },
    required: ['antwort'],
  },
};
const KITCHEN_MODE = {
  neu: 'Modus „Neues Rezept“: Schlag 2–3 passende Rezepte zu seinem Wunsch vor (unter "rezepte"), fehlende Zutaten unter "einkaufen".',
  kuehlschrank: 'Modus „Aus dem Kühlschrank“: Mateo nennt, was er da hat. Schlag 1–3 Rezepte vor, die vor allem DIESE Zutaten nutzen (Grundzutaten wie Öl, Salz, Gewürze darfst du annehmen); was wirklich fehlt, unter "einkaufen".',
  diktieren: 'Modus „Rezept diktieren“: Mateo erzählt SEIN Rezept (oft per Sprache, ungeordnet). Schreib daraus genau 1 sauberes Rezept unter "rezepte": treffender Titel, Zutaten mit seinen Mengen (eine pro Eintrag), kurze nummerierte Schritte, ungefähre Minuten. Nichts erfinden, nichts Neues vorschlagen; fehlt Wichtiges (z.B. Temperatur), frag kurz nach. Keine "einkaufen".',
};
export async function kitchenChat(s, history, { web = false, smart = false, mode = 'neu', cat = '' } = {}) {
  const system = `Du bist Mateos Küchen-Helfer in der App „Life“ (er lebt in Buenos Aires, kocht gern mit dem Airfryer, trainiert für einen Marathon). Heute ist ${fmtLong(today())}.
Seine Rezepte: ${JSON.stringify(s.recipes.map((r) => `${r.title} (${r.category})`))}
Einkaufsliste offen: ${JSON.stringify(s.shopping.items.filter((x) => !x.done).map((x) => x.name || x.text))}
Was du über ihn weißt: ${JSON.stringify(s.memory.map((m) => m.text))}
${KITCHEN_MODE[mode] || KITCHEN_MODE.neu}${cat ? ` Gewählte Kategorie: ${cat}.` : ''}
Rezepte mit Zutaten (für 2 Portionen, außer beim Diktieren) und kurzen Schritten unter "rezepte"; unter "einkaufen" nichts, was schon auf der Liste steht.
${web ? 'Du darfst höchstens 1-mal im Internet suchen; Links nur aus Suchergebnissen.' : 'Ohne Internet: aus deinem Wissen, keine URLs.'}
Antworte immer mit "kueche_antwort". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: KITCHEN_TOOL, maxUses: web ? 1 : 0, label: 'Küchen-Chat', smart });
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

// ---------- Sport: Events (Rennen, Turniere, Lauftreffs) und Coach-Chat ----------
export const SPORT_EVENT_STATUS = { interessiert: 'Interessiert', angemeldet: 'Angemeldet', dabei: 'Dabei gewesen' };
export function addSportEvent({ sportId, name, date = '', place = '', url = '', note = '', dist = '', status = 'interessiert' }) {
  const n = String(name || '').trim();
  if (!n) return null;
  const s = store.get();
  if ((s.sportEvents || []).some((e) => e.sportId === sportId && norm(e.name) === norm(n))) return null;
  const id = uid();
  store.update((d) => {
    d.sportEvents = d.sportEvents || [];
    d.sportEvents.push({ id, sportId, name: n, date: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : '', place, url: /^https?:\/\//.test(url || '') ? url : '', note, dist, status, result: '' });
  });
  return id;
}
export const updateSportEvent = (id, patch) => store.update((s) => Object.assign((s.sportEvents || []).find((e) => e.id === id) || {}, patch));
export const removeSportEvent = (id) => store.update((s) => { s.sportEvents = (s.sportEvents || []).filter((e) => e.id !== id); });

const SPORT_EVENT_TOOL = {
  name: 'events_zeigen',
  description: 'Gibt passende Sport-Events zurück.',
  input_schema: {
    type: 'object',
    properties: {
      hinweis: { type: 'string' },
      events: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, datum: { type: 'string', description: 'JJJJ-MM-TT, falls bekannt' }, ort: { type: 'string' }, distanz: { type: 'string', description: 'Nur die Distanz(en), ganz kurz, z.B. „21 km“ oder „10/21/42 km“; leer, wenn nicht zutreffend' }, url: { type: 'string', description: 'Nur aus Suchergebnissen, sonst leer' } }, required: ['name'] } },
    },
    required: ['events'],
  },
};
// sportIds: eine oder mehrere Sportarten (leer = alle); jedes Event bekommt seine Sportart
export async function searchSportEvents(s, sportIds, query, { web = false, regions = [], period = '' } = {}) {
  const ids = (Array.isArray(sportIds) ? sportIds : [sportIds]).filter(Boolean);
  const sports = ids.length ? s.sports.filter((x) => ids.includes(x.id)) : s.sports;
  if (!sports.length) throw new Error('Füg zuerst eine Sportart hinzu.');
  const t = today();
  const names = sports.map((x) => x.name);
  const goals = sports.filter((x) => x.goal).map((x) => `${x.name}: ${x.goal}`);
  const where = regions.length ? regions.join(', ') : 'Buenos Aires und Umgebung';
  const named = String(query || '').trim();
  const system = `Du findest für Mateo (lebt in Buenos Aires) Sport-Events: Wettkämpfe, Rennen, Turniere, offene Trainings, Lauftreffs, Clubs. Heute ist ${fmtLong(t)} (${t}).
Sportarten: ${JSON.stringify(names)}${goals.length ? `. Ziele: ${JSON.stringify(goals)}` : ''}.
Region: ${where} – suche nur dort (bei „Argentinien“ im ganzen Land, bei einer Provinz in der ganzen Provinz).
Zeitraum: ${period || 'die nächsten 6 Monate'} (ab heute) – nur Events in diesem Zeitraum.
${named ? `Mateos Suchwunsch: „${named}“. Wenn das wie der Name eines konkreten Rennens/Events klingt, finde GENAU dieses Event zuerst (nächste Ausgabe mit Datum, Ort, Anmelde-Link) und gib es auf jeden Fall als erstes zurück; danach ähnliche Events.` : 'Gib einen möglichst vollständigen Überblick über die kommenden Events in diesem Zeitraum.'}
${web ? 'Suche gezielt, höchstens 4-mal: zuerst nach dem genannten Namen (falls vorhanden), dann Kalender-Seiten mit vielen Terminen (auf Spanisch, z.B. „calendario carreras 2026 2027 <Region>“). Gib nur echte Events aus den Suchergebnissen mit Link zurück.' : 'Ohne Internet: nenne bekannte, regelmäßig stattfindende Events aus deinem Wissen (z.B. jährliche Rennen mit ungefährem Monat), ohne erfundene Daten oder Links; sag im hinweis, dass Mateo für aktuelle Termine „Mit Internet“ wählen kann.'}
Pro Event nur: name, datum, ort (kurz, z.B. Stadt/Viertel), distanz, url – keine Beschreibungen. Gib bis zu 12 Events (bei mehreren Sportarten gemischt) mit "events_zeigen" zurück, sortiert nach Datum – auch solche, die Mateo sich schon gemerkt hat. "sportart" genau wie in der Liste. Deutsch, kurz.`;
  const tool = JSON.parse(JSON.stringify(SPORT_EVENT_TOOL));
  tool.input_schema.properties.events.items.properties.sportart = { type: 'string', enum: names };
  const r = await searchWithTool({ system, user: query || `Welche Events gibt es in den nächsten Monaten (${names.join(', ')})?`, tool, maxUses: web ? 4 : 0, label: 'Sport-Events suchen' });
  return {
    hint: r.hinweis || '',
    events: (r.events || []).filter((e) => e && e.name).map((e, i) => ({
      id: 'se' + i + Date.now().toString(36),
      sportId: (sports.find((x) => norm(x.name) === norm(e.sportart)) || sports[0]).id,
      name: e.name, date: /^\d{4}-\d{2}-\d{2}$/.test(e.datum || '') ? e.datum : '', place: e.ort || '',
      dist: String(e.distanz || '').slice(0, 30), note: '', url: /^https?:\/\//.test(e.url || '') ? e.url : '',
    })),
  };
}

const SPORT_COACH_TOOL = {
  name: 'coach_antwort',
  description: 'Antwort des Trainers plus Vorschläge zum Übernehmen.',
  input_schema: {
    type: 'object',
    properties: {
      antwort: { type: 'string', description: 'Ehrliche, konkrete Antwort (2–8 Sätze), gern mit Rückfrage' },
      einheiten: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string', description: 'z.B. „Langer Lauf 24 km locker (5:30/km)“' }, tage_ab_heute: { type: 'integer' } }, required: ['titel'] }, description: 'Konkrete Trainingseinheiten zum Einplanen' },
      uebungen: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string', description: 'z.B. „15 Min Knie-Stabilisation“' }, warum: { type: 'string' } }, required: ['titel'] }, description: 'Übungen/Videos (Kraft, Mobilität, Dehnen)' },
      events: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, datum: { type: 'string' }, ort: { type: 'string' }, url: { type: 'string' } }, required: ['name'] } },
    },
    required: ['antwort'],
  },
};
export async function sportCoach(s, sportId, history, { web = false, smart = false } = {}) {
  const sport = s.sports.find((x) => x.id === sportId);
  const system = `Du bist Mateos persönlicher ${sport.kind === 'laufen' ? 'Lauftrainer' : `Trainer für ${sport.name}`} in der App „Life“. Heute ist ${fmtLong(today())}.
Seine Daten: ${JSON.stringify(sportData(s, sportId))}
So arbeitest du: ehrlich, konkret (Umfang, Tempo, Regeneration, Verletzungsrisiko), motivierend, ohne Floskeln. Wenn Daten fehlen, frag gezielt nach. Konkrete Einheiten unter "einheiten" (mit Tagen ab heute), Übungen unter "uebungen", passende Events unter "events".
${web ? 'Du darfst höchstens 2-mal im Internet suchen (aktuelle Events, Studien, gute Videos). Links nur aus Suchergebnissen.' : 'Ohne Internet: aus deinem Wissen, keine URLs.'}
Bei Schmerzen/Verletzungen: zur Vorsicht raten und ärztliche Abklärung empfehlen, keine Diagnosen. Antworte immer mit "coach_antwort". Deutsch, kein Markdown.`;
  return searchWithTool({ system, messages: history.map((m) => ({ role: m.role, content: m.text })), tool: SPORT_COACH_TOOL, maxUses: web ? 2 : 0, label: 'Sport-Coach', smart });
}

// Zutat ohne Menge, z.B. „200 g Mehl“ → „Mehl“, „2 EL Olivenöl“ → „Olivenöl“
export function stripQty(x) {
  return String(x || '')
    .replace(/^\s*(ca\.?|etwa|ungefähr)?\s*[\d½¼¾⅓⅔.,/\-–\s]*\s*(kg|g|gr|mg|ml|cl|dl|l|el|tl|msp|tasse[n]?|becher|prise[n]?|stück|stk\.?|bund|dose[n]?|glas|gläser|pck\.?|päckchen|packung(en)?|zehe[n]?|scheibe[n]?|handvoll|cups?|tbsp|tsp|oz|lb)?\.?\s+(?=\S)/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/,.*$/, '')
    .trim();
}

// Rezept aus eingefügtem Text (oder nur einem Link) übernehmen
export async function importRecipe(s, input, category) {
  const text = String(input || '').trim();
  const onlyUrl = /^https?:\/\/\S+$/.test(text);
  const insta = /instagram\.com|tiktok\.com/i.test(text);
  const rules = `Übertrage auf Deutsch: Titel, Zutaten mit Mengen (eine pro Eintrag), kurze nummerierte Schritte, ungefähre Minuten. Mengen so lassen wie im Original (nicht umrechnen). Fehlen Mengen (oft bei Instagram), nimm die Zutaten ohne Mengen. Emojis, Hashtags und Werbung ignorieren. Wenn kein Rezept erkennbar ist, gib ein Rezept mit titel „Kein Rezept gefunden“ und leeren Zutaten zurück. Antworte mit "rezepte_zeigen" (genau 1 Rezept).`;
  const ok = (r) => { const x = (r?.rezepte || [])[0]; return x && x.titel && !/kein rezept/i.test(x.titel) ? x : null; };
  let x = null;
  if (onlyUrl) {
    // v0.72: Seite direkt öffnen (web_fetch, nur Token-Kosten) – Ausweichweg: 1 Websuche
    try { x = ok(await searchWithTool({ system: `Du überträgst ein Rezept für Mateo in seine App. Öffne den Link mit web_fetch und übernimm das Rezept von der Seite. ${rules}`, user: text, tool: RECIPE_TOOL, maxUses: 0, fetch: true, maxTokens: 3000, label: 'Rezept übernehmen' })); } catch {}
    if (!x && !insta) x = ok(await searchWithTool({ system: `Du überträgst ein Rezept für Mateo in seine App. Er hat nur einen Link geschickt: suche genau diese Seite (1 Suche) und übernimm das Rezept von dort. ${rules}`, user: text, tool: RECIPE_TOOL, maxUses: 1, label: 'Rezept übernehmen' }));
    if (!x && insta) throw new Error('Instagram lässt sich per Link leider nicht lesen. Öffne den Beitrag, tippe bei der Beschreibung auf „mehr“, kopiere den Text und füge ihn hier ein.');
  } else {
    x = ok(await searchWithTool({ system: `Du überträgst ein Rezept für Mateo in seine App. Er hat Text eingefügt – von einer Rezeptseite oder eine Instagram-/TikTok-Beschreibung (kann Werbung, Kommentare, Emojis enthalten – ignoriere die). ${rules}`, user: text.slice(0, 15000), tool: RECIPE_TOOL, maxUses: 0, label: 'Rezept übernehmen' }));
  }
  if (!x) throw new Error('Im Text war kein Rezept zu erkennen. Am besten den ganzen Rezepttext (Zutaten + Zubereitung) einfügen.');
  const link = (text.match(/https?:\/\/\S+/) || [])[0] || '';
  return { ...toRecipe(x, 0, category), url: link || (/^https?:\/\//.test(x.url || '') ? x.url : '') };
}

// Regionen für die Sport-Event-Suche (frei änderbar)
export const sportRegions = (s) => s.profile?.sportRegions || ['Buenos Aires', 'Argentinien'];
export const setSportRegions = (list) => store.update((s) => { s.profile = { ...(s.profile || {}), sportRegions: list }; });
export const sportPeriods = (s) => s.profile?.sportPeriods || ['Diesen Monat', 'Nächste 3 Monate', 'Dieses Jahr', 'Nächstes Jahr'];
export const setSportPeriods = (list) => store.update((s) => { s.profile = { ...(s.profile || {}), sportPeriods: list }; });

// Kurze Distanz-Angabe eines Sport-Events (auch für alte Einträge mit langer Notiz)
export function distOf(e) {
  if (e.dist) return e.dist;
  const m = String(e.note || '').match(/\d+(?:[.,]\d+)?\s?(?:km|K\b)(?:\s?\/\s?\d+(?:[.,]\d+)?\s?(?:km|K\b))*/i);
  return m ? m[0] : '';
}
