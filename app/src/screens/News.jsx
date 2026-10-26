import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { addTopic, WORLD, loadAngles, removeTopic, topicAngles, topicLinks, topicsOf } from '../lib/news';
import { getAi } from '../lib/ai';
import LinkList from '../components/LinkList';
import { Back, Icon, TabBar } from '../components/ui';

// Ein Thema: feste Nachrichten-Links + optionale KI-Blickwinkel
function TopicCard({ s, topic, compact }) {
  const [angles, setAngles] = useState(() => loadAngles()[topic] || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fresh = angles?.date && (Date.now() - new Date(angles.date).getTime()) / 86400000 < 4;
  const links = topicLinks(angles?.main || topic);
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
  // Beim Öffnen eines Themas automatisch für Mateo zuschneiden (ohne Websuche, ca. 0,1 Cent; hält 4 Tage)
  useEffect(() => {
    if (!compact && !fresh && getAi().apiKey) ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, compact]);
  return (
    <section className="card" style={{ gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 17 }}>{topic}</span>
      {angles?.main && <span className="tiny">Für dich zugeschnitten: {angles.main}</span>}
      {!compact && angles?.thought && <span className="sub" style={{ fontSize: 14 }}>{angles.thought}</span>}
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
            <span className="label" style={{ padding: 0 }}>Für dich interessant{angles?.date ? ` · Stand ${angles.date.slice(8, 10)}.${angles.date.slice(5, 7)}.` : ''}</span>
            <button type="button" className="btn tint small" onClick={ask} disabled={busy || !getAi().apiKey}>{busy ? '…' : 'Neu überlegen'}</button>
          </div>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich überlege, was davon für dich interessant ist …</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && angles && <LinkList links={angles.links} hint={angles.hint} />}
          {!busy && !angles && <span className="tiny">Die KI überlegt anhand deines Profils gezielte Suchen (ohne Internet-Suche, ca. 0,1 Cent).</span>}
        </>
      )}
    </section>
  );
}

// Alle Themen auf einmal für Mateo zuschneiden (nur die, die älter als 4 Tage sind)
function TailorAll({ s, topics }) {
  const [busy, setBusy] = useState(false);
  const all = loadAngles();
  const stale = topics.filter((t) => !all[t]?.date || (Date.now() - new Date(all[t].date).getTime()) / 86400000 >= 4);
  if (!stale.length || !getAi().apiKey) return null;
  const run = async () => {
    setBusy(true);
    for (const t of stale) {
      try { await topicAngles(s, t); } catch {}
    }
    setBusy(false);
    window.dispatchEvent(new Event('life-news-tailored'));
  };
  return <button type="button" className="btn tint small" onClick={run} disabled={busy}>{busy ? 'Ich schneide deine Themen zu …' : `✨ ${stale.length} Themen für mich zuschneiden (ca. ${stale.length * 0.1 < 1 ? 'unter 1' : Math.ceil(stale.length * 0.1)} Cent)`}</button>;
}

export default function News() {
  const s = useStore();
  const topics = topicsOf(s);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { const f = () => setTick((n) => n + 1); window.addEventListener('life-news-tailored', f); return () => window.removeEventListener('life-news-tailored', f); }, []);
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
            <section className="card" style={{ gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>🌍 Weltgeschehen</span>
              {WORLD.map((r) => (
                <div key={r.region} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="label" style={{ padding: 0 }}>{r.region}</span>
                  <div className="chips">{r.links.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noreferrer" className="chip soft" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--text)' }}>{n}</a>)}</div>
                </div>
              ))}
            </section>
            <TailorAll s={s} topics={topics} />
            {topics.map((t) => <TopicCard key={t + tick} s={s} topic={t} compact />)}
            {topics.length > 0 && <span className="tiny" style={{ padding: '0 4px' }}>Tippe oben auf ein Thema für mehr Quellen und KI-Blickwinkel.</span>}
          </>
        )}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
