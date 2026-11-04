# Technischer Aufbau

Life ist eine Web-App (PWA) ohne eigenen Server. Sie läuft komplett im Browser auf dem iPhone. Daten liegen nur auf dem Gerät, KI-Anfragen gehen direkt vom Gerät an die Claude-API.

```
iPhone (Home-Bildschirm)
 └─ index.html + main.js + main.css   ← von GitHub Pages ausgeliefert (Repo-Wurzel)
     ├─ localStorage „life-app-v1“    ← alle Daten als ein JSON-Objekt
     ├─ localStorage „life-*“         ← Geräte-Einstellungen (KI-Schlüssel, Aussehen, gemerkte Reiter …)
     └─ fetch → api.anthropic.com     ← KI (Schlüssel nur auf dem Gerät)
               OpenStreetMap/Nominatim, Open-Meteo, Twelve Data … (kostenlose Dienste)
```

## Ordner

| Ort | Inhalt |
|---|---|
| `app/src/main.jsx` | Start: Theme, Feld-Werkzeuge, Update-Prüfung, Service Worker |
| `app/src/App.jsx` | Router (Hash-Adressen wie `#/kueche`), globale Bausteine (Assistent, Suche, Aufgaben-Fenster, Speicherschutz) |
| `app/src/screens/` | Ein Bildschirm pro Datei (Heute, Ausgehen, Reisen, Küche …) |
| `app/src/components/` | Wiederverwendbare Bausteine (Fenster, Suchkarte, KI-Chat `PlanChat`, KI-Ausfüller `AiFill` …) |
| `app/src/lib/` | Logik ohne Oberfläche: Daten ändern, KI-Aufrufe, Berechnungen |
| `app/public/` | Statische Dateien (Icons, Manifest, Service Worker `sw.js`) |
| `app/test/` | Automatische Tests (`npm test`) |
| Repo-Wurzel | Gebaute App für GitHub Pages – **nicht von Hand ändern**, wird von `node build.mjs --out ..` erzeugt |

## Speicher (`lib/store.js`)

- Ein globaler Zustand `state`; Änderungen nur über `store.update(fn)` (bekommt eine Kopie) bzw. die Funktionen in `lib/actions.js` und den Bereichs-Dateien.
- Gespeichert wird 150 ms nach der letzten Änderung (und sofort beim Verlassen der App).
- `migrate()` bringt ältere Stände auf das aktuelle Format; einmalige Umstellungen merken sich ein Kennzeichen in `s.profile.migXXX`.
- **Schutz (v1.52):**

| Situation | Verhalten |
|---|---|
| Nichts gespeichert | Neuer Start mit der Grundordnung (`seed()`) |
| Daten beschädigt / Umstellung scheitert | **Rettungsmodus**: Speichern gesperrt, Rohdaten bleiben unter `life-app-v1` und Kopie in `life-app-v1-rescue`; `StorageGuard` zeigt Sicherung laden · automatische Sicherung laden · Rohdaten herunterladen · leer neu starten |
| Speichern scheitert (z.B. voll) | `storage.get().saveError` → rote Leiste `SaveErrorBar` mit „Nochmal“ |
| Jeder erfolgreiche Start | höchstens einmal am Tag Kopie des geladenen Stands in `life-app-v1-auto` |

## Sicherung (`lib/backup.js`)

`makeBackup(state, {device})` / `parseBackup(text)` / `summarize(state)`. „Komplett“ nimmt alle `life-*`-Geräteschlüssel mit (außer Zwischenspeicher `life-td-*` und `life-app-v1-*`). Laden geht über `storage.restore(state)` (beendet auch den Rettungsmodus).

## Suche (`lib/search.js`)

`searchIndex(s, {all})` baut pro Bereich Einträge `{title, extra, sub, to, old}`. `to` beschreibt das Ziel als Daten (`route`, `ls`, `ss`, `city`); `components/GlobalSearch.jsx` setzt die Schlüssel und springt. Mit `all` auch Erledigtes, Archiviertes, Rausgenommenes.

## Seiten-Signale

- `localStorage life-app-…`: gemerkte Reiter/Filter (z.B. `life-app-kueche-tab`).
- `sessionStorage` + `lib/flags.js` (`takeFlag`): Einmal-Signale beim Seitenwechsel, z.B. `life-open-new-place` (Formular öffnen), `life-open-recipe` (bestimmtes Rezept öffnen), `life-search-q` (Suchbegriff übernehmen).
- Fenster-Ereignisse: `life-quick-task`, `life-search`, `life-ask` (Frage an den Assistenten), `life-remount` (Seite neu aufbauen).

## KI

| Datei | Aufgabe |
|---|---|
| `lib/ai.js` | Assistent (Werkzeug `aenderungen_vorschlagen`), Kontext der App-Daten, Kosten, Modellwahl, `fitModel` (Sonnet ohne erzwungenes Werkzeug) |
| `lib/apply.js` | Vorschläge der KI lesbar machen und ausführen; Sprung zum neuen Eintrag |
| `lib/chat.js` | Gesprächszustand + Spracherkennung des Assistenten (frische Sitzung bei jedem Öffnen) |
| `lib/outings.js` → `searchWithTool` | Gemeinsamer Aufruf für alle Bereichs-KIs: erzwungenes Werkzeug, optional Websuche (`maxUses`) oder Seite lesen (`fetch`), Weiterleiten an den Assistenten |
| `lib/formfill.js` | Ein KI-Ausfüller für jedes Formular (`AiFill`) |
| `components/PlanChat.jsx` | Bereichs-Chats mit Vorschlägen zum Übernehmen |

Grundsätze: Haiku ohne Internet als Standard (Bruchteile eines Cents); Websuche nur auf ausdrücklichen Knopfdruck; kostenlose Links (`lib/sources.js`) wo möglich. Kosten pro Funktion stehen in den Einstellungen.

## Erinnerungen und Unterhaltung (v1.57)

- `upcomingReminders(s, t)` in `lib/logic.js` sammelt alles, was innerhalb der Vorlaufzeit liegt (`remind` am Eintrag, sonst `s.profile.remindDefault`, Standard 1 Tag); `screens/Heute.jsx` zeigt es unter den heutigen Einträgen.
- Unterhaltung: Daten `s.shows`, Logik und KI-Suche in `lib/shows.js`, Bildschirm `screens/Unterhaltung.jsx` (Reiter bei Hobbys; Arten Filme/Fernsehen/Sport, „Wo schauen?“ nutzt Orte der Art „Zum Schauen“), Links in `SOURCE_AREAS.tv_film`/`tv_tv`/`tv_sport` (`noCity` = Stadt nicht anhängen).

## Tests

`cd app && npm test` bündelt jede `test/*.test.js` mit esbuild und startet `node --test`. Ein nachgebauter Browser-Speicher (`test/helpers.js`, `FakeStorage`) erlaubt Szenarien wie „Daten beschädigt“ oder „Speicher voll“. Jede Store-Situation steht in einer eigenen Datei, weil der Speicher beim Import einmal lädt. Auf GitHub laufen die Tests automatisch bei jedem Push (`.github/workflows/check.yml`).

## Abhängigkeiten

Nur React (Oberfläche) und esbuild (Bauen) – Versionen fest in `app/package.json`. Keine weiteren Bibliotheken; Karten, Charts, Kalender usw. sind selbst gebaut.
