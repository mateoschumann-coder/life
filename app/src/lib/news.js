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
    { id: 'int', label: 'Weltweit', title: 'Internationale Agenturen (Reuters, AP, BBC …)', url: `https://www.google.com/search?q=${enc(`${q} (site:reuters.com OR site:apnews.com OR site:bbc.com OR site:aljazeera.com OR site:dw.com OR site:france24.com)`)}&tbm=nws&tbs=qdr:w` },
    { id: 'asia', label: 'Asien & Nahost', title: 'Sicht aus Asien und Nahost', url: `https://www.google.com/search?q=${enc(`${q} (site:scmp.com OR site:asia.nikkei.com OR site:thediplomat.com OR site:aljazeera.com OR site:thehindu.com OR site:straitstimes.com)`)}&tbm=nws&tbs=qdr:w` },
    { id: 'uk', label: 'Google News', title: 'Großbritannien / international', url: `https://news.google.com/search?q=${enc(q)}&hl=en-GB&gl=GB&ceid=GB:en` },
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
Ziel: Er will Nachrichten aus der GANZEN WELT, nicht nur aus Lateinamerika. Sein Profil hilft beim Gewichten, soll das Thema aber nicht einengen. Formuliere eine Hauptsuche (wird für die festen Links Heute/Woche/Google News benutzt; global, nicht auf eine Region beschränkt) und 6–8 Blickwinkel als Nachrichten-Suchen, die zusammen die Welt abdecken: USA, Europa, China/Asien, Nahost, Afrika, Lateinamerika – je nachdem, wo beim Thema gerade etwas passiert – plus 1–2, die zu seinen Zielen passen. Jeweils in der Sprache mit den besten Quellen (meist Englisch).`,
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

// Weltgeschehen: direkte Links zu internationalen Nachrichtenseiten, nach Regionen (kostenlos)
export const WORLD = [
  { region: 'Weltweit', links: [['Reuters', 'https://www.reuters.com/world/'], ['AP News', 'https://apnews.com/world-news'], ['BBC World', 'https://www.bbc.com/news/world'], ['Google News Welt', 'https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en']] },
  { region: 'Europa', links: [['Tagesschau Ausland', 'https://www.tagesschau.de/ausland'], ['DW', 'https://www.dw.com/en/top-stories/world/s-1429'], ['Le Monde (EN)', 'https://www.lemonde.fr/en/international/'], ['Politico Europe', 'https://www.politico.eu/']] },
  { region: 'Amerika', links: [['NPR World', 'https://www.npr.org/sections/world/'], ['El País América', 'https://elpais.com/america/'], ['La Nación', 'https://www.lanacion.com.ar/mundo/'], ['Infobae', 'https://www.infobae.com/america/mundo/']] },
  { region: 'Asien & Pazifik', links: [['SCMP', 'https://www.scmp.com/news/asia'], ['Nikkei Asia', 'https://asia.nikkei.com/'], ['The Diplomat', 'https://thediplomat.com/'], ['The Hindu World', 'https://www.thehindu.com/news/international/']] },
  { region: 'Nahost & Afrika', links: [['Al Jazeera', 'https://www.aljazeera.com/news/'], ['Middle East Eye', 'https://www.middleeasteye.net/'], ['Africa News', 'https://www.africanews.com/'], ['BBC Africa', 'https://www.bbc.com/news/world/africa']] },
];

// ---------- v0.31: einfach – Hauptseiten der wichtigsten Nachrichtenseiten + eigene Quellen ----------
export const OUTLETS = [
  { region: 'Deutschland', flag: '🇩🇪', list: [
    ['Tagesschau', 'https://www.tagesschau.de'], ['Spiegel', 'https://www.spiegel.de'], ['Zeit', 'https://www.zeit.de'], ['FAZ', 'https://www.faz.net'],
    ['Süddeutsche', 'https://www.sueddeutsche.de'], ['Handelsblatt', 'https://www.handelsblatt.com'], ['Deutschlandfunk', 'https://www.deutschlandfunk.de'],
  ] },
  { region: 'Europa', flag: '🇪🇺', list: [
    ['BBC News', 'https://www.bbc.com/news'], ['The Guardian', 'https://www.theguardian.com/europe'], ['Financial Times', 'https://www.ft.com'], ['Politico Europe', 'https://www.politico.eu'],
    ['Euronews', 'https://www.euronews.com'], ['Le Monde (EN)', 'https://www.lemonde.fr/en/'], ['El País', 'https://elpais.com'], ['NZZ', 'https://www.nzz.ch'],
  ] },
  { region: 'USA', flag: '🇺🇸', list: [
    ['New York Times', 'https://www.nytimes.com'], ['Washington Post', 'https://www.washingtonpost.com'], ['Wall Street Journal', 'https://www.wsj.com'], ['AP News', 'https://apnews.com'],
    ['Reuters', 'https://www.reuters.com'], ['Bloomberg', 'https://www.bloomberg.com'], ['CNN', 'https://edition.cnn.com'], ['NPR', 'https://www.npr.org'],
  ] },
  { region: 'Argentinien', flag: '🇦🇷', list: [
    ['La Nación', 'https://www.lanacion.com.ar'], ['Clarín', 'https://www.clarin.com'], ['Infobae', 'https://www.infobae.com'], ['Página/12', 'https://www.pagina12.com.ar'],
    ['Ámbito', 'https://www.ambito.com'], ['El Cronista', 'https://www.cronista.com'], ['Perfil', 'https://www.perfil.com'], ['Buenos Aires Times', 'https://www.batimes.com.ar'],
  ] },
];
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
export function addSource({ name, url, note = '' }) {
  let u = String(url || '').trim();
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  const n = String(name || '').trim() || host(u);
  if (!n) return null;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  store.update((s) => {
    s.newsSources = s.newsSources || [];
    if (!s.newsSources.some((x) => norm(x.name) === norm(n) || (u && x.url === u))) s.newsSources.push({ id, name: n, url: u, note });
  });
  return id;
}
export const removeSource = (id) => store.update((s) => { s.newsSources = (s.newsSources || []).filter((x) => x.id !== id); });
