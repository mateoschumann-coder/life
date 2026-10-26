import { useState } from 'react';
import { store, useStore } from '../lib/store';
import { addDays, fmtShort, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import {
  addCheck, addDoc, addJob, addSearch, analyzeJob, applyFunnel, careerChat, claudeBrief, funnelChat, removeCheck, removeDoc, removeJob, removeSearch,
  STAGES, stageOf, toggleCheck, toggleDoc, updateJob, updateSearch,
} from '../lib/career';
import { chatOf, saveChatOf } from '../lib/chats';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import PlanChat from '../components/PlanChat';
import { Back, Check, Chevron, Field, Icon, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';
import { ProjectsList, ProjectPage } from './EigeneProjekte';

const BLUE = '#3B6FE0';
const errText = (e) => (e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
const active = (j) => j.status !== 'abgesagt';

// Trichter: wie viele Bewerbungen in welcher Phase
function Funnel({ jobs }) {
  const counts = STAGES.filter((x) => x.id !== 'abgesagt').map((st) => ({ ...st, n: jobs.filter((j) => j.status === st.id).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const out = jobs.filter((j) => j.status === 'abgesagt').length;
  return (
    <section className="card" style={{ gap: 8 }}>
      <span className="label" style={{ padding: 0 }}>Dein Bewerbungs-Trichter</span>
      {counts.map((c) => (
        <div key={c.id} className="funnel-row">
          <span className="tiny" style={{ width: 92 }}>{c.short}</span>
          <span className="funnel-bar"><span style={{ width: `${Math.max(c.n ? 8 : 0, (c.n / max) * 100)}%`, background: BLUE }} /></span>
          <b style={{ width: 22, textAlign: 'right' }}>{c.n}</b>
        </div>
      ))}
      {out > 0 && <span className="tiny">{out} abgesagt / passt nicht</span>}
    </section>
  );
}

function JobRow({ j, s }) {
  const done = j.checklist.filter((x) => x.done).length;
  const search = s.jobSearches.find((x) => x.id === j.searchId);
  return (
    <a href={`#/karriere/job/${j.id}`} className="row" style={{ minHeight: 60 }}>
      <span className="row-main">
        <span className="row-title strong">{j.title}{j.company ? ` · ${j.company}` : ''}</span>
        <span className="row-meta">{[stageOf(j.status).label, `${done}/${j.checklist.length} erledigt`, j.deadline && `bis ${fmtShort(j.deadline)}`, search?.name].filter(Boolean).join(' · ')}</span>
      </span>
      <Chevron />
    </a>
  );
}

function Docs({ s }) {
  const [text, setText] = useState('');
  const done = s.careerDocs.filter((d) => d.done).length;
  return (
    <section className="group">
      <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Unterlagen bereit?</h2><span className="tiny">{done} von {s.careerDocs.length}</span></div>
      <div className="list">
        {s.careerDocs.map((d) => (
          <div key={d.id} className="row" style={{ minHeight: 46 }}>
            <Check on={d.done} color={BLUE} onClick={() => toggleDoc(d.id)} label={d.text} />
            <span className="row-main"><span className={d.done ? 'row-title plain done' : 'row-title plain'}>{d.text}</span></span>
            <button type="button" className="x-btn" aria-label={`${d.text} löschen`} onClick={() => removeDoc(d.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
        <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addDoc(text); setText(''); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Weitere Unterlage" aria-label="Weitere Unterlage" />
          <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
        </form>
      </div>
    </section>
  );
}

// ---------- Übersicht ----------
function Overview({ s }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', goal: '', location: 'Buenos Aires / remote' });
  const jobs = s.jobs;
  const save = () => {
    const id = addSearch(f);
    setOpen(false);
    setF({ name: '', goal: '', location: 'Buenos Aires / remote' });
    go(`/karriere/suche/${id}`);
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/karriere" label="Karriere und Chancen" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Jobsuche</h1>
            <button type="button" className="btn small" onClick={() => setOpen(true)}>+ Suche</button>
          </div>
        </div>
        {jobs.length > 0 && <Funnel jobs={jobs} />}
        <section className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>Meine Suchen</h2>
          <div className="list">
            {s.jobSearches.length === 0 && <div className="empty">Leg für jede Richtung eine eigene Suche an, z.B. „VC Analyst“ oder „Generalist in einem KI-Startup“. In jeder Suche erzählst du einfach, wie es läuft – der Trichter baut sich von selbst.</div>}
            {s.jobSearches.map((x) => {
              const mine = jobs.filter((j) => j.searchId === x.id);
              return (
                <a key={x.id} href={`#/karriere/suche/${x.id}`} className="row" style={{ minHeight: 62 }}>
                  <span className="block-icon" style={{ background: 'color-mix(in srgb, #3B6FE0 14%, transparent)', color: BLUE }}><Icon name="briefcase" size={16} /></span>
                  <span className="row-main">
                    <span className="row-title strong">{x.name}</span>
                    <span className="row-meta">{[x.location, `${mine.filter(active).length} im Trichter`, mine.filter((j) => ['beworben', 'rueckmeldung', 'gespraech', 'angebot'].includes(j.status)).length && `${mine.filter((j) => ['beworben', 'rueckmeldung', 'gespraech', 'angebot'].includes(j.status)).length} laufen`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Chevron />
                </a>
              );
            })}
          </div>
        </section>
        {jobs.filter(active).length > 0 && (
          <section className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>Alle Bewerbungen</h2>
            <div className="list">{STAGES.filter((x) => x.id !== 'abgesagt').flatMap((st) => jobs.filter((j) => j.status === st.id)).map((j) => <JobRow key={j.id} j={j} s={s} />)}</div>
          </section>
        )}
        <Docs s={s} />
        <PlanChat
          title="Karriere-Coach"
          intro="Lass uns deine Karriere planen: Welche Rollen und Firmen passen, wie gehst du an Kontakte heran, was fehlt an Unterlagen, welches eigene Projekt hilft dir? Vorschläge kannst du direkt übernehmen."
          history={chatOf(s, 'karriere')}
          onSave={(h) => saveChatOf('karriere', h)}
          onAsk={(hist, o) => careerChat(s, hist, o)}
          prefKey="karriere"
          groups={CHAT_GROUPS}
          onApply={(sel) => {
            for (const x of sel.angebote || []) addJob({ searchId: s.jobSearches[0]?.id || null, title: x.titel, company: x.firma || '', url: x.url || '', note: x.warum || '' });
            for (const x of sel.todos || []) addTask({ title: x.text, areaId: 'karriere', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
            for (const x of sel.unterlagen || []) addDoc(x);
          }}
          chips={['Welche Firmen passen zu mir?', 'Plan für diese Woche', 'Wie spreche ich Leute an?', 'Was fehlt mir noch?']}
        />
      </main>
      <Sheet open={open} title="Neue Jobsuche" onClose={() => setOpen(false)}>
        <Field label="Wonach suchst du?"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z.B. VC Analyst / Associate" /></Field>
        <Field label="Was ist dir wichtig? (optional)"><textarea className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="z.B. Early-Stage, KI-Fokus, Generalist-Rolle, Englisch als Arbeitssprache" /></Field>
        <Field label="Ort"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <button type="button" className="btn" onClick={save} disabled={!f.name.trim()}>Suche anlegen</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

// ---------- Eine Suche ----------
const CHAT_GROUPS = [
  { key: 'angebote', label: 'In den Trichter', title: (x) => `${x.titel}${x.firma ? ` · ${x.firma}` : ''}`, meta: (x) => x.warum },
  { key: 'todos', label: 'Als Aufgabe', title: (x) => x.text, meta: (x) => (x.tage_ab_heute ? fmtShort(addDays(today(), x.tage_ab_heute)) : 'heute') },
  { key: 'unterlagen', label: 'Zu den Unterlagen', title: (x) => x },
];

const FUNNEL_GROUPS = [{ key: 'aenderungen', label: 'In den Trichter', title: (x) => `${x.titel}${x.firma ? ` · ${x.firma}` : ''}`, meta: (x) => [`→ ${stageOf(x.phase).label}`, x.notiz].filter(Boolean).join(' · ') }];

function SearchPage({ s, search }) {
  const [manual, setManual] = useState({ title: '', company: '', url: '', description: '', status: 'interessiert' });
  const [adding, setAdding] = useState(false);
  const jobs = s.jobs.filter((j) => j.searchId === search.id);
  const key = `jobsuche:${search.id}`;
  const apply = (sel) => {
    const last = [...chatOf(store.get(), key)].reverse().find((m) => m.role === 'user');
    const n = applyFunnel(search, sel.aenderungen || [], last?.text || '');
    if (n) toast(`${n} ${n === 1 ? 'Stelle' : 'Stellen'} im Trichter aktualisiert`);
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/karriere" label="Jobsuche" />
          <input className="input title-input" defaultValue={search.name} key={search.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== search.name && updateSearch(search.id, { name: e.target.value.trim() })} aria-label="Name der Suche" />
          <input className="input goal-input" defaultValue={search.goal} key={search.id + 'g'} placeholder="Was ist dir wichtig? (hilft der KI)" onBlur={(e) => e.target.value !== search.goal && updateSearch(search.id, { goal: e.target.value })} aria-label="Ziel" />
        </div>

        <Funnel jobs={jobs} />

        <PlanChat
          title="Erzähl, wie es läuft"
          intro="Sag oder schreib einfach, was passiert ist – z.B. „Bei Kaszek beworben, Mercado Libre hat abgesagt, Donnerstag Gespräch bei Ualá“ – oder füg eine Stellenanzeige ein. Ich trage alles in den Trichter ein."
          history={chatOf(s, key)}
          onSave={(h) => saveChatOf(key, h)}
          onAsk={(hist) => funnelChat(s, search, hist)}
          prefKey="trichter"
          hideToggles
          groups={FUNNEL_GROUPS}
          onApply={apply}
          placeholder="Was hat sich getan? Oder Anzeige einfügen …"
        />

        <section className="group">
          <div className="sec-h">
            <h2 className="h2" style={{ fontSize: 19 }}>Stellen</h2>
            <button type="button" className="link-btn" onClick={() => setAdding(!adding)}>{adding ? 'Abbrechen' : '+ Selbst eintragen'}</button>
          </div>
          {adding && (
            <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); const id = addJob({ searchId: search.id, ...manual }); setManual({ title: '', company: '', url: '', description: '', status: 'interessiert' }); setAdding(false); if (id) toast('Im Trichter'); }}>
              <input className="input" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Stelle, z.B. Investment Analyst" aria-label="Stelle" autoFocus />
              <input className="input" value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} placeholder="Firma" aria-label="Firma" />
              <div className="chips">{STAGES.map((st) => <button key={st.id} type="button" className={manual.status === st.id ? 'chip on' : 'chip soft'} onClick={() => setManual({ ...manual, status: st.id })}>{st.short}</button>)}</div>
              <input className="input" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="Link zur Anzeige (optional)" aria-label="Link" inputMode="url" />
              <textarea className="input" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} placeholder="Text der Anzeige einfügen (optional)" aria-label="Anzeigentext" />
              <button type="submit" className="btn small" disabled={!manual.title.trim()}>Hinzufügen</button>
            </form>
          )}
          {jobs.length === 0 && <div className="list"><div className="empty">Noch keine Stellen. Erzähl oben, wo du dich beworben hast oder was dich interessiert – oder trag sie selbst ein.</div></div>}
          {STAGES.map((st) => {
            const list = jobs.filter((j) => j.status === st.id);
            if (!list.length) return null;
            return (
              <div key={st.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="label" style={{ padding: '0 4px' }}>{st.label} ({list.length})</span>
                <div className="list">{list.map((j) => <JobRow key={j.id} j={j} s={s} />)}</div>
              </div>
            );
          })}
        </section>

        <button type="button" className="btn danger" onClick={() => { if (confirm(`Suche „${search.name}“ löschen? Stellen, die nur „Interessiert“ sind, werden mitgelöscht.`)) { removeSearch(search.id); go('/karriere'); } }}>Suche löschen</button>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

// ---------- Eine Stelle ----------
function List({ title, items }) {
  if (!items?.length) return null;
  return <div className="analysis-list"><b>{title}</b>{items.map((x, i) => <span key={i}>– {x}</span>)}</div>;
}
function JobPage({ s, job }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [text, setText] = useState('');
  const a = job.analysis;
  const search = s.jobSearches.find((x) => x.id === job.searchId);
  const run = async (smart) => {
    setBusy(smart ? 'smart' : 'fast');
    setErr(null);
    try {
      await analyzeJob(s, job, { smart });
      toast('Analyse fertig – Checkliste ergänzt');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    const t = claudeBrief(s, job);
    try {
      await navigator.clipboard.writeText(t);
      toast('Kopiert – jetzt in Claude einfügen');
    } catch {
      prompt('Zum Kopieren markieren:', t);
    }
  };
  const done = job.checklist.filter((x) => x.done).length;
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href={search ? `#/karriere/suche/${search.id}` : '#/karriere'} label={search?.name || 'Jobsuche'} />
          <input className="input title-input" defaultValue={job.title} key={job.id + 't'} onBlur={(e) => e.target.value.trim() && e.target.value !== job.title && updateJob(job.id, { title: e.target.value.trim() })} aria-label="Stelle" />
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input goal-input" defaultValue={job.company} key={job.id + 'c'} placeholder="Firma" onBlur={(e) => e.target.value !== job.company && updateJob(job.id, { company: e.target.value })} aria-label="Firma" />
            {job.url && <a className="pill" href={job.url} target="_blank" rel="noreferrer" style={{ alignSelf: 'center' }}>Anzeige</a>}
          </div>
        </div>

        <div className="box-tabs main-tabs" role="radiogroup" aria-label="Phase">
          {STAGES.map((st) => <button key={st.id} type="button" className={job.status === st.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => updateJob(job.id, { status: st.id })}>{st.short}</button>)}
        </div>

        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Stellenanzeige</span>
          <textarea className="input" style={{ minHeight: 110 }} defaultValue={job.description} key={job.id + 'd' + (job.description || '').length} placeholder="Text der Anzeige hier einfügen (kopieren aus LinkedIn & Co.) – dann wird die Analyse viel genauer." onBlur={(e) => e.target.value !== job.description && updateJob(job.id, { description: e.target.value })} aria-label="Stellenanzeige" />
          {!job.url && <input className="input" placeholder="Link zur Anzeige (optional)" inputMode="url" onBlur={(e) => /^https?:\/\//.test(e.target.value) && updateJob(job.id, { url: e.target.value })} aria-label="Link" />}
        </section>

        <section className="card checkin" style={{ gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> Was wird gesucht – was bringe ich mit?
          </span>
          <div className="search-row">
            <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => run(false)}>{busy === 'fast' ? '…' : a ? 'Neu analysieren' : 'Analysieren'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => run(true)}>{busy === 'smart' ? '…' : '🧠 Gründlich'}</button>
          </div>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich lese die Anzeige und vergleiche mit deinem Profil …</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && a && (
            <>
              <p className="coach-summary">{a.kurz}{a.passung ? ` (Passung ${a.passung}/10)` : ''}</p>
              <List title="Gesucht" items={a.gesucht} />
              <List title="Das bringst du mit" items={a.mitbringen} />
              <List title="Lücken – und wie du sie schließt" items={a.luecken} />
              <List title="Kernpunkte fürs Anschreiben" items={a.anschreiben} />
              <List title="Mögliche Interviewfragen" items={a.fragen} />
            </>
          )}
          <button type="button" className="btn sec" onClick={copy}>Für Claude kopieren</button>
          <span className="tiny">Kopiert Stelle, Analyse und dein Profil als Text – in Claude einfügen und dort Anschreiben, Lebenslauf und Interview vorbereiten.</span>
        </section>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Checkliste</h2><span className="tiny">{done} von {job.checklist.length}</span></div>
          <div className="list">
            {[...job.checklist.filter((x) => !x.done), ...job.checklist.filter((x) => x.done)].map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 46 }}>
                <Check on={x.done} color={BLUE} onClick={() => toggleCheck(job.id, x.id)} label={x.text} />
                <span className="row-main"><span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span></span>
                <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => removeCheck(job.id, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
            <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addCheck(job.id, text); setText(''); }}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Weiterer Schritt" aria-label="Weiterer Schritt" />
              <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
            </form>
          </div>
        </section>

        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Notizen & Frist</span>
          <textarea className="input" defaultValue={job.note} key={job.id + 'no'} placeholder="Kontakte, Gesprächsnotizen, Gehalt …" onBlur={(e) => e.target.value !== job.note && updateJob(job.id, { note: e.target.value })} aria-label="Notizen" />
          <label className="field" style={{ margin: 0 }}><span>Bewerbungsfrist</span><input className="input" type="date" value={job.deadline || ''} onChange={(e) => updateJob(job.id, { deadline: e.target.value })} /></label>
        </section>
        <button type="button" className="btn danger" onClick={() => { if (confirm('Stelle löschen?')) { removeJob(job.id); go(search ? `/karriere/suche/${search.id}` : '/karriere'); } }}>Stelle löschen</button>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Karriere({ view, id }) {
  const s = useStore();
  if (view === 'suche') {
    const x = s.jobSearches.find((y) => y.id === id);
    return x ? <SearchPage s={s} search={x} /> : <Missing />;
  }
  if (view === 'projekte') return <ProjectsList s={s} />;
  if (view === 'projekt') {
    const p = (s.sideProjects || []).find((y) => y.id === id);
    return p ? <ProjectPage s={s} p={p} /> : <Missing />;
  }
  if (view === 'job') {
    const j = s.jobs.find((y) => y.id === id);
    return j ? <JobPage s={s} job={j} /> : <Missing />;
  }
  return <Overview s={s} />;
}
