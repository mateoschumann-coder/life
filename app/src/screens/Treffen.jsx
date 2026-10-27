import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addGathering, addGuest, addItem, applyGatherProposal, gatherAssist, GUEST_STATUS, KINDS, removeGathering, removeGuest, removeItem, setGuest, setKind, setOccasion, occasionsFor, OCCASIONS, todoCats, SHOP_CATS, TODO_TEMPLATES, updateGathering, updateItem, VENUE_STATUS,
} from '../lib/gather';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import GroupedChecklist from '../components/GroupedChecklist';
import PlanChat from '../components/PlanChat';
import { DateRangeField } from '../components/DateRange';
import { Back, Check, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { addInvite, INVITE_COLOR, INVITE_STATUS, removeInvite, updateInvite } from '../lib/invites';
import { Missing } from './Saeule';

const COLOR = '#E8775A';
const NEXT = { offen: 'eingeladen', eingeladen: 'zugesagt', zugesagt: 'abgesagt', abgesagt: 'offen' };
const STATUS_COLOR = { offen: 'var(--muted)', eingeladen: 'var(--accent)', zugesagt: '#2FA36B', abgesagt: 'var(--danger)' };
const VENUE_NEXT = { idee: 'angefragt', angefragt: 'reserviert', reserviert: 'abgelehnt', abgelehnt: 'idee' };
const EMPTY = { name: '', date: '', time: '', place: '', kind: 'zuhause', expected: '', type: '' };

// ---------- Events von anderen (v0.42): Einladungen eintragen ----------
const INV_EMPTY = { name: '', host: '', date: '', time: '', place: '', bring: '', guests: '', note: '', status: 'eingeladen', url: '' };
const INV_NEXT = { eingeladen: 'zugesagt', zugesagt: 'vielleicht', vielleicht: 'abgesagt', abgesagt: 'eingeladen' };
function InviteSheet({ open, invite, onClose }) {
  const [f, setF] = useState(INV_EMPTY);
  const [key, setKey] = useState(null);
  const k = open ? (invite?.id || 'neu') : null;
  if (k !== key) { setKey(k); if (open) setF(invite ? { ...INV_EMPTY, ...invite } : INV_EMPTY); }
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const save = () => {
    if (invite) updateInvite(invite.id, { ...f, name: f.name.trim() || invite.name });
    else addInvite(f);
    toast(invite ? 'Gespeichert' : 'Einladung eingetragen');
    onClose();
  };
  return (
    <Sheet open={open} title={invite ? 'Einladung' : 'Neue Einladung'} onClose={onClose}>
      <Field label="Was?"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="z.B. Geburtstag von Juan, Hochzeit, Asado" /></Field>
      <Field label="Wer lädt ein?"><input className="input" value={f.host} onChange={(e) => set({ host: e.target.value })} placeholder="z.B. Juan" /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Datum"><DateRangeField single from={f.date} to="" onChange={(v) => set({ date: v.from })} placeholder="Offen" title="Datum" /></Field>
        <Field label="Uhrzeit"><input className="input" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} /></Field>
      </div>
      <Field label="Wo?"><input className="input" value={f.place} onChange={(e) => set({ place: e.target.value })} placeholder="Adresse oder Lokal" /></Field>
      <div className="field">
        <span>Status</span>
        <div className="chips">{Object.entries(INVITE_STATUS).map(([s, l]) => <button key={s} type="button" className={f.status === s ? 'chip on' : 'chip soft'} onClick={() => set({ status: s })}>{l}</button>)}</div>
      </div>
      <Field label="Wer ist noch dabei?"><input className="input" value={f.guests || ''} onChange={(e) => set({ guests: e.target.value })} placeholder="z.B. Juan, Sofi, Pedro" /></Field>
      <Field label="Ich bringe mit"><input className="input" value={f.bring} onChange={(e) => set({ bring: e.target.value })} placeholder="z.B. Geschenk, Wein, Salat" /></Field>
      <Field label="Notiz"><textarea className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="z.B. Dresscode, Geschenk-Idee, wer noch kommt" /></Field>
      <Field label="Link (optional)"><input className="input" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="Einladung, Instagram, Karte …" /></Field>
      <button type="button" className="btn" onClick={save} disabled={!f.name.trim()}>Speichern</button>
      {invite && <button type="button" className="btn danger" onClick={() => { if (confirm(`„${invite.name}“ löschen?`)) { removeInvite(invite.id); onClose(); } }}>Löschen</button>}
    </Sheet>
  );
}
function Invites({ s, sheet, setSheet }) {
  const t = today();
  const [showDone, setShowDone] = useState(false);
  const list = [...(s.invites || [])].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const upcoming = list.filter((x) => !x.done && (!x.date || x.date >= t));
  const past = list.filter((x) => !x.done && x.date && x.date < t);
  const done = list.filter((x) => x.done).reverse();
  const Row = ({ x }) => (
    <div className="row" style={{ minHeight: 62 }}>
      <Check on={!!x.done} color={COLOR} onClick={() => updateInvite(x.id, { done: !x.done })} label={`${x.name} ${x.done ? 'wieder öffnen' : 'abhaken'}`} />
      <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => setSheet(x)}>
        <span className={x.done ? 'row-title strong done' : 'row-title strong'}>{x.name}</span>
        <span className="row-meta">{[x.host && `von ${x.host}`, x.date ? `${fmtShort(x.date)}${x.time ? `, ${x.time}` : ''}` : 'Datum offen', x.date && x.date >= t && `in ${diffDays(t, x.date)} Tagen`, x.place, x.bring && `🎁 ${x.bring}`, x.guests && `👥 ${x.guests}`].filter(Boolean).join(' · ')}</span>
      </button>
      {!x.done && <button type="button" className="pill" style={{ color: INVITE_COLOR[x.status], whiteSpace: 'nowrap' }} onClick={() => updateInvite(x.id, { status: INV_NEXT[x.status] || 'eingeladen' })} aria-label={`Status ${INVITE_STATUS[x.status]}, antippen zum Ändern`}>{INVITE_STATUS[x.status]}</button>}
    </div>
  );
  return (
    <>
      <span className="sub" style={{ marginTop: -6 }}>Events, zu denen dich andere einladen – Geburtstage, Asados, Hochzeiten … Status antippen wechselt Eingeladen → Zugesagt → Vielleicht → Abgesagt.</span>
      <div className="list">
        {upcoming.length === 0 && <div className="empty">Noch keine Einladungen. Tipp oben auf „+ Einladung“ oder sag dem Assistenten z.B. „Juan hat mich am Samstag zum Asado eingeladen“.</div>}
        {upcoming.map((x) => <Row key={x.id} x={x} />)}
      </div>
      {past.length > 0 && (
        <section className="group">
          <h2 className="label" style={{ padding: '0 4px' }}>Vorbei – abhaken?</h2>
          <div className="list">{[...past].reverse().map((x) => <Row key={x.id} x={x} />)}</div>
        </section>
      )}
      {done.length > 0 && (
        <>
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowDone(!showDone)}>{showDone ? 'Erledigte ausblenden' : `${done.length} erledigte Einladungen`}</button>
          {showDone && <div className="list">{done.map((x) => <Row key={x.id} x={x} />)}</div>}
        </>
      )}
      <InviteSheet open={!!sheet} invite={sheet && sheet !== 'neu' ? (s.invites || []).find((x) => x.id === sheet.id) : null} onClose={() => setSheet(null)} />
    </>
  );
}

const TAB_KEY = 'life-app-sozial-tab';
export function EventsList({ s }) {
  const t = today();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const list = [...s.gatherings].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const [showDone, setShowDone] = useState(false);
  const upcoming = list.filter((g) => !g.done && (!g.date || g.date >= t));
  const past = list.filter((g) => !g.done && g.date && g.date < t); // vorbei, aber noch nicht abgehakt
  const done = list.filter((g) => g.done).reverse();
  const [tab, setTabState] = useState(() => { try { return localStorage.getItem(TAB_KEY) || 'eigene'; } catch { return 'eigene'; } });
  const setTab = (v) => { setTabState(v); try { localStorage.setItem(TAB_KEY, v); } catch {} };
  const [invSheet, setInvSheet] = useState(null);
  const save = () => {
    const id = addGathering(f);
    setOpen(false);
    setF(EMPTY);
    go(`/treffen/${id}`);
  };
  const Row = ({ g }) => {
    const yes = g.guests.filter((x) => x.status === 'zugesagt').length;
    return (
      <div className="row" style={{ minHeight: 62 }}>
        <Check on={!!g.done} color={COLOR} onClick={() => { updateGathering(g.id, { done: !g.done }); if (!g.done) toast('Abgehakt – hoffentlich war es schön!'); }} label={`${g.name} ${g.done ? 'wieder öffnen' : 'abhaken'}`} />
        <a href={`#/treffen/${g.id}`} className="row-main">
          <span className={g.done ? 'row-title strong done' : 'row-title strong'}>{OCCASIONS[g.type]?.emoji || (g.kind === 'auswaerts' ? '📍' : '🏠')} {g.name}</span>
          <span className="row-meta">{[g.date ? `${fmtShort(g.date)}${g.time ? `, ${g.time}` : ''}` : 'Datum offen', g.date && g.date >= t && `in ${diffDays(t, g.date)} Tagen`, g.guests.length ? `${yes}/${g.guests.length} zugesagt` : g.expected && `ca. ${g.expected} Gäste`].filter(Boolean).join(' · ')}</span>
        </a>
        <Chevron />
      </div>
    );
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereiche" label="Bereiche" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Sozial</h1>
            {tab === 'eigene' ? <button type="button" className="btn small" onClick={() => setOpen(true)}>+ Event</button> : <button type="button" className="btn small" onClick={() => setInvSheet('neu')}>+ Einladung</button>}
          </div>
        </div>
        <Segmented full options={[{ id: 'eigene', label: 'Eigene Events' }, { id: 'andere', label: `Von anderen${(s.invites || []).filter((x) => !x.done).length ? ` · ${(s.invites || []).filter((x) => !x.done).length}` : ''}` }]} value={tab} onChange={setTab} label="Art der Events" />
        {tab === 'andere' ? <Invites s={s} sheet={invSheet} setSheet={setInvSheet} /> : (<>
        <span className="sub" style={{ marginTop: -6 }}>Deine eigenen Events – Asado, Spieleabend, Geburtstag … Menschen findest du unten unter „Menschen“.</span>
        <div className="list">
          {upcoming.length === 0 && <div className="empty">Organisier dein eigenes Event – Asado, Spieleabend, Lauftreff … mit Einladung, Gästeliste, Einkaufsliste und To-dos.</div>}
          {upcoming.map((g) => <Row key={g.id} g={g} />)}
        </div>
        {past.length > 0 && (
          <section className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>Vorbei – abhaken?</h2>
            <div className="list">{past.reverse().map((g) => <Row key={g.id} g={g} />)}</div>
          </section>
        )}
        {done.length > 0 && (
          <>
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowDone(!showDone)}>{showDone ? 'Erledigte ausblenden' : `${done.length} erledigte Events`}</button>
            {showDone && <div className="list">{done.map((g) => <Row key={g.id} g={g} />)}</div>}
          </>
        )}
        </>)}
      </main>
      <Sheet open={open} title="Neues Event" onClose={() => setOpen(false)}>
        <div className="seg-mini">
          {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" className={f.kind === k ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, kind: k, type: OCCASIONS[f.type]?.kind && OCCASIONS[f.type].kind !== k ? '' : f.type })}>{k === 'zuhause' ? '🏠 ' : '📍 '}{l}</button>)}
        </div>
        <div className="field">
          <span>Anlass – bringt passende To-dos{f.kind === 'zuhause' ? ' und Einkaufsliste' : ''} mit</span>
          <div className="chips">{occasionsFor(f.kind).map(([k, o]) => <button key={k} type="button" className={f.type === k ? 'chip on' : 'chip'} onClick={() => setF({ ...f, type: f.type === k ? '' : k, name: f.name || (k !== 'sonstiges' ? o.label.split(' /')[0] : '') })}>{o.emoji} {o.label}</button>)}</div>
        </div>
        <span className="tiny">{f.kind === 'zuhause' ? 'Bei dir: Menü, Getränke, Einkauf, Mitbringen, Vorbereitung.' : 'Woanders: Ort finden, reservieren, Gästen Adresse schicken.'}</span>
        <Field label="Was? (darf noch offen sein)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.kind === 'zuhause' ? 'z.B. Asado bei mir' : 'z.B. Geburtstagsessen'} /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Datum"><DateRangeField single from={f.date} to="" onChange={(v) => setF({ ...f, date: v.from })} placeholder="Offen" title="Datum" /></Field>
          <Field label="Uhrzeit"><input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Ungefähr wie viele Gäste?"><input className="input" inputMode="numeric" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value.replace(/[^\d–-]/g, '') })} placeholder="z.B. 8 – darf auch leer bleiben" /></Field>
        <button type="button" className="btn" onClick={save}>Anlegen</button>
        <span className="tiny">Danach hilft dir die KI: Ideen, Motto, Menü, Getränke{f.kind === 'auswaerts' ? ', passende Orte' : ''} und Einladung.</span>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

const PLAN_GROUPS = [
  { key: 'ideen', label: 'Ideen / Motto (das erste ausgewählte wird übernommen)', title: (x) => x.titel, meta: (x) => x.beschreibung },
  { key: 'orte', label: 'Mögliche Orte', title: (x) => x.name, meta: (x) => [x.adresse, x.warum, x.preis, x.reservierung].filter(Boolean).join(' · ') },
  { key: 'einkaufen', label: 'Einkaufen', title: (x) => x.text, meta: (x) => x.kategorie },
  { key: 'mitbringen', label: 'Gäste könnten mitbringen', title: (x) => x },
  { key: 'todos', label: 'To-dos', title: (x) => x.text, meta: (x) => x.kategorie },
  { key: 'einladung', label: 'Einladung', title: (x) => x, single: true },
];

function Venues({ g }) {
  const [name, setName] = useState('');
  return (
    <>
      <div className="list">
        {g.venues.length === 0 && <div className="empty">Noch keine Orte. Lass dir oben passende Locations vorschlagen („Passenden Ort finden“) oder trag selbst welche ein.</div>}
        {g.venues.map((v) => (
          <div key={v.id} className="row" style={{ minHeight: 60, opacity: v.status === 'abgelehnt' ? 0.55 : 1 }}>
            <span className="row-main">
              <span className="row-title strong">{v.name}</span>
              <span className="row-meta">{[v.address, v.note].filter(Boolean).join(' · ')}</span>
            </span>
            {v.phone && <a className="x-btn" href={`tel:${v.phone.replace(/[^\d+]/g, '')}`} aria-label="Anrufen">📞</a>}
            {v.url && <a className="x-btn" href={v.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
            <button type="button" className={v.status === 'reserviert' ? 'pill on' : 'pill'} onClick={() => {
              const next = VENUE_NEXT[v.status];
              updateItem(g.id, 'venues', v.id, { status: next });
              if (next === 'reserviert') { updateGathering(g.id, { place: [v.name, v.address].filter(Boolean).join(', ') }); toast('Als Ort des Events eingetragen'); }
            }}>{VENUE_STATUS[v.status]}</button>
            <button type="button" className="x-btn" aria-label="Löschen" onClick={() => removeItem(g.id, 'venues', v.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
        <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addItem(g.id, 'venues', { name: name.trim(), address: '', note: '', phone: '', url: '', status: 'idee' }); setName(''); }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ort hinzufügen, z.B. Bar Uptown" aria-label="Ort hinzufügen" />
          <button type="submit" className="btn small" disabled={!name.trim()}>+</button>
        </form>
      </div>
      <span className="tiny" style={{ padding: '0 4px' }}>Status antippen: Idee → Angefragt → Reserviert (wird zum Ort des Events) → Passt nicht.</span>
    </>
  );
}

function Detail({ s, g }) {
  const home = g.kind !== 'auswaerts';
  const [tab, setTab] = useState('todos');
  const [guest, setGuestText] = useState('');
  const counts = Object.fromEntries(Object.keys(GUEST_STATUS).map((k) => [k, g.guests.filter((x) => x.status === k).length]));
  const suggestions = s.people.filter((p) => !g.guests.some((x) => x.personId === p.id || x.name === p.name)).slice(0, 12);
  const phoneOf = (x) => s.people.find((p) => p.id === x.personId)?.phone?.replace(/[^\d+]/g, '').replace(/^\+/, '');
  const share = async () => {
    const text = g.invite || `${g.name}${g.date ? ` am ${fmtShort(g.date)}` : ''}${g.time ? ` um ${g.time}` : ''}${g.place ? ` – ${g.place}` : ''}. Bist du dabei?`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };
  const tabs = [['todos', 'To-dos', g.todos.filter((x) => !x.done).length], ['gaeste', 'Gäste', g.guests.length], home ? ['einkauf', 'Einkauf', g.shopping.filter((x) => !x.done).length] : ['orte', 'Ort', g.venues.length], ['mitbringen', 'Mitbringen', g.bring.length], ['einladung', 'Einladung', 0]];
  const cur = tabs.some(([k]) => k === tab) ? tab : 'todos';
  const field = (key, ph, extra = {}) => <input className="input" defaultValue={g[key]} key={g.id + key + (g[key] || '')} placeholder={ph} onBlur={(e) => e.target.value !== g[key] && updateGathering(g.id, { [key]: e.target.value })} aria-label={ph} {...extra} />;
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/sozial" label="Sozial" />
          <input className="input title-input" defaultValue={g.name} key={g.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && updateGathering(g.id, { name: e.target.value.trim() })} aria-label="Name" />
          <div className="seg-mini">
            {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" className={g.kind === k ? 'chip on' : 'chip soft'} onClick={() => setKind(g.id, k)}>{k === 'zuhause' ? '🏠 ' : '📍 '}{l}</button>)}
          </div>
          <div className="box-tabs">{occasionsFor(g.kind).map(([k, o]) => <button key={k} type="button" className={g.type === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => { setOccasion(g.id, k); toast(`${o.label}: Vorlage ergänzt`); }}>{o.emoji} {o.label}</button>)}</div>
        </div>
        <section className="card" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><DateRangeField single from={g.date} to="" onChange={(v) => updateGathering(g.id, { date: v.from })} placeholder="Datum offen" title="Datum" /></div>
            <input className="input" type="time" value={g.time || ''} onChange={(e) => updateGathering(g.id, { time: e.target.value })} aria-label="Uhrzeit" style={{ maxWidth: 120 }} />
          </div>
          {field('place', home ? 'Wo? (z.B. bei mir, Palermo)' : 'Wo? – noch offen, siehe „Ort“')}
          <div style={{ display: 'flex', gap: 8 }}>
            {field('expected', 'Ca. Gäste', { inputMode: 'numeric', style: { maxWidth: 110 } })}
            {field('motto', 'Motto / Art, z.B. Asado')}
          </div>
          {field('diet', 'Einschränkungen: vegetarisch, Allergien …')}
          {field('budget', 'Budget, z.B. 50.000 ARS')}
          {g.date && g.date >= today() && <span className="tiny">in {diffDays(today(), g.date)} Tagen</span>}
          {g.guests.length > 0 && (
            <div className="stat-row">
              <div><span className="tiny">Zugesagt</span><b style={{ color: '#2FA36B' }}>{counts.zugesagt}</b></div>
              <div><span className="tiny">Offen</span><b>{counts.eingeladen + counts.offen}</b></div>
              <div><span className="tiny">Abgesagt</span><b style={{ color: 'var(--danger)' }}>{counts.abgesagt}</b></div>
            </div>
          )}
        </section>

        <PlanChat
          title="Mit KI planen"
          intro={home ? 'Erzähl, was dir vorschwebt – ich frage nach (wie viele ungefähr, Einschränkungen, Budget) und schlage Ideen, Menü, Getränke und was Gäste mitbringen können vor.' : 'Erzähl, was dir vorschwebt – ich frage nach und suche passende Orte in Buenos Aires, sage, wie man reserviert und was du den Gästen schicken musst.'}
          history={g.chat}
          prefKey="event"
          onSave={(chat) => updateGathering(g.id, { chat })}
          onAsk={(hist, o) => gatherAssist(s, g, hist, o)}
          webChips={['Passenden Ort finden']}
          groups={PLAN_GROUPS}
          onApply={(sel) => applyGatherProposal(g.id, sel)}
          chips={home ? ['Ideen für das Event', 'Motto finden', 'Was soll ich kochen?', 'Welche Getränke, wie viel?', 'Was können Gäste mitbringen?', 'Einladung schreiben'] : ['Ideen für das Event', 'Passenden Ort finden', 'Wie reserviere ich am besten?', 'Was muss ich den Gästen schicken?', 'Einladung schreiben']}
        />

        <div className="box-tabs main-tabs">
          {tabs.map(([k, l, n]) => <button key={k} type="button" className={cur === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(k)}>{l}{n ? ` ${n}` : ''}</button>)}
        </div>

        {cur === 'todos' && <GroupedChecklist items={g.todos} cats={todoCats(g)} color={COLOR} onAdd={(text, cat) => text.split(/,|\n/).map((x) => x.trim()).filter(Boolean).forEach((x) => addItem(g.id, 'todos', { text: x, cat }))} onToggle={(id) => updateItem(g.id, 'todos', id, { done: !g.todos.find((x) => x.id === id).done })} onRemove={(id) => removeItem(g.id, 'todos', id)} placeholder="Neues To-do" />}
        {cur === 'gaeste' && (
          <>
            <div className="list">
              {g.guests.length === 0 && <div className="empty">Noch keine Gäste. Du musst nicht alle kennen – für die Planung reicht oben die ungefähre Zahl.</div>}
              {g.guests.map((x) => (
                <div key={x.id} className="row" style={{ minHeight: 54 }}>
                  <span className="row-main"><span className="row-title plain">{x.name}</span></span>
                  {phoneOf(x) && x.status === 'offen' && <a className="pill" href={`https://wa.me/${phoneOf(x)}?text=${encodeURIComponent(g.invite || g.name)}`} target="_blank" rel="noreferrer" onClick={() => setGuest(g.id, x.id, { status: 'eingeladen' })}>WhatsApp</a>}
                  <button type="button" className="pill" style={{ color: STATUS_COLOR[x.status] }} onClick={() => setGuest(g.id, x.id, { status: NEXT[x.status] })} aria-label={`Status von ${x.name}: ${GUEST_STATUS[x.status]} – antippen zum Ändern`}>{GUEST_STATUS[x.status].replace('Noch nicht eingeladen', 'Einladen')}</button>
                  <button type="button" className="x-btn" aria-label={`${x.name} entfernen`} onClick={() => removeGuest(g.id, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
                </div>
              ))}
              <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addGuest(g.id, { name: guest }); setGuestText(''); }}>
                <input className="input" value={guest} onChange={(e) => setGuestText(e.target.value)} placeholder="Name hinzufügen" aria-label="Gast hinzufügen" />
                <button type="submit" className="btn small" disabled={!guest.trim()}>+</button>
              </form>
            </div>
            <span className="tiny" style={{ padding: '0 4px' }}>Status antippen: Einladen → Eingeladen → Zugesagt → Abgesagt.</span>
            {suggestions.length > 0 && <div className="chips">{suggestions.map((p) => <button key={p.id} type="button" className="chip soft" onClick={() => addGuest(g.id, { name: p.name, personId: p.id })}>+ {p.name}</button>)}</div>}
          </>
        )}
        {cur === 'einkauf' && <GroupedChecklist items={g.shopping} cats={SHOP_CATS} color={COLOR} onAdd={(text, cat) => text.split(/,|\n/).map((x) => x.trim()).filter(Boolean).forEach((x) => addItem(g.id, 'shopping', { text: x, cat, who: '' }))} onToggle={(id) => updateItem(g.id, 'shopping', id, { done: !g.shopping.find((x) => x.id === id).done })} onRemove={(id) => removeItem(g.id, 'shopping', id)} placeholder="Einkaufen" />}
        {cur === 'orte' && <Venues g={g} />}
        {cur === 'mitbringen' && (
          <>
            <SimpleList items={g.bring} color={COLOR} onAdd={(text, who) => addItem(g.id, 'bring', { text: text.trim(), who: String(who || '').trim() })} onToggle={(id) => updateItem(g.id, 'bring', id, { done: !g.bring.find((x) => x.id === id).done })} onRemove={(id) => removeItem(g.id, 'bring', id)} meta={(x) => (x.who ? `bringt ${x.who}` : 'noch niemand eingeteilt')} placeholder="z.B. Salat, Wein, Eis" extraInput="Wer?" />
            <span className="tiny" style={{ padding: '0 4px' }}>Was Gäste mitbringen könnten – abhaken, sobald jemand zugesagt hat.</span>
          </>
        )}
        {cur === 'einladung' && (
          <section className="card" style={{ gap: 10 }}>
            <textarea className="input" style={{ minHeight: 150 }} defaultValue={g.invite} key={g.id + 'i' + (g.invite || '').length} placeholder="Deine Einladung – oder sag oben „Einladung schreiben“." onBlur={(e) => e.target.value !== g.invite && updateGathering(g.id, { invite: e.target.value })} aria-label="Einladungstext" />
            <button type="button" className="btn" onClick={share}>Einladung teilen (WhatsApp …)</button>
            <span className="tiny">Gäste mit Telefonnummer kannst du unter „Gäste“ auch einzeln per WhatsApp einladen.</span>
          </section>
        )}
        <button type="button" className="btn sec" onClick={() => { updateGathering(g.id, { done: !g.done }); toast(g.done ? 'Wieder offen' : 'Abgehakt'); if (!g.done) go('/saeule/sozial'); }}>{g.done ? 'Wieder öffnen' : 'Event abhaken (hat stattgefunden)'}</button>
        <button type="button" className="btn danger" onClick={() => { if (confirm(`„${g.name}“ löschen?`)) { removeGathering(g.id); go('/saeule/sozial'); } }}>Event löschen</button>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Treffen({ id }) {
  const s = useStore();
  if (!id) return <EventsList s={s} />;
  const g = s.gatherings.find((x) => x.id === id);
  return g ? <Detail s={s} g={g} /> : <Missing />;
}
