// Überblick auf „Heute“: sammelt, was in der App gerade los ist (To-dos, Events, Reisen, Menschen, Bewerbungen …),
// die KI (ohne Internet, sehr günstig) ordnet es zu einer kurzen, strukturierten Zusammenfassung mit Knöpfen.
import { addDays, diffDays, fmtLong, today } from './dates';
import { areaOf, peopleOverdue, upcomingBirthdays, waLink } from './logic';
import { searchWithTool } from './outings';

const KEY = 'life-app-overview';
export function loadOverview() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
export function saveOverview(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}
const inDays = (d, t) => (d ? diffDays(t, d) : null);
const when = (d, t) => {
  const n = inDays(d, t);
  if (n == null) return '';
  if (n < 0) return `seit ${-n} T. überfällig`;
  return n === 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} Tagen`;
};

// Die Bereiche in der Reihenfolge der App – die KI geht sie nacheinander durch
export const SECTIONS = [
  { key: 'aufgaben', name: 'Aufgaben', link: '#/heute', icon: 'check', areaId: null },
  { key: 'sport', name: 'Sport-Events', link: '#/sport', icon: 'run', areaId: 'koerper' },
  { key: 'vorsorge', name: 'Vorsorge', link: '#/vorsorge', icon: 'medical', areaId: 'koerper' },
  { key: 'kueche', name: 'Küche', link: '#/kueche', icon: 'pot', areaId: 'koerper' },
  { key: 'wissen', name: 'Lernen & Wissen', link: '#/wissen', icon: 'bulb', areaId: 'mental' },
  { key: 'zuhause', name: 'Zuhause', link: '#/zuhause/haushalt', icon: 'home', areaId: 'zuhause' },
  { key: 'freizeit', name: 'Hobbys & Reisen', link: '#/bereich/freizeit', icon: 'plane', areaId: 'freizeit' },
  { key: 'finanzen', name: 'Finanzen', link: '#/finanzen', icon: 'wallet', areaId: 'finanzen' },
  { key: 'menschen', name: 'Menschen', link: '#/menschen', icon: 'users', areaId: 'freunde' },
  { key: 'events', name: 'Events & Ausgehen', link: '#/ausgehen', icon: 'calendar', areaId: 'erlebnisse' },
  { key: 'karriere', name: 'Jobsuche & Projekte', link: '#/karriere', icon: 'briefcase', areaId: 'karriere' },
  { key: 'entwicklung', name: 'Weiterentwicklung', link: '#/skills', icon: 'book', areaId: 'entwicklung' },
  { key: 'informiert', name: 'Informiert bleiben', link: '#/news', icon: 'news', areaId: 'informiert' },
];
export const secOf = (key) => SECTIONS.find((x) => x.key === key);

// Alle Punkte mit eindeutiger Referenz, Link und möglichen Aktionen
export function collectItems(s) {
  const t = today();
  const soon = addDays(t, 14);
  const items = [];
  const add = (sec, x) => items.push({ sec, ...x });
  const areaName = (id) => areaOf(s, id)?.name || 'Allgemein';

  // Aufgaben: überfällig, diese Woche, ohne Datum
  for (const x of s.tasks.filter((x) => !x.done && !x.idea)) {
    const proj = x.projectId ? s.projects.find((p) => p.id === x.projectId) : null;
    const area = proj ? proj.areaId : x.areaId;
    if (x.due && x.due > addDays(t, 7)) continue;
    add('aufgaben', { ref: `task:${x.id}`, kind: 'task', id: x.id, text: x.title, area: proj ? proj.name : areaName(area), date: x.due || '', info: x.due ? when(x.due, t) : 'ohne Datum', link: proj ? `#/projekt/${proj.id}` : area ? `#/bereich/${area}` : '#/heute' });
  }
  for (const e of (s.sportEvents || []).filter((e) => e.date && e.date >= t && e.date <= addDays(t, 60) && e.status !== 'dabei')) add('sport', { ref: `sport:${e.id}`, kind: 'sport', text: e.name, area: s.sports.find((x) => x.id === e.sportId)?.name || 'Sport', date: e.date, info: `${when(e.date, t)} · ${e.status === 'angemeldet' ? 'angemeldet' : 'gemerkt – anmelden?'}`, link: '#/sport' });
  for (const h of (s.healthItems || []).filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt' && h.date && h.date <= addDays(t, 7))) add('vorsorge', { ref: `health:${h.id}`, kind: 'health', id: h.id, text: h.title, area: 'Vorsorge', date: h.date, info: when(h.date, t), link: '#/vorsorge' });
  const shopN = s.shopping.items.filter((x) => !x.done).length;
  if (shopN) add('kueche', { ref: 'shopping', kind: 'link', text: `Einkaufsliste: ${shopN} Sachen`, area: 'Küche', info: s.shopping.items.filter((x) => !x.done).slice(0, 4).map((x) => x.name).join(', '), link: '#/kueche' });
  for (const m of (s.library || []).filter((m) => m.status === 'aktiv').slice(0, 3)) add('wissen', { ref: `lib:${m.id}`, kind: 'link', text: m.title, area: 'Gerade dabei', info: m.author || '', link: `#/wissen/${m.cat || ''}` });
  for (const r of (s.reminders || []).filter((r) => r.next <= addDays(t, 3))) add('zuhause', { ref: `reminder:${r.id}`, kind: 'reminder', id: r.id, text: r.title, area: 'Erinnerung', date: r.next, info: when(r.next, t), link: '#/zuhause/erinnerungen' });
  for (const tr of (s.trips || []).filter((tr) => tr.status !== 'idee' && tr.from && tr.from >= t && tr.from <= addDays(t, 45))) {
    const open = tr.todo.filter((x) => !x.done).length;
    add('freizeit', { ref: `trip:${tr.id}`, kind: 'trip', text: tr.name, area: 'Reise', date: tr.from, info: `${when(tr.from, t)} · ${open} To-dos offen`, link: `#/reisen/${tr.id}` });
  }
  for (const b of upcomingBirthdays(s, t, 10)) add('menschen', { ref: `bday:${b.person.id}`, kind: 'person', id: b.person.id, text: `Geburtstag ${b.person.name}`, area: 'Geburtstag', date: addDays(t, b.inDays), info: b.inDays === 0 ? 'heute' : `in ${b.inDays} Tagen`, link: `#/person/${b.person.id}`, wa: waLink(b.person) });
  for (const x of peopleOverdue(s, t).slice(0, 4)) add('menschen', { ref: `person:${x.person.id}`, kind: 'person', id: x.person.id, text: `${x.person.name} schreiben`, area: 'Melde dich mal', info: x.since == null ? 'noch kein Kontakt notiert' : `seit ${x.since} Tagen kein Kontakt`, link: `#/person/${x.person.id}`, wa: waLink(x.person) });
  for (const g of (s.gatherings || []).filter((g) => !g.done && (!g.date || g.date <= soon) && (!g.date || g.date >= t))) {
    const open = g.todos.filter((x) => !x.done).length;
    const shop = (g.shopping || []).filter((x) => !x.done).length;
    const notInvited = g.guests.filter((x) => x.status === 'offen').length;
    add('events', { ref: `gathering:${g.id}`, kind: 'gathering', text: g.name, area: 'Eigenes Event', date: g.date || '', info: [g.date ? when(g.date, t) : 'Datum offen', open && `${open} To-dos offen`, shop && `${shop} Einkäufe`, notInvited && `${notInvited} noch nicht eingeladen`].filter(Boolean).join(' · '), link: `#/treffen/${g.id}` });
  }
  for (const e of s.events.filter((e) => e.date && e.date >= t && e.date <= soon && e.stage !== 'besucht' && e.stage !== 'entdeckt')) add('events', { ref: `event:${e.id}`, kind: 'event', text: e.name, area: 'Ausgehen', date: e.date, info: `${when(e.date, t)} · ${e.stage === 'zugesagt' ? 'zugesagt' : 'interessiert'}`, link: '#/ausgehen' });
  for (const j of (s.jobs || []).filter((j) => ['beworben', 'rueckmeldung', 'gespraech', 'angebot'].includes(j.status))) {
    const days = diffDays(j.updatedAt || j.createdAt || t, t);
    add('karriere', { ref: `job:${j.id}`, kind: 'job', text: `${j.title}${j.company ? ` · ${j.company}` : ''}`, area: 'Bewerbung', info: `${j.status}${days > 0 ? ` · seit ${days} Tagen unverändert` : ''}`, link: `#/karriere/job/${j.id}` });
  }
  for (const p of (s.sideProjects || []).filter((p) => p.status === 'aktiv')) {
    const last = p.log.map((l) => l.date).sort().pop();
    add('karriere', { ref: `sp:${p.id}`, kind: 'link', text: p.name, area: 'Eigenes Projekt', info: last ? `zuletzt vor ${diffDays(last, t)} Tagen` : 'noch nicht dran gearbeitet', link: `#/karriere/projekt/${p.id}` });
  }
  for (const k of (s.skills || []).filter((k) => (k.todos || []).some((x) => !x.done))) add('entwicklung', { ref: `skill:${k.id}`, kind: 'link', text: k.name, area: 'Skill', info: `${k.todos.filter((x) => !x.done).length} offen, nächstes: ${k.todos.find((x) => !x.done).text}`, link: `#/skills/${k.id}` });
  return items;
}

// Kurzer Stand pro Bereich (auch wenn nichts ansteht) – damit die KI fragen oder anstoßen kann
function facts(s) {
  const t = today();
  const hobbies = (s.hobbies || []).map((h) => `${h.name} (${h.items.filter((x) => x.status !== 'geschafft').length} offen, ${h.items.filter((x) => x.status === 'geschafft').length} geschafft)`);
  const b = s.budget;
  return {
    sport: { sportarten: s.sports.map((x) => x.name), gemerkt: (s.sportEvents || []).filter((e) => e.status === 'interessiert').length, angemeldet: (s.sportEvents || []).filter((e) => e.status === 'angemeldet').map((e) => `${e.name} ${e.date || ''}`) },
    vorsorge: { offen: (s.healthItems || []).filter((h) => h.status !== 'erledigt' && h.status !== 'ausgeheilt').map((h) => h.title) },
    kueche: { rezepte: (s.recipes || []).length, einkaufsliste: s.shopping.items.filter((x) => !x.done).length },
    wissen: { gerade_dabei: (s.library || []).filter((m) => m.status === 'aktiv').map((m) => m.title), auf_der_liste: (s.library || []).filter((m) => m.status === 'will').length, zuletzt_fertig: (s.library || []).filter((m) => m.status === 'fertig').slice(-2).map((m) => m.title) },
    zuhause: { offene_punkte: Object.values(s.home || {}).reduce((n, l) => n + (l.items || []).filter((x) => !x.done).length, 0), erinnerungen: (s.reminders || []).length },
    freizeit: { hobbys: hobbies, reise_ideen: (s.trips || []).filter((x) => x.status === 'idee').map((x) => x.name), geplante_reisen: (s.trips || []).filter((x) => x.status !== 'idee' && (!x.to || x.to >= t)).map((x) => `${x.name} ${x.from || ''}`) },
    finanzen: { eingerichtet: !!(b && (b.incomes || []).length), fixkosten_posten: (b?.costs || []).length },
    menschen: { personen: s.people.length, mit_rhythmus: s.people.filter((p) => p.contactEvery).length },
    events: { eigene_events: (s.gatherings || []).filter((g) => !g.done).length, vorgemerkt: s.events.filter((e) => e.stage === 'interessiert' || e.stage === 'zugesagt').length, ausgeh_vorlieben: s.profile?.eventPrefs || [] },
    karriere: { jobsuchen: (s.jobSearches || []).map((x) => x.name), bewerbungen: (s.jobs || []).map((j) => `${j.title} @ ${j.company} (${j.status})`).slice(0, 12), eigene_projekte: (s.sideProjects || []).map((p) => `${p.name} (${p.status})`) },
    entwicklung: { skills: (s.skills || []).map((k) => `${k.name}: ${(k.todos || []).filter((x) => x.done).length}/${(k.todos || []).length} Ziele`) },
    informiert: { eigene_quellen: (s.newsSources || []).map((x) => x.name) },
  };
}

const TOOL = {
  name: 'ueberblick_geben',
  description: 'Strukturierter Durchgang durch Mateos Bereiche.',
  input_schema: {
    type: 'object',
    properties: {
      lage: { type: 'string', description: '1–2 Sätze: Worauf kommt es heute/diese Woche an? Persönlich, konkret, ohne Floskeln.' },
      bereiche: {
        type: 'array',
        description: 'Die Bereiche in der vorgegebenen Reihenfolge; nur die, zu denen es etwas Sinnvolles gibt (meist 6–10).',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: SECTIONS.map((x) => x.key) },
            punkte: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string', description: 'Genau eine ref aus der Liste' }, hinweis: { type: 'string', description: 'Kurzer Halbsatz, was zu tun ist (z.B. „Einladung noch nicht raus“)' } }, required: ['ref'] } },
            frage: { type: 'string', description: 'Optional: eine kurze, konkrete Frage, wie es dort läuft – nur wenn dort gerade etwas läuft (z.B. „Wie läuft das Buch über den Kalten Krieg?“)' },
            vorschlag: { type: 'string', description: 'Optional: wenn dort nichts los ist oder es eingeschlafen wirkt – ein kurzer konkreter Anstoß als Aufgabe formuliert (z.B. „Einen Halbmarathon für März aussuchen“)' },
          },
          required: ['key'],
        },
      },
    },
    required: ['lage', 'bereiche'],
  },
};
export async function askOverview(s) {
  const items = collectItems(s);
  const t = today();
  const system = `Du bist Mateos ruhiger Organisator in der App „Life“. Heute ist ${fmtLong(t)} (${t}).
Geh die Bereiche seiner App nacheinander durch (Reihenfolge: ${SECTIONS.map((x) => x.key).join(', ')}). Pro Bereich bekommst du, was dort offen oder bald fällig ist (Punkte mit "ref"), und einen kurzen Stand.
Für jeden Bereich:
- Steht etwas an → die wichtigen Punkte (punkte) mit kurzem Hinweis, was zu tun ist; denk mit, was VORBEREITET werden muss (Event in 3 Tagen mit offenen To-dos, Geburtstag morgen, Bewerbung ohne Rückmeldung → nachfassen, jemandem schreiben).
- Läuft dort gerade etwas ohne Dringlichkeit → eine kurze Frage, wie es läuft.
- Ist dort nichts los oder eingeschlafen → ein kurzer, konkreter Vorschlag (eine Aufgabe, die sofort machbar ist).
Lass Bereiche weg, zu denen es nichts Sinnvolles gibt. Höchstens 14 Punkte insgesamt, pro Bereich höchstens eins von frage/vorschlag. Nutze nur refs aus der Liste, erfinde nichts. Deutsch, kurz, kein Markdown. Antworte mit "ueberblick_geben".`;
  const byKey = {};
  for (const i of items) (byKey[i.sec] = byKey[i.sec] || []).push({ ref: i.ref, text: i.text, stand: [i.area, i.info].filter(Boolean).join(' · ') });
  const f = facts(s);
  const input = SECTIONS.map((x) => ({ key: x.key, bereich: x.name, offen: byKey[x.key] || [], stand: f[x.key] }));
  const r = await searchWithTool({ system, user: JSON.stringify(input), tool: TOOL, maxUses: 0, maxTokens: 2500, label: 'Überblick' });
  const v = {
    date: t, at: new Date().toISOString(), lage: r.lage || '', done: [],
    sections: (r.bereiche || []).filter((b) => secOf(b.key)).map((b) => ({ key: b.key, points: (b.punkte || []).filter((p) => items.some((i) => i.ref === p.ref)).map((p) => ({ ref: p.ref, note: p.hinweis || '' })), ask: b.frage || '', idea: b.vorschlag || '' }))
      .filter((b) => b.points.length || b.ask || b.idea)
      .sort((a, b2) => SECTIONS.findIndex((x) => x.key === a.key) - SECTIONS.findIndex((x) => x.key === b2.key)),
  };
  saveOverview(v);
  return v;
}

// Ohne KI: Punkte nach Bereichen gruppiert
export function localOverview(s) {
  const items = collectItems(s);
  return {
    lage: '', done: [],
    sections: SECTIONS.map((x) => ({ key: x.key, points: items.filter((i) => i.sec === x.key).slice(0, 6).map((i) => ({ ref: i.ref })), ask: '', idea: '' })).filter((x) => x.points.length),
  };
}
