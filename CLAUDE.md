# Life-App – Projektbeschreibung für Claude

Diese Datei ist das Gedächtnis des Projekts. Jeder neue Chat liest sie zuerst und hält sie aktuell, wenn sich Konzept, Entscheidungen oder Stand ändern.

## Zusammenarbeit
- Sprache: **Deutsch**. Mateo mag konkrete Beispiele, Schritt-für-Schritt-Erklärungen, Tabellen und Grafiken; keine Fachbegriffe ohne Erklärung.
- Mateo programmiert nicht selbst. Claude ändert Code, testet, baut und lädt hoch. Erklärungen für Mateo immer ohne Terminal-Befehle.
- Fehler, die Mateo findet, direkt benennen und beheben.
- Änderungen an der App: Quellcode in `app/`, dann `cd app && node build.mjs --out ..` (schreibt die fertige App in die Repo-Wurzel), testen, committen, pushen. GitHub Pages veröffentlicht automatisch: https://mateoschumann-coder.github.io/life/
- Nur Mateos iPhone ist wichtig (iPad-Synchronisation bewusst übersprungen, Stand Okt. 2026).

## Neue Ausrichtung (Okt. 2026, von Mateo festgelegt)
Die App soll **keine Dokumentations-App** sein, in die Mateo viel einträgt. Sie soll die **KI in jedem Lebensbereich so nutzen, dass sie ihn aktiv antreibt**: Sie sucht selbst (Internet, Schnittstellen), fasst zusammen, schlägt konkrete Optionen vor, und Mateo bestätigt mit einem Tipp (z.B. „auf die To-do-Liste für morgen“). Grundstruktur (Säulen/Bereiche) bleibt.
Gewünschte Bausteine:
- **Agent mit Internetzugriff**, auf Auftrag oder automatisch (z.B. jeden Morgen): Events in der Umgebung passend zu Interessen (Sport, Konzerte …), Newsletter/News zu eingetragenen Themen, Research zu neuen Themen; Ergebnisse als Optionen zum Übernehmen.
- **Schnittstellen**: E-Mail, Garmin (Sport/Laufen, KI-Auswertung auf Knopfdruck), Finanzdaten (automatische Analyse), evtl. Open-Source-Datenquellen (Mateo erwähnte eine KI-gebaute Weltkarte mit gesammelten Informationen).
- **Check-in mit Optionen**: Die KI schlägt nach dem Durchsehen konkrete Punkte vor, die man direkt als To-dos (z.B. für morgen) übernehmen kann.
- **Projekte mit KI gestalten**: Projekte (nicht nur mit Fortschritt) im Gespräch mit der KI anlegen; die KI schlägt passende Kategorien, Inhalte und Graphen nur für dieses Projekt vor.
- Sehr gute Übersicht und Steuerung von einer zentralen Stelle; viel per Gespräch mit der KI.
- Native iOS-App (99 $/Jahr) ist für Mateo in Ordnung, wenn ein Bereich sie braucht (z.B. Apple Health/Garmin).
- Vorgehen: **Kategorie für Kategorie durchdenken**, was integriert werden kann.

## Leitprinzipien für die Bereiche (Okt. 2026, mit Mateo besprochen)
- Ziel: **möglichst wenig Zeit in der App**, maximal schnell vorankommen. Jede Interaktion endet in einer Entscheidung oder einem To-do.
- Drei Kontaktmomente statt Dauer-Pflege: **Morgen-Briefing** (KI hat schon gesucht/ausgewertet, Optionen antippen) · **Fragen jederzeit** („Was soll ich jetzt machen?“, „Welche Events gibt es?“) · **Abend-Check-in per Sprachnachricht** (KI füllt alles aus, fragt nur nach, was fehlt).
- Daten möglichst **automatisch holen** (GitHub, Garmin, Kalender, Web) statt eintragen; lückenhafte Daten sind okay, die KI arbeitet mit dem, was da ist.
- Vorgehen: Bereich für Bereich mit einem „Steckbrief“ (Was will ich erreichen? Welche Daten gibt es automatisch? Was fragt die KI? Was schlägt sie vor? Wie sieht der Bildschirm aus?).
- Technik-Hinweis: Die Claude-API hat eine eingebaute Websuche; „auf Knopfdruck suchen“ (Events, News) geht ohne Cloud, nur das automatische Suchen jeden Morgen braucht die Cloud. GitHub-Daten (öffentliche Repos) kann die App direkt lesen.

## Ziel der App
Persönliche App, um Privates, Soziales und Professionelles zu organisieren, effizienter zu sein und nichts Wichtiges zu vernachlässigen (Geburtstage, Kontakte, Lernen, Chancensuche). Läuft unabhängig von Claude als Web-App (PWA) auf dem iPhone. Stil: hell, ruhig, minimalistisch, an iOS angelehnt; dunkler Modus automatisch.

## Grundordnung (fest, nur bewusst in Einstellungen änderbar)
- **Persönlich:** Körperliche Gesundheit (Sport, Ernährung, Schlaf, Vorsorge) · Mentale Gesundheit · Zuhause (Ordnung, Einrichtung & Design, Kleidung) · Finanzen (Budget, Investments, Verträge) · Freizeit und Erlebnisse (Reisen, Kultur, Hobbys)
- **Sozial:** Familie · Freunde · Neue Kontakte · Gemeinsame Erlebnisse (Treffen planen, Events)
- **Professionell:** Karriere und Chancen · Weiterentwicklung (Sprachen: Portugiesisch, Italienisch; Python/ML; KI anwenden; eigene Projekte) · Informiert bleiben (eigene Themen + vorgeschlagene Themen)
- Ebenen: Säule → Lebensbereich → Unterbereich → Projekte/Einträge. Querverbindungen über Tags.
- **Lebensbereiche** sind dauerhaft und haben eine Ampel (Ziel-Rhythmus in Tagen; gelb ab Ziel, rot ab doppeltem Ziel, grau = pausiert). **Projekte** haben ein Ende und werden archiviert.

## Bausteine (Datenmodell, `app/src/lib/seed.js`)
Aufgabe (auch Idee) · **Projekt-Bausteine** (`lib/blocks.js`, `project.blocks`: kennzahl mit Graph, liste, zaehler, meilensteine, budget, notiz) · Rhythmus (x-mal pro Woche/Monat, Check-ins) · Person (Kategorie, Geburtstag, Kontakt-Rhythmus, Kontakte, Nachfassen, Telefon → WhatsApp-Link) · Projekt (mit Vorlagen) · Ressource (Link/Notiz, Tags) · Radar (Themen, Leseliste, Event-Pipeline Entdeckt→Interessiert→Zugesagt→Besucht) · Inbox (schnell erfassen, später einsortieren). Alle Einträge können einem Unterbereich zugeordnet sein (`subId`).

## Technik
- React + esbuild, keine weiteren Abhängigkeiten. Daten in `localStorage` (Schlüssel `life-app-v1`), Migration in `store.js`.
- Sicherung: Export/Import als JSON; Apple-Kalender über erzeugte .ics-Datei.
- Code-Aufbau: `lib/seed.js` (Grundordnung), `lib/store.js` (Speicher), `lib/actions.js` (alle Änderungen), `lib/logic.js` (Ampeln, Rhythmen, Kontakte), `screens/` (ein Bildschirm pro Datei), `components/`.
- Repo ist **öffentlich**: niemals API-Schlüssel oder persönliche Daten ins Repo.

## Entscheidungen
- Start als Web-App (Option C), später evtl. native iOS-App (Option B) für Apple Health/Garmin, Siri, Widgets.
- KI-Assistent in der App: Mateo spricht/tippt, die KI macht **Vorschläge**, gespeichert wird erst nach **Bestätigung**. Der Assistent darf Einträge anlegen/ändern, aber nie die Grundordnung oder den Code. Kern funktioniert immer ohne KI.
- Mateo hat Claude **Pro** (API wird separat bezahlt). Plan: Haiku für Alltagsbefehle, Sonnet für Planung.
- Schnittstellen: WhatsApp nur Chat öffnen (kein Auslesen möglich); Garmin nur über Apple Health in nativer App (Garmin-Entwicklerprogramm pausiert, Strava-API kostenpflichtig); Kalender/E-Mail später.

## Stand und Fahrplan
- v0.1: Grundfunktionen, Web-App live.
- v0.2: iOS-Design, dunkler Modus, Bereichs-Symbole, Unterbereich-Seiten, Idee → Projekt, eigene Vorlagen.
- v0.3: Farbwelt „Salbei und Sand“ (Persönlich #7A8F6A, Sozial #C4876B, Professionell #5F7C99, zart getönte Symbole, warmer Hintergrund), neues Icon (drei Säulen), **KI-Assistent**: Chat unter `#/assistent`, Claude-API direkt aus dem Browser (`lib/ai.js`), Schlüssel nur in `localStorage` (`life-app-ai`), Werkzeug `aenderungen_vorschlagen` → Vorschlagskarte → Bestätigen (`lib/apply.js`), Kostenanzeige in den Einstellungen. Keine Cloud (bewusst).
- v0.4: Mikrofon-Knopf im Assistenten (Web Speech API, `de-DE`; Ausweichweg: Diktierfunktion der Tastatur; funktioniert auf Mateos iPhone, beim ersten Mal nach Erlaubnis-Abfrage), **App-Wünsche** (`s.wishes`, Bildschirm `#/wuensche`, Assistent-Aktion `app_wunsch`, „Liste für Claude kopieren“). Wenn Mateo eine Wunschliste in den Chat kopiert: alle Punkte umsetzen und ihn bitten, sie in der App als umgesetzt abzuhaken.
- v0.5: **Schwebender Assistent** (`components/FloatingAssistant.jsx`) auf allen Bildschirmen außer dem Chat: 1. Tipp = zuhören, 2. Tipp = senden, Antwort + Vorschlagskarte im kleinen Fenster. Gemeinsamer Gesprächszustand in `lib/chat.js` (Chat und Knopf teilen alles). **Vorlesen** über die iPhone-Sprachausgabe (an/aus per Lautsprecher-Symbol, `speak` in `life-app-ai`). Antworten strukturiert, „so ausführlich wie nötig, so kurz wie möglich“ (meist 3–6 Sätze oder Liste bis 7 Punkte; Mateo fand 3 Sätze zu knapp). Knopf und Fenster sind verschiebbar (Position in `life-app-fab`).
- v0.6: **Kai-Design** (Mateos Konzept: Primärblau #2F5FD0/Navy #1E3A8A, Sonne #FBBF24, Hintergrund #F9FAFB; Säulen Persönlich #2FA36B, Sozial #E8775A, Professionell #3B6FE0; Karten mit leichtem Schatten), **Logo Berg mit Sonne** (`make_icons.py`), Name bleibt „Life“. **Neues Heute:** Wetter (Open-Meteo, iPhone-Standort, Fallback Buenos Aires, Kleidungstipp; `lib/weather.js`), Wochenleiste zum Tag-Wechseln, Tagesliste mit Uhrzeit (`task.time`), schnelles Hinzufügen für den gewählten Tag, **Fokus-Themen** = Rhythmen ohne feste Zahl (`count: 0`, Chips „Heute dran gewesen?“), **KI-Check-in** (`askReview` in `lib/ai.js`: Gut gelaufen / Eingeschlafen / Vorschlag für heute, gespeichert in `life-app-review`). Feste Rhythmen bleiben optional.
- v0.7 (Phase 1 der neuen Ausrichtung, ohne Cloud): **Check-in mit Optionen** (`askReview` nutzt Werkzeug `optionen_vorschlagen`; 3–5 Vorschläge zum Abhaken, „Für heute/Für morgen“ → To-dos; Status in `life-app-review`). **Projekte mit KI gestalten** (`askDesigner` + Werkzeug `projekt_gestalten`, `components/ProjectDesigner.jsx`; öffnet sich nach „Neues Projekt“ automatisch, wenn „Danach mit KI gestalten“ angehakt ist; Gesprächsverlauf pro Projekt in `sessionStorage`). Bausteine auch von Hand („+ Baustein selbst hinzufügen“), verschiebbar/löschbar über „…“. Fortschrittsbalken nur noch, wenn ein Projekt Aufgaben hat.
- **Fahrplan danach:** Phase 2 Cloud (Supabase, Mateo legt das Konto an) + Morgen-Agent mit Websuche (Events in Buenos Aires passend zu Interessen, News zu Radar-Themen, Chancen) + Push-Mitteilungen · Phase 3 E-Mail · Phase 4 Finanzen (zuerst CSV/Excel-Import) · Phase 5 native App für Garmin/Apple Health.
- **Erinnerung:** Wenn Schnittstellen/Datenquellen dran sind, Mateo an Open-Source-Datenquellen erinnern (er wollte den Link zu einer KI-gebauten Weltkarte mit gesammelten Informationen schicken) und nachfragen.
- Logo ändern: Mateo schickt ein Bild → Claude passt `make_icons.py` an bzw. erzeugt die PNGs → Mateo muss die App vom Home-Bildschirm löschen und neu hinzufügen (vorher Sicherung).
- **Als Nächstes (von Mateo genannt):** Garmin-Daten für Sport/Laufen + KI-Auswertung auf Knopfdruck; alle Bereiche durchgehen: Wie kann jeder Bereich Mateo aktiv anschieben? Grundsatz: „Die App passt sich mir an, nicht ich mich der App.“
- Ideen-Parkplatz: E-Mail-Sekretär (Mails priorisieren), wöchentliche KI-Recherche für „Vorgeschlagene Themen“ (kurzer Prompt: max. 5 neue Themen, je 2 Sätze + warum relevant), Kalender schreiben, Sprachsteuerung, Event-Entdeckung, native App.
