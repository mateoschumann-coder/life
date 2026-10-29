import { useState } from 'react';
import { useStore } from '../lib/store';
import { addDays as addDaysKey, fmtShort, today } from '../lib/dates';
import { waLink, WHEN_IN_MONTH } from '../lib/logic';
import { addPersonDate, addTask, deletePerson, deleteTask, logContact, removePersonDate, savePerson, toggleTask } from '../lib/actions';
import { DateRangeField } from '../components/DateRange';
import { Back, Check, Field, Icon, TabBar, toast } from '../components/ui';
import { PEOPLE_CATEGORIES } from '../lib/seed';
import { go } from '../lib/router';

const RHYTHMS = [
  { v: '', label: 'Kein Rhythmus' },
  { v: -1, label: 'Läuft von selbst (keine Erinnerung)' },
  { v: 7, label: 'Wöchentlich' },
  { v: 14, label: 'Alle 2 Wochen' },
  { v: 30, label: 'Monatlich' },
  { v: 60, label: 'Alle 2 Monate' },
  { v: 90, label: 'Quartalsweise' },
  { v: 180, label: 'Halbjährlich' },
];

export default function Person({ id, metAt }) {
  const s = useStore();
  const existing = s.people.find((p) => p.id === id);
  const [form, setForm] = useState(() =>
    existing
      ? { ...existing }
      : (() => {
        let cat = metAt ? 'neu' : 'freunde';
        try {
          cat = sessionStorage.getItem('life-new-person-cat') || cat;
          sessionStorage.removeItem('life-new-person-cat');
        } catch {}
        return { name: '', category: cat, phone: '', birthday: '', contactEvery: cat === 'neu' ? null : cat === 'familie' ? 14 : 30, metAt: metAt || '', followUp: '', notes: '' };
      })()
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? e.target.value : e }));

  const save = () => {
    const ce = Number(form.contactEvery) || 0;
    const data = { ...form, contactEvery: ce > 0 ? ce : null, natural: ce === -1, followUp: form.followUp || null };
    if (ce > 0 && !(existing && existing.contactEvery)) data.rhythmSince = today();
    savePerson(existing ? { ...data, id } : data);
    toast('Gespeichert');
    const area = s.areas.find((a) => a.peopleCategory === data.category);
    go(area && !existing ? `/bereich/${area.id}` : '/menschen');
  };
  const current = existing || form;
  const wa = waLink(form);
  const contacts = [...(current.contacts || [])].sort().reverse().slice(0, 6);

  return (
    <>
      <main className="screen">
        <Back href="#/menschen" label="Menschen" />
        <h1 className="h1">{existing ? existing.name : 'Neue Person'}</h1>

        {existing && <PersonPlans s={s} p={existing} />}

        {existing && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => { logContact(id); toast('Kontakt notiert'); }}>Kontakt heute notieren</button>
            {wa ? <a className="btn sec" href={wa} target="_blank" rel="noreferrer">WhatsApp</a> : <button type="button" className="btn sec" disabled>WhatsApp</button>}
          </div>
        )}

        <section className="card">
          <Field label="Name"><input className="input" value={form.name} onChange={set('name')} placeholder="Vorname Nachname" /></Field>
          <div className="field">
            <span>Gehört zu</span>
            <div className="chips">
              {PEOPLE_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={form.category === c.id ? 'chip on' : 'chip'} onClick={() => set('category')(c.id)}>{c.label}</button>
              ))}
            </div>
          </div>
          <Field label="Telefon für WhatsApp (mit Ländervorwahl, z.B. +54 9 11 …)">
            <input className="input" type="tel" inputMode="tel" value={form.phone || ''} onChange={set('phone')} placeholder="+54 9 11 1234 5678" />
          </Field>
          <Field label="Geburtstag">
            <input className="input" type="date" value={form.birthday || ''} onChange={set('birthday')} />
          </Field>
          <Field label="Wie oft willst du dich melden?">
            <select className="input" value={form.natural && !Number(form.contactEvery) ? -1 : form.contactEvery || ''} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, contactEvery: v, natural: v === '-1' })); }}>
              {RHYTHMS.map((r) => <option key={r.label} value={r.v}>{r.label}</option>)}
            </select>
          </Field>
          {Number(form.contactEvery) >= 28 && (
            <div className="field">
              <span>Ungefähr wann im Monat?</span>
              <div className="chips">{WHEN_IN_MONTH.map((w) => <button key={w.id} type="button" className={(form.when || '') === w.id ? 'chip on' : 'chip soft'} onClick={() => setForm((f) => ({ ...f, when: w.id }))}>{w.id ? w.label : 'Egal'}</button>)}</div>
            </div>
          )}
          {form.category === 'neu' && (
            <Field label="Kennengelernt bei (optional)">
              <input className="input" value={form.metAt || ''} onChange={set('metAt')} placeholder="z.B. Startup-Meetup Palermo" />
            </Field>
          )}
          <Field label="Notizen">
            <textarea className="input" value={form.notes || ''} onChange={set('notes')} placeholder="Interessen, Geschenkideen, worüber ihr gesprochen habt …" />
          </Field>
          <button type="button" className="btn" onClick={save} disabled={!form.name.trim()}>Speichern</button>
        </section>

        {existing && (
          <>
            <section className="card">
              <h2 className="label">Letzte Kontakte</h2>
              {contacts.length === 0 ? <span className="sub">Noch keiner notiert.</span> : <span className="sub">{contacts.map((d) => (d === today() ? 'heute' : fmtShort(d))).join(' · ')}</span>}
            </section>
            <button type="button" className="btn danger" onClick={() => { if (confirm(`${existing.name} löschen?`)) { deletePerson(id); go('/menschen'); } }}>Person löschen</button>
          </>
        )}
      </main>
      <TabBar active="menschen" />
    </>
  );
}

// v1.27 (Mateo): „Mit … vorhaben“ (Aufgaben zu dieser Person, erscheinen auch auf Heute) und „Termine & Infos“ (z.B. reist nach Italien)
function PersonPlans({ s, p }) {
  const t = today();
  const [txt, setTxt] = useState('');
  const [due, setDue] = useState('');
  const [dTxt, setDTxt] = useState('');
  const [dr, setDr] = useState({ from: '', to: '' });
  const [showPast, setShowPast] = useState(false);
  const first = p.name.split(' ')[0];
  const tasks = s.tasks.filter((x) => x.personId === p.id && !x.done).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const dates = [...(p.dates || [])].sort((a, b) => ((a.date || '9') < (b.date || '9') ? -1 : 1));
  const past = dates.filter((d) => (d.to || d.date) && (d.to || d.date) < t);
  const coming = dates.filter((d) => !past.includes(d));
  const range = (d) => (d.date ? (d.to ? `${fmtShort(d.date)} – ${fmtShort(d.to)}` : fmtShort(d.date)) : 'ohne Datum');
  return (
    <>
      <section className="card" style={{ gap: 10 }}>
        <h2 className="label" style={{ padding: 0 }}>📌 Mit {first} vorhaben</h2>
        <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (txt.trim()) { addTask({ title: txt, personId: p.id, due: due || null }); setTxt(''); setDue(''); toast(due ? 'Eingetragen – auch auf Heute' : 'Eingetragen'); } }}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={`z.B. ${first} wegen Asado anrufen`} aria-label="Vorhaben" />
          <button type="submit" className="btn small" disabled={!txt.trim()} aria-label="Hinzufügen">+</button>
        </form>
        {txt.trim() && (
          <div className="chips" style={{ marginTop: -4 }}>
            {[['', 'Ohne Datum'], [t, 'Heute'], [addDaysKey(t, 1), 'Morgen'], [addDaysKey(t, 7), 'In 1 Woche']].map(([v, l]) => <button key={l} type="button" className={due === v ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setDue(v)}>{l}</button>)}
          </div>
        )}
        {tasks.length === 0 && <span className="tiny">Noch nichts. Auch per Assistent: „Ich will mit {first} über die Reise sprechen.“</span>}
        {tasks.length > 0 && (
          <div className="list">
            {tasks.map((x) => (
              <div key={x.id} className="row compact">
                <Check on={false} color="#E8775A" onClick={() => { toggleTask(x.id); toast('Erledigt'); }} label={`Erledigt: ${x.title}`} />
                <span className="row-main"><span className="row-title plain">{x.title}</span>{x.due && <span className="row-meta" style={{ color: x.due < t ? 'var(--danger)' : undefined }}>{x.due === t ? 'heute' : fmtShort(x.due)}</span>}</span>
                <button type="button" className="x-btn" onClick={() => deleteTask(x.id)} aria-label={`${x.title} löschen`}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card" style={{ gap: 10 }}>
        <h2 className="label" style={{ padding: 0 }}>📅 Termine & Infos</h2>
        <input className="input" value={dTxt} onChange={(e) => setDTxt(e.target.value)} placeholder={`z.B. ${first} reist nach Italien, Prüfung, Umzug …`} aria-label="Termin oder Info" />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><DateRangeField from={dr.from} to={dr.to} onChange={(v) => setDr({ from: v.from || '', to: v.to || '' })} placeholder="Datum oder Zeitraum (optional)" title="Wann?" /></div>
          <button type="button" className="btn small" disabled={!dTxt.trim()} onClick={() => { addPersonDate(p.id, { text: dTxt, date: dr.from, to: dr.to }); setDTxt(''); setDr({ from: '', to: '' }); toast('Vermerkt'); }}>Speichern</button>
        </div>
        {coming.length === 0 && <span className="tiny">Noch nichts vermerkt – geht auch per Assistent: „{first} ist vom 10. bis 24.11. in Italien.“</span>}
        {coming.length > 0 && (
          <div className="list">
            {coming.map((d) => (
              <div key={d.id} className="row compact">
                <span className="row-main"><span className="row-title plain">{d.text}</span><span className="row-meta">{range(d)}{d.date && d.date <= t && (!d.to || d.to >= t) ? ' · gerade' : ''}</span></span>
                <button type="button" className="x-btn" onClick={() => removePersonDate(p.id, d.id)} aria-label={`${d.text} löschen`}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
          </div>
        )}
        {past.length > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => setShowPast(!showPast)}>{showPast ? 'Vergangene ausblenden' : `Vergangen (${past.length})`}</button>}
        {showPast && <div className="list">{past.reverse().map((d) => <div key={d.id} className="row compact"><span className="row-main"><span className="row-title plain" style={{ color: 'var(--muted)' }}>{d.text}</span><span className="row-meta">{range(d)}</span></span><button type="button" className="x-btn" onClick={() => removePersonDate(p.id, d.id)} aria-label="Löschen"><Icon name="x" size={12} color="var(--chev)" /></button></div>)}</div>}
      </section>
    </>
  );
}
