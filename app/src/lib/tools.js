// Eigene Werkzeuge (zugeschnittene Seiten) pro Lebensbereich und Unterbereich
export const AREA_TOOLS = {
  koerper: [
    { sub: 'Sport', href: '#/sport', icon: 'run', title: 'Sport', text: 'Sportarten, Einheiten, Rennen, Zeitrechner und KI-Analyse' },
    { sub: 'Ernährung', href: '#/kueche', icon: 'pot', title: 'Küche', text: 'Rezepte (z.B. Airfryer) und Einkaufsliste' },
    { sub: 'Vorsorge', href: '#/vorsorge', icon: 'medical', title: 'Vorsorge', text: 'Arzttermine, Routinen und Verletzungen mit Erinnerung' },
    { sub: 'Schlaf', icon: 'moon', title: 'Schlaf', text: 'Kommt, sobald Schlafdaten von der Uhr verfügbar sind (iPhone-App)', soon: true },
  ],
  mental: [{ href: '#/wissen', icon: 'bulb', title: 'Bibliothek', text: 'Deine Themen mit Büchern, Artikeln, Videos und Kursen – und Empfehlungen' }],
  zuhause: [
    { sub: 'Ordnung und Haushalt', href: '#/zuhause/haushalt', icon: 'home', title: 'Haushalt', text: 'Was zu tun ist – sortiert nach Räumen' },
    { href: '#/zuhause/erinnerungen', icon: 'refresh', title: 'Erinnerungen', text: 'Regelmäßiges wie Miete oder WLAN bezahlen' },
    { sub: 'Einrichtung und Design', href: '#/zuhause/einrichtung', icon: 'sparkle', title: 'Einrichtung', text: 'Was du dir noch holen willst – mit KI-Ideen' },
    { sub: 'Kleidung', href: '#/zuhause/kleidung', icon: 'shirt', title: 'Kleidung', text: 'Was du brauchst und was weg kann – mit KI-Ideen' },
  ],
  freizeit: [
    { sub: 'Hobbys', href: '#/hobbys', icon: 'sparkle', title: 'Hobbys', text: 'Deine Hobbys mit Ideen: Songs, Videos, Bücher, Übungen' },
    { sub: 'Reisen', href: '#/reisen', icon: 'plane', title: 'Reisen', text: 'Jede Reise mit eigenem Dashboard: To-dos, Packliste, Ideen, Budget' },
    { sub: 'Kultur', href: '#/ausgehen', icon: 'pin', title: 'Ausgehen', text: 'Events und Lieblingsorte' },
  ],
  erlebnisse: [
    { sub: 'Treffen planen', href: '#/treffen', icon: 'users', title: 'Treffen planen', text: 'Eigene Events: Einladung, Gäste, Zu-/Absagen, Einkauf, To-dos' },
    { sub: 'Events', href: '#/ausgehen', icon: 'pin', title: 'Ausgehen', text: 'Events finden und deine Lieblingsorte auf der Karte' },
  ],
  informiert: [{ href: '#/radar', icon: 'radar', title: 'Radar', text: 'Deine Themen, Leseliste und Fundstücke' }],
};
export const toolsFor = (areaId, subName) => (AREA_TOOLS[areaId] || []).filter((t) => !subName || t.sub === subName);

// In diesen Bereichen ersetzen die Werkzeuge die allgemeine Unterbereichs-Liste
export const TOOL_AREAS = new Set(['koerper', 'mental', 'zuhause', 'freizeit', 'erlebnisse', 'familie', 'freunde', 'neue']);
