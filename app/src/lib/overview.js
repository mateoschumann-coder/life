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

// Alle Punkte mit eindeutiger Referenz, Link und möglichen Aktionen
export function collectItems(s) {
  const t = today();
  const soon = addDays(t, 14);
  const items = [];
  const add = (x) => items.push(x);
  const areaName = (id) => areaOf(s, id)?.name || 'Allgemein';

  // Aufgaben: überfällig, diese Woche, ohne Datum (nach Bereich)
  for (const x of s.tasks.filter((x) => !x.done && !x.idea)) {
    const proj = x.projectId ? s.projects.find((p) => p.id === x.projectId) : null;
    const area = proj ? proj.areaId : x.areaId;
    if (x.due && x.due > addDays(t, 7)) continue;
    add({ ref: `task:${x.id}`, kind: 'task', id: x.id, text: x.title, area: proj ? proj.name : areaName(area), date: x.due || '', info: x.due ? when(x.due, t) : 'ohne Datum', link: proj ? `#/projekt/${proj.id}` : area ? `#/bereich/${area}` : '#/heute' });
  }
  // Eigene Events (Sozial) mit offener Vorbereitung
  for (const g of (s.gatherings || []).filter((g) => !g.done && (!g.date || g.date <= soon) && (!g.date || g.date >= t))) {
    const open = g.todos.filter((x) => !x.done).length;
    const shop = (g.shopping || []).filter((x) => !x.done).length;
    const notInvited = g.guests.filter((x) => x.status === 'offen').length;
    add({ ref: `gathering:${g.id}`, kind: 'gathering', text: g.name, area: 'Eigenes Event', date: g.date || '', info: [g.date ? when(g.date, t) : 'Datum offen', open && `${open} To-dos offen`, shop && `${shop} Einkäufe`, notInvited && `${notInvited} noch nicht eingeladen`].filter(Boolean).join(' · '), link: `#/treffen/${g.id}` });
  }
  // Vorgemerkte Events (Ausgehen) und Sport-Events
  for (const e of s.events.filter((e) => e.date && e.date >= t && e.date <= soon && e.stage !== 'besucht' && e.stage !== 'entdeckt')) add({ ref: `event:${e.id}`, kind: 'event', text: e.name, area: 'Ausgehen', date: e.date, info: `${when(e.date, t)} · ${e.stage === 'zugesagt' ? 'zugesagt' : 'interessiert'}`, link: '#/ausgehen' });
  for (const e of (s.sportEvents || []).filter((e) => e.date && e.date >= t && e.date <= addDays(t, 60) && e.status !== 'dabei')) add({ ref: `sport:${e.id}`, kind: 'sport', text: e.name, area: 'Sport-Event', date: e.date, info: `${when(e.date, t)} · ${e.status === 'angemeldet' ? 'angemeldet' : 'interessiert – anmelden?'}`, link: `#/sport/${e.sportId}` });
  // Reisen in den nächsten 45 Tagen
  for (const tr of (s.trips || []).filter((tr) => tr.status !== 'idee' && tr.from && tr.from >= t && tr.from <= addDays(t, 45))) {
    const open = tr.todo.filter((x) => !x.done).length;
    add({ ref: `trip:${tr.id}`, kind: 'trip', text: tr.name, area: 'Reise', date: tr.from, info: `${when(tr.from, t)} · ${open} To-dos offen`, link: `#/reisen/${tr.id}` });
  }
  // Menschen: Geburtstage, lange nicht gemeldet
  for (const b of upcomingBirthdays(s, t, 10)) add({ ref: `bday:${b.person.id}`, kind: 'person', id: b.person.id, text: `Geburtstag ${b.person.name}`, area: 'Menschen', date: addDays(t, b.inDays), info: b.inDays === 0 ? 'heute' : `in ${b.inDays} Tagen`, link: `#/person/${b.person.id}`, wa: waLink(b.person) });
  for (const x of peopleOverdue(s, t).slice(0, 4)) add({ ref: `person:${x.person.id}`, kind: 'person', id: x.person.id, text: `${x.person.name} melden`, area: 'Menschen', info: 'Rhythmus überschritten', link: `#/person/${x.person.id}`, wa: waLink(x.person) });
  // Erinnerungen und Vorsorge
  for (const r of (s.reminders || []).filter((r) => r.next <= addDays(t, 3))) add({ ref: `reminder:${r.id}`, kind: 'reminder', id: r.id, text: r.title, area: 'Zuhause', date: r.next, info: when(r.next, t), link: '#/zuhause/erinnerungen' });
  for (const h of (s.healthItems || []).filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt' && h.date && h.date <= addDays(t, 7))) add({ ref: `health:${h.id}`, kind: 'health', id: h.id, text: h.title, area: 'Vorsorge', date: h.date, info: when(h.date, t), link: '#/vorsorge' });
  // Bewerbungen: lange keine Rückmeldung oder Gespräch ansteht
  for (const j of (s.jobs || []).filter((j) => ['beworben', 'rueckmeldung', 'gespraech', 'angebot'].includes(j.status))) {
    const days = diffDays(j.updatedAt || j.createdAt || t, t);
    add({ ref: `job:${j.id}`, kind: 'job', text: `${j.title}${j.company ? ` · ${j.company}` : ''}`, area: 'Jobsuche', info: `${j.status}${days > 0 ? ` · seit ${days} Tagen unverändert` : ''}`, link: `#/karriere/job/${j.id}` });
  }
  // Eigene Projekte & Lernen
  for (const p of (s.sideProjects || []).filter((p) => p.status === 'aktiv')) {
    const last = p.log.map((l) => l.date).sort().pop();
    add({ ref: `sp:${p.id}`, kind: 'link', text: p.name, area: 'Eigenes Projekt', info: last ? `zuletzt vor ${diffDays(last, t)} Tagen` : 'noch nicht dran gearbeitet', link: `#/karriere/projekt/${p.id}` });
  }
  for (const k of (s.skills || []).filter((k) => (k.todos || []).some((x) => !x.done))) add({ ref: `skill:${k.id}`, kind: 'link', text: k.name, area: 'Weiterentwicklung', info: `${k.todos.filter((x) => !x.done).length} offene Punkte, nächster: ${k.todos.find((x) => !x.done).text}`, link: `#/skills/${k.id}` });
  // Einkauf
  const shopN = s.shopping.items.filter((x) => !x.done).length;
  if (shopN) add({ ref: 'shopping', kind: 'link', text: `Einkaufsliste: ${shopN} Sachen`, area: 'Küche', info: s.shopping.items.filter((x) => !x.done).slice(0, 4).map((x) => x.name).join(', '), link: '#/kueche' });
  return items;
}

const TOOL = {
  name: 'ueberblick_geben',
  description: 'Strukturierter Überblick über Mateos aktuelle Lage.',
  input_schema: {
    type: 'object',
    properties: {
      lage: { type: 'string', description: '1–2 Sätze: Wie sieht es gerade aus, worauf kommt es heute/diese Woche an? Persönlich, konkret, ohne Floskeln.' },
      abschnitte: {
        type: 'array',
        description: '3–5 Abschnitte, nach Wichtigkeit sortiert, z.B. „Heute wichtig“, „Bald anstehend – vorbereiten“, „Menschen“, „Dranbleiben“',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string' },
            punkte: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string', description: 'Genau eine ref aus der Liste' }, hinweis: { type: 'string', description: 'Kurzer Halbsatz, warum/was zu tun ist (z.B. „Einladung noch nicht raus“)' } }, required: ['ref'] } },
          },
          required: ['titel', 'punkte'],
        },
      },
    },
    required: ['lage', 'abschnitte'],
  },
};
export async function askOverview(s) {
  const items = collectItems(s);
  const t = today();
  const system = `Du bist Mateos ruhiger Organisator in der App „Life“. Heute ist ${fmtLong(t)} (${t}).
Du bekommst alles, was in seiner App gerade offen oder bald fällig ist (jeder Punkt mit "ref"). Mach daraus einen klaren Überblick:
- Wähle das Wichtigste aus (höchstens 12 Punkte insgesamt), gruppiere es in 3–5 Abschnitte, sortiert nach Dringlichkeit.
- Denk mit: Was muss VORBEREITET werden (Event in 3 Tagen mit offenen To-dos, Reise mit offener Packliste, Geburtstag morgen, Bewerbung ohne Rückmeldung → nachfassen)?
- Überfälliges und Heute zuerst; Dinge ohne Datum nur, wenn sie wirklich wichtig sind.
- Nutze nur refs aus der Liste, erfinde nichts. Deutsch, kurz, kein Markdown.
Antworte mit "ueberblick_geben".`;
  const r = await searchWithTool({ system, user: JSON.stringify(items.map(({ ref, text, area, info }) => ({ ref, text, bereich: area, stand: info }))), tool: TOOL, maxUses: 0, maxTokens: 2000, label: 'Überblick' });
  const v = { date: t, at: new Date().toISOString(), lage: r.lage || '', sections: (r.abschnitte || []).map((a) => ({ title: a.titel, points: (a.punkte || []).filter((p) => items.some((i) => i.ref === p.ref)).map((p) => ({ ref: p.ref, note: p.hinweis || '' })) })).filter((a) => a.points.length) };
  saveOverview(v);
  return v;
}

// Ohne KI: einfache Gruppierung nach Dringlichkeit
export function localOverview(s) {
  const items = collectItems(s);
  const t = today();
  const urgent = items.filter((i) => i.date && i.date <= t);
  const soon = items.filter((i) => i.date && i.date > t && i.date <= addDays(t, 7));
  const rest = items.filter((i) => !i.date).slice(0, 5);
  return {
    lage: '',
    sections: [
      { title: 'Heute & überfällig', points: urgent.map((i) => ({ ref: i.ref })) },
      { title: 'Diese Woche', points: soon.map((i) => ({ ref: i.ref })) },
      { title: 'Ohne Datum', points: rest.map((i) => ({ ref: i.ref })) },
    ].filter((x) => x.points.length),
  };
}
