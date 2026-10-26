import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addGatherItem, addGathering, addGuest, GUEST_STATUS, planGathering, removeGatherItem, removeGathering, removeGuest, setGuest, toggleGatherItem, updateGathering,
} from '../lib/leisure';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import { Back, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const COLOR = '#E8775A';
const NEXT = { offen: 'eingeladen', eingeladen: 'zugesagt', zugesagt: 'abgesagt', abgesagt: 'offen' };
const STATUS_COLOR = { offen: 'var(--muted)', eingeladen: 'var(--accent)', zugesagt: '#2FA36B', abgesagt: 'var(--danger)' };

function List({ s }) {
  const t = today();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', date: '', time: '', place: '' });
  const list = [...s.gatherings].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const upcoming = list.filter((g) => !g.date || g.date >= t);
  const past = list.filter((g) => g.date && g.date < t);
  const save = () => {
    const id = addGathering(f);
    setOpen(false);
    setF({ name: '', date: '', time: '', place: '' });
    go(`/treffen/${id}`);
  };
  const Row = ({ g }) => {
    const yes = g.guests.filter((x) => x.status === 'zugesagt').length;
    return (
      <a href={`#/treffen/${g.id}`} className="row" style={{ minHeight: 62 }}>
        <span className="block-icon" style={{ background: 'color-mix(in srgb, #E8775A 14%, transparent)', color: COLOR }}><Icon name="users" size={16} /></span>
        <span className="row-main">
          <span className="row-title strong">{g.name}</span>
          <span className="row-meta">{[g.date ? `${fmtShort(g.date)}${g.time ? `, ${g.time}` : ''}` : 'Datum offen', g.date && g.date >= t && `in ${diffDays(t, g.date)} Tagen`, g.guests.length && `${yes}/${g.guests.length} zugesagt`].filter(Boolean).join(' · ')}</span>
        </span>
        <Chevron />
      </a>
    );
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/erlebnisse" label="Gemeinsame Erlebnisse" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Treffen planen</h1>
            <button type="button" className="btn small" onClick={() => setOpen(true)}>+ Treffen</button>
          </div>
        </div>
        <div className="list">
          {upcoming.length === 0 && <div className="empty">Organisier dein eigenes Event – Asado, Spieleabend, Lauftreff … mit Einladung, Gästeliste, Einkaufsliste und To-dos.</div>}
          {upcoming.map((g) => <Row key={g.id} g={g} />)}
        </div>
        {past.length > 0 && (
          <section className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>Vergangen</h2>
            <div className="list">{past.reverse().map((g) => <Row key={g.id} g={g} />)}</div>
          </section>
        )}
      </main>
      <Sheet open={open} title="Neues Treffen" onClose={() => setOpen(false)}>
        <Field label="Was?"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z.B. Asado bei mir" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Datum"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Uhrzeit"><input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Wo?"><input className="input" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} placeholder="z.B. bei mir, Palermo" /></Field>
        <button type="button" className="btn" onClick={save} disabled={!f.name.trim()}>Anlegen</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

function Detail({ s, g }) {
  const [tab, setTab] = useState('gaeste');
  const [guest, setGuestText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
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
  const ai = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await planGathering(s, g.id);
      if (r.einladung) updateGathering(g.id, { invite: r.einladung });
      (r.einkaufen || []).forEach((x) => addGatherItem(g.id, 'shopping', x));
      (r.todos || []).forEach((x) => addGatherItem(g.id, 'todos', x));
      toast('Einladung geschrieben und Listen ergänzt');
      setTab('einladung');
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/treffen" label="Treffen planen" />
          <input className="input title-input" defaultValue={g.name} key={g.id + 'n'} onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && updateGathering(g.id, { name: e.target.value.trim() })} aria-label="Name" />
        </div>
        <section className="card" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="date" value={g.date || ''} onChange={(e) => updateGathering(g.id, { date: e.target.value })} aria-label="Datum" />
            <input className="input" type="time" value={g.time || ''} onChange={(e) => updateGathering(g.id, { time: e.target.value })} aria-label="Uhrzeit" style={{ maxWidth: 120 }} />
          </div>
          <input className="input" defaultValue={g.place} key={g.id + 'p'} placeholder="Wo?" onBlur={(e) => e.target.value !== g.place && updateGathering(g.id, { place: e.target.value })} aria-label="Ort" />
          <input className="input" defaultValue={g.desc} key={g.id + 'd'} placeholder="Worum geht's? z.B. Asado, jeder bringt was mit" onBlur={(e) => e.target.value !== g.desc && updateGathering(g.id, { desc: e.target.value })} aria-label="Beschreibung" />
          <div className="stat-row">
            <div><span className="tiny">Zugesagt</span><b style={{ color: '#2FA36B' }}>{counts.zugesagt}</b></div>
            <div><span className="tiny">Offen</span><b>{counts.eingeladen + counts.offen}</b></div>
            <div><span className="tiny">Abgesagt</span><b style={{ color: 'var(--danger)' }}>{counts.abgesagt}</b></div>
          </div>
        </section>

        <button type="button" className="card design-cta" onClick={ai} disabled={busy || !getAi().apiKey}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span>
          <span className="row-main">
            <span className="row-title strong">{busy ? 'Ich plane …' : 'Mit KI vorbereiten'}</span>
            <span className="row-meta">Schreibt die Einladung und schlägt Einkaufsliste und To-dos vor</span>
          </span>
        </button>
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}

        <Segmented full options={[{ id: 'gaeste', label: `Gäste (${g.guests.length})` }, { id: 'einladung', label: 'Einladung' }, { id: 'shopping', label: `Einkauf (${g.shopping.filter((x) => !x.done).length})` }, { id: 'todos', label: `To-dos (${g.todos.filter((x) => !x.done).length})` }]} value={tab} onChange={setTab} label="Bereich" />

        {tab === 'gaeste' && (
          <>
            <div className="list">
              {g.guests.length === 0 && <div className="empty">Noch keine Gäste.</div>}
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
            {suggestions.length > 0 && (
              <div className="chips">{suggestions.map((p) => <button key={p.id} type="button" className="chip soft" onClick={() => addGuest(g.id, { name: p.name, personId: p.id })}>+ {p.name}</button>)}</div>
            )}
          </>
        )}
        {tab === 'einladung' && (
          <section className="card" style={{ gap: 10 }}>
            <textarea className="input" style={{ minHeight: 150 }} defaultValue={g.invite} key={g.id + 'i' + (g.invite || '').length} placeholder="Deine Einladung – oder lass sie oben von der KI schreiben." onBlur={(e) => e.target.value !== g.invite && updateGathering(g.id, { invite: e.target.value })} aria-label="Einladungstext" />
            <button type="button" className="btn" onClick={share}>Einladung teilen (WhatsApp …)</button>
            <span className="tiny">Gäste mit Telefonnummer kannst du unter „Gäste“ auch einzeln per WhatsApp einladen.</span>
          </section>
        )}
        {tab === 'shopping' && (
          <SimpleList items={g.shopping} color={COLOR} onAdd={(text, who) => addGatherItem(g.id, 'shopping', text, who)} onToggle={(id) => toggleGatherItem(g.id, 'shopping', id)} onRemove={(id) => removeGatherItem(g.id, 'shopping', id)} meta={(x) => (x.who ? `bringt ${x.who}` : '')} placeholder="z.B. 3 kg Fleisch" extraInput="Wer?" />
        )}
        {tab === 'todos' && (
          <SimpleList items={g.todos} color={COLOR} onAdd={(text) => addGatherItem(g.id, 'todos', text)} onToggle={(id) => toggleGatherItem(g.id, 'todos', id)} onRemove={(id) => removeGatherItem(g.id, 'todos', id)} placeholder="z.B. Grill sauber machen" />
        )}
        <button type="button" className="btn danger" onClick={() => { if (confirm(`„${g.name}“ löschen?`)) { removeGathering(g.id); go('/treffen'); } }}>Treffen löschen</button>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Treffen({ id }) {
  const s = useStore();
  if (!id) return <List s={s} />;
  const g = s.gatherings.find((x) => x.id === id);
  return g ? <Detail s={s} g={g} /> : <Missing />;
}
