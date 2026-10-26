// Karriere → Eigene Projekte: Meilensteine, Arbeitszeit pro Woche, KI-Mentor
import { useState } from 'react';
import { addDays, diffDays, fmtShort, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import {
  addMilestone, addSideProject, fmtMin, logWork, removeLog, removeMilestone, removeSideProject, sideProjectChat, SP_STATUS, stats, toggleMilestone, updateSideProject,
} from '../lib/sideprojects';
import { chatOf, saveChatOf } from '../lib/chats';
import { go } from '../lib/router';
import PlanChat from '../components/PlanChat';
import MiniChart from '../components/MiniChart';
import { Back, Check, Chevron, Field, Icon, Sheet, TabBar, toast } from '../components/ui';

const BLUE = '#3B6FE0';
const ago = (d) => (!d ? 'noch nie' : d === today() ? 'heute' : `vor ${diffDays(d, today())} Tagen`);

export function ProjectsList({ s }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', goal: '' });
  const list = [...(s.sideProjects || [])].sort((a, b) => ['aktiv', 'idee', 'pausiert', 'fertig'].indexOf(a.status) - ['aktiv', 'idee', 'pausiert', 'fertig'].indexOf(b.status));
  const weekTotal = list.reduce((n, p) => n + stats(p).thisWeek, 0);
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/karriere" label="Karriere und Chancen" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Eigene Projekte</h1>
            <button type="button" className="btn small" onClick={() => setOpen(true)}>+ Projekt</button>
          </div>
        </div>
        {list.length > 0 && (
          <section className="card" style={{ gap: 6 }}>
            <div className="stat-row">
              <div><span className="tiny">Diese Woche</span><b>{fmtMin(weekTotal)}</b></div>
              <div><span className="tiny">Aktiv</span><b>{list.filter((p) => p.status === 'aktiv').length}</b></div>
              <div><span className="tiny">Fertig</span><b>{list.filter((p) => p.status === 'fertig').length}</b></div>
            </div>
          </section>
        )}
        <div className="list">
          {list.length === 0 && <div className="empty">Projekte, die dich beruflich weiterbringen – z.B. ein ML-Projekt für GitHub, ein Analyse-Dashboard oder eine Startup-Idee. Jedes bekommt Meilensteine, eine Zeiterfassung und einen KI-Mentor.</div>}
          {list.map((p) => {
            const st = stats(p);
            return (
              <a key={p.id} href={`#/karriere/projekt/${p.id}`} className="row" style={{ minHeight: 70 }}>
                <span className="row-main" style={{ gap: 6 }}>
                  <span className="row-title strong">{p.name}</span>
                  {st.total > 0 && <span className="progress" style={{ height: 4 }}><span style={{ width: `${st.pct}%`, background: BLUE }} /></span>}
                  <span className="row-meta">{[SP_STATUS[p.status], st.total ? `${st.done}/${st.total} Meilensteine` : null, `diese Woche ${fmtMin(st.thisWeek)}`, `zuletzt ${ago(st.last)}`].filter(Boolean).join(' · ')}</span>
                </span>
                <Chevron />
              </a>
            );
          })}
        </div>
      </main>
      <Sheet open={open} title="Neues Projekt" onClose={() => setOpen(false)}>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z.B. Hauspreis-Vorhersage (ML)" /></Field>
        <Field label="Ziel (optional)"><textarea className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="z.B. sauberes ML-Projekt auf GitHub, das ich in Bewerbungen zeigen kann" /></Field>
        <button type="button" className="btn" disabled={!f.name.trim()} onClick={() => { const id = addSideProject(f); setF({ name: '', goal: '' }); setOpen(false); go(`/karriere/projekt/${id}`); }}>Anlegen</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

const GROUPS = [
  { key: 'meilensteine', label: 'Als Meilensteine', title: (x) => x },
  { key: 'todos', label: 'Als Aufgaben', title: (x) => x.text, meta: (x) => (x.tage_ab_heute ? fmtShort(addDays(today(), x.tage_ab_heute)) : 'heute') },
];

export function ProjectPage({ s, p }) {
  const st = stats(p);
  const [ms, setMs] = useState('');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const work = (min) => { logWork(p.id, min, note.trim()); setNote(''); setCustom(''); toast(`${fmtMin(min)} eingetragen`); };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/karriere/projekte" label="Eigene Projekte" />
          <input className="input title-input" defaultValue={p.name} key={p.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && updateSideProject(p.id, { name: e.target.value.trim() })} aria-label="Name" />
          <input className="input goal-input" defaultValue={p.goal} key={p.id + 'g'} placeholder="Ziel des Projekts" onBlur={(e) => e.target.value !== p.goal && updateSideProject(p.id, { goal: e.target.value })} aria-label="Ziel" />
          <input className="input goal-input" defaultValue={p.showcase} key={p.id + 's'} placeholder="Wofür hilft es dir beruflich? z.B. zeigt ML-Können für VC-Rollen" onBlur={(e) => e.target.value !== p.showcase && updateSideProject(p.id, { showcase: e.target.value })} aria-label="Beruflicher Nutzen" />
        </div>
        <div className="box-tabs main-tabs">
          {Object.entries(SP_STATUS).map(([k, v]) => <button key={k} type="button" className={p.status === k ? 'chip on' : 'chip soft'} onClick={() => updateSideProject(p.id, { status: k })}>{v}</button>)}
        </div>

        <section className="card" style={{ gap: 8 }}>
          <div className="stat-row">
            <div><span className="tiny">Fortschritt</span><b>{st.total ? `${st.pct} %` : '–'}</b></div>
            <div><span className="tiny">Diese Woche</span><b>{fmtMin(st.thisWeek)}</b></div>
            <div><span className="tiny">Zuletzt</span><b style={{ fontSize: 15 }}>{ago(st.last)}</b></div>
          </div>
          <span className="label" style={{ padding: 0 }}>Arbeitszeit pro Woche · 8 Wochen · gesamt {fmtMin(st.totalMin)}</span>
          <MiniChart entries={st.weeks} color={BLUE} unit="min" />
          <span className="label" style={{ padding: 0 }}>Heute dran gearbeitet</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was hast du gemacht? (optional)" aria-label="Notiz" />
          <div className="search-row">
            {[30, 60, 120].map((m) => <button key={m} type="button" className="btn tint small" style={{ flex: 1 }} onClick={() => work(m)}>+ {fmtMin(m)}</button>)}
          </div>
          <div className="search-row">
            <input className="input" style={{ flex: 1 }} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder="Andere Dauer in Minuten" aria-label="Minuten" />
            <button type="button" className="btn small" disabled={!custom} onClick={() => work(Number(custom))}>+</button>
          </div>
          {p.log.length > 0 && (
            <div className="analysis-list">
              {[...p.log].reverse().slice(0, 5).map((l) => (
                <span key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{fmtShort(l.date)} · {fmtMin(l.minutes)}{l.note ? ` · ${l.note}` : ''}</span>
                  <button type="button" className="x-btn" aria-label="Eintrag löschen" onClick={() => removeLog(p.id, l.id)}><Icon name="x" size={11} color="var(--chev)" /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Meilensteine</h2><span className="tiny">{st.done} von {st.total}</span></div>
          <div className="list">
            {p.milestones.length === 0 && <div className="empty">Messbare Zwischenziele, z.B. „Daten bereinigt“, „Modell mit Fehler unter X“, „README und Grafiken auf GitHub“. Der KI-Mentor unten schlägt dir welche vor.</div>}
            {p.milestones.map((m) => (
              <div key={m.id} className="row" style={{ minHeight: 46 }}>
                <Check on={m.done} color={BLUE} onClick={() => toggleMilestone(p.id, m.id)} label={m.text} />
                <span className="row-main"><span className={m.done ? 'row-title plain done' : 'row-title plain'}>{m.text}</span>{m.doneAt && <span className="row-meta">geschafft {fmtShort(m.doneAt)}</span>}</span>
                <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeMilestone(p.id, m.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
            <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addMilestone(p.id, ms); setMs(''); }}>
              <input className="input" value={ms} onChange={(e) => setMs(e.target.value)} placeholder="Neuer Meilenstein" aria-label="Neuer Meilenstein" />
              <button type="submit" className="btn small" disabled={!ms.trim()}>+</button>
            </form>
          </div>
        </section>

        <section className="card" style={{ gap: 6 }}>
          <span className="label" style={{ padding: 0 }}>Link (GitHub, Demo …)</span>
          <div className="block-add">
            <input className="input" defaultValue={p.link} key={p.id + 'l'} placeholder="https://github.com/…" inputMode="url" onBlur={(e) => e.target.value !== p.link && updateSideProject(p.id, { link: e.target.value.trim() })} aria-label="Link" />
            {p.link && <a className="btn small" href={p.link} target="_blank" rel="noreferrer">Öffnen</a>}
          </div>
        </section>

        <PlanChat
          title="KI-Mentor"
          intro="Erzähl, wo du stehst – ich helfe dir, das Projekt in kleine, messbare Schritte zu zerlegen und es beruflich sichtbar zu machen."
          history={chatOf(s, `sp:${p.id}`)}
          onSave={(h) => saveChatOf(`sp:${p.id}`, h)}
          onAsk={(hist, o) => sideProjectChat(s, p, hist, o)}
          prefKey="eigenprojekt"
          groups={GROUPS}
          onApply={(sel) => {
            for (const x of sel.meilensteine || []) addMilestone(p.id, x);
            for (const x of sel.todos || []) addTask({ title: `${p.name}: ${x.text}`, areaId: 'karriere', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
          }}
          chips={['Meilensteine vorschlagen', 'Was ist der nächste Schritt?', 'Wie mache ich es sichtbar?']}
        />
        <button type="button" className="btn danger" onClick={() => { if (confirm(`„${p.name}“ löschen?`)) { removeSideProject(p.id); go('/karriere/projekte'); } }}>Projekt löschen</button>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
