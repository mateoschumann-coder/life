// Erfassen (v0.31): schnell festhalten und direkt in die Struktur der App einsortieren –
// von Hand (Ziel wählen) oder per KI („✨ KI sortiert ein“, nutzt dieselben Aktionen wie der Assistent)
import { useState } from 'react';
import { useStore, store } from '../lib/store';
import { addInbox, addPlace, addResource, addTask, PLACE_CATS, removeInbox, savePerson, updatePlace } from '../lib/actions';
import { addShopping, addSport, addSportEvent, SPORT_EVENT_STATUS } from '../lib/health';
import { addHobby, addHobbyItem, HOBBY_KINDS } from '../lib/leisure';
import { addTrip } from '../lib/trips';
import { addSkill, addSkillTodos } from '../lib/skills';
import { addJob, addSearch, STAGES } from '../lib/career';
import { addMaterial, ensureTopic, KINDS } from '../lib/library';
import { addReminder, EVERY } from '../lib/home';
import { addSource } from '../lib/news';
import { addLine, budgetOf, costCatsOf, CURRENCIES } from '../lib/budget';
import { applyActions, describe } from '../lib/apply';
import { buildSystem, getAi, TOOL } from '../lib/ai';
import { locate, searchWithTool } from '../lib/outings';
import { today } from '../lib/dates';
import { DateRangeField } from '../components/DateRange';
import { AreaSelect, Field, Sheet, SubSelect, TabBar, toast, Info } from '../components/ui';
import { PEOPLE_CATEGORIES } from '../lib/seed';

export const TARGETS = [
  { id: 'aufgabe', label: 'Aufgabe' },
  { id: 'idee', label: 'Idee' },
  { id: 'einkauf', label: 'Einkauf' },
  { id: 'sport', label: 'Sport-Event' },
  { id: 'hobby', label: 'Hobby' },
  { id: 'skill', label: 'Skill-Ziel' },
  { id: 'bewerbung', label: 'Bewerbung' },
  { id: 'lernen', label: 'Lernen' },
  { id: 'reise', label: 'Reise-Idee' },
  { id: 'ort', label: 'Ort' },
  { id: 'erinnerung', label: 'Erinnerung' },
  { id: 'fixkosten', label: 'Fixkosten' },
  { id: 'quelle', label: 'Quelle' },
  { id: 'person', label: 'Person' },
  { id: 'notiz', label: 'Notiz/Link' },
];
const LABEL = { ...Object.fromEntries(TARGETS.map((x) => [x.id, x.label])), link: 'Notiz/Link' };

// KI wählt das passende Ziel (eine oder wenige Aktionen, ohne Internet, sehr günstig)
async function aiSort(s, text) {
  const system = `${buildSystem(s)}

AUFGABE JETZT: Mateo hat schnell etwas festgehalten. Sortiere es in die passende Struktur der App ein – mit 1 bis 3 Aktionen über "aenderungen_vorschlagen" (z.B. sport_event_anlegen, hobby_eintrag, skill_ziel, bewerbung_eintragen, einkauf_hinzufuegen, material_anlegen, reise_anlegen, ort_anlegen, erinnerung_anlegen, fixkosten_anlegen, quelle_anlegen, person_anlegen, aufgabe_anlegen). Nimm bestehende Namen (Hobby, Skill, Sportart, Jobsuche) genau so, wie sie in den Daten stehen. Keine Rückfragen.`;
  const r = await searchWithTool({ system, user: text, tool: TOOL, maxUses: 0, maxTokens: 1200, label: 'Erfassen: KI sortiert' });
  return (r.aktionen || []).slice(0, 3);
}

export default function Erfassen() {
  const s = useStore();
  const [text, setText] = useState('');
  const [type, setType] = useState('aufgabe');
  const [sorting, setSorting] = useState(null);
  const [ai, setAi] = useState(null); // { inboxId, text, actions, picked }
  const [busy, setBusy] = useState(false);
  const hasKey = !!getAi().apiKey;

  const runAi = async (t, inboxId = null) => {
    setBusy(inboxId || 'neu');
    try {
      const actions = await aiSort(s, t);
      if (!actions.length) toast('Keine passende Stelle gefunden – sortier es von Hand ein');
      else setAi({ inboxId, text: t, actions, picked: actions.map(() => true) });
    } catch (e) {
      toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  const takeAi = () => {
    const labels = applyActions(ai.actions.filter((_, i) => ai.picked[i]));
    if (labels.length) {
      toast(`Eingetragen: ${labels.join(' · ')}`);
      if (ai.inboxId) removeInbox(ai.inboxId);
      else setText('');
    }
    setAi(null);
  };

  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Erfassen</h1>
        </div>
        <section className="card">
          <label htmlFor="capture" className="label">Was willst du festhalten?</label>
          <textarea id="capture" className="input" style={{ fontSize: 18, minHeight: 110 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. Halbmarathon in Rosario im April merken · Hotel California für Gitarre · Bei Kaszek beworben" />
          <Info>Tipp: Mikrofon auf der Tastatur antippen, um zu diktieren.</Info>
        </section>
        {hasKey && (
          <button type="button" className="btn" disabled={!text.trim() || !!busy} onClick={() => runAi(text.trim())}>{busy === 'neu' ? 'Ich sortiere ein …' : '✨ KI sortiert ein'}</button>
        )}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="label">{hasKey ? 'Oder selbst wählen, wohin es gehört' : 'Wohin gehört es?'}</h2>
          <div className="chips" style={{ gap: 8 }}>
            {TARGETS.map((x) => (
              <button key={x.id} type="button" className={type === x.id ? 'chip on' : 'chip'} aria-pressed={type === x.id} onClick={() => setType(x.id)}>{x.label}</button>
            ))}
          </div>
        </section>
        <div className="btn-row">
          <button type="button" className="btn sec" disabled={!text.trim()} onClick={() => { addInbox(text, type); setText(''); toast('In der Inbox'); }}>In die Inbox</button>
          <button type="button" className={hasKey ? 'btn sec' : 'btn'} disabled={!text.trim()} onClick={() => setSorting({ id: null, text: text.trim(), type })}>Einsortieren</button>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="sec-h">
            <h2 className="h2">Inbox</h2>
            <span className="sub">{s.inbox.length} unsortiert</span>
          </div>
          <div className="list">
            {s.inbox.length === 0 && <div className="empty">Leer. Alles, was du schnell erfasst, landet hier, bis du es einsortierst.</div>}
            {s.inbox.map((i) => (
              <div key={i.id} className="row">
                <div className="row-main">
                  <span className="row-title plain">{i.text}</span>
                  <span className="row-meta">{LABEL[i.type] || 'Notiz'}</span>
                </div>
                {hasKey && <button type="button" className="pill" disabled={!!busy} onClick={() => runAi(i.text, i.id)} aria-label={`${i.text} von der KI einsortieren lassen`}>{busy === i.id ? '…' : '✨'}</button>}
                <button type="button" className="pill" onClick={() => setSorting({ id: i.id, text: i.text, type: LABEL[i.type] ? (i.type === 'link' ? 'notiz' : i.type) : 'notiz' })}>Einsortieren</button>
              </div>
            ))}
          </div>
        </section>
      </main>
      {sorting && (
        <SortSheet
          s={s}
          item={sorting}
          onClose={() => setSorting(null)}
          onDone={(msg) => {
            if (sorting.id) removeInbox(sorting.id);
            else setText('');
            setSorting(null);
            toast(msg || 'Einsortiert');
          }}
        />
      )}
      <Sheet open={!!ai} title="So würde ich es einsortieren" onClose={() => setAi(null)}>
        {ai && (
          <>
            <span className="sub">„{ai.text}“</span>
            <div className="list">
              {ai.actions.map((a, i) => {
                const d = describe(store.get(), a);
                return (
                  <label key={i} className="row" style={{ minHeight: 52, opacity: d.ok ? 1 : 0.5 }}>
                    <input type="checkbox" checked={ai.picked[i] && d.ok} disabled={!d.ok} onChange={() => setAi({ ...ai, picked: ai.picked.map((p, j) => (j === i ? !p : p)) })} />
                    <span className="row-main"><span className="row-title plain">{d.label}</span>{!d.ok && d.reason && <span className="row-meta">{d.reason}</span>}</span>
                  </label>
                );
              })}
            </div>
            <button type="button" className="btn" onClick={takeAi} disabled={!ai.actions.some((a, i) => ai.picked[i] && describe(store.get(), a).ok)}>Übernehmen</button>
            <button type="button" className="btn tint" onClick={() => { setSorting({ id: ai.inboxId, text: ai.text, type: 'aufgabe' }); setAi(null); }}>Lieber selbst einsortieren</button>
          </>
        )}
      </Sheet>
      <TabBar active="erfassen" />
    </>
  );
}

const Chips = ({ list, value, onChange }) => (
  <div className="chips">{list.map(([id, label]) => <button key={id} type="button" className={value === id ? 'chip on' : 'chip soft'} onClick={() => onChange(id)}>{label}</button>)}</div>
);

function SortSheet({ s, item, onClose, onDone }) {
  const [as, setAs] = useState(item.type || 'aufgabe');
  const [title, setTitle] = useState(item.text);
  const [areaId, setAreaId] = useState('freizeit');
  const [projectId, setProjectId] = useState('');
  const [subId, setSubId] = useState(null);
  const [due, setDue] = useState('');
  const [category, setCategory] = useState('freunde');
  const [f, setF] = useState({
    sportId: s.sports[0]?.id || '', sportStatus: 'interessiert',
    hobbyId: s.hobbies[0]?.id || '', newHobby: '', hobbyKind: 'idee',
    skillId: (s.skills || [])[0]?.id || '', newSkill: '',
    searchId: (s.jobSearches || [])[0]?.id || '', company: '', stage: 'interessiert',
    libCat: s.libCats[0]?.id || 'bibliothek', kind: s.libCats[0]?.kind || 'buch',
    placeCat: 'Bar', every: 'monat', url: '', amount: '', currency: 'ARS', costCat: 'sonstiges',
  });
  const set = (patch) => setF({ ...f, ...patch });
  const area = s.areas.find((a) => a.id === areaId);
  const projects = s.projects.filter((p) => p.areaId === areaId && p.status === 'aktiv');
  const t = title.trim();
  const isUrl = /^https?:\/\//i.test(t);

  const save = () => {
    switch (as) {
      case 'person': savePerson({ name: t, category, contactEvery: null, birthday: '', phone: '', notes: '' }); return onDone('Person angelegt');
      case 'notiz': addResource({ title: t, url: isUrl ? t : '', areaId, subId, projectId: projectId || null }); return onDone();
      case 'einkauf': { const n = addShopping(t.split(/[,\n]| und /).map((x) => x.trim())); return onDone(`${n || 0} auf der Einkaufsliste`); }
      case 'sport': { const sportId = f.sportId || addSport('Laufen'); addSportEvent({ sportId, name: t, date: due, status: f.sportStatus }); return onDone('Bei den Sport-Events'); }
      case 'hobby': { const hid = f.hobbyId === 'neu' || !f.hobbyId ? addHobby(f.newHobby || 'Hobby') : f.hobbyId; addHobbyItem(hid, { title: t, kind: f.hobbyKind }); return onDone('Beim Hobby eingetragen'); }
      case 'skill': { const nm = f.newSkill.trim() || 'Neuer Skill'; const kid = f.skillId === 'neu' || !f.skillId ? addSkill(nm) || (s.skills || []).find((k) => k.name.toLowerCase() === nm.toLowerCase())?.id : f.skillId; addSkillTodos(kid, [t]); return onDone('Auf der Ziel-Liste'); }
      case 'bewerbung': { const sid = f.searchId || addSearch({ name: 'Allgemein' }); addJob({ searchId: sid, title: t, company: f.company, status: f.stage }); return onDone('Im Bewerbungs-Trichter'); }
      case 'lernen': { const cat = s.libCats.find((c) => c.id === f.libCat); addMaterial({ title: t, kind: cat?.kind || f.kind, cat: f.libCat, subId: ensureTopic('Allgemein') }); return onDone(`In ${cat?.name || 'Bibliothek'}`); }
      case 'reise': addTrip({ name: t, status: 'idee' }); return onDone('Als Reise-Idee gemerkt');
      case 'ort': { const id = addPlace({ name: t, category: f.placeCat, status: 'will' }); locate(t).then((p) => p && updatePlace(id, { lat: p.lat, lon: p.lon })); return onDone('Bei den Orten'); }
      case 'erinnerung': addReminder({ title: t, every: f.every, next: due || today() }); return onDone('Erinnerung angelegt');
      case 'fixkosten': addLine('costs', { name: t, amount: Number(String(f.amount).replace(/\./g, '').replace(',', '.')) || 0, currency: f.currency, cat: f.costCat }); return onDone('Im Finanz-Rechner');
      case 'quelle': addSource({ name: isUrl ? '' : t, url: isUrl ? t : f.url }); return onDone('Bei deinen Quellen');
      default:
        addTask({ title: t, areaId: projectId ? null : areaId, subId: projectId ? null : subId, projectId: projectId || null, due: as === 'aufgabe' ? due || null : null, idea: as === 'idee' });
        return onDone();
    }
  };

  return (
    <Sheet open title="Einsortieren" onClose={onClose}>
      <div className="chips">{TARGETS.map((x) => <button key={x.id} type="button" className={as === x.id ? 'chip on' : 'chip soft'} onClick={() => setAs(x.id)}>{x.label}</button>)}</div>
      <Field label={as === 'person' ? 'Name' : as === 'einkauf' ? 'Was? (mehrere mit Komma)' : 'Text'}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      {as === 'person' && <Chips list={PEOPLE_CATEGORIES.map((c) => [c.id, c.label])} value={category} onChange={setCategory} />}
      {(as === 'aufgabe' || as === 'idee' || as === 'notiz') && (
        <>
          <Field label="Lebensbereich"><AreaSelect s={s} value={areaId} onChange={(v) => { setAreaId(v); setProjectId(''); setSubId(null); }} /></Field>
          <SubSelect area={area} value={subId} onChange={setSubId} />
          {projects.length > 0 && (
            <Field label="Projekt (optional)">
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">– kein Projekt –</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
        </>
      )}
      {as === 'sport' && (
        <>
          {s.sports.length ? <Chips list={s.sports.map((x) => [x.id, x.name])} value={f.sportId} onChange={(v) => set({ sportId: v })} /> : <span className="tiny">Noch keine Sportart – es wird „Laufen“ angelegt.</span>}
          <Chips list={Object.entries(SPORT_EVENT_STATUS)} value={f.sportStatus} onChange={(v) => set({ sportStatus: v })} />
        </>
      )}
      {as === 'hobby' && (
        <>
          <Chips list={[...s.hobbies.map((h) => [h.id, h.name]), ['neu', '+ Neues Hobby']]} value={f.hobbyId || 'neu'} onChange={(v) => set({ hobbyId: v })} />
          {(f.hobbyId === 'neu' || !f.hobbyId) && <input className="input" value={f.newHobby} onChange={(e) => set({ newHobby: e.target.value })} placeholder="Name des Hobbys, z.B. Gitarre" aria-label="Neues Hobby" />}
          <Chips list={Object.entries(HOBBY_KINDS)} value={f.hobbyKind} onChange={(v) => set({ hobbyKind: v })} />
        </>
      )}
      {as === 'skill' && (
        <>
          <Chips list={[...(s.skills || []).map((k) => [k.id, k.name]), ['neu', '+ Neuer Skill']]} value={f.skillId || 'neu'} onChange={(v) => set({ skillId: v })} />
          {(f.skillId === 'neu' || !f.skillId) && <input className="input" value={f.newSkill} onChange={(e) => set({ newSkill: e.target.value })} placeholder="z.B. Portugiesisch" aria-label="Neuer Skill" />}
        </>
      )}
      {as === 'bewerbung' && (
        <>
          <input className="input" value={f.company} onChange={(e) => set({ company: e.target.value })} placeholder="Firma" aria-label="Firma" />
          {(s.jobSearches || []).length > 0 && <Chips list={s.jobSearches.map((x) => [x.id, x.name])} value={f.searchId} onChange={(v) => set({ searchId: v })} />}
          <Chips list={STAGES.map((x) => [x.id, x.short])} value={f.stage} onChange={(v) => set({ stage: v })} />
        </>
      )}
      {as === 'lernen' && <Chips list={s.libCats.map((c) => [c.id, c.name])} value={f.libCat} onChange={(v) => set({ libCat: v, kind: s.libCats.find((c) => c.id === v)?.kind || f.kind })} />}
      {as === 'lernen' && !s.libCats.find((c) => c.id === f.libCat)?.kind && <Chips list={Object.entries(KINDS).map(([k, v]) => [k, v.label])} value={f.kind} onChange={(v) => set({ kind: v })} />}
      {as === 'ort' && <Chips list={PLACE_CATS.map((c) => [c, c])} value={f.placeCat} onChange={(v) => set({ placeCat: v })} />}
      {as === 'erinnerung' && <Chips list={Object.entries(EVERY)} value={f.every} onChange={(v) => set({ every: v })} />}
      {as === 'fixkosten' && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ flex: 1 }} value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="Betrag pro Monat" inputMode="decimal" aria-label="Betrag" />
            <select className="input" style={{ width: 84 }} value={f.currency} onChange={(e) => set({ currency: e.target.value })} aria-label="Währung">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <Chips list={costCatsOf(budgetOf(store.get())).map((c) => [c.id, c.label])} value={f.costCat} onChange={(v) => set({ costCat: v })} />
        </>
      )}
      {as === 'quelle' && !isUrl && <input className="input" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="Link, z.B. stratechery.com" inputMode="url" aria-label="Link" />}
      {(as === 'aufgabe' || as === 'sport' || as === 'erinnerung') && (
        <DateRangeField single from={due} to="" onChange={(v) => setDue(v.from)} placeholder={as === 'erinnerung' ? 'Nächstes Mal (optional)' : 'Datum (optional)'} title="Datum" />
      )}
      <button type="button" className="btn" onClick={save} disabled={!t}>Speichern</button>
    </Sheet>
  );
}
