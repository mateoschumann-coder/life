// Sozial-Bereiche (Familie, Freunde, Neue Kontakte): nur die Menschen – Geburtstage, Melde-Erinnerung, Notizen
import { daysUntilBirthday, fmtShort, relDays, diffDays, targetText, today } from '../lib/dates';
import { initials, lastContact, peopleOverdue, upcomingBirthdays, waLink } from '../lib/logic';
import { logContact } from '../lib/actions';
import { go } from '../lib/router';
import { AVATAR } from '../screens/Menschen';
import { Check, Chevron, Icon, toast } from './ui';

export function newPerson(category) {
  try {
    sessionStorage.setItem('life-new-person-cat', category);
  } catch {}
  go('/person/neu');
}

export default function PeopleArea({ s, area }) {
  const t = today();
  const cat = area.peopleCategory;
  const people = s.people.filter((p) => p.category === cat).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const overdue = peopleOverdue(s, t).filter((x) => x.person.category === cat && x.ratio >= 1);
  const bdays = upcomingBirthdays(s, t, 30).filter((x) => x.person.category === cat);
  const [bg, fg] = AVATAR[cat] || AVATAR.freunde;

  const Wa = ({ p }) => {
    const wa = waLink(p);
    return wa ? <a className="pill" href={wa} target="_blank" rel="noreferrer" onClick={() => logContact(p.id)} aria-label={`WhatsApp mit ${p.name}`}>WhatsApp</a> : null;
  };

  return (
    <>
      <section className="card" style={{ gap: 8 }}>
        <div className="stat-row">
          <div><span className="tiny">Personen</span><b>{people.length}</b></div>
          <div><span className="tiny">Melden fällig</span><b style={{ color: overdue.length ? 'var(--danger)' : undefined }}>{overdue.length}</b></div>
          <div><span className="tiny">Geburtstage</span><b>{bdays.length ? `${bdays.length} bald` : '–'}</b></div>
        </div>
        <button type="button" className="btn small" onClick={() => newPerson(cat)}>+ Person hinzufügen</button>
      </section>

      {overdue.length > 0 && (
        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Melde dich mal</h2></div>
          <div className="list">
            {overdue.map(({ person: p, since }) => (
              <div key={p.id} className="row" style={{ minHeight: 60 }}>
                <Check on={false} onClick={() => { logContact(p.id); toast(`Kontakt mit ${p.name} notiert`); }} label={`Kontakt mit ${p.name} heute notieren`} />
                <a href={`#/person/${p.id}`} className="row-main">
                  <span className="row-title plain">{p.name}</span>
                  <span className="row-meta" style={{ color: 'var(--danger)' }}>{since === null ? 'Noch kein Kontakt notiert' : `seit ${since} Tagen`} · Ziel {targetText(p.contactEvery)}</span>
                </a>
                <Wa p={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {bdays.length > 0 && (
        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Geburtstage</h2></div>
          <div className="list">
            {bdays.map(({ person: p, inDays }) => (
              <div key={p.id} className="row" style={{ minHeight: 56 }}>
                <span className="block-icon" style={{ background: 'color-mix(in srgb, #E8775A 14%, transparent)', color: '#E8775A' }}><Icon name="sparkle" size={15} /></span>
                <a href={`#/person/${p.id}`} className="row-main">
                  <span className="row-title plain">{p.name}</span>
                  <span className="row-meta">{inDays === 0 ? 'Heute!' : inDays === 1 ? 'Morgen' : `in ${inDays} Tagen`}{p.notes ? ` · ${p.notes.slice(0, 50)}` : ''}</span>
                </a>
                <Wa p={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="group">
        <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Alle</h2></div>
        <div className="list">
          {people.length === 0 && <div className="empty">Noch niemand in „{area.name}“. Leg Personen mit Geburtstag und „alle X Tage melden“ an – die App erinnert dich auf „Heute“.</div>}
          {people.map((p) => {
            const last = lastContact(p);
            const bd = p.birthday ? daysUntilBirthday(p.birthday, t) : null;
            return (
              <a key={p.id} href={`#/person/${p.id}`} className="row" style={{ minHeight: 60 }}>
                <span className="avatar" style={{ background: bg, color: fg }}>{initials(p.name)}</span>
                <span className="row-main">
                  <span className="row-title plain">{p.name}</span>
                  <span className="row-meta">{[
                    p.contactEvery ? `melden ${targetText(p.contactEvery)}` : null,
                    last ? `zuletzt ${relDays(diffDays(last, t))}` : null,
                    p.birthday ? `🎂 ${fmtShort(p.birthday)}${bd === 0 ? ' (heute!)' : bd !== null && bd <= 30 ? ` (in ${bd} Tagen)` : ''}` : null,
                    cat === 'neu' && p.metAt ? p.metAt : null,
                  ].filter(Boolean).join(' · ') || 'Tippen zum Ergänzen'}</span>
                </span>
                <Chevron />
              </a>
            );
          })}
        </div>
      </section>

      {cat === 'neu' && (
        <a href="#/ausgehen" className="card design-cta">
          <span className="spark"><Icon name="pin" size={16} color="currentColor" /></span>
          <span className="row-main"><span className="row-title strong">Neue Leute kennenlernen</span><span className="row-meta">Meetups, Events und Geheimtipps unter „Ausgehen“</span></span>
          <Chevron />
        </a>
      )}
    </>
  );
}
