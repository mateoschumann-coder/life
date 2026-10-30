// v1.22 (Mateo): „+ Aufgabe“ oben auf jeder Seite → kleines Fenster, Aufgabe direkt eintragen
import { useEffect, useRef, useState } from 'react';
import { addTask } from '../lib/actions';
import { addDays, fmtShort, today } from '../lib/dates';
import { DateRangeField } from './DateRange';
import { Sheet, toast } from './ui';
import { go } from '../lib/router';
import AiFill from './AiFill';

export default function QuickTask() {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today());
  const [time, setTime] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { setTitle(e?.detail?.title || ''); setDue(today()); setTime(''); setOpen(true); setN((x) => x + 1); setTimeout(() => ref.current?.focus(), 250); };
    const hc = () => setOpen(false);
    window.addEventListener('life-quick-task', h);
    window.addEventListener('hashchange', hc);
    return () => { window.removeEventListener('life-quick-task', h); window.removeEventListener('hashchange', hc); };
  }, []);
  const t = today(), tm = addDays(t, 1);
  const save = (next) => {
    if (!title.trim()) return;
    addTask({ title, due: due || null, time: due && time ? time : null });
    toast(due === t ? 'Aufgabe für heute eingetragen' : due === tm ? 'Aufgabe für morgen eingetragen' : due ? `Aufgabe für ${fmtShort(due)} eingetragen` : 'Aufgabe ohne Datum eingetragen');
    if (next === true) { setTitle(''); setTime(''); setN((x) => x + 1); setTimeout(() => ref.current?.focus(), 50); } else setOpen(false);
  };
  const other = due && due !== t && due !== tm;
  return (
    <Sheet open={open} title="Neue Aufgabe" onClose={() => setOpen(false)}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AiFill key={n} title="Aufgabe" fields={{ title: 'Was zu tun ist, kurz', due: 'Datum YYYY-MM-DD', time: 'Uhrzeit HH:MM' }} values={{ title, time }} onResult={(r) => { if (r.title) setTitle(r.title); if (r.due) setDue(r.due); if (r.time) setTime(r.time); }} placeholder="z.B. „Morgen um 10 Juan wegen Asado anrufen“" />
        <label className="field"><span>Was?</span><input ref={ref} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Mama anrufen, Rechnung zahlen" /></label>
        <div className="field">
          <span>Wann?</span>
          <div className="chips">
            <button type="button" className={due === t ? 'chip on' : 'chip soft'} onClick={() => setDue(t)}>Heute</button>
            <button type="button" className={due === tm ? 'chip on' : 'chip soft'} onClick={() => setDue(tm)}>Morgen</button>
            <button type="button" className={!due ? 'chip on' : 'chip soft'} onClick={() => setDue('')}>Ohne Datum</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, minWidth: 0 }}><DateRangeField single from={other ? due : ''} to="" onChange={(v) => setDue(v.from || '')} placeholder={other ? fmtShort(due) : 'Anderer Tag …'} title="Datum" /></div>
            {due && <input className="input" type="time" style={{ flex: '0 0 120px' }} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Uhrzeit" />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn" style={{ flex: 1 }} disabled={!title.trim()}>Eintragen</button>
          <button type="button" className="btn tint" disabled={!title.trim()} onClick={() => save(true)}>+ Nächste</button>
        </div>
        <button type="button" className="link-btn" style={{ alignSelf: 'center', fontSize: 14 }} onClick={() => { setOpen(false); go('/erfassen'); }}>Etwas anderes erfassen (Idee, Einkauf, Notiz …) →</button>
      </form>
    </Sheet>
  );
}
