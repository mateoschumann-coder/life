import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { dueText, fmtShort, today } from '../lib/dates';
import { areaColor, areaOf, projectProgress, subOf } from '../lib/logic';
import { addTask, deleteProject, deleteResource, deleteTask, projectToTemplate, toggleTask, updateProject } from '../lib/actions';
import { Back, Check, Chevron, Field, Icon, Sheet, TabBar, toast, Info } from '../components/ui';
import Blocks from '../components/Blocks';
import ProjectDesigner from '../components/ProjectDesigner';
import { addBlocks, BLOCK_TYPES, makeBlock } from '../lib/blocks';
import { ResourceSheet } from '../components/sheets';
import { go } from '../lib/router';
import { Missing } from './Saeule';

export default function Projekt({ id }) {
  const s = useStore();
  const t = today();
  const [taskText, setTaskText] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [resOpen, setResOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  useEffect(() => {
    // Nach „Neues Projekt → mit KI gestalten“ öffnet sich der Gestalter direkt
    try {
      if (sessionStorage.getItem('life-open-designer') === id) {
        sessionStorage.removeItem('life-open-designer');
        setDesignOpen(true);
      }
    } catch {}
  }, [id]);
  const p = s.projects.find((x) => x.id === id);
  if (!p) return <Missing />;
  const area = areaOf(s, p.areaId);
  const pr = projectProgress(s, p);
  const color = areaColor(s, p.areaId);
  const sub = subOf(area, p.subId);
  const tasks = s.tasks.filter((x) => x.projectId === id).sort((a, b) => Number(a.done) - Number(b.done));
  const resources = s.resources.filter((r) => r.projectId === id);

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href={sub ? `#/unterbereich/${p.areaId}/${sub.id}` : `#/bereich/${p.areaId}`} label={sub ? sub.name : area?.name || 'Bereich'} />
          <span className="eyebrow">Projekt · {area?.name}{sub ? ` · ${sub.name}` : ''}</span>
          <h1 className="h1 sm">{p.name}</h1>
          {p.status === 'archiviert' && <span className="tag" style={{ alignSelf: 'flex-start' }}>Archiviert</span>}
        </div>

        {pr.total > 0 && (
          <section className="card">
            <div className="sec-h" style={{ padding: 0 }}>
              <span className="row-title strong">{pr.pct} % der Aufgaben erledigt</span>
              <span className="sub">{pr.done} von {pr.total}{p.due ? ` · bis ${fmtShort(p.due)}` : ''}</span>
            </div>
            <div className="progress"><div style={{ width: `${pr.pct}%`, background: color }} /></div>
          </section>
        )}

        <button type="button" className="card design-cta" onClick={() => setDesignOpen(true)}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span>
          <span className="row-main">
            <span className="row-title strong">Mit KI gestalten</span>
            <span className="row-meta">{(p.blocks || []).length ? 'Weitere Bausteine, Graphen oder Aufgaben vorschlagen lassen' : 'Die KI schlägt passende Inhalte, Graphen und erste Aufgaben vor'}</span>
          </span>
          <Chevron />
        </button>

        <Blocks p={p} color={color} />
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: '0 4px' }} onClick={() => setBlockOpen(true)}>+ Baustein selbst hinzufügen</button>

        <section className="group">
          <div className="sec-h"><h2 className="h2">Aufgaben</h2></div>
          <div className="list">
            {tasks.map((x) => (
              <div key={x.id} className="row">
                <Check on={x.done} color={color} onClick={() => toggleTask(x.id)} label={(x.done ? 'Offen: ' : 'Erledigt: ') + x.title} />
                <div className="row-main">
                  <span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.title}</span>
                  {x.due && !x.done && <span className="row-meta">fällig {dueText(x.due, t)}</span>}
                </div>
                <button type="button" className="x-btn" aria-label={`${x.title} löschen`} onClick={() => deleteTask(x.id)}>
                  <Icon name="x" size={14} color="var(--chev)" />
                </button>
              </div>
            ))}
            <form
              className="inline-add"
              style={{ flexWrap: 'wrap' }}
              onSubmit={(e) => { e.preventDefault(); addTask({ title: taskText, projectId: id, due: taskDue || null }); setTaskText(''); setTaskDue(''); }}
            >
              <input className="input" style={{ flex: '1 1 180px' }} value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Neue Aufgabe …" aria-label="Neue Aufgabe" />
              <input className="input" style={{ flex: '0 1 150px' }} type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} aria-label="Fällig am (optional)" />
              <button type="submit" className="btn small" disabled={!taskText.trim()}>+</button>
            </form>
          </div>
          <Info>Aufgaben mit Datum erscheinen an dem Tag automatisch unter „Heute“.</Info>
        </section>

        <section className="card">
          <label className="field" style={{ margin: 0 }}>
            <span>Fertig bis (optional)</span>
            <input className="input" type="date" value={p.due || ''} onChange={(e) => updateProject(id, { due: e.target.value || null })} />
          </label>
          <h2 className="label">Notizen</h2>
          <textarea
            className="input"
            defaultValue={p.notes}
            key={p.id}
            placeholder="Ziele, Gedanken, Entscheidungen …"
            onBlur={(e) => e.target.value !== p.notes && updateProject(id, { notes: e.target.value })}
          />
        </section>

        <section className="group">
          <div className="sec-h">
            <h2 className="h2">Ressourcen</h2>
            <button type="button" className="link-btn" onClick={() => setResOpen(true)}>+ Ressource</button>
          </div>
          <div className="list">
            {resources.length === 0 && <div className="empty">Noch keine Links oder Dateien.</div>}
            {resources.map((r) => (
              <div key={r.id} className="row">
                <Icon name="link" size={18} color="var(--muted)" />
                <div className="row-main">
                  {r.url ? <a className="row-title plain" href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : <span className="row-title plain">{r.title}</span>}
                  {r.tags.length > 0 && <span className="row-meta">{r.tags.map((x) => '#' + x).join(' ')}</span>}
                </div>
                <button type="button" className="x-btn" aria-label={`${r.title} löschen`} onClick={() => deleteResource(r.id)}>
                  <Icon name="x" size={14} color="var(--chev)" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <button type="button" className="btn sec" onClick={() => { projectToTemplate(id); toast('Als Vorlage gespeichert'); }}>Als Vorlage speichern</button>
        <div className="btn-row">
          <button type="button" className="btn sec" onClick={() => { updateProject(id, { status: p.status === 'aktiv' ? 'archiviert' : 'aktiv' }); toast(p.status === 'aktiv' ? 'Archiviert' : 'Wieder aktiv'); }}>
            {p.status === 'aktiv' ? 'Archivieren' : 'Wieder aktivieren'}
          </button>
          <button type="button" className="btn danger" onClick={() => { if (confirm(`Projekt „${p.name}“ endgültig löschen?`)) { deleteProject(id); go(`/bereich/${p.areaId}`); } }}>
            Löschen
          </button>
        </div>
      </main>
      <AddBlockSheet open={blockOpen} onClose={() => setBlockOpen(false)} projectId={id} />
      <ProjectDesigner s={s} project={p} open={designOpen} onClose={() => setDesignOpen(false)} />
      <ResourceSheet s={s} open={resOpen} onClose={() => setResOpen(false)} projectId={id} areaId={p.areaId} />
      <TabBar active="bereiche" />
    </>
  );
}

function AddBlockSheet({ open, onClose, projectId }) {
  const [typ, setTyp] = useState('kennzahl');
  const [titel, setTitel] = useState('');
  const [einheit, setEinheit] = useState('');
  const [ziel, setZiel] = useState('');
  const needsUnit = typ === 'kennzahl' || typ === 'budget';
  const needsGoal = typ === 'kennzahl' || typ === 'zaehler' || typ === 'budget';
  const save = () => {
    addBlocks(projectId, [makeBlock({ typ, titel: titel || BLOCK_TYPES[typ].label, einheit, ziel })]);
    setTitel(''); setEinheit(''); setZiel('');
    onClose();
    toast('Baustein hinzugefügt');
  };
  return (
    <Sheet open={open} title="Baustein hinzufügen" onClose={onClose}>
      <div className="list">
        {Object.entries(BLOCK_TYPES).map(([k, v]) => (
          <button key={k} type="button" className="row" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left' }} onClick={() => setTyp(k)} aria-pressed={typ === k}>
            <span className="block-icon"><Icon name={v.icon} size={16} /></span>
            <span className="row-main">
              <span className="row-title plain">{v.label}</span>
              <span className="row-meta">{v.desc}</span>
            </span>
            {typ === k && <Icon name="check" size={18} color="var(--accent)" />}
          </button>
        ))}
      </div>
      <Field label="Titel">
        <input className="input" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={BLOCK_TYPES[typ].label} />
      </Field>
      {(needsUnit || needsGoal) && (
        <div style={{ display: 'flex', gap: 10 }}>
          {needsUnit && <Field label="Einheit"><input className="input" value={einheit} onChange={(e) => setEinheit(e.target.value)} placeholder={typ === 'budget' ? '$' : 'z.B. km'} /></Field>}
          {needsGoal && <Field label={typ === 'budget' ? 'Limit' : 'Ziel (optional)'}><input className="input" type="number" inputMode="decimal" value={ziel} onChange={(e) => setZiel(e.target.value)} /></Field>}
        </div>
      )}
      <button type="button" className="btn" onClick={save}>Hinzufügen</button>
    </Sheet>
  );
}
