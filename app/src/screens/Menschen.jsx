// Menschen (v0.94, Mateo): zwei Reiter – „Liste“ (alle Kontakte, Kategorie-Filter, schnell sortieren per Antippen)
// und „Im Kontakt bleiben“ (wer ist dran, Geburtstage, Rhythmus pro Person festlegen)
import { useState } from 'react';
import { store, useStore } from '../lib/store';
import { daysUntilBirthday, diffDays, relDays, targetText, today } from '../lib/dates';
import { initials, lastContact, peopleOverdue, upcomingBirthdays, waLink } from '../lib/logic';
import { logContact } from '../lib/actions';
import { Check, Icon, Segmented, TabBar, toast } from '../components/ui';
import { PEOPLE_CATEGORIES } from '../lib/seed';
import ContactImport from '../components/ContactImport';

export const AVATAR = {
  familie: ['#FDE8E1', '#B4472B'],
  freunde: ['#FEF1DC', '#9A6206'],
  neu: ['#E2F4EA', '#1F7A4D'],
  beruflich: ['#E6EEFC', '#2A54B8'],
};
export const RHYTHMS = [
  { v: 0, label: 'Kein Rhythmus', short: '–' },
  { v: 7, label: 'Wöchentlich', short: '1×/Woche' },
  { v: 14, label: 'Alle 2 Wochen', short: '2 Wochen' },
  { v: 30, label: 'Monatlich', short: '1×/Monat' },
  { v: 60, label: 'Alle 2 Monate', short: '2 Monate' },
  { v: 90, label: 'Quartalsweise', short: 'Quartal' },
  { v: 180, label: 'Halbjährlich', short: 'Halbjahr' },
];
const catLabel = (id) => PEOPLE_CATEGORIES.find((c) => c.id === id)?.label || 'Ohne Kategorie';
const remember = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// mehrere Personen auf einmal ändern (Kategorie oder Rhythmus)
function bulk(ids, patch) {
  store.update((s) => { for (const p of s.people) if (ids.includes(p.id)) Object.assign(p, patch); });
}
function setRhythm(id, v) {
  store.update((s) => { const p = s.people.find((x) => x.id === id); if (p) p.contactEvery = v || null; });
}

function Avatar({ p }) {
  const [bg, fg] = AVATAR[p.category] || ['#EEF0F3', '#6B7280'];
  return <span className="avatar" style={{ background: bg, color: fg }}>{initials(p.name)}</span>;
}
function WaBtn({ p }) {
  const wa = waLink(p);
  return wa ? <a className="pill" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp-Chat mit ${p.name} öffnen`}>WhatsApp</a> : <a href={`#/person/${p.id}`} aria-label={`${p.name} öffnen`}><Icon name="chev" size={16} color="var(--chev)" /></a>;
}

function CatChips({ s, filter, setFilter }) {
  const n = (id) => (id === 'alle' ? s.people.length : id === 'ohne' ? s.people.filter((p) => !PEOPLE_CATEGORIES.some((c) => c.id === p.category)).length : s.people.filter((p) => p.category === id).length);
  const opts = [{ id: 'alle', label: 'Alle' }, ...PEOPLE_CATEGORIES, ...(n('ohne') ? [{ id: 'ohne', label: 'Ohne' }] : [])];
  return (
    <div className="box-tabs" role="group" aria-label="Kategorie">
      {opts.map((f) => <button key={f.id} type="button" className={filter === f.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} · {n(f.id)}</button>)}
    </div>
  );
}
const inCat = (p, filter) => filter === 'alle' || (filter === 'ohne' ? !PEOPLE_CATEGORIES.some((c) => c.id === p.category) : p.category === filter);

function ListTab({ s, t }) {
  const [filter, setFilterState] = useState(() => remember('life-app-people-cat', 'alle'));
  const setFilter = (v) => { setFilterState(v); keep('life-app-people-cat', v); };
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null); // null = normal, [] = Sortier-Modus
  const list = s.people.filter((p) => inCat(p, filter) && (!q.trim() || [p.name, p.metAt, p.notes].join(' ').toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const assign = (patch, text) => { bulk(sel, patch); toast(`${sel.length} ${text}`); setSel([]); };
  return (
    <>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name suchen …" aria-label="Personen suchen" />
      <CatChips s={s} filter={filter} setFilter={setFilter} />
      <div className="sec-h" style={{ padding: '0 4px' }}>
        <span className="sub">{list.length} {list.length === 1 ? 'Person' : 'Personen'}</span>
        {sel === null
          ? <button type="button" className="pill" onClick={() => setSel([])}>☑︎ Sortieren</button>
          : <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => setSel(sel.length === list.length ? [] : list.map((p) => p.id))}>{sel.length === list.length && list.length ? 'Keine' : 'Alle'} auswählen</button>
              <button type="button" className="pill on" onClick={() => setSel(null)}>Fertig</button>
            </span>}
      </div>
      {sel !== null && <span className="tiny" style={{ padding: '0 4px', marginTop: -6 }}>Personen antippen, dann unten die Kategorie wählen.</span>}
      <div className="list" style={{ marginBottom: sel !== null ? 150 : 0 }}>
        {list.length === 0 && <div className="empty">{s.people.length ? 'Niemand in dieser Auswahl.' : 'Noch niemand eingetragen – oben „Aus Kontakten“ oder +.'}</div>}
        {list.map((p) => {
          const bd = daysUntilBirthday(p.birthday, t);
          const meta = [filter === 'alle' ? catLabel(p.category) : null, bd !== null && bd <= 30 ? `🎂 in ${bd} Tagen` : null].filter(Boolean).join(' · ');
          if (sel !== null) {
            const on = sel.includes(p.id);
            return (
              <button key={p.id} type="button" className="row compact" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none' }} onClick={() => toggle(p.id)} aria-pressed={on}>
                <span className={on ? 'check on' : 'check'} style={on ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}>{on && <Icon name="check" size={12} color="#fff" width={3} />}</span>
                <span className="row-main"><span className="row-title plain">{p.name}</span><span className="row-meta">{catLabel(p.category)}</span></span>
              </button>
            );
          }
          return (
            <div key={p.id} className="row" style={{ minHeight: 56 }}>
              <Avatar p={p} />
              <a href={`#/person/${p.id}`} className="row-main"><span className="row-title">{p.name}</span>{meta && <span className="row-meta">{meta}</span>}</a>
              <WaBtn p={p} />
            </div>
          );
        })}
      </div>
      {sel !== null && (
        <div className="sel-bar">
          <span style={{ fontWeight: 650, fontSize: 14 }}>{sel.length ? `${sel.length} ausgewählt → Kategorie:` : 'Personen antippen …'}</span>
          <div className="chips">
            {PEOPLE_CATEGORIES.map((c) => <button key={c.id} type="button" className="chip on small-chip" disabled={!sel.length} onClick={() => assign({ category: c.id }, `→ ${c.label}`)}>{c.label}</button>)}
          </div>
          <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>oder Rhythmus:
            <select className="input" style={{ width: 'auto', minHeight: 30, padding: '2px 8px', fontSize: 13 }} value="" disabled={!sel.length} onChange={(e) => e.target.value !== '' && assign({ contactEvery: Number(e.target.value) || null }, `→ ${RHYTHMS.find((r) => String(r.v) === e.target.value)?.label}`)}>
              <option value="">wählen …</option>
              {RHYTHMS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </label>
        </div>
      )}
    </>
  );
}

function KeepTab({ s, t }) {
  const [filter, setFilterState] = useState(() => remember('life-app-people-cat2', 'alle'));
  const setFilter = (v) => { setFilterState(v); keep('life-app-people-cat2', v); };
  const due = peopleOverdue(s, t);
  const bdays = upcomingBirthdays(s, t, 30);
  const people = s.people.filter((p) => inCat(p, filter)).sort((a, b) => a.name.localeCompare(b.name, 'de')); // alphabetisch – springt beim Ändern nicht weg
  return (
    <>
      <section className="group">
        <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Melde dich mal</h2><span className="sub">{due.length}</span></div>
        <div className="list">
          {due.length === 0 && <div className="empty">{s.people.some((p) => p.contactEvery) ? 'Alle im Rhythmus 👍' : 'Unten bei „Wie oft melden?“ für die wichtigen Menschen einen Rhythmus wählen – dann erscheinen sie hier, wenn es Zeit ist.'}</div>}
          {due.map(({ person: p, since }) => (
            <div key={p.id} className="row" style={{ minHeight: 56 }}>
              <Check on={(p.contacts || []).includes(t)} onClick={() => { logContact(p.id); toast(`Kontakt mit ${p.name} notiert`); }} label={`Kontakt mit ${p.name} heute notieren`} />
              <a href={`#/person/${p.id}`} className="row-main"><span className="row-title">{p.name}</span><span className="row-meta" style={{ color: 'var(--danger)' }}>{since === null ? 'Noch kein Kontakt notiert' : `Seit ${since} Tagen`} · {targetText(p.contactEvery)}</span></a>
              <WaBtn p={p} />
            </div>
          ))}
        </div>
      </section>

      {bdays.length > 0 && (
        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Geburtstage</h2><span className="sub">30 Tage</span></div>
          <div className="list">
            {bdays.map(({ person: p, inDays }) => (
              <div key={p.id} className="row" style={{ minHeight: 52 }}>
                <Avatar p={p} />
                <a href={`#/person/${p.id}`} className="row-main"><span className="row-title">{p.name}</span><span className="row-meta" style={{ color: inDays === 0 ? 'var(--danger)' : undefined }}>🎂 {inDays === 0 ? 'Heute' : inDays === 1 ? 'Morgen' : `in ${inDays} Tagen`}</span></a>
                <WaBtn p={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="group">
        <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Wie oft melden?</h2></div>
        <CatChips s={s} filter={filter} setFilter={setFilter} />
        <div className="list">
          {people.length === 0 && <div className="empty">Niemand in dieser Auswahl.</div>}
          {people.map((p) => {
            const last = lastContact(p);
            return (
              <div key={p.id} className="row compact">
                <a href={`#/person/${p.id}`} className="row-main"><span className="row-title plain">{p.name}</span><span className="row-meta">{last ? `Zuletzt ${relDays(diffDays(last, t))}` : 'Noch kein Kontakt notiert'}</span></a>
                <select className="input" style={{ width: 'auto', minHeight: 32, padding: '2px 8px', fontSize: 13, fontWeight: p.contactEvery ? 650 : 400, color: p.contactEvery ? 'var(--accent)' : 'var(--sub)' }} value={RHYTHMS.some((r) => r.v === (p.contactEvery || 0)) ? p.contactEvery || 0 : 0} onChange={(e) => setRhythm(p.id, Number(e.target.value))} aria-label={`Rhythmus für ${p.name}`}>
                  {RHYTHMS.map((r) => <option key={r.v} value={r.v}>{r.v ? r.short : 'Kein Ziel'}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function Menschen() {
  const s = useStore();
  const t = today();
  const [imp, setImp] = useState(false);
  const [tab, setTabState] = useState(() => remember('life-app-people-tab', 'liste'));
  const setTab = (v) => { setTabState(v); keep('life-app-people-tab', v); };
  const dueN = peopleOverdue(s, t).length;
  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Menschen</h1>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="link-btn" onClick={() => setImp(true)}>Aus Kontakten</button>
            <a href="#/person/neu" className="icon-btn" aria-label="Person hinzufügen"><Icon name="plus" size={18} width={2.2} /></a>
          </span>
        </div>
        <Segmented full options={[{ id: 'liste', label: `Liste · ${s.people.length}` }, { id: 'kontakt', label: `Im Kontakt bleiben${dueN ? ` · ${dueN}` : ''}` }]} value={tab} onChange={setTab} label="Ansicht" />
        {tab === 'liste' ? <ListTab s={s} t={t} /> : <KeepTab s={s} t={t} />}
      </main>
      <ContactImport s={s} open={imp} onClose={() => setImp(false)} />
      <TabBar active="menschen" />
    </>
  );
}
