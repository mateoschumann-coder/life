// „Meine Seiten“ (v0.66): pro Bereich feste Seiten. Die KI (ohne Internet, ~0,03 Cent) macht aus Mateos Satz
// passende Suchbegriffe pro Seite (Sprache der Seite, Stadt, Datum); die App baut daraus Links,
// die direkt in der Suche der jeweiligen Seite/App landen. Seiten ohne eigene Such-Adresse: Google, nur auf dieser Seite.
import { store } from './store';
import { fmtLong, today } from './dates';
import { searchWithTool } from './outings';

const enc = encodeURIComponent;
const slug = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tag = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const siteSearch = (domain, q) => `https://www.google.com/search?q=${enc(`${q} site:${domain}`.trim())}`;

// build(c): c = { q (Begriff für diese Seite), city, from, to, eb (Eventbrite-Ort), cc (Ländercode), hashtag }
export const SOURCE_AREAS = {
  rezepte: {
    title: 'Meine Rezeptseiten',
    placeholder: 'z.B. schnelles Abendessen mit Hähnchen im Airfryer',
    defaults: [
      { id: 'chefkoch', name: 'Chefkoch', lang: 'de', build: (c) => `https://www.chefkoch.de/rs/s0/${enc(c.q)}/Rezepte.html` },
      { id: 'paulina', name: 'Paulina Cocina', lang: 'es', build: (c) => `https://www.paulinacocina.net/?s=${enc(c.q)}` },
      { id: 'bbc', name: 'BBC Good Food', lang: 'en', build: (c) => `https://www.bbcgoodfood.com/search?q=${enc(c.q)}` },
      { id: 'allrecipes', name: 'Allrecipes', lang: 'en', build: (c) => `https://www.allrecipes.com/search?q=${enc(c.q)}` },
      { id: 'yt', name: 'YouTube', lang: 'de oder es', build: (c) => `https://www.youtube.com/results?search_query=${enc(c.q)}` },
    ],
  },
  events: {
    title: 'Meine Event-Seiten',
    placeholder: 'z.B. Was kann ich dieses Wochenende machen?',
    perCity: true,
    defaults: [
      { id: 'gevents', name: 'Google Events', lang: 'Landessprache', build: (c) => `https://www.google.com/search?q=${enc(c.q)}&ibp=htl;events` },
      { id: 'eventbrite', name: 'Eventbrite', lang: 'en', build: (c) => `https://www.eventbrite.com/d/${c.eb || slug(c.city)}/${slug(c.q) || 'all-events'}/${c.from ? `?start_date=${c.from}&end_date=${c.to || c.from}` : ''}` },
      { id: 'meetup', name: 'Meetup', lang: 'en', build: (c) => `https://www.meetup.com/find/?keywords=${enc(c.q)}&location=${enc(`${c.cc || ''}--${c.city}`)}&source=EVENTS` },
      { id: 'instagram', name: 'Instagram #', lang: '–', build: (c) => `https://www.instagram.com/explore/tags/${tag(c.hashtag || c.q + c.city)}/` },
      { id: 'timeout', name: 'Time Out', domain: 'timeout.com', lang: 'en' },
      { id: 'passline', name: 'Passline', domain: 'passline.com', city: 'Buenos Aires', lang: 'es' },
      { id: 'alternativa', name: 'Alternativa Teatral', domain: 'alternativateatral.com', city: 'Buenos Aires', lang: 'es' },
      { id: 'ticketek', name: 'Ticketek', domain: 'ticketek.com.ar', city: 'Buenos Aires', lang: 'es' },
    ],
  },
  orte: {
    title: 'Meine Orte-Seiten',
    placeholder: 'z.B. gemütliches Café zum Arbeiten in Palermo',
    perCity: true,
    defaults: [
      { id: 'gmaps', name: 'Google Maps', lang: 'Landessprache', build: (c) => `https://www.google.com/maps/search/${enc(c.q)}` },
      { id: 'tripadvisor', name: 'Tripadvisor', lang: 'en', build: (c) => `https://www.tripadvisor.com/Search?q=${enc(c.q)}` },
      { id: 'instagram', name: 'Instagram #', lang: '–', build: (c) => `https://www.instagram.com/explore/tags/${tag(c.hashtag || c.q + c.city)}/` },
      { id: 'reddit', name: 'Reddit', lang: 'en', build: (c) => `https://www.reddit.com/search/?q=${enc(c.q)}` },
      { id: 'timeout', name: 'Time Out', domain: 'timeout.com', lang: 'en' },
      { id: 'guiaoleo', name: 'Guía Óleo', domain: 'guiaoleo.com.ar', city: 'Buenos Aires', lang: 'es' },
    ],
  },
  rennen: {
    title: 'Meine Renn-Seiten',
    placeholder: 'z.B. Halbmarathon im Frühling in meiner Nähe',
    defaults: [
      { id: 'gsearch', name: 'Google', lang: 'Landessprache', build: (c) => `https://www.google.com/search?q=${enc(c.q)}` },
      { id: 'ahotu', name: 'Ahotu', domain: 'ahotu.com', lang: 'en' },
      { id: 'worldsm', name: "World's Marathons", domain: 'worldsmarathons.com', lang: 'en' },
      { id: 'clubcorredores', name: 'Club de Corredores', domain: 'clubdecorredores.com', lang: 'es' },
      { id: 'raceid', name: 'RaceID', domain: 'raceid.com', lang: 'en' },
      { id: 'instagram', name: 'Instagram #', lang: '–', build: (c) => `https://www.instagram.com/explore/tags/${tag(c.hashtag || c.q)}/` },
    ],
  },
};

const prefsOf = (s, key) => s.profile?.sources?.[key] || { hidden: [], added: [] };
// Sichtbare Seiten eines Bereichs (bei Events/Orten: allgemeine + die der gewählten Stadt)
export function sourcesOf(s, key, city) {
  const area = SOURCE_AREAS[key];
  const p = prefsOf(s, key);
  const okCity = (x) => !area.perCity || !x.city || x.city === city;
  const tpl = p.searchTpl || {};
  return [...area.defaults.filter((x) => !(p.hidden || []).includes(x.id)), ...(p.added || [])].filter(okCity).map((x) => (tpl[x.id] ? { ...x, tpl: tpl[x.id] } : x));
}
// Suche einer Seite „beibringen“ (v0.68): Mateo sucht dort nach „test“ und fügt die Adresse ein → „test“ wird zum Platzhalter
export function learnSearch(key, id, url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//.test(u)) return 'Bitte die ganze Adresse einfügen (beginnt mit https://).';
  // Mit „test“ = Suche, ohne = feste Seite (z.B. Rennkalender ohne Suchfeld, v0.69)
  const m = u.match(/([?&=\/+-])test(?=$|[&/#?+-])/i);
  const tpl = m ? u.slice(0, m.index + 1) + '{q}' + u.slice(m.index + 5) : u;
  save(key, (p) => ({ ...p, searchTpl: { ...(p.searchTpl || {}), [id]: tpl } }));
  return '';
}
export function forgetSearch(key, id) {
  save(key, (p) => { const x = { ...(p.searchTpl || {}) }; delete x[id]; return { ...p, searchTpl: x }; });
}
export const isNative = (src) => !!(src.build || src.tpl);
export const isFixed = (src) => !!(src.tpl && !src.tpl.includes('{q}'));
// Was tatsächlich gesucht wird (zum Prüfen in der Liste)
export function sourceTerm(src, q, city, t) {
  if (src.tpl && !src.tpl.includes('{q}')) return '(feste Seite, ohne Suche)';
  const u = decodeURIComponent(sourceUrl(src, q, city, t));
  if (src.id === 'instagram') return '#' + (u.match(/tags\/([^/]+)/) || [])[1];
  if (src.id === 'eventbrite') return u.replace(/^.*\/d\//, '').replace(/\?/, ' · ').replace(/[/]/g, ' ').replace(/start_date=|end_date=/g, '').trim();
  const m = u.match(/[?&](?:q|search_query|keywords|s)=([^&]+)/) || u.match(/maps\/search\/([^?]+)/) || u.match(/rs\/s0\/([^/]+)/);
  return m ? m[1].replace(/\+/g, ' ') : '';
}
// Link für eine Seite: zugeschnittener Begriff (t.terms[id]) oder Mateos Text + Stadt
export function sourceUrl(src, q, city = '', t = null) {
  const raw = String(q || '').trim();
  const anyTerm = t ? Object.values(t.terms || {})[0] : '';
  const term = (t?.terms?.[src.id] || '').trim() || (anyTerm ? (anyTerm.toLowerCase().includes(String(city).toLowerCase()) ? anyTerm : `${anyTerm} ${city}`.trim()) : [raw, city].filter(Boolean).join(' '));
  if (src.tpl && !src.tpl.includes('{q}')) return src.tpl;
  if (!raw && !t) return src.home || (src.domain ? `https://${src.domain}` : src.build({ q: city, city }));
  // Ort immer sicherstellen (v0.67): fehlt die Stadt im Begriff, hängt die App sie an – außer bei Seiten, die den Ort über die Adresse bekommen
  const cityKey = String(city || '').toLowerCase().split(/[ ,]/)[0];
  const withCity = cityKey && !['eventbrite', 'meetup'].includes(src.id) && !term.toLowerCase().includes(cityKey) ? `${term} ${city}` : term;
  const hashtag = t?.hashtag && cityKey && !t.hashtag.includes(tag(cityKey)) ? t.hashtag + tag(city) : t?.hashtag;
  if (src.tpl) return src.tpl.replace('{q}', enc(term));
  if (src.build) return src.build({ q: withCity, city, from: t?.from, to: t?.to, eb: t?.eb, cc: t?.cc, hashtag });
  return siteSearch(src.domain, withCity);
}

// KI schneidet die Suche zu (Haiku, ohne Internet): Begriff pro Seite, Datum, Eventbrite-Ort, Hashtag
const TAILOR_TOOL = {
  name: 'suchen_zuschneiden',
  description: 'Suchbegriffe pro Seite.',
  input_schema: {
    type: 'object',
    properties: {
      gedanke: { type: 'string', description: '1 kurzer Satz auf Deutsch: wonach gesucht wird (z.B. „Konzerte und Bars in Buenos Aires am 31.10.–1.11.“)' },
      von: { type: 'string', description: 'YYYY-MM-DD, nur wenn ein Zeitraum gemeint ist (z.B. „dieses Wochenende“)' },
      bis: { type: 'string', description: 'YYYY-MM-DD' },
      eventbrite_ort: { type: 'string', description: 'Eventbrite-Ort im Format „land--stadt“ auf Englisch, klein, z.B. „argentina--buenos-aires“, „germany--frankfurt“' },
      land_code: { type: 'string', description: '2-Buchstaben-Ländercode, klein, z.B. „ar“, „de“' },
      hashtag: { type: 'string', description: 'ein real genutzter Instagram-Hashtag ohne #, der IMMER den Ort enthält (Instagram kennt keinen Standort-Filter), z.B. „cafesbuenosaires“, „jazzbuenosaires“, „frankfurtcafe“' },
      seiten: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, begriff: { type: 'string' } }, required: ['id', 'begriff'] } },
    },
    required: ['gedanke', 'seiten'],
  },
};
const cache = new Map();
export async function tailorQueries(s, area, q, city, list) {
  const key = [area, q, city, list.map((x) => x.id).join(',')].join('|');
  if (cache.has(key)) return cache.get(key);
  const prefs = area === 'events' ? (s.profile?.eventPrefs || []).join(', ') : '';
  const sys = `Du baust Suchbegriffe für Webseiten. Heute ist ${fmtLong(today())} (${today()}). Ort: ${city || 'nicht wichtig'}.${prefs ? ` Mateos Vorlieben: ${prefs}.` : ''}
Mateo schreibt frei, z.B. „Was kann ich dieses Wochenende machen?“. Mach daraus für JEDE Seite einen kurzen, wirksamen Suchbegriff (2–6 Wörter) in der Sprache der Seite – so, wie man ihn dort ins Suchfeld tippen würde. Füllwörter weglassen, Absicht erkennen (z.B. „Wochenende“ → passende Event-Arten + Datum), Den Ort (Stadt, ggf. Viertel) in JEDEN Begriff einbauen – außer bei Eventbrite und Meetup, die den Ort schon über die Adresse bekommen. Der Instagram-Hashtag muss den Ort enthalten. Zeitangaben in von/bis als Datum umrechnen. Antworte mit "suchen_zuschneiden".`;
  const user = JSON.stringify({ text: q, bereich: area, seiten: list.map((x) => ({ id: x.id, name: x.name, sprache: x.lang || 'passend', eigene_suche: !!(x.build || x.tpl) })) });
  const r = await searchWithTool({ system: sys, user, tool: TAILOR_TOOL, maxUses: 0, maxTokens: 800, label: 'Links zuschneiden' });
  const ok = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
  const t = { gedanke: r.gedanke || '', from: ok(r.von), to: ok(r.bis), eb: /^[a-z-]+--[a-z-]+$/.test(r.eventbrite_ort || '') ? r.eventbrite_ort : '', cc: /^[a-z]{2}$/.test(r.land_code || '') ? r.land_code : '', hashtag: tag(r.hashtag), terms: Object.fromEntries((r.seiten || []).filter((x) => x?.id && x.begriff).map((x) => [x.id, x.begriff])) };
  cache.set(key, t);
  return t;
}

const save = (key, fn) => store.update((d) => {
  const all = d.profile?.sources || {};
  const cur = all[key] || { hidden: [], added: [] };
  d.profile = { ...d.profile, sources: { ...all, [key]: fn({ ...cur, hidden: [...(cur.hidden || [])], added: [...(cur.added || [])] }) } };
});
export function removeSource(key, id) {
  save(key, (p) => (SOURCE_AREAS[key].defaults.some((x) => x.id === id) ? { ...p, hidden: [...p.hidden, id] } : { ...p, added: p.added.filter((x) => x.id !== id) }));
}
export function addSource(key, name, link, city) {
  const domain = String(link || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!domain) return;
  const src = { id: 'u' + Date.now().toString(36), name: String(name || '').trim() || domain, domain, home: /^https?:\/\//.test(link) ? link.trim() : `https://${domain}` };
  if (SOURCE_AREAS[key].perCity && city) src.city = city;
  save(key, (p) => ({ ...p, added: [...p.added, src] }));
}
export function restoreSources(key) {
  save(key, (p) => ({ ...p, hidden: [] }));
}
