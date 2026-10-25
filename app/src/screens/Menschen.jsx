import { useState } from 'react';
import { useStore } from '../lib/store';
import { daysUntilBirthday, diffDays, dueText, relDays, targetText, today } from '../lib/dates';
import { followUps, initials, lastContact, peopleOverdue, upcomingBirthdays, waLink } from '../lib/logic';
import { logContact } from '../lib/actions';
import { Check, Icon, TabBar } from '../components/ui';
import { PEOPLE_CATEGORIES } from '../lib/seed';

export const AVATAR = {
  familie: ['#F7EAE3', '#8E3F17'],
  freunde: ['#FBEEE6', '#9A4417'],
  neu: ['#EFEDFB', '#4A3FB0'],
  beruflich: ['#E6F3EE', '#0E6B4F'],
};
const FILTERS = [{ id: 'alle', label: 'Alle' }, ...PEOPLE_CATEGORIES];

export default function Menschen() {
  const s = useStore();
  const t = today();
  const [filter, setFilter] = useState('alle');
  const [q, setQ] = useState('');
  const match = (p) =>
    (filter === 'alle' || p.category === filter) &&
    (!q.trim() || [p.name, p.metAt, p.notes].join(' ').toLowerCase().includes(q.trim().toLowerCase()));

  const overdue = peopleOverdue(s, t).filter((x) => match(x.person));
  const bdays = upcomingBirthdays(s, t, 14).filter((x) => match(x.person));
  const fups = followUps(s, t).filter(match);
  const all = s.people.filter(match).sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const Row = ({ p, meta, urgent, check }) => {
    const [bg, fg] = AVATAR[p.category] || AVATAR.freunde;
    const wa = waLink(p);
    return (
      <div className="row" style={{ minHeight: 64 }}>
        {check ? (
          <Check on={(p.contacts || []).includes(t)} onClick={() => logContact(p.id)} label={`Kontakt mit ${p.name} heute notieren`} />
        ) : (
          <span className="avatar" style={{ background: bg, color: fg }}>{initials(p.name)}</span>
        )}
        <a href={`#/person/${p.id}`} className="row-main">
          <span className="row-title">{p.name}</span>
          <span className="row-meta" style={{ color: urgent ? 'var(--danger)' : undefined }}>{meta}</span>
        </a>
        {wa ? <a className="pill" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp-Chat mit ${p.name} öffnen`}>WhatsApp</a> : <a href={`#/person/${p.id}`} aria-label={`${p.name} öffnen`}><Icon name="chev" size={16} color="var(--chev)" /></a>}
      </div>
    );
  };

  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Menschen</h1>
          <a href="#/person/neu" className="icon-btn" aria-label="Person hinzufügen"><Icon name="plus" size={18} width={2.2} /></a>
        </div>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, wo kennengelernt …" aria-label="Personen suchen" />
        <div className="chips" style={{ gap: 8 }} role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? 'chip on' : 'chip'} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>

        {s.people.length === 0 && (
          <div className="notice">Noch niemand eingetragen. Lege wichtige Personen mit Geburtstag, Telefonnummer und Wunsch-Rhythmus an, z.B. „alle 4 Wochen melden“. Die App erinnert dich dann unter „Heute“.</div>
        )}

        {overdue.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sec-h"><h2 className="h2">Überfällig</h2><span className="sub">{overdue.length}</span></div>
            <div className="list">
              {overdue.map(({ person, since }) => (
                <Row key={person.id} p={person} check urgent meta={`${since === null ? 'Noch kein Kontakt notiert' : `Seit ${since} Tagen kein Kontakt`} · Ziel ${targetText(person.contactEvery)}`} />
              ))}
            </div>
          </section>
        )}

        {bdays.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sec-h"><h2 className="h2">Bald Geburtstag</h2><span className="sub">{bdays.length}</span></div>
            <div className="list">
              {bdays.map(({ person, inDays }) => (
                <Row key={person.id} p={person} urgent={inDays === 0} meta={inDays === 0 ? 'Heute' : inDays === 1 ? 'Morgen' : `In ${inDays} Tagen`} />
              ))}
            </div>
          </section>
        )}

        {fups.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sec-h"><h2 className="h2">Nachfassen</h2><span className="sub">{fups.length}</span></div>
            <div className="list">
              {fups.map((p) => (
                <Row key={p.id} p={p} check meta={`${p.metAt ? `Kennengelernt: ${p.metAt} · ` : ''}${dueText(p.followUp, t)}`} />
              ))}
            </div>
          </section>
        )}

        {all.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sec-h"><h2 className="h2">Alle</h2><span className="sub">{all.length}</span></div>
            <div className="list">
              {all.map((p) => {
                const last = lastContact(p);
                const bd = daysUntilBirthday(p.birthday, t);
                const meta = [
                  PEOPLE_CATEGORIES.find((c) => c.id === p.category)?.label,
                  last ? `Kontakt ${relDays(diffDays(last, t))}` : null,
                  bd !== null && bd <= 30 ? `Geburtstag in ${bd} Tagen` : null,
                ].filter(Boolean).join(' · ');
                return <Row key={p.id} p={p} meta={meta} />;
              })}
            </div>
          </section>
        )}
      </main>
      <TabBar active="menschen" />
    </>
  );
}
