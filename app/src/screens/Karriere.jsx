import { useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, fmtShort, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import {
  addCheck, addDoc, addJob, addSearch, analyzeJob, careerChat, claudeBrief, jobLinks, jobOffersWeb, removeCheck, removeDoc, removeJob, removeSearch,
  STAGES, stageOf, toggleCheck, toggleDoc, updateJob, updateSearch,
} from '../lib/career';
import { chatOf, saveChatOf } from '../lib/chats';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import PlanChat from '../components/PlanChat';
import LinkList from '../components/LinkList';
import { Back, Check, Chevron, Field, Icon, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

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
            {s.jobSearches.length === 0 && <div className="empty">Leg für jede Richtung eine eigene Suche an, z.B. „VC Analyst“ oder „Generalist in einem KI-Startup“. Jede Suche findet neue Angebote und hat ihren eigenen Coach-Chat.</div>}
            {s.jobSearches.map((x) => {
              const mine = jobs.filter((j) => j.searchId === x.id);
              return (
                <a key={x.id} href={`#/karriere/suche/${x.id}`} className="row" style={{ minHeight: 62 }}>
                  <span className="block-icon" style={{ background: 'color-mix(in srgb, #3B6FE0 14%, transparent)', color: BLUE }}><Icon name="briefcase" size={16} /></span>
                  <span className="row-main">
                    <span className="row-title strong">{x.name}</span>
                    <span className="row-meta">{[x.location, `${mine.filter(active).length} im Trichter`, mine.filter((j) => j.status === 'beworben' || j.status === 'gespraech').length && `${mine.filter((j) => j.status === 'beworben' || j.status === 'gespraech').length} laufen`].filter(Boolean).join(' · ')}</span>
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

function SearchPage({ s, search }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [manual, setManual] = useState({ title: '', company: '', url: '' });
  const [adding, setAdding] = useState(false);
  const hasKey = !!getAi().apiKey;
  const jobs = s.jobs.filter((j) => j.searchId === search.id);
  const offers = (search.results?.offers || []).filter((o) => !s.jobs.some((j) => j.title === o.title && j.company === o.company));
  const run = async (web) => {
    setBusy(web ? 'web' : 'links');
    setErr(null);
    try {
      if (web) await jobOffersWeb(s, search);
      else await jobLinks(s, search);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const take = (o) => {
    if (addJob({ searchId: search.id, title: o.title, company: o.company, url: o.url, location: o.location, note: o.why })) toast('Im Trichter');
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/karriere" label="Jobsuche" />
          <input className="input title-input" defaultValue={search.name} key={search.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== search.name && updateSearch(search.id, { name: e.target.value.trim() })} aria-label="Name der Suche" />
          <input className="input goal-input" defaultValue={search.goal} key={search.id + 'g'} placeholder="Was ist dir wichtig? (hilft der KI)" onBlur={(e) => e.target.value !== search.goal && updateSearch(search.id, { goal: e.target.value })} aria-label="Ziel" />
          <input className="input goal-input" defaultValue={search.location} key={search.id + 'l'} placeholder="Ort, z.B. Buenos Aires / remote" onBlur={(e) => e.target.value !== search.location && updateSearch(search.id, { location: e.target.value })} aria-label="Ort" />
        </div>

        <section className="card checkin" style={{ gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="search" size={15} color="currentColor" /></span> Neue Angebote
          </span>
          <div className="search-row">
            <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !hasKey} onClick={() => run(false)}>{busy === 'links' ? '…' : 'Such-Links'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !hasKey} onClick={() => run(true)}>{busy === 'web' ? '…' : '🔍 Konkrete Angebote'}</button>
          </div>
          <span className="tiny">Such-Links: gezielte Suchen bei LinkedIn (letzte 7 Tage), Google Jobs, Get on Board & Co. – fast kostenlos. Konkrete Angebote: die KI sucht selbst (ca. 3–5 Cent).</span>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche aktuelle Angebote …' : 'Ich überlege die besten Suchen …'}</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && search.links && <LinkList links={search.links.links} hint={search.links.hint} />}
          {!busy && search.results && (
            <>
              {search.results.hint && <span className="sub">{search.results.hint}</span>}
              {offers.map((o) => (
                <div key={o.id} className="option" style={{ alignItems: 'center' }}>
                  <span className="row-main">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{o.title}{o.company ? ` · ${o.company}` : ''}</span>
                    <span className="tiny">{[o.location, o.date, o.why].filter(Boolean).join(' · ')}</span>
                  </span>
                  {o.url && <a className="x-btn" href={o.url} target="_blank" rel="noreferrer" aria-label="Anzeige öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
                  <button type="button" className="pill on" onClick={() => take(o)}>Merken</button>
                </div>
              ))}
            </>
          )}
        </section>

        <section className="group">
          <div className="sec-h">
            <h2 className="h2" style={{ fontSize: 19 }}>Trichter</h2>
            <button type="button" className="link-btn" onClick={() => setAdding(!adding)}>{adding ? 'Abbrechen' : '+ Stelle'}</button>
          </div>
          {adding && (
            <form className="card" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); const id = addJob({ searchId: search.id, ...manual }); setManual({ title: '', company: '', url: '' }); setAdding(false); if (id) go(`/karriere/job/${id}`); }}>
              <input className="input" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Stelle, z.B. Investment Analyst" aria-label="Stelle" autoFocus />
              <input className="input" value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} placeholder="Firma" aria-label="Firma" />
              <input className="input" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="Link zur Anzeige (optional)" aria-label="Link" inputMode="url" />
              <button type="submit" className="btn small" disabled={!manual.title.trim()}>Hinzufügen</button>
            </form>
          )}
          <div className="list">
            {jobs.length === 0 && <div className="empty">Noch keine Stellen. Merk dir oben Angebote oder füg eine Stelle selbst hinzu (z.B. aus einem Such-Link).</div>}
            {STAGES.flatMap((st) => jobs.filter((j) => j.status === st.id)).map((j) => <JobRow key={j.id} j={j} s={s} />)}
          </div>
        </section>

        <PlanChat
          title="Karriere-Coach"
          intro="Lass uns die Suche planen: Welche Rollen und Firmen passen, wie gehst du an Kontakte heran, was fehlt noch an Unterlagen? Vorschläge kannst du direkt übernehmen."
          history={chatOf(s, `job:${search.id}`)}
          onSave={(h) => saveChatOf(`job:${search.id}`, h)}
          onAsk={(hist, o) => careerChat(s, search, hist, o)}
          prefKey="karriere"
          groups={CHAT_GROUPS}
          onApply={(sel) => {
            for (const x of sel.angebote || []) addJob({ searchId: search.id, title: x.titel, company: x.firma || '', url: x.url || '', note: x.warum || '' });
            for (const x of sel.todos || []) addTask({ title: x.text, areaId: 'karriere', due: addDays(today(), Math.max(0, x.tage_ab_heute || 0)) });
            for (const x of sel.unterlagen || []) addDoc(x);
          }}
          chips={['Welche Firmen passen zu mir?', 'Plan für diese Woche', 'Wie spreche ich Leute an?', 'Was fehlt mir noch?']}
        />
        <button type="button" className="btn danger" onClick={() => { if (confirm(`Suche „${search.name}“ löschen? Gemerkte Stellen ohne Bewerbung werden mitgelöscht.`)) { removeSearch(search.id); go('/karriere'); } }}>Suche löschen</button>
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
  if (view === 'job') {
    const j = s.jobs.find((y) => y.id === id);
    return j ? <JobPage s={s} job={j} /> : <Missing />;
  }
  return <Overview s={s} />;
}
