// Inhalt eines Lebensbereichs oder Unterbereichs: Rhythmen, Projekte, Aufgaben/Ideen, Ressourcen
import { useState } from 'react';
import { fmtShort, today } from '../lib/dates';
import { areaColor, habitProgress, habitStreak, projectProgress, subOf } from '../lib/logic';
import { addTask, deleteHabit, deleteResource, deleteTask, ideaToProject, toggleCheckin, toggleTask } from '../lib/actions';
import { Check, Chevron, Icon, toast } from './ui';
import { NewHabitSheet, NewProjectSheet, ResourceSheet } from './sheets';
import { go } from '../lib/router';

export default function AreaContent({ s, area, subId = null }) {
  const t = today();
  const [sheet, setSheet] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [asIdea, setAsIdea] = useState(false);
  const color = areaColor(s, area.id);
  const inScope = (x) => x.areaId === area.id && (!subId || x.subId === subId);
  const subTag = (x) => (!subId && x.subId ? subOf(area, x.subId)?.name : null);

  const habits = s.habits.filter(inScope);
  const projects = s.projects.filter((p) => inScope(p) && p.status === 'aktiv');
  const tasks = s.tasks.filter((x) => inScope(x) && !x.projectId && !x.done).sort((a, b) => Number(a.idea) - Number(b.idea));
  const doneCount = s.tasks.filter((x) => inScope(x) && !x.projectId && x.done).length;
  const resources = s.resources.filter((r) => inScope(r) && !r.projectId);
  const close = () => setSheet(null);

  const meta = (...parts) => parts.filter(Boolean).join(' · ');

  return (
    <>
      <section className="group">
        <div className="sec-h">
          <h2 className="h2">Rhythmen</h2>
          <button type="button" className="link-btn" onClick={() => setSheet('habit')}>Hinzufügen</button>
        </div>
        <div className="list">
          {habits.length === 0 && <div className="empty">Wiederkehrendes, z.B. „Laufen 3× pro Woche“. Jedes Abhaken zählt für die Ampel.</div>}
          {habits.map((h) => {
            const p = habitProgress(s, h, t);
            const str = habitStreak(s, h, t);
            return (
              <div key={h.id} className="row">
                <Check on={p.today} color={color} onClick={() => toggleCheckin(h.id)} label={`${h.name} heute abhaken`} />
                <div className="row-main">
                  <span className="row-title">{h.name}</span>
                  <span className="row-meta">{meta(`${h.count}× pro ${h.period === 'monat' ? 'Monat' : 'Woche'}`, `${p.done}/${p.count}`, str.streak > 0 && `Serie ${str.streak} ${str.unit}`, subTag(h))}</span>
                </div>
                <button type="button" className="x-btn" aria-label={`${h.name} löschen`} onClick={() => confirm(`Rhythmus „${h.name}“ mit allen Einträgen löschen?`) && deleteHabit(h.id)}>
                  <Icon name="x" size={14} color="var(--chev)" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="group">
        <div className="sec-h">
          <h2 className="h2">Projekte</h2>
          <button type="button" className="link-btn" onClick={() => setSheet('projekt')}>Neues Projekt</button>
        </div>
        <div className="list">
          {projects.length === 0 && <div className="empty">Keine aktiven Projekte.</div>}
          {projects.map((p) => {
            const pr = projectProgress(s, p);
            return (
              <a key={p.id} href={`#/projekt/${p.id}`} className="row">
                <div className="row-main" style={{ gap: 8 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="row-title">{p.name}</span>
                    <span className="sub">{pr.done}/{pr.total}</span>
                  </span>
                  <span className="progress"><span style={{ width: `${pr.pct}%`, background: color }} /></span>
                  {(p.due || subTag(p)) && <span className="row-meta">{meta(p.due && `bis ${fmtShort(p.due)}`, subTag(p))}</span>}
                </div>
                <Chevron />
              </a>
            );
          })}
        </div>
      </section>

      <section className="group">
        <div className="sec-h">
          <h2 className="h2">Aufgaben und Ideen</h2>
          {doneCount > 0 && <span className="sub">{doneCount} erledigt</span>}
        </div>
        <div className="list">
          {tasks.map((x) => (
            <div key={x.id} className="row">
              {x.idea ? (
                <span style={{ width: 24, display: 'inline-flex', justifyContent: 'center' }}><Icon name="sparkle" size={18} color="#E0A21B" /></span>
              ) : (
                <Check on={false} color={color} onClick={() => toggleTask(x.id)} label={`Erledigt: ${x.title}`} />
              )}
              <div className="row-main">
                <span className="row-title">{x.title}</span>
                {(x.idea || x.due || subTag(x)) && <span className="row-meta">{meta(x.idea && 'Idee', x.due && `fällig ${fmtShort(x.due)}`, subTag(x))}</span>}
              </div>
              {x.idea && (
                <button type="button" className="pill" onClick={() => { const id = ideaToProject(x.id); toast('Projekt erstellt'); go(`/projekt/${id}`); }}>
                  Zum Projekt
                </button>
              )}
              <button type="button" className="x-btn" aria-label={`${x.title} löschen`} onClick={() => deleteTask(x.id)}>
                <Icon name="x" size={14} color="var(--chev)" />
              </button>
            </div>
          ))}
          <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addTask({ title: taskText, areaId: area.id, subId, idea: asIdea }); setTaskText(''); }}>
            <button type="button" className={asIdea ? 'chip on' : 'chip'} style={{ background: asIdea ? undefined : 'var(--card-2)', flexShrink: 0 }} onClick={() => setAsIdea(!asIdea)} aria-pressed={asIdea}>
              {asIdea ? 'Idee' : 'Aufgabe'}
            </button>
            <input className="input" value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder={asIdea ? 'Neue Idee …' : 'Neue Aufgabe …'} aria-label="Neuer Eintrag" />
            <button type="submit" className="btn small" disabled={!taskText.trim()} aria-label="Hinzufügen">+</button>
          </form>
        </div>
      </section>

      <section className="group">
        <div className="sec-h">
          <h2 className="h2">Ressourcen</h2>
          <button type="button" className="link-btn" onClick={() => setSheet('res')}>Hinzufügen</button>
        </div>
        <div className="list">
          {resources.length === 0 && <div className="empty">Links, Dateien, Notizen, Code – alles, was du wiederverwenden willst.</div>}
          {resources.map((r) => (
            <div key={r.id} className="row">
              <Icon name="link" size={18} color="var(--muted)" />
              <div className="row-main">
                {r.url ? <a className="row-title" style={{ color: 'var(--accent)' }} href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : <span className="row-title">{r.title}</span>}
                {(r.tags.length > 0 || subTag(r)) && <span className="row-meta">{meta(r.tags.map((x) => '#' + x).join(' '), subTag(r))}</span>}
              </div>
              <button type="button" className="x-btn" aria-label={`${r.title} löschen`} onClick={() => confirm('Ressource löschen?') && deleteResource(r.id)}>
                <Icon name="x" size={14} color="var(--chev)" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <NewHabitSheet s={s} open={sheet === 'habit'} onClose={close} areaId={area.id} subId={subId} />
      <NewProjectSheet s={s} open={sheet === 'projekt'} onClose={close} areaId={area.id} subId={subId} />
      <ResourceSheet s={s} open={sheet === 'res'} onClose={close} areaId={area.id} subId={subId} />
    </>
  );
}
