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
    system: `Du hilfst Mateo, zum Thema „${topic}“ informiert zu bleiben. Heute ist ${fmtLong(today())}. Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
Wähle die 5–7 wichtigsten aktuellen Blickwinkel/Unterthemen (z.B. Schlüsselfirmen, Regionen, laufende Entwicklungen) und formuliere dafür Nachrichten-Suchbegriffe – in der Sprache, in der es die besten Quellen gibt.`,
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
