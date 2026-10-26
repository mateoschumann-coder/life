import { useState } from 'react';
import { useStore } from '../lib/store';
import { addHobby, addHobbyItem, HOBBY_KINDS, hobbyChat, hobbyIdeas, searchLink, removeHobby, removeHobbyItem, updateHobby, updateHobbyItem } from '../lib/leisure';
import { getAi } from '../lib/ai';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { Back, Chevron, Icon, Segmented, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const COLOR = '#2FA36B';
const KIND_ICON = { idee: 'sparkle', song: 'mic', video: 'play', buch: 'book', uebung: 'check', link: 'link' };
const PRESETS = ['Gitarre', 'Schach', 'Fotografie', 'Kochen', 'Zeichnen', 'Klavier'];

function HobbyList({ s }) {
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const missing = PRESETS.filter((p) => !s.hobbies.some((h) => h.name === p));
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/freizeit" label="Freizeit und Erlebnisse" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Hobbys</h1>
            {s.hobbies.length > 0 && <button type="button" className="link-btn" onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Bearbeiten'}</button>}
          </div>
        </div>
        {s.hobbies.length === 0 && <div className="notice">Füg deine Hobbys hinzu. Zu jedem bekommst du Ideen: neue Songs, Videos, Bücher, Übungen – passend zu deinem Niveau.</div>}
        <div className="list">
          {s.hobbies.map((h) => {
            const open = h.items.filter((x) => x.status !== 'geschafft').length;
            const doneN = h.items.filter((x) => x.status === 'geschafft').length;
            return (
              <div key={h.id} className="row" style={{ minHeight: 62 }}>
                <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR }}><Icon name="sparkle" size={16} /></span>
                <a href={`#/hobbys/${h.id}`} className="row-main">
                  <span className="row-title strong">{h.name}</span>
                  <span className="row-meta">{[h.level, `${open} offen`, doneN && `${doneN} geschafft`].filter(Boolean).join(' · ')}</span>
                </a>
                {edit ? <button type="button" className="pill" style={{ color: 'var(--danger)' }} onClick={() => confirm(`„${h.name}“ entfernen?`) && removeHobby(h.id)}>Entfernen</button> : <Chevron />}
              </div>
            );
          })}
        </div>
        <section className="card" style={{ gap: 10 }}>
          <span className="label" style={{ padding: 0 }}>Hobby hinzufügen</span>
          {missing.length > 0 && <div className="chips">{missing.map((p) => <button key={p} type="button" className="chip soft" onClick={() => addHobby(p)}>+ {p}</button>)}</div>}
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); addHobby(text); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Eigenes, z.B. Surfen" aria-label="Eigenes Hobby" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        </section>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

function HobbyDetail({ s, h }) {
  const [tab, setTab] = useState('offen');
  const [text, setText] = useState('');
  const [kind, setKind] = useState('idee');
  const [wish, setWish] = useState('');
  const [ideas, setIdeas] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const list = h.items.filter((x) => (tab === 'geschafft' ? x.status === 'geschafft' : x.status !== 'geschafft'));
  const ask = async (web) => {
    setBusy(web ? 'web' : 'ki');
    setErr(null);
    try {
      setIdeas(await hobbyIdeas(s, h.id, wish.trim(), { web }));
      setWish('');
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/hobbys" label="Hobbys" />
          <h1 className="h1 sm">{h.name}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input goal-input" defaultValue={h.level} key={h.id + 'l'} placeholder="Niveau, z.B. Anfänger" onBlur={(e) => e.target.value !== h.level && updateHobby(h.id, { level: e.target.value })} aria-label="Niveau" />
            <input className="input goal-input" defaultValue={h.goal} key={h.id + 'g'} placeholder="Ziel/Geschmack, z.B. Rock & Latino" onBlur={(e) => e.target.value !== h.goal && updateHobby(h.id, { goal: e.target.value })} aria-label="Ziel" />
          </div>
        </div>

        <section className="card checkin" style={{ gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> Neue Ideen
          </span>
          <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Wunsch, z.B. „Songs mit Barré-Griffen“" aria-label="Wunsch" />
          <div className="search-row">
            <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => ask(false)}>{busy === 'ki' ? '…' : 'Ohne Internet'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => ask(true)}>{busy === 'web' ? '…' : '🔍 Mit Internet'}</button>
          </div>
          <span className="tiny">Ohne Internet: Ideen aus dem KI-Wissen mit YouTube-/Google-Suchlink (günstig). Mit Internet: konkrete Videos/Seiten mit Link (ca. 2–3 Cent).</span>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche im Internet …' : 'Ich überlege Ideen passend zu deinem Niveau …'}</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && ideas && ideas.map((x) => (
            <div key={x.id} className="option" style={{ alignItems: 'center' }}>
              <Icon name={KIND_ICON[x.kind]} size={16} color={COLOR} />
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{x.title}</span>
                <span className="tiny">{HOBBY_KINDS[x.kind]}{x.why ? ` · ${x.why}` : ''}</span>
              </span>
              {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              <button type="button" className="pill on" onClick={() => { addHobbyItem(h.id, x); setIdeas(ideas.filter((y) => y.id !== x.id)); toast('Gemerkt'); }}>Merken</button>
            </div>
          ))}
        </section>

        <Segmented full options={[{ id: 'offen', label: `Will ich machen (${h.items.filter((x) => x.status !== 'geschafft').length})` }, { id: 'geschafft', label: `Geschafft (${h.items.filter((x) => x.status === 'geschafft').length})` }]} value={tab} onChange={setTab} label="Status" />
        <div className="list">
          {list.length === 0 && <div className="empty">{tab === 'offen' ? 'Noch nichts geplant – hol dir oben Ideen oder trag selbst etwas ein.' : 'Noch nichts geschafft.'}</div>}
          {list.map((x) => (
            <div key={x.id} className="row" style={{ minHeight: 58 }}>
              <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR }}><Icon name={KIND_ICON[x.kind]} size={15} /></span>
              <span className="row-main">
                <span className="row-title plain">{x.title}</span>
                <span className="row-meta">{[HOBBY_KINDS[x.kind], x.status === 'dabei' && 'gerade dabei', x.why].filter(Boolean).join(' · ')}</span>
              </span>
              {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              {x.status === 'offen' && <button type="button" className="pill" onClick={() => updateHobbyItem(h.id, x.id, { status: 'dabei' })}>Starten</button>}
              {x.status === 'dabei' && <button type="button" className="pill on" onClick={() => { updateHobbyItem(h.id, x.id, { status: 'geschafft' }); toast('Stark!'); }}>Geschafft</button>}
              <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeHobbyItem(h.id, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
            </div>
          ))}
        </div>
        <PlanChat
          title={`Chat: ${h.name}`}
          intro="Frag mich alles zu deinem Hobby – Erklärungen, Übungspläne, was du als Nächstes lernen kannst. Gute Ideen kannst du direkt auf deine Liste setzen."
          history={chatOf(s, `hobby:${h.id}`)}
          onSave={(hist) => saveChatOf(`hobby:${h.id}`, hist)}
          onAsk={(hist, o) => hobbyChat(s, h.id, hist, o)}
          prefKey="hobby"
          groups={[{ key: 'ideen', label: 'Auf meine Liste', title: (x) => x.titel, meta: (x) => [HOBBY_KINDS[x.art], x.warum].filter(Boolean).join(' · ') }]}
          onApply={(sel) => { for (const x of sel.ideen || []) addHobbyItem(h.id, { title: x.titel, kind: HOBBY_KINDS[x.art] ? x.art : 'idee', why: x.warum || '', url: /^https?:\/\//.test(x.url || '') ? x.url : searchLink(x.titel, x.art) }); }}
          chips={['Übungsplan für diese Woche', 'Was sollte ich als Nächstes lernen?', 'Erklär mir etwas Grundlegendes']}
        />

        <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addHobbyItem(h.id, { title: text, kind }); setText(''); }}>
          <span className="label" style={{ padding: 0 }}>Selbst eintragen</span>
          <div className="chips">{Object.entries(HOBBY_KINDS).map(([k, v]) => <button key={k} type="button" className={kind === k ? 'chip on' : 'chip soft'} onClick={() => setKind(k)}>{v}</button>)}</div>
          <div className="block-add">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. „Hotel California“ lernen" aria-label="Neuer Eintrag" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </div>
        </form>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Hobbys({ id }) {
  const s = useStore();
  if (!id) return <HobbyList s={s} />;
  const h = s.hobbies.find((x) => x.id === id);
  return h ? <HobbyDetail s={s} h={h} /> : <Missing />;
}
