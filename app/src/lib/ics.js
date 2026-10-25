// Erzeugt eine Kalender-Datei (.ics) mit Geburtstagen, Aufgaben mit Datum und Events.
// Auf dem iPhone geöffnet, fragt der Apple-Kalender, ob er die Termine übernehmen soll.
const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const compact = (k) => k.replaceAll('-', '');
const nextDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
};

function allDay(uid, date, summary, extra = []) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@life-app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${nextDay(date)}`,
    `SUMMARY:${esc(summary)}`,
    ...extra,
    'END:VEVENT',
  ];
}

export function buildIcs(s) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life App//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Life'];
  s.people.filter((p) => p.birthday).forEach((p) => {
    lines.push(...allDay(`bday-${p.id}`, p.birthday, `Geburtstag: ${p.name}`, ['RRULE:FREQ=YEARLY', 'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Geburtstag: ' + p.name)}`, 'END:VALARM']));
  });
  s.tasks.filter((t) => t.due && !t.done).forEach((t) => lines.push(...allDay(`task-${t.id}`, t.due, t.title)));
  s.events.filter((e) => e.date && e.stage !== 'entdeckt').forEach((e) => lines.push(...allDay(`event-${e.id}`, e.date, e.name, e.place ? [`LOCATION:${esc(e.place)}`] : [])));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
