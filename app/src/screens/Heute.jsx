import { useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, diffDays, dueText, fmtLong, relDays, startOfWeek, targetText, today } from '../lib/dates';
import {
  allAreaStatuses, areaOf, byUrgency, followUps, habitProgress, habitStreak, lastContact,
  peopleOverdue, pillarOf, rhythmStats, upcomingBirthdays, waLink,
} from '../lib/logic';
import { logContact, toggleCheckin, toggleTask } from '../lib/actions';
import { AreaIcon, Check, Chevron, Dot, Icon, Segmented, TabBar } from '../components/ui';
import { Heatmap, heatColor } from '../components/Heatmap';

// Fortschrittsring wie bei Apple Fitness
function Ring({ pct }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`${Math.round(pct * 100)} Prozent erledigt`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--fill)" strokeWidth="7" />
      {pct > 0 && <circle cx="28" cy="28" r={r} fill="none" stroke="#7A8F6A" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 28 28)" style={{ transition: "stroke-dasharray 0.4s ease" }} />}
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

const RANGES = [
  { id: 'woche', label: 'Woche', weeks: 1 },
  { id: 'monat', label: 'Monat', weeks: 4 },
  { id: 'quartal', label: '3 Mon.', weeks: 13 },
];

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  return name ? `${g}, ${name}` : g;
}

export default function Heute() {
  const s = useStore();
  const t = today();
  const [range, setRange] = useState('woche');

  const attention = allAreaStatuses(s, t)
    .filter((x) => x.status.level === 'rot' || x.status.level === 'gelb')
    .sort(byUrgency)
    .slice(0, 3);

  const pillarColor = (areaId) => pillarOf(s, areaOf(s, areaId)?.pillarId)?.color || '#C4C4BE';

  const items = [];
  s.habits.forEach((h) => {
    const p = habitProgress(s, h, t);
    if (p.complete && !p.today) return;
    const st = habitStreak(s, h, t);
    items.push({
      key: 'h' + h.id, done: p.today, onCheck: () => toggleCheckin(h.id),
      title: h.name, color: pillarColor(h.areaId),
      meta: `${areaOf(s, h.areaId)?.name} · ${p.done} von ${p.count} ${h.period === 'monat' ? 'diesen Monat' : 'diese Woche'}${st.streak > 1 ? ` · Serie ${st.streak} ${st.unit}` : ''}`,
    });
  });
  s.tasks
    .filter((x) => !x.idea && x.due && x.due <= t && (!x.done || x.doneAt === t))
    .forEach((x) => {
      const proj = x.projectId ? s.projects.find((p) => p.id === x.projectId) : null;
      const areaId = proj ? proj.areaId : x.areaId;
      items.push({
        key: 't' + x.id, done: x.done, onCheck: () => toggleTask(x.id), title: x.title,
        color: pillarColor(areaId),
        meta: `${proj ? proj.name : areaOf(s, areaId)?.name || 'Aufgabe'} · ${dueText(x.due, t)}`,
      });
    });
  const contactedToday = (p) => (p.contacts || []).includes(t);
  upcomingBirthdays(s, t, 2).forEach(({ person, inDays }) =>
    items.push({
      key: 'b' + person.id, done: contactedToday(person), onCheck: () => logContact(person.id),
      title: `Geburtstag: ${person.name}`, color: '#C4876B',
      meta: inDays === 0 ? 'heute' : inDays === 1 ? 'morgen' : `in ${inDays} Tagen`, wa: waLink(person),
    })
  );
  const seen = new Set(items.map((i) => i.key.slice(1)));
  [...followUps(s, t).filter((p) => p.followUp <= t), ...peopleOverdue(s, t).slice(0, 3).map((x) => x.person)].forEach((p) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    const last = lastContact(p);
    items.push({
      key: 'p' + p.id, done: false, onCheck: () => logContact(p.id), title: `${p.name} schreiben`, color: '#C4876B',
      meta: p.followUp && p.followUp <= t ? 'Nachfassen fällig' : `${last ? `Letzter Kontakt ${relDays(diffDays(last, t))}` : 'Noch kein Kontakt notiert'} · Ziel ${targetText(p.contactEvery)}`,
      wa: waLink(p),
    });
  });

  const doneCount = items.filter((i) => i.done).length;
  const weeks = RANGES.find((r) => r.id === range).weeks;
  const stats = rhythmStats(s, weeks, t);
  const isNew = !s.habits.length && !s.tasks.length && !s.people.length && !s.projects.length;

  return (
    <>
      <main className="screen">
        <div className="top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="eyebrow">{fmtLong(t)}</span>
            <h1 className="h1 sm">{greeting(s.profile?.name)}</h1>
          </div>
          <a href="#/einstellungen" className="icon-btn" aria-label="Einstellungen">
            <Icon name="gear" size={20} width={1.8} />
          </a>
        </div>

        {isNew && (
          <section className="card">
            <h2 className="h2">Willkommen in deiner App</h2>
            <span className="sub" style={{ lineHeight: 1.5 }}>
              So startest du: 1. Unter Bereiche → Lebensbereich einen Rhythmus anlegen (z.B. Laufen 3× pro Woche). 2. Unter Menschen wichtige Personen mit Geburtstag und Kontakt-Rhythmus eintragen. 3. Alles andere schnell mit + erfassen.
            </span>
            <a href="#/einstellungen" className="btn tint small" style={{ alignSelf: 'flex-start' }}>Erst mit Beispieldaten ausprobieren</a>
          </section>
        )}

        {items.length > 0 && (
          <section className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Ring pct={items.length ? doneCount / items.length : 0} />
            <div className="row-main">
              <span className="row-title strong">{doneCount === items.length ? 'Alles erledigt' : `${items.length - doneCount} offen für heute`}</span>
              <span className="row-meta">{doneCount} von {items.length} erledigt{stats.pct !== null ? ` · Rhythmen diese Woche ${rhythmStats(s, 1, t).pct} %` : ''}</span>
            </div>
          </section>
        )}

        {attention.length > 0 && (
          <section className="group">
            <div className="sec-h"><h2 className="label">Braucht Aufmerksamkeit</h2></div>
            <div className="list">
              {attention.map(({ area, status }) => (
                <a key={area.id} href={`#/bereich/${area.id}`} className="row">
                  <AreaIcon icon={area.icon} color={pillarOf(s, area.pillarId)?.color} size={30} />
                  <span className="row-main">
                    <span className="row-title">{area.name}</span>
                    <span className="row-meta"><Dot small level={status.level} />{status.text} · Ziel {targetText(area.targetDays)}</span>
                  </span>
                  <Chevron />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="group">
          <div className="sec-h">
            <h2 className="h2">Heute</h2>
          </div>
          <div className="list">
            {items.length === 0 && <div className="empty">Für heute ist nichts fällig. Rhythmen, Aufgaben mit Datum, Geburtstage und überfällige Kontakte erscheinen hier automatisch.</div>}
            {items.map((i) => (
              <div key={i.key} className="row">
                <Check on={i.done} color={i.color} onClick={i.onCheck} label={(i.done ? 'Offen: ' : 'Erledigt: ') + i.title} />
                <div className="row-main">
                  <span className={i.done ? 'row-title plain done' : 'row-title plain'}>{i.title}</span>
                  <span className="row-meta"><Dot small color={i.color} />{i.meta}</span>
                </div>
                {i.wa && !i.done && <a className="pill" href={i.wa} target="_blank" rel="noreferrer">WhatsApp</a>}
              </div>
            ))}
          </div>
        </section>

        {s.habits.length > 0 && (
          <section className="card">
            <div className="sec-h" style={{ padding: 0 }}>
              <h2 className="label">Rhythmen ·<span style={{ color: 'var(--text)', fontWeight: 600 }}>{stats.pct ?? 0} %</span></h2>
              <Segmented options={RANGES} value={range} onChange={setRange} label="Zeitraum" />
            </div>
            {range === 'woche' ? (
              <div className="week-bars">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((l, i) => {
                  const d = addDays(startOfWeek(t), i);
                  const future = d > t;
                  return (
                    <div key={l}>
                      <div className="bar" style={{ background: future ? 'transparent' : heatColor(stats.days[d] || 0), boxShadow: future ? 'inset 0 0 0 1px var(--border)' : 'none' }} />
                      <span style={{ fontSize: 11, color: d === t ? 'var(--text)' : 'var(--muted)', fontWeight: d === t ? 600 : 400 }}>{l}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Heatmap counts={stats.days} weeks={weeks} t={t} />
            )}
          </section>
        )}
      </main>
      <TabBar active="heute" />
    </>
  );
}
