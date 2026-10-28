import { takeFlag } from '../lib/flags';
import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, diffDays, dueText, fmtLong, parseKey, relDays, startOfWeek, targetText, today } from '../lib/dates';
import {
  allAreaStatuses, areaOf, byUrgency, followUps, habitProgress, lastContact, peopleOverdue, pillarOf, rhythmStats, upcomingBirthdays, waLink,
} from '../lib/logic';
import { addTask, logContact, toggleCheckin, toggleTask } from '../lib/actions';
import { askReview, getAi, lastReview, saveReview } from '../lib/ai';
import { AreaIcon, Check, Chevron, Dot, Icon, Segmented, TabBar, toast } from '../components/ui';
import { Heatmap, heatColor } from '../components/Heatmap';
import Overview from '../components/Overview';
import { doneHealthItem } from '../lib/health';
import { doneReminder, EVERY } from '../lib/home';
const fmtShortDays = (d, t) => { const n = diffDays(d, t); return `${n} ${n === 1 ? 'Tag' : 'Tagen'}`; };

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  return name ? `${g}, ${name}` : g;
}

// ---------- Wetter ----------

// ---------- KI-Check ----------
function CheckIn({ s }) {
  const [review, setReview] = useState(lastReview);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setReview(await askReview(s));
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Für den Check-in braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const lines = review?.text ? review.text.split('\n').filter((l) => l.trim()) : [];
  const options = review?.options || [];
  const open = options.filter((o) => o.status === 'offen');
  const [picked, setPicked] = useState({});
  const [when, setWhen] = useState('morgen');
  const isPicked = (o) => picked[o.id] ?? true;
  const update = (fn) => {
    const next = { ...review, options: review.options.map((o) => ({ ...o })) };
    fn(next.options);
    saveReview(next);
    setReview(next);
  };
  const adopt = () => {
    const due = when === 'heute' ? today() : addDays(today(), 1);
    const chosen = open.filter(isPicked);
    chosen.forEach((o) => addTask({ title: o.title, areaId: o.areaId, projectId: o.projectId, due }));
    update((opts) => opts.forEach((o) => { if (o.status === 'offen') o.status = isPicked(o) ? 'uebernommen' : 'verworfen'; }));
    setPicked({});
    toast(`${chosen.length} ${chosen.length === 1 ? 'To-do' : 'To-dos'} für ${when} eingeplant`);
  };
  const adoptedCount = options.filter((o) => o.status === 'uebernommen').length;
  return (
    <section className="card checkin">
      <div className="sec-h" style={{ padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span>
          Dein Check-in
        </span>
        {hasKey && review && (
          <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={run} disabled={busy} aria-label="Check-in aktualisieren">
            <Icon name="refresh" size={15} />
          </button>
        )}
      </div>
      {busy && <span className="sub">Ich schaue mir deine letzten Tage an …</span>}
      {!busy && lines.length > 0 && (
        <div className="checkin-text">
          {lines.map((l, i) => (/:\s*$/.test(l) ? <b key={i}>{l.replace(/:\s*$/, '')}</b> : <span key={i}>{l}</span>))}
          <span className="tiny">Stand: {review.date === today() ? 'heute' : relDays(diffDays(review.date, today()))}</span>
        </div>
      )}
      {!busy && open.length > 0 && (
        <div className="options">
          <b style={{ fontSize: 15 }}>Vorschläge zum Übernehmen</b>
          {open.map((o) => (
            <label key={o.id} className="option">
              <input type="checkbox" checked={isPicked(o)} onChange={(e) => setPicked({ ...picked, [o.id]: e.target.checked })} />
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 500 }}>{o.title}</span>
                {(o.why || o.areaId) && <span className="tiny">{[areaOf(s, o.areaId)?.name, o.why].filter(Boolean).join(' · ')}</span>}
              </span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Segmented options={[{ id: 'heute', label: 'Für heute' }, { id: 'morgen', label: 'Für morgen' }]} value={when} onChange={setWhen} label="Wann einplanen" />
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!open.some(isPicked)} onClick={adopt}>Übernehmen</button>
          </div>
        </div>
      )}
      {!busy && options.length > 0 && open.length === 0 && (
        <span className="tiny">{adoptedCount ? `${adoptedCount} Vorschläge als To-do übernommen.` : 'Vorschläge verworfen.'} Neue gibt es mit dem Pfeil oben.</span>
      )}
      {!busy && !lines.length && <span className="sub" style={{ lineHeight: 1.45 }}>Wo kommst du voran, was ist eingeschlafen, und was wäre heute ein guter nächster Schritt? Die KI schaut sich deine Aktivität an.</span>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {hasKey && !review && !busy && <button type="button" className="btn small" onClick={run}>Check-in starten</button>}
      {!hasKey && <a href="#/einstellungen" className="link-btn">API-Schlüssel hinterlegen</a>}
    </section>
  );
}

export default function Heute() {
  const s = useStore();
  const t = today();
  const [day, setDay] = useState(t);
  const [weekStart, setWeekStart] = useState(startOfWeek(t));
  const [range, setRange] = useState('woche');
  const [newTask, setNewTask] = useState('');
  useEffect(() => { if (takeFlag('life-focus-task')) setTimeout(() => { const el = document.querySelector('#tagesliste input[aria-label="Neue Aufgabe"]'); el?.scrollIntoView({ block: 'center' }); el?.focus(); }, 350); }, []);
  const [newTime, setNewTime] = useState('');
  const isToday = day === t;
  const pillarColor = (areaId) => pillarOf(s, areaOf(s, areaId)?.pillarId)?.color || 'var(--accent)';

  // ---------- Einträge für den gewählten Tag ----------
  const dayItems = (key) => {
    const list = [];
    s.tasks
      .filter((x) => !x.idea && x.due === key && (!x.done || x.doneAt === t || key !== t))
      .forEach((x) => {
        const proj = x.projectId ? s.projects.find((p) => p.id === x.projectId) : null;
        const areaId = proj ? proj.areaId : x.areaId;
        list.push({
          key: 't' + x.id, done: x.done, onCheck: () => toggleTask(x.id), title: x.title, time: x.time, url: x.url,
          color: pillarColor(areaId), meta: proj ? proj.name : areaOf(s, areaId)?.name || 'Aufgabe',
        });
      });
    s.events
      .filter((e) => e.date === key && e.stage !== 'entdeckt')
      .forEach((e) => list.push({ key: 'e' + e.id, event: true, title: e.name, meta: [e.place, e.stage === 'zugesagt' ? 'zugesagt' : 'interessiert'].filter(Boolean).join(' · '), color: '#E8775A' }));
    (s.reminders || [])
      .filter((r) => r.next === key)
      .forEach((r) => list.push({ key: 'r' + r.id, done: false, onCheck: () => doneReminder(r.id), title: r.title, meta: `Erinnerung · ${EVERY[r.every]}`, color: '#2FA36B' }));
    (s.gatherings || [])
      .filter((g) => g.date === key)
      .forEach((g) => list.push({ key: 'g' + g.id, event: true, title: g.name, time: g.time, meta: `Dein Treffen · ${g.guests.filter((x) => x.status === 'zugesagt').length} Zusagen`, color: '#E8775A' }));
    (s.invites || [])
      .filter((x) => x.date === key && x.status !== 'abgesagt')
      .forEach((x) => list.push({ key: 'i' + x.id, event: true, title: x.name, time: x.time, meta: [x.host && `bei ${x.host}`, x.place, x.status === 'zugesagt' ? 'zugesagt' : 'noch zusagen?'].filter(Boolean).join(' · '), color: '#E8775A' }));
    (s.healthItems || [])
      .filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt' && h.date === key)
      .forEach((h) => list.push({ key: 'v' + h.id, done: false, onCheck: () => doneHealthItem(h.id), title: h.title, meta: h.type === 'routine' ? 'Vorsorge · regelmäßig' : 'Vorsorge', color: '#2FA36B' }));
    s.people
      .filter((p) => p.birthday && p.birthday.slice(5) === key.slice(5))
      .forEach((p) => list.push({ key: 'b' + p.id, done: (p.contacts || []).includes(key), onCheck: () => logContact(p.id, key), title: `Geburtstag: ${p.name}`, meta: 'Gratulieren', color: '#E8775A', wa: waLink(p) }));
    return list;
  };

  const items = dayItems(day);
  const extra = [];
  if (isToday) {
    s.tasks
      .filter((x) => !x.idea && !x.done && x.due && x.due < t)
      .forEach((x) => {
        const proj = x.projectId ? s.projects.find((p) => p.id === x.projectId) : null;
        extra.push({ key: 't' + x.id, done: false, onCheck: () => toggleTask(x.id), title: x.title, color: pillarColor(proj ? proj.areaId : x.areaId), meta: `überfällig · ${dueText(x.due, t)}`, overdue: true });
      });
    (s.reminders || [])
      .filter((r) => r.next < t)
      .forEach((r) => extra.push({ key: 'r' + r.id, done: false, onCheck: () => doneReminder(r.id), title: r.title, color: '#2FA36B', meta: `Erinnerung · überfällig seit ${fmtShortDays(r.next, t)}`, overdue: true }));
    (s.healthItems || [])
      .filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt' && h.date && h.date < t)
      .forEach((h) => extra.push({ key: 'v' + h.id, done: false, onCheck: () => doneHealthItem(h.id), title: h.title, color: '#2FA36B', meta: `Vorsorge · überfällig seit ${fmtShortDays(h.date, t)}`, overdue: true }));
    s.habits
      .filter((h) => h.count > 0)
      .forEach((h) => {
        const p = habitProgress(s, h, t);
        if (p.complete && !p.today) return;
        extra.push({ key: 'h' + h.id, done: p.today, onCheck: () => toggleCheckin(h.id), title: h.name, color: pillarColor(h.areaId), meta: `Rhythmus · ${p.done} von ${p.count} ${h.period === 'monat' ? 'diesen Monat' : 'diese Woche'}` });
      });
    const seen = new Set();
    [...followUps(s, t).filter((p) => p.followUp <= t), ...peopleOverdue(s, t).slice(0, 3).map((x) => x.person)].forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const last = lastContact(p);
      extra.push({
        key: 'p' + p.id, done: false, onCheck: () => logContact(p.id), title: `${p.name} schreiben`, color: '#E8775A',
        meta: p.followUp && p.followUp <= t ? 'Nachfassen fällig' : last ? `Letzter Kontakt ${relDays(diffDays(last, t))}` : 'Noch kein Kontakt notiert',
        wa: waLink(p),
      });
    });
  }
  const all = [...items.sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1), ...extra];
  const checkable = all.filter((i) => i.onCheck);
  const doneCount = checkable.filter((i) => i.done).length;

  const focus = s.habits.filter((h) => !h.count);
  const attention = allAreaStatuses(s, t).filter((x) => x.status.level === 'rot').sort(byUrgency).slice(0, 3);
  const weeks = { woche: 1, monat: 4, quartal: 13 }[range];
  const stats = rhythmStats(s, weeks, t);
  const hasFixed = s.habits.some((h) => h.count > 0);
  const dayLabel = isToday ? 'Heute' : day === addDays(t, 1) ? 'Morgen' : day === addDays(t, -1) ? 'Gestern' : dayFmt.format(parseKey(day));

  const Row = (i) => (
    <div key={i.key} className="row">
      {i.onCheck ? <Check on={i.done} color={i.color} onClick={i.onCheck} label={(i.done ? 'Offen: ' : 'Erledigt: ') + i.title} /> : <span style={{ width: 24, display: 'inline-flex', justifyContent: 'center' }}><Icon name="today" size={18} color={i.color} /></span>}
      <div className="row-main">
        <span className={i.done ? 'row-title done' : 'row-title'}>{i.title}</span>
        <span className="row-meta" style={{ color: i.overdue ? 'var(--danger)' : undefined }}><Dot small color={i.color} />{i.meta}</span>
      </div>
      {i.wa && !i.done && <a className="pill" href={i.wa} target="_blank" rel="noreferrer">WhatsApp</a>}
      {i.url && !i.done && <a className="pill" href={i.url} target="_blank" rel="noreferrer" aria-label={`Link zu ${i.title} öffnen`}><Icon name="link" size={14} /></a>}
      {i.time && <span className="row-side" style={{ fontSize: 14 }}>{i.time}</span>}
    </div>
  );

  return (
    <>
      <main className="screen">
        <div className="top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="eyebrow">{fmtLong(t)}</span>
            <h1 className="h1 sm">{greeting(s.profile?.name)}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="#/erfassen" className="icon-btn" aria-label="Schnell erfassen"><Icon name="plus" size={20} width={2.2} /></a>
            <a href="#/einstellungen" className="icon-btn" aria-label="Einstellungen">
              <Icon name="gear" size={20} width={1.8} />
            </a>
          </div>
        </div>

        <Overview s={s} />

        {/* Wochenleiste */}
        <section className="card" style={{ gap: 10, padding: '12px 12px 14px' }}>
          <div className="sec-h" style={{ padding: '0 4px' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{monthFmt.format(parseKey(addDays(weekStart, 3)))}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Vorherige Woche"><Icon name="chevLeft" size={15} /></button>
              {(weekStart !== startOfWeek(t) || !isToday) && <button type="button" className="chip" style={{ minHeight: 30, padding: '0 10px', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 13 }} onClick={() => { setWeekStart(startOfWeek(t)); setDay(t); }}>Heute</button>}
              <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Nächste Woche"><Icon name="chev" size={15} /></button>
            </div>
          </div>
          <div className="week-strip" role="group" aria-label="Tag wählen">
            {WD.map((w, i) => {
              const k = addDays(weekStart, i);
              const n = dayItems(k).filter((x) => !x.done).length;
              const sel = k === day;
              return (
                <button key={k} type="button" className={sel ? 'wday on' : 'wday'} onClick={() => setDay(k)} aria-pressed={sel} aria-label={`${dayFmt.format(parseKey(k))}${n ? `, ${n} Einträge` : ''}`}>
                  <span className="wd">{w}</span>
                  <span className={k === t && !sel ? 'wn today' : 'wn'}>{parseKey(k).getDate()}</span>
                  <span className="wdot" style={{ opacity: n ? 1 : 0 }} />
                </button>
              );
            })}
          </div>
        </section>

        {/* Tagesliste */}
        <section className="group" id="tagesliste">
          <div className="sec-h">
            <h2 className="h2">{dayLabel}</h2>
            {checkable.length > 0 && <span className="sub">{doneCount}/{checkable.length} erledigt</span>}
          </div>
          {checkable.length > 0 && <div className="progress" style={{ margin: '0 4px' }}><div style={{ width: `${(doneCount / checkable.length) * 100}%` }} /></div>}
          <div className="list">
            {all.length === 0 && <div className="empty">{isToday ? 'Nichts geplant. Füg unten etwas hinzu oder sag es dem Assistenten.' : 'Für diesen Tag ist nichts eingetragen.'}</div>}
            {all.map(Row)}
            <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addTask({ title: newTask, due: day, time: newTime || null }); setNewTask(''); setNewTime(''); }}>
              <input className="input" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Neue Aufgabe …" aria-label="Neue Aufgabe" />
              <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: 92, flexShrink: 0 }} aria-label="Uhrzeit (optional)" />
              <button type="submit" className="btn small" disabled={!newTask.trim()} aria-label="Hinzufügen">+</button>
            </form>
          </div>
        </section>

      </main>
      <TabBar active="heute" />
    </>
  );
}

