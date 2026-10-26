import { useState } from 'react';
import { useStore } from '../lib/store';
import { addTopic, loadAngles, removeTopic, topicAngles, topicLinks, topicsOf } from '../lib/news';
import { getAi } from '../lib/ai';
import LinkList from '../components/LinkList';
import { Back, Icon, TabBar } from '../components/ui';

// Ein Thema: feste Nachrichten-Links + optionale KI-Blickwinkel
function TopicCard({ s, topic, compact }) {
  const [angles, setAngles] = useState(() => loadAngles()[topic] || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const links = topicLinks(topic);
  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      setAngles(await topicAngles(s, topic));
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" style={{ gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 17 }}>{topic}</span>
      <div className="news-grid">
        {(compact ? links.slice(0, 3) : links).map((l) => (
          <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="news-link">
            <span className="link-tag">{l.label}</span>
            <span>{l.title}</span>
          </a>
        ))}
      </div>
      {!compact && (
        <>
          <div className="sec-h" style={{ padding: 0 }}>
            <span className="label" style={{ padding: 0 }}>Blickwinkel{angles?.date ? ` · Stand ${angles.date.slice(8, 10)}.${angles.date.slice(5, 7)}.` : ''}</span>
            <button type="button" className="btn tint small" onClick={ask} disabled={busy || !getAi().apiKey}>{busy ? '…' : angles ? 'Neu' : 'KI-Blickwinkel'}</button>
          </div>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich überlege die wichtigsten Unterthemen …</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && angles && <LinkList links={angles.links} hint={angles.hint} />}
          {!busy && !angles && <span className="tiny">Die KI schlägt gezielte Suchen zu wichtigen Unterthemen vor (ohne Internet-Suche, unter 0,5 Cent).</span>}
        </>
      )}
    </section>
  );
}

export default function News() {
  const s = useStore();
  const topics = topicsOf(s);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/professionell" label="Professionell" />
          <h1 className="h1">Informiert bleiben</h1>
        </div>
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setSel(null); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Thema suchen, z.B. Milei Wirtschaftsreform" aria-label="Thema suchen" />
          <button type="submit" className="btn small" disabled={!q.trim()} aria-label="Suchen"><Icon name="search" size={16} color="currentColor" /></button>
        </form>
        <div className="box-tabs">
          <button type="button" className={!sel && !query ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => { setSel(null); setQuery(''); }}>Alle Themen</button>
          {topics.map((t) => (
            <button key={t} type="button" className={edit ? 'chip editing' : sel === t ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => (edit ? confirm(`Thema „${t}“ entfernen?`) && removeTopic(t) : (setSel(t), setQuery('')))}>
              {t}{edit && <Icon name="x" size={11} />}
            </button>
          ))}
          <button type="button" className="chip soft" onClick={() => setEdit(!edit)} aria-label="Themen bearbeiten">{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
        </div>
        {edit && (
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); addTopic(text); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Neuer Themenbereich, z.B. Wirtschaft Argentinien" aria-label="Neues Thema" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        )}
        {query && (
          <>
            <TopicCard key={'q' + query} s={s} topic={query} />
            {!topics.includes(query) && <button type="button" className="btn tint small" onClick={() => { addTopic(query); setSel(query); setQuery(''); }}>„{query}“ als Thema speichern</button>}
          </>
        )}
        {!query && sel && <TopicCard key={sel} s={s} topic={sel} />}
        {!query && !sel && (
          <>
            {topics.length === 0 && <div className="notice">Füg Themenbereiche hinzu (Stift), z.B. KI, Startups & VC, Geopolitik, Wirtschaft Argentinien. Für jedes Thema bekommst du sortierte Nachrichten-Links: heute, diese Woche, auf Deutsch, Englisch und Spanisch.</div>}
            {topics.map((t) => <TopicCard key={t} s={s} topic={t} compact />)}
            {topics.length > 0 && <span className="tiny" style={{ padding: '0 4px' }}>Tippe oben auf ein Thema für mehr Quellen und KI-Blickwinkel.</span>}
          </>
        )}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
