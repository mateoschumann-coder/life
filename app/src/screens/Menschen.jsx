// Menschen (v0.94, Mateo): zwei Reiter – „Liste“ (alle Kontakte, Kategorie-Filter, schnell sortieren per Antippen)
// und „Im Kontakt bleiben“ (wer ist dran, Geburtstage, Rhythmus pro Person festlegen)
import { useState } from 'react';
import { store, useStore } from '../lib/store';
import { daysUntilBirthday, diffDays, fmtShort, relDays, targetText, today } from '../lib/dates';
import { contactDue, initials, lastContact, peopleOverdue, upcomingBirthdays, waLink, WHEN_IN_MONTH } from '../lib/logic';
import { logContact } from '../lib/actions';
import { Back, Check, Icon, Info, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { fromHeute } from '../lib/router';
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
  { v: -1, label: 'Läuft von selbst', short: 'Läuft von selbst' },
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
// v: Tage · -1 = „Läuft von selbst“ (man hat sowieso Kontakt, keine Erinnerung) · 0 = kein Ziel
function rhythmPatch(p, v) {
  if (v === -1) return { contactEvery: null, natural: true };
  return { contactEvery: v > 0 ? v : null, natural: false, ...(v > 0 && !p.contactEvery ? { rhythmSince: today() } : {}) };
}
function setRhythm(id, v) {
  store.update((s) => { const p = s.people.find((x) => x.id === id); if (p) Object.assign(p, rhythmPatch(p, v)); });
}
function setWhen(id, w) {
  store.update((s) => { const p = s.people.find((x) => x.id === id); if (p) p.when = w; });
}
const rhythmValue = (p) => (p.natural ? -1 : RHYTHMS.some((r) => r.v === (p.contactEvery || 0)) ? p.contactEvery || 0 : 0);

function Avatar({ p }) {
  const [bg, fg] = AVATAR[p.category] || ['#EEF0F3', '#6B7280'];
  return <span className="avatar" style={{ background: bg, color: fg }}>{initials(p.name)}</span>;
}
function WaBtn({ p }) {
  const wa = waLink(p);
  return wa ? <a className="pill" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp-Chat mit ${p.name} öffnen`}>WhatsApp</a> : <a href={`#/person/${p.id}`} aria-label={`${p.name} öffnen`}><Icon name="chev" size={16} color="var(--chev)" /></a>;
}

// v1.18 (Mateo): Kategorie als ein Knopf, der ein kleines Auswahlfenster öffnet (statt Wisch-Leiste)
function CatChips({ s, filter, setFilter }) {
  const [open, setOpen] = useState(false);
  const n = (id) => (id === 'alle' ? s.people.length : id === 'ohne' ? s.people.filter((p) => !PEOPLE_CATEGORIES.some((c) => c.id === p.category)).length : s.people.filter((p) => p.category === id).length);
  const opts = [{ id: 'alle', label: 'Alle' }, ...PEOPLE_CATEGORIES, ...(n('ohne') ? [{ id: 'ohne', label: 'Ohne Kategorie' }] : [])];
  const cur = opts.find((o) => o.id === filter) || opts[0];
  return (
    <>
      <button type="button" className={filter === 'alle' ? 'chip soft' : 'chip on'} style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)} aria-label="Kategorie wählen">👥 {cur.label} · {n(cur.id)} ▾</button>
      <Sheet open={open} title="Kategorie" onClose={() => setOpen(false)}>
        <div className="list">
          {opts.map((f) => (
            <button key={f.id} type="button" className="row compact" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={() => { setFilter(f.id); setOpen(false); }} aria-pressed={filter === f.id}>
              <span className="row-main"><span className="row-title plain">{f.label}</span></span>
              <span className="tiny">{n(f.id)}</span>
              {filter === f.id && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
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
            <select className="input" style={{ width: 'auto', minHeight: 30, padding: '2px 8px', fontSize: 13 }} value="" disabled={!sel.length} onChange={(e) => { if (e.target.value === '') return; const v = Number(e.target.value); store.update((st) => { for (const p of st.people) if (sel.includes(p.id)) Object.assign(p, rhythmPatch(p, v)); }); toast(`${sel.length} → ${RHYTHMS.find((r) => r.v === v)?.label}`); setSel([]); }}>
              <option value="">wählen …</option>
              {RHYTHMS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </label>
        </div>
      )}
    </>
  );
}

function DueRow({ x, t, soon }) {
  const p = x.person;
  return (
    <div className="row" style={{ minHeight: 56 }}>
      <Check on={(p.contacts || []).includes(t)} onClick={() => { logContact(p.id); toast(`Kontakt mit ${p.name} notiert`); }} label={`Kontakt mit ${p.name} heute notieren`} />
      <a href={`#/person/${p.id}`} className="row-main">
        <span className="row-title">{p.name}</span>
        <span className="row-meta" style={{ color: soon ? undefined : 'var(--danger)' }}>{soon ? `ab ${fmtShort(x.due)}` : x.since === null ? 'Noch kein Kontakt notiert' : `Zuletzt vor ${x.since} Tagen`} · {targetText(p.contactEvery)}</span>
      </a>
      <WaBtn p={p} />
    </div>
  );
}

// v0.96 (Mateo): Rhythmus und Zeitpunkt in einem Fenster statt zwei Auswahllisten übereinander
export function RhythmSheet({ p, onClose }) {
  if (!p) return <Sheet open={false} onClose={onClose} title="" />;
  const v = rhythmValue(p);
  return (
    <Sheet open title={p.name} onClose={onClose}>
      <div className="field">
        <span>Wie oft willst du dich melden?</span>
        <div className="chips">{RHYTHMS.map((r) => <button key={r.v} type="button" className={v === r.v ? 'chip on' : 'chip soft'} onClick={() => setRhythm(p.id, r.v)}>{r.v === 0 ? 'Kein Ziel' : r.label}</button>)}</div>
      </div>
      {v >= 28 && (
        <div className="field">
          <span>Ungefähr wann im Monat?</span>
          <div className="chips">{WHEN_IN_MONTH.map((w) => <button key={w.id} type="button" className={(p.when || '') === w.id ? 'chip on' : 'chip soft'} onClick={() => setWhen(p.id, w.id)}>{w.id ? `${w.label} (${w.from}.–${w.to}.)` : 'Egal'}</button>)}</div>
        </div>
      )}
      <button type="button" className="btn" onClick={onClose}>Fertig</button>
    </Sheet>
  );
}

// v0.95 (Mateo): zwei Teile – „Melde dich mal“ und „Wie oft melden?“
function KeepTab({ s, t }) {
  const [part, setPartState] = useState(() => remember('life-app-people-part', 'melden'));
  const setPart = (v) => { setPartState(v); keep('life-app-people-part', v); };
  const due = peopleOverdue(s, t);
  const soon = peopleOverdue(s, t, 7).filter((x) => x.late < 0);
  const bdays = upcomingBirthdays(s, t, 30);
  const [freq, setFreq] = useState('alle');
  const [sort, setSortState] = useState(() => remember('life-app-people-sort', 'az'));
  const setSort = (v) => { setSortState(v); keep('life-app-people-sort', v); };
  const [editP, setEditP] = useState(null);
  const [msort, setMsortState] = useState(() => remember('life-app-people-msort', 'faellig'));
  const setMsort = (v) => { setMsortState(v); keep('life-app-people-msort', v); };
  // Rang für „Häufig zuerst“: Läuft von selbst → wöchentlich → … → halbjährlich → kein Ziel
  const rank = (p) => { const v = rhythmValue(p); return v === -1 ? 0 : v > 0 ? v : 9999; };
  const [cat, setCatState] = useState(() => remember('life-app-people-cat2', 'alle'));
  const setCat = (v) => { setCatState(v); keep('life-app-people-cat2', v); };
  const people = s.people.filter((p) => (freq === 'alle' || rhythmValue(p) === freq) && inCat(p, cat))
    .sort((a, b) => (sort === 'az' ? 0 : sort === 'oft' ? rank(a) - rank(b) : rank(b) - rank(a)) || a.name.localeCompare(b.name, 'de'));
  return (
    <>
      <div className="seg-mini">
        <button type="button" className={part === 'melden' ? 'chip on' : 'chip soft'} onClick={() => setPart('melden')}>Melde dich mal{due.length ? ` · ${due.length}` : ''}</button>
        <button type="button" className={part === 'wieoft' ? 'chip on' : 'chip soft'} onClick={() => setPart('wieoft')}>Wie oft melden?</button>
      </div>
      {part === 'melden' ? (
        <>
          <section className="group">
            <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Jetzt dran</h2><span className="sub">{due.length}</span></div>
            {due.length > 1 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px', flexWrap: 'wrap' }}>
                <span className="tiny">Sortieren:</span>
                {[['faellig', 'Am längsten fällig'], ['oft', 'Häufig zuerst'], ['selten', 'Selten zuerst']].map(([k, l]) => <button key={k} type="button" className={msort === k ? 'mini-chip on' : 'mini-chip'} onClick={() => setMsort(k)}>{l}</button>)}
              </div>
            )}
            <div className="list">
              {due.length === 0 && <div className="empty">{s.people.some((p) => p.contactEvery) ? 'Gerade niemand – alle im Rhythmus 👍' : 'Unter „Wie oft melden?“ für die wichtigen Menschen einen Rhythmus wählen – dann erscheinen sie hier, wenn es Zeit ist.'}</div>}
              {[...due].sort((a, b) => (msort === 'oft' ? rank(a.person) - rank(b.person) : msort === 'selten' ? rank(b.person) - rank(a.person) : 0) || b.late - a.late).map((x) => <DueRow key={x.person.id} x={x} t={t} />)}
            </div>
          </section>
          {soon.length > 0 && (
            <section className="group">
              <div className="sec-h"><h2 className="h2" style={{ fontSize: 17 }}>Bald dran</h2><span className="sub">7 Tage</span></div>
              <div className="list">{soon.map((x) => <DueRow key={x.person.id} x={x} t={t} soon />)}</div>
            </section>
          )}
          {bdays.length > 0 && (
            <section className="group">
              <div className="sec-h"><h2 className="h2" style={{ fontSize: 17 }}>Geburtstage</h2><span className="sub">30 Tage</span></div>
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
        </>
      ) : (
        <section className="group">
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
            <span className="sub" style={{ flex: 1 }}>Person antippen = Rhythmus festlegen</span>
            <Info>Die App verteilt die Termine von selbst: Wer noch nie gemeldet wurde, bekommt einen Termin irgendwo im ersten Intervall – nicht alle am selben Tag. Danach zählt der letzte Kontakt plus Intervall, mit etwas Spielraum (±15 %), damit es nicht immer derselbe Tag ist. Ab „monatlich“ kannst du zusätzlich Anfang, Mitte oder Ende des Monats wählen. „Läuft von selbst“ = ihr habt sowieso Kontakt, keine Erinnerung.</Info>
          </span>
          {/* v1.17 (Mateo): oben nach Kategorie filtern (wie in der Liste) */}
          <CatChips s={s} filter={cat} setFilter={setCat} />
          {/* v0.96 (Mateo): nach Häufigkeit filtern und sortieren */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 2px', flexWrap: 'wrap' }}>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Zeigen:
              <select className="input rhythm-sel" style={{ fontWeight: 600, color: freq === 'alle' ? 'var(--text)' : 'var(--accent)' }} value={String(freq)} onChange={(e) => setFreq(e.target.value === 'alle' ? 'alle' : Number(e.target.value))} aria-label="Nach Häufigkeit filtern">
                {[{ v: 'alle', label: 'Alle' }, ...RHYTHMS].map((r) => {
                  const n = r.v === 'alle' ? s.people.length : s.people.filter((p) => rhythmValue(p) === r.v).length;
                  return <option key={r.v} value={String(r.v)}>{r.v === 'alle' ? 'Alle' : r.v === 0 ? 'Kein Ziel' : r.label} ({n})</option>;
                })}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px' }}>
            <span className="tiny">Sortieren:</span>
            {[['az', 'A–Z'], ['oft', 'Häufig zuerst'], ['selten', 'Selten zuerst']].map(([k, l]) => <button key={k} type="button" className={sort === k ? 'mini-chip on' : 'mini-chip'} onClick={() => setSort(k)}>{l}</button>)}
          </div>
          <div className="list">
            {people.length === 0 && <div className="empty">Niemand in dieser Auswahl.</div>}
            {people.map((p) => {
              const last = lastContact(p);
              const d = contactDue(p, t);
              const v = rhythmValue(p);
              const w = WHEN_IN_MONTH.find((x) => x.id === p.when && x.from);
              const label = v === -1 ? 'Läuft von selbst' : v > 0 ? `${RHYTHMS.find((r) => r.v === v)?.short || targetText(v)}${w && v >= 28 ? ` · ${w.label}` : ''}` : 'Kein Ziel';
              return (
                <button key={p.id} type="button" className="row compact" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none' }} onClick={() => setEditP(p.id)}>
                  <span className="row-main">
                    <span className="row-title plain">{p.name}</span>
                    <span className="row-meta">{p.natural ? 'Kein Erinnern nötig' : d ? (d <= t ? 'Jetzt dran' : `Nächstes Mal ~${fmtShort(d)}`) : last ? `Zuletzt ${relDays(diffDays(last, t))}` : 'Kein Rhythmus'}</span>
                  </span>
                  <span className="pill" style={{ fontSize: 12.5, color: v > 0 ? 'var(--accent)' : v === -1 ? '#2FA36B' : 'var(--sub)', whiteSpace: 'nowrap' }}>{label} ▾</span>
                </button>
              );
            })}
          </div>
          <RhythmSheet p={s.people.find((x) => x.id === editP)} onClose={() => setEditP(null)} />
        </section>
      )}
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
        {fromHeute() && <Back href="#/heute" label="Heute" />}
        <div className="top">
          <h1 className="h1">Menschen</h1>
          <a href="#/einstellungen" className="icon-btn" aria-label="Einstellungen"><Icon name="gear" size={20} width={1.8} /></a>
        </div>
        <Segmented full options={[{ id: 'liste', label: `Liste · ${s.people.length}` }, { id: 'kontakt', label: `Im Kontakt bleiben${dueN ? ` · ${dueN}` : ''}` }]} value={tab} onChange={setTab} label="Ansicht" />
        {tab === 'liste' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="#/person/neu" className="btn small">＋ Person</a>
          <button type="button" className="btn tint small" onClick={() => setImp(true)}>📇 Aus Kontakten</button>
        </div>}
        {tab === 'liste' ? <ListTab s={s} t={t} /> : <KeepTab s={s} t={t} />}
      </main>
      <ContactImport s={s} open={imp} onClose={() => setImp(false)} />
      <TabBar active="menschen" />
    </>
  );
}
