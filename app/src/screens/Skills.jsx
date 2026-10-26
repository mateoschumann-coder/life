import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import {
  addSkill, ARTEN, ideaChat, lastDays, loadImpulses, makeImpulses, markImpulse, practicedToday, removeSkill, saveImpulses, SKILL_PRESETS, skillChat, streak, togglePractice, updateSkill,
} from '../lib/skills';
import { chatOf, saveChatOf } from '../lib/chats';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import PlanChat from '../components/PlanChat';
import { Back, Check, Chevron, Icon, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const BLUE = '#3B6FE0';
const ART_ICON = { gespraech: 'mic', video: 'play', podcast: 'speaker', uebung: 'check', lesen: 'book', projekt: 'sparkle' };
const START_KEY = 'life-skill-start';

function Dots({ sk }) {
  return <span className="week-dots" aria-label="Letzte 7 Tage">{lastDays(sk).map((x) => <i key={x.d} className={x.on ? 'on' : ''} />)}</span>;
}

// Ein Impuls: Video/Podcast öffnen, Gespräch starten, erledigt abhaken
export function ImpulseRow({ s, x, onDone }) {
  const sk = (s.skills || []).find((y) => y.id === x.skillId);
  if (!sk) return null;
  const done = () => {
    if (!practicedToday(sk)) togglePractice(sk.id);
    onDone(x.id);
    toast(`Stark – ${sk.name} heute erledigt`);
  };
  const talk = () => {
    try {
      sessionStorage.setItem(START_KEY, JSON.stringify({ skillId: sk.id, text: x.start || x.title }));
    } catch {}
    go(`/skills/${sk.id}`);
  };
  return (
    <div className="option" style={{ alignItems: 'center', opacity: x.done ? 0.55 : 1 }}>
      <Icon name={ART_ICON[x.art] || 'check'} size={16} color={BLUE} />
      <span className="row-main">
        <span style={{ fontSize: 15, fontWeight: 600 }}>{x.title}</span>
        <span className="tiny">{[sk.name, ARTEN[x.art], x.minutes && `${x.minutes} Min`, x.text].filter(Boolean).join(' · ')}</span>
      </span>
      {!x.done && x.art === 'gespraech' && <button type="button" className="pill on" onClick={talk}>Loslegen</button>}
      {!x.done && x.url && <a className="pill" href={x.url} target="_blank" rel="noreferrer">Öffnen</a>}
      {!x.done ? <button type="button" className="pill" onClick={done} aria-label="Erledigt">✓</button> : <span className="tiny">✓</span>}
    </div>
  );
}

// Tages-Impulse (auch auf „Heute“): einmal am Tag automatisch, ohne Internet (unter 0,5 Cent)
export function useImpulses(s) {
  const [v, setV] = useState(loadImpulses);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const refresh = async () => {
    setBusy(true);
    setErr(null);
    try {
      setV(await makeImpulses(s));
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const has = (s.skills || []).length > 0;
  useEffect(() => {
    if (has && getAi().apiKey && getAi().autoCoach !== false && (!v || v.date !== today()) && !busy) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has]);
  const done = (id) => setV(markImpulse(id));
  const items = v?.date === today() ? v.items.filter((x) => (s.skills || []).some((y) => y.id === x.skillId)) : [];
  return { items, busy, err, refresh, done };
}

function SkillList({ s }) {
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const imp = useImpulses(s);
  const skills = s.skills || [];
  const missing = SKILL_PRESETS.filter((p) => !skills.some((x) => x.name === p.name));
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/professionell" label="Professionell" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Weiterentwicklung</h1>
            {skills.length > 0 && <button type="button" className="link-btn" onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Bearbeiten'}</button>}
          </div>
        </div>
        {skills.length > 0 && (
          <section className="card checkin" style={{ gap: 10 }}>
            <div className="sec-h" style={{ padding: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}><span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> Heute</span>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={imp.refresh} disabled={imp.busy || !getAi().apiKey} aria-label="Neue Impulse"><Icon name="refresh" size={15} /></button>
            </div>
            {imp.busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich überlege dir kleine Impulse …</span></div>}
            {imp.err && <span className="sub" style={{ color: 'var(--danger)' }}>{imp.err}</span>}
            {!imp.busy && imp.items.map((x) => <ImpulseRow key={x.id} s={s} x={x} onDone={imp.done} />)}
            {!imp.busy && !imp.items.length && !imp.err && <span className="sub">Tippe auf den Pfeil für die Impulse von heute.</span>}
          </section>
        )}
        <div className="list">
          {skills.length === 0 && <div className="empty">Füg hinzu, woran du jeden Tag ein bisschen arbeiten willst – z.B. Portugiesisch, Italienisch, Python. Du bekommst jeden Tag kleine Impulse, und bei Sprachen kannst du direkt mit der KI sprechen.</div>}
          {skills.map((sk) => (
            <div key={sk.id} className="row" style={{ minHeight: 64 }}>
              <Check on={practicedToday(sk)} color={BLUE} onClick={() => togglePractice(sk.id)} label={`${sk.name} heute dran gewesen`} />
              <a href={`#/skills/${sk.id}`} className="row-main">
                <span className="row-title strong">{sk.name}</span>
                <span className="row-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dots sk={sk} />{streak(sk) > 1 ? `${streak(sk)} Tage in Folge` : sk.level || ''}</span>
              </a>
              {edit ? <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`„${sk.name}“ entfernen?`) && removeSkill(sk.id)}>Entfernen</button> : <Chevron />}
            </div>
          ))}
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
          title="Was könnte ich noch machen?"
          intro="Ich schaue, woran du schon arbeitest, und schlage vor, was gut dazu passt – neue Skills oder kleine Schritte. Ohne Internet, sehr günstig."
          history={chatOf(s, 'lernideen')}
          onSave={(h) => saveChatOf('lernideen', h)}
          onAsk={(hist, o) => ideaChat(s, hist, o)}
          prefKey="lernideen"
          hideToggles
          groups={[{ key: 'skills', label: 'Als Skill hinzufügen', title: (x) => x }, { key: 'aufgaben', label: 'Als Aufgabe', title: (x) => x.text }]}
          onApply={(sel) => {
            for (const x of sel.skills || []) addSkill(x);
            for (const x of sel.aufgaben || []) addTask({ title: x.text, areaId: 'entwicklung', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
          }}
          chips={['Was passt zu dem, was ich schon mache?', 'Etwas Neues für 10 Min am Tag', 'Wie verbinde ich Sprachen mit Hobbys?']}
        />
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

function SkillPage({ s, sk }) {
  const lang = sk.kind === 'sprache' ? sk.lang || 'de-DE' : 'de-DE';
  const [start] = useState(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(START_KEY) || 'null');
      if (v?.skillId === sk.id) { sessionStorage.removeItem(START_KEY); return v.text; }
    } catch {}
    return null;
  });
  const [ideas, setIdeas] = useState(null);
  const [busy, setBusy] = useState(false);
  const more = async () => {
    setBusy(true);
    try {
      setIdeas(await makeImpulses(s, sk.id));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const isLang = sk.kind === 'sprache';
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/skills" label="Täglich dranbleiben" />
          <h1 className="h1 sm">{sk.name}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input goal-input" defaultValue={sk.level} key={sk.id + 'l'} placeholder="Niveau, z.B. A2 / Anfänger" onBlur={(e) => e.target.value !== sk.level && updateSkill(sk.id, { level: e.target.value })} aria-label="Niveau" />
            <input className="input goal-input" defaultValue={sk.goal} key={sk.id + 'g'} placeholder="Ziel, z.B. im Urlaub plaudern" onBlur={(e) => e.target.value !== sk.goal && updateSkill(sk.id, { goal: e.target.value })} aria-label="Ziel" />
          </div>
        </div>
        <section className="card" style={{ gap: 8 }}>
          <div className="stat-row">
            <div><span className="tiny">Serie</span><b>{streak(sk)} Tage</b></div>
            <div><span className="tiny">Letzte 7 Tage</span><b>{lastDays(sk).filter((x) => x.on).length}×</b></div>
            <div><span className="tiny">Gesamt</span><b>{(sk.log || []).length}×</b></div>
          </div>
          <Dots sk={sk} />
          <button type="button" className={practicedToday(sk) ? 'btn tint small' : 'btn small'} onClick={() => togglePractice(sk.id)}>{practicedToday(sk) ? '✓ Heute dran gewesen' : 'Heute dran gewesen'}</button>
        </section>

        <PlanChat
          title={isLang ? `Sprechen auf ${sk.name}` : `Tutor: ${sk.name}`}
          intro={isLang ? `Tippe aufs Mikrofon und sprich ${sk.name} – ich antworte in der Sprache, halte das Gespräch am Laufen und korrigiere dich kurz auf Deutsch. Mit dem Lautsprecher liest das iPhone die Antwort vor.` : 'Frag mich, lass dir etwas erklären oder dir eine kleine Übung geben.'}
          history={chatOf(s, `skill:${sk.id}`)}
          onSave={(h) => { saveChatOf(`skill:${sk.id}`, h); if (h.length && h[h.length - 1].role === 'assistant' && !practicedToday(sk)) togglePractice(sk.id); }}
          onAsk={(hist, o) => skillChat(s, sk, hist, o)}
          prefKey={isLang ? 'sprache' : 'tech'}
          lang={lang}
          autoSend={start}
          hideToggles={isLang}
          placeholder={isLang ? 'Sprich oder schreib …' : 'Frag oder schreib …'}
          groups={[{ key: 'uebungen', label: 'Als Aufgabe für die nächsten Tage', title: (x) => x.titel }]}
          onApply={(sel) => (sel.uebungen || []).forEach((x, i) => addTask({ title: `${sk.name}: ${x.titel}`, areaId: 'entwicklung', due: addDays(today(), i), url: x.suchbegriff ? `https://www.youtube.com/results?search_query=${encodeURIComponent(x.suchbegriff)}` : null }))}
          chips={isLang ? (sk.lang === 'pt-BR' ? ['Oi! Vamos conversar um pouco?', 'Quero praticar para uma viagem', 'Erklär mir eine Grammatik-Regel'] : sk.lang === 'it-IT' ? ['Ciao! Parliamo un po’?', 'Voglio parlare del mio weekend', 'Erklär mir eine Grammatik-Regel'] : ['Lass uns plaudern', 'Erklär mir eine Grammatik-Regel']) : ['Gib mir eine kleine Übung', 'Erklär mir ein Konzept', 'Idee für ein Mini-Projekt']}
        />

        <section className="card" style={{ gap: 10 }}>
          <div className="sec-h" style={{ padding: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Mehr Ideen</span>
            <button type="button" className="btn tint small" onClick={more} disabled={busy || !getAi().apiKey}>{busy ? '…' : '3 Ideen'}</button>
          </div>
          {ideas && ideas.map((x) => <ImpulseRow key={x.id} s={s} x={x} onDone={(id) => setIdeas(ideas.map((y) => (y.id === id ? { ...y, done: true } : y)))} />)}
          {!ideas && <span className="tiny">Videos, Podcasts und Übungen passend zu deinem Niveau – ohne Internet-Suche (YouTube-Suchlinks), daher sehr günstig.</span>}
        </section>
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
export { saveImpulses };
