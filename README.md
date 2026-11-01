# Life

**Eine persönliche App, die den Alltag aktiv mitorganisiert** – Termine, Menschen, Ausgehen, Reisen, Küche, Karriere und Weiterlernen an einem Ort, mit einer KI, die einträgt, sucht und Vorschläge macht.

[![Prüfen](https://github.com/mateoschumann-coder/life/actions/workflows/check.yml/badge.svg)](https://github.com/mateoschumann-coder/life/actions/workflows/check.yml)
· Version 1.54 · Web-App fürs iPhone · **Live:** https://mateoschumann-coder.github.io/life/

---

## Idee

Life ist keine Dokumentations-App, in die man viel einträgt. Die App soll möglichst wenig Zeit kosten: kurz sprechen oder tippen, die KI sortiert ein, macht konkrete Vorschläge, und man bestätigt mit einem Tipp. Alles ist auf eine Person zugeschnitten und nach drei Säulen geordnet.

| Säule | Bereiche |
|---|---|
| **Persönlich** | Gesundheit (Sport-Events, Zeitrechner, Küche mit Rezepten und Einkaufslisten, Arzttermine) · Lernen & Wissen · Zuhause · Finanzen · Hobbys · Reisen |
| **Sozial** | Treffen organisieren (Gäste, Einkauf, Einladung per WhatsApp) · Einladungen von anderen · Ausgehen (Events und Lieblingsorte pro Stadt) · Personen (Kontakt-Rhythmen, Geburtstage) |
| **Professionell** | Jobsuche mit Bewerbungs-Trichter · Eigene Projekte · Weiterentwicklung (Skills) · Informiert bleiben |

**Heute** zeigt Aufgaben im Wochen- oder Monatskalender und einen Überblick über alle Bereiche. Ein Assistent (sprechen oder tippen) legt Einträge überall in der App an.

## Daten und Datenschutz

- Alle Daten liegen **nur auf dem Gerät** (Browser-Speicher). Es gibt keinen Server und kein Konto.
- Die KI läuft über einen eigenen Claude-API-Schlüssel, der nur auf dem Gerät gespeichert wird.
- **Sicherung:** Einstellungen → Sicherung speichern/laden (JSON-Datei). Zusätzlich legt die App täglich eine automatische Kopie an. Kann sie die Daten einmal nicht lesen, startet sie im Rettungsmodus und überschreibt nichts.
- Dieses Repository ist öffentlich und enthält **keine persönlichen Daten und keine Schlüssel**.

## Auf dem iPhone installieren

1. Die Live-Adresse in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm** → *Hinzufügen*.
3. Die App nur über das Symbol öffnen (sie hat einen eigenen Speicher, getrennt von Safari).

Updates kommen automatisch beim nächsten Öffnen; die Daten bleiben erhalten.

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
cd app
npm install
npm run dev     # Vorschau auf http://localhost:5173
npm test        # automatische Tests (Speichern, Sicherung, Suche)
npm run build   # fertige App in die Repo-Wurzel schreiben
```

Nach dem Push auf `main` prüft GitHub die Tests und veröffentlicht die App über GitHub Pages (1–2 Minuten).

| Ort | Inhalt |
|---|---|
| `app/src/` | Quellcode (React): `screens/` Bildschirme, `components/` Bausteine, `lib/` Logik |
| `app/test/` | Automatische Tests |
| Repo-Wurzel (`index.html`, `main.js`, `main.css`, `sw.js`, Icons) | Gebaute App für GitHub Pages – wird erzeugt, nicht von Hand ändern |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Technischer Aufbau: Speicher, Sicherung, Suche, KI |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Versionsgeschichte (v0.1 bis heute) |
| [`CLAUDE.md`](CLAUDE.md) | Projektwissen und Arbeitsregeln für Claude, das die App weiterentwickelt |

## Technik in Kürze

React 19 + esbuild, sonst keine Bibliotheken. Daten in `localStorage`, KI über die Claude-API (Haiku als Standard, Sonnet für „Gründlich“), Karten- und Ortsdaten von OpenStreetMap, Wetter von Open-Meteo, Börsenkurse optional über Twelve Data.

## Fahrplan

Cloud-Synchronisation und Morgen-Briefing mit automatischer Suche (Supabase) · E-Mail · Finanzdaten-Import · native iOS-App für Apple Health/Garmin.
