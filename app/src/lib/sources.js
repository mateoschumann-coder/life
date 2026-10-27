// „Meine Seiten“ (v0.64): pro Bereich feste Lieblingsseiten – Suchbegriff eingeben, Seite öffnet sich direkt mit der Suche.
// Kostenlos: die App baut nur Links (keine KI, keine Suchdienste). {q} = Suchbegriff, {city} = gewählte Stadt.
import { store } from './store';

const enc = encodeURIComponent;
// Seiten ohne eigene Such-Adresse: Google-Suche nur auf dieser Seite
export const siteSearch = (domain, q) => `https://www.google.com/search?q=${enc(`${q} site:${domain}`.trim())}`;

export const SOURCE_AREAS = {
  rezepte: {
    title: 'Meine Rezeptseiten',
    placeholder: 'z.B. Hähnchen Airfryer',
    defaults: [
      { id: 'chefkoch', name: 'Chefkoch', domain: 'chefkoch.de', search: 'https://www.chefkoch.de/rs/s0/{q}/Rezepte.html' },
      { id: 'paulina', name: 'Paulina Cocina', domain: 'paulinacocina.net', search: 'https://www.paulinacocina.net/?s={q}' },
      { id: 'bbc', name: 'BBC Good Food', domain: 'bbcgoodfood.com', search: 'https://www.bbcgoodfood.com/search?q={q}' },
      { id: 'allrecipes', name: 'Allrecipes', domain: 'allrecipes.com', search: 'https://www.allrecipes.com/search?q={q}' },
      { id: 'yt', name: 'YouTube', domain: 'youtube.com', search: 'https://www.youtube.com/results?search_query={q}+rezept' },
    ],
  },
  events: {
    title: 'Meine Event-Seiten',
    placeholder: 'z.B. Rock, Jazz, Stand-up',
    perCity: true,
    defaults: [
      { id: 'gevents', name: 'Google Events', domain: 'google.com', search: 'https://www.google.com/search?q={q}+events+{city}&ibp=htl;events' },
      { id: 'eventbrite', name: 'Eventbrite', domain: 'eventbrite.com', search: 'https://www.google.com/search?q={q}+{city}+site:eventbrite.com' },
      { id: 'timeout', name: 'Time Out', domain: 'timeout.com', search: 'https://www.google.com/search?q={q}+{city}+site:timeout.com' },
      { id: 'passline', name: 'Passline', domain: 'passline.com', city: 'Buenos Aires' },
      { id: 'alternativa', name: 'Alternativa Teatral', domain: 'alternativateatral.com', city: 'Buenos Aires' },
      { id: 'ticketek', name: 'Ticketek', domain: 'ticketek.com.ar', city: 'Buenos Aires' },
      { id: 'allaccess', name: 'All Access', domain: 'allaccess.com.ar', city: 'Buenos Aires' },
    ],
  },
  orte: {
    title: 'Meine Orte-Seiten',
    placeholder: 'z.B. Brunch Palermo, Rooftop',
    perCity: true,
    defaults: [
      { id: 'gmaps', name: 'Google Maps', domain: 'google.com/maps', search: 'https://www.google.com/maps/search/{q}+{city}' },
      { id: 'timeout', name: 'Time Out', domain: 'timeout.com', search: 'https://www.google.com/search?q={q}+{city}+site:timeout.com' },
      { id: 'tripadvisor', name: 'Tripadvisor', domain: 'tripadvisor.com', search: 'https://www.google.com/search?q={q}+{city}+site:tripadvisor.com' },
      { id: 'reddit', name: 'Reddit', domain: 'reddit.com', search: 'https://www.google.com/search?q={q}+{city}+site:reddit.com' },
      { id: 'guiaoleo', name: 'Guía Óleo', domain: 'guiaoleo.com.ar', city: 'Buenos Aires' },
    ],
  },
  rennen: {
    title: 'Meine Renn-Seiten',
    placeholder: 'z.B. 10K Buenos Aires, Halbmarathon März',
    defaults: [
      { id: 'ahotu', name: 'Ahotu', domain: 'ahotu.com' },
      { id: 'worldsm', name: "World's Marathons", domain: 'worldsmarathons.com' },
      { id: 'clubcorredores', name: 'Club de Corredores', domain: 'clubdecorredores.com' },
      { id: 'raceid', name: 'RaceID', domain: 'raceid.com' },
      { id: 'gcal', name: 'Google: Kalender', domain: 'google.com', search: 'https://www.google.com/search?q=calendario+carreras+{q}' },
    ],
  },
};

const prefsOf = (s, key) => s.profile?.sources?.[key] || { hidden: [], added: [] };
// Sichtbare Seiten eines Bereichs (bei Events/Orten: allgemeine + die der gewählten Stadt)
export function sourcesOf(s, key, city) {
  const area = SOURCE_AREAS[key];
  const p = prefsOf(s, key);
  const okCity = (x) => !area.perCity || !x.city || x.city === city;
  return [...area.defaults.filter((x) => !(p.hidden || []).includes(x.id)), ...(p.added || [])].filter(okCity);
}
export function sourceUrl(src, q, city = '') {
  const query = String(q || '').trim();
  if (!query) return src.home || `https://${src.domain}`;
  if (!src.search) return siteSearch(src.domain, `${query}${city && src.city === undefined && src.domain.includes('.') ? '' : ''}`);
  const slug = String(city || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
  return src.search.replace('{q}', enc(query)).replace('{city}', enc(city)).replace('{citySlug}', enc(slug));
}
// Eine Google-Suche über alle Seiten auf einmal (nur echte Domains)
export function allUrl(list, q, city) {
  const sites = list.map((x) => x.domain).filter((d) => d && !d.startsWith('google.') && !d.startsWith('youtube.'));
  return `https://www.google.com/search?q=${enc(`${q} ${city || ''} ${sites.map((d) => `site:${d}`).join(' OR ')}`.replace(/\s+/g, ' ').trim())}`;
}
const save = (key, fn) => store.update((d) => {
  const all = d.profile?.sources || {};
  const cur = all[key] || { hidden: [], added: [] };
  d.profile = { ...d.profile, sources: { ...all, [key]: fn({ hidden: [...(cur.hidden || [])], added: [...(cur.added || [])] }) } };
});
export function removeSource(key, id) {
  save(key, (p) => (SOURCE_AREAS[key].defaults.some((x) => x.id === id) ? { ...p, hidden: [...p.hidden, id] } : { ...p, added: p.added.filter((x) => x.id !== id) }));
}
export function addSource(key, name, link, city) {
  let domain = String(link || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!domain) return;
  const src = { id: 'u' + Date.now().toString(36), name: String(name || '').trim() || domain, domain, home: /^https?:\/\//.test(link) ? link.trim() : `https://${domain}` };
  if (SOURCE_AREAS[key].perCity && city) src.city = city;
  save(key, (p) => ({ ...p, added: [...p.added, src] }));
}
export function restoreSources(key) {
  save(key, (p) => ({ ...p, hidden: [] }));
}
