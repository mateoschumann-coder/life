# Life-App – Projektbeschreibung für Claude

Diese Datei ist das Gedächtnis des Projekts. Jeder neue Chat liest sie zuerst und hält sie aktuell, wenn sich Konzept, Entscheidungen oder Stand ändern.

## Zusammenarbeit
- Sprache: **Deutsch**. Mateo mag konkrete Beispiele, Schritt-für-Schritt-Erklärungen, Tabellen und Grafiken; keine Fachbegriffe ohne Erklärung.
- Mateo programmiert nicht selbst. Claude ändert Code, testet, baut und lädt hoch. Erklärungen für Mateo immer ohne Terminal-Befehle.
- Fehler, die Mateo findet, direkt benennen und beheben.
- Änderungen an der App: Quellcode in `app/`, dann `cd app && node build.mjs --out ..` (schreibt die fertige App in die Repo-Wurzel), testen, committen, pushen. GitHub Pages veröffentlicht automatisch: https://mateoschumann-coder.github.io/life/
- Nur Mateos iPhone ist wichtig (iPad-Synchronisation bewusst übersprungen, Stand Okt. 2026).

## Ziel der App
Persönliche App, um Privates, Soziales und Professionelles zu organisieren, effizienter zu sein und nichts Wichtiges zu vernachlässigen (Geburtstage, Kontakte, Lernen, Chancensuche). Läuft unabhängig von Claude als Web-App (PWA) auf dem iPhone. Stil: hell, ruhig, minimalistisch, an iOS angelehnt; dunkler Modus automatisch.

## Grundordnung (fest, nur bewusst in Einstellungen änderbar)
- **Persönlich:** Körperliche Gesundheit (Sport, Ernährung, Schlaf, Vorsorge) · Mentale Gesundheit · Zuhause (Ordnung, Einrichtung & Design, Kleidung) · Finanzen (Budget, Investments, Verträge) · Freizeit und Erlebnisse (Reisen, Kultur, Hobbys)
- **Sozial:** Familie · Freunde · Neue Kontakte · Gemeinsame Erlebnisse (Treffen planen, Events)
- **Professionell:** Karriere und Chancen · Weiterentwicklung (Sprachen: Portugiesisch, Italienisch; Python/ML; KI anwenden; eigene Projekte) · Informiert bleiben (eigene Themen + vorgeschlagene Themen)
- Ebenen: Säule → Lebensbereich → Unterbereich → Projekte/Einträge. Querverbindungen über Tags.
- **Lebensbereiche** sind dauerhaft und haben eine Ampel (Ziel-Rhythmus in Tagen; gelb ab Ziel, rot ab doppeltem Ziel, grau = pausiert). **Projekte** haben ein Ende und werden archiviert.

## Bausteine (Datenmodell, `app/src/lib/seed.js`)
Aufgabe (auch Idee) · Rhythmus (x-mal pro Woche/Monat, Check-ins) · Person (Kategorie, Geburtstag, Kontakt-Rhythmus, Kontakte, Nachfassen, Telefon → WhatsApp-Link) · Projekt (mit Vorlagen) · Ressource (Link/Notiz, Tags) · Radar (Themen, Leseliste, Event-Pipeline Entdeckt→Interessiert→Zugesagt→Besucht) · Inbox (schnell erfassen, später einsortieren). Alle Einträge können einem Unterbereich zugeordnet sein (`subId`).

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
- v0.5: **Schwebender Assistent** (`components/FloatingAssistant.jsx`) auf allen Bildschirmen außer dem Chat: 1. Tipp = zuhören, 2. Tipp = senden, Antwort + Vorschlagskarte im kleinen Fenster. Gemeinsamer Gesprächszustand in `lib/chat.js` (Chat und Knopf teilen alles). **Vorlesen** über die iPhone-Sprachausgabe (an/aus per Lautsprecher-Symbol, `speak` in `life-app-ai`). Antworten bewusst knapp: max. 3 kurze Sätze oder 5 Stichpunkte, kein Markdown (Systemprompt in `lib/ai.js`).
- **Als Nächstes:** Rückmeldung zum Assistenten im Alltag einarbeiten; danach Ideen-Parkplatz.
- Ideen-Parkplatz: E-Mail-Sekretär (Mails priorisieren), wöchentliche KI-Recherche für „Vorgeschlagene Themen“ (kurzer Prompt: max. 5 neue Themen, je 2 Sätze + warum relevant), Kalender schreiben, Sprachsteuerung, Event-Entdeckung, native App.
