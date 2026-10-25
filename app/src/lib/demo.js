// Beispieldaten zum Ausprobieren (werden zu deinen Daten hinzugefügt, nichts wird gelöscht).
import { store, uid } from './store';
import { addDays, parseKey, today } from './dates';

export function loadDemo() {
  const t = today();
  const now = new Date().toISOString();
  store.update((s) => {
    const h = (name, areaId, count, period) => {
      const id = uid();
      s.habits.push({ id, name, areaId, count, period, createdAt: now });
      return id;
    };
    const run = h('Laufen', 'koerper', 4, 'woche');
    const pt = h('20 Min Portugiesisch', 'entwicklung', 5, 'woche');
    const refl = h('Wochenreflexion', 'mental', 1, 'woche');
    const py = h('Python üben', 'entwicklung', 3, 'woche');
    for (let i = 1; i < 90; i++) {
      const d = addDays(t, -i);
      const wd = parseKey(d).getDay();
      if ([1, 3, 5, 0].includes(wd) && (i * 7) % 5 !== 0) s.checkins.push({ id: uid(), habitId: run, date: d });
      if (i % 4 !== 0 && i < 40) s.checkins.push({ id: uid(), habitId: pt, date: d });
      if (wd === 0 && i < 20) s.checkins.push({ id: uid(), habitId: refl, date: d });
      if ((i % 3 === 0) && i < 60) s.checkins.push({ id: uid(), habitId: py, date: d });
    }
    const proj = uid();
    s.projects.push({ id: proj, name: 'Marathon-Vorbereitung', areaId: 'koerper', due: addDays(t, 70), status: 'aktiv', notes: '', createdAt: now });
    [['Trainingsplan auswählen', true], ['Startnummer anmelden', false, addDays(t, 0)], ['Neue Laufschuhe testen', false], ['Langer Lauf 25 km', false]].forEach(([title, done, due]) =>
      s.tasks.push({ id: uid(), title, areaId: null, projectId: proj, due: due || null, idea: false, done, doneAt: done ? addDays(t, -10) : null, createdAt: now })
    );
    s.tasks.push({ id: uid(), title: 'Steuerunterlagen sortieren', areaId: 'finanzen', projectId: null, due: addDays(t, -1), idea: false, done: false, doneAt: null, createdAt: now });
    s.tasks.push({ id: uid(), title: 'Tango-Kurs ausprobieren', areaId: 'freizeit', projectId: null, due: null, idea: true, done: false, doneAt: null, createdAt: now });
    s.activities.push({ id: uid(), areaId: 'finanzen', date: addDays(t, -50), note: 'Portfolio angeschaut' });
    const md = t.slice(5);
    s.people.push(
      { id: uid(), name: 'Lucas (Beispiel)', category: 'freunde', phone: '', birthday: '', contactEvery: 30, contacts: [addDays(t, -36)], metAt: '', followUp: null, notes: '', createdAt: now },
      { id: uid(), name: 'Sofía (Beispiel)', category: 'freunde', phone: '', birthday: `1994-${md}`, contactEvery: 30, contacts: [addDays(t, -8)], metAt: '', followUp: null, notes: '', createdAt: now },
      { id: uid(), name: 'Martín (Beispiel)', category: 'neu', phone: '', birthday: '', contactEvery: null, contacts: [], metAt: 'Startup-Meetup', followUp: t, notes: '', createdAt: now }
    );
    s.events.push({ id: uid(), name: 'Startup-Meetup (Beispiel)', date: addDays(t, 4), place: 'Palermo', travel: false, stage: 'interessiert', createdAt: now });
    s.radar.items.unshift({ id: uid(), title: 'Wie KI-Agenten Tabellen pflegen (Beispiel)', url: '', why: 'Könnte die Pflege meiner Excel-Dokumente automatisieren.', topic: 'KI-Entwicklungen', status: 'neu', createdAt: now });
  });
}
