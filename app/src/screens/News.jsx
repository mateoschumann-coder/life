// Informiert bleiben (v0.31, v0.90): Zeitungen nach Region mit Rubriken (Politik, Wirtschaft, Tech & KI …)
// + Quellen nach Art (Newsletter, Blog, Podcast …) und Thema (Wirtschaft, Geopolitik, KI, Startups) – Auswahl + eigene
import { askDel } from '../lib/undo';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { addSource, CURATED, host, outletLink, removeSource, SOURCE_TYPES, newsTypesOf, addNewsType, removeNewsType, resetNewsTypes, rubrikenOf, addRubrik, removeRubrik, resetRubriken, topicsListOf, setTopicsList, countriesOf, removeCountry, addCountry, addPaper, removePaper, resetCountries, knownCountry, suggestPapers } from '../lib/news';
import { getAi } from '../lib/ai';
import { Back, Icon, Sheet, TabBar, toast, Info } from '../components/ui';

const remember = (key, init) => {
  try { return localStorage.getItem(key) || init; } catch { return init; }
};
const save = (key, v) => { try { localStorage.setItem(key, v); } catch {} };

// v1.03: Zeitungen – Rubriken und Länder bearbeitbar, Länder auf-/zuklappbar, neue Länder mit Vorschlägen
function EditList({ open, title, items, onRemove, onAdd, addPh, onReset, onClose }) {
  const [txt, setTxt] = useState('');
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="chips">{items.map((x) => <button key={x.id} type="button" className="chip soft" onClick={() => onRemove(x.id)} disabled={x.fixed}>{x.label}{x.fixed ? '' : ' ✕'}</button>)}</div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) { onAdd(txt.trim()); setTxt(''); } }}>
        <input className="input" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={addPh} aria-label={addPh} />
        <button type="submit" className="btn small" disabled={!txt.trim()}>+</button>
      </form>
      {onReset && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onReset}>Auf Standard zurücksetzen</button>}
      <button type="button" className="btn" onClick={onClose}>Fertig</button>
    </Sheet>
  );
}
function CountrySheet({ open, onClose }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState([]);
  const find = async () => {
    const k = knownCountry(q);
    if (k) { setRes(k); setSel(k.list.map((x) => x.url)); return; }
    if (!getAi().apiKey) { toast('Dieses Land kenne ich noch nicht – mit API-Schlüssel schlägt die KI Zeitungen vor.'); return; }
    setBusy(true);
    try { const r = await suggestPapers(q.trim()); setRes(r); setSel(r.list.map((x) => x.url)); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const close = () => { setQ(''); setRes(null); setSel([]); onClose(); };
  return (
    <Sheet open={open} title="Land hinzufügen" onClose={close}>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (q.trim()) find(); }}>
        <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setRes(null); }} placeholder="z.B. Italien, Brasilien, Japan" aria-label="Land" />
        <button type="submit" className="btn small" disabled={!q.trim() || busy}>{busy ? '…' : 'Vorschlagen'}</button>
      </form>
      {res && (
        <>
          <span className="label" style={{ padding: 0 }}>{res.flag} {res.region} – antippen zum Abwählen</span>
          <div className="list">
            {res.list.map((x) => { const on = sel.includes(x.url); return (
              <button key={x.url} type="button" className="row compact" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none' }} onClick={() => setSel(on ? sel.filter((u) => u !== x.url) : [...sel, x.url])}>
                <span className={on ? 'check on' : 'check'} style={on ? { background: 'var(--accent)' } : undefined}>{on && <Icon name="check" size={12} color="#fff" width={3} />}</span>
                <span className="row-main"><span className="row-title plain">{x.name}</span><span className="row-meta">{host(x.url)}</span></span>
              </button>
            ); })}
          </div>
          <button type="button" className="btn" disabled={!sel.length} onClick={() => { addCountry(res.region, res.flag, res.list.filter((x) => sel.includes(x.url))); toast(`${res.region} hinzugefügt`); close(); }}>{sel.length} Zeitungen übernehmen</button>
        </>
      )}
    </Sheet>
  );
}
function Outlets({ s }) {
  const rubs = rubrikenOf(s);
  const countries = countriesOf(s);
  const [rub, setRubState] = useState(() => remember('life-app-news-rubrik', 'start'));
  const setRub = (v) => { setRubState(v); save('life-app-news-rubrik', v); };
  const cur = rubs.some((r) => r.id === rub) ? rub : 'start';
  const [closed, setClosedState] = useState(() => { try { return JSON.parse(localStorage.getItem('life-app-news-closed') || '[]'); } catch { return []; } });
  const toggle = (r) => { const n = closed.includes(r) ? closed.filter((x) => x !== r) : [...closed, r]; setClosedState(n); save('life-app-news-closed', JSON.stringify(n)); };
  const [editRub, setEditRub] = useState(false);
  const [editC, setEditC] = useState(false);
  const [addC, setAddC] = useState(false);
  const [paper, setPaper] = useState(null); // { region, name, url }
  const label = rubs.find((r) => r.id === cur)?.label;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="box-tabs">
          {rubs.map((r) => <button key={r.id} type="button" className={cur === r.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setRub(r.id)}>{r.label}</button>)}
          <button type="button" className="chip soft" onClick={() => setEditRub(true)} aria-label="Rubriken bearbeiten">✎</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn small" onClick={() => setAddC(true)}>+ Land</button>
          <button type="button" className={editC ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setEditC(!editC)}>{editC ? 'Fertig' : '✎ Länder & Zeitungen'}</button>
          {cur !== 'start' && <Info>Direkt zur Rubrik – bei 🔎 sucht Google News die Rubrik auf dieser Seite (letzte Woche).</Info>}
        </div>
      </div>
      {countries.map((g) => {
        const isClosed = closed.includes(g.region);
        return (
          <section key={g.region} className="group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
              <button type="button" className="label" style={{ border: 0, background: 'none', padding: 0, flex: 1, textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => toggle(g.region)} aria-expanded={!isClosed}>{isClosed ? '▸' : '▾'} {g.flag} {g.region} · {g.list.length}</button>
              {editC && <button type="button" className="link-btn" style={{ fontSize: 13, color: 'var(--danger)' }} onClick={() => askDel(`${g.region} entfernen?`) && removeCountry(g.region)}>Land entfernen</button>}
            </div>
            {!isClosed && (
              <div className="news-grid">
                {g.list.map((x) => {
                  const l = outletLink(x, cur);
                  return editC ? (
                    <button key={x.url} type="button" className="news-tile" style={{ border: 0, font: 'inherit', color: 'inherit', textAlign: 'left' }} onClick={() => askDel(`${x.name} entfernen?`) && removePaper(g.region, x.url)}>
                      <b>{x.name} ✕</b><span className="tiny">{host(x.url)}</span>
                    </button>
                  ) : (
                    <a key={x.url} href={l.url} target="_blank" rel="noreferrer" className="news-tile">
                      <b>{x.name}</b>
                      <span className="tiny">{l.direct ? (cur === 'start' ? host(x.url) : label) : `🔎 ${label}`}</span>
                    </a>
                  );
                })}
                {editC && <button type="button" className="news-tile" style={{ border: '1px dashed var(--chev)', font: 'inherit', color: 'var(--accent)' }} onClick={() => setPaper({ region: g.region, name: '', url: '' })}><b>+ Zeitung</b></button>}
              </div>
            )}
          </section>
        );
      })}
      {editC && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => confirm('Länder und Zeitungen auf den Standard zurücksetzen?') && resetCountries()}>Länder auf Standard zurücksetzen</button>}
      <EditList open={editRub} title="Rubriken" items={rubs.map((r) => ({ id: r.id, label: r.label, fixed: r.id === 'start' }))} onRemove={removeRubrik} onAdd={addRubrik} addPh="Neue Rubrik, z.B. Lateinamerika, Klima" onReset={resetRubriken} onClose={() => setEditRub(false)} />
      <CountrySheet open={addC} onClose={() => setAddC(false)} />
      <Sheet open={!!paper} title={paper ? `Zeitung in ${paper.region}` : ''} onClose={() => setPaper(null)}>
        {paper && (
          <>
            <label className="field"><span>Name</span><input className="input" value={paper.name} onChange={(e) => setPaper({ ...paper, name: e.target.value })} placeholder="z.B. El Cronista" /></label>
            <label className="field"><span>Link</span><input className="input" inputMode="url" value={paper.url} onChange={(e) => setPaper({ ...paper, url: e.target.value })} placeholder="cronista.com" /></label>
            <button type="button" className="btn" disabled={!paper.name.trim() || !paper.url.trim()} onClick={() => { const u = /^https?:\/\//.test(paper.url.trim()) ? paper.url.trim() : `https://${paper.url.trim()}`; addPaper(paper.region, { name: paper.name.trim(), url: u }); setPaper(null); }}>Hinzufügen</button>
          </>
        )}
      </Sheet>
    </>
  );
}

const typeOf = (id, s) => newsTypesOf(s || { profile: {} }).find((t) => t.id === id) || SOURCE_TYPES.find((t) => t.id === id);
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

function Sources({ s, type }) {
  const own = s.newsSources || [];
  const [topic, setTopicState] = useState(() => remember('life-app-src-topic', 'alle'));
  const setTopic = (v) => { setTopicState(v); save('life-app-src-topic', v); };
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', url: '', note: '', type: '', topics: [] });
  const [newTopic, setNewTopic] = useState('');
  const topics = topicsListOf(s);
  const [editTopics, setEditTopics] = useState(false);
  const fit = (x) => (type === 'alle' || x.type === type) && (topic === 'alle' || (x.topics || []).includes(topic));
  const ownUrls = new Set(own.map((x) => x.url));
  const mine = own.filter(fit);
  const sugg = CURATED.filter((x) => fit(x) && !ownUrls.has(x.url));
  const saveCurated = (x) => { addSource({ name: x.name, url: x.url, note: x.note, type: x.type, topics: x.topics }); toast(`${x.name} bei „Meine Quellen“`); };
  const submit = (e) => {
    e.preventDefault();
    const topicsSel = [...f.topics, ...(newTopic.trim() ? [newTopic.trim()] : [])];
    if (newTopic.trim() && !topics.includes(newTopic.trim())) setTopicsList([...topics, newTopic.trim()]);
    if (addSource({ ...f, type: f.type || type, topics: topicsSel })) toast('Quelle gespeichert');
    setF({ name: '', url: '', note: '', type: '', topics: [] });
    setNewTopic('');
    setAdding(false);
  };
  return (
    <>
      <div className="field">
        <span>Thema</span>
        <div className="box-tabs">
          <button type="button" className={topic === 'alle' ? 'chip on' : 'chip soft'} onClick={() => setTopic('alle')}>Alle</button>
          {topics.map((t) => <button key={t} type="button" className={topic === t ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTopic(t)}>{t}</button>)}
          <button type="button" className="chip soft" onClick={() => setEditTopics(true)} aria-label="Themen bearbeiten">✎</button>
        </div>
      </div>
      <EditList open={editTopics} title="Themen" items={topics.map((t) => ({ id: t, label: t }))} onRemove={(id) => { setTopicsList(topics.filter((x) => x !== id)); if (topic === id) setTopic('alle'); }} onAdd={(l) => !topics.includes(l) && setTopicsList([...topics, l])} addPh="Neues Thema, z.B. Lateinamerika" onClose={() => setEditTopics(false)} />

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
  const types = newsTypesOf(s);
  const [type, setTypeState] = useState(() => remember('life-app-news-type', 'zeitungen'));
  const setType = (v) => { setTypeState(v); save('life-app-news-type', v); };
  const cur = types.some((t) => t.id === type) ? type : types[0]?.id;
  const [editTypes, setEditTypes] = useState(false);
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereiche" label="Bereiche" />
          <h1 className="h1">Informiert bleiben</h1>
        </div>
        <div className="box-tabs main-tabs">
          {types.map((t) => <button key={t.id} type="button" className={cur === t.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setType(t.id)}>{t.emoji} {t.label}</button>)}
          <button type="button" className="chip soft" onClick={() => setEditTypes(true)} aria-label="Arten bearbeiten">✎</button>
        </div>
        {cur === 'zeitungen' ? <Outlets s={s} /> : cur ? <Sources key={cur} s={s} type={cur} /> : <div className="notice">Keine Arten – oben ✎.</div>}
      </main>
      <EditList open={editTypes} title="Was willst du sehen?" items={types.map((t) => ({ id: t.id, label: `${t.emoji} ${t.label}` }))} onRemove={removeNewsType} onAdd={addNewsType} addPh="Eigene Art, z.B. Reports, Konferenzen" onReset={resetNewsTypes} onClose={() => setEditTypes(false)} />
      <TabBar active="bereiche" />
    </>
  );
}
