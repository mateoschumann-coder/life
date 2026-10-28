import { useEffect, useState } from 'react';
import { store, useStore } from '../lib/store';
import { addDays, fmtShort, today } from '../lib/dates';
import { addTask } from '../lib/actions';
import {
  addCheck, addDoc, addJob, addSearch, analyzeJob, importJobs, fillJobProfile, WORK_MODES, applyFunnel, careerChat, claudeBrief, funnelChat, removeCheck, removeDoc, removeJob, removeSearch,
  STAGES, stageOf, toggleCheck, toggleDoc, updateJob, updateSearch,
  checksOf, stageCheck, checkCount, JOB_PREP, SEARCH_TODOS, SEARCH_PREP, ensureList, catList, suggestSearchPrep, researchJob,
} from '../lib/career';
import GroupedChecklist from '../components/GroupedChecklist';
import { DateRangeField } from '../components/DateRange';
import { chatOf, saveChatOf } from '../lib/chats';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import PlanChat from '../components/PlanChat';
import { Back, Check, Chevron, Field, Icon, Sheet, TabBar, toast, Info } from '../components/ui';
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

// v0.73: Karte pro Stelle mit Steckbrief (aufklappbar)
function JobRow({ j, s, showSearch = false }) {
  const [open, setOpen] = useState(false);
  const cc = checkCount(j);
  const search = s.jobSearches.find((x) => x.id === j.searchId);
  const facts = [j.location, WORK_MODES[j.mode], j.salary].filter(Boolean);
  const has = (j.tasks || []).length || (j.reqs || []).length || j.about;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ minHeight: 60 }}>
        <a href={`#/karriere/job/${j.id}`} className="row-main" style={{ color: 'inherit', textDecoration: 'none' }}>
          <span className="row-title strong">{j.title}{j.company ? ` · ${j.company}` : ''}</span>
          {facts.length > 0 && <span className="row-meta" style={{ color: 'var(--text)' }}>{facts.join(' · ')}</span>}
          <span className="row-meta">{[showSearch && stageOf(j.status).label, `${cc.done}/${cc.all} erledigt`, j.deadline && `bis ${fmtShort(j.deadline)}`, showSearch && search?.name].filter(Boolean).join(' · ')}</span>
        </a>
        {has ? <button type="button" className="x-btn" style={{ width: 34 }} aria-label={open ? 'Steckbrief zuklappen' : 'Steckbrief zeigen'} onClick={() => setOpen(!open)}>{open ? '▴' : '▾'}</button> : <a href={`#/karriere/job/${j.id}`} aria-label="Öffnen"><Chevron /></a>}
      </div>
      {open && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {j.about && <span className="tiny" style={{ color: 'var(--text)' }}>🏢 {j.about}</span>}
          {(j.tasks || []).length > 0 && <div className="analysis-list"><b>Aufgaben</b>{j.tasks.slice(0, 5).map((x, i) => <span key={i}>– {x}</span>)}</div>}
          {(j.reqs || []).length > 0 && <div className="analysis-list"><b>Anforderungen</b>{j.reqs.slice(0, 6).map((x, i) => <span key={i}>– {x}</span>)}</div>}
          <a href={`#/karriere/job/${j.id}`} className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }}>Stelle öffnen ›</a>
        </div>
      )}
    </div>
  );
}

// v0.73: Allgemeine Dokumente (für alle Bewerbungen) – habe ich / fehlt
function Docs({ s }) {
  const [text, setText] = useState('');
  const [open, setOpenRaw] = useState(() => { try { return localStorage.getItem('life-app-docs-open') !== '0'; } catch { return true; } });
  const setOpen = (v) => { setOpenRaw(v); try { localStorage.setItem('life-app-docs-open', v ? '1' : '0'); } catch {} };
  const done = s.careerDocs.filter((d) => d.done).length;
  return (
    <section className="group">
      <button type="button" className="sec-h" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <h2 className="h2" style={{ fontSize: 19 }}>📁 Allgemeine Dokumente</h2>
        <span className="tiny">{done} von {s.careerDocs.length} vorhanden {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="list">
          {[...s.careerDocs.filter((d) => !d.done), ...s.careerDocs.filter((d) => d.done)].map((d) => (
            <div key={d.id} className="row" style={{ minHeight: 46 }}>
              <span className="row-main"><span className="row-title plain">{d.text}</span></span>
              <button type="button" className={d.done ? 'pill on' : 'pill'} style={d.done ? undefined : { color: 'var(--danger)' }} onClick={() => toggleDoc(d.id)}>{d.done ? '✓ Hab ich' : 'Fehlt'}</button>
              <button type="button" className="x-btn" aria-label={`${d.text} löschen`} onClick={() => removeDoc(d.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
            </div>
          ))}
          <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addDoc(text); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Weiteres Dokument, z.B. Arbeitszeugnis" aria-label="Weiteres Dokument" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        </div>
      )}
      {open && <Info>Gilt für alle Bewerbungen. Was nur eine Stelle braucht, kommt in deren Checkliste.</Info>}
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
        <Docs s={s} />
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
            <div className="list">{STAGES.filter((x) => x.id !== 'abgesagt').flatMap((st) => jobs.filter((j) => j.status === st.id)).map((j) => <JobRow key={j.id} j={j} s={s} showSearch />)}</div>
          </section>
        )}
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

// v0.92: Reiter-Leiste wie bei Events
function MainTabs({ tabs, cur, onChange }) {
  return (
    <div className="box-tabs main-tabs">
      {tabs.map(([k, l, n]) => <button key={k} type="button" className={cur === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => onChange(k)}>{l}{n ? ` · ${n}` : ''}</button>)}
    </div>
  );
}
const useTab = (key, init) => {
  const [v, setV] = useState(() => { try { return sessionStorage.getItem(key) || init; } catch { return init; } });
  return [v, (x) => { setV(x); try { sessionStorage.setItem(key, x); } catch {} }];
};
// v0.92: Vorbereitung für die ganze Suche – Liste + KI-Vorschläge zum Antippen
function SearchPrep({ s, search }) {
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState(null);
  useEffect(() => { if (!search.prep) ensureList('sprep', search.id); }, [search.id, !!search.prep]);
  const list = search.prep || [];
  const left = (sugg || []).filter((x) => !list.some((y) => y.text.toLowerCase() === x.text.toLowerCase()));
  return (
    <>
      <span className="sub" style={{ marginTop: -4 }}>Was du allgemein drauf haben solltest, um dich für „{search.name}“ gut zu bewerben.</span>
      <GroupedChecklist items={list} cats={Object.keys(SEARCH_PREP)} color={BLUE} tabKey={`life-sprep-${search.id}`} onAdd={(text, cat) => catList.add('sprep', search.id, text, cat)} onToggle={(id) => catList.toggle('sprep', search.id, id)} onRemove={(id) => catList.remove('sprep', search.id, id)} placeholder="Neuer Punkt" />
      <section className="card" style={{ gap: 8 }}>
        <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} disabled={busy || !getAi().apiKey} onClick={async () => { setBusy(true); try { setSugg(await suggestSearchPrep(s, search)); } catch (e) { toast(errText(e)); } finally { setBusy(false); } }}>{busy ? 'Ich überlege …' : '✨ Was sollte ich noch können/wissen?'}</button>
        {left.length > 0 && <><span className="tiny">Antippen = auf die Liste</span><div className="chips">{left.map((x) => <button key={x.text} type="button" className="chip" onClick={() => catList.add('sprep', search.id, x.text, SEARCH_PREP[x.teil] ? x.teil : 'Fähigkeiten')}>+ {x.text} <span className="tiny">· {x.teil}</span></button>)}</div></>}
        {sugg && !left.length && <span className="tiny">Alles schon auf der Liste.</span>}
        <Info>Ohne Internet, nutzt die Anforderungen deiner gespeicherten Stellen (unter 0,1 Cent).</Info>
      </section>
    </>
  );
}

function SearchPage({ s, search }) {
  const [tab, setTab] = useTab(`life-search-tab-${search.id}`, 'uebersicht');
  const [stage, setStage] = useTab(`life-search-stage-${search.id}`, 'alle');
  useEffect(() => { if (tab === 'todos' && !search.todos) ensureList('todos', search.id); }, [tab, search.id, !!search.todos]);
  const [manual, setManual] = useState({ title: '', company: '', url: '', description: '', status: 'interessiert' });
  const [adding, setAdding] = useState(false);
  const [imp, setImp] = useState(null); // Text/Link(s) zum Übernehmen
  const [impBusy, setImpBusy] = useState(false);
  const [found, setFound] = useState(null); // erkannte Stellen zum Abhaken
  const [pick, setPick] = useState({});
  const runImport = async () => {
    setImpBusy(true);
    try {
      const list = await importJobs(s, imp);
      setFound(list);
      setPick(Object.fromEntries(list.map((_, i) => [i, true])));
    } catch (e) {
      toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setImpBusy(false);
    }
  };
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

        <MainTabs cur={tab} onChange={setTab} tabs={[['uebersicht', 'Übersicht', 0], ['stellen', 'Stellen', jobs.filter(active).length], ['todos', 'To-dos', (search.todos || []).filter((x) => !x.done).length], ['prep', 'Vorbereitung', (search.prep || []).filter((x) => !x.done).length]]} />

        {tab === 'uebersicht' && <>
        <Funnel jobs={jobs} />
        <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => { setTab('stellen'); setAdding(true); }}>+ Stelle hinzufügen</button>
        </>}

        {tab === 'stellen' && <section className="group">
          <div className="box-tabs">
            {[{ id: 'alle', short: 'Alle' }, ...STAGES].map((st) => { const n = st.id === 'alle' ? jobs.length : jobs.filter((j) => j.status === st.id).length; return <button key={st.id} type="button" className={stage === st.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setStage(st.id)}>{st.short}{n ? ` · ${n}` : ''}</button>; })}
          </div>
          <div className="sec-h">
            <h2 className="h2" style={{ fontSize: 19 }}>{stage === 'alle' ? 'Alle Stellen' : stageOf(stage).label}</h2>
            <span style={{ display: 'flex', gap: 14 }}>
              {!adding && <button type="button" className="link-btn" onClick={() => setImp(imp === null ? '' : null)}>📥 Übernehmen</button>}
              <button type="button" className="link-btn" onClick={() => { setAdding(!adding); setImp(null); }}>{adding ? 'Abbrechen' : '+ Selbst'}</button>
            </span>
          </div>
          {imp !== null && !adding && (
            <div className="take-box">
              <Info>Einen oder <b>mehrere Links</b> (je eine Zeile) oder Anzeigentexte einfügen. Die KI legt pro Stelle einen Steckbrief an: Firma, Ort, Remote, Gehalt, Aufgaben, Anforderungen.</Info>
              <div style={{ position: 'relative' }}>
                <textarea className="input" style={{ minHeight: 90, paddingRight: 36, width: '100%' }} data-noclear="" value={imp} onChange={(e) => setImp(e.target.value)} placeholder="https://… oder Text der Anzeige" aria-label="Link oder Anzeigentext" />
                {imp && <button type="button" className="x-btn" style={{ position: 'absolute', top: 6, right: 6 }} onClick={() => { setImp(''); setFound(null); }} aria-label="Feld leeren"><Icon name="x" size={13} color="var(--chev)" /></button>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn small" style={{ flex: 1 }} onClick={runImport} disabled={impBusy || !imp.trim() || !getAi().apiKey}>{impBusy ? 'Ich lese die Anzeigen …' : '✨ Erkennen'}</button>
                <button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setImp(t); } catch { toast('Lange ins Feld tippen → Einsetzen'); } }}>📋 Einfügen</button>
              </div>
              <Info>Ca. 0,1–0,3 Cent pro Stelle. LinkedIn zeigt Anzeigen oft nur angemeldet – klappt der Link nicht, den Text kopieren.</Info>
              {found && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  <span className="label" style={{ padding: 0 }}>Erkannt: {found.length} {found.length === 1 ? 'Stelle' : 'Stellen'}</span>
                  {found.map((j, i) => (
                    <label key={i} className="option" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!pick[i]} onChange={() => setPick({ ...pick, [i]: !pick[i] })} style={{ marginTop: 4 }} />
                      <span className="row-main">
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{j.title}{j.company ? ` · ${j.company}` : ''}</span>
                        <span className="tiny">{[j.location, WORK_MODES[j.mode], j.salary].filter(Boolean).join(' · ') || 'Keine weiteren Infos gefunden'}</span>
                        {j.reqs.length > 0 && <span className="tiny" style={{ color: 'var(--text)' }}>{j.reqs.slice(0, 3).join(' · ')}</span>}
                        {!j.description && !j.reqs.length && <span className="tiny" style={{ color: 'var(--danger)' }}>Seite nicht lesbar – nur der Titel aus dem Link. Besser: Anzeigentext kopieren und einfügen.</span>}
                      </span>
                      <button type="button" className="x-btn" onClick={(e) => { e.preventDefault(); const next = found.filter((_, k) => k !== i); setFound(next.length ? next : null); setPick(Object.fromEntries(next.map((_, k) => [k, true]))); }} aria-label={`${j.title} verwerfen`}><Icon name="x" size={12} color="var(--chev)" /></button>
                    </label>
                  ))}
                  <button type="button" className="btn small" disabled={!Object.values(pick).some(Boolean)} onClick={() => { let n = 0; found.forEach((j, i) => { if (pick[i] && addJob({ searchId: search.id, ...j, status: 'interessiert' })) n++; }); setFound(null); setImp(null); toast(n ? `${n} ${n === 1 ? 'Stelle' : 'Stellen'} im Trichter (Interessiert)` : 'Schon vorhanden'); }}>{Object.values(pick).filter(Boolean).length} übernehmen</button>
                </div>
              )}
            </div>
          )}
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
          {jobs.length === 0 && <div className="list"><div className="empty">Noch keine Stellen. Erzähl in der Übersicht, wo du dich beworben hast – oder trag sie hier selbst ein.</div></div>}
          {stage === 'alle' ? STAGES.map((st) => {
            const list = jobs.filter((j) => j.status === st.id);
            if (!list.length) return null;
            return (
              <div key={st.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="label" style={{ padding: '0 4px' }}>{st.label} ({list.length})</span>
                <div className="list">{list.map((j) => <JobRow key={j.id} j={j} s={s} />)}</div>
              </div>
            );
          }) : (
            <div className="list">
              {jobs.filter((j) => j.status === stage).length === 0 && <div className="empty">Keine Stellen in „{stageOf(stage).label}“.</div>}
              {jobs.filter((j) => j.status === stage).map((j) => <JobRow key={j.id} j={j} s={s} />)}
            </div>
          )}
        </section>}

        {tab === 'todos' && <GroupedChecklist items={search.todos || []} cats={Object.keys(SEARCH_TODOS)} color={BLUE} tabKey={`life-stodo-${search.id}`} onAdd={(text, cat) => catList.add('todos', search.id, text, cat)} onToggle={(id) => catList.toggle('todos', search.id, id)} onRemove={(id) => catList.remove('todos', search.id, id)} placeholder="Neues To-do" />}
        {tab === 'prep' && <SearchPrep s={s} search={search} />}

        {tab === 'uebersicht' && <PlanChat
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
        />}

        {tab === 'uebersicht' && <button type="button" className="btn danger" onClick={() => { if (confirm(`Suche „${search.name}“ löschen? Stellen, die nur „Interessiert“ sind, werden mitgelöscht.`)) { removeSearch(search.id); go('/karriere'); } }}>Suche löschen</button>}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

// ---------- Eine Stelle ----------
const JOB_CHIPS = ['Anschreiben für diese Stelle', 'Lebenslauf anpassen', 'Arbeitsprobe / Case', 'Portfolio-Link', 'Referenzen anfragen', 'Fragen fürs Gespräch'];
const lines = (v) => String(v || '').split('\n').map((x) => x.replace(/^[-–•]\s*/, '').trim()).filter(Boolean);
// v0.73: Steckbrief der Stelle – alles Wichtige auf einen Blick, editierbar
function JobProfile({ s, job }) {
  const [busy, setBusy] = useState(false);
  const empty = !job.location && !job.mode && !(job.tasks || []).length && !(job.reqs || []).length;
  const fill = async () => {
    setBusy(true);
    try { await fillJobProfile(s, job); toast('Steckbrief ausgefüllt'); } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="card" style={{ gap: 10 }}>
      <div className="sec-h" style={{ padding: 0 }}>
        <span className="label" style={{ padding: 0 }}>Steckbrief</span>
        {(job.description || job.url) && getAi().apiKey && <button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={fill} disabled={busy}>{busy ? 'Ich lese …' : empty ? '✨ Aus Anzeige ausfüllen' : '✨ Neu aus Anzeige'}</button>}
      </div>
      <input className="input" defaultValue={job.about || ''} key={job.id + 'ab' + (job.about || '')} placeholder="Unternehmen – was machen sie?" onBlur={(e) => e.target.value !== (job.about || '') && updateJob(job.id, { about: e.target.value })} aria-label="Über das Unternehmen" />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" defaultValue={job.location || ''} key={job.id + 'lo' + (job.location || '')} placeholder="Ort" onBlur={(e) => e.target.value !== (job.location || '') && updateJob(job.id, { location: e.target.value })} aria-label="Ort" />
        <input className="input" defaultValue={job.salary || ''} key={job.id + 'sa' + (job.salary || '')} placeholder="Gehalt" onBlur={(e) => e.target.value !== (job.salary || '') && updateJob(job.id, { salary: e.target.value })} aria-label="Gehalt" />
      </div>
      <div className="chips">{Object.entries(WORK_MODES).map(([k, v]) => <button key={k} type="button" className={job.mode === k ? 'chip on' : 'chip soft'} style={{ fontSize: 13, padding: '5px 10px' }} onClick={() => updateJob(job.id, { mode: job.mode === k ? '' : k })}>{v}</button>)}</div>
      <label className="field" style={{ margin: 0 }}><span>Jobprofil – Aufgaben (eine pro Zeile)</span>
        <textarea className="input" style={{ minHeight: 80 }} defaultValue={(job.tasks || []).join('\n')} key={job.id + 'ta' + (job.tasks || []).join('|')} placeholder="z.B. Dealflow sichten" onBlur={(e) => updateJob(job.id, { tasks: lines(e.target.value) })} />
      </label>
      <label className="field" style={{ margin: 0 }}><span>Anforderungen (eine pro Zeile)</span>
        <textarea className="input" style={{ minHeight: 80 }} defaultValue={(job.reqs || []).join('\n')} key={job.id + 're' + (job.reqs || []).join('|')} placeholder="z.B. 2+ Jahre Consulting" onBlur={(e) => updateJob(job.id, { reqs: lines(e.target.value) })} />
      </label>
    </section>
  );
}

function List({ title, items }) {
  if (!items?.length) return null;
  return <div className="analysis-list"><b>{title}</b>{items.map((x, i) => <span key={i}>– {x}</span>)}</div>;
}
// v0.92: Phase als eine Klappe statt vieler Knöpfe
function StageMenu({ job }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <button type="button" className="drop-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Phase der Bewerbung"><span className="tiny">Phase:</span><span>{stageOf(job.status).label}</span><span className="drop-caret">▾</span></button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="drop-menu">
            {STAGES.map((st) => <button key={st.id} type="button" className={st.id === job.status ? 'on' : ''} onClick={() => { updateJob(job.id, { status: st.id }); setOpen(false); }}>{st.label}{st.id === job.status ? ' ✓' : ''}</button>)}
          </div>
        </>
      )}
    </div>
  );
}

// v0.92: Vorbereitung auf diese Stelle – KI-Recherche (mit/ohne Internet) + Liste nach Teilen
function JobPrep({ s, job }) {
  const [busy, setBusy] = useState(null);
  useEffect(() => { if (!job.prep) ensureList('prep', job.id); }, [job.id, !!job.prep]);
  const r = job.research;
  const run = async (web) => {
    setBusy(web ? 'web' : 'fast');
    try { await researchJob(s, job, { web }); toast('Recherche fertig – Punkte ergänzt'); } catch (e) { toast(errText(e)); } finally { setBusy(null); }
  };
  return (
    <>
      <section className="card checkin" style={{ gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}><span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> Recherche zu {job.company || 'der Firma'}</span>
        <div className="search-row">
          <button type="button" className="btn small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => run(true)}>{busy === 'web' ? 'Ich recherchiere …' : '🔍 Mit Internet'}</button>
          <button type="button" className="btn tint small" style={{ flex: 1 }} disabled={!!busy || !getAi().apiKey} onClick={() => run(false)}>{busy === 'fast' ? '…' : 'Ohne Internet'}</button>
        </div>
        <Info>Mit Internet: Firma, News, Kultur, wer interviewt – ca. 3–4 Cent. Ohne Internet: aus dem Wissen der KI, unter 0,1 Cent.</Info>
        {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich suche Infos zu {job.company || 'der Firma'} …</span></div>}
        {!busy && r && (
          <>
            <span className="tiny">Stand {fmtShort(r.date)}{r.web ? ' · mit Internet' : ' · ohne Internet'}</span>
            {r.firma && <p className="coach-summary">{r.firma}</p>}
            <List title="Aktuelles" items={r.news} />
            {r.kultur && <div className="analysis-list"><b>Kultur</b><span>{r.kultur}</span></div>}
            <List title="Menschen" items={r.menschen} />
            <List title="Wahrscheinliche Fragen" items={r.fragen} />
            <List title="Deine Rückfragen" items={r.eigene_fragen} />
            {(r.quellen || []).length > 0 && <div className="chips">{r.quellen.slice(0, 6).map((q) => <a key={q.url} className="link-chip" href={q.url} target="_blank" rel="noreferrer">{(q.titel || q.url).slice(0, 40)} ↗</a>)}</div>}
          </>
        )}
        <div className="chips">
          {job.company && <a className="pill" href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${job.company} recruiter`)}`} target="_blank" rel="noreferrer">👤 Recruiter (LinkedIn) ↗</a>}
          {job.company && <a className="pill" href={`https://www.google.com/search?q=${encodeURIComponent(`${job.company} interview ${job.title}`)}`} target="_blank" rel="noreferrer">💬 Interview-Erfahrungen ↗</a>}
          {job.company && <a className="pill" href={`https://www.google.com/search?q=${encodeURIComponent(job.company)}&tbm=nws`} target="_blank" rel="noreferrer">📰 News ↗</a>}
        </div>
      </section>
      <GroupedChecklist items={job.prep || []} cats={Object.keys(JOB_PREP)} color={BLUE} tabKey={`life-jprep-${job.id}`} onAdd={(text, cat) => catList.add('prep', job.id, text, cat)} onToggle={(id) => catList.toggle('prep', job.id, id)} onRemove={(id) => catList.remove('prep', job.id, id)} placeholder="Vorbereiten" />
    </>
  );
}

// v0.92: To-dos pro Phase – jede Phase hat ihre eigene Liste, die erhalten bleibt
function JobTodos({ job }) {
  const items = [];
  const stageOfItem = {};
  for (const st of STAGES) for (const x of checksOf(job, st.id)) { items.push({ ...x, cat: st.short }); stageOfItem[x.id] = st.id; }
  const byShort = Object.fromEntries(STAGES.map((st) => [st.short, st.id]));
  return (
    <>
      <span className="sub" style={{ marginTop: -4 }}>Jede Phase hat ihre eigene Checkliste – beim Phasenwechsel bleibt alles erhalten.</span>
      <GroupedChecklist key={job.id + job.status} items={items} cats={STAGES.map((st) => st.short)} initialTab={stageOf(job.status).short} allowNewCat={false} tabProgress color={BLUE}
        onAdd={(text, cat) => stageCheck.add(job.id, byShort[cat] || job.status, text)}
        onToggle={(id) => stageCheck.toggle(job.id, stageOfItem[id], id)}
        onRemove={(id) => stageCheck.remove(job.id, stageOfItem[id], id)} placeholder="Neuer Schritt" />
    </>
  );
}

function JobPage({ s, job }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useTab(`life-job-tab-${job.id}`, 'ueberblick');
  const a = job.analysis;
  const search = s.jobSearches.find((x) => x.id === job.searchId);
  const run = async (smart) => {
    setBusy(smart ? 'smart' : 'fast');
    setErr(null);
    try {
      await analyzeJob(s, job, { smart });
      toast('Analyse fertig – To-dos ergänzt');
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
  const cc = checkCount(job);
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Back href={search ? `#/karriere/suche/${search.id}` : '#/karriere'} label={search?.name || 'Jobsuche'} />
          <input className="input title-input" defaultValue={job.title} key={job.id + 't'} onBlur={(e) => e.target.value.trim() && e.target.value !== job.title && updateJob(job.id, { title: e.target.value.trim() })} aria-label="Stelle" />
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input goal-input" defaultValue={job.company} key={job.id + 'c'} placeholder="Firma" onBlur={(e) => e.target.value !== job.company && updateJob(job.id, { company: e.target.value })} aria-label="Firma" />
            {job.url && <a className="pill" href={job.url} target="_blank" rel="noreferrer" style={{ alignSelf: 'center' }}>Anzeige</a>}
          </div>
          <StageMenu job={job} />
        </div>

        <MainTabs cur={tab} onChange={setTab} tabs={[['ueberblick', 'Überblick', 0], ['todos', 'To-dos', cc.all - cc.done], ['prep', 'Vorbereitung', (job.prep || []).filter((x) => !x.done).length]]} />

        {tab === 'todos' && <JobTodos job={job} />}
        {tab === 'prep' && <JobPrep s={s} job={job} />}

        {tab === 'ueberblick' && <>
        <JobProfile s={s} job={job} />

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
          <Info>Kopiert Stelle, Analyse und dein Profil als Text – in Claude einfügen und dort Anschreiben, Lebenslauf und Interview vorbereiten.</Info>
        </section>

        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Notizen & Frist</span>
          <textarea className="input" defaultValue={job.note} key={job.id + 'no'} placeholder="Kontakte, Gesprächsnotizen, Gehalt …" onBlur={(e) => e.target.value !== job.note && updateJob(job.id, { note: e.target.value })} aria-label="Notizen" />
          <div className="field"><span>Bewerbungsfrist</span><DateRangeField single from={job.deadline || ''} to="" onChange={(v) => updateJob(job.id, { deadline: v.from || '' })} placeholder="Keine Frist" title="Bewerbungsfrist" /></div>
        </section>
        <button type="button" className="btn danger" onClick={() => { if (confirm('Stelle löschen?')) { removeJob(job.id); go(search ? `/karriere/suche/${search.id}` : '/karriere'); } }}>Stelle löschen</button>
        </>}
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
