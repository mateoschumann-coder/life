// Informiert bleiben: Themenbereiche → strukturierte Nachrichten-Links (Google News, letzte 24 h, Woche, Sprachen, YouTube)
// Ganz ohne KI-Kosten; optional schlägt die KI (ohne Websuche) gezielte Blickwinkel pro Thema vor.
import { store } from './store';
import { fmtLong, today } from './dates';
import { aiLinks } from './links';

const enc = encodeURIComponent;
const norm = (x) => String(x || '').trim().toLowerCase();
export const topicsOf = (s) => s.radar?.topics || [];
export function addTopic(name) {
  const n = String(name || '').trim();
  if (!n) return;
  store.update((s) => { if (!s.radar.topics.some((t) => norm(t) === norm(n))) s.radar.topics.push(n); });
}
export const removeTopic = (name) => store.update((s) => { s.radar.topics = s.radar.topics.filter((t) => t !== name); });

// Feste Links pro Thema (kostenlos)
export function topicLinks(q) {
  // q = zugeschnittene Hauptsuche (falls vorhanden) oder das Thema selbst
  return [
    { id: 'd', label: 'Heute', title: 'Letzte 24 Stunden', url: `https://www.google.com/search?q=${enc(q)}&tbm=nws&tbs=qdr:d` },
    { id: 'w', label: 'Woche', title: 'Diese Woche', url: `https://www.google.com/search?q=${enc(q)}&tbm=nws&tbs=qdr:w` },
    { id: 'de', label: 'Google News', title: 'Deutsch', url: `https://news.google.com/search?q=${enc(q)}&hl=de&gl=DE&ceid=DE:de` },
    { id: 'en', label: 'Google News', title: 'Englisch', url: `https://news.google.com/search?q=${enc(q)}&hl=en-US&gl=US&ceid=US:en` },
    { id: 'es', label: 'Google News', title: 'Spanisch (Argentinien)', url: `https://news.google.com/search?q=${enc(q)}&hl=es-419&gl=AR&ceid=AR:es-419` },
    { id: 'a', label: 'Hintergrund', title: 'Analysen & Erklärstücke (Monat)', url: `https://www.google.com/search?q=${enc(`${q} (Analyse OR analysis OR explainer)`)}&tbm=nws&tbs=qdr:m` },
    { id: 'yt', label: 'YouTube', title: 'Neueste Videos', url: `https://www.youtube.com/results?search_query=${enc(q)}&sp=CAI%253D` },
  ];
}

// KI-Blickwinkel: 5–7 gezielte Suchen zu Unterthemen (ohne Websuche, ca. 0,1 Cent), pro Thema gespeichert
const KEY = 'life-app-newsangles';
export function loadAngles() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
export async function topicAngles(s, topic) {
  const r = await aiLinks({
    s,
    system: `Du hilfst Mateo, zum Thema „${topic}“ informiert zu bleiben. Heute ist ${fmtLong(today())}.
Ziel: Nachrichten, die für IHN relevant sind – passend zu seinem Hintergrund, seinen Zielen (z.B. Jobsuche, Projekte, Lernen) und seinem Wohnort. Formuliere eine zugeschnittene Hauptsuche (wird für die festen Links Heute/Woche/Google News benutzt) und 5–7 Blickwinkel/Unterthemen (Schlüsselfirmen, Regionen, laufende Entwicklungen, was für seine Ziele zählt) als Nachrichten-Suchen – jeweils in der Sprache mit den besten Quellen.`,
    user: `Thema: ${topic}`,
    platforms: ['google_news', 'google_news_en', 'google_news_es', 'news_woche', 'youtube'],
    label: 'News: Blickwinkel',
  });
  const all = loadAngles();
  all[topic] = { date: today(), ...r };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  return all[topic];
}
