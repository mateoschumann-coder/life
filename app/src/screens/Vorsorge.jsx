import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import { addHealthItem, deleteHealthItem, doneHealthItem, updateHealthItem, healthChat, healthPresetsOf, setHealthPresets } from '../lib/health';
import { getAi } from '../lib/ai';
import PlanChat from '../components/PlanChat';
import { chatOf, saveChatOf } from '../lib/chats';
import { Back, Field, Icon, Info, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { DateRangeField } from '../components/DateRange';
import PlaceBook, { ItemSheet as PlaceSheet } from '../components/PlaceBook';
import { addBookItem, bookAreas, bookCats, bookMaps, bookOf, doctorLinks, findBookItem, searchDoctors } from '../lib/placebook';
import { hoodHere } from '../lib/outings';

const TYPES = [
  { id: 'termin', label: 'Termin', hint: 'Einmalig, z.B. Arzttermin am 12. Nov.' },
  { id: 'routine', label: 'Regelmäßig', hint: 'Wiederkehrend, z.B. Zahnarzt alle 6 Monate' },
  { id: 'verletzung', label: 'Verletzung', hint: 'Beschwerden festhalten – der Coach berücksichtigt sie' },
];
function when(h, t) {
  if (!h.date) return h.type === 'routine' ? 'Erstes Datum festlegen' : 'Ohne Datum';
  const d = diffDays(t, h.date);
  if (d < 0) return `überfällig seit ${-d} ${-d === 1 ? 'Tag' : 'Tagen'}`;
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  return `in ${d} Tagen · ${fmtShort(h.date)}`;
}

// v0.93 (Mateo): Ort für den Termin aus den gespeicherten Ärzten/Orten wählen – oder gleich neu anlegen
function PlacePicker({ s, open, value, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [newOne, setNewOne] = useState(null);
  const cats = bookCats(s, 'vorsorge');
  const items = bookOf(s, 'vorsorge').items.filter((p) => !q.trim() || `${p.name} ${p.sub} ${p.address || ''} ${p.area || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...cats.map((c) => ({ c, list: items.filter((p) => p.cat === c.id) })), { c: { id: '_', label: 'Sonstiges', emoji: '📍' }, list: items.filter((p) => !cats.some((c) => c.id === p.cat)) }].filter((g) => g.list.length);
  return (
    <>
      <Sheet open={open && !newOne} title="Wo ist der Termin?" onClose={onClose}>
        {bookOf(s, 'vorsorge').items.length > 4 && <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z.B. Zahnarzt" aria-label="Ort suchen" />}
        <button type="button" className="btn tint small" onClick={() => setNewOne({ cat: cats[0]?.id, name: q.trim() })}>+ Neuen Arzt / Ort anlegen</button>
        {groups.length === 0 && <span className="sub">{q ? 'Nichts gefunden.' : 'Noch keine Orte gespeichert – oben neu anlegen.'}</span>}
        {groups.map(({ c, list }) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label" style={{ padding: '0 4px' }}>{c.emoji} {c.label}</span>
            <div className="list">
              {list.map((p) => (
                <button key={p.id} type="button" className="row compact" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: value === p.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none' }} onClick={() => onPick(p.id)}>
                  <span className="row-main"><span className="row-title plain">{p.name}</span><span className="row-meta">{[p.sub, p.address || p.area].filter(Boolean).join(' · ')}</span></span>
                  {value === p.id && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        {value && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onPick('')}>Keinen Ort</button>}
      </Sheet>
      <PlaceSheet s={s} book="vorsorge" cats={cats} item={newOne} onClose={() => setNewOne(null)} onSaved={(id) => { if (id) onPick(id); }} />
    </>
  );
}

function ItemSheet({ s, open, onClose, item }) {
  const blank = { title: '', type: 'termin', date: '', everyMonths: '', notes: '', placeId: '' };
  const [f, setF] = useState(blank);
  const [loaded, setLoaded] = useState(null);
  const [pick, setPick] = useState(false);
  if (open && (item?.id || 'neu') !== loaded) {
    setLoaded(item?.id || 'neu');
    setF(item?.id ? { ...blank, ...item, date: item.date || '', everyMonths: item.everyMonths || '' } : { ...blank, ...(item || {}) });
  }
  const save = () => {
    const data = { title: f.title, type: f.type, date: f.date || null, everyMonths: f.type === 'routine' ? Number(f.everyMonths) || 6 : null, notes: f.notes, placeId: f.placeId || '' };
    if (item?.id) updateHealthItem(item.id, data);
    else addHealthItem(data);
    toast('Gespeichert');
    setLoaded(null);
    onClose();
  };
  const close = () => {
    setLoaded(null);
    onClose();
  };
  return (
    <Sheet open={open} title={item?.id ? 'Bearbeiten' : 'Neu'} onClose={close}>
      <Segmented full options={TYPES.map((x) => ({ id: x.id, label: x.label }))} value={f.type} onChange={(v) => setF({ ...f, type: v })} label="Art" />
      <span className="tiny">{TYPES.find((x) => x.id === f.type)?.hint}</span>
      <Field label={f.type === 'verletzung' ? 'Was ist es?' : 'Titel'}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.type === 'verletzung' ? 'z.B. Knie rechts zwickt beim Laufen' : 'z.B. Zahnarzt Dr. López'} /></Field>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 2, minWidth: 0 }}><span>{f.type === 'verletzung' ? 'Seit' : f.type === 'routine' ? 'Nächstes Mal' : 'Datum'}</span><DateRangeField single from={f.date} to="" onChange={(v) => setF({ ...f, date: v.from || '' })} placeholder="Datum wählen" title="Datum" /></div>
        {f.type === 'routine' && <div className="field" style={{ flex: 1, minWidth: 0 }}><span>Alle … Monate</span><input className="input" inputMode="numeric" value={f.everyMonths} onChange={(e) => setF({ ...f, everyMonths: e.target.value.replace(/\D/g, '') })} placeholder="6" aria-label="Alle wie viele Monate" /></div>}
      </div>
      {f.type !== 'verletzung' && (
        <div className="field">
          <span>Wo?</span>
          {(() => {
            const p = findBookItem(s, 'vorsorge', f.placeId);
            const c = p && bookCats(s, 'vorsorge').find((x) => x.id === p.cat);
            return (
              <button type="button" className="city-bar" onClick={() => setPick(true)} aria-label="Ort wählen">
                <span style={{ fontSize: 18 }}>{c?.emoji || '📍'}</span>
                <span className="row-main"><span className="row-title strong">{p ? p.name : 'Arzt / Ort wählen'}</span>{p && <span className="row-meta">{[p.sub || c?.label, p.address || p.area].filter(Boolean).join(' · ')}</span>}</span>
                <span className="pill" style={{ fontSize: 13 }}>{p ? 'Ändern' : 'Wählen'} ▾</span>
              </button>
            );
          })()}
        </div>
      )}
      <Field label="Notizen"><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={f.type === 'verletzung' ? 'Wann tut es weh? Was hilft? Was hat der Arzt gesagt?' : 'Adresse, Telefon, was mitnehmen …'} /></Field>
      <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
      {item?.id && <button type="button" className="btn danger" onClick={() => { if (confirm('Löschen?')) { deleteHealthItem(item.id); close(); } }}>Löschen</button>}
      <PlacePicker s={s} open={pick} value={f.placeId} onClose={() => setPick(false)} onPick={(id) => { setF({ ...f, placeId: id }); setPick(false); }} />
    </Sheet>
  );
}

// v1.01: Schnell hinzufügen – bearbeitbar; Antippen öffnet das Formular mit „Termin“ vorausgewählt
function Presets({ s, items, onPick }) {
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState('');
  const all = healthPresetsOf(s);
  const shown = edit ? all : all.filter((p) => !items.some((h) => h.title === p.title && h.status !== 'erledigt'));
  return (
    <section className="card" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="label" style={{ padding: 0, flex: 1 }}>Schnell hinzufügen</span>
        <button type="button" className={edit ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : '✎ Bearbeiten'}</button>
      </div>
      <div className="chips">
        {shown.map((p) => (edit
          ? <button key={p.title} type="button" className="chip soft" onClick={() => setHealthPresets(all.filter((x) => x.title !== p.title))}>{p.title} ✕</button>
          : <button key={p.title} type="button" className="chip soft" onClick={() => onPick({ title: p.title, type: 'termin', everyMonths: p.everyMonths || '' })}>+ {p.title}</button>))}
        {!shown.length && !edit && <span className="tiny">Alles schon eingetragen.</span>}
      </div>
      {edit && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = txt.trim(); if (t && !all.some((x) => x.title.toLowerCase() === t.toLowerCase())) setHealthPresets([...all, { title: t }]); setTxt(''); }}>
          <input className="input" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="z.B. Physio, Blutabnahme" aria-label="Schnell-Eintrag hinzufügen" />
          <button type="submit" className="btn small" disabled={!txt.trim()} aria-label="Hinzufügen">+</button>
        </form>
      )}
    </section>
  );
}

const HEALTH_GROUPS = [{
  key: 'termine',
  label: 'Termine',
  title: (x) => x.titel,
  meta: (x) => [x.art === 'routine' ? `alle ${x.alle_monate || 6} Monate` : x.art === 'verletzung' ? 'Beschwerde' : 'Termin', x.datum && fmtShort(x.datum), x.uhrzeit].filter(Boolean).join(' · '),
}];

// v1.01: Termin finden – kostenlose Links + KI-Suche, Treffer als Ort speichern oder gleich Termin anlegen
function FindTermin({ s, onTermin }) {
  const [what, setWhat] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [saved, setSaved] = useState({});
  const areas = bookAreas(s, 'vorsorge');
  const QUICK = ['Zahnarzt', 'Hausarzt', 'Hautarzt', 'Augenarzt', 'Physiotherapie', 'Sportmedizin', 'Blutabnahme'];
  const run = async () => {
    setBusy(true);
    try { setRes(await searchDoctors(s, { what, area })); } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel.' : e.message); } finally { setBusy(false); }
  };
  const save = (h, i) => {
    const cat = /zahn|haut|augen|haus|arzt|orthop|hno|kardio|médic|medic|doctor/i.test(what) ? 'arzt' : /physio|osteo|massage|kines/i.test(what) ? 'therapie' : /labor|blut|röntgen|mrt|ultra/i.test(what) ? 'labor' : 'arzt';
    const id = addBookItem('vorsorge', { name: h.name, cat, sub: '', address: h.adresse || '', area, phone: h.telefon || '', url: h.website || '', status: 'will' });
    setSaved({ ...saved, [i]: id });
    return id;
  };
  return (
    <>
      <section className="card" style={{ gap: 10 }}>
        <label className="field"><span>Was suchst du?</span><input className="input" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="z.B. Zahnarzt, Physiotherapie" /></label>
        <div className="chips" style={{ marginTop: -4 }}>{QUICK.map((q) => <button key={q} type="button" className={what === q ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setWhat(q)}>{q}</button>)}</div>
        <label className="field"><span>Wo ungefähr?</span><input className="input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Viertel, z.B. Palermo" /></label>
        <div className="chips" style={{ marginTop: -4 }}>
          <button type="button" className="chip soft small-chip" onClick={async () => { try { setArea(await hoodHere()); } catch (e) { toast(e.message); } }}>📍 Mein Standort</button>
          {areas.filter((a) => a !== area).slice(0, 6).map((a) => <button key={a} type="button" className="chip soft small-chip" onClick={() => setArea(a)}>{a}</button>)}
        </div>
        {what.trim() && (
          <>
            <span className="label" style={{ padding: 0 }}>Direkt nachsehen (kostenlos)</span>
            <div className="chips">{doctorLinks(what.trim(), area.trim(), s.profile?.city).map((l) => <a key={l.url} className="pill link-chip" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>)}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn small" disabled={busy || !getAi().apiKey} onClick={run}>{busy ? 'Ich suche …' : '✨ KI sucht passende Praxen'}</button>
              <Info>Eine Internet-Suche, ca. 1 Cent. Treffer kannst du als Ort speichern oder gleich einen Termin anlegen.</Info>
            </div>
          </>
        )}
      </section>
      {res && (
        <section className="card" style={{ gap: 8 }}>
          {!res.treffer?.length && <span className="sub">{res.hinweis || 'Nichts gefunden – probier die Links oben.'}</span>}
          {(res.treffer || []).map((h, i) => (
            <div key={i} className="option" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, cursor: 'default' }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{h.name}</span>
              <span className="tiny">{[h.adresse, h.telefon, h.info].filter(Boolean).join(' · ')}</span>
              <span className="chips">
                {saved[i] ? <span className="tiny" style={{ color: '#2FA36B', fontWeight: 600 }}>✓ bei Orten gespeichert</span> : <button type="button" className="chip soft small-chip" onClick={() => { save(h, i); toast('Bei Orten gespeichert'); }}>📌 Als Ort speichern</button>}
                <button type="button" className="chip small-chip" onClick={() => onTermin({ title: `${what.trim() || 'Termin'} – ${h.name}`, type: 'termin', placeId: saved[i] || save(h, i) })}>+ Termin anlegen</button>
                {h.website && <a className="chip soft small-chip" href={h.website} target="_blank" rel="noreferrer">Website ↗</a>}
                {h.telefon && <a className="chip soft small-chip" href={`tel:${String(h.telefon).replace(/[^\d+]/g, '')}`}>📞</a>}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

export default function Vorsorge() {
  const s = useStore();
  const t = today();
  const [sheet, setSheet] = useState(null);
  const [view, setViewState] = useState(() => { try { const v = sessionStorage.getItem('life-vorsorge-view'); return ['termine', 'finden', 'orte'].includes(v) ? v : 'termine'; } catch { return 'termine'; } });
  const setView = (v) => { setViewState(v); try { sessionStorage.setItem('life-vorsorge-view', v); } catch {} };
  const [listOpen, setListOpenState] = useState(() => { try { return localStorage.getItem('life-vorsorge-open') !== '0'; } catch { return true; } });
  const setListOpen = (v) => { setListOpenState(v); try { localStorage.setItem('life-vorsorge-open', v ? '1' : '0'); } catch {} };
  const items = s.healthItems;
  const upcoming = items.filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt').sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const injuries = items.filter((h) => h.type === 'verletzung');
  const done = items.filter((h) => h.type === 'termin' && h.status === 'erledigt').slice(-5).reverse();
  const nOrte = bookOf(s, 'vorsorge').items.length;

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/koerper" label="Körperliche Gesundheit" />
          <h1 className="h1">Vorsorge</h1>
        </div>
        <Segmented full options={[{ id: 'termine', label: 'Termine' }, { id: 'finden', label: 'Termin finden' }, { id: 'orte', label: `Orte${nOrte ? ` (${nOrte})` : ''}` }]} value={view} onChange={setView} label="Ansicht" />
        {view === 'orte' && <PlaceBook s={s} book="vorsorge" hint="Deine Ärzte, Therapeuten, Apotheke, Labor … – oben „+ Ort“. Beim Termin kannst du den Ort dann auswählen." />}
        {view === 'finden' && <FindTermin s={s} onTermin={(x) => setSheet(x)} />}
        {view === 'termine' && (<>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn small" onClick={() => setSheet({ type: 'termin' })}>+ Termin</button>
          <Info>Fällige Termine erscheinen automatisch auf „Heute“. Unten kannst du Termine auch einfach der KI erzählen.</Info>
        </div>

        <section className="group">
          <button type="button" className="sec-h" style={{ border: 0, background: 'none', width: '100%', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen}>
            <h2 className="h2" style={{ fontSize: 19 }}>Termine & Routinen{upcoming.length ? ` · ${upcoming.length}` : ''}</h2>
            <span className="tiny">{listOpen ? '▴ Zuklappen' : '▾ Aufklappen'}</span>
          </button>
          {listOpen && <div className="list">            {upcoming.length === 0 && <div className="empty">Noch nichts eingetragen.</div>}
            {upcoming.map((h) => {
              const overdue = h.date && h.date < t;
              return (
                <div key={h.id} className="row" style={{ minHeight: 60 }}>
                  <span className="block-icon" style={{ background: overdue ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--accent-bg)', color: overdue ? 'var(--danger)' : 'var(--accent)' }}><Icon name={h.type === 'routine' ? 'refresh' : 'calendar'} size={16} /></span>
                  <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setSheet(h)}>
                    <span className="row-title plain">{h.title}</span>
                    <span className="row-meta" style={{ color: overdue ? 'var(--danger)' : undefined }}>{when(h, t)}{h.type === 'routine' && h.everyMonths ? ` · alle ${h.everyMonths} Monate` : ''}{findBookItem(s, 'vorsorge', h.placeId) ? ` · 📍 ${findBookItem(s, 'vorsorge', h.placeId).name}` : ''}</span>
                  </button>
                  {findBookItem(s, 'vorsorge', h.placeId) && <a className="x-btn" href={bookMaps(findBookItem(s, 'vorsorge', h.placeId))} target="_blank" rel="noreferrer" aria-label="Ort in Google Maps"><Icon name="pin" size={15} color="var(--accent)" /></a>}
                  {h.date && <button type="button" className="pill" onClick={() => { doneHealthItem(h.id); toast(h.type === 'routine' ? `Erledigt – nächstes Mal in ${h.everyMonths} Monaten` : 'Erledigt'); }}>Erledigt</button>}
                </div>
              );
            })}
          </div>}
        </section>

        <Presets s={s} items={items} onPick={(p) => setSheet(p)} />

        <section className="group">
          <div className="sec-h">
            <h2 className="h2" style={{ fontSize: 19 }}>Verletzungen & Beschwerden</h2>
            <button type="button" className="link-btn" onClick={() => setSheet({ type: 'verletzung', date: t })}>+ Neu</button>
          </div>
          <div className="list">
            {injuries.length === 0 && <div className="empty">Keine. Wenn etwas zwickt, trag es ein – der Coach und die Lauf-Analyse berücksichtigen es.</div>}
            {injuries.map((h) => (
              <div key={h.id} className="row" style={{ minHeight: 60 }}>
                <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setSheet(h)}>
                  <span className={h.status === 'ausgeheilt' ? 'row-title plain done' : 'row-title plain'}>{h.title}</span>
                  <span className="row-meta">{[h.status === 'ausgeheilt' ? 'ausgeheilt' : 'aktiv', h.date && `seit ${fmtShort(h.date)}`, h.notes].filter(Boolean).join(' · ')}</span>
                </button>
                <button type="button" className="pill" onClick={() => updateHealthItem(h.id, { status: h.status === 'ausgeheilt' ? 'aktiv' : 'ausgeheilt' })}>{h.status === 'ausgeheilt' ? 'Wieder aktiv' : 'Ausgeheilt'}</button>
              </div>
            ))}
          </div>
        </section>

        {done.length > 0 && (
          <section className="group">
            <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Erledigt</h2></div>
            <div className="list">
              {done.map((h) => <div key={h.id} className="row"><span className="row-main"><span className="row-title plain done">{h.title}</span><span className="row-meta">{h.date && fmtShort(h.date)}</span></span></div>)}
            </div>
          </section>
        )}
        <PlanChat
          compact
          title="Termin der KI erzählen"
          intro="z.B. „Zahnarzt bei Dr. López nächsten Dienstag 10 Uhr“ – ich trage ihn ein."
          placeholder="Erzähl von deinem Termin …"
          history={chatOf(s, 'vorsorge')}
          onSave={(h) => saveChatOf('vorsorge', h)}
          onAsk={(hist, o) => healthChat(s, hist, o)}
          prefKey="vorsorge"
          hideToggles
          groups={HEALTH_GROUPS}
          onApply={(sel) => {
            for (const x of sel.termine || []) {
              const placeId = x.ort_id && findBookItem(s, 'vorsorge', x.ort_id) ? x.ort_id : '';
              addHealthItem({ title: x.titel, type: ['termin', 'routine', 'verletzung'].includes(x.art) ? x.art : 'termin', date: /^\d{4}-\d{2}-\d{2}$/.test(x.datum || '') ? x.datum : null, everyMonths: x.art === 'routine' ? x.alle_monate || 6 : null, notes: [x.uhrzeit && `🕒 ${x.uhrzeit}`, x.notiz].filter(Boolean).join(' · '), placeId });
            }
          }}
          chips={[]}
        />
        </>)}
      </main>
      <ItemSheet s={s} open={!!sheet} item={sheet} onClose={() => setSheet(null)} />
      <TabBar active="bereiche" />
    </>
  );
}
