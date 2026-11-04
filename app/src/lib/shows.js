// v1.57 (Mateo): Unterhaltung – Sport im Fernsehen (Fußball, Formel 1, Tennis …), Kino, Serien.
// Eigene Liste s.shows (was Mateo schauen will) + Suche: Links (kostenlos) und KI-Websuche (konkrete Termine/Filme).
import { store, uid } from './store';
import { addDays, fmtLong, today } from './dates';
import { searchWithTool } from './outings';

export const DEFAULT_SHOW_CATS = ['⚽ Fußball', '🏎 Formel 1', '🎾 Tennis', '🎬 Kino', '📺 Serien', '🎥 Doku'];
export const showCatsOf = (s) => (Array.isArray(s.profile?.showCats) ? s.profile.showCats : DEFAULT_SHOW_CATS);
export const saveShowCats = (list) => store.update((d) => { d.profile = { ...d.profile, showCats: list }; });
// Kategorie ohne Emoji, z.B. „⚽ Fußball“ → „Fußball“
export const catName = (c) => String(c || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
export const catEmoji = (c) => (String(c || '').match(/^[^\p{L}\p{N}\s]+/u) || [''])[0];
export const isCinema = (c) => /kino|film|cine/i.test(c || '');

const clean = (x) => ({
  name: String(x.name || '').trim(),
  date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : '',
  time: /^\d{1,2}:\d{2}$/.test(x.time || '') ? x.time.padStart(5, '0') : '',
  where: String(x.where || '').trim(),
  cat: String(x.cat || '').trim(),
  url: /^https?:\/\//.test(x.url || '') ? x.url : '',
  note: String(x.note || '').trim(),
  ...(x.remind !== undefined && x.remind !== '' && x.remind != null ? { remind: Number(x.remind) } : {}),
  ...(Array.isArray(x.shows) && x.shows.length ? { shows: x.shows } : {}),
});

export function addShow(x) {
  const id = uid();
  const c = clean(x);
  if (!c.name) return null;
  store.update((s) => { s.shows = [...(s.shows || []), { id, ...c, done: false, added: today() }]; });
  return id;
}
export const updateShow = (id, patch) => store.update((s) => {
  s.shows = (s.shows || []).map((x) => {
    if (x.id !== id) return x;
    const next = { ...x, ...clean({ ...x, ...patch }) };
    if (patch.remind === '' || patch.remind == null) { if ('remind' in patch) delete next.remind; }
    return next;
  });
});
export const toggleShow = (id) => store.update((s) => {
  s.shows = (s.shows || []).map((x) => (x.id === id ? { ...x, done: !x.done, doneAt: !x.done ? today() : null } : x));
});
const move = (from, to, id, patch) => store.update((s) => {
  const list = s[from] || [];
  const x = list.find((y) => y.id === id);
  if (!x) return;
  s[from] = list.filter((y) => y.id !== id);
  s[to] = [...(s[to] || []), { ...x, ...patch }];
});
export const archiveShow = (id) => move('shows', 'removedShows', id, { removedAt: today() });
export const restoreShow = (id) => move('removedShows', 'shows', id, { removedAt: null });

// Letzte KI-Suche merken (wie bei Events), damit sie beim Zurückkommen noch da ist
const KEY = 'life-app-showsearch';
export const lastShowSearch = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const saveShowSearch = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

const SHOW_TOOL = {
  name: 'unterhaltung_zeigen',
  description: 'Gibt gefundene Sendungen, Rennen, Spiele, Kinofilme strukturiert zurück.',
  input_schema: {
    type: 'object',
    properties: {
      hinweis: { type: 'string', description: 'Optional 1 Satz, z.B. wenn Zeiten noch nicht feststehen' },
      eintraege: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'z.B. „GP von Brasilien – Rennen“, „River – Boca“, „Dune 3“' },
            kategorie: { type: 'string', description: 'genau eine der Kategorien aus der Anfrage, falls passend' },
            datum: { type: 'string', description: 'JJJJ-MM-TT; bei Filmen im Kino: Kinostart (wenn schon im Kino: leer lassen)' },
            uhrzeit: { type: 'string', description: 'HH:MM in Ortszeit von Mateos Stadt (umrechnen!), falls bekannt' },
            wo: { type: 'string', description: 'Sender/Stream (z.B. „ESPN, Disney+“, „F1 TV, Fox Sports“) oder „Kino“' },
            status: { type: 'string', enum: ['termin', 'im_kino', 'demnaechst'], description: 'termin = Übertragung/Spiel/Rennen; im_kino = läuft schon; demnaechst = kommt bald ins Kino' },
            vorstellungen: { type: 'array', description: 'Nur bei Kinofilmen, wenn gefunden: Kinos mit Uhrzeiten', items: { type: 'object', properties: { kino: { type: 'string' }, zeiten: { type: 'string', description: 'z.B. „17:30, 20:15“' } }, required: ['kino'] } },
            info: { type: 'string', description: 'max. 8 Wörter (z.B. Genre, Liga, Bedeutung)' },
            url: { type: 'string', description: 'Link aus den Suchergebnissen, nie erfinden' },
          },
          required: ['name'],
        },
      },
    },
    required: ['eintraege'],
  },
};

const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
const okUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '');

export async function searchShows(s, query, city, cats = []) {
  const t = today();
  const all = showCatsOf(s);
  const system = `Du bist Mateos Unterhaltungs-Scout. Er wohnt in ${city}. Heute ist ${fmtLong(t)} (${t}). Zeitraum: die nächsten 14 Tage (bis ${addDays(t, 14)}), außer die Anfrage sagt etwas anderes.
Es geht um Dinge zum Anschauen: Sport-Übertragungen im TV/Stream (Fußball, Formel 1, Tennis …), Kinofilme (was läuft, was kommt, Vorstellungen in Kinos in ${city}), Serien/Dokus (neue Staffeln, Starttermine).
Seine Kategorien: ${all.map(catName).join(', ')}.${cats.length ? ` Diesmal nur: ${cats.map(catName).join(', ')}.` : ''}
Was er schon auf der Liste hat (nicht wiederholen): ${JSON.stringify((s.shows || []).map((x) => x.name))}
Was du über ihn weißt: ${JSON.stringify((s.memory || []).map((m) => m.text))}
So suchst du (höchstens 3 Suchen, gezielt): offizielle Kalender/Spielpläne (z.B. formula1.com, Liga-Fixture, Promiedos, ESPN), „dónde ver“/TV-Programm für Sender in Argentinien, Kino-Programm (cartelera) der großen Kinos in ${city} mit Uhrzeiten.
Uhrzeiten IMMER in die Ortszeit von ${city} umrechnen. Bei Formel 1: Rennen (und wenn gefragt Qualifying) als eigene Einträge. Bei Kinofilmen: status im_kino oder demnaechst, Kinostart als datum, bei Vorstellungen 2–4 Kinos mit Zeiten.
Dann rufe "unterhaltung_zeigen" auf: 5 bis 12 Einträge, sortiert nach Datum. Nur echte Angaben aus den Suchergebnissen, keine erfundenen Zeiten oder Links. Texte auf Deutsch, kurz.`;
  const input = await searchWithTool({ system, user: `Anfrage: ${query}`, tool: SHOW_TOOL, maxUses: 3, label: 'Unterhaltung suchen', city });
  const results = (input.eintraege || []).filter((e) => e && e.name).map((e, i) => {
    const cat = all.find((c) => catName(c).toLowerCase() === String(e.kategorie || '').toLowerCase()) || (e.kategorie ? String(e.kategorie) : '');
    return {
      id: 'u' + i + Date.now().toString(36),
      name: String(e.name),
      cat,
      date: okDate(e.datum),
      time: /^\d{1,2}:\d{2}$/.test(e.uhrzeit || '') ? e.uhrzeit.padStart(5, '0') : '',
      where: e.wo || '',
      kind: ['termin', 'im_kino', 'demnaechst'].includes(e.status) ? e.status : 'termin',
      shows: (e.vorstellungen || []).filter((v) => v && v.kino).map((v) => ({ kino: String(v.kino), zeiten: String(v.zeiten || '') })).slice(0, 6),
      info: e.info || '',
      url: okUrl(e.url),
      status: 'neu',
    };
  }).sort((a, b) => (a.date || '0') < (b.date || '0') ? -1 : 1);
  const v = { query, city, at: new Date().toISOString(), note: input.hinweis || '', results };
  saveShowSearch(v);
  return v;
}

// v1.58 (Mateo): „Wo schauen?“ – Sportbars, die das Spiel zeigen, bzw. Kinos mit Uhrzeiten für einen Film (Websuche)
export const watchSub = (x) => (isCinema(x?.cat) || /kino/i.test(x?.where || '') ? 'Kino' : 'Sportbar');
const WATCH_TOOL = {
  name: 'orte_zum_schauen',
  description: 'Orte, an denen Mateo das Spiel/den Film schauen kann.',
  input_schema: {
    type: 'object',
    properties: {
      hinweis: { type: 'string', description: 'Optional 1 Satz (z.B. „Zeiten ab Donnerstag online“)' },
      orte: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name des Kinos/der Bar, z.B. „Cinemark Palermo“' },
            viertel: { type: 'string' },
            adresse: { type: 'string', description: 'Straße + Nummer, falls bekannt' },
            zeiten: { type: 'string', description: 'Bei Kinos: Vorstellungen, z.B. „Do 17:30, 20:15 · Sa 22:00“ (Sprache/Format: OV/Synchro, 3D, falls bekannt)' },
            info: { type: 'string', description: 'max. 8 Wörter, z.B. „große Leinwände, River-Fans“, „IMAX“' },
            url: { type: 'string', description: 'Link aus den Suchergebnissen, nie erfinden' },
          },
          required: ['name'],
        },
      },
    },
    required: ['orte'],
  },
};
export async function findWatchPlaces(s, x, city) {
  const kino = watchSub(x) === 'Kino';
  const mine = (s.places || []).filter((p) => p.category === 'Zum Schauen' || /kino|sportbar/i.test(p.subcat || '')).map((p) => p.name);
  const system = kino
    ? `Mateo will den Film „${x.name}“ im Kino in ${city} sehen${x.date ? ` (ab/um ${x.date})` : ''}. Heute ist ${fmtLong(today())} (${today()}). Suche (höchstens 3 Suchen, auf Spanisch, z.B. „${x.name} cartelera ${city}“, Seiten von Cinemark Hoyts, Showcase, Cinépolis, Atlas, Multiplex, Gaumont) Kinos, die ihn zeigen, mit konkreten Uhrzeiten für die nächsten Tage. Seine Lieblingskinos zuerst, falls sie ihn zeigen: ${JSON.stringify(mine)}. 3–6 Kinos. Nur echte Angaben, keine erfundenen Zeiten. Antworte mit "orte_zum_schauen".`
    : `Mateo will „${x.name}“${x.date ? ` am ${x.date}${x.time ? ` um ${x.time}` : ''}` : ''} in ${city} in einer Bar oder bei einem Public Viewing schauen. Heute ist ${fmtLong(today())} (${today()}). Suche (höchstens 3 Suchen, auf Spanisch, z.B. „bares para ver ${x.name} ${city}“, „dónde ver fútbol bar ${city}“) Sportbars/Pubs, die so etwas zeigen (große Leinwände, Ton an), oder Public Viewings. Seine Lieblingsorte: ${JSON.stringify(mine)}. 3–6 Orte mit Viertel. Nur echte Orte. Antworte mit "orte_zum_schauen".`;
  const input = await searchWithTool({ system, user: `${x.name} · ${city}`, tool: WATCH_TOOL, maxUses: 3, label: kino ? 'Kinozeiten suchen' : 'Sportbars suchen', city });
  return { kino, note: input.hinweis || '', list: (input.orte || []).filter((o) => o && o.name).map((o, i) => ({ id: 'w' + i, name: String(o.name), hood: o.viertel || '', address: o.adresse || '', times: o.zeiten || '', info: o.info || '', url: okUrl(o.url) })) };
}
