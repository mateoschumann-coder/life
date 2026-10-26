// Günstige Alternative zur Websuche: Die KI überlegt sich gezielte Suchen (ohne selbst im Internet zu suchen),
// die App baut daraus Links zu Google, Instagram, YouTube, LinkedIn & Co. Du tippst und siehst die echten, aktuellen Ergebnisse.
import { searchWithTool } from './outings';

const enc = encodeURIComponent;
export const PLATFORMS = {
  google: { label: 'Google', build: (q) => `https://www.google.com/search?q=${enc(q)}` },
  google_events: { label: 'Google Events', build: (q) => `https://www.google.com/search?q=${enc(q)}&ibp=htl;events` },
  google_jobs: { label: 'Google Jobs', build: (q) => `https://www.google.com/search?q=${enc(q)}&ibp=htl;jobs` },
  instagram_tag: { label: 'Instagram #', build: (q) => `https://www.instagram.com/explore/tags/${enc(q.replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase())}/` },
  instagram_konto: { label: 'Instagram', build: (q) => `https://www.instagram.com/${enc(q.replace(/^@/, '').trim())}/` },
  google_news: { label: 'Google News', build: (q) => `https://news.google.com/search?q=${enc(q)}&hl=de&gl=DE&ceid=DE:de` },
  google_news_en: { label: 'News (EN)', build: (q) => `https://news.google.com/search?q=${enc(q)}&hl=en-US&gl=US&ceid=US:en` },
  google_news_es: { label: 'News (ES)', build: (q) => `https://news.google.com/search?q=${enc(q)}&hl=es-419&gl=AR&ceid=AR:es-419` },
  news_woche: { label: 'Diese Woche', build: (q) => `https://www.google.com/search?q=${enc(q)}&tbm=nws&tbs=qdr:w` },
  youtube: { label: 'YouTube', build: (q) => `https://www.youtube.com/results?search_query=${enc(q)}` },
  eventbrite: { label: 'Eventbrite', build: (q) => `https://www.eventbrite.com.ar/d/argentina--buenos-aires/${enc(q.trim().replace(/\s+/g, '-'))}/` },
  meetup: { label: 'Meetup', build: (q) => `https://www.meetup.com/find/?keywords=${enc(q)}&location=ar--Buenos%20Aires` },
  linkedin_jobs: { label: 'LinkedIn Jobs', build: (q, ort) => `https://www.linkedin.com/jobs/search/?keywords=${enc(q)}&location=${enc(ort || 'Buenos Aires')}&f_TPR=r604800` },
  getonbrd: { label: 'Get on Board', build: (q) => `https://www.getonbrd.com/jobs?q=${enc(q)}` },
  wellfound: { label: 'Wellfound', build: (q) => `https://www.google.com/search?q=${enc(`site:wellfound.com/jobs ${q}`)}` },
  spotify: { label: 'Spotify', build: (q) => `https://open.spotify.com/search/${enc(q)}` },
};

const LINK_TOOL = (platforms) => ({
  name: 'suchen_vorschlagen',
  description: 'Gibt gezielte Suchen zurück, aus denen die App Links baut.',
  input_schema: {
    type: 'object',
    properties: {
      gedanke: { type: 'string', description: 'Zuerst: 1–2 Sätze, was für Mateo hier konkret interessant ist (aus Profil und Zielen abgeleitet)' },
      hauptsuche: { type: 'string', description: 'Die eine beste, für Mateo zugeschnittene Google-Suchanfrage zum Thema (mit Operatoren wie "…", OR, -), ohne Plattform' },
      hinweis: { type: 'string', description: 'Optional ein kurzer Satz für Mateo' },
      suchen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            plattform: { type: 'string', enum: platforms },
            suchbegriff: { type: 'string', description: 'Genau das, was eingegeben wird (Hashtag ohne #, Instagram-Konto ohne @). Gern auf Spanisch, wenn das bessere Treffer bringt.' },
            titel: { type: 'string', description: 'Kurz auf Deutsch, was man dort findet' },
            warum: { type: 'string', description: 'Halbsatz, warum es passt' },
          },
          required: ['plattform', 'suchbegriff', 'titel'],
        },
      },
    },
    required: ['suchen'],
  },
});

// Was die KI über Mateo weiß – damit Suchen zu ihm passen statt nur das Stichwort zu googeln
export function profileContext(s) {
  if (!s) return '';
  const parts = {
    ueber_mateo: (s.memory || []).map((m) => m.text),
    wohnort: 'Buenos Aires, Argentinien (spricht Deutsch, Englisch, Spanisch)',
    ausgeh_vorlieben: s.profile?.eventPrefs?.length ? s.profile.eventPrefs : undefined,
    lernt_gerade: (s.skills || []).map((x) => `${x.name}${x.level ? ` (${x.level})` : ''}${x.goal ? ` – Ziel: ${x.goal}` : ''}`),
    jobsuche: (s.jobSearches || []).map((x) => `${x.name}${x.goal ? ` – ${x.goal}` : ''}`),
    eigene_projekte: (s.sideProjects || []).filter((p) => p.status !== 'fertig').map((p) => p.name),
    sport: (s.sports || []).map((x) => `${x.name}${x.goal ? ` – Ziel: ${x.goal}` : ''}`),
    news_themen: s.radar?.topics,
    hobbys: (s.hobbies || []).map((h) => h.name),
  };
  return JSON.stringify(Object.fromEntries(Object.entries(parts).filter(([, v]) => v && (!Array.isArray(v) || v.length))));
}

// platforms: erlaubte Plattformen; extra: zusätzlicher Parameter (z.B. Ort für LinkedIn); s: Daten für das Profil
export async function aiLinks({ system, user, platforms, label, extra, s }) {
  const r = await searchWithTool({
    system: `${system}
${s ? `Mateos Profil und Ziele: ${profileContext(s)}\n` : ''}Du suchst NICHT selbst im Internet. Stattdessen denkst du nach und baust 5 bis 8 möglichst treffsichere Suchen auf verschiedenen Plattformen (${platforms.map((p) => PLATFORMS[p].label).join(', ')}), aus denen die App Links baut.
So gehst du vor:
1. Überlege zuerst (Feld "gedanke"), was für GENAU Mateo hier relevant ist – abgeleitet aus Profil, Zielen und Anfrage (z.B. bei „KI“: nicht allgemein „KI“, sondern KI-Startups, Finanzierungsrunden, KI in Lateinamerika, was für VC/Startup-Rollen wichtig ist).
2. Baue keine Ein-Wort-Suchen. Nutze Google-Operatoren, wo sie helfen: "genaue Phrase", OR, -Ausschluss, site:domain (gute Quellen), passende Sprache (Englisch für internationale Themen, Spanisch für Argentinien/Lokales, Deutsch für deutsche Quellen).
3. Mische: 1–2 breite Überblicks-Suchen und mehrere gezielte, überraschende Blickwinkel, die er selbst nicht eingeben würde.
4. Instagram-Konten nur, wenn du dir sicher bist, dass es sie gibt (bekannte Locations, Kollektive, Medien); sonst lieber Hashtags.
Gib alles mit "suchen_vorschlagen" zurück.`,
    user,
    tool: LINK_TOOL(platforms),
    maxUses: 0,
    label,
  });
  return {
    hint: r.hinweis || '',
    main: r.hauptsuche || '',
    thought: r.gedanke || '',
    links: (r.suchen || []).filter((x) => x && PLATFORMS[x.plattform] && x.suchbegriff).map((x, i) => ({
      id: 'l' + i + Date.now().toString(36), platform: x.plattform, label: PLATFORMS[x.plattform].label, title: x.titel || x.suchbegriff, why: x.warum || '', url: PLATFORMS[x.plattform].build(x.suchbegriff, extra),
    })),
  };
}
