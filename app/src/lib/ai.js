// KI-Assistent: Verbindung zur Claude-API direkt vom iPhone aus.
// Der API-Schlüssel liegt NUR im Speicher dieses Geräts (nie im Code, nie in Sicherungen).
import { addDays, today, fmtLong } from './dates';
import { areaOf, habitProgress, lastContact } from './logic';

const AI_KEY = 'life-app-ai';
const CHAT_KEY = 'life-app-chat';

export const MODELS = [
  // Preise in USD pro 1 Mio. Token (laut Anthropic, Okt. 2026). Haiku: über 100.000 Token Eingabe gilt der höhere Preis.
  { id: 'claude-haiku-5-5', label: 'Schnell und günstig', sub: 'Claude Haiku 5.5', price: { in: 0.1, out: 0.5, cacheRead: 0.1 }, long: { in: 0.5, out: 2.5 } },
  { id: 'claude-sonnet-5-5', label: 'Gründlich', sub: 'Claude Sonnet 5.5', price: { in: 2, out: 10, cacheRead: 0.05 } },
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

// Wofür gerade KI benutzt wird (für die Kosten-Aufschlüsselung in den Einstellungen)
let costLabel = 'Assistent';
export const setCostLabel = (label) => { costLabel = label; };

// Kosten einer Antwort berechnen (aus den Token-Zahlen der API)
export function costOf(model, usage) {
  const m = MODELS.find((x) => x.id === model) || MODELS[0];
  const inp = usage?.input_tokens || 0;
  const write = usage?.cache_creation_input_tokens || 0;
  const read = usage?.cache_read_input_tokens || 0;
  const p = m.long && inp + write + read > 100000 ? { ...m.price, ...m.long } : m.price;
  const tokens = (inp * p.in + write * p.in * 1.25 + read * p.in * p.cacheRead + (usage?.output_tokens || 0) * p.out) / 1e6;
  const searches = usage?.server_tool_use?.web_search_requests || 0;
  return { tokens, searches, total: tokens + searches * 0.01 }; // Websuche: 10 $ pro 1000 Suchen
}
// Kosten pro Monat mitschreiben – gesamt und pro Funktion
export function trackUsage(model, usage) {
  const c = costOf(model, usage);
  const month = today().slice(0, 7);
  const ai = getAi();
  const u = ai.usage[month] || { requests: 0, cost: 0 };
  u.requests += 1;
  u.cost += c.total;
  u.searches = (u.searches || 0) + c.searches;
  const by = { ...(u.by || {}) };
  const b = by[costLabel] || { n: 0, cost: 0, searches: 0 };
  by[costLabel] = { n: b.n + 1, cost: b.cost + c.total, searches: b.searches + c.searches };
  u.by = by;
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
  'person_anlegen', 'person_aendern', 'kontakt_notieren', 'aktivitaet_eintragen', 'ressource_anlegen', 'event_anlegen', 'radar_eintrag', 'app_wunsch', 'merken', 'ort_anlegen',
  'projekt_aendern', 'bausteine_hinzufuegen', 'unterbereich_anlegen', 'aufgabe_loeschen', 'thema_anlegen',
  'training_eintragen', 'einkauf_hinzufuegen', 'rezept_anlegen', 'vorsorge_anlegen', 'material_anlegen',
  'erinnerung_anlegen', 'zuhause_eintrag', 'hobby_eintrag', 'reise_anlegen', 'treffen_anlegen', 'einladung_eintragen',
  'sport_event_anlegen', 'skill_ziel', 'bewerbung_eintragen', 'quelle_anlegen', 'fixkosten_anlegen',
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
            gastgeber: { type: 'string', description: 'Für einladung_eintragen: wer lädt ein / organisiert' },
            mitbringen: { type: 'string', description: 'Für einladung_eintragen: was Mateo mitbringt (z.B. Geschenk, Wein)' },
            einladung_status: { type: 'string', enum: ['eingeladen', 'vielleicht', 'zugesagt', 'abgesagt'], description: 'Für einladung_eintragen' },
            url: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            ort: { type: 'string' },
            reise: { type: 'boolean' },
            warum: { type: 'string' },
            thema: { type: 'string' },
            adresse: { type: 'string', description: 'Für ort_anlegen: Adresse oder Viertel' },
            ort_art: { type: 'string', enum: ['Café', 'Bar', 'Restaurant', 'Club', 'Kultur', 'Natur', 'Sport', 'Laden', 'Sonstiges'], description: 'Für ort_anlegen' },
            ort_unterart: { type: 'string', description: 'Für ort_anlegen: genauer, z.B. Rooftop / Sky Bar, Pub, Cocktailbar, Parrilla, Specialty Coffee' },
            stadt: { type: 'string', description: 'Für ort_anlegen: Stadt des Ortes (Standard Buenos Aires), z.B. Frankfurt' },
            war_da: { type: 'boolean', description: 'Für ort_anlegen: true = war schon da, false = will hin' },
            bewertung: { type: 'integer', description: 'Für ort_anlegen: 1–5 Sterne, wenn war_da' },
            bausteine: {
              type: 'array',
              description: 'Für projekt_anlegen oder bausteine_hinzufuegen: Inhalte/Graphen des Projekts',
              items: {
                type: 'object',
                properties: {
                  typ: { type: 'string', enum: ['kennzahl', 'liste', 'zaehler', 'meilensteine', 'budget', 'notiz'], description: 'kennzahl = Zahl mit Graph (z.B. km/Woche), liste = abhakbare Punkte, zaehler = hochzählen mit Ziel, meilensteine = Etappen, budget = Ausgaben gegen Limit, notiz = Text' },
                  titel: { type: 'string' },
                  einheit: { type: 'string' },
                  ziel: { type: 'number' },
                  punkte: { type: 'array', items: { type: 'string' } },
                  text: { type: 'string' },
                },
                required: ['typ', 'titel'],
              },
            },
            sportart: { type: 'string', description: 'Für training_eintragen: z.B. Laufen, Krafttraining' },
            distanz_km: { type: 'number', description: 'Für training_eintragen' },
            dauer: { type: 'string', description: 'Für training_eintragen: Zeit als H:MM:SS oder Minuten, z.B. "58" oder "1:05:30"' },
            puls: { type: 'integer', description: 'Für training_eintragen: Ø Herzfrequenz' },
            artikel: { type: 'array', items: { type: 'string' }, description: 'Für einkauf_hinzufuegen' },
            zutaten: { type: 'array', items: { type: 'string' }, description: 'Für rezept_anlegen (mit Mengen)' },
            schritte: { type: 'string', description: 'Für rezept_anlegen' },
            rezept_kategorie: { type: 'string', description: 'Für rezept_anlegen, z.B. Airfryer' },
            vorsorge_art: { type: 'string', enum: ['termin', 'routine', 'verletzung'], description: 'Für vorsorge_anlegen' },
            alle_monate: { type: 'integer', description: 'Für vorsorge_anlegen bei routine' },
            wie_oft: { type: 'string', enum: ['woche', 'monat', 'quartal', 'jahr'], description: 'Für erinnerung_anlegen (regelmäßig, z.B. Miete monatlich)' },
            liste: { type: 'string', enum: ['haushalt', 'einrichtung', 'kleidung'], description: 'Für zuhause_eintrag' },
            zuhause_kategorie: { type: 'string', description: 'Für zuhause_eintrag: Raum/Kategorie, z.B. Bad, Wohnzimmer, Schuhe' },
            weggeben: { type: 'boolean', description: 'Für zuhause_eintrag bei kleidung: true = weggeben statt brauchen' },
            hobby: { type: 'string', description: 'Für hobby_eintrag: Name des Hobbys, z.B. Gitarre' },
            hobby_art: { type: 'string', enum: ['idee', 'song', 'video', 'buch', 'uebung', 'link'], description: 'Für hobby_eintrag' },
            bis_datum: { type: 'string', description: 'Für reise_anlegen: Enddatum JJJJ-MM-TT (datum = Start)' },
            material_art: { type: 'string', enum: ['buch', 'artikel', 'video', 'podcast', 'kurs'], description: 'Für material_anlegen (Bibliothek in „Lernen & Wissen“)' },
            autor: { type: 'string', description: 'Für material_anlegen' },
            archivieren: { type: 'boolean', description: 'Für projekt_aendern: true = Projekt abschließen/archivieren' },
            sport_status: { type: 'string', enum: ['interessiert', 'angemeldet', 'dabei'], description: 'Für sport_event_anlegen (name, sportart, datum, ort, url)' },
            skill: { type: 'string', description: 'Für skill_ziel: Name des Skills, z.B. Portugiesisch (titel = das Ziel/To-do)' },
            firma: { type: 'string', description: 'Für bewerbung_eintragen (titel = Stelle)' },
            phase: { type: 'string', enum: ['interessiert', 'beworben', 'rueckmeldung', 'gespraech', 'angebot', 'abgesagt'], description: 'Für bewerbung_eintragen' },
            suche: { type: 'string', description: 'Für bewerbung_eintragen: Name der Jobsuche (optional)' },
            betrag: { type: 'number', description: 'Für fixkosten_anlegen: Betrag pro Monat' },
            waehrung: { type: 'string', enum: ['ARS', 'EUR', 'USD'], description: 'Für fixkosten_anlegen' },
            kostenart: { type: 'string', enum: ['miete', 'nebenkosten', 'energie', 'telefon', 'versicherung', 'abos', 'transport', 'sport', 'kredit', 'sonstiges'], description: 'Für fixkosten_anlegen' },
            fakt: { type: 'string', description: 'Für merken: dauerhafte Info über Mateo (Ziel, Vorliebe, Interesse, Gewohnheit), kurz in der 3. Person, z.B. „Lernt Italienisch für eine Reise im Mai“' },
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
    projekt_bausteine: s.projects.filter((p) => p.status === 'aktiv' && (p.blocks || []).length).map((p) => ({ projekt: p.id, bausteine: p.blocks.map((b) => b.title) })),
    offene_aufgaben: tasks,
    rhythmen: habits,
    personen: people,
    vorlagen: s.templates.map((x) => ({ id: x.id, name: x.name })),
    radar_themen: s.radar.topics,
    orte: (s.places || []).map((p) => ({ name: p.name, art: p.category, status: p.status })),
    sportarten: (s.sports || []).map((x) => x.name),
    letzte_trainings: (s.sessions || []).slice(-8).map((x) => ({ sport: s.sports.find((y) => y.id === x.sportId)?.name, datum: x.date, km: x.distance, min: x.duration ? Math.round(x.duration) : undefined })),
    einkaufsliste: (s.shopping?.items || []).filter((x) => !x.done).map((x) => x.name),
    rezepte: (s.recipes || []).map((r) => r.title),
    erinnerungen: (s.reminders || []).map((r) => ({ titel: r.title, naechstes: r.next, wie_oft: r.every })),
    zuhause_offen: Object.fromEntries(Object.entries(s.home || {}).map(([k, l]) => [k, (l.items || []).filter((x) => !x.done).map((x) => `${x.cat}: ${x.text}`).slice(0, 15)])),
    hobbys: (s.hobbies || []).map((h) => h.name),
    sport_events: (s.sportEvents || []).filter((e) => e.status !== 'dabei').map((e) => ({ name: e.name, sport: s.sports.find((x) => x.id === e.sportId)?.name, datum: e.date, status: e.status })),
    skills: (s.skills || []).map((k) => ({ name: k.name, offene_ziele: (k.todos || []).filter((x) => !x.done).map((x) => x.text) })),
    jobsuchen: (s.jobSearches || []).map((x) => x.name),
    bewerbungen: (s.jobs || []).map((j) => ({ stelle: j.title, firma: j.company, phase: j.status })),
    eigene_quellen: (s.newsSources || []).map((x) => x.name),
    fixkosten: (s.budget?.costs || []).map((x) => `${x.name} ${x.amount} ${x.currency}`),
    reisen: (s.trips || []).map((t) => ({ name: t.name, von: t.from, bis: t.to })),
    treffen: (s.gatherings || []).map((g) => ({ name: g.name, datum: g.date })),
    einladungen: (s.invites || []).filter((x) => !x.done).map((x) => ({ name: x.name, von: x.host, datum: x.date, status: x.status })),
    bibliothek: (s.library || []).map((m) => ({ titel: m.title, status: m.status })).slice(-30),
    wissensthemen: (s.areas.find((a) => a.id === 'mental')?.subs || []).map((x) => x.name),
    vorsorge: (s.healthItems || []).filter((h) => h.status !== 'erledigt' && h.status !== 'ausgeheilt').map((h) => ({ titel: h.title, art: h.type, datum: h.date })),
    events: s.events.map((e) => ({ name: e.name, datum: e.date, status: e.stage })),
    was_ich_ueber_mateo_weiss: (s.memory || []).map((m) => m.text),
  };
  return `Du bist der persönliche Assistent in Mateos Life-App. Heute ist ${fmtLong(t)} (${t}). Mateo lebt in Buenos Aires.

So arbeitest du:
- Antworte auf Deutsch, strukturiert und auf den Punkt: so ausführlich wie nötig, so kurz wie möglich. Meist 3–6 Sätze oder eine gegliederte Liste mit bis zu 7 Punkten; bei Analysen, Rückblicken oder Planungen darf es länger sein, aber immer klar gegliedert. Keine Floskeln („Gern!“, „Natürlich“), keine Wiederholung seiner Frage.
- Deine Antworten werden oft vorgelesen: schreibe natürliche Sätze; für Listen einfache Zeilen mit „–“, keine Tabellen, kein Fettdruck, keine Überschriften mit #.
- Du kannst in der App direkt handeln. Mit dem Werkzeug "aenderungen_vorschlagen" kannst du: Aufgaben anlegen/ändern/erledigen/löschen, Projekte anlegen (auch gleich mit Aufgaben und Bausteinen wie Graphen, Listen, Meilensteinen, Budget), Projekte umbenennen/Termin setzen/archivieren, Bausteine zu bestehenden Projekten hinzufügen, Unterbereiche anlegen, Fokus-Themen und Rhythmen anlegen und abhaken, Personen anlegen/ändern und Kontakte notieren, Aktivitäten, Ressourcen, Events, Radar-Einträge und Orte anlegen, Trainingseinheiten eintragen (training_eintragen, z.B. „heute 12 km in 58 Min gelaufen“), Dinge auf die Einkaufsliste setzen (einkauf_hinzufuegen), Rezepte speichern (rezept_anlegen), Arzttermine, Vorsorge-Routinen und Verletzungen eintragen (vorsorge_anlegen), Bücher/Artikel/Videos/Podcasts/Kurse in die Bibliothek legen (material_anlegen mit titel, material_art, thema = Wissensthema wie Geschichte, autor, url), regelmäßige Erinnerungen wie Miete/WLAN anlegen (erinnerung_anlegen mit titel, wie_oft, datum = nächstes Mal), Einträge in Zuhause-Listen setzen (zuhause_eintrag mit liste haushalt/einrichtung/kleidung, zuhause_kategorie, titel), Hobby-Ideen speichern (hobby_eintrag), Reisen anlegen (reise_anlegen mit name, datum, bis_datum), eigene Treffen anlegen (treffen_anlegen mit name, datum, uhrzeit, ort), Events von anderen eintragen, zu denen Mateo eingeladen ist – Geburtstag eines Freundes, Hochzeit, Asado bei jemandem (einladung_eintragen mit name, gastgeber, datum, uhrzeit, ort, mitbringen, einladung_status), Sport-Events merken oder als angemeldet eintragen (sport_event_anlegen mit name, sportart, datum, ort, sport_status), konkrete Ziele für einen Skill auf dessen To-do-Liste setzen (skill_ziel mit skill und titel), Bewerbungen in den Trichter eintragen oder die Phase ändern (bewerbung_eintragen mit titel = Stelle, firma, phase), Nachrichten-Quellen wie Blogs/Newsletter speichern (quelle_anlegen mit name, url), Fixkosten im Finanz-Rechner eintragen (fixkosten_anlegen mit titel, betrag, waehrung, kostenart), dir Dinge merken und App-Wünsche notieren. Sag NIE, dass du etwas nicht kannst, wenn eine dieser Aktionen passt – schlag sie einfach vor. Mateo tippt dann nur noch auf „Übernehmen“ (oder es wird automatisch ausgeführt).
- Wenn Mateo etwas eintragen, ändern oder planen will, rufe das Werkzeug "aenderungen_vorschlagen" auf. Sag in deinem Text kurz, was du vorschlägst. Behaupte nie, etwas sei schon gespeichert: Mateo muss erst bestätigen.
- Fasse zusammengehörige Änderungen in EINEM Vorschlag zusammen.
- Nutze nur IDs aus den Daten unten. Wähle für neue Einträge immer den passendsten Lebensbereich und, wenn klar, den Unterbereich.
- Relative Angaben wie "morgen" oder "Freitag" rechnest du in ein Datum JJJJ-MM-TT um.
- Wenn etwas unklar ist, stelle EINE kurze Rückfrage statt zu raten.
- Die drei Säulen und Lebensbereiche selbst änderst du nicht (Unterbereiche darfst du anlegen). Du kannst nichts buchen, kaufen oder Nachrichten verschicken.
- Wenn Mateo die App selbst verändern möchte (Design, neue Funktionen, Fehler), kannst du das nicht direkt. Schlage dann die Aktion "app_wunsch" mit einem klaren titel vor; die Wunschliste setzt Claude später im Code um.
- Fragen zu seinen Daten (z.B. "Was steht heute an?", "Wem sollte ich schreiben?") beantwortest du direkt aus den Daten.
- Wenn Mateo frei von seinem Tag oder seiner Woche erzählt (z.B. „War laufen, Python nicht geschafft, mit Lukas telefoniert“): Trage in EINEM Vorschlag alles ein, was passt (aufgabe_erledigen, rhythmus_abhaken, kontakt_notieren, aktivitaet_eintragen, neue Aufgaben). Dauerhafte Infos über ihn (Ziele, Vorlieben, Interessen, Probleme wie „Knie zwickt beim Laufen“, Pläne) speicherst du mit "merken". Antworte kurz und motivierend, gib einen konkreten Anstoß und stelle höchstens EINE Rückfrage, wenn etwas Wichtiges fehlt.
- Berücksichtige immer, was du über Mateo weißt (was_ich_ueber_mateo_weiss).
- Wenn Mateo einen Ort (Bar, Café, Restaurant …) erwähnt, den er mag oder ausprobieren will, schlage "ort_anlegen" vor (name, ort_art, adresse, stadt wenn nicht Buenos Aires, war_da, bewertung, notiz). Er sieht ihn dann auf seiner Karte unter „Ausgehen“.

Mateos aktuelle Daten (JSON):
${JSON.stringify(data)}`;
}

// Gesprächsverlauf in das Format der API umwandeln.
// Ein Vorschlag (tool_use) braucht in der nächsten Nachricht ein Ergebnis (tool_result).
export function toApiMessages(all) {
  // Nur die letzten ~20 Nachrichten schicken (spart Kosten); muss mit einer eigenen Nachricht beginnen
  let items = all.slice(-20);
  while (items.length && items[0].role !== 'user') items = items.slice(1);
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
      // Zwei eigene Nachrichten hintereinander (z.B. nach einem Fehler) zusammenfassen
      const last = msgs.at(-1);
      if (last && last.role === 'user') last.content.push(...content.filter((c) => c.type === 'text'));
      else msgs.push({ role: 'user', content });
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

// Zwei Rollen derselben KI: „assistent“ (kurz, trägt ein) und „coach“ (Gespräch, Ideen, darf im Internet suchen)
const COACH_ROLE = `

DU BIST JETZT IM COACH-MODUS:
- Du bist Mateos persönlicher Coach und Sparringspartner, nicht nur ein Eingabe-Assistent. Ziel: Er soll vorankommen, nicht perfekt organisiert sein.
- Wenn er erzählt (auch lange, durcheinander, per Sprache): fasse kurz zusammen, was du verstanden hast, trage alles Passende in EINEM Vorschlag ein (Erledigtes, neue Aufgaben, merken für Ziele/Vorlieben/Probleme, Orte, Events, Projekte) und gib 2–4 konkrete Anstöße oder Ideen, die ihn weiterbringen.
- Stelle Rückfragen wie ein guter Coach (höchstens 2), z.B. was ihn gerade bremst oder was ihm wichtig ist.
- Du darfst die Websuche nutzen (höchstens 3-mal), wenn ein konkreter Link, ein Video, ein Rezept, ein Event oder eine Lernquelle wirklich hilft. Erfinde keine Links.
- Antworten dürfen hier länger sein (bis ca. 12 Zeilen), aber klar gegliedert mit Zeilen, die mit „–“ beginnen.`;

const ASSISTANT_ROLE = `

DU BIST JETZT IM ASSISTENTEN-MODUS:
- Mateo hat eine Idee, einen Termin, einen Geburtstag, ein Projekt oder sonst etwas und will es in seine App-Struktur bringen. Überlege, wo es am besten hinpasst (Lebensbereich, Unterbereich, Projekt, Aufgabe mit Datum, Person …) und schlage die Umsetzung mit dem Werkzeug vor. Sag in 1–2 Sätzen, wie du es einsortierst.
- Kurz und sachlich; keine Coaching-Fragen.`;

export async function askClaude(s, items, mode = 'assistent') {
  const ai = getAi();
  if (!ai.apiKey) throw new Error('KEIN_SCHLUESSEL');
  const coach = mode === 'coach';
  setCostLabel(coach ? 'Chat: Coach' : 'Chat: Assistent');
  // Websuche kostet extra – nur, wenn in der letzten Nachricht ausdrücklich danach gefragt wird
  const lastText = String([...items].reverse().find((x) => x.role === 'user')?.text || '');
  const wantsWeb = /such|googl|recherch|internet|aktuell|news|nachricht|heute abend|dieses wochenende|öffnungszeit|preis/i.test(lastText);
  const tools = coach && wantsWeb
    ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1, user_location: { type: 'approximate', city: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' } }, TOOL]
    : [TOOL];
  const messages = toApiMessages(items);
  const call = async (body) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ai.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      // Der lange System-Text (deine Daten) wird zwischengespeichert: Folgenachrichten innerhalb von 5 Min. zahlen nur 10 % dafür
      body: JSON.stringify(fitModel({ model: ai.model, max_tokens: 4096, system: [{ type: 'text', text: buildSystem(s) + (coach ? COACH_ROLE : ASSISTANT_ROLE), cache_control: { type: 'ephemeral' } }], ...body })),
    });
    if (!res.ok) {
      let msg = '';
      try {
        msg = (await res.json())?.error?.message || '';
      } catch {}
      // Websuche im Konto aus: ohne Suche weitermachen
      if (res.status === 400 && /web_search|web search/i.test(msg) && body.tools.length > 1) return call({ ...body, tools: [TOOL] });
      throw new Error(explainError(res.status, msg));
    }
    const data = await res.json();
    trackUsage(ai.model, data.usage);
    return data;
  };
  let data = await call({ tools, messages });
  // Lange Suchen können pausieren: Antwort unverändert zurückschicken und fortsetzen
  for (let i = 0; i < 3 && data.stop_reason === 'pause_turn'; i++) {
    data = await call({ tools, messages: [...messages, { role: 'assistant', content: data.content }] });
  }
  let text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const tool = data.content.find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  const actions = Array.isArray(tool?.input?.aktionen) ? tool.input.aktionen : [];
  const truncated = data.stop_reason === 'max_tokens';
  if (truncated && !actions.length) text += (text ? '\n\n' : '') + '(Meine Antwort wurde abgeschnitten, bevor ich etwas eintragen konnte. Tippe auf „Nochmal senden“.)';
  else if (truncated) text += (text ? '\n\n' : '') + '(Meine Antwort wurde abgeschnitten – sag „weiter“, dann mache ich weiter.)';
  if (!text && !actions.length) text = 'Ich habe dazu gerade keine Antwort erzeugt. Tippe auf „Nochmal senden“ oder formuliere es kurz neu.';
  return { text, toolUseId: tool && actions.length ? tool.id : null, actions, failed: (truncated || !text) && !actions.length || /keine Antwort erzeugt/.test(text) };
}

export function explainError(status, msg) {
  if (status === 401) return 'Der API-Schlüssel ist ungültig. Bitte in den Einstellungen prüfen.';
  if (status === 403) return 'Der Schlüssel hat keine Berechtigung. Bitte in der Anthropic-Konsole prüfen.';
  if (status === 429) return 'Zu viele Anfragen oder Monatslimit erreicht. Kurz warten oder das Limit in der Konsole prüfen.';
  if (status === 529 || status === 503) return 'Die KI ist gerade überlastet. Bitte gleich noch einmal versuchen.';
  if (/credit|balance/i.test(msg)) return 'Kein Guthaben mehr auf dem API-Konto. Bitte in der Anthropic-Konsole aufladen.';
  return `Fehler ${status}${msg ? ': ' + msg : ''}`;
}

export const areaName = (s, id) => areaOf(s, id)?.name;

// Gemeinsamer Aufruf der Claude-API (für Check-in und Projekt-Gestalter)
// Sonnet 5.5 (v0.60): erzwungene Werkzeuge (tool_choice tool/any) → Fehler 400, Denken zählt zu max_tokens.
// Wird zentral angepasst, damit jede Funktion auch mit „Gründlich“ als Standard-Modell läuft.
export function fitModel(body) {
  if (!/^claude-sonnet-5/.test(body.model || '')) return body;
  const b = { ...body, max_tokens: Math.max(body.max_tokens || 0, 8000) };
  const tc = body.tool_choice;
  if (tc && (tc.type === 'tool' || tc.type === 'any')) {
    const hint = `\n\nAntworte AUSSCHLIESSLICH, indem du ${tc.name ? `das Werkzeug "${tc.name}"` : 'ein Werkzeug'} aufrufst.`;
    b.tool_choice = { type: 'auto' };
    b.system = Array.isArray(body.system) ? [...body.system, { type: 'text', text: hint }] : `${body.system || ''}${hint}`;
  }
  return b;
}
export async function callApi(body, label) {
  const ai = getAi();
  if (label) setCostLabel(label);
  if (!ai.apiKey) throw new Error('KEIN_SCHLUESSEL');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ai.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(fitModel({ model: ai.model, ...body })),
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
    body: JSON.stringify({ model, max_tokens: /^claude-sonnet-5/.test(model) ? 200 : 5, messages: [{ role: 'user', content: 'Hallo' }] }),
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
  }, 'Check-in');
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
  const { text, tools } = await callApi({ max_tokens: 1600, system, tools: [DESIGN_TOOL], messages }, 'Projekt gestalten');
  const tool = tools.find((c) => c.name === DESIGN_TOOL.name);
  return { text, toolUseId: tool?.id || null, input: tool?.input || null };
}
