// Informiert bleiben (v0.31, v0.90): Zeitungen nach Region mit Rubriken (Politik, Wirtschaft, Tech & KI …)
// + Quellen nach Art (Newsletter, Blog, Podcast …) und Thema (Wirtschaft, Geopolitik, KI, Startups) – Auswahl + eigene
import { useState } from 'react';
import { useStore } from '../lib/store';
import { addSource, CURATED, host, OUTLETS, outletLink, removeSource, RUBRIKEN, SOURCE_TOPICS, SOURCE_TYPES } from '../lib/news';
import { Back, Icon, Segmented, TabBar, toast, Info } from '../components/ui';

const remember = (key, init) => {
  try { return localStorage.getItem(key) || init; } catch { return init; }
};
const save = (key, v) => { try { localStorage.setItem(key, v); } catch {} };

function Outlets() {
  const [rub, setRubState] = useState(() => remember('life-app-news-rubrik', 'start'));
  const setRub = (v) => { setRubState(v); save('life-app-news-rubrik', v); };
  return (
    <>
      <div className="box-tabs">
        {RUBRIKEN.map((r) => <button key={r.id} type="button" className={rub === r.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setRub(r.id)}>{r.label}</button>)}
      </div>
      {rub !== 'start' && <Info>Direkt zur Rubrik – bei 🔎 sucht Google News die Rubrik auf dieser Seite (letzte Woche).</Info>}
      {OUTLETS.map((g) => (
        <section key={g.region} className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>{g.flag} {g.region}</h2>
          <div className="news-grid">
            {g.list.map((x) => {
              const l = outletLink(x, rub);
              return (
                <a key={x.url} href={l.url} target="_blank" rel="noreferrer" className="news-tile">
                  <b>{x.name}</b>
                  <span className="tiny">{l.direct ? (rub === 'start' ? host(x.url) : RUBRIKEN.find((r) => r.id === rub)?.label) : `🔎 ${RUBRIKEN.find((r) => r.id === rub)?.label}`}</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

const typeOf = (id) => SOURCE_TYPES.find((t) => t.id === id);
function SourceRow({ x, mine, onSave, edit }) {
  const t = typeOf(x.type);
  return (
    <div className="row" style={{ minHeight: 54 }}>
      <a href={x.url || undefined} target="_blank" rel="noreferrer" className="row-main">
        <span className="row-title strong">{t ? `${t.emoji} ` : ''}{x.name}</span>
        <span className="row-meta">{[x.lang, x.note || (x.url && host(x.url)), (x.topics || []).join(', ')].filter(Boolean).join(' · ')}</span>
      </a>
      {mine && edit && <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => removeSource(x.id)}>Entfernen</button>}
      {!mine && <button type="button" className="pill" onClick={onSave} aria-label={`${x.name} zu meinen Quellen`}>＋ Meine</button>}
      {!(mine && edit) && <Icon name="link" size={15} color="var(--accent)" />}
    </div>
  );
}

function Sources({ s }) {
  const own = s.newsSources || [];
  const [type, setTypeState] = useState(() => remember('life-app-src-type', 'alle'));
  const [topic, setTopicState] = useState(() => remember('life-app-src-topic', 'alle'));
  const setType = (v) => { setTypeState(v); save('life-app-src-type', v); };
  const setTopic = (v) => { setTopicState(v); save('life-app-src-topic', v); };
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', url: '', note: '', type: '', topics: [] });
  const [newTopic, setNewTopic] = useState('');
  const topics = [...new Set([...SOURCE_TOPICS, ...own.flatMap((x) => x.topics || [])])];
  const fit = (x) => (type === 'alle' || x.type === type) && (topic === 'alle' || (x.topics || []).includes(topic));
  const ownUrls = new Set(own.map((x) => x.url));
  const mine = own.filter(fit);
  const sugg = CURATED.filter((x) => fit(x) && !ownUrls.has(x.url));
  const saveCurated = (x) => { addSource({ name: x.name, url: x.url, note: x.note, type: x.type, topics: x.topics }); toast(`${x.name} bei „Meine Quellen“`); };
  const submit = (e) => {
    e.preventDefault();
    const topicsSel = [...f.topics, ...(newTopic.trim() ? [newTopic.trim()] : [])];
    if (addSource({ ...f, topics: topicsSel })) toast('Quelle gespeichert');
    setF({ name: '', url: '', note: '', type: '', topics: [] });
    setNewTopic('');
    setAdding(false);
  };
  return (
    <>
      <div className="field">
        <span>Art</span>
        <div className="box-tabs">
          <button type="button" className={type === 'alle' ? 'chip on' : 'chip soft'} onClick={() => setType('alle')}>Alle</button>
          {SOURCE_TYPES.map((t) => <button key={t.id} type="button" className={type === t.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setType(t.id)}>{t.emoji} {t.label}</button>)}
        </div>
      </div>
      <div className="field">
        <span>Thema</span>
        <div className="box-tabs">
          <button type="button" className={topic === 'alle' ? 'chip on' : 'chip soft'} onClick={() => setTopic('alle')}>Alle</button>
          {topics.map((t) => <button key={t} type="button" className={topic === t ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTopic(t)}>{t}</button>)}
        </div>
      </div>

      <section className="group">
        <div className="sec-h">
          <h2 className="h2" style={{ fontSize: 19 }}>Meine Quellen</h2>
          <span style={{ display: 'flex', gap: 6 }}>
            {own.length > 0 && <button type="button" className={edit ? 'pill on' : 'link-btn'} onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Bearbeiten'}</button>}
            <button type="button" className="btn small" onClick={() => setAdding(!adding)}>{adding ? 'Abbrechen' : '+ Quelle'}</button>
          </span>
        </div>
        {adding && (
          <form className="card" style={{ gap: 8 }} onSubmit={submit}>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, z.B. Stratechery" aria-label="Name der Quelle" />
            <input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Link, z.B. stratechery.com" inputMode="url" aria-label="Link" />
            <div className="chips">{SOURCE_TYPES.map((t) => <button key={t.id} type="button" className={f.type === t.id ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, type: f.type === t.id ? '' : t.id })}>{t.emoji} {t.label}</button>)}</div>
            <div className="chips">{topics.map((t) => <button key={t} type="button" className={f.topics.includes(t) ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, topics: f.topics.includes(t) ? f.topics.filter((y) => y !== t) : [...f.topics, t] })}>{t}</button>)}</div>
            <input className="input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Neues Thema (optional), z.B. Lateinamerika" aria-label="Neues Thema" />
            <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Worum geht es? (optional)" aria-label="Notiz" />
            <button type="submit" className="btn small" disabled={!f.name.trim() && !f.url.trim()}>Speichern</button>
          </form>
        )}
        <div className="list">
          {mine.length === 0 && <div className="empty">{own.length ? 'Keine eigenen Quellen in dieser Auswahl.' : 'Noch keine eigenen Quellen – unten bei den Vorschlägen auf „＋ Meine“ tippen oder selbst eine hinzufügen.'}</div>}
          {mine.map((x) => <SourceRow key={x.id} x={x} mine edit={edit} />)}
        </div>
      </section>

      {sugg.length > 0 && (
        <section className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>Vorschläge · {sugg.length}</h2>
          <div className="list">{sugg.map((x) => <SourceRow key={x.id} x={x} onSave={() => saveCurated(x)} />)}</div>
        </section>
      )}
    </>
  );
}

export default function News() {
  const s = useStore();
  const [tab, setTab] = useState('news');
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/professionell" label="Professionell" />
          <h1 className="h1">Informiert bleiben</h1>
        </div>
        <Segmented full options={[{ id: 'news', label: 'Zeitungen' }, { id: 'quellen', label: 'Weitere Quellen' }]} value={tab} onChange={setTab} label="Ansicht" />
        {tab === 'news' ? <Outlets /> : <Sources s={s} />}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
