// Datums-Hilfen. Alle Tage werden als Text "JJJJ-MM-TT" in deiner lokalen Zeit gespeichert.
export const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toKey(new Date());
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
// Anzahl Tage von a bis b (b - a)
export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
export const startOfWeek = (k) => {
  const d = parseKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
};
export const startOfMonth = (k) => k.slice(0, 8) + '01';
export const addMonths = (k, n) => {
  const d = parseKey(startOfMonth(k));
  d.setMonth(d.getMonth() + n);
  return toKey(d);
};

const longFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
export const fmtLong = (k) => longFmt.format(parseKey(k));
export const fmtShort = (k) => shortFmt.format(parseKey(k));

export function relDays(n) {
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 14) return `vor ${n} Tagen`;
  if (n < 60) return `vor ${Math.round(n / 7)} Wochen`;
  return `vor ${Math.round(n / 30)} Monaten`;
}

export function dueText(k, t) {
  const d = diffDays(t, k);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === -1) return 'seit gestern';
  if (d < 0) return `seit ${-d} Tagen`;
  if (d < 7) return `in ${d} Tagen`;
  return fmtShort(k);
}

export function targetText(days) {
  if (!days) return 'kein Ziel';
  if (days === 1) return 'täglich';
  if (days === 3) return 'alle 3 Tage';
  if (days === 7) return '1× pro Woche';
  if (days === 14) return 'alle 2 Wochen';
  if (days === 30) return '1× pro Monat';
  if (days === 60) return 'alle 2 Monate';
  if (days === 90) return 'quartalsweise';
  return `alle ${days} Tage`;
}

// Tage bis zum nächsten Geburtstag (Geburtstag als "JJJJ-MM-TT" oder "MM-TT")
export function daysUntilBirthday(bday, t) {
  if (!bday) return null;
  const md = bday.slice(-5);
  const y = Number(t.slice(0, 4));
  let next = `${y}-${md}`;
  if (next < t) next = `${y + 1}-${md}`;
  return diffDays(t, next);
}
