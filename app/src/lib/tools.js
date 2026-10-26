// Eigene Werkzeuge (zugeschnittene Seiten) pro Lebensbereich und Unterbereich
export const AREA_TOOLS = {
  koerper: [
    { sub: 'Sport', href: '#/sport', icon: 'run', title: 'Sport-Events', text: 'Events für alle Sportarten finden, merken und teilnehmen' },
    { sub: 'Ernährung', href: '#/kueche', icon: 'pot', title: 'Küche', text: 'Rezepte (z.B. Airfryer), Einkaufsliste und Küchen-Chat' },
    { sub: 'Vorsorge', href: '#/vorsorge', icon: 'medical', title: 'Vorsorge', text: 'Arzttermine, Routinen und Verletzungen mit Erinnerung' },
    { sub: 'Schlaf', icon: 'moon', title: 'Schlaf', text: 'Kommt, sobald Schlafdaten von der Uhr verfügbar sind (iPhone-App)', soon: true },
  ],
  mental: [], // dynamisch aus s.libCats (Bibliothek, Podcasts, eigene Kategorien)
  zuhause: [
    { sub: 'Ordnung und Haushalt', href: '#/zuhause/haushalt', icon: 'home', title: 'Haushalt', text: 'Was zu tun ist – sortiert nach Räumen' },
    { href: '#/zuhause/erinnerungen', icon: 'refresh', title: 'Erinnerungen', text: 'Regelmäßiges wie Miete oder WLAN bezahlen' },
    { sub: 'Einrichtung und Design', href: '#/zuhause/einrichtung', icon: 'sparkle', title: 'Einrichtung', text: 'Was du dir noch holen willst – mit KI-Ideen' },
    { sub: 'Kleidung', href: '#/zuhause/kleidung', icon: 'shirt', title: 'Kleidung', text: 'Was du brauchst und was weg kann – mit KI-Ideen' },
  ],
  freizeit: [
    { sub: 'Hobbys', href: '#/hobbys', icon: 'sparkle', title: 'Hobbys', text: 'Pro Hobby eine Liste: noch offen und geschafft (z.B. Songs), plus Ideen-Chat' },
    { sub: 'Reisen', href: '#/reisen', icon: 'plane', title: 'Reisen', text: 'Jede Reise mit eigenem Dashboard: To-dos, Packliste, Ideen, Budget' },
  ],
  erlebnisse: [
    { sub: 'Treffen planen', href: '#/treffen', icon: 'users', title: 'Eigene Events', text: 'Selbst organisieren: Einladung, Gäste, Zu-/Absagen, Einkauf, To-dos – danach abhaken' },
  ],
  karriere: [
    { href: '#/karriere', icon: 'briefcase', title: 'Jobsuche', text: 'Suchen, neue Angebote, Bewerbungs-Trichter, Unterlagen und Karriere-Coach' },
    { href: '#/karriere/projekte', icon: 'flag', title: 'Eigene Projekte', text: 'Deine Projekte messbar voranbringen: Meilensteine, Arbeitszeit, KI-Mentor' },
  ],
  entwicklung: [{ href: '#/skills', icon: 'bulb', title: 'Täglich dranbleiben', text: 'Sprachen, Python & Co.: kleine Impulse jeden Tag, Sprechen mit der KI' }],
  informiert: [{ href: '#/news', icon: 'news', title: 'Informiert bleiben', text: 'Deine Themen mit sortierten Nachrichten-Links' }],
};
const LIB_TEXT = { bibliothek: 'Bücher, Artikel, Videos und Kurse zu deinen Themen', podcasts: 'Podcasts zu deinen Themen – entdecken, hören, merken' };
export const toolsFor = (areaId, subName, s) => {
  if (areaId === 'mental') return subName ? [] : (s?.libCats || []).map((c) => ({ href: `#/wissen/${c.id}`, icon: c.icon || 'book', title: c.name, text: LIB_TEXT[c.id] || 'Deine eigene Kategorie mit Empfehlungen' }));
  return (AREA_TOOLS[areaId] || []).filter((t) => !subName || t.sub === subName);
};

// In diesen Bereichen ersetzen die Werkzeuge die allgemeine Unterbereichs-Liste
export const TOOL_AREAS = new Set(['koerper', 'mental', 'zuhause', 'freizeit', 'erlebnisse', 'familie', 'freunde', 'neue', 'karriere', 'entwicklung']);
