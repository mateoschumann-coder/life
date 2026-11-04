// Suchindex für die globale Suche (Lupe oben). Reine Funktion ohne Oberfläche → automatisch testbar.
// Jeder Treffer beschreibt sein Ziel als Daten (`to`): Route + Merk-Schlüssel, die vor dem Sprung gesetzt werden.
//   to = { route, ls: {key: value} (localStorage), ss: {…} (sessionStorage), city }
// Mit `all: true` werden auch Erledigtes, Archiviertes und Rausgenommenes durchsucht (Kennzeichen `old`).

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const short = (d) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.` : '');
const meta = (...x) => x.filter(Boolean).join(' · ');
const PEOPLE_CAT = { familie: 'Familie', freunde: 'Freunde', neu: 'Neue Kontakte', beruflich: 'Beruflich' };
// Texte aus beliebigen Feldern eines Eintrags (manche Bereiche speichern den Namen in text, title oder name)
export const labelOf = (x) => (x && (x.title || x.name || x.text || x.fakt)) || (typeof x === 'string' ? x : '');

export function searchIndex(s, { all = false } = {}) {
  const G = [];
  const add = (key, label, items) => G.push({ key, label, items: items.filter((x) => x.title) });
  const keep = (x, isOld) => all || !isOld(x);
  const oldTag = (isOld) => (x) => (isOld(x) ? 'erledigt' : '');

  add('people', '👤 Personen', (s.people || []).map((p) => ({ title: p.name, extra: [p.notes, p.phone], sub: PEOPLE_CAT[p.category] || '', to: { route: `/person/${p.id}` } })));

  const taskTo = (t) => (t.personId ? { route: `/person/${t.personId}` } : t.projectId ? { route: `/projekt/${t.projectId}` } : { route: '/heute', ls: { 'life-app-heute-view': 'todos' } });
  add('tasks', '✅ Aufgaben', [
    ...(s.tasks || []).filter((t) => keep(t, (x) => x.done)).map((t) => ({ title: t.title, extra: [t.notes], sub: meta(t.done && 'erledigt', t.due ? short(t.due) : 'ohne Datum', t.time), old: !!t.done, to: taskTo(t) })),
    ...(all ? (s.removedTasks || []).map((t) => ({ title: t.title, extra: [t.notes], sub: 'rausgenommen (Heute → Kiste)', old: true, to: { route: '/heute', ls: { 'life-app-heute-view': 'todos' } } })) : []),
  ]);

  const evTo = (e) => ({ route: '/ausgehen', ls: { 'life-app-ausgehen-tab': 'events', 'life-app-events-view': 'mine', 'life-app-events-stage': e.stage === 'zugesagt' ? 'zugesagt' : 'interessiert' }, ss: { 'life-open-event': e.id }, city: e.city });
  add('events', '🎶 Events (Ausgehen)', [
    ...(s.events || []).map((e) => ({ title: e.name, extra: [e.place, e.note, e.city, e.address], sub: meta(short(e.date), e.place), to: evTo(e) })),
    ...(all ? (s.removedEvents || []).map((e) => ({ title: e.name, extra: [e.place, e.note], sub: meta('rausgenommen', short(e.date)), old: true, to: { route: '/ausgehen', ls: { 'life-app-ausgehen-tab': 'events', 'life-app-events-view': 'mine' } } })) : []),
  ]);

  const tvTo = (x) => ({ route: '/ausgehen', ls: { 'life-app-ausgehen-tab': 'tv', 'life-app-tv-view': 'mine', 'life-app-tv-cats': '[]' }, ...(x ? { ss: { 'life-open-show': x.id } } : {}) });
  add('shows', '📺 Unterhaltung', [
    ...(s.shows || []).filter((x) => keep(x, (y) => y.done)).map((x) => ({ title: x.name, extra: [x.where, x.cat, x.note], sub: meta(x.done && 'gesehen', short(x.date), x.time, x.where), old: !!x.done, to: tvTo(x) })),
    ...(all ? (s.removedShows || []).map((x) => ({ title: x.name, extra: [x.where], sub: meta('rausgenommen', short(x.date)), old: true, to: tvTo(null) })) : []),
  ]);

  add('gatherings', '🎉 Treffen', [
    ...(s.gatherings || []).filter((g) => keep(g, (x) => x.done)).map((g) => ({ title: g.name, extra: [g.place, g.motto, g.address, ...(g.guests || []).map((x) => x.name)], sub: meta(g.done && 'vorbei', g.idea ? 'Idee' : '', short(g.date), g.place), old: !!g.done, to: { route: `/treffen/${g.id}` } })),
    ...(all ? (s.removedGatherings || []).map((g) => ({ title: g.name, extra: [g.place], sub: 'rausgenommen', old: true, to: { route: '/treffen' } })) : []),
  ]);
  add('invites', '💌 Einladungen', [
    ...(s.invites || []).filter((v) => keep(v, (x) => x.done)).map((v) => ({ title: v.name, extra: [v.host, v.place, v.note, v.guests], sub: meta(v.host && `von ${v.host}`, short(v.date)), old: !!v.done, to: { route: '/treffen', ls: { 'life-app-sozial-tab': 'andere' } } })),
    ...(all ? (s.removedInvites || []).map((v) => ({ title: v.name, extra: [v.host], sub: 'rausgenommen', old: true, to: { route: '/treffen', ls: { 'life-app-sozial-tab': 'andere' } } })) : []),
  ]);

  const placeTo = (p) => ({ route: '/ausgehen', ls: { 'life-app-ausgehen-tab': 'orte', 'life-app-places-view': 'mine' }, ss: { 'life-place-q': p.name }, city: p.city });
  add('places', '📍 Orte (Ausgehen)', [
    ...(s.places || []).map((p) => ({ title: p.name, extra: [p.address, p.note, p.hood, p.subcat, p.city, ...(p.tags || [])], sub: meta(p.subcat || p.category, p.hood, p.city), to: placeTo(p) })),
    ...(all ? (s.removedPlaces || []).map((p) => ({ title: p.name, extra: [p.address, p.city], sub: 'rausgenommen', old: true, to: { route: '/ausgehen', ls: { 'life-app-ausgehen-tab': 'orte', 'life-app-places-view': 'mine' } } })) : []),
  ]);
  if (s.profile?.meetPlaces?.length) add('meet', '🏠 Treffpunkte', s.profile.meetPlaces.map((m) => ({ title: m.name, extra: [m.address], sub: m.address || '', to: { route: '/treffen' } })));

  const books = {
    vorsorge: ['🩺 Praxen & Gesundheits-Orte', { route: '/vorsorge', ss: { 'life-vorsorge-view': 'orte' }, ls: { 'life-vorsorge-orte': 'meine' } }],
    kueche: ['🛒 Geschäfte (Küche)', { route: '/kueche', ls: { 'life-app-kueche-tab': 'orte' } }],
    einrichtung: ['🛋 Geschäfte (Einrichtung)', { route: '/zuhause/einrichtung', ls: { 'life-app-zuhause-einrichtung': 'orte' } }],
    kleidung: ['👕 Geschäfte (Kleidung)', { route: '/zuhause/kleidung', ls: { 'life-app-zuhause-kleidung': 'orte' } }],
  };
  for (const [b, [label, to]] of Object.entries(books)) add(`book-${b}`, label, (s.placeBook?.[b]?.items || []).map((x) => ({ title: x.name, extra: [x.address, x.area, x.note, x.sub, x.phone], sub: meta(x.sub, x.area || x.address), to })));

  add('health', '🩺 Termine', [
    ...(s.healthItems || []).filter((h) => keep(h, (x) => x.status === 'erledigt')).map((h) => ({ title: h.title, extra: [h.notes, h.address], sub: meta(h.status === 'erledigt' && 'erledigt', short(h.date), h.time && `${h.time} Uhr`), old: h.status === 'erledigt', to: { route: '/vorsorge', ss: { 'life-vorsorge-view': h.type === 'routine' ? 'routine' : 'termine' } } })),
    ...(all ? (s.removedHealth || []).map((h) => ({ title: h.title, sub: 'rausgenommen (Heute → Kiste)', old: true, to: { route: '/heute' } })) : []),
  ]);
  add('sport', '🏃 Sport-Events', [
    ...(s.sportEvents || []).map((e) => ({ title: e.name, extra: [e.place, e.note, e.result], sub: meta(short(e.date), e.place, e.dist), to: { route: '/sport', ls: { 'life-app-sport-tab': 'meine' }, ss: { 'life-open-sport': e.id } } })),
    ...(all ? (s.removedSportEvents || []).map((e) => ({ title: e.name, extra: [e.place], sub: 'rausgenommen', old: true, to: { route: '/sport', ls: { 'life-app-sport-tab': 'meine' } } })) : []),
  ]);
  add('recipes', '🍳 Rezepte', (s.recipes || []).map((r) => ({ title: r.title, extra: [...(r.ingredients || []), r.note, ...(r.steps || [])], sub: r.category || '', to: { route: '/kueche', ls: { 'life-app-kueche-tab': 'rezepte', 'life-app-rezepte-sub': 'meine' }, ss: { 'life-open-recipe': r.id } } })));
  const shop = s.shopping || {};
  const shopTo = { route: '/kueche', ls: { 'life-app-kueche-tab': 'einkauf' } };
  add('shop', '🛒 Einkauf', [
    ...(shop.items || []).filter((x) => keep(x, (y) => y.done)).map((x) => ({ title: x.name, sub: meta(x.done && 'gekauft', `auf „${shop.listName || 'Einkaufsliste'}“`), old: !!x.done, to: shopTo })),
    ...(shop.lists || []).map((l) => ({ title: l.name, extra: (l.items || []).map((x) => x.name), sub: `Einkaufsliste · ${(l.items || []).length} Artikel`, to: shopTo })),
  ]);
  add('library', '📚 Bibliothek', (s.library || []).map((m) => ({ title: m.title, extra: [m.author, m.about, m.topic, ...(m.notes || []).map((n) => n.text || n)], sub: meta(m.author, m.kind), to: { route: `/wissen/${m.kind || 'buch'}`, ss: { 'life-open-material': m.id } } })));
  const skillExtra = (k) => [...(k.todos || []).map((t) => t.title || t.text), ...(k.materials || []).map((m) => m.title)];
  add('skills', '🎯 Weiterentwicklung', (s.skills || []).map((k) => ({ title: k.name, extra: skillExtra(k), sub: 'Skill', to: { route: `/skills/${k.id}` } })));
  add('hobbies', '🎸 Hobbys', (s.hobbies || []).map((h) => ({ title: h.name, extra: skillExtra(h), sub: 'Hobby', to: { route: `/hobbys/${h.id}` } })));
  add('jobs', '💼 Stellen', (s.jobs || []).map((j) => ({ title: j.title, extra: [j.company, j.location, j.note, j.about], sub: meta(j.company, j.status), to: { route: `/karriere/job/${j.id}` } })));
  add('trips', '🧳 Reisen & Ideen', (s.trips || []).map((t) => ({ title: t.name, extra: [t.dest, t.region, t.group, t.info, t.idea, ...(t.stops || []).map((x) => x.name)], sub: meta(t.status === 'idee' ? 'Idee' : 'Reise', t.dest !== t.name && t.dest, short(t.start)), to: { route: `/reisen/${t.id}` } })));
  add('projects', '📁 Projekte', (s.projects || []).filter((p) => keep(p, (x) => x.archived)).map((p) => ({ title: p.name, extra: [p.goal, p.notes], sub: p.archived ? 'Projekt · archiviert' : 'Projekt', old: !!p.archived, to: { route: `/projekt/${p.id}` } })));
  add('side', '🚀 Eigene Projekte', (s.sideProjects || []).map((p) => ({ title: p.name, extra: [p.goal, p.benefit], sub: p.status || '', to: { route: `/karriere/projekt/${p.id}` } })));
  add('reminders', '🔔 Erinnerungen', [
    ...(s.reminders || []).map((r) => ({ title: r.title, extra: [r.note], sub: meta(r.every, short(r.next || r.due)), to: { route: '/zuhause/allgemein', ls: { 'life-app-zuhause-allgemein': 'erinnern' } } })),
    ...(all ? (s.removedReminders || []).map((r) => ({ title: r.title, sub: 'rausgenommen (Heute → Kiste)', old: true, to: { route: '/heute' } })) : []),
  ]);
  // Zuhause-Einträge speichern ihren Inhalt in `text` (v1.52: vorher fehlten sie in der Suche)
  for (const [k, label] of [['haushalt', '🏠 Haushalt'], ['einrichtung', '🛋 Einrichtung'], ['kleidung', '👕 Kleidung']]) {
    const to = k === 'haushalt' ? { route: '/zuhause/allgemein', ls: { 'life-app-zuhause-allgemein': 'todos' } } : { route: `/zuhause/${k}`, ls: { [`life-app-zuhause-${k}`]: 'liste' } };
    add(`home-${k}`, label, (s.home?.[k]?.items || []).filter((x) => keep(x, (y) => y.done)).map((x) => ({ title: labelOf(x), extra: [x.note, x.cat, x.giveTo], sub: meta(x.done && 'erledigt', x.kind === 'weggeben' ? 'Weggeben' : '', x.cat), old: !!x.done, to })));
  }
  add('sources', '🗞 Quellen', (s.newsSources || []).map((q) => ({ title: q.name, extra: [q.note, q.url, q.type, ...(q.topics || [])], sub: q.type || '', to: { route: '/news' } })));
  add('memory', '🧠 Was Life über dich weiß', (s.memory || []).map((m) => ({ title: labelOf(m), sub: '', to: { route: '/gedaechtnis' } })));
  return G;
}

export function score(x, words) {
  const t = norm(x.title);
  const hay = norm([x.title, x.sub, ...(x.extra || []).flat()].join(' '));
  if (!words.every((w) => hay.includes(w))) return 0;
  const q = words.join(' ');
  const base = t.startsWith(q) ? 4 : t.includes(q) ? 3 : words.every((w) => t.includes(w)) ? 2 : 1;
  return x.old ? base - 0.5 : base; // Aktuelles vor Erledigtem
}

// Suche ausführen: Gruppen mit Treffern, beste Gruppen zuerst
export function runSearch(s, query, opts) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return searchIndex(s, opts)
    .map((g) => ({ ...g, hits: g.items.map((x) => [x, score(x, words)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x) }))
    .filter((g) => g.hits.length)
    .sort((a, b) => Math.max(...b.hits.map((x) => score(x, words))) - Math.max(...a.hits.map((x) => score(x, words))));
}
