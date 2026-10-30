import { askDel } from '../lib/undo';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { fmtShort, parseKey } from '../lib/dates';
import {
  addEvent, addRadarItem, addTask, addTopic, advanceEvent, decideRadarItem, deleteEvent, deleteRadarItem, removeTopic, STAGE_LABEL,
} from '../lib/actions';
import { Field, Icon, Segmented, Sheet, TabBar, toast, Info } from '../components/ui';

const STAGE_STYLE = {
  entdeckt: ['var(--soft)', 'var(--fill)'],
  interessiert: ['#8A5A00', '#FBF1DC'],
  zugesagt: ['#0E6B4F', '#EAF5F0'],
  besucht: ['#4A3FB0', '#EFEDFB'],
};
const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

export default function Radar() {
  const s = useStore();
  const [tab, setTab] = useState('themen');
  const [sheet, setSheet] = useState(null);
  const [topicText, setTopicText] = useState('');
  const [item, setItem] = useState({ title: '', url: '', why: '', topic: '' });
  const [ev, setEv] = useState({ name: '', date: '', place: '', travel: false });

  const open = s.radar.items.filter((i) => i.status === 'neu');
  const kept = s.radar.items.filter((i) => i.status === 'behalten');
  const nearby = s.events.filter((e) => !e.travel).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const travel = s.events.filter((e) => e.travel).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);

  const EventRow = ({ e }) => {
    const [fg, bg] = STAGE_STYLE[e.stage];
    return (
      <div className="row" style={{ minHeight: 68 }}>
        <div style={{ width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          {e.date ? (
            <>
              <span className="tiny">{wd.format(parseKey(e.date))}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{parseKey(e.date).getDate()}</span>
            </>
          ) : <span className="tiny">offen</span>}
        </div>
        <div className="row-main">
          <span className="row-title">{e.name}</span>
          <span className="row-meta">{[e.place, e.date ? fmtShort(e.date) : null].filter(Boolean).join(' · ')}</span>
          {e.stage === 'besucht' && <a href={`#/person/neu/${encodeURIComponent(e.name)}`} className="tiny" style={{ color: '#4A3FB0', fontWeight: 500, padding: '4px 0' }}>+ Kontakt von hier anlegen</a>}
        </div>
        <button type="button" onClick={() => advanceEvent(e.id)} disabled={e.stage === 'besucht'} style={{ fontSize: 11, fontWeight: 500, color: fg, background: bg, padding: '6px 9px', borderRadius: 999, border: 0, flexShrink: 0 }} aria-label={`Status ${STAGE_LABEL[e.stage]}, weiter`}>
          {STAGE_LABEL[e.stage]}{e.stage !== 'besucht' ? ' →' : ''}
        </button>
        <button type="button" className="x-btn" aria-label={`${e.name} löschen`} onClick={() => askDel('Event löschen?') && deleteEvent(e.id)}>
          <Icon name="x" size={14} color="var(--chev)" />
        </button>
      </div>
    );
  };

  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Radar</h1>
          <button type="button" className="icon-btn" aria-label={tab === 'themen' ? 'Fund hinzufügen' : 'Event hinzufügen'} onClick={() => setSheet(tab)}>
            <Icon name="plus" size={18} width={2.2} />
          </button>
        </div>
        <Segmented full options={[{ id: 'themen', label: 'Themen' }, { id: 'events', label: 'Events' }]} value={tab} onChange={setTab} label="Ansicht" />

        {tab === 'themen' ? (
          <>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="label">Meine Themen</h2>
              <div className="chips" style={{ gap: 8 }}>
                {s.radar.topics.map((x) => (
                  <span key={x} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingRight: 4 }}>
                    {x}
                    <button type="button" className="x-btn" style={{ width: 26, height: 26 }} aria-label={`Thema ${x} entfernen`} onClick={() => removeTopic(x)}>
                      <Icon name="x" size={12} color="var(--muted)" />
                    </button>
                  </span>
                ))}
              </div>
              <form className="inline-add" style={{ padding: 0 }} onSubmit={(e) => { e.preventDefault(); addTopic(topicText); setTopicText(''); }}>
                <input className="input" value={topicText} onChange={(e) => setTopicText(e.target.value)} placeholder="Neues Thema" aria-label="Neues Thema" />
                <button type="submit" className="btn small sec" disabled={!topicText.trim()}>+</button>
              </form>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="sec-h"><h2 className="h2">Neu</h2><span className="sub">{open.length} offen</span></div>
              {open.length === 0 && <div className="notice">Hier landen Artikel und Themen, die du dir merken willst – per + oder über „Erfassen“. Die automatische Wochenrecherche kommt mit dem KI-Assistenten.</div>}
              {open.map((i) => (
                <article key={i.id} className="card" style={{ gap: 8 }}>
                  {i.topic && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '3px 8px', borderRadius: 999, alignSelf: 'flex-start' }}>{i.topic}</span>}
                  {i.url ? <a href={i.url} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{i.title}</a> : <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{i.title}</span>}
                  {i.why && <span style={{ fontSize: 13, color: 'var(--soft)', lineHeight: 1.45 }}>Warum für mich: {i.why}</span>}
                  <div className="btn-row">
                    <button type="button" className="btn small" onClick={() => { decideRadarItem(i.id, 'behalten'); toast('Behalten'); }}>Behalten</button>
                    <button type="button" className="btn small sec" onClick={() => { decideRadarItem(i.id, 'lernthema'); addTask({ title: i.title, areaId: 'entwicklung', idea: true }); toast('Als Lernthema unter Weiterentwicklung'); }}>Lernthema</button>
                    <button type="button" className="btn small sec" style={{ flex: '0 0 44px' }} aria-label="Verwerfen" onClick={() => decideRadarItem(i.id, 'verworfen')}>
                      <Icon name="x" size={14} color="var(--muted)" />
                    </button>
                  </div>
                </article>
              ))}
            </section>

            {kept.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 className="h2">Behalten</h2>
                <div className="list">
                  {kept.map((i) => (
                    <div key={i.id} className="row">
                      <div className="row-main">
                        {i.url ? <a className="row-title plain" href={i.url} target="_blank" rel="noreferrer">{i.title}</a> : <span className="row-title plain">{i.title}</span>}
                        {i.topic && <span className="row-meta">{i.topic}</span>}
                      </div>
                      <button type="button" className="x-btn" aria-label="Entfernen" onClick={() => deleteRadarItem(i.id)}><Icon name="x" size={14} color="var(--chev)" /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="h2">In deiner Nähe</h2>
              <div className="list">
                {nearby.length === 0 && <div className="empty">Noch keine Events. Tippe auf + oder trage Events ein, die du auf Instagram oder in Gruppen siehst.</div>}
                {nearby.map((e) => <EventRow key={e.id} e={e} />)}
              </div>
            </section>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="h2">Auf Reisen</h2>
              <div className="list">
                {travel.length === 0 && <div className="empty">Konferenzen oder Events in anderen Städten.</div>}
                {travel.map((e) => <EventRow key={e.id} e={e} />)}
              </div>
            </section>
            <Info>Tippe auf den Status, um ein Event weiterzuschieben: Entdeckt → Interessiert → Zugesagt → Besucht.</Info>
          </>
        )}
      </main>

      <Sheet open={sheet === 'themen'} title="Fund hinzufügen" onClose={() => setSheet(null)}>
        <Field label="Titel"><input className="input" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} placeholder="z.B. Artikel über KI-Agenten" /></Field>
        <Field label="Link (optional)"><input className="input" type="url" inputMode="url" value={item.url} onChange={(e) => setItem({ ...item, url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Warum interessant? (optional)"><input className="input" value={item.why} onChange={(e) => setItem({ ...item, why: e.target.value })} /></Field>
        <Field label="Thema">
          <select className="input" value={item.topic} onChange={(e) => setItem({ ...item, topic: e.target.value })}>
            <option value="">– ohne –</option>
            {s.radar.topics.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <button type="button" className="btn" disabled={!item.title.trim()} onClick={() => { addRadarItem(item); setItem({ title: '', url: '', why: '', topic: '' }); setSheet(null); }}>Hinzufügen</button>
      </Sheet>

      <Sheet open={sheet === 'events'} title="Event hinzufügen" onClose={() => setSheet(null)}>
        <Field label="Name"><input className="input" value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} placeholder="z.B. Startup-Meetup" /></Field>
        <Field label="Datum (optional)"><input className="input" type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} /></Field>
        <Field label="Ort (optional)"><input className="input" value={ev.place} onChange={(e) => setEv({ ...ev, place: e.target.value })} placeholder="z.B. Palermo" /></Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
          <input type="checkbox" checked={ev.travel} onChange={(e) => setEv({ ...ev, travel: e.target.checked })} style={{ width: 20, height: 20 }} />
          In einer anderen Stadt (Reise)
        </label>
        <button type="button" className="btn" disabled={!ev.name.trim()} onClick={() => { addEvent(ev); setEv({ name: '', date: '', place: '', travel: false }); setSheet(null); }}>Hinzufügen</button>
      </Sheet>
      <TabBar active="radar" />
    </>
  );
}
