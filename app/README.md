# Life – persönliche App (Version 0.2, Web-App)

## Was drin ist

| Bereich | Funktion |
|---|---|
| Heute | Fällige Rhythmen, Aufgaben, Geburtstage, überfällige Kontakte; Ampeln; Rhythmen-Graph (Woche / Monat / 3 Monate) |
| Bereiche | 3 Säulen → Lebensbereiche mit Ampel, Ziel-Rhythmus, Aktivitäts-Heatmap (4 Wochen bis 1 Jahr), Rhythmen, Projekte, Aufgaben, Ressourcen, Unterbereiche |
| Projekte | Mit Vorlagen (Lernprojekt, Treffen organisieren, Reise), Fortschritt, Aufgaben mit Datum, Notizen, Ressourcen, Archiv |
| Erfassen (+) | Schnell notieren → Inbox → einsortieren als Aufgabe, Idee, Notiz/Link oder Person |
| Radar | Eigene Themen, Leseliste (behalten / Lernthema / verwerfen), Event-Pipeline (Entdeckt → Besucht → Kontakt anlegen) |
| Menschen | Kategorien, Kontakt-Rhythmus, Geburtstage, Nachfassen, WhatsApp-Chat per Tipp |
| Einstellungen | Sicherung speichern/laden, Kalender-Datei für den Apple-Kalender, Beispieldaten |

Die Daten liegen in dieser Version **nur auf dem Gerät**. Deshalb regelmäßig „Sicherung speichern“.

## Wie das Repository aufgebaut ist

| Ort | Inhalt |
|---|---|
| Repo-Wurzel (`index.html`, `main.js`, `main.css`, `sw.js`, Icons) | Die fertige App. GitHub Pages liefert genau diese Dateien aus |
| `app/` | Der Quellcode. Hier werden Änderungen gemacht |

`npm run build` (im Ordner `app/`) baut die App und schreibt die fertigen Dateien in die Repo-Wurzel. Nach dem Hochladen zu GitHub ist das Update in 1–2 Minuten live.

## Auf dem iPhone installieren

1. Die Adresse in **Safari** öffnen.
2. **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → *Hinzufügen*.
3. Ab jetzt die App **nur über das Symbol** öffnen. Wichtig: Das Symbol hat einen eigenen Speicher, getrennt von Safari.

Für das iPad genauso. Bis die Cloud-Synchronisation kommt, haben iPhone und iPad getrennte Daten.

## Updates

Änderungen macht Claude direkt im Repository (Quellcode in `app/`, Build in die Wurzel, Commit). Die App lädt das Update beim nächsten oder übernächsten Öffnen. Deine Daten bleiben erhalten.

## Am Mac weiterentwickeln (optional)

```
npm install
npm run dev      # Vorschau auf http://localhost:5173
npm run build    # fertige Version in die Repo-Wurzel
```

## Aufbau des Codes

| Datei | Inhalt |
|---|---|
| `src/lib/seed.js` | Die feste Grundordnung (Säulen, Lebensbereiche, Vorlagen) |
| `src/lib/store.js` | Speicher (hier wird später die Cloud angeschlossen) |
| `src/lib/actions.js` | Alle Änderungen an Daten |
| `src/lib/logic.js` | Ampeln, Rhythmen, Kontakte, Geburtstage |
| `src/screens/` | Ein Bildschirm pro Datei |
