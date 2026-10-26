import { useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, fmtShort, startOfWeek, targetText, today } from '../lib/dates';
import { areaDates, areaOf, areaStatus, countByDay, pillarOf } from '../lib/logic';
import { addSub, logActivity, updateArea } from '../lib/actions';
import { AreaIcon, Back, Chevron, Dot, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

import { Heatmap, HeatLegend } from '../components/Heatmap';
import AreaContent from '../components/AreaContent';
import { CoachBox } from '../components/Coach';
import ToolCards from '../components/ToolCards';
import { TOOL_AREAS } from '../lib/tools';
import { Missing } from './Saeule';

const RANGES = [
  { id: 4, label: '4 Wo.' },
  { id: 12, label: '12 Wo.' },
  { id: 26, label: '6 Mon.' },
  { id: 52, label: 'Jahr' },
];
const TARGETS = [1, 3, 7, 14, 30, 60, 90];

export default function Bereich({ id }) {
  const s = useStore();
  const t = today();
  const [weeks, setWeeks] = useState(12);
  const [sheet, setSheet] = useState(null);
  const [note, setNote] = useState('');
  const [subText, setSubText] = useState('');
  const area = areaOf(s, id);
  if (!area) return <Missing />;
  const pillar = pillarOf(s, area.pillarId);
  const st = areaStatus(s, area, t);
  const start = addDays(startOfWeek(t), -(weeks - 1) * 7);
  const counts = countByDay(areaDates(s, id));
  const activeDays = Object.keys(counts).filter((d) => d >= start && d <= t).length;
  const notes = s.activities.filter((a) => a.areaId === id && a.note).slice(-3).reverse();
  const subCount = (subId) =>
    [s.habits, s.projects.filter((p) => p.status === 'aktiv'), s.tasks.filter((x) => !x.done && !x.projectId), s.resources].reduce(
      (n, list) => n + list.filter((x) => x.areaId === id && x.subId === subId).length,
      0
    );
  const close = () => setSheet(null);

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href={`#/saeule/${pillar.id}`} label={pillar.name} />
          <div className="title-row">
            <AreaIcon icon={area.icon} color={pillar.color} size={40} />
            <h1 className="h1 sm">{area.name}</h1>
          </div>
        </div>

        <CoachBox s={s} areaId={id} />

        <ToolCards areaId={id} />

        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Dot level={st.level} />
            <div className="row-main">
              <span className="row-title strong">{st.text}</span>
              <span className="row-meta">Ziel: {area.paused ? 'pausiert' : targetText(area.targetDays)}</span>
            </div>
            <button type="button" className="link-btn" onClick={() => setSheet('ziel')}>Ziel</button>
          </div>
          <button type="button" className="btn tint small" onClick={() => setSheet('aktiv')}>Heute darum gekümmert</button>
        </section>

        <section className="card">
          <div className="sec-h" style={{ padding: 0 }}>
            <h2 className="label">Aktivität</h2>
            <Segmented options={RANGES} value={weeks} onChange={setWeeks} label="Zeitraum" />
          </div>
          <Heatmap counts={counts} weeks={weeks} t={t} />
          <HeatLegend left={`${activeDays} aktive Tage`} />
        </section>

        {!TOOL_AREAS.has(id) && <section className="group">
          <div className="sec-h"><h2 className="h2">Unterbereiche</h2></div>
          <div className="list">
            {area.subs.map((sub) => {
              const n = subCount(sub.id);
              return (
                <a key={sub.id} href={`#/unterbereich/${id}/${sub.id}`} className="row">
                  <span className="row-main"><span className="row-title">{sub.name}</span></span>
                  {n > 0 && <span className="row-side">{n}</span>}
                  <Chevron />
                </a>
              );
            })}
            <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addSub(id, subText); setSubText(''); }}>
              <input className="input" value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="Unterbereich hinzufügen" aria-label="Unterbereich hinzufügen" />
              <button type="submit" className="btn small" disabled={!subText.trim()}>+</button>
            </form>
          </div>
        </section>}

        <AreaContent s={s} area={area} />

        {notes.length > 0 && (
          <section className="group">
            <div className="sec-h"><h2 className="h2">Letzte Notizen</h2></div>
            <div className="list">
              {notes.map((n) => (
                <div key={n.id} className="row">
                  <span className="row-main"><span className="row-title">{n.note}</span><span className="row-meta">{fmtShort(n.date)}</span></span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Sheet open={sheet === 'aktiv'} title="Aktivität eintragen" onClose={close}>
        <Field label="Was hast du gemacht? (optional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Budget für November geprüft" />
        </Field>
        <button type="button" className="btn" onClick={() => { logActivity(id, note); setNote(''); close(); toast('Eingetragen'); }}>Eintragen</button>
      </Sheet>

      <Sheet open={sheet === 'ziel'} title="Ziel für diesen Bereich" onClose={close}>
        <span className="sub" style={{ lineHeight: 1.45 }}>Wie oft willst du dich mindestens darum kümmern? Danach wird die Ampel gelb, beim Doppelten rot.</span>
        <div className="chips">
          {TARGETS.map((d) => (
            <button key={d} type="button" className={!area.paused && area.targetDays === d ? 'chip on' : 'chip'} onClick={() => { updateArea(id, { targetDays: d, paused: false }); close(); }}>
              {targetText(d)}
            </button>
          ))}
        </div>
        <button type="button" className="btn sec" style={{ color: area.paused ? 'var(--accent)' : 'var(--text)' }} onClick={() => { updateArea(id, { paused: !area.paused }); close(); }}>
          {area.paused ? 'Pause beenden' : 'Bewusst pausieren (grau)'}
        </button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}
