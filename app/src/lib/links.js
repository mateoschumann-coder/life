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
      hinweis: { type: 'string', description: 'Optional ein kurzer Satz' },
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

// platforms: erlaubte Plattformen; extra: zusätzlicher Parameter (z.B. Ort für LinkedIn)
export async function aiLinks({ system, user, platforms, label, extra }) {
  const r = await searchWithTool({
    system: `${system}\nDu suchst NICHT selbst im Internet. Stattdessen überlegst du dir 5 bis 8 möglichst treffsichere Suchen auf verschiedenen Plattformen (${platforms.map((p) => PLATFORMS[p].label).join(', ')}), aus denen die App Links baut. Instagram-Konten nur, wenn du dir sicher bist, dass es sie gibt (bekannte Locations, Kollektive, Medien); sonst lieber Hashtags. Gib sie mit "suchen_vorschlagen" zurück.`,
    user,
    tool: LINK_TOOL(platforms),
    maxUses: 0,
    label,
  });
  return {
    hint: r.hinweis || '',
    links: (r.suchen || []).filter((x) => x && PLATFORMS[x.plattform] && x.suchbegriff).map((x, i) => ({
      id: 'l' + i + Date.now().toString(36), platform: x.plattform, label: PLATFORMS[x.plattform].label, title: x.titel || x.suchbegriff, why: x.warum || '', url: PLATFORMS[x.plattform].build(x.suchbegriff, extra),
    })),
  };
}
