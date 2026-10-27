import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addHomeItem, addReminder, deleteReminder, doneReminder, EVERY, LISTS, listOf, REMINDER_PRESETS, removeHomeItem, setHomeCats, suggestItems, updateHomeItem, updateReminder,
} from '../lib/home';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import { Back, Check, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

const COLOR = '#2FA36B';
const TABS = [
  { id: 'haushalt', label: 'Haushalt' },
  { id: 'erinnerungen', label: 'Erinnern' },
  { id: 'einrichtung', label: 'Einrichtung' },
  { id: 'kleidung', label: 'Kleidung' },
];

// ---------- Liste mit Kategorien (Haushalt, Einrichtung, Kleidung) ----------
function CatList({ s, listKey }) {
  const def = LISTS[listKey];
  const l = listOf(s, listKey);
  const [cat, setCat] = useState(null);
  const [kind, setKind] = useState('brauche');
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(false);
  const [catText, setCatText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const items = l.items.filter((x) => (!cat || x.cat === cat) && (!def.kinds || (x.kind || 'brauche') === kind));
  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  const cats = cat ? [cat] : l.cats.filter((c) => open.some((x) => x.cat === c));
  const defCat = l.cats.includes('Allgemein') ? 'Allgemein' : l.cats[0];
  const countIn = (c) => l.items.filter((x) => !x.done && x.cat === c && (!def.kinds || (x.kind || 'brauche') === kind)).length;

  const add = (e) => {
    e.preventDefault();
    addHomeItem(listKey, { text, cat: cat || defCat, kind });
    setText('');
  };
  const search = async () => {
    setBusy(true);
    setErr(null);
    try {
      setSugg(await suggestItems(s, listKey, cat, q.trim()));
      setQ('');
    } catch (e2) {
      setErr(e2.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {def.kinds && <Segmented full options={Object.entries(def.kinds).map(([id, label]) => ({ id, label }))} value={kind} onChange={setKind} label="Art" />}
      <div className="chips">
        <button type="button" className={!cat ? 'chip on' : 'chip'} onClick={() => setCat(null)}>Alle</button>
        {l.cats.map((c) => (
          <button key={c} type="button" className={edit ? 'chip editing' : cat === c ? 'chip on' : 'chip'} onClick={() => (edit ? setHomeCats(listKey, l.cats.filter((x) => x !== c)) : setCat(c))}>
            {c}{!edit && countIn(c) > 0 && <span className="badge" style={{ marginLeft: 6 }}>{countIn(c)}</span>}{edit && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className={edit ? 'chip on' : 'chip'} onClick={() => setEdit(!edit)} aria-label="Kategorien bearbeiten">{edit ? 'Fertig' : <Icon name="edit" size={14} />}</button>
      </div>
      {edit && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = catText.trim(); if (t && !l.cats.includes(t)) setHomeCats(listKey, [...l.cats, t]); setCatText(''); }}>
          <input className="input" value={catText} onChange={(e) => setCatText(e.target.value)} placeholder="Neue Kategorie, z.B. Flur" aria-label="Neue Kategorie" />
          <button type="submit" className="btn small" disabled={!catText.trim()}>+</button>
        </form>
      )}

      <form className="block-add" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`${def.kinds && kind === 'weggeben' ? 'z.B. Alte Laufschuhe' : def.placeholder}${cat ? '' : ` (${defCat})`}`} aria-label="Neuer Eintrag" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>

      {open.length === 0 && <div className="notice">{cat ? `In „${cat}“ ist nichts offen.` : 'Alles erledigt – oder noch nichts eingetragen.'}</div>}
      {cats.map((c) => (
        <section key={c} className="group">
          {!cat && <h2 className="label" style={{ padding: '0 4px' }}>{c}</h2>}
          <div className="list">
            {open.filter((x) => x.cat === c).map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 48 }}>
                <Check on={false} color={COLOR} onClick={() => updateHomeItem(listKey, x.id, { done: true })} label={`${x.text} erledigt`} />
                <span className="row-main">
                  <span className="row-title plain">{x.text}</span>
                  {(x.price || x.note) && <span className="row-meta">{[x.price, x.note].filter(Boolean).join(' · ')}</span>}
                </span>
                {x.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
                <button type="button" className="x-btn" aria-label={`${x.text} löschen`} onClick={() => removeHomeItem(listKey, x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {done.length > 0 && (
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowDone(!showDone)}>{showDone ? 'Erledigte ausblenden' : `${done.length} erledigt`}</button>
      )}
      {showDone && (
        <div className="list">
          {done.slice(-15).reverse().map((x) => (
            <div key={x.id} className="row" style={{ minHeight: 44 }}>
              <Check on color={COLOR} onClick={() => updateHomeItem(listKey, x.id, { done: false })} label={`${x.text} wieder offen`} />
              <span className="row-main"><span className="row-title plain done">{x.text}</span><span className="row-meta">{x.cat}</span></span>
            </div>
          ))}
        </div>
      )}

      {def.search && (
        <section className="card checkin" style={{ gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
            <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span>
            Ideen finden{cat ? `: ${cat}` : ''}
          </span>
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={listKey === 'kleidung' ? 'z.B. „Laufjacke für Regen, schlicht“' : 'z.B. „gemütliche Leselampe, warmes Licht“'} aria-label="Wonach suchen" />
            <button type="submit" className="btn small" disabled={busy || !hasKey}>{busy ? '…' : 'Los'}</button>
          </form>
          {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich suche passende Ideen … (ca. 20 Sek.)</span></div>}
          {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
          {!busy && sugg && sugg.map((v) => (
            <div key={v.id} className="option" style={{ alignItems: 'center' }}>
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{v.text}</span>
                <span className="tiny">{[v.price, v.shop].filter(Boolean).join(' · ')}</span>
                {v.why && <span className="tiny" style={{ color: 'var(--text)' }}>{v.why}</span>}
              </span>
              {v.url && <a className="x-btn" href={v.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              <button type="button" className="pill on" onClick={() => { addHomeItem(listKey, { text: v.text, cat: cat || defCat, kind: 'brauche', price: v.price, url: v.url, note: v.shop }); setSugg(sugg.filter((x) => x.id !== v.id)); toast('Auf der Liste'); }}>Merken</button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// ---------- Erinnerungen ----------
function ReminderSheet({ item, onClose }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    setF(item ? { title: '', every: 'monat', next: today(), note: '', ...item } : null);
  }, [item]);
  const save = () => {
    if (item?.id) updateReminder(item.id, { title: f.title, every: f.every, next: f.next || today(), note: f.note });
    else addReminder(f);
    toast('Gespeichert');
    onClose();
  };
  return (
    <Sheet open={!!item} title={item?.id ? 'Erinnerung bearbeiten' : 'Neue Erinnerung'} onClose={onClose}>
      {f && (
        <>
          <Field label="Was?"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z.B. Miete bezahlen" /></Field>
          <div className="field"><span>Wie oft?</span><div className="chips">{Object.entries(EVERY).map(([k, v]) => <button key={k} type="button" className={f.every === k ? 'chip on' : 'chip'} onClick={() => setF({ ...f, every: k })}>{v}</button>)}</div></div>
          <Field label="Nächstes Mal"><input className="input" type="date" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
          <Field label="Notiz (optional)"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="z.B. Betrag, Konto, Link" /></Field>
          <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
          {item?.id && <button type="button" className="btn danger" onClick={() => { if (confirm('Löschen?')) { deleteReminder(item.id); onClose(); } }}>Löschen</button>}
        </>
      )}
    </Sheet>
  );
}
function Reminders({ s }) {
  const t = today();
  const [sheet, setSheet] = useState(null);
  const list = [...(s.reminders || [])].sort((a, b) => (a.next < b.next ? -1 : 1));
  const presets = REMINDER_PRESETS.filter((p) => !list.some((r) => r.title === p.title));
  const when = (r) => {
    const d = diffDays(t, r.next);
    if (d < 0) return `überfällig seit ${-d} ${-d === 1 ? 'Tag' : 'Tagen'}`;
    if (d === 0) return 'heute';
    if (d === 1) return 'morgen';
    return `in ${d} Tagen · ${fmtShort(r.next)}`;
  };
  return (
    <>
      <div className="sec-h" style={{ padding: '0 4px' }}>
        <span className="sub">Erscheinen am Tag automatisch auf „Heute“.</span>
        <button type="button" className="btn small" onClick={() => setSheet({})}>+ Neu</button>
      </div>
      <div className="list">
        {list.length === 0 && <div className="empty">Noch keine Erinnerungen.</div>}
        {list.map((r) => {
          const over = r.next < t;
          return (
            <div key={r.id} className="row" style={{ minHeight: 60 }}>
              <span className="block-icon" style={{ background: over ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--accent-bg)', color: over ? 'var(--danger)' : 'var(--accent)' }}><Icon name="refresh" size={16} /></span>
              <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setSheet(r)}>
                <span className="row-title plain">{r.title}</span>
                <span className="row-meta" style={{ color: over ? 'var(--danger)' : undefined }}>{when(r)} · {EVERY[r.every]}{r.note ? ` · ${r.note}` : ''}</span>
              </button>
              <button type="button" className="pill" onClick={() => { doneReminder(r.id); toast('Erledigt – nächstes Mal ist eingeplant'); }}>Erledigt</button>
            </div>
          );
        })}
      </div>
      {presets.length > 0 && (
        <section className="card" style={{ gap: 10 }}>
          <span className="label" style={{ padding: 0 }}>Schnell hinzufügen</span>
          <div className="chips">{presets.map((p) => <button key={p.title} type="button" className="chip soft" onClick={() => setSheet(p)}>+ {p.title}</button>)}</div>
        </section>
      )}
      <ReminderSheet item={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

export default function Zuhause({ tab = 'haushalt' }) {
  const s = useStore();
  const current = TABS.some((x) => x.id === tab) ? tab : 'haushalt';
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/saeule/persoenlich" label="Zuhause" />
          <h1 className="h1">Zuhause</h1>
        </div>
        <Segmented full options={TABS} value={current} onChange={(v) => go(`/zuhause/${v}`)} label="Ansicht" />
        {current === 'erinnerungen' ? <Reminders s={s} /> : <CatList key={current} s={s} listKey={current} />}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
