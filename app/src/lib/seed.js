// Die feste Grundordnung: 3 Säulen, Lebensbereiche, Unterbereiche.
// targetDays = wie oft du dich mindestens um den Bereich kümmern willst (für die Ampel).
export const PILLARS = [
  { id: 'persoenlich', name: 'Persönlich', color: '#2FA36B' },
  { id: 'sozial', name: 'Sozial', color: '#E8775A' },
  { id: 'professionell', name: 'Professionell', color: '#3B6FE0' },
];

// id, Säule, Name, Ziel in Tagen, Symbol, Unterbereiche, Personen-Kategorie
const AREAS = [
  ['koerper', 'persoenlich', 'Gesundheit', 3, 'heart', ['Sport', 'Ernährung', 'Schlaf', 'Vorsorge']],
  ['mental', 'persoenlich', 'Lernen & Wissen', 7, 'bulb', ['Geschichte', 'Physik', 'Geopolitik', 'Wirtschaft']],
  ['zuhause', 'persoenlich', 'Zuhause', 14, 'home', ['Ordnung und Haushalt', 'Einrichtung und Design', 'Kleidung']],
  ['freizeit', 'persoenlich', 'Freizeit und Erlebnisse', 14, 'plane', ['Reisen', 'Kultur', 'Hobbys']],
  ['finanzen', 'persoenlich', 'Finanzen', 30, 'wallet', ['Budget', 'Investments', 'Verträge und Admin']],
  ['familie', 'sozial', 'Familie', 14, 'family', ['Kontakt halten', 'Besuche'], 'familie'],
  ['freunde', 'sozial', 'Freunde', 14, 'users', ['Enge Freunde', 'Weiterer Kreis'], 'freunde'],
  ['neue', 'sozial', 'Neue Kontakte', 30, 'userPlus', ['Kennenlernen', 'Community'], 'neu'],
  ['erlebnisse', 'sozial', 'Gemeinsame Erlebnisse', 30, 'sparkle', ['Treffen planen', 'Events']],
  ['karriere', 'professionell', 'Karriere und Chancen', 7, 'briefcase', ['Chancen-Pipeline', 'Berufliches Netzwerk', 'Unterlagen'], 'beruflich'],
  ['entwicklung', 'professionell', 'Weiterentwicklung', 3, 'book', ['Sprachen', 'Technische Skills', 'KI anwenden', 'Eigene Projekte']],
  ['informiert', 'professionell', 'Informiert bleiben', 7, 'news', ['Meine Themen', 'Vorgeschlagene Themen']],
];
export const AREA_ICONS = Object.fromEntries(AREAS.map((a) => [a[0], a[4]]));

export const PEOPLE_CATEGORIES = [
  { id: 'familie', label: 'Familie' },
  { id: 'freunde', label: 'Freunde' },
  { id: 'neu', label: 'Neue Kontakte' },
  { id: 'beruflich', label: 'Beruflich' },
];

// Start-Vorlagen für Projekte (in der App unter Einstellungen → Projekt-Vorlagen änderbar)
export const DEFAULT_TEMPLATES = [
  { id: 'lernen', name: 'Lernprojekt', tasks: ['Ziel festlegen', 'Material sammeln', 'Lernplan für die ersten 2 Wochen', 'Mini-Projekt umsetzen'] },
  { id: 'treffen', name: 'Treffen organisieren', tasks: ['Idee und Rahmen festlegen', 'Gäste auswählen', 'Termin und Ort festlegen', 'Einladungen schicken', 'Danach: Notizen festhalten'] },
  { id: 'reise', name: 'Reise', tasks: ['Ziel und Zeitraum festlegen', 'Budget planen', 'Anreise buchen', 'Unterkunft buchen', 'Packliste'] },
];

export const CAREER_DOCS = ['Lebenslauf (Englisch) aktuell', 'Lebenslauf (Spanisch)', 'LinkedIn-Profil aktuell', 'Anschreiben-Vorlage', 'GitHub / Portfolio mit 2–3 Projekten', 'Referenzen (2 Personen gefragt)', 'Zeugnisse als PDF', 'Elevator Pitch (30 Sek.)'];

export function seed() {
  return {
    version: 4,
    createdAt: new Date().toISOString(),
    profile: { name: 'Mateo' },
    pillars: PILLARS.map((p) => ({ ...p })),
    areas: AREAS.map(([id, pillarId, name, targetDays, icon, subs, peopleCategory]) => ({
      id,
      pillarId,
      name,
      targetDays,
      icon,
      paused: false,
      peopleCategory: peopleCategory || null,
      subs: subs.map((s, i) => ({ id: `${id}-${i}`, name: s })),
    })),
    templates: DEFAULT_TEMPLATES.map((t) => ({ ...t, tasks: [...t.tasks] })),
    projects: [],
    tasks: [],
    habits: [],
    checkins: [],
    activities: [],
    people: [],
    inbox: [],
    resources: [],
    events: [],
    radar: { topics: ['KI-Entwicklungen', 'Startups und VC', 'Portugiesisch'], items: [] },
    wishes: [], // Wunschliste für Änderungen an der App selbst
    places: [], // Orte mit Karte (Bars, Cafés …)
    sports: [], // Sportarten (Laufen, Kraft …)
    sessions: [], // Trainingseinheiten
    recipes: [], // Rezepte
    recipeCats: ['Frühstück', 'Mittagessen', 'Abendessen', 'Snacks', 'Airfryer', 'Meal Prep'],
    shopping: { items: [], history: {} }, // Einkaufsliste + was schon mal gekauft wurde
    healthItems: [], // Vorsorge: Termine, Routinen, Verletzungen
    memory: [],
    library: [],
    home: {}, // Zuhause-Listen: haushalt, einrichtung, kleidung → { cats, items }
    reminders: [], // Regelmäßige Erinnerungen (Miete, WLAN …)
    hobbies: [], // Hobbys mit Ideen
    trips: [], // Reisen mit eigenem Dashboard
    jobSearches: [], // Karriere: Jobsuchen (z.B. „VC Analyst“)
    jobs: [], // Karriere: Bewerbungs-Funnel
    careerDocs: CAREER_DOCS.map((text, i) => ({ id: 'doc' + i, text, done: false })), // Unterlagen-Checkliste
    skills: [],
    sideProjects: [], // Karriere: eigene Projekte mit Meilensteinen und Arbeitszeit // Weiterentwicklung: Skills mit täglichen Impulsen
    newsSources: [], // Informiert bleiben → Andere Quellen (Blogs, Newsletter, Webseiten)
    budget: null, // Finanzen: Monatsrechner (Einnahmen, Sparziel, Fixkosten, Währungen)
    sportEvents: [], // Events pro Sportart (Rennen, Turniere, Lauftreffs …)
    libCats: [ // Kategorien in „Lernen & Wissen“ (z.B. Bibliothek, Podcasts) – frei erweiterbar
      { id: 'bibliothek', name: 'Bibliothek', kind: '', icon: 'book' },
      { id: 'podcasts', name: 'Podcasts', kind: 'podcast', icon: 'mic' },
    ],
    chats: {}, // Gesprächsverläufe der Bereichs-Chats (Sport-Coach, Küche, Hobbys, Lernen)
    invites: [], // Events von anderen (Einladungen)
    gatherings: [], // Eigene Treffen/Events // Bücher, Artikel, Videos … pro Thema (Thema = Unterbereich von „Lernen & Wissen“) // Was Life über Mateo weiß (aus Erzählungen gelernt, jederzeit änderbar)
  };
}
