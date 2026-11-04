# Life-App – Projektwissen für Claude

Diese Datei ist das Gedächtnis des Projekts: **aktuelle Regeln, Ausrichtung und Entscheidungen**. Jeder neue Chat liest sie zuerst und hält sie aktuell.
- Was in welcher Version gebaut wurde (mit Datei- und Funktionsnamen): **`docs/CHANGELOG.md`** – bei Fragen „wo/wie wurde X gebaut?“ dort suchen (`grep`), nicht alles lesen.
- Technischer Aufbau (Speicher, Sicherung, Suche, KI, Konventionen): **`docs/ARCHITECTURE.md`**.

## Zusammenarbeit
- Sprache: **Deutsch**. Mateo mag konkrete Beispiele, Schritt-für-Schritt-Erklärungen, Tabellen und Grafiken; keine Fachbegriffe ohne Erklärung.
- Mateo programmiert nicht selbst. Claude ändert Code, testet, baut und lädt hoch. Erklärungen für Mateo immer ohne Terminal-Befehle.
- Fehler, die Mateo findet, direkt benennen und beheben.
- Nur Mateos iPhone ist wichtig (iPad-Synchronisation bewusst übersprungen, Stand Okt. 2026).
- **Regel (Mateo): Jedes Textfeld hat ✕ zum Leeren und ↶ zum Zurückholen** (global über `lib/fieldtools.js` für alle `input`/`textarea`; bei neuen Feldern nie `data-noclear` setzen, außer es gibt einen guten Grund).
- Mateo wünscht ein **ordentliches, verständliches GitHub** (README, Versionsgeschichte, Tests) – beim Arbeiten aktuell halten.

## Arbeitsablauf bei Änderungen
1. Quellcode in `app/src` ändern.
2. `cd app && npm test` – Tests müssen grün sein (bei neuer Logik möglichst einen Test in `app/test/` ergänzen; Muster siehe dort).
3. `node build.mjs --out ..` – schreibt die fertige App in die Repo-Wurzel (GitHub Pages liefert diese Dateien aus: https://mateoschumann-coder.github.io/life/).
4. Kurz im nachgebauten iPhone-Bildschirm prüfen (Playwright, 390 × 844).
5. Version hochzählen: `screens/Einstellungen.jsx` („Life · Version x.y“) und `app/package.json`; **Eintrag unten in `docs/CHANGELOG.md`**.
6. Commit + Push. GitHub prüft automatisch (`.github/workflows/check.yml`) und veröffentlicht.
- Repo ist **öffentlich**: niemals API-Schlüssel oder persönliche Daten ins Repo (auch nicht in Tests/Beispielen).

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

## Vision pro Bereich (Mateo, 25.10.2026; Maßstab: „Ich muss echten Mehrwert spüren, sonst nutze ich die App nicht“)
Kern: **ein Coach/Koordinator**, der aktiv auf Mateo zukommt („Da kannst du vorankommen“, „Ich habe eine Idee für dich, starte doch Projekt X“), aus Sprach-Erzählungen lernt (täglich/wöchentlich frei erzählen → KI trägt ein und merkt sich Ziele/Vorlieben) und pro Bereich zugeschnitten ist. Vorankommen > perfekt organisieren.
- **Zuhause/Ernährung:** per Sprache sagen, was er kaufen/kochen will → Einkaufslisten, Erinnerung einzukaufen, Rezepte (v.a. Airfryer) suchen und mit der Liste verbinden.
- **Events/Ausgehen:** KI sucht automatisch Events (z.B. Google-Events-Ergebnisse) und fragt ein paar Tage vorher „Interessiert dich das?“; **Orte-Listen mit Karte** (Bars, Cafés … mit eigener Notiz/Bewertung).
- **Informiert bleiben:** Themen eintragen → KI liefert Zusammenfassung + Links, fragt „interessiert dich das?“.
- **Menschen:** Kontakt-Rhythmen (z.B. Großeltern x/Woche, Kumpel 1x/Monat), Geburtstage, aktive Erinnerungen.
- **Sport:** Leistungsdaten + Marathon-Projekt → Einschätzung und Verbesserungen; Anstöße wie „Knie-Übungen gemacht? Hier ein 15-Min-Dehnvideo“.
- **Finanzen:** Monatszusammenfassung aufgegliedert, Sparziel, Entwicklung der Investments, Empfehlungen.
- **Weiterentwicklung:** Python-Projekte noch nicht auf GitHub → erster Anstoß „GitHub aufbauen“; Python-Übungen, ML lernen; **Code-Bibliothek** (Dokumente mit wiederverwendbarem Code, Speicherung auf GitHub).

## Ziel der App
Persönliche App, um Privates, Soziales und Professionelles zu organisieren, effizienter zu sein und nichts Wichtiges zu vernachlässigen (Geburtstage, Kontakte, Lernen, Chancensuche). Läuft unabhängig von Claude als Web-App (PWA) auf dem iPhone. Stil: ruhig, minimalistisch, an iOS angelehnt; hell/dunkel umschaltbar.

## Grundordnung (aktueller Stand)
- **Persönlich:** Gesundheit (Sport-Events + Zeitrechner, Küche mit Rezepten/Einkauf/Orten, Vorsorge-Termine) · Lernen & Wissen (Bibliothek nach Art) · Zuhause (Allgemein: To-dos/Erinnern · Einrichtung · Kleidung) · Finanzen (Märkte, Wechselkurse, Alltags- und Rentenrechner) · Hobbys (Hobbys | Unterhaltung: Filme/Fernsehen/Sport · Will ich sehen | Finden · Wo schauen?) · Reisen (Reisen + Ideen in Gruppen)
- **Sozial:** Treffen (eigene: Geplant/Ideen, Arten Zu Hause/Woanders/Besuch · Von anderen = Einladungen) · Ausgehen (Events + Orte pro Stadt, Orte-Art „Zum Schauen“ = Sportbar/Kino) · Personen (Liste, Im Kontakt bleiben). Die alten Bereiche Familie/Freunde/Neue Kontakte sind nur noch Personen-Kategorien.
- **Professionell:** Karriere (Jobsuche mit Trichter, Eigene Projekte) · Weiterentwicklung (Skills mit To-dos und Material) · Informiert bleiben (Zeitungen nach Land/Rubrik, weitere Quellen)
- Unten: Tab-Leiste Heute · Bereiche · ⚡ (Was möchtest du tun?, halten = sprechen) · Ausgehen · Personen. Oben auf jeder Seite: ＋ Aufgabe, 🔍 Suche, ⚙︎ Einstellungen.
- Wording (Mateo): **Event** = extern, meist mit Ticket → Ausgehen; **Einladung** = Bekannte laden privat ein; **Treffen** = Mateo organisiert selbst. **Besuch** = jemand kommt zu Mateo (Art eines Treffens, mit Zeitraum). **Unterhaltung** = zum Anschauen (TV, Stream, Kino).

## Entscheidungen
- Start als Web-App (Option C), später evtl. native iOS-App (Option B) für Apple Health/Garmin, Siri, Widgets.
- KI-Assistent in der App: Mateo spricht/tippt, die KI macht **Vorschläge**, gespeichert wird erst nach **Bestätigung** (seit v0.11 optional „Direkt ausführen“ mit Rückgängig). Der Assistent darf Einträge anlegen/ändern, aber nie die Grundordnung oder den Code. Kern funktioniert immer ohne KI.
- Mateo hat Claude **Pro** (API wird separat bezahlt). Plan: Haiku für Alltagsbefehle, Sonnet für Planung.
- Pro-Abo statt API? Eigene Apps dürfen das Claude-Abo nicht nutzen (seit Anfang 2026 ausdrücklich verboten) → App braucht API-Schlüssel. **Umgekehrter Weg geplant:** nach der Cloud einen „Custom Connector“ (Remote-MCP-Server auf Supabase) bauen, damit Mateo in der Claude-App (Pro-Abo) direkt mit seinen Life-Daten arbeiten kann; der tägliche Coach bleibt über die API.
- Schnittstellen: WhatsApp nur Chat öffnen (kein Auslesen möglich); Garmin nur über Apple Health in nativer App (Garmin-Entwicklerprogramm pausiert, Strava-API kostenpflichtig); Kalender/E-Mail später.

## Design-Regeln (seit v1.55/1.56, nach Apple-Richtlinien – bei neuen Bildschirmen einhalten)
- Jede tippbare Fläche mind. 44 × 44 Punkte (global über `::after` in `styles.css`; neue kleine Knopf-Klassen dort ergänzen).
- Umschalter mit 2–3 Möglichkeiten: oben `Segmented full` (`.seg.full`), Unterteilung darunter `.sub-switch` (gleicher Stil, kleiner, volle Breite). Viele/zum Wischen (Kategorien, Reiter mit Zahlen): Chips.
- Kräftig blau gefüllt nur die eine Hauptaktion eines Bildschirms/Fensters und das Gewählte; Knöpfe, die sich in jeder Listenzeile wiederholen (Route, Merken, Anmelden …), sind hellblau (`pill` ohne `on`, `btn tint`).
- Zusatztexte mind. 13 px (`.tiny`), Grau `--muted`. Nur Web-App-taugliches übernehmen (kein Liquid Glass, keine Vibration).

## Erinnerungen (seit v1.57)
- Alles mit Datum, das nicht abgehakt wird (Treffen, Besuche, Einladungen, Events, Arzttermine, Sport-Events, Unterhaltung), erscheint **vorab auf Heute** (Standard 1 Tag, `remind` pro Eintrag, `upcomingReminders` in `lib/logic.js`). Neue Bereiche mit Datum dort ergänzen und `RemindPicker` ins Formular.
- Überfälliges (Aufgaben, Erinnerungen, Vorsorge) bleibt auf Heute, bis es abgehakt ist. Echte Push-Mitteilungen erst mit der Cloud.

## Daten-Sicherheit (seit v1.52, nicht aufweichen)
- Echte Daten werden **nie** durch Anfangsdaten überschrieben: Lade-/Umstellungsfehler → Rettungsmodus (`lib/store.js`, `components/StorageGuard.jsx`).
- Speicherfehler sind sichtbar (`SaveErrorBar`). Einmal täglich automatische Kopie in `life-app-v1-auto`.
- Gespeicherte persönliche Daten werden **nicht still gekürzt**. Kürzen ist nur erlaubt für das, was an die KI geschickt wird (Kosten), und für den bewusst kurzen Assistenten-Verlauf.
- Löschen in Listen = Rausnehmen ins Archiv (Kiste), endgültig löschen nur dort.

## Fahrplan und offene Punkte
- **Geplant (Mateo):** die ganze KI durchgehen – Prompts, Modellwahl, wann gesucht wird.
- **Nächste Schritte:** Alle Säulen sind einmal durchgegangen (Stand v0.25). Offen: Kleinigkeiten nach Mateos Test, KI-Durchgang (Prompts/Modellwahl), danach Cloud. Alt: restliche Sozial-Bereiche (Familie, Freunde, Neue Kontakte – laut Mateo reicht dort die Menschen-Funktion) und Professionell (Karriere, Weiterentwicklung, Informiert bleiben) mit Mateo durchgehen; danach Cloud. Alt: Zuhause → Finanzen → Freizeit, dann Sozial und Professionell (jeweils mit Mateo besprechen). Danach Cloud. Bisheriger Vorschlag: nächster Bereich (Weiterentwicklung mit GitHub/Python-Lernpfad), danach Cloud (Supabase) für Push und Suche vor dem Aufwachen.
- **Fahrplan danach:** Phase 2 Cloud (Supabase, Mateo legt das Konto an) + Morgen-Agent mit Websuche (Events in Buenos Aires passend zu Interessen, News zu Radar-Themen, Chancen) + Push-Mitteilungen · Phase 3 E-Mail · Phase 4 Finanzen (zuerst CSV/Excel-Import) · Phase 5 native App für Garmin/Apple Health.
- **Erinnerung:** Wenn Schnittstellen/Datenquellen dran sind, Mateo an Open-Source-Datenquellen erinnern (er wollte den Link zu einer KI-gebauten Weltkarte mit gesammelten Informationen schicken) und nachfragen.
- Logo ändern: Mateo schickt ein Bild → Claude passt `make_icons.py` an bzw. erzeugt die PNGs → Mateo muss die App vom Home-Bildschirm löschen und neu hinzufügen (vorher Sicherung).
- **Als Nächstes (von Mateo genannt):** Garmin-Daten für Sport/Laufen + KI-Auswertung auf Knopfdruck; alle Bereiche durchgehen: Wie kann jeder Bereich Mateo aktiv anschieben? Grundsatz: „Die App passt sich mir an, nicht ich mich der App.“
- Ideen-Parkplatz: E-Mail-Sekretär (Mails priorisieren), wöchentliche KI-Recherche für „Vorgeschlagene Themen“ (kurzer Prompt: max. 5 neue Themen, je 2 Sätze + warum relevant), Kalender schreiben, Sprachsteuerung, Event-Entdeckung, native App.
- **Aus der Code-Prüfung (Nov. 2026) noch offen:** iPhone-Alltagsabläufe komplett durchtesten · Bedienmuster vereinheitlichen (Anlegen/Bearbeiten/Archivieren überall gleich) · große Bildschirm-Dateien (`Reisen.jsx`, `Ausgehen.jsx`) bei Gelegenheit aufteilen · KI-Kontext gezielter auswählen statt „letzte 80 Aufgaben/30 Bücher“ · Speicherung wächst als ein großes Objekt – bei vielen Daten messen.
