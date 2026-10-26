import { useState } from 'react';
import { useStore } from '../lib/store';
import { addHobby, addHobbyItem, HOBBY_KINDS, hobbyChat, searchLink, removeHobby, removeHobbyItem, updateHobby, updateHobbyItem } from '../lib/leisure';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { Back, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';
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
        {s.hobbies.length === 0 && <div className="notice">Füg deine Hobbys hinzu. Zu jedem führst du eine Liste (z.B. Songs: offen / geschafft) und kannst im Chat nach Neuem fragen.</div>}
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
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('idee');
  const list = h.items.filter((x) => (tab === 'geschafft' ? x.status === 'geschafft' : x.status !== 'geschafft'));
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/hobbys" label="Hobbys" />
          <input className="input title-input" defaultValue={h.name} key={h.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== h.name && updateHobby(h.id, { name: e.target.value.trim() })} aria-label="Name des Hobbys" />
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input goal-input" defaultValue={h.level} key={h.id + 'l'} placeholder="Niveau, z.B. Anfänger" onBlur={(e) => e.target.value !== h.level && updateHobby(h.id, { level: e.target.value })} aria-label="Niveau" />
            <input className="input goal-input" defaultValue={h.goal} key={h.id + 'g'} placeholder="Ziel/Geschmack, z.B. Rock & Latino" onBlur={(e) => e.target.value !== h.goal && updateHobby(h.id, { goal: e.target.value })} aria-label="Ziel" />
          </div>
        </div>

        <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addHobbyItem(h.id, { title: text, kind }); setText(''); }}>
          <span className="label" style={{ padding: 0 }}>Eintragen</span>
          <div className="chips">{Object.entries(HOBBY_KINDS).map(([k, v]) => <button key={k} type="button" className={kind === k ? 'chip on' : 'chip soft'} onClick={() => setKind(k)}>{v}</button>)}</div>
          <div className="block-add">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. „Hotel California“ lernen" aria-label="Neuer Eintrag" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </div>
        </form>
        <Segmented full options={[{ id: 'offen', label: `Noch offen (${h.items.filter((x) => x.status !== 'geschafft').length})` }, { id: 'geschafft', label: `Geschafft (${h.items.filter((x) => x.status === 'geschafft').length})` }]} value={tab} onChange={setTab} label="Status" />
        <div className="list">
          {list.length === 0 && <div className="empty">{tab === 'offen' ? 'Noch nichts offen – trag oben etwas ein oder frag unten im Chat nach Ideen.' : 'Noch nichts geschafft.'}</div>}
          {list.map((x) => (
            <div key={x.id} className="row" style={{ minHeight: 58 }}>
              <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR }}><Icon name={KIND_ICON[x.kind]} size={15} /></span>
              <button type="button" className="row-main" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => setEditing(x)} aria-label={`${x.title} bearbeiten`}>
                <span className="row-title plain">{x.title}</span>
                <span className="row-meta">{[HOBBY_KINDS[x.kind], x.why].filter(Boolean).join(' · ')}</span>
              </button>
              {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              {x.status !== 'geschafft' ? <button type="button" className="pill on" aria-label={`${x.title} geschafft`} onClick={() => { updateHobbyItem(h.id, x.id, { status: 'geschafft' }); toast('Stark!'); }}>✓</button> : <button type="button" className="pill" onClick={() => updateHobbyItem(h.id, x.id, { status: 'offen' })}>Zurück</button>}
              <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeHobbyItem(h.id, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
            </div>
          ))}
        </div>
        <PlanChat
          title={`Chat: ${h.name}`}
          intro="Frag nach Neuem (z.B. Songs für dein Niveau), Erklärungen oder Übungsplänen. Gute Ideen setzt du mit einem Tipp auf deine Liste."
          history={chatOf(s, `hobby:${h.id}`)}
          onSave={(hist) => saveChatOf(`hobby:${h.id}`, hist)}
          onAsk={(hist, o) => hobbyChat(s, h.id, hist, o)}
          prefKey="hobby"
          groups={[{ key: 'ideen', label: 'Auf meine Liste', title: (x) => x.titel, meta: (x) => [HOBBY_KINDS[x.art], x.warum].filter(Boolean).join(' · ') }]}
          onApply={(sel) => { for (const x of sel.ideen || []) addHobbyItem(h.id, { title: x.titel, kind: HOBBY_KINDS[x.art] ? x.art : 'idee', why: x.warum || '', url: /^https?:\/\//.test(x.url || '') ? x.url : searchLink(x.titel, x.art) }); }}
          chips={['Neue Ideen für mich', 'Übungsplan für diese Woche', 'Was sollte ich als Nächstes lernen?', 'Erklär mir etwas Grundlegendes']}
        />

      </main>
      <ItemSheet h={h} item={editing} onClose={() => setEditing(null)} />
      <TabBar active="bereiche" />
    </>
  );
}

function ItemSheet({ h, item, onClose }) {
  const [f, setF] = useState(null);
  const [key, setKey] = useState(null);
  if (item && item.id !== key) { setKey(item.id); setF({ title: item.title, kind: item.kind, why: item.why || '', url: item.url || '', status: item.status === 'geschafft' ? 'geschafft' : 'offen' }); }
  if (!item && key) { setKey(null); }
  const save = () => {
    if (!f.title.trim()) return;
    updateHobbyItem(h.id, item.id, { title: f.title.trim(), kind: f.kind, why: f.why.trim(), url: /^https?:\/\//.test(f.url.trim()) ? f.url.trim() : '', status: f.status });
    toast('Gespeichert');
    onClose();
  };
  return (
    <Sheet open={!!item && !!f} title="Eintrag bearbeiten" onClose={onClose}>
      {f && (
        <>
          <Field label="Titel"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="chips">{Object.entries(HOBBY_KINDS).map(([k, v]) => <button key={k} type="button" className={f.kind === k ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, kind: k })}>{v}</button>)}</div>
          <Segmented full options={[{ id: 'offen', label: 'Noch offen' }, { id: 'geschafft', label: 'Geschafft' }]} value={f.status} onChange={(v) => setF({ ...f, status: v })} label="Status" />
          <Field label="Notiz"><textarea className="input" value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} placeholder="z.B. Tonart, Akkorde, wo gefunden …" /></Field>
          <Field label="Link (optional)"><input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} inputMode="url" placeholder="z.B. YouTube-Video oder Tabs" /></Field>
          <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
          <button type="button" className="btn danger" onClick={() => { if (confirm('Eintrag löschen?')) { removeHobbyItem(h.id, item.id); onClose(); } }}>Löschen</button>
        </>
      )}
    </Sheet>
  );
}

export default function Hobbys({ id }) {
  const s = useStore();
  if (!id) return <HobbyList s={s} />;
  const h = s.hobbies.find((x) => x.id === id);
  return h ? <HobbyDetail s={s} h={h} /> : <Missing />;
}
