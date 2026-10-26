import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addExpense, addTrip, addTripItem, removeExpense, removeTrip, removeTripItem, toggleTripItem, TRIP_SECTIONS, tripIdeas, updateTrip,
} from '../lib/leisure';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import SimpleList from '../components/SimpleList';
import { Back, Chevron, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { Missing } from './Saeule';

const COLOR = '#2FA36B';
const fmtMoney = (n, c) => `${Math.round(n).toLocaleString('de-DE')} ${c}`;

function TripList({ s }) {
  const t = today();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ dest: '', from: '', to: '', budget: '' });
  const trips = [...s.trips].sort((a, b) => (a.from || '9') < (b.from || '9') ? -1 : 1);
  const upcoming = trips.filter((x) => !x.to || x.to >= t);
  const past = trips.filter((x) => x.to && x.to < t);
  const save = () => {
    const id = addTrip({ name: f.dest, dest: f.dest, from: f.from, to: f.to, budget: f.budget });
    setOpen(false);
    setF({ dest: '', from: '', to: '', budget: '' });
    go(`/reisen/${id}`);
  };
  const Row = ({ tr }) => (
    <a href={`#/reisen/${tr.id}`} className="row" style={{ minHeight: 62 }}>
      <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR }}><Icon name="plane" size={16} /></span>
      <span className="row-main">
        <span className="row-title strong">{tr.name}</span>
        <span className="row-meta">{[tr.from && `${fmtShort(tr.from)}${tr.to ? ` – ${fmtShort(tr.to)}` : ''}`, tr.from && tr.from > t && `in ${diffDays(t, tr.from)} Tagen`, `${tr.todo.filter((x) => !x.done).length} offen`].filter(Boolean).join(' · ')}</span>
      </span>
      <Chevron />
    </a>
  );
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/freizeit" label="Freizeit und Erlebnisse" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Reisen</h1>
            <button type="button" className="btn small" onClick={() => setOpen(true)}>+ Reise</button>
          </div>
        </div>
        <div className="list">
          {upcoming.length === 0 && <div className="empty">Noch keine Reise geplant. Jede Reise bekommt ihr eigenes Dashboard: To-dos, Packliste, Ideen vor Ort und Budget.</div>}
          {upcoming.map((tr) => <Row key={tr.id} tr={tr} />)}
        </div>
        {past.length > 0 && (
          <section className="group">
            <h2 className="label" style={{ padding: '0 4px' }}>Vergangene Reisen</h2>
            <div className="list">{past.reverse().map((tr) => <Row key={tr.id} tr={tr} />)}</div>
          </section>
        )}
      </main>
      <Sheet open={open} title="Neue Reise" onClose={() => setOpen(false)}>
        <Field label="Wohin?"><input className="input" value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })} placeholder="z.B. Florianópolis" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="Von"><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="Bis"><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <Field label="Budget in USD (optional)"><input className="input" inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
        <button type="button" className="btn" onClick={save} disabled={!f.dest.trim()}>Reise anlegen</button>
      </Sheet>
      <TabBar active="bereiche" />
    </>
  );
}

function TripDetail({ s, tr }) {
  const t = today();
  const [section, setSection] = useState('todo');
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const spent = tr.expenses.reduce((n, x) => n + x.amount, 0);
  const days = tr.from ? diffDays(t, tr.from) : null;
  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await tripIdeas(s, tr.id, wish.trim());
      (r.ideen || []).forEach((x) => addTripItem(tr.id, 'ideen', { text: x.text, note: x.notiz || '', url: /^https?:\/\//.test(x.url || '') ? x.url : '' }));
      (r.todo || []).forEach((x) => addTripItem(tr.id, 'todo', { text: x }));
      (r.packen || []).forEach((x) => addTripItem(tr.id, 'packen', { text: x }));
      toast(`${(r.ideen || []).length} Ideen, ${(r.todo || []).length} To-dos, ${(r.packen || []).length} Packpunkte ergänzt`);
      setWish('');
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
          <Back href="#/reisen" label="Reisen" />
          <h1 className="h1 sm">{tr.name}</h1>
        </div>
        <section className="card countdown" style={{ gap: 10 }}>
          <div className="stat-row">
            <div><span className="tiny">{days !== null && days > 0 ? 'Noch' : 'Zeitraum'}</span><b>{days !== null && days > 0 ? `${days} Tage` : tr.from ? fmtShort(tr.from) : '–'}</b></div>
            <div><span className="tiny">Offen</span><b>{tr.todo.filter((x) => !x.done).length} To-dos</b></div>
            <div><span className="tiny">Budget</span><b style={{ color: tr.budget && spent > tr.budget ? 'var(--danger)' : undefined }}>{tr.budget ? `${Math.round((spent / tr.budget) * 100)} %` : '–'}</b></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="date" value={tr.from || ''} onChange={(e) => updateTrip(tr.id, { from: e.target.value })} aria-label="Von" />
            <input className="input" type="date" value={tr.to || ''} onChange={(e) => updateTrip(tr.id, { to: e.target.value })} aria-label="Bis" />
          </div>
        </section>

        <section className="card checkin" style={{ gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span> Mit KI planen
          </span>
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="z.B. „Strände ohne Massen, gute Laufstrecken“" aria-label="Wunsch" />
            <button type="submit" className="btn small" disabled={busy || !getAi().apiKey}>{busy ? '…' : 'Los'}</button>
          </form>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich recherchiere Tipps, To-dos und Packliste … (ca. 30 Sek.)</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && <span className="tiny">Ergänzt Ideen vor Ort, fehlende To-dos und die Packliste.</span>}
        </section>

        <Segmented full options={[...Object.keys(TRIP_SECTIONS).map((id) => ({ id, label: `${{ todo: 'To-dos', packen: 'Packen', ideen: 'Ideen' }[id]} ${tr[id].filter((x) => !x.done).length}` })), { id: 'budget', label: 'Budget' }]} value={section} onChange={setSection} label="Bereich" />
        {section !== 'budget' && (
          <SimpleList
            items={tr[section]}
            onAdd={(text) => addTripItem(tr.id, section, { text })}
            onToggle={(id) => toggleTripItem(tr.id, section, id)}
            onRemove={(id) => removeTripItem(tr.id, section, id)}
            meta={(x) => x.note}
            placeholder={section === 'todo' ? 'z.B. Mietwagen buchen' : section === 'packen' ? 'z.B. Laufschuhe' : 'z.B. Sonnenuntergang am Leuchtturm'}
          />
        )}
        {section === 'budget' && (
          <>
            <section className="card" style={{ gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{fmtMoney(spent, tr.currency)}</span>
              <span className="sub">{tr.budget ? `von ${fmtMoney(tr.budget, tr.currency)} · ${spent > tr.budget ? `${fmtMoney(spent - tr.budget, tr.currency)} drüber` : `${fmtMoney(tr.budget - spent, tr.currency)} übrig`}` : 'Kein Budget festgelegt'}</span>
              {tr.budget > 0 && <div className="progress"><div style={{ width: `${Math.min(100, (spent / tr.budget) * 100)}%`, background: spent > tr.budget ? 'var(--danger)' : COLOR }} /></div>}
              <label className="field" style={{ margin: 0 }}><span>Budget ({tr.currency})</span><input className="input" inputMode="numeric" defaultValue={tr.budget || ''} key={tr.id + 'b'} onBlur={(e) => updateTrip(tr.id, { budget: Number(e.target.value) || 0 })} /></label>
            </section>
            <SimpleList
              items={tr.expenses.map((x) => ({ ...x, done: false }))}
              onAdd={(text, amount) => addExpense(tr.id, { text, amount: String(amount).replace(',', '.') })}
              onToggle={() => {}}
              onRemove={(id) => removeExpense(tr.id, id)}
              meta={(x) => `${fmtMoney(x.amount, tr.currency)} · ${fmtShort(x.date)}`}
              placeholder="Wofür? z.B. Flug"
              extraInput="Betrag"
            />
          </>
        )}
        <section className="card" style={{ gap: 6 }}>
          <span className="label" style={{ padding: 0 }}>Notizen</span>
          <textarea className="input" defaultValue={tr.notes} key={tr.id + 'n'} placeholder="Unterkunft, Flugnummern, Kontakte …" onBlur={(e) => e.target.value !== tr.notes && updateTrip(tr.id, { notes: e.target.value })} />
        </section>
        <button type="button" className="btn danger" onClick={() => { if (confirm(`Reise „${tr.name}“ löschen?`)) { removeTrip(tr.id); go('/reisen'); } }}>Reise löschen</button>
      </main>
      <TabBar active="bereiche" />
    </>
  );
}

export default function Reisen({ id }) {
  const s = useStore();
  if (!id) return <TripList s={s} />;
  const tr = s.trips.find((x) => x.id === id);
  return tr ? <TripDetail s={s} tr={tr} /> : <Missing />;
}
