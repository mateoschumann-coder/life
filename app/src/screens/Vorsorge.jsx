import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import { addHealthItem, deleteHealthItem, doneHealthItem, updateHealthItem } from '../lib/health';
import { Back, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';
import { DateRangeField } from '../components/DateRange';
import PlaceBook, { ItemSheet as PlaceSheet } from '../components/PlaceBook';
import { bookCats, bookMaps, bookOf, findBookItem } from '../lib/placebook';

const TYPES = [
  { id: 'termin', label: 'Termin', hint: 'Einmalig, z.B. Arzttermin am 12. Nov.' },
  { id: 'routine', label: 'Regelmäßig', hint: 'Wiederkehrend, z.B. Zahnarzt alle 6 Monate' },
  { id: 'verletzung', label: 'Verletzung', hint: 'Beschwerden festhalten – der Coach berücksichtigt sie' },
];
const PRESETS = [
  { title: 'Zahnarzt-Kontrolle', type: 'routine', everyMonths: 6 },
  { title: 'Zahnreinigung', type: 'routine', everyMonths: 6 },
  { title: 'Allgemeiner Check-up', type: 'routine', everyMonths: 12 },
  { title: 'Hautarzt (Muttermale)', type: 'routine', everyMonths: 12 },
  { title: 'Augenarzt', type: 'routine', everyMonths: 24 },
  { title: 'Laufschuhe wechseln', type: 'routine', everyMonths: 6 },
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

export default function Vorsorge() {
  const s = useStore();
  const t = today();
  const [sheet, setSheet] = useState(null);
  const [view, setViewState] = useState(() => { try { return sessionStorage.getItem('life-vorsorge-view') || 'termine'; } catch { return 'termine'; } });
  const setView = (v) => { setViewState(v); try { sessionStorage.setItem('life-vorsorge-view', v); } catch {} };
  const items = s.healthItems;
  const upcoming = items.filter((h) => h.type !== 'verletzung' && h.status !== 'erledigt').sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
  const injuries = items.filter((h) => h.type === 'verletzung');
  const done = items.filter((h) => h.type === 'termin' && h.status === 'erledigt').slice(-5).reverse();
  const presets = PRESETS.filter((p) => !items.some((h) => h.title === p.title));

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/koerper" label="Körperliche Gesundheit" />
          <div className="sec-h" style={{ padding: 0 }}>
            <h1 className="h1">Vorsorge</h1>
            {view === 'termine' && <button type="button" className="btn small" onClick={() => setSheet({})}>+ Neu</button>}
          </div>
        </div>
        <Segmented full options={[{ id: 'termine', label: 'Termine' }, { id: 'orte', label: `Orte${bookOf(s, 'vorsorge').items.length ? ` (${bookOf(s, 'vorsorge').items.length})` : ''}` }]} value={view} onChange={setView} label="Ansicht" />
        {view === 'orte' ? <PlaceBook s={s} book="vorsorge" hint="Deine Ärzte, Therapeuten, Apotheke, Labor … – oben „+ Ort“. Beim Termin kannst du den Ort dann auswählen." /> : (<>
        <span className="sub" style={{ padding: '0 4px' }}>Fällige Termine erscheinen automatisch auf „Heute“.</span>

        <section className="group">
          <div className="sec-h"><h2 className="h2" style={{ fontSize: 19 }}>Termine & Routinen</h2></div>
          <div className="list">
            {upcoming.length === 0 && <div className="empty">Noch nichts eingetragen.</div>}
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
          </div>
        </section>

        {presets.length > 0 && (
          <section className="card" style={{ gap: 10 }}>
            <span className="label" style={{ padding: 0 }}>Schnell hinzufügen</span>
            <div className="chips">
              {presets.map((p) => <button key={p.title} type="button" className="chip soft" onClick={() => setSheet(p)}>+ {p.title}</button>)}
            </div>
          </section>
        )}

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
        </>)}
      </main>
      <ItemSheet s={s} open={!!sheet} item={sheet} onClose={() => setSheet(null)} />
      <TabBar active="bereiche" />
    </>
  );
}
