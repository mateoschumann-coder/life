import { askDel } from '../lib/undo';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import { addSkill, addSkillTodos, ideaChat, removeSkill, removeSkillTodo, SKILL_PRESETS, skillTodoChat, todoStats, toggleSkillTodo, updateSkill, MAT_TYPES, matTypesOf, matTypeInfo, setMatTypes, addCustomType, addMaterialTo, updateMaterialOf, removeMaterialOf, matSearch } from '../lib/skills';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { Back, Check, Chevron, Icon, Info, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const BLUE = '#3B6FE0';

function Progress({ sk }) {
  const { done, all } = todoStats(sk);
  if (!all) return null;
  return <span className="funnel-bar" style={{ width: 70, flex: 'none' }}><span style={{ width: `${(done / all) * 100}%`, background: BLUE }} /></span>;
}

function SkillList({ s }) {
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const skills = s.skills || [];
  const missing = SKILL_PRESETS.filter((p) => !skills.some((x) => x.name === p.name));
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereiche" label="Bereiche" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Weiterentwicklung</h1>
            {skills.length > 0 && <button type="button" className={edit ? 'pill on' : 'link-btn'} onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Bearbeiten'}</button>}
          </div>
        </div>
        <div className="list">
          {skills.length === 0 && <div className="empty">Füg hinzu, was du lernen willst – z.B. Portugiesisch, Python. Pro Skill legst du konkrete Ziele als To-do-Liste fest (gern im Gespräch mit der KI).</div>}
          {skills.map((sk) => {
            const st = todoStats(sk);
            return (
              <div key={sk.id} className="row" style={{ minHeight: 64 }}>
                <a href={`#/skills/${sk.id}`} className="row-main">
                  <span className="row-title strong">{sk.name}</span>
                  <span className="row-meta">{st.all ? `${st.done} von ${st.all} erledigt${st.next ? ` · als Nächstes: ${st.next.text}` : ' · alles geschafft 🎉'}` : 'Noch keine Ziele – antippen und festlegen'}</span>
                </a>
                <Progress sk={sk} />
                {edit ? <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => askDel(`„${sk.name}“ entfernen?`) && removeSkill(sk.id)}>Entfernen</button> : <Chevron />}
              </div>
            );
          })}
        </div>
        <section className="card" style={{ gap: 10 }}>
          <span className="label" style={{ padding: 0 }}>Skill hinzufügen</span>
          {missing.length > 0 && <div className="chips">{missing.map((p) => <button key={p.name} type="button" className="chip soft" onClick={() => addSkill(p.name)}>+ {p.name}</button>)}</div>}
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); addSkill(text); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Eigenes, z.B. SQL oder Französisch" aria-label="Eigener Skill" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        </section>
        <PlanChat
          title="Was könnte ich noch lernen?"
          intro="Ich schaue, woran du schon arbeitest, und schlage vor, was gut dazu passt – neue Skills oder kleine Schritte. Ohne Internet, sehr günstig."
          history={chatOf(s, 'lernideen')}
          onSave={(h) => saveChatOf('lernideen', h)}
          onAsk={(hist) => ideaChat(s, hist)}
          prefKey="lernideen"
          hideToggles
          groups={[{ key: 'skills', label: 'Als Skill hinzufügen', title: (x) => x }, { key: 'aufgaben', label: 'Als Aufgabe', title: (x) => x.text }]}
          onApply={(sel) => {
            for (const x of sel.skills || []) addSkill(x);
            for (const x of sel.aufgaben || []) addTask({ title: x.text, areaId: 'entwicklung', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
          }}
          chips={['Was passt zu dem, was ich schon mache?', 'Wie verbinde ich Sprachen mit Hobbys?']}
        />
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

// v1.03 (Mateo): Material pro Skill – Arten frei wählbar (Bücher, Podcasts, Videos, Links, Dokumente, Songs …)
function MaterialSheet({ sk, m, onClose }) {
  const [f, setF] = useState(null);
  const [loaded, setLoaded] = useState(null);
  if (m && loaded !== m.id) { setLoaded(m.id); setF({ ...m }); }
  if (!m || !f) return <Sheet open={false} onClose={onClose} title="" />;
  const info = matTypeInfo(sk, m.type);
  return (
    <Sheet open title={`${info.emoji} ${info.one}`} onClose={() => { setLoaded(null); onClose(); }}>
      <label className="field"><span>Titel</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      {info.author && <label className="field"><span>{info.author}</span><input className="input" value={f.author || ''} onChange={(e) => setF({ ...f, author: e.target.value })} /></label>}
      <label className="field"><span>Link</span><input className="input" inputMode="url" value={f.url || ''} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></label>
      <label className="field"><span>{info.noteLabel || 'Notiz'}</span><textarea className="input" rows={info.noteLabel === 'Code / Notiz' ? 6 : 3} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} style={info.noteLabel === 'Code / Notiz' ? { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } : undefined} /></label>
      {info.status && <div className="field"><span>Stand</span><div className="chips">{info.status.map((l, i) => <button key={l} type="button" className={(f.stage || 0) === i ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, stage: i })}>{l}</button>)}</div></div>}
      <button type="button" className="btn" disabled={!f.title.trim()} onClick={() => { let url = String(f.url || '').trim(); if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`; updateMaterialOf(sk.id, m.id, { ...f, url }); toast('Gespeichert'); setLoaded(null); onClose(); }}>Speichern</button>
      <button type="button" className="btn danger" onClick={() => { if (askDel('Löschen?')) { removeMaterialOf(sk.id, m.id); setLoaded(null); onClose(); } }}>Löschen</button>
    </Sheet>
  );
}
function TypesSheet({ sk, open, onClose }) {
  const [txt, setTxt] = useState('');
  const cur = matTypesOf(sk);
  const all = [...Object.keys(MAT_TYPES), ...(sk.customTypes || []).map((x) => x.id)];
  return (
    <Sheet open={open} title="Was willst du speichern?" onClose={onClose}>
      <span className="tiny">Antippen = an/aus. Reihenfolge = wie du sie antippst.</span>
      <div className="chips">{all.map((t) => { const i = matTypeInfo(sk, t); const on = cur.includes(t); return <button key={t} type="button" className={on ? 'chip on' : 'chip soft'} onClick={() => setMatTypes(sk.id, on ? cur.filter((x) => x !== t) : [...cur, t])}>{i.emoji} {i.label}</button>; })}</div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (addCustomType(sk.id, txt)) setTxt(''); }}>
        <input className="input" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Eigene Art, z.B. Noten, Akkorde, Projekte" aria-label="Eigene Art" />
        <button type="submit" className="btn small" disabled={!txt.trim()}>+</button>
      </form>
      <button type="button" className="btn" onClick={onClose}>Fertig</button>
    </Sheet>
  );
}
function SkillMaterial({ sk }) {
  const types = matTypesOf(sk);
  const [type, setType] = useState(types[0]);
  const t = types.includes(type) ? type : types[0];
  const info = t ? matTypeInfo(sk, t) : null;
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [url, setUrl] = useState('');
  const [edit, setEdit] = useState(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const items = (sk.materials || []).filter((m) => m.type === t);
  const add = (e) => {
    e.preventDefault();
    let u = url.trim();
    if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
    addMaterialTo(sk.id, { type: t, title, author, url: u });
    setTitle(''); setAuthor(''); setUrl('');
  };
  const sorted = info?.status ? [...items].sort((a, b) => ((a.stage || 0) === 1 ? -1 : 0) - ((b.stage || 0) === 1 ? -1 : 0) || (a.stage || 0) - (b.stage || 0)) : items;
  return (
    <>
      <div className="box-tabs">
        {types.map((x) => { const i = matTypeInfo(sk, x); const n = (sk.materials || []).filter((m) => m.type === x).length; return <button key={x} type="button" className={t === x ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setType(x)}>{i.emoji} {i.label}{n ? ` · ${n}` : ''}</button>; })}
        <button type="button" className="chip soft" onClick={() => setTypesOpen(true)} aria-label="Arten bearbeiten">✎</button>
      </div>
      {!t && <div className="notice">Noch keine Arten gewählt – oben ✎.</div>}
      {t && (
        <>
          <form className="card" style={{ gap: 8 }} onSubmit={add}>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={info.ph} aria-label={`${info.one} hinzufügen`} />
            {title.trim() && (
              <>
                {info.author && <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={`${info.author} (optional)`} aria-label={info.author} />}
                <input className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" aria-label="Link" />
                <div className="chips">{matSearch(t, [title, author].filter(Boolean).join(' ')).map(([l, u]) => <a key={u} className="pill link-chip" href={u} target="_blank" rel="noreferrer">🔎 {l} ↗</a>)}</div>
              </>
            )}
            <button type="submit" className="btn small" style={{ alignSelf: 'flex-start' }} disabled={!title.trim()}>+ {info.one} speichern</button>
          </form>
          <div className="list">
            {sorted.length === 0 && <div className="empty">Noch keine {info.label}.</div>}
            {sorted.map((m) => (
              <div key={m.id} className="row compact">
                <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setEdit(m)}>
                  <span className={info.status && (m.stage || 0) === info.status.length - 1 ? 'row-title plain done' : 'row-title plain'}>{m.title}</span>
                  {(m.author || m.note) && <span className="row-meta">{[m.author, m.note && m.note.split('\n')[0].slice(0, 60)].filter(Boolean).join(' · ')}</span>}
                </button>
                {info.status && <button type="button" className={(m.stage || 0) === 1 ? 'pill on' : 'pill'} style={{ fontSize: 12.5, padding: '4px 9px' }} onClick={() => updateMaterialOf(sk.id, m.id, { stage: ((m.stage || 0) + 1) % info.status.length })}>{info.status[m.stage || 0]}</button>}
                {m.url && <a className="x-btn" href={m.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              </div>
            ))}
          </div>
          {t === 'dokument' && <Info>Dokumente speicherst du als Link (z.B. Google Drive, Notion, GitHub) – die App selbst kann keine Dateien aufbewahren.</Info>}
        </>
      )}
      <TypesSheet sk={sk} open={typesOpen} onClose={() => setTypesOpen(false)} />
      <MaterialSheet sk={sk} m={edit} onClose={() => setEdit(null)} />
    </>
  );
}

export function SkillPage({ s, sk, back = { href: '#/skills', label: 'Weiterentwicklung' } }) {
  const [tab, setTabState] = useState(() => { try { return localStorage.getItem('life-app-skill-tab') || 'todos'; } catch { return 'todos'; } });
  const setTab = (v) => { setTabState(v); try { localStorage.setItem('life-app-skill-tab', v); } catch {} };
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const todos = sk.todos || [];
  const open = todos.filter((x) => !x.done);
  const done = todos.filter((x) => x.done);
  const Row = ({ x }) => (
    <div className="row" style={{ minHeight: 48 }}>
      <Check on={x.done} color={BLUE} onClick={() => { toggleSkillTodo(sk.id, x.id); if (!x.done) toast('Erledigt'); }} label={x.text} />
      <span className="row-main"><span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span></span>
      <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => removeSkillTodo(sk.id, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
    </div>
  );
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href={back.href} label={back.label} />
          <h1 className="h1 sm">{sk.name}</h1>
        </div>

        <Segmented full options={[{ id: 'todos', label: `✅ To-dos${open.length ? ` · ${open.length}` : ''}` }, { id: 'material', label: `📚 Material${(sk.materials || []).length ? ` · ${(sk.materials || []).length}` : ''}` }]} value={tab} onChange={setTab} label="Ansicht" />
        {tab === 'material' ? <SkillMaterial sk={sk} /> : (<>
        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Was ich erreichen will</h2>{todos.length > 0 && <span className="tiny">{done.length} von {todos.length}</span>}</div>
          <div className="list">
            {open.length === 0 && <div className="empty">{todos.length ? 'Alles geschafft! 🎉 Neue Ziele unten im Chat oder direkt eintragen.' : 'Noch keine Ziele. Erzähl unten im Chat, was du erreichen willst – oder trag es direkt ein.'}</div>}
            {open.map((x) => <Row key={x.id} x={x} />)}
            <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addSkillTodos(sk.id, [text]); setText(''); }}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Neues Ziel" aria-label="Neues Ziel" />
              <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
            </form>
          </div>
          {done.length > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: '4px' }} onClick={() => setShowDone(!showDone)}>{showDone ? 'Erledigte ausblenden' : `Erledigte zeigen (${done.length})`}</button>}
          {showDone && <div className="list">{done.map((x) => <Row key={x.id} x={x} />)}</div>}
        </section>

        <PlanChat
          title="Ziele festlegen"
          intro={`Erzähl einfach, was du bei ${sk.name} können oder schaffen willst – ich mache daraus eine klare To-do-Liste. Ohne Internet, sehr günstig.`}
          history={chatOf(s, `skillziele:${sk.id}`)}
          onSave={(h) => saveChatOf(`skillziele:${sk.id}`, h)}
          onAsk={(hist) => skillTodoChat(s, sk, hist)}
          prefKey="skillziele"
          hideToggles
          placeholder="Was willst du erreichen?"
          groups={[{ key: 'todos', label: 'Auf meine Liste', title: (x) => x }]}
          onApply={(sel) => { const n = addSkillTodos(sk.id, sel.todos || []); if (n) toast(`${n} Ziele hinzugefügt`); }}
          chips={['Mach mir einen Lernpfad für die nächsten Wochen', 'Was wären die nächsten Schritte?']}
        />
        </>)}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Skills({ id }) {
  const s = useStore();
  if (!id) return <SkillList s={s} />;
  const sk = (s.skills || []).find((x) => x.id === id);
  return sk ? <SkillPage s={s} sk={sk} /> : <Missing />;
}
