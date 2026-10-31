import QuickSheet from '../components/QuickSheet';
import { SOURCE_AREAS } from '../lib/sources';
import MicBtn from '../components/MicBtn';
import AiFill from '../components/AiFill';
import { askDel } from '../lib/undo';
import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { diffDays, fmtShort, today } from '../lib/dates';
import {
  addHomeItem, addReminder, deleteReminder, doneReminder, EVERY, LISTS, listOf, REMINDER_PRESETS, removeHomeItem, setHomeCats, suggestItems, updateHomeItem, updateReminder, sellListing, SELL_LINKS, speakToList,
} from '../lib/home';
import { waLink } from '../lib/logic';
import { cityOf } from '../lib/outings';
import PlaceBook from '../components/PlaceBook';
import SourceLinks, { useSearchMode } from '../components/SourceLinks';
import SearchCard, { QuickChips } from '../components/SearchCard';
import { CityChips } from './Ausgehen';
import { getAi } from '../lib/ai';
import { go } from '../lib/router';
import { Back, Check, Field, Icon, Info, Segmented, Sheet, TabBar, toast } from '../components/ui';

const COLOR = '#2FA36B';
// v1.02 (Mateo): drei Bereiche – Allgemein (To-dos | Erinnern), Einrichtung, Kleidung (je Liste | Finden | Orte)
const TABS = [
  { id: 'allgemein', label: 'Allgemein' },
  { id: 'einrichtung', label: 'Einrichtung' },
  { id: 'kleidung', label: 'Kleidung' },
];
const sub = (key, def) => { try { return localStorage.getItem(`life-app-zuhause-${key}`) || def; } catch { return def; } };
const setSub = (key, v) => { try { localStorage.setItem(`life-app-zuhause-${key}`, v); } catch {} };
function SubSwitch({ k, options, value, onChange }) {
  return (
    <div className="sub-switch" style={{ alignSelf: 'flex-start' }}>
      {options.map((o) => <button key={o.id} type="button" className={value === o.id ? 'on' : ''} onClick={() => { setSub(k, o.id); onChange(o.id); }}>{o.label}</button>)}
    </div>
  );
}

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
  const [give, setGive] = useState(null);
  const items = l.items.filter((x) => (!cat || x.cat === cat) && (!def.kinds || (x.kind || 'brauche') === kind));
  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  const cats = cat ? [cat] : l.cats.filter((c) => open.some((x) => x.cat === c));
  const defCat = l.cats.includes('Allgemein') ? 'Allgemein' : l.cats[0];
  const countIn = (c) => l.items.filter((x) => !x.done && x.cat === c && (!def.kinds || (x.kind || 'brauche') === kind)).length;

  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState(null);
  const add = (e) => {
    e.preventDefault();
    String(text).split(/,|\n|;/).map((x) => x.trim()).filter(Boolean).forEach((x) => addHomeItem(listKey, { text: x[0].toUpperCase() + x.slice(1), cat: cat || defCat, kind }));
    setText('');
  };
  // v1.50 (Mateo): einsprechen → KI trägt ein (mit Kategorie) bzw. macht Vorschläge zum Antippen
  const speak = async (said) => {
    const tx = String(said || '').trim();
    if (!tx) return;
    if (!getAi().apiKey) { add({ preventDefault() {} }); return; }
    setBusy(true);
    try {
      const r = await speakToList(s, listKey, tx, { kind, cat });
      r.items.forEach((x) => addHomeItem(listKey, x));
      setIdeas(r.ideas.length ? r.ideas : null);
      setText('');
      toast(r.items.length ? `${r.items.length} eingetragen${r.ideas.length ? ' · Vorschläge unten' : ''}` : r.ideas.length ? 'Vorschläge – antippen zum Merken' : 'Nichts erkannt – nochmal anders sagen?');
    } catch (e2) { toast(e2.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es den KI-Schlüssel' : e2.message); }
    setBusy(false);
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

      <form className="block-add" onSubmit={add} style={{ alignItems: 'center' }}>
        <MicBtn value={text} onChange={setText} onDone={speak} />
        <input className="input" style={{ flex: 1, minWidth: 0 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={busy ? 'Ich sortiere ein …' : `${def.kinds && kind === 'weggeben' ? 'z.B. Alte Laufschuhe' : def.placeholder}${cat ? '' : ` (${defCat})`}`} aria-label="Neuer Eintrag" />
        {getAi().apiKey && text.trim().split(/\s+/).length >= 3 && <button type="button" className="btn small tint" disabled={busy} onClick={() => speak(text)} aria-label="Mit KI einsortieren">✨</button>}
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich sortiere ein …</span></div>}
      {ideas && (
        <section className="card" style={{ gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ fontWeight: 650, flex: 1 }}>✨ Vorschläge</span><button type="button" className="x-btn" onClick={() => setIdeas(null)} aria-label="Vorschläge schließen"><Icon name="x" size={12} color="var(--chev)" /></button></div>
          {ideas.map((v) => (
            <div key={v.id} className="option" style={{ alignItems: 'center' }}>
              <span className="row-main"><span style={{ fontSize: 15, fontWeight: 600 }}>{v.text}</span><span className="tiny">{[v.cat, v.why].filter(Boolean).join(' · ')}</span></span>
              <button type="button" className="pill on" onClick={() => { addHomeItem(listKey, { text: v.text, cat: v.cat, kind }); const rest = ideas.filter((x) => x.id !== v.id); setIdeas(rest.length ? rest : null); }}>Merken</button>
            </div>
          ))}
        </section>
      )}
      <Info>🎙 Einsprechen, z.B. „Bad putzen, Müll rausbringen und die Lampe reparieren“ – die KI trägt alles mit passender Kategorie ein. {def.kinds ? 'Fragst du nach Ideen („Mein Balkon soll gemütlicher werden“), kommen Vorschläge zum Antippen.' : ''}</Info>

      {open.length === 0 && <div className="notice">{cat ? `In „${cat}“ ist nichts offen.` : 'Alles erledigt – oder noch nichts eingetragen.'}</div>}
      {cats.map((c) => (
        <section key={c} className="group">
          {!cat && <h2 className="label" style={{ padding: '0 4px' }}>{c}</h2>}
          <div className="list">
            {open.filter((x) => x.cat === c).map((x) => (
              <div key={x.id} className="row" style={{ minHeight: 48 }}>
                <Check on={false} color={COLOR} onClick={() => updateHomeItem(listKey, x.id, { done: true })} label={`${x.text} erledigt`} />
                <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => (x.kind === 'weggeben' ? setGive(x) : null)} disabled={x.kind !== 'weggeben'}>
                  <span className="row-title plain">{x.text}</span>
                  {(x.price || x.note || x.giveTo || x.sale) && <span className="row-meta">{[x.giveTo && `🎁 an ${x.giveTo}`, x.sale && `💰 ${x.sale.preis || 'Anzeige fertig'}`, x.price, x.note].filter(Boolean).join(' · ')}</span>}
                  {x.kind === 'weggeben' && !x.giveTo && !x.sale && <span className="row-meta" style={{ color: 'var(--accent)' }}>Antippen: verkaufen oder verschenken</span>}
                </button>
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

      <GiveSheet s={s} listKey={listKey} item={give} onClose={() => setGive(null)} />
    </>
  );
}

// v1.02: Weggeben – verkaufen (KI schreibt die Anzeige) oder an jemanden geben (WhatsApp)
function GiveSheet({ s, listKey, item, onClose }) {
  const [mode, setMode] = useState('verkaufen');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [ad, setAd] = useState(null);
  const [q, setQ] = useState('');
  const [who, setWho] = useState(null); // { name, phone }
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(null);
  if (item && loaded !== item.id) { setLoaded(item.id); setMode(item.giveTo ? 'geben' : 'verkaufen'); setAd(item.sale || null); setExtra(''); setWho(item.giveTo ? { name: item.giveTo, phone: item.givePhone || '' } : null); setMsg(''); setQ(''); }
  if (!item) return <Sheet open={false} onClose={onClose} title="" />;
  const write = async () => {
    setBusy(true);
    try { const r = await sellListing(s, item, extra); setAd({ titel: r.titel || item.text, text: r.text || '', preis: r.preis || '', tipps: r.tipps || '' }); } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel.' : e.message); } finally { setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(`${ad.titel}\n\n${ad.text}${ad.preis ? `\n\n${ad.preis}` : ''}`); toast('Kopiert – in der Verkaufs-App einfügen'); } catch { toast('Kopieren ging nicht – Text markieren und kopieren'); } };
  const people = (s.people || []).filter((p) => p.phone && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
  const pick = (p) => { setWho({ name: p.name, phone: p.phone }); setMsg(`Hola ${p.name.split(' ')[0]}! Ich gebe „${item.text}“ weg – magst du es haben? 🙂`); };
  const wa = who?.phone ? `${waLink({ phone: who.phone })}?text=${encodeURIComponent(msg)}` : null;
  return (
    <Sheet open title={`Weggeben: ${item.text}`} onClose={onClose}>
      <Segmented full options={[{ id: 'verkaufen', label: '💰 Verkaufen' }, { id: 'geben', label: '🎁 Jemandem geben' }]} value={mode} onChange={setMode} label="Wie?" />
      {mode === 'verkaufen' ? (
        <>
          <label className="field"><span>Details (optional)</span><input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="z.B. 2 Jahre alt, kaum benutzt, 120 × 60 cm" /></label>
          <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} disabled={busy || !getAi().apiKey} onClick={write}>{busy ? 'Ich schreibe …' : ad ? '✨ Neu schreiben' : '✨ Anzeige schreiben lassen'}</button>
          {ad && (
            <>
              <label className="field"><span>Titel</span><input className="input" value={ad.titel} onChange={(e) => setAd({ ...ad, titel: e.target.value })} /></label>
              <label className="field"><span>Text</span><textarea className="input" rows={5} value={ad.text} onChange={(e) => setAd({ ...ad, text: e.target.value })} /></label>
              <label className="field"><span>Preis</span><input className="input" value={ad.preis} onChange={(e) => setAd({ ...ad, preis: e.target.value })} /></label>
              {ad.tipps && <span className="tiny">💡 {ad.tipps}</span>}
              <div className="chips">
                <button type="button" className="chip on" onClick={copy}>📋 Text kopieren</button>
                {SELL_LINKS.map((l) => <a key={l.url} className="pill link-chip" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>)}
              </div>
              <button type="button" className="btn" onClick={() => { updateHomeItem(listKey, item.id, { sale: ad, giveTo: '' }); toast('Anzeige gespeichert'); onClose(); }}>Speichern</button>
            </>
          )}
        </>
      ) : (
        <>
          {who ? (
            <>
              <div className="chips" style={{ alignItems: 'center' }}><span className="chip on">🎁 {who.name}</span><button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => setWho(null)}>ändern</button></div>
              <label className="field"><span>Nachricht</span><textarea className="input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
              <div className="chips">
                {wa && <a className="btn small" href={wa} target="_blank" rel="noreferrer" onClick={() => updateHomeItem(listKey, item.id, { giveTo: who.name, givePhone: who.phone })}>📲 WhatsApp öffnen</a>}
                <button type="button" className="btn small tint" onClick={() => { updateHomeItem(listKey, item.id, { giveTo: who.name, givePhone: who.phone || '' }); toast(`Vorgemerkt für ${who.name}`); onClose(); }}>Nur vormerken</button>
              </div>
              {!wa && <span className="tiny">Keine Telefonnummer – nur vormerken möglich.</span>}
            </>
          ) : (
            <>
              <label className="field"><span>An wen?</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name suchen oder eintippen" /></label>
              {q.trim() && !people.some((p) => p.name.toLowerCase() === q.trim().toLowerCase()) && <button type="button" className="chip soft" style={{ alignSelf: 'flex-start' }} onClick={() => { setWho({ name: q.trim(), phone: '' }); setMsg(''); }}>+ „{q.trim()}“ (ohne Nummer)</button>}
              <div className="list">
                {people.map((p) => <button key={p.id} type="button" className="row compact" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none' }} onClick={() => pick(p)}><span className="row-main"><span className="row-title plain">{p.name}</span></span><span className="tiny">📲</span></button>)}
                {!people.length && <div className="empty">Keine passenden Kontakte mit Telefonnummer.</div>}
              </div>
            </>
          )}
        </>
      )}
      {(item.giveTo || item.sale) && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { updateHomeItem(listKey, item.id, { done: true }); toast('Weggegeben ✓'); onClose(); }}>✓ Ist weg – abhaken</button>}
    </Sheet>
  );
}

// v1.02: Sachen finden – kostenlose Links zu Shops + KI-Ideen (ohne Internet)
function FindItems({ s, listKey }) {
  const l = listOf(s, listKey);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(l.cats[0]);
  const [sugg, setSugg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useSearchMode('zuhause-' + listKey, 'links');
  const run = async (t = q) => {
    setMode('ki');
    setBusy(true);
    try { setSugg(await suggestItems(s, listKey, cat, String(t || '').trim())); } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <SearchCard q={q} setQ={setQ} placeholder={listKey === 'kleidung' ? 'z.B. Laufjacke für Regen' : 'z.B. gemütliche Leselampe'} mode={mode} busy={busy}
        quick={<QuickChips chips={SOURCE_AREAS[listKey]?.chips} q={q} setQ={setQ} />}
        filters={<div className="filter-pair"><QuickSheet className="filter-btn" label={<><span className="tiny">Bereich</span><b>🏷 {cat} ▾</b></>} title="Für welchen Bereich?">{(close) => <div className="chips">{l.cats.map((c) => <button key={c} type="button" className={cat === c ? 'chip on' : 'chip soft'} onClick={() => { setCat(c); close(); }}>{c}</button>)}</div>}</QuickSheet></div>}
        onLinks={() => setMode('links')} onAi={run} aiLabel="✨ KI" aiCost="<1 ct"
        hint="🔗 Links: Mercado Libre, Google Shopping & Co. mit deinem Suchbegriff – kostenlos. ✨ KI: schlägt 4–6 passende Sachen vor (ohne Internet, unter 1 Cent). „Merken“ setzt sie auf deine Liste „Will ich haben“.">
        {mode === 'links' && <SourceLinks embedded autoTailor s={s} area={listKey} query={q} />}
        {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich überlege …</span></div>}
      </SearchCard>
      {mode === 'ki' && sugg && (
        <section className="card" style={{ gap: 8 }}>
          {!sugg.length && <span className="sub">Keine Ideen – anders formulieren?</span>}
          {sugg.map((v) => (
            <div key={v.id} className="option" style={{ alignItems: 'center' }}>
              <span className="row-main">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{v.text}</span>
                <span className="tiny">{[v.price, v.shop].filter(Boolean).join(' · ')}</span>
                {v.why && <span className="tiny" style={{ color: 'var(--text)' }}>{v.why}</span>}
              </span>
              {v.url && <a className="x-btn" href={v.url} target="_blank" rel="noreferrer" aria-label="Öffnen"><Icon name="link" size={15} color="var(--accent)" /></a>}
              <button type="button" className="pill on" onClick={() => { addHomeItem(listKey, { text: v.text, cat, kind: 'brauche', price: v.price, url: v.url, note: v.shop }); setSugg(sugg.filter((x) => x.id !== v.id)); toast('Auf der Liste'); }}>Merken</button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function ThingsArea({ s, listKey }) {
  const [part, setPart] = useState(() => sub(listKey, 'liste'));
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <SubSwitch k={listKey} value={part} onChange={setPart} options={[{ id: 'liste', label: '📋 Liste' }, { id: 'finden', label: '🔍 Finden' }, { id: 'orte', label: '📍 Orte' }]} />
        {part === 'orte' && <CityChips s={s} compact />}
      </div>
      {part === 'liste' && <CatList key={listKey} s={s} listKey={listKey} />}
      {part === 'finden' && <FindItems s={s} listKey={listKey} />}
      {part === 'orte' && <PlaceBook s={s} book={listKey} city={cityOf(s)} hint={listKey === 'kleidung' ? 'Läden für Kleidung, Schuhe, Second Hand … – oben „+ Ort“.' : 'Möbel, Deko, Baumarkt … – oben „+ Ort“.'} />}
    </>
  );
}

function General({ s, initial }) {
  const [part, setPart] = useState(() => initial || sub('allgemein', 'todos'));
  return (
    <>
      <SubSwitch k="allgemein" value={part} onChange={setPart} options={[{ id: 'todos', label: '✅ To-dos' }, { id: 'erinnern', label: '🔔 Erinnern' }]} />
      {part === 'erinnern' ? <Reminders s={s} /> : <CatList key="haushalt" s={s} listKey="haushalt" />}
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
          {!item?.id && <AiFill title="Wiederkehrende Erinnerung" values={{ title: f.title, note: f.note }} onResult={(r) => setF((x) => ({ ...x, ...r }))}
            fields={{ title: 'Was (kurz)', every: { d: 'Wie oft', enum: Object.keys(EVERY) }, next: 'Nächstes Mal YYYY-MM-DD', note: 'Notiz (Betrag, Konto, Link)' }}
            placeholder="z.B. „Jeden Monat am 5. Miete zahlen, 450.000 Pesos“" />}
          <Field label="Was?"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z.B. Miete bezahlen" /></Field>
          <div className="field"><span>Wie oft?</span><div className="chips">{Object.entries(EVERY).map(([k, v]) => <button key={k} type="button" className={f.every === k ? 'chip on' : 'chip'} onClick={() => setF({ ...f, every: k })}>{v}</button>)}</div></div>
          <Field label="Nächstes Mal"><input className="input" type="date" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
          <Field label="Notiz (optional)"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="z.B. Betrag, Konto, Link" /></Field>
          <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
          {item?.id && <button type="button" className="btn danger" onClick={() => { if (askDel('Löschen?')) { deleteReminder(item.id); onClose(); } }}>Löschen</button>}
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
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn small" style={{ whiteSpace: 'nowrap' }} onClick={() => setSheet({})}>+ Neu</button>
          {presets.length > 0 && <QuickSheet label="⚡" title="Schnell: Erinnerung">{(close) => <div className="chips">{presets.map((p) => <button key={p.title} type="button" className="chip soft" onClick={() => { close(); setTimeout(() => setSheet(p), 200); }}>+ {p.title}</button>)}</div>}</QuickSheet>}
        </span>
      </div>
      <AiFill title="Wiederkehrende Erinnerung" values={{}} onResult={(r) => setSheet({ title: '', every: 'monat', next: today(), note: '', ...r })}
        fields={{ title: 'Was (kurz)', every: { d: 'Wie oft', enum: Object.keys(EVERY) }, next: 'Nächstes Mal YYYY-MM-DD', note: 'Notiz (Betrag, Konto, Link)' }}
        placeholder="z.B. „Jeden Monat am 5. Miete zahlen, 450.000 Pesos“" />
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
      <ReminderSheet item={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

export default function Zuhause({ tab = 'allgemein' }) {
  const s = useStore();
  const current = tab === 'haushalt' || tab === 'erinnerungen' ? 'allgemein' : TABS.some((x) => x.id === tab) ? tab : 'allgemein';
  const initial = tab === 'erinnerungen' ? 'erinnern' : tab === 'haushalt' ? 'todos' : null;
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereiche" label="Bereiche" />
          <h1 className="h1">Zuhause</h1>
        </div>
        <Segmented full options={TABS} value={current} onChange={(v) => go(`/zuhause/${v}`)} label="Ansicht" />
        {current === 'allgemein' ? <General s={s} initial={initial} /> : <ThingsArea key={current} s={s} listKey={current} />}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
