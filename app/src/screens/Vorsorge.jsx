import { useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import { addHealthItem, deleteHealthItem, doneHealthItem, updateHealthItem } from '../lib/health';
import { Back, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

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

function ItemSheet({ open, onClose, item }) {
  const blank = { title: '', type: 'termin', date: '', everyMonths: '', notes: '' };
  const [f, setF] = useState(blank);
  const [loaded, setLoaded] = useState(null);
  if (open && (item?.id || 'neu') !== loaded) {
    setLoaded(item?.id || 'neu');
    setF(item?.id ? { ...blank, ...item, date: item.date || '', everyMonths: item.everyMonths || '' } : { ...blank, ...(item || {}) });
  }
  const save = () => {
    const data = { title: f.title, type: f.type, date: f.date || null, everyMonths: f.type === 'routine' ? Number(f.everyMonths) || 6 : null, notes: f.notes };
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
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label={f.type === 'verletzung' ? 'Seit' : f.type === 'routine' ? 'Nächstes Mal' : 'Datum'}><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        {f.type === 'routine' && <Field label="Alle … Monate"><input className="input" inputMode="numeric" value={f.everyMonths} onChange={(e) => setF({ ...f, everyMonths: e.target.value })} placeholder="6" /></Field>}
      </div>
      <Field label="Notizen"><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={f.type === 'verletzung' ? 'Wann tut es weh? Was hilft? Was hat der Arzt gesagt?' : 'Adresse, Telefon, was mitnehmen …'} /></Field>
      <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
      {item?.id && <button type="button" className="btn danger" onClick={() => { if (confirm('Löschen?')) { deleteHealthItem(item.id); close(); } }}>Löschen</button>}
    </Sheet>
  );
}

export default function Vorsorge() {
  const s = useStore();
  const t = today();
  const [sheet, setSheet] = useState(null);
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
            <button type="button" className="btn small" onClick={() => setSheet({})}>+ Neu</button>
          </div>
        </div>
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
                    <span className="row-meta" style={{ color: overdue ? 'var(--danger)' : undefined }}>{when(h, t)}{h.type === 'routine' && h.everyMonths ? ` · alle ${h.everyMonths} Monate` : ''}</span>
                  </button>
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
      </main>
      <ItemSheet open={!!sheet} item={sheet} onClose={() => setSheet(null)} />
      <TabBar active="bereiche" />
    </>
  );
}
