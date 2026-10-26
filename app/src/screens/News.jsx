// Informiert bleiben (v0.31, Mateo: „einfach, nicht so kompliziert“): Hauptseiten der wichtigsten Nachrichtenseiten
// nach Region + eigene Quellen (Blogs, Newsletter, Webseiten)
import { useState } from 'react';
import { useStore } from '../lib/store';
import { addSource, host, OUTLETS, removeSource } from '../lib/news';
import { Back, Icon, Segmented, TabBar, toast } from '../components/ui';

function Outlets() {
  return OUTLETS.map((g) => (
    <section key={g.region} className="group">
      <h2 className="label" style={{ padding: '0 4px' }}>{g.flag} {g.region}</h2>
      <div className="news-grid">
        {g.list.map(([name, url]) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="news-tile">
            <b>{name}</b>
            <span className="tiny">{host(url)}</span>
          </a>
        ))}
      </div>
    </section>
  ));
}

function Sources({ s }) {
  const [f, setF] = useState({ name: '', url: '', note: '' });
  const [edit, setEdit] = useState(false);
  const list = s.newsSources || [];
  return (
    <>
      <section className="group">
        <div className="sec-h">
          <h2 className="h2" style={{ fontSize: 19 }}>Meine Quellen</h2>
          {list.length > 0 && <button type="button" className="link-btn" onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Bearbeiten'}</button>}
        </div>
        <div className="list">
          {list.length === 0 && <div className="empty">Hier sammelst du Webseiten, Blogs oder Newsletter, die regelmäßig etwas veröffentlichen – z.B. einen Wirtschafts-Blog oder einen KI-Newsletter. Ein Tipp öffnet die Seite.</div>}
          {list.map((x) => (
            <div key={x.id} className="row" style={{ minHeight: 56 }}>
              <a href={x.url || undefined} target="_blank" rel="noreferrer" className="row-main">
                <span className="row-title strong">{x.name}</span>
                <span className="row-meta">{[x.url && host(x.url), x.note].filter(Boolean).join(' · ')}</span>
              </a>
              {edit ? <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => removeSource(x.id)}>Entfernen</button> : <Icon name="link" size={15} color="var(--accent)" />}
            </div>
          ))}
        </div>
      </section>
      <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (addSource(f)) toast('Quelle gespeichert'); setF({ name: '', url: '', note: '' }); }}>
        <span className="label" style={{ padding: 0 }}>Quelle hinzufügen</span>
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, z.B. Stratechery" aria-label="Name der Quelle" />
        <input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Link, z.B. stratechery.com" inputMode="url" aria-label="Link" />
        <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Worum geht es? (optional)" aria-label="Notiz" />
        <button type="submit" className="btn small" disabled={!f.name.trim() && !f.url.trim()}>Hinzufügen</button>
      </form>
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
        <Segmented full options={[{ id: 'news', label: 'Nachrichten' }, { id: 'quellen', label: `Andere Quellen${(s.newsSources || []).length ? ` (${s.newsSources.length})` : ''}` }]} value={tab} onChange={setTab} label="Ansicht" />
        {tab === 'news' ? <Outlets /> : <Sources s={s} />}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
