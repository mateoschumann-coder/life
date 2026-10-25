import { useState } from 'react';
import { useStore } from '../lib/store';
import { addInbox, addResource, addTask, removeInbox, savePerson } from '../lib/actions';
import { AreaSelect, Field, Segmented, Sheet, SubSelect, TabBar, toast } from '../components/ui';
import { PEOPLE_CATEGORIES } from '../lib/seed';

const TYPES = [
  { id: 'aufgabe', label: 'Aufgabe' },
  { id: 'idee', label: 'Idee' },
  { id: 'notiz', label: 'Notiz' },
  { id: 'person', label: 'Person' },
  { id: 'link', label: 'Link' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((x) => [x.id, x.label]));

export default function Erfassen() {
  const s = useStore();
  const [text, setText] = useState('');
  const [type, setType] = useState('aufgabe');
  const [sorting, setSorting] = useState(null);

  const toInbox = () => {
    addInbox(text, type);
    setText('');
    toast('In der Inbox');
  };
  const sortNow = () => {
    setSorting({ id: null, text: text.trim(), type });
  };

  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Erfassen</h1>
        </div>
        <section className="card">
          <label htmlFor="capture" className="label">Was willst du festhalten?</label>
          <textarea id="capture" className="input" style={{ fontSize: 18, minHeight: 110 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. Tango-Kurs in Palermo ausprobieren" />
          <span className="tiny">Tipp: Mikrofon auf der Tastatur antippen, um zu diktieren.</span>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="label">Was ist es?</h2>
          <div className="chips" style={{ gap: 8 }}>
            {TYPES.map((x) => (
              <button key={x.id} type="button" className={type === x.id ? 'chip on' : 'chip'} aria-pressed={type === x.id} onClick={() => setType(x.id)}>{x.label}</button>
            ))}
          </div>
        </section>
        <div className="btn-row">
          <button type="button" className="btn sec" disabled={!text.trim()} onClick={toInbox}>In die Inbox</button>
          <button type="button" className="btn" disabled={!text.trim()} onClick={sortNow}>Jetzt einsortieren</button>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="sec-h">
            <h2 className="h2">Inbox</h2>
            <span className="sub">{s.inbox.length} unsortiert</span>
          </div>
          <div className="list">
            {s.inbox.length === 0 && <div className="empty">Leer. Alles, was du schnell erfasst, landet hier, bis du es einsortierst.</div>}
            {s.inbox.map((i) => (
              <div key={i.id} className="row">
                <div className="row-main">
                  <span className="row-title plain">{i.text}</span>
                  <span className="row-meta">{TYPE_LABEL[i.type]}</span>
                </div>
                <button type="button" className="pill" onClick={() => setSorting({ id: i.id, text: i.text, type: i.type })}>Einsortieren</button>
              </div>
            ))}
          </div>
        </section>
      </main>
      {sorting && (
        <SortSheet
          s={s}
          item={sorting}
          onClose={() => setSorting(null)}
          onDone={() => {
            if (sorting.id) removeInbox(sorting.id);
            else setText('');
            setSorting(null);
            toast('Einsortiert');
          }}
        />
      )}
      <TabBar active="erfassen" />
    </>
  );
}

function SortSheet({ s, item, onClose, onDone }) {
  const initialAs = item.type === 'person' ? 'person' : item.type === 'idee' ? 'idee' : item.type === 'aufgabe' ? 'aufgabe' : 'ressource';
  const [as, setAs] = useState(initialAs);
  const [title, setTitle] = useState(item.text);
  const [areaId, setAreaId] = useState('freizeit');
  const [projectId, setProjectId] = useState('');
  const [subId, setSubId] = useState(null);
  const area = s.areas.find((a) => a.id === areaId);
  const [due, setDue] = useState('');
  const [category, setCategory] = useState('freunde');
  const projects = s.projects.filter((p) => p.areaId === areaId && p.status === 'aktiv');
  const isUrl = /^https?:\/\//i.test(title.trim());

  const save = () => {
    if (as === 'person') {
      savePerson({ name: title.trim(), category, contactEvery: null, birthday: '', phone: '', notes: '' });
    } else if (as === 'ressource') {
      addResource({ title: title, url: isUrl ? title : '', areaId, subId, projectId: projectId || null });
    } else {
      addTask({ title, areaId: projectId ? null : areaId, subId: projectId ? null : subId, projectId: projectId || null, due: as === 'aufgabe' ? due || null : null, idea: as === 'idee' });
    }
    onDone();
  };

  return (
    <Sheet open title="Einsortieren" onClose={onClose}>
      <Segmented
        full
        options={[{ id: 'aufgabe', label: 'Aufgabe' }, { id: 'idee', label: 'Idee' }, { id: 'ressource', label: 'Notiz/Link' }, { id: 'person', label: 'Person' }]}
        value={as}
        onChange={setAs}
        label="Einsortieren als"
      />
      <Field label={as === 'person' ? 'Name' : 'Text'}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      {as === 'person' ? (
        <div className="field">
          <span>Gehört zu</span>
          <div className="chips">
            {PEOPLE_CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={category === c.id ? 'chip on' : 'chip'} onClick={() => setCategory(c.id)}>{c.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Field label="Lebensbereich">
            <AreaSelect s={s} value={areaId} onChange={(v) => { setAreaId(v); setProjectId(''); setSubId(null); }} />
          </Field>
          <SubSelect area={area} value={subId} onChange={setSubId} />
          {projects.length > 0 && (
            <Field label="Projekt (optional)">
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">– kein Projekt –</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          {as === 'aufgabe' && (
            <Field label="Fällig am (optional)">
              <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          )}
        </>
      )}
      <button type="button" className="btn" onClick={save} disabled={!title.trim()}>Speichern</button>
    </Sheet>
  );
}
