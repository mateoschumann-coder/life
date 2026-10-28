// Kontakte vom iPhone übernehmen (vCard-Datei), Vorschau mit Häkchen und Kategorie
import { useRef, useState } from 'react';
import { savePerson } from '../lib/actions';
import { PEOPLE_CATEGORIES } from '../lib/seed';
import { canPickContacts, parseVcf, pickContacts } from '../lib/vcard';
import { Check, Sheet, toast, Info } from './ui';

const RHYTHM = {}; // v0.94: Rhythmus legt Mateo danach unter „Im Kontakt bleiben“ fest (sonst wären alle sofort „fällig“)
const norm = (x) => String(x || '').trim().toLowerCase();

export default function ContactImport({ s, open, onClose }) {
  const file = useRef(null);
  const [list, setList] = useState(null);
  const [cat, setCat] = useState('freunde');
  const [err, setErr] = useState(null);
  const known = (c) => s.people.some((p) => norm(p.name) === norm(c.name));
  const load = (cards) => {
    setErr(cards.length ? null : 'In der Datei wurden keine Kontakte gefunden.');
    setList(cards.map((c, i) => ({ ...c, key: i, on: !known(c) })));
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    load(parseVcf(await f.text()));
  };
  const pick = async () => {
    try {
      load(await pickContacts());
    } catch (e) {
      setErr(e.message);
    }
  };
  const take = () => {
    const sel = list.filter((c) => c.on && !known(c));
    for (const c of sel) savePerson({ name: c.name, phone: c.phone, birthday: c.birthday, category: cat, contactEvery: RHYTHM[cat] ?? null, metAt: '', followUp: null, notes: '' });
    toast(`${sel.length} ${sel.length === 1 ? 'Person' : 'Personen'} übernommen`);
    setList(null);
    onClose();
  };
  const close = () => { setList(null); setErr(null); onClose(); };
  const n = list ? list.filter((c) => c.on && !known(c)).length : 0;
  return (
    <Sheet open={open} title="Kontakte übernehmen" onClose={close}>
      {!list && (
        <>
          <div className="notice" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b>So geht es auf dem iPhone:</b>
            <span>1. App <b>Kontakte</b> öffnen, einen Kontakt antippen.</span>
            <span>2. Unten auf <b>Kontakt teilen</b> → <b>In Dateien sichern</b>. (Mehrere auf einmal: in der Kontakte-Liste mit zwei Fingern über die Namen ziehen, dann lange drücken → Teilen.)</span>
            <span>3. Hier auf <b>Datei wählen</b> tippen und die gesicherte Datei (.vcf) aussuchen.</span>
          </div>
          <input ref={file} type="file" accept=".vcf,text/vcard,text/x-vcard" style={{ display: 'none' }} onChange={onFile} />
          <button type="button" className="btn" onClick={() => file.current?.click()}>Datei wählen</button>
          {canPickContacts() && <button type="button" className="btn sec" onClick={pick}>Aus dem Adressbuch auswählen</button>}
          <Info>Übernommen werden Name, Telefonnummer (für WhatsApp) und Geburtstag. Die Daten bleiben nur auf deinem iPhone.</Info>
        </>
      )}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {list && list.length > 0 && (
        <>
          <span className="label" style={{ padding: 0 }}>Kategorie für alle</span>
          <div className="chips">{PEOPLE_CATEGORIES.map((c) => <button key={c.id} type="button" className={cat === c.id ? 'chip on' : 'chip'} onClick={() => setCat(c.id)}>{c.label}</button>)}</div>
          <div className="list" style={{ maxHeight: '45vh', overflow: 'auto' }}>
            {list.map((c) => (
              <div key={c.key} className="row" style={{ minHeight: 52, opacity: known(c) ? 0.5 : 1 }}>
                <Check on={c.on && !known(c)} onClick={() => !known(c) && setList(list.map((x) => (x.key === c.key ? { ...x, on: !x.on } : x)))} label={c.name} />
                <span className="row-main">
                  <span className="row-title plain">{c.name}</span>
                  <span className="row-meta">{known(c) ? 'Schon vorhanden' : [c.phone, c.birthday && `Geburtstag ${c.birthday.slice(8)}.${c.birthday.slice(5, 7)}.`].filter(Boolean).join(' · ') || 'Nur Name'}</span>
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="btn" disabled={!n} onClick={take}>{n} übernehmen</button>
          <button type="button" className="btn tint" onClick={() => setList(null)}>Andere Datei</button>
        </>
      )}
    </Sheet>
  );
}
