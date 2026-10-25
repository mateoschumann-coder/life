import { useState } from 'react';
import { useStore } from '../lib/store';
import { fmtShort, today } from '../lib/dates';
import { waLink } from '../lib/logic';
import { deletePerson, logContact, savePerson } from '../lib/actions';
import { Back, Field, TabBar, toast } from '../components/ui';
import { PEOPLE_CATEGORIES } from '../lib/seed';
import { go } from '../lib/router';

const RHYTHMS = [
  { v: '', label: 'Kein Rhythmus' },
  { v: 7, label: 'Wöchentlich' },
  { v: 14, label: 'Alle 2 Wochen' },
  { v: 30, label: 'Monatlich' },
  { v: 60, label: 'Alle 2 Monate' },
  { v: 90, label: 'Quartalsweise' },
];

export default function Person({ id, metAt }) {
  const s = useStore();
  const existing = s.people.find((p) => p.id === id);
  const [form, setForm] = useState(() =>
    existing
      ? { ...existing }
      : { name: '', category: metAt ? 'neu' : 'freunde', phone: '', birthday: '', contactEvery: metAt ? null : 30, metAt: metAt || '', followUp: '', notes: '' }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? e.target.value : e }));

  const save = () => {
    const data = { ...form, contactEvery: form.contactEvery ? Number(form.contactEvery) : null, followUp: form.followUp || null };
    savePerson(existing ? { ...data, id } : data);
    toast('Gespeichert');
    go('/menschen');
  };
  const current = existing || form;
  const wa = waLink(form);
  const contacts = [...(current.contacts || [])].sort().reverse().slice(0, 6);

  return (
    <>
      <main className="screen">
        <Back href="#/menschen" label="Menschen" />
        <h1 className="h1">{existing ? existing.name : 'Neue Person'}</h1>

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
            <select className="input" value={form.contactEvery || ''} onChange={set('contactEvery')}>
              {RHYTHMS.map((r) => <option key={r.label} value={r.v}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Kennengelernt bei (optional)">
            <input className="input" value={form.metAt || ''} onChange={set('metAt')} placeholder="z.B. Startup-Meetup Palermo" />
          </Field>
          <Field label="Nachfassen am (optional)">
            <input className="input" type="date" value={form.followUp || ''} onChange={set('followUp')} />
          </Field>
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
