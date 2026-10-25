// Berechnungen: Ampeln, Rhythmen, Kontakte, Geburtstage.
import { addDays, addMonths, daysUntilBirthday, diffDays, relDays, startOfMonth, startOfWeek } from './dates';

export const LEVEL_COLOR = { gruen: '#2E9B6A', gelb: '#E0A21B', rot: '#D14343', grau: '#C4C4BE' };
export const LEVEL_WORD = { gruen: 'läuft', gelb: 'achten', rot: 'vernachlässigt', grau: 'pausiert' };
const LEVEL_RANK = { rot: 0, gelb: 1, grau: 2, gruen: 3 };
export const byUrgency = (a, b) => LEVEL_RANK[a.status.level] - LEVEL_RANK[b.status.level];

export const pillarOf = (s, id) => s.pillars.find((p) => p.id === id);
export const subOf = (area, subId) => (area && subId ? area.subs.find((x) => x.id === subId) : null);
export const areaColor = (s, areaId) => pillarOf(s, areaOf(s, areaId)?.pillarId)?.color || '#8e8e93';
export const areaOf = (s, id) => s.areas.find((a) => a.id === id);
export const projectArea = (s, p) => areaOf(s, p.areaId);

export const lastContact = (p) => (p.contacts && p.contacts.length ? p.contacts.reduce((a, b) => (a > b ? a : b)) : null);

// Alle Tage, an denen in einem Lebensbereich etwas passiert ist
export function areaDates(s, areaId) {
  const area = areaOf(s, areaId);
  const dates = [];
  const habitIds = new Set(s.habits.filter((h) => h.areaId === areaId).map((h) => h.id));
  s.checkins.forEach((c) => habitIds.has(c.habitId) && dates.push(c.date));
  const projIds = new Set(s.projects.filter((p) => p.areaId === areaId).map((p) => p.id));
  s.tasks.forEach((t) => {
    if (t.done && t.doneAt && (t.areaId === areaId || projIds.has(t.projectId))) dates.push(t.doneAt);
  });
  s.activities.forEach((a) => a.areaId === areaId && dates.push(a.date));
  if (area && area.peopleCategory) {
    s.people.forEach((p) => p.category === area.peopleCategory && (p.contacts || []).forEach((d) => dates.push(d)));
  }
  if (areaId === 'erlebnisse' || areaId === 'neue') {
    s.events.forEach((e) => e.stage === 'besucht' && e.date && dates.push(e.date));
  }
  if (areaId === 'informiert') {
    s.radar.items.forEach((i) => i.decidedAt && dates.push(i.decidedAt));
  }
  return dates;
}

export function countByDay(dates) {
  const m = {};
  dates.forEach((d) => (m[d] = (m[d] || 0) + 1));
  return m;
}

export function areaStatus(s, area, t) {
  const dates = areaDates(s, area.id).filter((d) => d <= t);
  const last = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  if (area.paused) return { level: 'grau', text: 'Bewusst pausiert', last };
  let level;
  let text;
  if (!last) {
    level = 'gelb';
    text = 'Noch keine Aktivität';
  } else {
    const d = diffDays(last, t);
    const target = area.targetDays || 14;
    level = d <= target ? 'gruen' : d <= target * 2 ? 'gelb' : 'rot';
    text = d === 0 ? 'Heute aktiv' : `Letzte Aktivität ${relDays(d)}`;
  }
  if (area.peopleCategory) {
    const overdue = peopleOverdue(s, t).filter((x) => x.person.category === area.peopleCategory).length;
    if (overdue > 0) {
      text = overdue === 1 ? '1 Kontakt überfällig' : `${overdue} Kontakte überfällig`;
      if (level === 'gruen') level = 'gelb';
    }
  }
  return { level, text, last };
}

export function allAreaStatuses(s, t) {
  return s.areas.map((area) => ({ area, status: areaStatus(s, area, t) }));
}

// Rhythmen (wiederkehrende Gewohnheiten)
export const periodStart = (h, t) => (h.period === 'monat' ? startOfMonth(t) : startOfWeek(t));
export const periodWord = (h) => (h.period === 'monat' ? 'diesen Monat' : 'diese Woche');

export function habitProgress(s, h, t) {
  const start = periodStart(h, t);
  const mine = s.checkins.filter((c) => c.habitId === h.id);
  const done = mine.filter((c) => c.date >= start && c.date <= t).length;
  const today = mine.some((c) => c.date === t);
  return { done, count: h.count, today, complete: done >= h.count };
}

export function habitStreak(s, h, t) {
  const dates = s.checkins.filter((c) => c.habitId === h.id).map((c) => c.date);
  const inRange = (a, b) => dates.filter((d) => d >= a && d <= b).length;
  let streak = 0;
  let start = periodStart(h, t);
  const prev = (k) => (h.period === 'monat' ? addMonths(k, -1) : addDays(k, -7));
  const end = (k) => (h.period === 'monat' ? addDays(addMonths(k, 1), -1) : addDays(k, 6));
  if (inRange(start, t) >= h.count) streak++;
  start = prev(start);
  for (let i = 0; i < 104; i++) {
    if (inRange(start, end(start)) >= h.count) {
      streak++;
      start = prev(start);
    } else break;
  }
  return { streak, unit: h.period === 'monat' ? 'Mon.' : 'Wo.' };
}

// Wie viel Prozent der Rhythmen im Zeitraum erfüllt wurden
export function rhythmStats(s, weeks, t) {
  const start = addDays(startOfWeek(t), -(weeks - 1) * 7);
  let got = 0;
  let need = 0;
  s.habits.forEach((h) => {
    const dates = s.checkins.filter((c) => c.habitId === h.id && c.date >= start && c.date <= t).map((c) => c.date);
    if (h.period === 'monat') {
      for (let m = startOfMonth(start); m <= t; m = addMonths(m, 1)) {
        const e = addDays(addMonths(m, 1), -1);
        got += Math.min(h.count, dates.filter((d) => d >= m && d <= e).length);
        need += h.count;
      }
    } else {
      for (let w = start; w <= t; w = addDays(w, 7)) {
        const e = addDays(w, 6);
        got += Math.min(h.count, dates.filter((d) => d >= w && d <= e).length);
        need += h.count;
      }
    }
  });
  const days = countByDay(s.checkins.filter((c) => c.date >= start && c.date <= t).map((c) => c.date));
  return { pct: need ? Math.round((got / need) * 100) : null, days, start };
}

// Kontakte
export function peopleOverdue(s, t) {
  return s.people
    .filter((p) => p.contactEvery)
    .map((p) => {
      const last = lastContact(p);
      const since = last ? diffDays(last, t) : null;
      return { person: p, last, since, ratio: since === null ? 99 : since / p.contactEvery };
    })
    .filter((x) => x.since === null || x.since > x.person.contactEvery)
    .sort((a, b) => b.ratio - a.ratio);
}

export function upcomingBirthdays(s, t, within = 14) {
  return s.people
    .filter((p) => p.birthday)
    .map((p) => ({ person: p, inDays: daysUntilBirthday(p.birthday, t) }))
    .filter((x) => x.inDays !== null && x.inDays <= within)
    .sort((a, b) => a.inDays - b.inDays);
}

export function followUps(s, t) {
  return s.people
    .filter((p) => p.followUp && p.followUp <= addDays(t, 7))
    .sort((a, b) => (a.followUp < b.followUp ? -1 : 1));
}

export function waLink(p) {
  const digits = (p.phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

export function projectProgress(s, p) {
  const tasks = s.tasks.filter((t) => t.projectId === p.id);
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
