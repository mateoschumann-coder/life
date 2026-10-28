// Informiert bleiben: Themenbereiche → strukturierte Nachrichten-Links (Google News, letzte 24 h, Woche, Sprachen, YouTube)
// Ganz ohne KI-Kosten; optional schlägt die KI (ohne Websuche) gezielte Blickwinkel pro Thema vor.
import { store, uid } from './store';
import { searchWithTool } from './outings';
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

// ---------- v0.31/v0.90: Hauptseiten der wichtigsten Nachrichtenseiten – jetzt mit Rubriken ----------
// Rubrik direkt (Pfad bekannt) oder über Google News nur auf dieser Seite (letzte Woche)
export const RUBRIKEN = [
  { id: 'start', label: 'Startseite' },
  { id: 'politik', label: 'Politik', w: { de: 'Politik', en: 'politics', es: 'política', it: 'politica', fr: 'politique', pt: 'política' } },
  { id: 'wirtschaft', label: 'Wirtschaft', w: { de: 'Wirtschaft', en: 'business economy', es: 'economía', it: 'economia', fr: 'économie', pt: 'economia' } },
  { id: 'tech', label: 'Tech & KI', w: { de: 'Technologie KI', en: 'technology AI', es: 'tecnología inteligencia artificial', it: 'tecnologia', fr: 'technologie', pt: 'tecnologia' } },
  { id: 'sport', label: 'Sport', w: { de: 'Sport', en: 'sport', es: 'deportes', it: 'sport', fr: 'sport', pt: 'esportes' } },
  { id: 'kultur', label: 'Kultur', w: { de: 'Kultur', en: 'culture', es: 'cultura', it: 'cultura', fr: 'culture', pt: 'cultura' } },
  { id: 'wissen', label: 'Wissenschaft', w: { de: 'Wissenschaft', en: 'science', es: 'ciencia', it: 'scienza', fr: 'science', pt: 'ciência' } },
];
const o = (name, url, lang, sec = {}) => ({ name, url, lang, sec });
export const OUTLETS = [
  { region: 'Deutschland', flag: '🇩🇪', list: [
    o('Tagesschau', 'https://www.tagesschau.de', 'de', { politik: '/inland', wirtschaft: '/wirtschaft', tech: '/wissen/technologie', sport: 'https://www.sportschau.de', wissen: '/wissen' }),
    o('Spiegel', 'https://www.spiegel.de', 'de', { politik: '/politik/', wirtschaft: '/wirtschaft/', tech: '/netzwelt/', sport: '/sport/', kultur: '/kultur/', wissen: '/wissenschaft/' }),
    o('Zeit', 'https://www.zeit.de', 'de', { politik: '/politik/index', wirtschaft: '/wirtschaft/index', tech: '/digital/index', sport: '/sport/index', kultur: '/kultur/index', wissen: '/wissen/index' }),
    o('FAZ', 'https://www.faz.net', 'de', { politik: '/aktuell/politik/', wirtschaft: '/aktuell/wirtschaft/', sport: '/aktuell/sport/', kultur: '/aktuell/feuilleton/', wissen: '/aktuell/wissen/' }),
    o('Süddeutsche', 'https://www.sueddeutsche.de', 'de', { politik: '/politik', wirtschaft: '/wirtschaft', sport: '/sport', kultur: '/kultur', wissen: '/wissen' }),
    o('Handelsblatt', 'https://www.handelsblatt.com', 'de', { politik: '/politik/', wirtschaft: '/unternehmen/', tech: '/technik/' }),
    o('Deutschlandfunk', 'https://www.deutschlandfunk.de', 'de'),
  ] },
  { region: 'Europa', flag: '🇪🇺', list: [
    o('BBC News', 'https://www.bbc.com/news', 'en', { wirtschaft: 'https://www.bbc.com/business', tech: 'https://www.bbc.com/innovation', sport: 'https://www.bbc.com/sport', kultur: 'https://www.bbc.com/culture' }),
    o('The Guardian', 'https://www.theguardian.com/europe', 'en', { politik: 'https://www.theguardian.com/world', wirtschaft: 'https://www.theguardian.com/business', tech: 'https://www.theguardian.com/technology', sport: 'https://www.theguardian.com/sport', kultur: 'https://www.theguardian.com/culture', wissen: 'https://www.theguardian.com/science' }),
    o('Financial Times', 'https://www.ft.com', 'en', { politik: '/world', tech: '/technology', wirtschaft: '/companies' }),
    o('Politico Europe', 'https://www.politico.eu', 'en'),
    o('Euronews', 'https://www.euronews.com', 'en', { wirtschaft: '/business', kultur: '/culture' }),
    o('Le Monde (EN)', 'https://www.lemonde.fr/en/', 'en'),
    o('El País', 'https://elpais.com', 'es', { wirtschaft: '/economia/', tech: '/tecnologia/', sport: '/deportes/', kultur: '/cultura/', wissen: '/ciencia/' }),
    o('NZZ', 'https://www.nzz.ch', 'de', { politik: '/international', wirtschaft: '/wirtschaft', tech: '/technologie', sport: '/sport', kultur: '/feuilleton', wissen: '/wissenschaft' }),
  ] },
  { region: 'USA', flag: '🇺🇸', list: [
    o('New York Times', 'https://www.nytimes.com', 'en', { politik: '/section/politics', wirtschaft: '/section/business', tech: '/section/technology', sport: '/section/sports', kultur: '/section/arts', wissen: '/section/science' }),
    o('Washington Post', 'https://www.washingtonpost.com', 'en', { politik: '/politics/', wirtschaft: '/business/', tech: '/technology/', sport: '/sports/', wissen: '/science/' }),
    o('Wall Street Journal', 'https://www.wsj.com', 'en', { politik: '/politics', wirtschaft: '/business', tech: '/tech', sport: '/sports' }),
    o('AP News', 'https://apnews.com', 'en', { politik: '/politics', wirtschaft: '/business', tech: '/technology', sport: '/sports', kultur: '/entertainment', wissen: '/science' }),
    o('Reuters', 'https://www.reuters.com', 'en', { politik: '/world/', wirtschaft: '/business/', tech: '/technology/', sport: '/sports/', wissen: '/science/' }),
    o('Bloomberg', 'https://www.bloomberg.com', 'en', { politik: '/politics', tech: '/technology' }),
    o('CNN', 'https://edition.cnn.com', 'en', { politik: '/politics', wirtschaft: '/business', tech: '/business/tech', sport: '/sport', kultur: '/entertainment', wissen: '/science' }),
    o('NPR', 'https://www.npr.org', 'en', { politik: '/sections/politics/', wirtschaft: '/sections/business/', tech: '/sections/technology/', kultur: '/sections/arts/', wissen: '/sections/science/' }),
  ] },
  { region: 'Argentinien', flag: '🇦🇷', list: [
    o('La Nación', 'https://www.lanacion.com.ar', 'es', { politik: '/politica/', wirtschaft: '/economia/', tech: '/tecnologia/', sport: '/deportes/', kultur: '/cultura/', wissen: '/ciencia/' }),
    o('Clarín', 'https://www.clarin.com', 'es', { politik: '/politica/', wirtschaft: '/economia/', tech: '/tecnologia/', sport: '/deportes/', kultur: '/cultura/' }),
    o('Infobae', 'https://www.infobae.com', 'es', { politik: '/politica/', wirtschaft: '/economia/', tech: '/tecno/', sport: '/deportes/', kultur: '/cultura/' }),
    o('Página/12', 'https://www.pagina12.com.ar', 'es'),
    o('Ámbito', 'https://www.ambito.com', 'es'),
    o('El Cronista', 'https://www.cronista.com', 'es'),
    o('Perfil', 'https://www.perfil.com', 'es'),
    o('Buenos Aires Times', 'https://www.batimes.com.ar', 'en'),
  ] },
];
// Link einer Zeitung für eine Rubrik: { url, direct } – direct = echte Rubrik-Seite, sonst Google-News-Suche auf der Seite
export function outletLink(x, rubrik = 'start') {
  if (rubrik === 'start') return { url: x.url, direct: true };
  const p = (x.sec || {})[rubrik];
  if (p) return { url: /^https?:/.test(p) ? p : new URL(p, new URL(x.url).origin).href, direct: true };
  const r = RUBRIKEN.find((y) => y.id === rubrik) || (store.get().profile?.newsRubriken?.added || []).find((y) => y.id === rubrik);
  const q = `site:${host(x.url)} ${r?.w?.[x.lang] || r?.label || ''}`;
  return { url: `https://www.google.com/search?q=${enc(q)}&tbm=nws&tbs=qdr:w`, direct: false };
}

// ---------- v0.90: Quellen nach Art und Thema (Auswahl von Claude) + eigene Quellen ----------
export const SOURCE_TYPES = [
  { id: 'newsletter', label: 'Newsletter', emoji: '✉️' },
  { id: 'blog', label: 'Blog', emoji: '✍️' },
  { id: 'podcast', label: 'Podcast', emoji: '🎧' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'magazin', label: 'Magazin', emoji: '📰' },
  { id: 'thinktank', label: 'Think Tank', emoji: '🏛' },
];
export const SOURCE_TOPICS = ['Wirtschaft', 'Geopolitik', 'KI', 'Startups'];
const c = (name, url, type, topics, lang, note) => ({ id: `c-${name}`, name, url, type, topics, lang, note, curated: true });
export const CURATED = [
  // Wirtschaft
  c('The Economist', 'https://www.economist.com', 'magazin', ['Wirtschaft', 'Geopolitik'], 'EN', 'Wöchentlich: Weltwirtschaft und Politik, gut erklärt'),
  c('Financial Times', 'https://www.ft.com', 'magazin', ['Wirtschaft'], 'EN', 'Märkte, Unternehmen, Wirtschaftspolitik'),
  c('brand eins', 'https://www.brandeins.de', 'magazin', ['Wirtschaft', 'Startups'], 'DE', 'Wirtschaftsmagazin mit Tiefgang'),
  c('Money Stuff (Matt Levine)', 'https://www.bloomberg.com/account/newsletters/money-stuff', 'newsletter', ['Wirtschaft'], 'EN', 'Finanzwelt unterhaltsam erklärt, werktäglich'),
  c('Noahpinion', 'https://www.noahpinion.blog', 'newsletter', ['Wirtschaft', 'Geopolitik'], 'EN', 'Ökonom Noah Smith: Wirtschaft, Industriepolitik, China'),
  c('Marginal Revolution', 'https://marginalrevolution.com', 'blog', ['Wirtschaft'], 'EN', 'Ökonomen-Blog (Tyler Cowen), täglich viele Links'),
  c('Planet Money', 'https://www.npr.org/podcasts/510289/planet-money', 'podcast', ['Wirtschaft'], 'EN', 'Wirtschaft in kurzen Geschichten'),
  c('Odd Lots', 'https://www.bloomberg.com/oddlots', 'podcast', ['Wirtschaft'], 'EN', 'Bloomberg-Podcast zu Märkten und Wirtschaft'),
  c('Finanzfluss', 'https://www.youtube.com/@Finanzfluss', 'youtube', ['Wirtschaft'], 'DE', 'Geldanlage und Finanzen verständlich'),
  c('Patrick Boyle', 'https://www.youtube.com/@PBoyle', 'youtube', ['Wirtschaft'], 'EN', 'Finanzmärkte, trocken-humorvoll erklärt'),
  // Geopolitik
  c('Foreign Affairs', 'https://www.foreignaffairs.com', 'magazin', ['Geopolitik'], 'EN', 'Das Fachmagazin für Außenpolitik'),
  c('Foreign Policy', 'https://foreignpolicy.com', 'magazin', ['Geopolitik'], 'EN', 'Analysen zu Weltpolitik, oft aktueller'),
  c('Internationale Politik', 'https://internationalepolitik.de', 'magazin', ['Geopolitik'], 'DE', 'Deutsches Magazin für Außenpolitik (DGAP)'),
  c('War on the Rocks', 'https://warontherocks.com', 'blog', ['Geopolitik'], 'EN', 'Sicherheitspolitik und Strategie'),
  c('ChinaTalk', 'https://www.chinatalk.media', 'newsletter', ['Geopolitik', 'KI'], 'EN', 'China, Technologie und Politik'),
  c('Sinocism', 'https://sinocism.com', 'newsletter', ['Geopolitik'], 'EN', 'Täglicher China-Überblick'),
  c('Lage der Nation', 'https://lagedernation.org', 'podcast', ['Geopolitik'], 'DE', 'Wöchentlicher Politik-Podcast'),
  c('Caspian Report', 'https://www.youtube.com/@CaspianReport', 'youtube', ['Geopolitik'], 'EN', 'Geopolitik mit Karten erklärt'),
  c('Perun', 'https://www.youtube.com/@PerunAU', 'youtube', ['Geopolitik'], 'EN', 'Verteidigung und Kriegsökonomie, sehr gründlich'),
  c('SWP Berlin', 'https://www.swp-berlin.org', 'thinktank', ['Geopolitik'], 'DE', 'Stiftung Wissenschaft und Politik'),
  c('Carnegie Endowment', 'https://carnegieendowment.org', 'thinktank', ['Geopolitik'], 'EN', 'Internationaler Think Tank, Analysen weltweit'),
  // KI
  c('Import AI', 'https://jack-clark.net', 'newsletter', ['KI'], 'EN', 'Wöchentlich: KI-Forschung und Politik (Jack Clark)'),
  c('The Batch', 'https://www.deeplearning.ai/the-batch/', 'newsletter', ['KI'], 'EN', 'Wöchentliche KI-News von Andrew Ng'),
  c('One Useful Thing', 'https://www.oneusefulthing.org', 'newsletter', ['KI'], 'EN', 'Ethan Mollick: KI praktisch anwenden'),
  c('Simon Willison', 'https://simonwillison.net', 'blog', ['KI'], 'EN', 'Sehr praxisnah: neue KI-Modelle und Werkzeuge'),
  c('Stratechery', 'https://stratechery.com', 'blog', ['KI', 'Startups'], 'EN', 'Strategie von Tech-Firmen (Ben Thompson)'),
  c('The Decoder', 'https://the-decoder.de', 'magazin', ['KI'], 'DE', 'KI-Nachrichten auf Deutsch'),
  c('Latent Space', 'https://www.latent.space', 'podcast', ['KI'], 'EN', 'Podcast für KI-Ingenieure'),
  c('Dwarkesh Podcast', 'https://www.dwarkesh.com', 'podcast', ['KI', 'Geopolitik'], 'EN', 'Lange Gespräche mit Forschern und Denkern'),
  c('Hard Fork', 'https://www.nytimes.com/column/hard-fork', 'podcast', ['KI'], 'EN', 'NYT-Tech-Podcast, wöchentlich'),
  c('Two Minute Papers', 'https://www.youtube.com/@TwoMinutePapers', 'youtube', ['KI'], 'EN', 'Neue KI-Forschung in Kurzvideos'),
  c('Andrej Karpathy', 'https://www.youtube.com/@AndrejKarpathy', 'youtube', ['KI'], 'EN', 'Wie Sprachmodelle funktionieren – zum Lernen'),
  // Startups
  c('Paul Graham Essays', 'https://paulgraham.com/articles.html', 'blog', ['Startups'], 'EN', 'Klassiker zu Gründen und Startups'),
  c("Lenny's Newsletter", 'https://www.lennysnewsletter.com', 'newsletter', ['Startups'], 'EN', 'Produkt, Wachstum, Karriere in Startups'),
  c('Not Boring', 'https://www.notboring.co', 'newsletter', ['Startups', 'Wirtschaft'], 'EN', 'Tiefe Analysen zu Startups und Tech-Strategie'),
  c('a16z', 'https://a16z.com', 'blog', ['Startups', 'KI'], 'EN', 'Blog und Podcasts des VC Andreessen Horowitz'),
  c('Y Combinator', 'https://www.youtube.com/@ycombinator', 'youtube', ['Startups'], 'EN', 'Vorträge und Tipps zum Gründen'),
  c('Sifted', 'https://sifted.eu', 'magazin', ['Startups'], 'EN', 'Europäische Startup- und VC-Szene'),
  c('Gründerszene', 'https://www.businessinsider.de/gruenderszene/', 'magazin', ['Startups'], 'DE', 'Deutsche Startup-Szene'),
  c('TechCrunch', 'https://techcrunch.com', 'magazin', ['Startups', 'KI'], 'EN', 'Finanzierungsrunden und Tech-News'),
  c('Acquired', 'https://www.acquired.fm', 'podcast', ['Startups', 'Wirtschaft'], 'EN', 'Große Firmengeschichten im Detail'),
  c('20VC', 'https://www.thetwentyminutevc.com', 'podcast', ['Startups'], 'EN', 'Interviews mit Investoren und Gründern'),
  c('LAVCA', 'https://www.lavca.org', 'thinktank', ['Startups'], 'EN', 'Venture Capital in Lateinamerika'),
];
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
export function addSource({ name, url, note = '', type = '', topics = [] }) {
  let u = String(url || '').trim();
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  const n = String(name || '').trim() || host(u);
  if (!n) return null;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  store.update((s) => {
    s.newsSources = s.newsSources || [];
    if (!s.newsSources.some((x) => norm(x.name) === norm(n) || (u && x.url === u))) s.newsSources.push({ id, name: n, url: u, note, type, topics });
  });
  return id;
}
export const removeSource = (id) => store.update((s) => { s.newsSources = (s.newsSources || []).filter((x) => x.id !== id); });

// ---------- v1.03 (Mateo): alles bearbeitbar – Arten (Zeitungen ist eine davon), Rubriken, Länder, Themen ----------
const prof = (fn) => store.update((s) => { s.profile = { ...(s.profile || {}) }; fn(s.profile); });
// Arten
export const NEWS_TYPES = [{ id: 'zeitungen', label: 'Zeitungen', emoji: '🗞' }, ...SOURCE_TYPES];
export function newsTypesOf(s) {
  const c = s.profile?.newsTypes || {};
  return [...NEWS_TYPES.filter((t) => !(c.hidden || []).includes(t.id)), ...(c.added || [])];
}
export const addNewsType = (label) => { const l = String(label || '').trim(); if (!l) return; prof((p) => { const c = p.newsTypes || {}; p.newsTypes = { ...c, added: [...(c.added || []), { id: `t${uid().slice(0, 6)}`, label: l, emoji: '📌' }] }; }); };
export const removeNewsType = (id) => prof((p) => { const c = p.newsTypes || {}; p.newsTypes = NEWS_TYPES.some((t) => t.id === id) ? { ...c, hidden: [...new Set([...(c.hidden || []), id])] } : { ...c, added: (c.added || []).filter((t) => t.id !== id) }; });
export const resetNewsTypes = () => prof((p) => { p.newsTypes = {}; });
// Rubriken
export function rubrikenOf(s) {
  const c = s.profile?.newsRubriken || {};
  return [...RUBRIKEN.filter((r) => r.id === 'start' || !(c.hidden || []).includes(r.id)), ...(c.added || [])];
}
export const addRubrik = (label) => { const l = String(label || '').trim(); if (!l) return; prof((p) => { const c = p.newsRubriken || {}; p.newsRubriken = { ...c, added: [...(c.added || []), { id: `r${uid().slice(0, 6)}`, label: l }] }; }); };
export const removeRubrik = (id) => prof((p) => { const c = p.newsRubriken || {}; p.newsRubriken = RUBRIKEN.some((r) => r.id === id) ? { ...c, hidden: [...new Set([...(c.hidden || []), id])] } : { ...c, added: (c.added || []).filter((r) => r.id !== id) }; });
export const resetRubriken = () => prof((p) => { p.newsRubriken = {}; });
// Themen der Quellen
export const topicsListOf = (s) => s.profile?.newsTopics || [...new Set([...SOURCE_TOPICS, ...(s.newsSources || []).flatMap((x) => x.topics || [])])];
export const setTopicsList = (list) => prof((p) => { p.newsTopics = list; });
// Länder mit Zeitungen
export const countriesOf = (s) => s.profile?.newsCountries || OUTLETS;
const setCountries = (fn) => store.update((s) => { s.profile = { ...(s.profile || {}) }; const list = JSON.parse(JSON.stringify(s.profile.newsCountries || OUTLETS)); s.profile.newsCountries = fn(list) || list; });
export const removeCountry = (region) => setCountries((l) => l.filter((c) => c.region !== region));
export const addCountry = (region, flag, list) => setCountries((l) => [...l.filter((c) => c.region !== region), { region, flag: flag || '🌍', list: list.map((x) => ({ name: x.name, url: x.url, lang: x.lang || 'en', sec: {} })) }]);
export const addPaper = (region, x) => setCountries((l) => { const c = l.find((y) => y.region === region); if (c && !c.list.some((p) => p.url === x.url)) c.list.push({ name: x.name, url: x.url, lang: x.lang || 'en', sec: {} }); });
export const removePaper = (region, url) => setCountries((l) => { const c = l.find((y) => y.region === region); if (c) c.list = c.list.filter((p) => p.url !== url); });
export const resetCountries = () => prof((p) => { delete p.newsCountries; });
const P = (name, url, lang) => ({ name, url, lang });
export const COUNTRY_PAPERS = {
  italien: { region: 'Italien', flag: '🇮🇹', list: [P('Corriere della Sera', 'https://www.corriere.it', 'it'), P('la Repubblica', 'https://www.repubblica.it', 'it'), P('La Stampa', 'https://www.lastampa.it', 'it'), P('Il Sole 24 Ore', 'https://www.ilsole24ore.com', 'it'), P('ANSA', 'https://www.ansa.it', 'it')] },
  frankreich: { region: 'Frankreich', flag: '🇫🇷', list: [P('Le Monde', 'https://www.lemonde.fr', 'fr'), P('Le Figaro', 'https://www.lefigaro.fr', 'fr'), P('Libération', 'https://www.liberation.fr', 'fr'), P('Les Echos', 'https://www.lesechos.fr', 'fr'), P('France 24', 'https://www.france24.com/fr/', 'fr')] },
  spanien: { region: 'Spanien', flag: '🇪🇸', list: [P('El País', 'https://elpais.com', 'es'), P('El Mundo', 'https://www.elmundo.es', 'es'), P('La Vanguardia', 'https://www.lavanguardia.com', 'es'), P('Expansión', 'https://www.expansion.com', 'es'), P('ABC', 'https://www.abc.es', 'es')] },
  brasilien: { region: 'Brasilien', flag: '🇧🇷', list: [P('Folha de S.Paulo', 'https://www.folha.uol.com.br', 'pt'), P('O Globo', 'https://oglobo.globo.com', 'pt'), P('Estadão', 'https://www.estadao.com.br', 'pt'), P('Valor Econômico', 'https://valor.globo.com', 'pt'), P('G1', 'https://g1.globo.com', 'pt')] },
  portugal: { region: 'Portugal', flag: '🇵🇹', list: [P('Público', 'https://www.publico.pt', 'pt'), P('Expresso', 'https://expresso.pt', 'pt'), P('Observador', 'https://observador.pt', 'pt'), P('Diário de Notícias', 'https://www.dn.pt', 'pt')] },
  uk: { region: 'Großbritannien', flag: '🇬🇧', list: [P('BBC News', 'https://www.bbc.com/news', 'en'), P('The Guardian', 'https://www.theguardian.com', 'en'), P('The Times', 'https://www.thetimes.co.uk', 'en'), P('Financial Times', 'https://www.ft.com', 'en'), P('The Telegraph', 'https://www.telegraph.co.uk', 'en')] },
  schweiz: { region: 'Schweiz', flag: '🇨🇭', list: [P('NZZ', 'https://www.nzz.ch', 'de'), P('Tages-Anzeiger', 'https://www.tagesanzeiger.ch', 'de'), P('SRF News', 'https://www.srf.ch/news', 'de'), P('Le Temps', 'https://www.letemps.ch', 'fr')] },
  oesterreich: { region: 'Österreich', flag: '🇦🇹', list: [P('Der Standard', 'https://www.derstandard.at', 'de'), P('Die Presse', 'https://www.diepresse.com', 'de'), P('ORF News', 'https://orf.at', 'de'), P('Kurier', 'https://kurier.at', 'de')] },
  mexiko: { region: 'Mexiko', flag: '🇲🇽', list: [P('El Universal', 'https://www.eluniversal.com.mx', 'es'), P('Reforma', 'https://www.reforma.com', 'es'), P('Milenio', 'https://www.milenio.com', 'es'), P('El Financiero', 'https://www.elfinanciero.com.mx', 'es')] },
  chile: { region: 'Chile', flag: '🇨🇱', list: [P('El Mercurio', 'https://www.emol.com', 'es'), P('La Tercera', 'https://www.latercera.com', 'es'), P('Diario Financiero', 'https://www.df.cl', 'es'), P('BioBioChile', 'https://www.biobiochile.cl', 'es')] },
  uruguay: { region: 'Uruguay', flag: '🇺🇾', list: [P('El País (UY)', 'https://www.elpais.com.uy', 'es'), P('El Observador', 'https://www.elobservador.com.uy', 'es'), P('la diaria', 'https://ladiaria.com.uy', 'es')] },
  kolumbien: { region: 'Kolumbien', flag: '🇨🇴', list: [P('El Tiempo', 'https://www.eltiempo.com', 'es'), P('El Espectador', 'https://www.elespectador.com', 'es'), P('Semana', 'https://www.semana.com', 'es')] },
  china: { region: 'China', flag: '🇨🇳', list: [P('South China Morning Post', 'https://www.scmp.com', 'en'), P('Caixin Global', 'https://www.caixinglobal.com', 'en'), P('Sixth Tone', 'https://www.sixthtone.com', 'en'), P('China Daily', 'https://www.chinadaily.com.cn', 'en')] },
  japan: { region: 'Japan', flag: '🇯🇵', list: [P('Nikkei Asia', 'https://asia.nikkei.com', 'en'), P('The Japan Times', 'https://www.japantimes.co.jp', 'en'), P('NHK World', 'https://www3.nhk.or.jp/nhkworld/', 'en')] },
  indien: { region: 'Indien', flag: '🇮🇳', list: [P('The Hindu', 'https://www.thehindu.com', 'en'), P('Times of India', 'https://timesofindia.indiatimes.com', 'en'), P('Indian Express', 'https://indianexpress.com', 'en'), P('Mint', 'https://www.livemint.com', 'en')] },
  israel: { region: 'Israel', flag: '🇮🇱', list: [P('Haaretz', 'https://www.haaretz.com', 'en'), P('The Times of Israel', 'https://www.timesofisrael.com', 'en'), P('Jerusalem Post', 'https://www.jpost.com', 'en')] },
  kanada: { region: 'Kanada', flag: '🇨🇦', list: [P('CBC News', 'https://www.cbc.ca/news', 'en'), P('The Globe and Mail', 'https://www.theglobeandmail.com', 'en'), P('Toronto Star', 'https://www.thestar.com', 'en')] },
};
const ALIAS = { england: 'uk', grossbritannien: 'uk', 'großbritannien': 'uk', vereinigtes: 'uk', 'österreich': 'oesterreich', austria: 'oesterreich', italy: 'italien', italia: 'italien', france: 'frankreich', spain: 'spanien', 'españa': 'spanien', brazil: 'brasilien', brasil: 'brasilien', mexico: 'mexiko', 'méxico': 'mexiko', colombia: 'kolumbien', japon: 'japan', india: 'indien', canada: 'kanada', suisse: 'schweiz' };
export function knownCountry(name) {
  const n = norm(name);
  const k = COUNTRY_PAPERS[n] ? n : ALIAS[n] || Object.keys(COUNTRY_PAPERS).find((key) => norm(COUNTRY_PAPERS[key].region) === n);
  return k ? COUNTRY_PAPERS[k] : null;
}
const PAPERS_TOOL = {
  name: 'zeitungen',
  description: 'Wichtige Nachrichtenseiten eines Landes',
  input_schema: { type: 'object', properties: { flagge: { type: 'string', description: 'Flaggen-Emoji' }, land: { type: 'string', description: 'Ländername auf Deutsch' }, zeitungen: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string', description: 'Startseite, nur wenn sicher bekannt' }, sprache: { type: 'string', description: 'zweistelliger Sprachcode, z.B. de, en, es' } }, required: ['name', 'url'] } } }, required: ['zeitungen'] },
};
// KI ohne Internet schlägt 4–6 wichtige, seriöse Nachrichtenseiten vor (unter 1 Cent)
export async function suggestPapers(country) {
  const r = await searchWithTool({ system: 'Nenne die 4–6 wichtigsten, seriösen Nachrichtenseiten (Zeitungen/Sender) des Landes mit ihrer Startseite. Gemischt: Leitmedien, Wirtschaft, wenn möglich eine englischsprachige Quelle. Nur URLs, die du sicher kennst. Antworte mit "zeitungen".', user: country, tool: PAPERS_TOOL, maxUses: 0, maxTokens: 1500, label: 'Zeitungen vorschlagen' });
  return { region: r.land || country, flag: r.flagge || '🌍', list: (r.zeitungen || []).filter((x) => /^https?:\/\//.test(x.url || '')).map((x) => ({ name: x.name, url: x.url, lang: x.sprache || 'en' })) };
}
