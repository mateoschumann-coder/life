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
  { key: 'zuhause', name: 'Zuhause', link: '#/zuhause/allgemein', icon: 'home', areaId: 'zuhause' },
  { key: 'reisen', name: 'Reisen', link: '#/reisen', icon: 'plane', areaId: 'freizeit' },
  { key: 'hobbys', name: 'Hobbys', link: '#/hobbys', icon: 'star', areaId: 'freizeit' },
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
  for (const m of (s.library || []).filter((m) => m.status === 'aktiv').slice(0, 3)) add('wissen', { ref: `lib:${m.id}`, kind: 'link', text: m.title, area: 'Gerade dabei', info: m.author || '', link: `#/wissen/${m.kind || ''}` });
  for (const r of (s.reminders || []).filter((r) => r.next <= addDays(t, 3))) add('zuhause', { ref: `reminder:${r.id}`, kind: 'reminder', id: r.id, text: r.title, area: 'Erinnerung', date: r.next, info: when(r.next, t), link: '#/zuhause/erinnerungen' });
  for (const tr of (s.trips || []).filter((tr) => tr.status !== 'idee' && tr.from && tr.from >= t && tr.from <= addDays(t, 45))) {
    const open = tr.todo.filter((x) => !x.done).length;
    add('reisen', { ref: `trip:${tr.id}`, kind: 'trip', text: tr.name, area: 'Reise', date: tr.from, info: `${when(tr.from, t)} · ${open} To-dos offen`, link: `#/reisen/${tr.id}` });
  }
  for (const b of upcomingBirthdays(s, t, 10)) add('menschen', { ref: `bday:${b.person.id}`, kind: 'person', id: b.person.id, text: `Geburtstag ${b.person.name}`, area: 'Geburtstag', date: addDays(t, b.inDays), info: b.inDays === 0 ? 'heute' : `in ${b.inDays} Tagen`, link: `#/person/${b.person.id}`, wa: waLink(b.person) });
  for (const x of peopleOverdue(s, t).slice(0, 4)) add('menschen', { ref: `person:${x.person.id}`, kind: 'person', id: x.person.id, text: `${x.person.name} schreiben`, area: 'Melde dich mal', info: x.since == null ? 'noch kein Kontakt notiert' : `seit ${x.since} Tagen kein Kontakt`, link: `#/person/${x.person.id}`, wa: waLink(x.person) });
  for (const g of (s.gatherings || []).filter((g) => !g.done && (!g.date || g.date <= soon) && (!g.date || g.date >= t))) {
    const open = g.todos.filter((x) => !x.done).length;
    const shop = (g.shopping || []).filter((x) => !x.done).length;
    const notInvited = g.guests.filter((x) => x.status === 'offen').length;
    add('events', { ref: `gathering:${g.id}`, kind: 'gathering', text: g.name, area: 'Eigenes Event', date: g.date || '', info: [g.date ? when(g.date, t) : 'Datum offen', open && `${open} To-dos offen`, shop && `${shop} Einkäufe`, notInvited && `${notInvited} noch nicht eingeladen`].filter(Boolean).join(' · '), link: `#/treffen/${g.id}` });
  }
  for (const x of (s.invites || []).filter((x) => !x.done && x.status !== 'abgesagt' && x.date && x.date >= t && x.date <= soon)) add('events', { ref: `invite:${x.id}`, kind: 'link', text: x.name, area: x.host ? `Einladung von ${x.host}` : 'Einladung', date: x.date, info: [when(x.date, t), x.status === 'eingeladen' ? 'noch nicht zugesagt' : x.status, x.bring && `mitbringen: ${x.bring}`].filter(Boolean).join(' · '), link: '#/saeule/sozial' });
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
  const hobbies = (s.hobbies || []).map((h) => `${h.name} (${(h.todos || []).filter((x) => !x.done).length} To-dos offen, ${(h.materials || []).length} Material)`);
  const b = s.budget;
  return {
    sport: { sportarten: s.sports.map((x) => x.name), gemerkt: (s.sportEvents || []).filter((e) => e.status === 'interessiert').length, angemeldet: (s.sportEvents || []).filter((e) => e.status === 'angemeldet').map((e) => `${e.name} ${e.date || ''}`) },
    vorsorge: { offen: (s.healthItems || []).filter((h) => h.status !== 'erledigt' && h.status !== 'ausgeheilt').map((h) => h.title) },
    kueche: { rezepte: (s.recipes || []).length, einkaufsliste: s.shopping.items.filter((x) => !x.done).length },
    wissen: { gerade_dabei: (s.library || []).filter((m) => m.status === 'aktiv').map((m) => m.title), auf_der_liste: (s.library || []).filter((m) => m.status === 'will').length, zuletzt_fertig: (s.library || []).filter((m) => m.status === 'fertig').slice(-2).map((m) => m.title) },
    zuhause: { offene_punkte: Object.values(s.home || {}).reduce((n, l) => n + (l.items || []).filter((x) => !x.done).length, 0), erinnerungen: (s.reminders || []).length },
    hobbys: { hobbys: hobbies },
    reisen: { reise_ideen: (s.trips || []).filter((x) => x.status === 'idee').map((x) => x.name), geplante_reisen: (s.trips || []).filter((x) => x.status !== 'idee' && (!x.to || x.to >= t)).map((x) => `${x.name} ${x.from || ''}`) },
    finanzen: { eingerichtet: !!(b && (b.incomes || []).length), fixkosten_posten: (b?.costs || []).length },
    menschen: { personen: s.people.length, mit_rhythmus: s.people.filter((p) => p.contactEvery).length },
    events: { eigene_events: (s.gatherings || []).filter((g) => !g.done).length, einladungen: (s.invites || []).filter((x) => !x.done && x.status !== 'abgesagt').length, vorgemerkt: s.events.filter((e) => e.stage === 'interessiert' || e.stage === 'zugesagt').length, ausgeh_vorlieben: s.profile?.eventPrefs || [] },
    karriere: { jobsuchen: (s.jobSearches || []).map((x) => x.name), bewerbungen: (s.jobs || []).map((j) => `${j.title} @ ${j.company} (${j.status})`).slice(0, 12), eigene_projekte: (s.sideProjects || []).map((p) => `${p.name} (${p.status})`) },
    entwicklung: { skills: (s.skills || []).map((k) => `${k.name}: ${(k.todos || []).filter((x) => x.done).length}/${(k.todos || []).length} Ziele`) },
    informiert: { eigene_quellen: (s.newsSources || []).map((x) => x.name) },
  };
}

const TOOL = {
  name: 'ueberblick_geben',
  description: 'Strukturierte Übersicht: pro Bereich kurz, was dort gerade passiert.',
  input_schema: {
    type: 'object',
    properties: {
      lage: { type: 'string', description: '1 Satz Gesamtbild (optional)' },
      bereiche: {
        type: 'array',
        description: 'Die Bereiche in der vorgegebenen Reihenfolge; nur Bereiche, in denen es etwas gibt.',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: SECTIONS.map((x) => x.key) },
            text: { type: 'string', description: 'Kurze Zusammenfassung, 1 Satz, max. 14 Wörter: was in diesem Bereich gerade ansteht und worauf achten (Frist, Überfälliges, nächster Schritt). Konkret, z.B. „China-Reise: Route steht, Flüge noch offen“.' },
          },
          required: ['key', 'text'],
        },
      },
    },
    required: ['bereiche'],
  },
};
export async function askOverview(s) {
  const items = collectItems(s);
  const t = today();
  const system = `Du schreibst für Mateo eine strukturierte Übersicht seiner App „Life“. Heute ist ${fmtLong(t)} (${t}).
Schreib für JEDEN Bereich mit Einträgen eine kurze Zusammenfassung (1 Satz, max. 14 Wörter): was gerade ansteht und worauf er achten sollte. Die App zeigt daneben Knöpfe zu den einzelnen Einträgen. Nur aus den Daten, nichts erfinden, keine Aufzählung der Einträge. Reihenfolge: ${SECTIONS.map((x) => x.key).join(', ')}. Deutsch, kein Markdown. Antworte mit "ueberblick_geben".`;
  const byKey = {};
  for (const i of items) (byKey[i.sec] = byKey[i.sec] || []).push([i.text, i.area, i.info].filter(Boolean).join(' · '));
  const f = facts(s);
  const input = SECTIONS.map((x) => ({ key: x.key, bereich: x.name, offen: byKey[x.key] || [], stand: f[x.key] }));
  const r = await searchWithTool({ system, user: JSON.stringify(input), tool: TOOL, maxUses: 0, maxTokens: 1500, label: 'Überblick' });
  const v = {
    date: t, at: new Date().toISOString(), kind: 'hint', lage: r.lage || '',
    sections: (r.bereiche || []).filter((b) => secOf(b.key) && b.text).map((b) => ({ key: b.key, text: b.text }))
      .sort((a, b2) => SECTIONS.findIndex((x) => x.key === a.key) - SECTIONS.findIndex((x) => x.key === b2.key)),
  };
  saveOverview(v);
  return v;
}

// Struktur pro Bereich (v0.58, ohne KI): kleine Gruppen mit antippbaren Einträgen, die direkt dorthin springen
const short = (d, t) => {
  const n = inDays(d, t);
  if (n == null) return '';
  if (n < 0) return `${-n} T. überfällig`;
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n < 14) return `in ${n} T.`;
  const [, m, dd] = d.split('-');
  return `${Number(dd)}.${Number(m)}.`;
};
export function structure(s) {
  const t = today();
  const soon = addDays(t, 14);
  const out = {};
  const G = (key, label, items) => { const it = items.filter(Boolean); if (it.length) (out[key] = out[key] || []).push({ label, items: it }); };
  const I = (text, link, info, ext) => ({ text, link, info, ext });

  // Aufgaben
  const tasks = s.tasks.filter((x) => !x.done && !x.idea);
  const tLink = (x) => { const p = x.projectId && s.projects.find((y) => y.id === x.projectId); return p ? `#/projekt/${p.id}` : x.areaId ? `#/bereich/${x.areaId}` : ''; };
  G('aufgaben', 'Überfällig', tasks.filter((x) => x.due && x.due < t).map((x) => I(x.title, tLink(x), short(x.due, t))));
  G('aufgaben', 'Heute', tasks.filter((x) => x.due === t).map((x) => I(x.title, tLink(x), x.time || '')));
  G('aufgaben', 'Diese Woche', tasks.filter((x) => x.due && x.due > t && x.due <= addDays(t, 7)).map((x) => I(x.title, tLink(x), short(x.due, t))));
  G('aufgaben', 'Ohne Datum', tasks.filter((x) => !x.due).map((x) => I(x.title, tLink(x))));

  // Sport
  const se = (s.sportEvents || []).filter((e) => e.status !== 'dabei' && (!e.date || e.date >= t)).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  G('sport', 'Angemeldet', se.filter((e) => e.status === 'angemeldet').map((e) => I(e.name, '#/sport', short(e.date, t))));
  G('sport', 'Gemerkt', se.filter((e) => e.status !== 'angemeldet').map((e) => I(e.name, '#/sport', short(e.date, t))));

  // Vorsorge
  const hi = (s.healthItems || []).filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt');
  G('vorsorge', 'Fällig', hi.filter((h) => h.date && h.date <= addDays(t, 14)).map((h) => I(h.title, '#/vorsorge', short(h.date, t))));
  G('vorsorge', 'Verletzungen', (s.healthItems || []).filter((h) => h.type === 'verletzung' && h.status === 'aktiv').map((h) => I(h.title, '#/vorsorge')));

  // Küche
  const shop = s.shopping.items.filter((x) => !x.done);
  if (shop.length) G('kueche', 'Einkaufsliste', [I(`${shop.length} Sachen`, '#/kueche', shop.slice(0, 3).map((x) => x.name).join(', '))]);

  // Lernen & Wissen
  G('wissen', 'Gerade dabei', (s.library || []).filter((m) => m.status === 'aktiv').map((m) => I(m.title, `#/wissen/${m.kind || ''}`)));

  // Zuhause
  G('zuhause', 'Erinnerungen', (s.reminders || []).filter((r) => r.next && r.next <= addDays(t, 7)).map((r) => I(r.title, '#/zuhause/erinnerungen', short(r.next, t))));

  // Reisen: anstehend, Ideen (Gruppen als ein Eintrag)
  const trips = s.trips || [];
  G('reisen', 'Anstehend', trips.filter((x) => x.status !== 'idee' && (!x.to || x.to >= t)).sort((a, b) => (a.from || '9') < (b.from || '9') ? -1 : 1).map((x) => I(x.name, `#/reisen/${x.id}`, x.from ? short(x.from, t) : '')));
  const ideas = trips.filter((x) => x.status === 'idee');
  const groups = [...new Set(ideas.map((x) => x.group).filter(Boolean))];
  G('reisen', 'Ideen', [...groups.map((g) => I(`📁 ${g}`, '#/reisen', `${ideas.filter((x) => x.group === g).length}`)), ...ideas.filter((x) => !x.group).map((x) => I(x.name, `#/reisen/${x.id}`))]);

  // Hobbys
  G('hobbys', 'Offen', (s.hobbies || []).map((h) => { const n = (h.todos || []).filter((x) => !x.done).length; return n ? I(h.name, `#/hobbys/${h.id}`, `${n}`) : null; }));

  // Finanzen
  const b = s.budget;
  if (b && ((b.incomes || []).length || (b.costs || []).length)) G('finanzen', 'Monatsrechner', [I(`${(b.costs || []).length} Fixkosten`, '#/finanzen')]);

  // Menschen
  G('menschen', 'Geburtstage', upcomingBirthdays(s, t, 21).map((x) => I(x.person.name, `#/person/${x.person.id}`, x.inDays === 0 ? 'heute 🎂' : x.inDays === 1 ? 'morgen' : `in ${x.inDays} T.`)));
  G('menschen', 'Melde dich mal', peopleOverdue(s, t).map((x) => I(x.person.name, `#/person/${x.person.id}`)));

  // Events
  G('events', 'Eigene Events', (s.gatherings || []).filter((g) => !g.done && (!g.date || g.date >= t)).map((g) => I(g.name, `#/treffen/${g.id}`, g.date ? short(g.date, t) : '')));
  G('events', 'Einladungen', (s.invites || []).filter((x) => !x.done && x.status !== 'abgesagt' && (!x.date || x.date >= t)).map((x) => I(x.name, '#/saeule/sozial', x.date ? short(x.date, t) : '')));
  G('events', 'Ausgehen', s.events.filter((e) => e.date && e.date >= t && e.date <= soon && (e.stage === 'zugesagt' || e.stage === 'interessiert')).map((e) => I(e.name, '#/ausgehen', short(e.date, t))));

  // Karriere
  G('karriere', 'Bewerbungen', (s.jobs || []).filter((j) => ['beworben', 'rueckmeldung', 'gespraech', 'angebot'].includes(j.status)).map((j) => I(j.company || j.title, `#/karriere/job/${j.id}`, ({ beworben: 'beworben', rueckmeldung: 'Rückmeldung', gespraech: 'Gespräch', angebot: 'Angebot' })[j.status])));
  G('karriere', 'Eigene Projekte', (s.sideProjects || []).filter((p) => p.status === 'aktiv').map((p) => I(p.name, `#/karriere/projekt/${p.id}`)));

  // Weiterentwicklung
  G('entwicklung', 'Skills', (s.skills || []).map((k) => { const o = (k.todos || []).filter((x) => !x.done).length; return o ? I(k.name, `#/skills/${k.id}`, `${o} offen`) : null; }));

  // Informiert bleiben: eigene Quellen direkt öffnen
  G('informiert', 'Quellen', (s.newsSources || []).filter((x) => x.url).map((x) => I(x.name, x.url, '', true)));
  return out;
}
