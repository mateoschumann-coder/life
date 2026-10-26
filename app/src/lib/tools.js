// Eigene Werkzeuge (zugeschnittene Seiten) pro Lebensbereich und Unterbereich
export const AREA_TOOLS = {
  koerper: [
    { sub: 'Sport', href: '#/sport', icon: 'run', title: 'Sport', text: 'Sportarten, Einheiten, Rennen, Zeitrechner und KI-Analyse' },
    { sub: 'Ernährung', href: '#/kueche', icon: 'pot', title: 'Küche', text: 'Rezepte (z.B. Airfryer) und Einkaufsliste' },
    { sub: 'Vorsorge', href: '#/vorsorge', icon: 'medical', title: 'Vorsorge', text: 'Arzttermine, Routinen und Verletzungen mit Erinnerung' },
    { sub: 'Schlaf', icon: 'moon', title: 'Schlaf', text: 'Kommt, sobald Schlafdaten von der Uhr verfügbar sind (iPhone-App)', soon: true },
  ],
  erlebnisse: [{ href: '#/ausgehen', icon: 'pin', title: 'Ausgehen', text: 'Events finden und deine Lieblingsorte auf der Karte' }],
  freizeit: [{ href: '#/ausgehen', icon: 'pin', title: 'Ausgehen', text: 'Events finden und deine Lieblingsorte auf der Karte' }],
  informiert: [{ href: '#/radar', icon: 'radar', title: 'Radar', text: 'Deine Themen, Leseliste und Fundstücke' }],
};
export const toolsFor = (areaId, subName) => (AREA_TOOLS[areaId] || []).filter((t) => !subName || t.sub === subName);
