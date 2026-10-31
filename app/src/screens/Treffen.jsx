import { askDel } from '../lib/undo';
import { useEffect, useState } from 'react';
import { useDictation } from '../lib/dictate';
import { getAi } from '../lib/ai';
const hasKey = () => !!getAi().apiKey;
import { store, useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addGathering, addGuest, addWaGroup, removeWaGroup, addItem, applyGatherProposal, gatherAssist, GUEST_STATUS, KINDS, removeGathering, removeGuest, removeItem, setGuest, setKind, inviteText, inviteDetails, setOccasion, occasionsFor, occasionOf, templatesOf, saveTemplate, removeTemplate, resetTemplates, tplForKind, editTemplateAI, stdTpl, setStdTpl, PHASES, todoCats, SHOP_CATS, updateGathering, updateItem, VENUE_STATUS,
} from '../lib/gather';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import GroupedChecklist from '../components/GroupedChecklist';
import PlanChat from '../components/PlanChat';
import { DateRangeField } from '../components/DateRange';
import { Back, Check, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast, Info } from '../components/ui';
import { addInvite, INVITE_COLOR, INVITE_STATUS, removeInvite, updateInvite } from '../lib/invites';
import { Missing } from './Saeule';
import { RemovedButton } from '../components/RemovedList';
import AiFill from '../components/AiFill';
import { parseGatheringText, fillGathering } from '../lib/gather';
import { archiveGathering, archiveInvite, restoreGathering, restoreInvite } from '../lib/actions';
import { PEOPLE_CATEGORIES } from '../lib/seed';

const COLOR = '#E8775A';
const NEXT = { offen: 'eingeladen', eingeladen: 'zugesagt', zugesagt: 'abgesagt', abgesagt: 'offen' };
const STATUS_COLOR = { offen: 'var(--muted)', eingeladen: 'var(--accent)', zugesagt: '#2FA36B', abgesagt: 'var(--danger)' };
const VENUE_NEXT = { idee: 'angefragt', angefragt: 'reserviert', reserviert: 'abgelehnt', abgelehnt: 'idee' };
const EMPTY = { name: '', date: '', time: '', place: '', kind: 'zuhause', expected: '', type: '', guests: '', address: '', motto: '', diet: '', budget: '' };

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
      <AiFill key={key || 'x'} title="Einladung von Bekannten (privat, nichts bezahlt)" values={{ name: f.name, host: f.host, date: f.date, time: f.time, place: f.place, guests: f.guests, bring: f.bring, note: f.note, url: f.url }} onResult={(r) => set(r)}
        fields={{ name: 'Was (z.B. Geburtstag von Juan)', host: 'Wer lädt ein', date: 'Datum YYYY-MM-DD', time: 'Uhrzeit HH:MM', place: 'Ort/Adresse', status: { d: 'Zusage-Stand', enum: Object.keys(INVITE_STATUS) }, guests: 'Wer ist noch dabei, Namen mit Komma', bring: 'Was Mateo mitbringt', note: 'Notiz', url: 'Link' }}
        placeholder="z.B. „Juan lädt Samstag 20 Uhr zum Geburtstag ein, bei ihm in Palermo, ich bring Wein“" />
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
      {!x.done && x.place && <a className="pill on" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(x.place)}`} target="_blank" rel="noreferrer" aria-label={`Weg zu ${x.name}`}>Route</a>}
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

// v1.03 (Mateo): Vorlagen hinter einem Knopf; Standard „Leer“; Vorlagen selbst anlegen und bearbeiten
const lines = (v) => String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
function TemplateEditor({ s, open, onClose, kindHint }) {
  const all = templatesOf(s);
  const [ed, setEd] = useState(null); // { key, label, emoji, kind, todos: {phase: text}, shop: {cat: text} }
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const dict = useDictation(wish, setWish);
  const runAI = async () => {
    if (!wish.trim()) return;
    dict.stop?.();
    setBusy(true);
    try {
      const cur = { label: ed.label, emoji: ed.emoji, kind: ed.kind, mottos: lines(ed.mottos), bring: lines(ed.bring), todos: Object.fromEntries(PHASES.map((p) => [p, lines(ed.todos[p])])), shop: Object.fromEntries(SHOP_CATS.map((c) => [c, lines(ed.shop[c])])) };
      const r = await editTemplateAI(cur, wish.trim());
      setEd({ ...ed, label: ed.label || r.label, emoji: r.emoji || ed.emoji, mottos: (r.mottos || []).join('\n'), bring: (r.bring || []).join('\n'), todos: Object.fromEntries(PHASES.map((p) => [p, (r.todos[p] || []).join('\n')])), shop: Object.fromEntries(SHOP_CATS.map((c) => [c, (r.shop[c] || []).join('\n')])) });
      setWish('');
      toast('Von der KI geändert – prüfen und speichern');
    } catch (e) { toast(e.message || 'Hat nicht geklappt'); }
    setBusy(false);
  };
  const start = (k) => {
    const o = k ? all[k] : { label: '', emoji: '📋', kind: kindHint || 'zuhause', todos: {}, shop: {} };
    setEd({ key: k, label: o.label, emoji: o.emoji, kind: o.kind, mottos: (o.mottos || []).join('\n'), bring: (o.bring || []).join('\n'), todos: Object.fromEntries(PHASES.map((p) => [p, (o.todos?.[p] || []).join('\n')])), shop: Object.fromEntries(SHOP_CATS.map((c) => [c, (o.shop?.[c] || []).join('\n')])) });
  };
  const save = () => {
    saveTemplate(ed.key, { label: ed.label.trim() || 'Vorlage', emoji: ed.emoji || '📋', kind: ed.kind, mottos: lines(ed.mottos), bring: lines(ed.bring), todos: Object.fromEntries(PHASES.map((p) => [p, lines(ed.todos[p])])), shop: ed.kind === 'auswaerts' ? {} : Object.fromEntries(SHOP_CATS.map((c) => [c, lines(ed.shop[c])])) });
    toast('Vorlage gespeichert');
    setEd(null);
  };
  return (
    <Sheet open={open} title={ed ? (ed.key ? 'Vorlage bearbeiten' : 'Neue Vorlage') : 'Vorlagen bearbeiten'} onClose={() => { setEd(null); onClose(); }}>
      {!ed ? (
        <>
          <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => start(null)}>＋ Neue Vorlage</button>
          <div className="list">
            {Object.entries(all).filter(([k]) => k !== 'leer').sort(([, a], [, b]) => (a.kind === kindHint ? 0 : 1) - (b.kind === kindHint ? 0 : 1)).map(([k, o]) => (
              <div key={k} className="row compact">
                <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => start(k)}>
                  <span className="row-title plain">{o.emoji} {o.label}</span>
                  <span className="row-meta">{o.kind === 'auswaerts' ? 'Woanders' : o.kind === 'zuhause' ? 'Zu Hause' : 'Beides'} · {PHASES.reduce((n, p) => n + (o.todos?.[p] || []).length, 0)} To-dos{o.kind !== 'auswaerts' ? ` · ${SHOP_CATS.reduce((n, c) => n + (o.shop?.[c] || []).length, 0)} Einkauf` : ''}</span>
                </button>
                <button type="button" className="x-btn" aria-label={`${o.label} entfernen`} onClick={() => askDel(`Vorlage „${o.label}“ entfernen? Bestehende Events bleiben unverändert.`) && removeTemplate(k)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
          </div>
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => confirm('Alle Vorlagen auf den Standard zurücksetzen?') && resetTemplates()}>Auf Standard zurücksetzen</button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="field" style={{ width: 70 }}><span>Symbol</span><input className="input" value={ed.emoji} onChange={(e) => setEd({ ...ed, emoji: e.target.value })} data-noclear style={{ textAlign: 'center' }} aria-label="Symbol" /></label>
            <label className="field" style={{ flex: 1 }}><span>Name</span><input className="input" value={ed.label} onChange={(e) => setEd({ ...ed, label: e.target.value })} placeholder="z.B. Weihnachtsessen" /></label>
          </div>
          <div className="chips">{[['zuhause', '🏠 Zu Hause'], ['auswaerts', '📍 Woanders'], [null, 'Beides']].map(([k, l]) => <button key={String(k)} type="button" className={ed.kind === k ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setEd({ ...ed, kind: k })}>{l}</button>)}</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 15 }}>✨ Mit der KI {ed.key ? 'ändern' : 'erstellen'}</b>
            <textarea className="input" rows={2} value={wish} onChange={(e) => setWish(e.target.value)} placeholder={ed.key ? 'z.B. „Füg Nachtisch hinzu und streich die Deko“' : 'z.B. „Weihnachtsessen für 10 Leute mit Fondue“'} />
            <div className="ai-input-row">
              <button type="button" className={dict.on ? 'mic on' : 'mic'} onClick={dict.toggle} aria-label={dict.on ? 'Zuhören stoppen' : 'Sprechen'}><Icon name={dict.on ? 'stop' : 'mic'} size={18} /></button>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn small" disabled={busy || !wish.trim() || !hasKey()} onClick={runAI}>{busy ? 'Denkt nach …' : ed.key ? '✨ Ändern' : '✨ Erstellen'}</button>
            </div>
            {!hasKey() && <span className="tiny">Dafür braucht es den KI-Schlüssel (Einstellungen).</span>}
          </div>
          <span className="tiny">Ein Eintrag pro Zeile.</span>
          {PHASES.map((p) => <label key={p} className="field"><span>To-dos · {p}</span><textarea className="input" rows={3} value={ed.todos[p]} onChange={(e) => setEd({ ...ed, todos: { ...ed.todos, [p]: e.target.value } })} /></label>)}
          <label className="field"><span>💡 Motto-Ideen (erscheinen im Überblick zum Antippen)</span><textarea className="input" rows={2} value={ed.mottos} onChange={(e) => setEd({ ...ed, mottos: e.target.value })} placeholder={ed.kind === 'auswaerts' ? 'z.B. Sushi\nParrilla\nRooftop' : 'z.B. 80er\nFondue'} /></label>
          <label className="field"><span>🎒 Mitbringen</span><textarea className="input" rows={2} value={ed.bring} onChange={(e) => setEd({ ...ed, bring: e.target.value })} placeholder="z.B. Decke\nBecher" /></label>
          {ed.kind !== 'auswaerts' && SHOP_CATS.map((c) => <label key={c} className="field"><span>🛒 Einkauf · {c}</span><textarea className="input" rows={2} value={ed.shop[c]} onChange={(e) => setEd({ ...ed, shop: { ...ed.shop, [c]: e.target.value } })} /></label>)}
          <div className="sheet-foot">
            <button type="button" className="btn tint" onClick={() => setEd(null)}>Zurück</button>
            <button type="button" className="btn" onClick={save}>Speichern</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
function TemplateButton({ s, kind, value, onPick }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const all = templatesOf(s);
  const cur = all[value] || all.leer;
  const std = stdTpl(kind, s);
  const list = occasionsFor(kind, s).sort(([a], [b]) => (a === 'leer' ? -1 : b === 'leer' ? 1 : a === std ? -1 : b === std ? 1 : 0));
  return (
    <>
      <button type="button" className="drop-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)} aria-label="Vorlage wählen"><span>📋 Vorlage:</span><b>{cur.emoji} {cur.label}</b><span className="drop-caret">▾</span></button>
      <Sheet open={open && !edit} title={`Vorlage · ${kind === 'auswaerts' ? '📍 Woanders' : '🏠 Zu Hause'}`} onClose={() => setOpen(false)}>
        <span className="tiny">⭐ = Standard für {kind === 'auswaerts' ? 'Woanders' : 'Zu Hause'} (wird beim Anlegen und beim Wechseln der Art automatisch genommen). Stern antippen = zum Standard machen.</span>
        <div className="list">
          {list.map(([k, o]) => (
            <div key={k} className="row compact" style={{ background: k === value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : undefined }}>
              <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }} onClick={() => { onPick(k, o); setOpen(false); }}>
                <span className="row-title plain">{o.emoji} {o.label}{k === value ? ' ✓' : ''}</span>{!o.empty && <span className="row-meta">{(o.mottos?.length ? o.mottos : PHASES.flatMap((p) => o.todos?.[p] || [])).slice(0, 4).join(', ')} …</span>}
              </button>
              <button type="button" className="x-btn" style={{ fontSize: 18 }} aria-label={k === std ? `${o.label} ist Standard` : `${o.label} als Standard`} onClick={() => { setStdTpl(kind, k); toast(`${o.label} ist jetzt Standard`); }}>{k === std ? '⭐' : '☆'}</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn tint small" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit(true)}>✎ Vorlagen bearbeiten</button>
      </Sheet>
      <TemplateEditor s={s} open={open && edit} kindHint={kind} onClose={() => setEdit(false)} />
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
  // v1.24 (Mateo): Geplant (findet statt) | Ideen
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('life-app-veranst-view') || 'plan'; } catch { return 'plan'; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem('life-app-veranst-view', v); } catch {} };
  const ideas = list.filter((g) => g.idea);
  const real = list.filter((g) => !g.idea);
  const upcoming = real.filter((g) => !g.done && (!g.date || g.date >= t));
  const past = real.filter((g) => !g.done && g.date && g.date < t); // vorbei, aber noch nicht abgehakt
  const done = real.filter((g) => g.done).reverse();
  const isIdea = view === 'idee';
  const [tab, setTabState] = useState(() => { try { return localStorage.getItem(TAB_KEY) || 'eigene'; } catch { return 'eigene'; } });
  const setTab = (v) => { setTabState(v); try { localStorage.setItem(TAB_KEY, v); } catch {} };
  const [invSheet, setInvSheet] = useState(() => { try { const v = sessionStorage.getItem('life-open-new-invite'); sessionStorage.removeItem('life-open-new-invite'); return v ? 'neu' : null; } catch { return null; } });
  useEffect(() => { try { if (sessionStorage.getItem('life-open-new-event')) { sessionStorage.removeItem('life-open-new-event'); setTab('eigene'); setF({ ...EMPTY, type: stdTpl('zuhause', s) }); setOpen(true); } } catch {} }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    const id = addGathering({ ...f, idea: isIdea });
    fillGathering(id, f);
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
          <span className={g.done ? 'row-title strong done' : 'row-title strong'}>{occasionOf(g.type)?.emoji || (g.kind === 'auswaerts' ? '📍' : '🏠')} {g.name}</span>
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
          </div>
        </div>
        <Segmented full options={[{ id: 'eigene', label: 'Eigene' }, { id: 'andere', label: `Von anderen${(s.invites || []).filter((x) => !x.done).length ? ` · ${(s.invites || []).filter((x) => !x.done).length}` : ''}` }]} value={tab} onChange={setTab} label="Art der Events" />
        {tab === 'andere' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'eigene' ? <button type="button" className="btn small" onClick={() => { setF({ ...EMPTY, type: stdTpl('zuhause', s) }); setOpen(true); }}>{isIdea ? '+ Idee' : '+ Treffen'}</button> : <button type="button" className="btn small" onClick={() => setInvSheet('neu')}>+ Einladung</button>}
          <span style={{ flex: 1 }} />
          {tab === 'eigene' ? <RemovedButton items={(s.removedGatherings || []).filter((g) => !!g.idea === isIdea)} storeKey="removedGatherings" onRestore={restoreGathering} meta={(g) => [g.date && fmtShort(g.date), g.place].filter(Boolean).join(' · ')} /> : <RemovedButton items={s.removedInvites || []} storeKey="removedInvites" onRestore={restoreInvite} meta={(x) => [x.host && `von ${x.host}`, x.date && fmtShort(x.date)].filter(Boolean).join(' · ')} />}
        </div>
        )}
        {tab === 'andere' ? <Invites s={s} sheet={invSheet} setSheet={setInvSheet} /> : (<>
        <div className="seg full" role="group" aria-label="Geplant oder Idee">
          <button type="button" className={!isIdea ? 'on' : ''} onClick={() => setView('plan')}>📅 Geplant{upcoming.length ? ` · ${upcoming.length}` : ''}</button>
          <button type="button" className={isIdea ? 'on' : ''} onClick={() => setView('idee')}>💡 Ideen{ideas.length ? ` · ${ideas.length}` : ''}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'eigene' ? <button type="button" className="btn small" onClick={() => { setF({ ...EMPTY, type: stdTpl('zuhause', s) }); setOpen(true); }}>{isIdea ? '+ Idee' : '+ Treffen'}</button> : <button type="button" className="btn small" onClick={() => setInvSheet('neu')}>+ Einladung</button>}
          <span style={{ flex: 1 }} />
          {tab === 'eigene' ? <RemovedButton items={(s.removedGatherings || []).filter((g) => !!g.idea === isIdea)} storeKey="removedGatherings" onRestore={restoreGathering} meta={(g) => [g.date && fmtShort(g.date), g.place].filter(Boolean).join(' · ')} /> : <RemovedButton items={s.removedInvites || []} storeKey="removedInvites" onRestore={restoreInvite} meta={(x) => [x.host && `von ${x.host}`, x.date && fmtShort(x.date)].filter(Boolean).join(' · ')} />}
        </div>
        {isIdea && (
          <div className="list">
            {ideas.length === 0 && <div className="empty">Noch keine Ideen. Oben „+ Idee“ – z.B. „Spieleabend mal wieder“ oder „Asado im Sommer“. Wenn es konkret wird: „Planen →“.</div>}
            {ideas.map((g) => (
              <div key={g.id} className="row" style={{ minHeight: 58 }}>
                <a href={`#/treffen/${g.id}`} className="row-main">
                  <span className="row-title strong">{occasionOf(g.type)?.emoji || '💡'} {g.name}</span>
                  <span className="row-meta">{[g.date && fmtShort(g.date), g.expected && `ca. ${g.expected} Gäste`, g.todos?.length && `${g.todos.length} To-dos`].filter(Boolean).join(' · ') || 'Idee'}</span>
                </a>
                <button type="button" className="pill on" onClick={() => { updateGathering(g.id, { idea: false }); toast('Wird stattfinden – steht jetzt unter „Geplant“'); }}>Planen →</button>
                <button type="button" className="x-btn" aria-label={`${g.name} rausnehmen`} onClick={() => { archiveGathering(g.id); toast('Rausgenommen – oben über die Kiste zurückholbar'); }}><Icon name="x" size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {!isIdea && <>
        <div className="list">
          {upcoming.length === 0 && <div className="empty">Organisier deine eigenes Treffen – Asado, Spieleabend, Lauftreff … mit Einladung, Gästeliste, Einkaufsliste und To-dos.</div>}
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
        </>}
        </>)}
      </main>
      <Sheet open={open} title={isIdea ? 'Neue Idee' : 'Neues Treffen'} onClose={() => setOpen(false)}>
        <AiFill key={String(open)} values={{ name: f.name, date: f.date, time: f.time, place: f.place }} placeholder="z.B. „Asado bei mir nächsten Samstag ab 13 Uhr, so 10 Leute“" onFill={async (txt) => {
          const r = await parseGatheringText(store.get(), txt);
          if (!r?.name) throw new Error('Nichts erkannt – erzähl etwas mehr');
          const names = (Array.isArray(r.gaeste_namen) ? r.gaeste_namen : []).filter(Boolean);
          const C = (t) => (t ? t.charAt(0).toLocaleUpperCase('de-DE') + t.slice(1) : t);
          setF((x) => ({ ...x, name: C(r.name) || x.name, date: /^\d{4}-\d{2}-\d{2}$/.test(r.datum || '') ? r.datum : x.date, time: /^\d{1,2}:\d{2}$/.test(r.uhrzeit || '') ? r.uhrzeit.padStart(5, '0') : x.time, kind: r.art || x.kind, type: r.vorlage || x.type, expected: String(r.gaeste || '').replace(/[^\d–-]/g, '') || (names.length ? String(names.length) : '') || x.expected, place: C(r.ort) || x.place, address: r.adresse || x.address, guests: [x.guests, ...names.map(C)].filter(Boolean).join(', '), motto: C(r.motto) || x.motto, diet: C(r.einschraenkungen) || x.diet, budget: r.budget || x.budget }));
        }} />
        <div className="seg-mini">
          {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" className={f.kind === k ? 'chip on' : 'chip soft'} onClick={() => f.kind !== k && setF({ ...f, kind: k, type: tplForKind(f.type || 'leer', k, f.tplByKind || {}), tplByKind: { ...(f.tplByKind || {}), [f.kind]: f.type || 'leer' } })}>{k === 'zuhause' ? '🏠 ' : '📍 '}{l}</button>)}
        </div>
        <div className="field">
          <span>Vorlage – bringt passende To-dos{f.kind === 'zuhause' ? ' und Einkauf' : ''} mit</span>
          <TemplateButton s={s} kind={f.kind} value={f.type || 'leer'} onPick={(k, o) => setF({ ...f, type: k, name: f.name || (k !== 'leer' && !k.startsWith('allgemein') ? o.label.split(' /')[0] : '') })} />
        </div>
        <span className="tiny">{f.kind === 'zuhause' ? 'Bei dir: Menü, Getränke, Einkauf, Mitbringen, Vorbereitung.' : 'Woanders: Ort finden, reservieren, Gästen Adresse schicken.'}</span>
        <Field label="Was? (darf noch offen sein)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.kind === 'zuhause' ? 'z.B. Asado bei mir' : 'z.B. Geburtstagsessen'} /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Datum"><DateRangeField single from={f.date} to="" onChange={(v) => setF({ ...f, date: v.from })} placeholder="Offen" title="Datum" /></Field>
          <Field label="Uhrzeit"><input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Ungefähr wie viele Gäste?"><input className="input" inputMode="numeric" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value.replace(/[^\d–-]/g, '') })} placeholder="z.B. 8 – darf auch leer bleiben" /></Field>
        <Field label="Wo?"><input className="input" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} placeholder={f.kind === 'zuhause' ? 'z.B. bei mir' : 'z.B. Don Julio'} /></Field>
        <Field label="Wer kommt? (Namen mit Komma, optional)"><input className="input" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} placeholder="z.B. Juan, Pedro, Lucía" /></Field>
        {(f.address || f.motto || f.diet || f.budget) && <>
          {f.address && <Field label="Adresse"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>}
          {f.motto && <Field label="Motto"><input className="input" value={f.motto} onChange={(e) => setF({ ...f, motto: e.target.value })} /></Field>}
          {f.diet && <Field label="Einschränkungen"><input className="input" value={f.diet} onChange={(e) => setF({ ...f, diet: e.target.value })} /></Field>}
          {f.budget && <Field label="Budget"><input className="input" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>}
        </>}
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
            ? <button key={x.id} type="button" className="chip editing" onClick={() => askDel(`„${x.name}“ entfernen?`) && removeWaGroup(x.id)}>{x.name} ✕</button>
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
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name suchen …" aria-label="Personen suchen" />
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
      <button type="button" className="btn" disabled={!sel.length} onClick={() => { for (const id of sel) { const p = s.people.find((x) => x.id === id); if (p) addGuest(g.id, { name: p.name, personId: p.id }); } toast(`${sel.length} Gäste hinzugefügt`); close(); }}>{sel.length ? `${sel.length} hinzufügen` : 'Personen antippen'}</button>
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
          {g.idea
            ? <div className="take-box" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, fontSize: 14 }}>💡 Das ist noch eine Idee</span><button type="button" className="pill on" onClick={() => { updateGathering(g.id, { idea: false }); toast('Wird stattfinden – steht jetzt unter „Geplant“'); }}>Wird stattfinden →</button></div>
            : null}
          <TemplateButton s={s} kind={g.kind} value={g.type || 'leer'} onPick={(k, o) => { setOccasion(g.id, k); toast(o.empty ? 'Leer: Vorlage entfernt – selbst füllen oder KI fragen' : `${o.label}: Vorlage ergänzt`); }} />
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
          {occasionOf(g.type)?.mottos?.length > 0 && <div className="chips">{occasionOf(g.type).mottos.map((m) => <button key={m} type="button" className={g.motto === m ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => updateGathering(g.id, { motto: g.motto === m ? '' : m })}>{m}</button>)}</div>}
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
            {s.people.length > 0 && <button type="button" className="btn tint small" onClick={() => setPickGuests(true)}>👥 Aus Personen auswählen</button>}
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
            <Info>Allgemeine Einladung an alle – ohne Namen. Wann, Wo und der Google-Maps-Link kommen automatisch aus dem Überblick dazu. „Teilen“ öffnet die iPhone-Auswahl – dort WhatsApp und dann eine Gruppe oder Person wählen. Gäste mit Telefonnummer kannst du unter „Gäste“ auch einzeln einladen.</Info>
            <textarea className="input" style={{ minHeight: 120 }} defaultValue={g.invite} key={g.id + 'i' + (g.invite || '').length} placeholder="z.B. Hey! Am Samstag gibt’s Asado bei mir 🔥 Bring gute Laune mit. Bist du dabei? – oder unten im KI-Planer „Einladung schreiben“." onBlur={(e) => e.target.value !== g.invite && updateGathering(g.id, { invite: e.target.value })} aria-label="Einladungstext" />
            {inviteDetails(g) ? <div className="take-box" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{inviteDetails(g)}</div> : <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setTab('ueberblick')}>Datum, Uhrzeit, Ort und Adresse im Überblick eintragen ›</button>}
            <button type="button" className="btn" onClick={share}>Einladung teilen (WhatsApp …)</button>
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
        {!g.idea && !g.done && <button type="button" className="btn sec" onClick={() => { updateGathering(g.id, { idea: true }); toast('Wieder eine Idee – steht unter „Ideen“'); }}>💡 Doch nur eine Idee</button>}
        <button type="button" className="btn danger" onClick={() => { archiveGathering(g.id); toast('Rausgenommen – unten in Sozial zurückholbar'); go('/saeule/sozial'); }}>Treffen rausnehmen</button>
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
