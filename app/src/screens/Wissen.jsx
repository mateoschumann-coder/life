import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { fmtShort } from '../lib/dates';
import { addLibCat, addMaterial, addNote, deleteMaterial, ensureTopic, fillMaterial, findTopic, KINDS, libChat, linkFor, removeNote, updateNote, removeTopic, STATUS, structureNotes, summarizeMaterial, topicsOf, updateMaterial } from '../lib/library';
import { getAi } from '../lib/ai';
import { chatOf, saveChatOf } from '../lib/chats';
import { canDictate, useDictation } from '../lib/dictate';
import { tidyText } from '../lib/fieldtools';
import PlanChat from '../components/PlanChat';
import { Missing } from './Saeule';
import { LibCatsSheet } from './Bereich';
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

// v0.88: Text mit KI ordnen (mit Rückgängig) – für Notizen
function TidyPill({ value, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState(null);
  if (!getAi().apiKey) return null;
  if (prev !== null && value !== prev) {
    return <button type="button" className="pill" onClick={() => { onChange(prev); setPrev(null); }}>↶ Rückgängig</button>;
  }
  return (
    <button type="button" className="pill" disabled={disabled || busy || value.trim().length < 10} onClick={async () => {
      setBusy(true);
      try { const out = await tidyText(value, 'Notiz zu einem Buch'); if (out) { setPrev(value); onChange(out); } } catch (e) { toast(e.message); } finally { setBusy(false); }
    }}>{busy ? 'Ordne …' : '✨ Ordnen'}</button>
  );
}
function NoteItem({ m, n }) {
  const [edit, setEdit] = useState(null);
  const dict = useDictation(edit || '', (v) => setEdit(typeof v === 'function' ? v(edit || '') : v));
  if (edit === null) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <button type="button" onClick={() => setEdit(n.text)} style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', flex: 1, fontSize: 14, lineHeight: 1.4, color: 'var(--text)', whiteSpace: 'pre-wrap' }} aria-label="Notiz bearbeiten">{n.text.startsWith('•') ? n.text : `• ${n.text}`}</button>
        <button type="button" className="x-btn" aria-label="Notiz entfernen" onClick={() => removeNote(m.id, n.id)}><Icon name="x" size={11} color="var(--chev)" /></button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea className="input" rows={5} value={edit} onChange={(e) => setEdit(e.target.value)} aria-label="Notiz bearbeiten" autoFocus />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {canDictate && <button type="button" className={dict.on ? 'pill on' : 'pill'} onClick={dict.toggle}>{dict.on ? '■ Stopp' : '🎙'}</button>}
        <TidyPill value={edit} onChange={setEdit} />
        <span style={{ flex: 1 }} />
        <button type="button" className="pill" onClick={() => { dict.on && dict.toggle(); setEdit(null); }}>Abbrechen</button>
        <button type="button" className="btn small" onClick={() => { dict.on && dict.toggle(); updateNote(m.id, n.id, edit); setEdit(null); }}>Speichern</button>
      </div>
    </div>
  );
}

// v0.72: KI-Zusammenfassung + Notizen & Learnings am Buch
function MaterialExtras({ s, m }) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState('');
  const [openSum, setOpenSum] = useState(true);
  const dict = useDictation(note, setNote);
  const hasKey = !!getAi().apiKey;
  const run = async (what) => {
    setBusy(what);
    try { if (what === 'sum') await summarizeMaterial(s, m); else await structureNotes(s, m); } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setBusy(null); }
  };
  const sm = m.summary;
  const ln = m.learnings;
  const notes = m.notes || [];
  return (
    <>
      <div className="take-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 650, fontSize: 15, flex: 1 }}>✨ KI-Zusammenfassung (kurz)</span>
          {sm && <button type="button" className="pill" onClick={() => run('sum')} disabled={!!busy || !hasKey}>{busy === 'sum' ? '…' : '↻ Neu'}</button>}
          {sm && <button type="button" className="link-btn" style={{ fontSize: 12.5 }} onClick={() => setOpenSum(!openSum)}>{openSum ? 'Einklappen' : 'Zeigen'}</button>}
        </div>
        {!sm && <button type="button" className="btn small" onClick={() => run('sum')} disabled={!!busy || !hasKey}>{busy === 'sum' ? 'Ich fasse zusammen …' : 'Von der KI zusammenfassen lassen'}</button>}
        {sm && openSum && (
          <>
            {sm.unsicher && <span className="tiny" style={{ color: 'var(--danger)' }}>Die KI kennt das Werk nicht sicher – mit Vorsicht lesen.</span>}
            <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{sm.kern}</span>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.45 }}>{sm.punkte.map((x, i) => <li key={i}>{x}</li>)}</ul>
            {sm.fuerDich && <span className="tiny" style={{ color: 'var(--text)' }}>🎯 {sm.fuerDich}</span>}
          </>
        )}
        {!sm && <span className="tiny">Ohne Internet aus dem Wissen der KI (bei Artikeln/Videos mit Link liest sie die Seite), unter 0,1 Cent.</span>}
      </div>
      <div className="take-box">
        <span style={{ fontWeight: 650, fontSize: 15 }}>📝 Meine Notizen</span>
        <span className="tiny">Frei schreiben oder einsprechen – auch unsortiert. „✨ Ordnen“ räumt den Text auf, Notiz antippen = bearbeiten. Unten macht die KI daraus deine eigene Zusammenfassung.</span>
        {notes.map((n) => <NoteItem key={n.id} m={m} n={n} />)}
        <textarea className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gedanken, Zitate, was du mitnimmst …" aria-label="Neue Notiz" />
        <div style={{ display: 'flex', gap: 8 }}>
          {canDictate && <button type="button" className={dict.on ? 'pill on' : 'pill'} onClick={dict.toggle} aria-label="Einsprechen">{dict.on ? '■ Stopp' : '🎙 Einsprechen'}</button>}
          <TidyPill value={note} onChange={setNote} />
          <span style={{ flex: 1 }} />
          <button type="button" className="btn small" disabled={!note.trim()} onClick={() => { dict.on && dict.toggle(); addNote(m.id, note); setNote(''); }}>Speichern</button>
        </div>
        {notes.length > 0 && <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => run('learn')} disabled={!!busy || !hasKey}>{busy === 'learn' ? 'Ich fasse zusammen …' : ln ? '↻ Meine Zusammenfassung erneuern' : '✨ Daraus meine Zusammenfassung machen'}</button>}
        {ln && <span className="label" style={{ padding: 0, marginTop: 4 }}>Meine Zusammenfassung</span>}
        {ln && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            {ln.kernaussage && <span style={{ fontSize: 14.5, fontWeight: 600 }}>💡 {ln.kernaussage}</span>}
            {ln.themen.map((th, i) => (
              <div key={i}>
                <span className="label" style={{ padding: 0 }}>{th.titel}</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.4 }}>{th.punkte.map((x, j) => <li key={j}>{x}</li>)}</ul>
              </div>
            ))}
            {ln.anwenden?.length > 0 && <div><span className="label" style={{ padding: 0 }}>Umsetzen</span><ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14 }}>{ln.anwenden.map((x, j) => <li key={j}>{x}</li>)}</ul></div>}
          </div>
        )}
      </div>
    </>
  );
}

function MaterialSheet({ s, item, onClose, defaultTopic, cat }) {
  const isNew = item && !item.id;
  const blank = { title: '', kind: cat?.kind || 'buch', cat: cat?.id, subId: defaultTopic || topicsOf(s)[0]?.id || null, author: '', url: '', note: '', about: '' };
  const [f, setF] = useState(blank);
  const [newCat, setNewCat] = useState(null);
  const [newTopic, setNewTopic] = useState(null);
  const [filling, setFilling] = useState(false);
  const fill = async () => {
    setFilling(true);
    try {
      const r = await fillMaterial(s, f.title.trim(), KINDS[f.kind]?.label);
      const topic = r.thema ? (findTopic(s, r.thema)?.id || ensureTopic(r.thema)) : f.subId;
      setF((x) => ({ ...x, title: r.titel || x.title, author: x.author || r.autor || '', kind: KINDS[r.art] ? r.art : x.kind, subId: topic || x.subId, about: [r.kurz, r.jahr].filter(Boolean).join(' · ') }));
      toast(r.unsicher ? 'Nicht sicher erkannt – bitte prüfen' : 'Infos ergänzt');
    } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setFilling(false); }
  };
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
    if (m) updateMaterial(m.id, { title: f.title, kind: f.kind, subId: f.subId, author: f.author, url: f.url, note: f.note, cat: f.cat || m.cat, about: f.about || '' });
    else if (!addMaterial({ ...f, cat: f.cat || cat?.id })) return toast('Ist schon in deiner Liste');
    toast('Gespeichert');
    onClose();
  };
  return (
    <Sheet open={!!item} title={isNew ? 'Neues Material' : f.title || 'Material'} onClose={onClose}>
      <div className="field">
        <span>Titel</span>
        <div className="block-add">
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z.B. Sapiens" aria-label="Titel" />
          <button type="button" className="btn small" style={{ whiteSpace: 'nowrap' }} disabled={!f.title.trim() || filling || !getAi().apiKey} onClick={fill}>{filling ? '…' : '✨ Ausfüllen'}</button>
        </div>
        {f.about && <span className="tiny" style={{ color: 'var(--text)' }}>{f.about}</span>}
      </div>
      <div className="field">
        <span>Kategorie</span>
        <div className="chips">
          {s.libCats.map((c) => <button key={c.id} type="button" className={(f.cat || cat?.id) === c.id ? 'chip on' : 'chip'} onClick={() => setF({ ...f, cat: c.id })}>{c.name}</button>)}
          {newCat === null && <button type="button" className="chip soft" onClick={() => setNewCat('')}>+ Neue Kategorie</button>}
        </div>
        {newCat !== null && <div className="block-add"><input className="input" autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="z.B. Hörbücher" aria-label="Neue Kategorie" /><button type="button" className="btn small" onClick={() => { const id = newCat.trim() && addLibCat(newCat, ''); if (id) setF({ ...f, cat: id }); setNewCat(null); }}>{newCat.trim() ? '+' : '✕'}</button></div>}
      </div>
      <div className="field">
        <span>Art</span>
        <div className="chips">{Object.entries(KINDS).map(([k, v]) => <button key={k} type="button" className={f.kind === k ? 'chip on' : 'chip'} onClick={() => setF({ ...f, kind: k })}>{v.label}</button>)}</div>
      </div>
      <div className="field">
        <span>Thema</span>
        <div className="chips">
          {topicsOf(s).map((t) => <button key={t.id} type="button" className={f.subId === t.id ? 'chip on' : 'chip'} onClick={() => setF({ ...f, subId: t.id })}>{t.name}</button>)}
          {newTopic === null && <button type="button" className="chip soft" onClick={() => setNewTopic('')}>+ Neues Thema</button>}
        </div>
        {newTopic !== null && <div className="block-add"><input className="input" autoFocus value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="z.B. Psychologie" aria-label="Neues Thema" /><button type="button" className="btn small" onClick={() => { const id = newTopic.trim() && ensureTopic(newTopic); if (id) setF({ ...f, subId: id }); setNewTopic(null); }}>{newTopic.trim() ? '+' : '✕'}</button></div>}
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
      {m && <MaterialExtras s={s} m={m} />}
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
  const [catSheet, setCatSheet] = useState(false);
  const mine = s.library.filter((m) => m.cat === cat.id);
  const inTopic = mine.filter((m) => !topic || m.subId === topic);
  const list = inTopic.filter((m) => m.status === status);
  const active = mine.filter((m) => m.status === 'aktiv');
  const count = (st) => inTopic.filter((m) => m.status === st).length;

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/persoenlich" label="Persönlich" />
          <span className="tiny">Lernen & Wissen</span>
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">{cat.name}</h1>
            <button type="button" className="btn small" onClick={() => setSheet({ subId: topic })}>+ {cat.kind ? KINDS[cat.kind].label : 'Material'}</button>
          </div>
        </div>
        <div className="chips">
          {s.libCats.map((c) => <a key={c.id} href={`#/wissen/${c.id}`} className={c.id === cat.id ? 'chip on' : 'chip'}>{c.name}</a>)}
          <button type="button" className="chip" onClick={() => setCatSheet(true)} aria-label="Kategorien bearbeiten"><Icon name="edit" size={14} /></button>
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
          <button type="button" className={edit ? 'chip on' : 'chip'} onClick={() => setEdit(!edit)} aria-label="Themen bearbeiten">{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
        </div>
        {edit && (
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); ensureTopic(topicText); setTopicText(''); }}>
            <input className="input" value={topicText} onChange={(e) => setTopicText(e.target.value)} placeholder="Neues Thema, z.B. Psychologie" aria-label="Neues Thema" />
            <button type="submit" className="btn small" disabled={!topicText.trim()}>+</button>
          </form>
        )}

        <Segmented full options={Object.entries(STATUS).map(([id, label]) => ({ id, label: `${label} (${count(id)})` }))} value={status} onChange={setStatus} label="Status" />
        <div className="list">
          {list.length === 0 && <div className="empty">{status === 'will' ? 'Noch nichts auf der Liste. Füg etwas hinzu oder frag unten im Chat nach Empfehlungen.' : status === 'aktiv' ? 'Gerade nichts angefangen.' : 'Noch nichts abgeschlossen.'}</div>}
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
      <LibCatsSheet s={s} open={catSheet} onClose={() => setCatSheet(false)} />
      <MaterialSheet s={s} item={sheet} defaultTopic={topic} cat={cat} onClose={() => setSheet(null)} />
      <TabBar active="bereiche" />
    </>
  );
}
