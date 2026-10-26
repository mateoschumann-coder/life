import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { fmtShort } from '../lib/dates';
import { addMaterial, deleteMaterial, ensureTopic, KINDS, libChat, linkFor, recommend, removeTopic, STATUS, topicsOf, updateMaterial } from '../lib/library';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { Missing } from './Saeule';
import { getAi } from '../lib/ai';
import { Back, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

const COLOR = '#2FA36B';

function Stars({ value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)} aria-label={`${n} Sterne`} style={{ border: 0, background: 'none', padding: 0, fontSize: 24, color: n <= value ? '#F5B225' : 'var(--line)' }}>★</button>
      ))}
    </span>
  );
}

function MaterialSheet({ s, item, onClose, defaultTopic, cat }) {
  const isNew = item && !item.id;
  const blank = { title: '', kind: cat?.kind || 'buch', cat: cat?.id, subId: defaultTopic || topicsOf(s)[0]?.id || null, author: '', url: '', note: '' };
  const [f, setF] = useState(blank);
  const [loaded, setLoaded] = useState(null);
  const key = item ? item.id || 'neu' : null;
  useEffect(() => {
    if (key && key !== loaded) {
      setLoaded(key);
      setF(item.id ? { ...blank, ...item } : { ...blank, ...item });
    }
    if (!key) setLoaded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const m = item?.id ? s.library.find((x) => x.id === item.id) : null;
  const save = () => {
    if (m) updateMaterial(m.id, { title: f.title, kind: f.kind, subId: f.subId, author: f.author, url: f.url, note: f.note });
    else if (!addMaterial({ ...f, cat: cat?.id })) return toast('Ist schon in deiner Liste');
    toast('Gespeichert');
    onClose();
  };
  return (
    <Sheet open={!!item} title={isNew ? 'Neues Material' : f.title || 'Material'} onClose={onClose}>
      <Field label="Titel"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z.B. Sapiens" /></Field>
      <div className="field">
        <span>Art</span>
        <div className="chips">{Object.entries(KINDS).map(([k, v]) => <button key={k} type="button" className={f.kind === k ? 'chip on' : 'chip'} onClick={() => setF({ ...f, kind: k })}>{v.label}</button>)}</div>
      </div>
      <div className="field">
        <span>Thema</span>
        <div className="chips">{topicsOf(s).map((t) => <button key={t.id} type="button" className={f.subId === t.id ? 'chip on' : 'chip'} onClick={() => setF({ ...f, subId: t.id })}>{t.name}</button>)}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Autor / Quelle"><input className="input" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></Field>
        <Field label="Link"><input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
      </div>
      {m && (
        <>
          <Segmented full options={Object.entries(STATUS).map(([id, label]) => ({ id, label }))} value={m.status} onChange={(v) => updateMaterial(m.id, { status: v })} label="Status" />
          {m.status === 'fertig' && <div className="field"><span>Wie war es?</span><Stars value={m.rating || 0} onChange={(v) => updateMaterial(m.id, { rating: v })} /></div>}
        </>
      )}
      <Field label={m?.status === 'fertig' ? 'Was hast du mitgenommen?' : 'Notiz'}><textarea className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={m?.status === 'fertig' ? 'Die 2–3 wichtigsten Gedanken …' : 'Warum interessiert es dich?'} /></Field>
      <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
      {m && <button type="button" className="btn danger" onClick={() => { if (confirm('Löschen?')) { deleteMaterial(m.id); onClose(); } }}>Löschen</button>}
    </Sheet>
  );
}

export default function Wissen({ catId }) {
  const s = useStore();
  const cat = s.libCats.find((c) => c.id === catId) || (!catId ? s.libCats[0] : null);
  if (!cat) return <Missing />;
  return <CategoryPage s={s} cat={cat} />;
}

const CHAT_GROUPS = [{ key: 'empfehlungen', label: 'Auf die Liste setzen', title: (x) => x.titel, meta: (x) => [KINDS[x.art]?.label, x.autor, x.warum].filter(Boolean).join(' · ') }];

function CategoryPage({ s, cat }) {
  const topics = topicsOf(s);
  const [topic, setTopic] = useState(null);
  const [status, setStatus] = useState('will');
  const [sheet, setSheet] = useState(null);
  const [edit, setEdit] = useState(false);
  const [topicText, setTopicText] = useState('');
  const [wish, setWish] = useState('');
  const [recos, setRecos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const current = topics.find((t) => t.id === topic);
  const mine = s.library.filter((m) => m.cat === cat.id);
  const inTopic = mine.filter((m) => !topic || m.subId === topic);
  const list = inTopic.filter((m) => m.status === status);
  const active = mine.filter((m) => m.status === 'aktiv');
  const count = (st) => inTopic.filter((m) => m.status === st).length;

  const ask = async (web) => {
    const name = current?.name || topics.map((t) => t.name).join(', ') || 'Allgemeinbildung';
    setBusy(web ? 'web' : 'ki');
    setErr(null);
    try {
      setRecos(await recommend(s, name, wish.trim(), { web, cat }));
      setWish('');
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const keep = (r) => {
    const subId = topic || topics[0]?.id || ensureTopic('Allgemein');
    if (addMaterial({ ...r, subId, cat: cat.id })) toast('Auf deiner Liste');
    setRecos(recos.filter((x) => x.id !== r.id));
  };

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/mental" label="Lernen & Wissen" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">{cat.name}</h1>
            <button type="button" className="btn small" onClick={() => setSheet({ subId: topic })}>+ {cat.kind ? KINDS[cat.kind].label : 'Material'}</button>
          </div>
        </div>

        {active.length > 0 && (
          <section className="card countdown" style={{ gap: 6 }}>
            <span className="tiny">Gerade dabei</span>
            {active.map((m) => (
              <button key={m.id} type="button" className="lib-active" onClick={() => setSheet(m)}>
                <Icon name={KINDS[m.kind].icon} size={16} color={COLOR} />
                <span style={{ flex: 1, textAlign: 'left' }}><b>{m.title}</b>{m.author && <span className="tiny"> · {m.author}</span>}</span>
                <span className="pill" onClick={(e) => { e.stopPropagation(); updateMaterial(m.id, { status: 'fertig' }); setSheet(m); toast('Glückwunsch! Wie war es?'); }}>Fertig</span>
              </button>
            ))}
          </section>
        )}

        <div className="chips">
          <button type="button" className={!topic ? 'chip on' : 'chip'} onClick={() => setTopic(null)}>Alle Themen</button>
          {topics.map((t) => (
            <button key={t.id} type="button" className={edit ? 'chip editing' : topic === t.id ? 'chip on' : 'chip'} onClick={() => (edit ? confirm(`Thema „${t.name}“ entfernen? Das Material bleibt erhalten.`) && removeTopic(t.id) : setTopic(t.id))}>
              {t.name}{edit && <Icon name="x" size={11} />}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setEdit(!edit)} aria-label="Themen bearbeiten">{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
        </div>
        {edit && (
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); ensureTopic(topicText); setTopicText(''); }}>
            <input className="input" value={topicText} onChange={(e) => setTopicText(e.target.value)} placeholder="Neues Thema, z.B. Psychologie" aria-label="Neues Thema" />
            <button type="submit" className="btn small" disabled={!topicText.trim()}>+</button>
          </form>
        )}

        <Segmented full options={Object.entries(STATUS).map(([id, label]) => ({ id, label: `${label} (${count(id)})` }))} value={status} onChange={setStatus} label="Status" />
        <div className="list">
          {list.length === 0 && <div className="empty">{status === 'will' ? 'Noch nichts auf der Liste. Füg etwas hinzu oder lass dir unten etwas empfehlen.' : status === 'aktiv' ? 'Gerade nichts angefangen.' : 'Noch nichts abgeschlossen.'}</div>}
          {list.map((m) => (
            <div key={m.id} className="row" style={{ minHeight: 62 }}>
              <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR }}><Icon name={KINDS[m.kind].icon} size={16} /></span>
              <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setSheet(m)}>
                <span className="row-title plain">{m.title}</span>
                <span className="row-meta">{[KINDS[m.kind].label, m.author, !topic && topics.find((t) => t.id === m.subId)?.name, m.status === 'fertig' && m.rating ? '★'.repeat(m.rating) : null, m.status === 'fertig' && m.finishedAt && fmtShort(m.finishedAt)].filter(Boolean).join(' · ')}</span>
              </button>
              {m.status === 'will' && <button type="button" className="pill" onClick={() => { updateMaterial(m.id, { status: 'aktiv' }); toast('Viel Spaß!'); }}>Starten</button>}
              {m.url && <a className="x-btn" href={m.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
            </div>
          ))}
        </div>

        <section className="card checkin" style={{ gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span>
            Empfehlungen{current ? `: ${current.name}` : ''}
          </span>
          <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder={cat.kind === 'podcast' ? 'z.B. „Podcast über Geopolitik, 30 Min Folgen“' : current ? `Wunsch, z.B. „Einstieg, eher kurz“` : 'z.B. „Gutes Buch über Kalten Krieg“'} aria-label="Wunsch" />
          <div className="search-row">
            <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !hasKey} onClick={() => ask(false)}>{busy === 'ki' ? '…' : 'Ohne Internet'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !hasKey} onClick={() => ask(true)}>{busy === 'web' ? '…' : '🔍 Mit Internet'}</button>
          </div>
          <span className="tiny">Ohne Internet: aus dem KI-Wissen (günstig, Such-Link zum Titel). Mit Internet: aktuell und mit echten Links (ca. 2–3 Cent).</span>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche im Internet …' : 'Ich überlege …'}</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && recos && recos.map((r) => (
            <div key={r.id} className="option" style={{ alignItems: 'center' }}>
              <Icon name={KINDS[r.kind].icon} size={17} color={COLOR} />
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{r.title}</span>
                <span className="tiny">{[KINDS[r.kind].label, r.author].filter(Boolean).join(' · ')}</span>
                {r.why && <span className="tiny" style={{ color: 'var(--text)' }}>{r.why}</span>}
              </span>
              {r.url && <a className="x-btn" href={r.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              <button type="button" className="pill on" onClick={() => keep(r)}>Merken</button>
            </div>
          ))}
          {!busy && recos && recos.length === 0 && <span className="sub">Alles gemerkt oder nichts gefunden – frag gern nochmal.</span>}
        </section>

        <PlanChat
          title={`Chat: ${cat.name}`}
          intro={cat.kind === 'podcast' ? 'Erzähl, was dich interessiert oder was du zuletzt gehört hast – ich schlage passende Podcasts und Folgen vor.' : 'Frag nach Empfehlungen, lass dir etwas einordnen oder erzähl, was du gerade liest – ich helfe dir dranzubleiben.'}
          history={chatOf(s, `wissen:${cat.id}`)}
          onSave={(h) => saveChatOf(`wissen:${cat.id}`, h)}
          onAsk={(hist, o) => libChat(s, cat, hist, o)}
          prefKey="wissen"
          groups={CHAT_GROUPS}
          onApply={(sel) => { for (const r of sel.empfehlungen || []) addMaterial({ title: r.titel, kind: KINDS[r.art] ? r.art : cat.kind || 'buch', author: r.autor || '', why: r.warum || '', url: r.url || linkFor(r.titel, r.autor, KINDS[r.art] ? r.art : cat.kind), subId: topic || topics[0]?.id || null, cat: cat.id }); }}
          chips={cat.kind === 'podcast' ? ['Neue Podcasts für mich', 'Gute Folgen zu meinen Themen', 'Etwas für die nächste Laufrunde'] : ['Was sollte ich als Nächstes lesen?', 'Ein Einstieg in ein neues Thema', 'Fass mir ein Buch kurz zusammen']}
        />
      </main>
      <MaterialSheet s={s} item={sheet} defaultTopic={topic} cat={cat} onClose={() => setSheet(null)} />
      <TabBar active="bereiche" />
    </>
  );
}
