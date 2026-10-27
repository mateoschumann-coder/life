import { useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import { addSkill, addSkillTodos, ideaChat, removeSkill, removeSkillTodo, SKILL_PRESETS, skillTodoChat, todoStats, toggleSkillTodo, updateSkill } from '../lib/skills';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { Back, Check, Chevron, Icon, TabBar, toast } from '../components/ui';
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
          <Back href="#/saeule/professionell" label="Professionell" />
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
                {edit ? <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`„${sk.name}“ entfernen?`) && removeSkill(sk.id)}>Entfernen</button> : <Chevron />}
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

function SkillPage({ s, sk }) {
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
          <Back href="#/skills" label="Weiterentwicklung" />
          <h1 className="h1 sm">{sk.name}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input goal-input" defaultValue={sk.level} key={sk.id + 'l'} placeholder="Niveau, z.B. A2 / Anfänger" onBlur={(e) => e.target.value !== sk.level && updateSkill(sk.id, { level: e.target.value })} aria-label="Niveau" />
            <input className="input goal-input" defaultValue={sk.goal} key={sk.id + 'g'} placeholder="Großes Ziel, z.B. im Urlaub plaudern" onBlur={(e) => e.target.value !== sk.goal && updateSkill(sk.id, { goal: e.target.value })} aria-label="Ziel" />
          </div>
        </div>

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
