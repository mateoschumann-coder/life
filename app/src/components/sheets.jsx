// Wiederverwendbare Formulare (öffnen sich von unten)
import { useState } from 'react';
import { AreaSelect, Field, Segmented, Sheet, SubSelect, toast } from './ui';
import { addHabit, addProject, addResource } from '../lib/actions';
import { areaOf } from '../lib/logic';
import { go } from '../lib/router';

export function NewProjectSheet({ s, open, onClose, areaId, subId = null, pillarId }) {
  const firstArea = areaId || s.areas.find((a) => !pillarId || a.pillarId === pillarId)?.id;
  const [name, setName] = useState('');
  const [area, setArea] = useState(firstArea);
  const [sub, setSub] = useState(subId);
  const [due, setDue] = useState('');
  const [tpl, setTpl] = useState(null);
  const chosenArea = areaOf(s, areaId || area);
  const template = s.templates.find((t) => t.id === tpl);
  const save = () => {
    const id = addProject({ name, areaId: areaId || area || firstArea, subId: subId || sub, due: due || null, templateId: tpl });
    if (!id) return;
    setName('');
    setDue('');
    onClose();
    toast('Projekt angelegt');
    go(`/projekt/${id}`);
  };
  return (
    <Sheet open={open} title="Neues Projekt" onClose={onClose}>
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Wohnung umdekorieren" />
      </Field>
      {!areaId && (
        <Field label="Lebensbereich">
          <AreaSelect s={s} value={area} onChange={(v) => { setArea(v); setSub(null); }} />
        </Field>
      )}
      {!subId && <SubSelect area={chosenArea} value={sub} onChange={setSub} />}
      <Field label="Fertig bis (optional)">
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <div className="field">
        <span>Vorlage</span>
        <div className="chips">
          <button type="button" className={!tpl ? 'chip on' : 'chip'} onClick={() => setTpl(null)}>Leer</button>
          {s.templates.map((t) => (
            <button key={t.id} type="button" className={tpl === t.id ? 'chip on' : 'chip'} onClick={() => setTpl(t.id)}>{t.name}</button>
          ))}
        </div>
        {template && template.tasks.length > 0 && <span className="tiny" style={{ paddingLeft: 4 }}>Legt an: {template.tasks.join(' · ')}</span>}
        <a href="#/vorlagen" className="tiny" style={{ paddingLeft: 4, color: 'var(--accent)' }} onClick={onClose}>Vorlagen bearbeiten</a>
      </div>
      <button type="button" className="btn" onClick={save} disabled={!name.trim()}>Projekt anlegen</button>
    </Sheet>
  );
}

export function NewHabitSheet({ s, open, onClose, areaId, subId = null }) {
  const [name, setName] = useState('');
  const [count, setCount] = useState(3);
  const [fixed, setFixed] = useState(false);
  const [period, setPeriod] = useState('woche');
  const [area, setArea] = useState(areaId || 'koerper');
  const [sub, setSub] = useState(subId);
  const save = () => {
    addHabit({ name, areaId: areaId || area, subId: subId || sub, count: fixed ? count : 0, period });
    setName('');
    onClose();
    toast('Rhythmus angelegt');
  };
  return (
    <Sheet open={open} title="Fokus-Thema oder Rhythmus" onClose={onClose}>
      <Field label="Was?">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Laufen, 20 Min Portugiesisch" />
      </Field>
      {!areaId && (
        <Field label="Lebensbereich">
          <AreaSelect s={s} value={area} onChange={(v) => { setArea(v); setSub(null); }} />
        </Field>
      )}
      {!subId && <SubSelect area={areaOf(s, areaId || area)} value={sub} onChange={setSub} />}
      <div className="field">
        <span>Wie oft?</span>
        <Segmented full options={[{ id: 'frei', label: 'Frei, ohne Zahl' }, { id: 'fest', label: 'Feste Zahl' }]} value={fixed ? 'fest' : 'frei'} onChange={(v) => setFixed(v === 'fest')} label="Art" />
        {!fixed && <span className="tiny" style={{ paddingLeft: 4, lineHeight: 1.4 }}>Du hakst ab, wann immer du es machst. Der KI-Check schaut, ob es eingeschlafen ist, und erinnert dich sanft.</span>}
        {fixed && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" style={{ width: 76 }} type="number" min="1" max="31" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} aria-label="Anzahl" />
          <span className="sub">mal pro</span>
          <Segmented options={[{ id: 'woche', label: 'Woche' }, { id: 'monat', label: 'Monat' }]} value={period} onChange={setPeriod} label="Zeitraum" />
        </div>}
      </div>
      <button type="button" className="btn" onClick={save} disabled={!name.trim()}>Anlegen</button>
    </Sheet>
  );
}

export function ResourceSheet({ s, open, onClose, areaId = null, subId = null, projectId = null }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [sub, setSub] = useState(subId);
  const save = () => {
    addResource({
      title,
      url,
      areaId,
      subId: subId || sub,
      projectId,
      tags: tags.split(/[,\s]+/).map((x) => x.replace(/^#/, '')).filter(Boolean),
    });
    setTitle('');
    setUrl('');
    setTags('');
    onClose();
    toast('Ressource gespeichert');
  };
  return (
    <Sheet open={open} title="Ressource hinzufügen" onClose={onClose}>
      <Field label="Titel">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Trainingsplan, Grammatik-PDF" />
      </Field>
      <Field label="Link (optional) – Excel in OneDrive, Notiz, GitHub, PDF …">
        <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </Field>
      {s && !subId && !projectId && <SubSelect area={areaOf(s, areaId)} value={sub} onChange={setSub} />}
      <Field label="Tags (optional)">
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#portugiesisch #wiederverwendbar" />
      </Field>
      <button type="button" className="btn" onClick={save} disabled={!title.trim()}>Speichern</button>
    </Sheet>
  );
}
