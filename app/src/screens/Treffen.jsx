import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addGathering, addGuest, addWaGroup, removeWaGroup, addItem, applyGatherProposal, gatherAssist, GUEST_STATUS, KINDS, removeGathering, removeGuest, removeItem, setGuest, setKind, inviteText, inviteDetails, setOccasion, occasionsFor, OCCASIONS, todoCats, SHOP_CATS, TODO_TEMPLATES, updateGathering, updateItem, VENUE_STATUS,
} from '../lib/gather';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import GroupedChecklist from '../components/GroupedChecklist';
import PlanChat from '../components/PlanChat';
import { DateRangeField } from '../components/DateRange';
import { Back, Check, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast, Info } from '../components/ui';
import { addInvite, INVITE_COLOR, INVITE_STATUS, removeInvite, updateInvite } from '../lib/invites';
import { Missing } from './Saeule';
import RemovedList from '../components/RemovedList';
import { archiveGathering, archiveInvite, restoreGathering, restoreInvite } from '../lib/actions';
import { PEOPLE_CATEGORIES } from '../lib/seed';

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
      {invite && <button type="button" className="btn danger" onClick={() => { archiveInvite(invite.id); toast('Rausgenommen – unten zurückholbar'); onClose(); }}>Rausnehmen</button>}
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
      <RemovedList items={s.removedInvites || []} storeKey="removedInvites" onRestore={restoreInvite} meta={(x) => [x.host && `von ${x.host}`, x.date && fmtShort(x.date)].filter(Boolean).join(' · ')} />
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
        <RemovedList items={s.removedGatherings || []} storeKey="removedGatherings" onRestore={restoreGathering} meta={(g) => [g.date && fmtShort(g.date), g.place].filter(Boolean).join(' · ')} />
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
        <Info>Danach hilft dir die KI: Ideen, Motto, Menü, Getränke{f.kind === 'auswaerts' ? ', passende Orte' : ''} und Einladung.</Info>
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
  { key: 'ueberblick', label: 'Überblick ausfüllen', title: (x) => [x.datum, x.uhrzeit, x.ort, x.adresse, x.gaeste && `ca. ${x.gaeste} Gäste`].filter(Boolean).join(' · ') },
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
      <Info>Status antippen: Idee → Angefragt → Reserviert (wird zum Ort des Events) → Passt nicht.</Info>
    </>
  );
}

// v0.90: Einkauf als Teil der To-dos – Unterteile Essen/Getränke/Sonstiges, Eingabe oben, kompakte Zeilen
function EventShop({ g }) {
  const [cat, setCat] = useState('Alle');
  const [text, setText] = useState('');
  const guess = (x) => (/\b(bier|wein|fernet|cola|wasser|saft|sekt|gin|tonic|eis|hielo|soda|cerveza|vino|agua|gaseosa|jugo|limonade|kaffee|tee)\b/i.test(x) ? 'Getränke' : /\b(servietten|becher|kohle|carbón|carbon|deko|kerzen|teller|müll|vasos|platos|servilletas|grillanzünder)\b/i.test(x) ? 'Sonstiges' : 'Essen');
  const target = cat === 'Alle' ? 'Essen' : cat;
  const list = g.shopping.filter((x) => cat === 'Alle' || x.cat === cat);
  return (
    <>
      <div className="box-tabs">
        {['Alle', ...SHOP_CATS].map((c) => { const n = c === 'Alle' ? 0 : g.shopping.filter((x) => x.cat === c && !x.done).length; return <button key={c} type="button" className={cat === c ? 'chip on small-chip' : 'chip soft small-chip'} style={{ whiteSpace: 'nowrap' }} onClick={() => setCat(c)}>{c}{n ? ` · ${n}` : ''}</button>; })}
      </div>
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); text.split(/,|\n/).map((x) => x.trim()).filter(Boolean).forEach((x) => addItem(g.id, 'shopping', { text: x, cat: cat === 'Alle' ? guess(x) : cat, who: '' })); setText(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={cat === 'Alle' ? 'Einkaufen – z.B. Bier, Chips' : `Einkaufen (${target})`} aria-label="Einkaufen" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
      {list.length === 0 && <section className="list"><div className="empty" style={{ padding: '12px 14px' }}>Noch nichts – oben eintragen.</div></section>}
      {/* v0.93: bei „Alle“ nach Kategorie getrennt – Essen, Getränke, Sonstiges zuletzt */}
      {(cat === 'Alle' ? SHOP_CATS : [cat]).map((c) => {
        const part = list.filter((x) => (cat === 'Alle' ? (SHOP_CATS.includes(x.cat) ? x.cat : 'Sonstiges') === c : true));
        if (!part.length) return null;
        return (
          <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {cat === 'Alle' && <span className="label" style={{ padding: '2px 4px 0' }}>{c} · {part.filter((x) => !x.done).length || '✓'}</span>}
            <section className="list">
              {[...part.filter((x) => !x.done), ...part.filter((x) => x.done)].map((x) => (
                <div key={x.id} className="row compact">
                  <Check on={x.done} color={COLOR} onClick={() => updateItem(g.id, 'shopping', x.id, { done: !x.done })} label={x.text} />
                  <span className="row-main"><span className={x.done ? 'row-title plain done' : 'row-title plain'}>{x.text}</span></span>
                  <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => removeItem(g.id, 'shopping', x.id)}><Icon name="x" size={11} color="var(--chev)" /></button>
                </div>
              ))}
            </section>
          </div>
        );
      })}
    </>
  );
}

// v0.95 (Mateo): WhatsApp-Gruppen – Text kopieren und Gruppe öffnen (Einfügen + Senden in WhatsApp)
function WaGroups({ s, text }) {
  const groups = s.waGroups || [];
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: '', link: '' });
  const [edit, setEdit] = useState(false);
  const go = async (x) => {
    try { await navigator.clipboard.writeText(text); toast('Einladung kopiert – in der Gruppe einfügen'); } catch { toast('Kopieren ging nicht – Text lange drücken und kopieren'); }
    if (x.link) window.open(x.link, '_blank');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <b style={{ fontSize: 14, flex: 1 }}>WhatsApp-Gruppen</b>
        <Info>Gruppen-Link holen: in WhatsApp die Gruppe öffnen → Gruppenname antippen → „Per Link einladen“ → „Link kopieren“ und hier einfügen. Antippen kopiert dann die Einladung und öffnet die Gruppe – du fügst nur noch ein und sendest. (WhatsApp erlaubt nicht, dass eine App selbst in Gruppen schreibt.)</Info>
        {groups.length > 0 && <button type="button" className={edit ? 'pill on' : 'link-btn'} style={{ fontSize: 13 }} onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : '✎'}</button>}
      </span>
      {groups.length > 0 && (
        <div className="chips">
          {groups.map((x) => (edit
            ? <button key={x.id} type="button" className="chip editing" onClick={() => confirm(`„${x.name}“ entfernen?`) && removeWaGroup(x.id)}>{x.name} ✕</button>
            : <button key={x.id} type="button" className="chip on" onClick={() => go(x)}>👥 {x.name}</button>))}
        </div>
      )}
      {add ? (
        <form className="card" style={{ gap: 6, padding: 10 }} onSubmit={(e) => { e.preventDefault(); if (addWaGroup(f.name, f.link)) toast('Gruppe gespeichert'); setF({ name: '', link: '' }); setAdd(false); }}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, z.B. Fußball-Jungs" aria-label="Gruppenname" />
          <input className="input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="Gruppen-Link (chat.whatsapp.com/…)" inputMode="url" aria-label="Gruppen-Link" />
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn small" style={{ flex: 1 }} disabled={!f.name.trim()}>Speichern</button>
            <button type="button" className="btn small sec" onClick={() => setAdd(false)}>Abbrechen</button>
          </span>
        </form>
      ) : <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setAdd(true)}>+ Gruppe hinzufügen</button>}
    </div>
  );
}

// v0.94 (Mateo): Gäste aus allen Menschen auswählen – Suche, Kategorie, mehrere antippen
function GuestPicker({ s, g, open, onClose }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('alle');
  const [sel, setSel] = useState([]);
  const taken = (p) => g.guests.some((x) => x.personId === p.id || x.name === p.name);
  const list = s.people.filter((p) => !taken(p) && (cat === 'alle' || p.category === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const close = () => { setSel([]); setQ(''); onClose(); };
  return (
    <Sheet open={open} title="Gäste auswählen" onClose={close}>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name suchen …" aria-label="Menschen suchen" />
      <div className="box-tabs">{[{ id: 'alle', label: 'Alle' }, ...PEOPLE_CATEGORIES].map((c) => <button key={c.id} type="button" className={cat === c.id ? 'chip on small-chip' : 'chip soft small-chip'} style={{ whiteSpace: 'nowrap' }} onClick={() => setCat(c.id)}>{c.label}</button>)}</div>
      <div className="list">
        {list.length === 0 && <div className="empty">Niemand (mehr) in dieser Auswahl.</div>}
        {list.map((p) => {
          const on = sel.includes(p.id);
          return (
            <button key={p.id} type="button" className="row compact" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none' }} onClick={() => setSel(on ? sel.filter((x) => x !== p.id) : [...sel, p.id])} aria-pressed={on}>
              <span className={on ? 'check on' : 'check'} style={on ? { background: 'var(--accent)' } : undefined}>{on && <Icon name="check" size={12} color="#fff" width={3} />}</span>
              <span className="row-main"><span className="row-title plain">{p.name}</span>{!p.phone && <span className="row-meta">ohne Telefonnummer</span>}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn" disabled={!sel.length} onClick={() => { for (const id of sel) { const p = s.people.find((x) => x.id === id); if (p) addGuest(g.id, { name: p.name, personId: p.id }); } toast(`${sel.length} Gäste hinzugefügt`); close(); }}>{sel.length ? `${sel.length} hinzufügen` : 'Menschen antippen'}</button>
    </Sheet>
  );
}

function Detail({ s, g }) {
  const home = g.kind !== 'auswaerts';
  const [tab, setTab] = useState('ueberblick');
  const [guest, setGuestText] = useState('');
  const [pickGuests, setPickGuests] = useState(false);
  const counts = Object.fromEntries(Object.keys(GUEST_STATUS).map((k) => [k, g.guests.filter((x) => x.status === k).length]));
  const phoneOf = (x) => s.people.find((p) => p.id === x.personId)?.phone?.replace(/[^\d+]/g, '').replace(/^\+/, '');
  const share = async () => {
    const text = inviteText(g);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };
  const openTodos = g.todos.filter((x) => !x.done).length + (home ? g.shopping.filter((x) => !x.done).length : 0);
  const tabs = [['ueberblick', 'Überblick', 0], ['todos', home ? 'To-dos & Einkauf' : 'To-dos', openTodos], ['gaeste', 'Gäste', g.guests.length], !home && ['orte', 'Ort', g.venues.length], ['mitbringen', 'Mitbringen', g.bring.length], ['einladung', 'Einladung', 0]].filter(Boolean);
  const go2 = (k, sub) => { setTab(k); if (sub) { try { sessionStorage.setItem(`life-ev-sub-${g.id}`, sub); } catch {} } setTimeout(() => document.querySelector('.main-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); };
  const shopTab = home ? [{ key: '🛒 Einkauf', label: '🛒 Einkauf', open: g.shopping.filter((x) => !x.done).length, total: g.shopping.length, render: () => <EventShop g={g} />, after: 'Planen' }] : [];
  const cur = tabs.some(([k]) => k === tab) ? tab : 'ueberblick';
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
          <div className="box-tabs">{occasionsFor(g.kind).map(([k, o]) => <button key={k} type="button" className={g.type === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => { setOccasion(g.id, k); toast(o.empty ? "Leer: Vorlage entfernt – selbst füllen oder KI fragen" : `${o.label}: Vorlage ergänzt`); }}>{o.emoji} {o.label}</button>)}</div>
        </div>


        <div className="box-tabs main-tabs">
          {tabs.map(([k, l, n]) => <button key={k} type="button" className={cur === k ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(k)}>{l}{n ? ` ${n}` : ''}</button>)}
        </div>

        {cur === 'ueberblick' && <section className="card" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><DateRangeField single from={g.date} to="" onChange={(v) => updateGathering(g.id, { date: v.from })} placeholder="Datum offen" title="Datum" /></div>
            <input className="input" type="time" value={g.time || ''} onChange={(e) => updateGathering(g.id, { time: e.target.value })} aria-label="Uhrzeit" style={{ maxWidth: 120 }} />
          </div>
          {field('place', home ? 'Wo? (z.B. bei mir)' : 'Wo? (Name des Ortes)')}
          {field('address', 'Adresse (für den Google-Maps-Link in der Einladung)')}
          <div style={{ display: 'flex', gap: 8 }}>
            {field('expected', 'Ca. Gäste', { inputMode: 'numeric', style: { maxWidth: 110 } })}
            {field('motto', 'Motto / Art, z.B. Asado')}
          </div>
          {field('diet', 'Einschränkungen: vegetarisch, Allergien …')}
          {field('budget', 'Budget, z.B. 50.000 ARS')}
          {g.date && g.date >= today() && <span className="tiny">in {diffDays(today(), g.date)} Tagen</span>}
          <div className="ev-stand">
            <button type="button" onClick={() => go2('todos', todoCats(g)[0])}><span>To-dos</span><b>{g.todos.filter((x) => x.done).length}/{g.todos.length}</b></button>
            {home && <button type="button" onClick={() => go2('todos', '🛒 Einkauf')}><span>Einkauf</span><b>{g.shopping.filter((x) => x.done).length}/{g.shopping.length}</b></button>}
            {!home && <button type="button" onClick={() => go2('orte')}><span>Ort</span><b>{g.venues.some((x) => x.status === 'reserviert') ? '✓' : g.venues.length || '–'}</b></button>}
            <button type="button" onClick={() => go2('gaeste')}><span>Zugesagt</span><b style={{ color: counts.zugesagt ? '#2FA36B' : undefined }}>{counts.zugesagt}{g.guests.length ? `/${g.guests.length}` : ''}</b></button>
            <button type="button" onClick={() => go2('mitbringen')}><span>Mitbringen</span><b>{g.bring.filter((x) => x.done).length}/{g.bring.length}</b></button>
          </div>
        </section>}
        {cur === 'todos' && <GroupedChecklist key={g.id + (g.type || '')} tabKey={`life-ev-sub-${g.id}`} extraTabs={shopTab} items={g.todos} cats={todoCats(g)} color={COLOR} onAdd={(text, cat) => text.split(/,|\n/).map((x) => x.trim()).filter(Boolean).forEach((x) => addItem(g.id, 'todos', { text: x, cat }))} onToggle={(id) => updateItem(g.id, 'todos', id, { done: !g.todos.find((x) => x.id === id).done })} onRemove={(id) => removeItem(g.id, 'todos', id)} placeholder="Neues To-do" />}
        {cur === 'gaeste' && (
          <>
            <div className="list">
              <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addGuest(g.id, { name: guest }); setGuestText(''); }}>
                <input className="input" value={guest} onChange={(e) => setGuestText(e.target.value)} placeholder="Name hinzufügen" aria-label="Gast hinzufügen" />
                <button type="submit" className="btn small" disabled={!guest.trim()}>+</button>
              </form>
              {g.guests.length === 0 && <div className="empty">Noch keine Gäste. Du musst nicht alle kennen – für die Planung reicht oben die ungefähre Zahl.</div>}
              {g.guests.map((x) => (
                <div key={x.id} className="row compact">
                  <span className="row-main"><span className="row-title plain">{x.name}</span></span>
                  {phoneOf(x) && x.status === 'offen' && <a className="pill" href={`https://wa.me/${phoneOf(x)}?text=${encodeURIComponent(inviteText(g))}`} target="_blank" rel="noreferrer" onClick={() => setGuest(g.id, x.id, { status: 'eingeladen' })}>WhatsApp</a>}
                  <button type="button" className="pill" style={{ color: STATUS_COLOR[x.status] }} onClick={() => setGuest(g.id, x.id, { status: NEXT[x.status] })} aria-label={`Status von ${x.name}: ${GUEST_STATUS[x.status]} – antippen zum Ändern`}>{GUEST_STATUS[x.status].replace('Noch nicht eingeladen', 'Einladen')}</button>
                  <button type="button" className="x-btn" aria-label={`${x.name} entfernen`} onClick={() => removeGuest(g.id, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
                </div>
              ))}
            </div>
            <Info>Status antippen: Einladen → Eingeladen → Zugesagt → Abgesagt.</Info>
            {s.people.length > 0 && <button type="button" className="btn tint small" onClick={() => setPickGuests(true)}>👥 Aus Menschen auswählen</button>}
            {(() => {
              const next = g.guests.filter((x) => x.status === 'offen' && phoneOf(x));
              if (!next.length) return null;
              const x = next[0];
              return (
                <div className="take-box" style={{ gap: 6 }}>
                  <span style={{ fontWeight: 650, fontSize: 14 }}>📲 Nacheinander per WhatsApp einladen · noch {next.length}</span>
                  <a className="btn small" href={`https://wa.me/${phoneOf(x)}?text=${encodeURIComponent(inviteText(g))}`} target="_blank" rel="noreferrer" onClick={() => setGuest(g.id, x.id, { status: 'eingeladen' })}>{x.name} einladen →</a>
                  <Info>Öffnet den Chat mit der fertigen Einladung – du tippst nur noch auf Senden. Danach zurück in die App, dann kommt der Nächste.</Info>
                </div>
              );
            })()}
          </>
        )}
        <GuestPicker s={s} g={g} open={pickGuests} onClose={() => setPickGuests(false)} />
        {cur === 'orte' && <Venues g={g} />}
        {cur === 'mitbringen' && (
          <>
            <SimpleList items={g.bring} color={COLOR} onAdd={(text, who) => addItem(g.id, 'bring', { text: text.trim(), who: String(who || '').trim() })} onToggle={(id) => updateItem(g.id, 'bring', id, { done: !g.bring.find((x) => x.id === id).done })} onRemove={(id) => removeItem(g.id, 'bring', id)} meta={(x) => (x.who ? `bringt ${x.who}` : 'noch niemand eingeteilt')} placeholder="z.B. Salat, Wein, Eis" extraInput="Wer?" />
            <Info>Was Gäste mitbringen könnten – abhaken, sobald jemand zugesagt hat.</Info>
          </>
        )}
        {cur === 'einladung' && (
          <section className="card" style={{ gap: 10 }}>
            <Info>Allgemeine Einladung an alle – ohne Namen. Wann, Wo und der Google-Maps-Link kommen automatisch aus dem Überblick dazu.</Info>
            <textarea className="input" style={{ minHeight: 120 }} defaultValue={g.invite} key={g.id + 'i' + (g.invite || '').length} placeholder="z.B. Hey! Am Samstag gibt’s Asado bei mir 🔥 Bring gute Laune mit. Bist du dabei? – oder unten im KI-Planer „Einladung schreiben“." onBlur={(e) => e.target.value !== g.invite && updateGathering(g.id, { invite: e.target.value })} aria-label="Einladungstext" />
            {inviteDetails(g) ? <div className="take-box" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{inviteDetails(g)}</div> : <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setTab('ueberblick')}>Datum, Uhrzeit, Ort und Adresse im Überblick eintragen ›</button>}
            <button type="button" className="btn" onClick={share}>Einladung teilen (WhatsApp …)</button>
            <Info>„Teilen“ öffnet die iPhone-Auswahl – dort WhatsApp und dann eine Gruppe oder Person wählen. Gäste mit Telefonnummer kannst du unter „Gäste“ auch einzeln einladen.</Info>
            <WaGroups s={s} text={inviteText(g)} />
          </section>
        )}
        <PlanChat
          title="KI-Planer"
          compact
          placeholder="Was brauchst du?"
          intro={home ? 'Ideen, Menü, Getränke, Einladung – ich trage es direkt ein.' : 'Ort finden, reservieren, Einladung – ich trage es direkt ein.'}
          history={g.chat}
          prefKey="event"
          onSave={(chat) => updateGathering(g.id, { chat })}
          onAsk={async (hist, o) => { const r = await gatherAssist(s, g, hist, o); if (r?.ueberblick && !Array.isArray(r.ueberblick)) r.ueberblick = Object.values(r.ueberblick).some(Boolean) ? [r.ueberblick] : []; return r; }}
          webChips={home ? [] : ['Passenden Ort finden']}
          groups={PLAN_GROUPS}
          onApply={(sel) => applyGatherProposal(g.id, sel)}
          chips={home ? ['Was kochen?', 'Getränke & Mengen', 'Einladung schreiben', 'Was mitbringen?'] : ['Passenden Ort finden', 'Einladung schreiben', 'Wie reservieren?']}
        />
        <button type="button" className="btn sec" onClick={() => { updateGathering(g.id, { done: !g.done }); toast(g.done ? 'Wieder offen' : 'Abgehakt'); if (!g.done) go('/saeule/sozial'); }}>{g.done ? 'Wieder öffnen' : 'Event abhaken (hat stattgefunden)'}</button>
        <button type="button" className="btn danger" onClick={() => { archiveGathering(g.id); toast('Rausgenommen – unten in Sozial zurückholbar'); go('/saeule/sozial'); }}>Event rausnehmen</button>
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
