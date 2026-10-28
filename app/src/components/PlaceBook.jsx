// Orte-Verzeichnis (v0.91) – gleiche Ansicht für Küche (Läden) und Vorsorge (Ärzte …):
// Kategorien als Reiter, optionale Unterkategorien, „+ Ort“ oben, kurze Zeilen mit Maps-Knopf, antippen = bearbeiten
import { useState } from 'react';
import { addBookCat, addBookItem, addBookSub, BOOK_STATUS, bookAreas, rememberArea, bookCats, bookMaps, bookOf, findBookPlace, mapsSearch, removeBookCat, removeBookItem, restoreBookCats, telOf, updateBookItem } from '../lib/placebook';
import { getAi } from '../lib/ai';
import { hoodHere } from '../lib/outings';
import { Field, Icon, Sheet, toast } from './ui';

function Stars({ value, onChange }) {
  return (
    <span style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} Sterne`} onClick={() => onChange(value === n ? 0 : n)} style={{ border: 0, background: 'none', padding: '2px 3px', fontSize: 24, lineHeight: 1, color: n <= (value || 0) ? '#F5B301' : 'var(--line)', cursor: 'pointer' }}>★</button>)}
    </span>
  );
}

export function ItemSheet({ s, book, cats, item, onClose, onSaved }) {
  const isNew = item && !item.id;
  const [f, setF] = useState(null);
  const [newSub, setNewSub] = useState('');
  const [hits, setHits] = useState(null);
  const [finding, setFinding] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const key = item ? item.id || 'neu' : null;
  const [loaded, setLoaded] = useState(null);
  if (key !== loaded) { setLoaded(key); setF(item ? { name: '', cat: cats[0]?.id || '', sub: '', address: '', area: '', phone: '', url: '', note: '', status: '', rating: 0, ...item } : null); setHits(null); setCatOpen(!(item && item.cat)); }
  if (!item || !f) return <Sheet open={false} onClose={onClose} title="" />;
  const cat = cats.find((c) => c.id === f.cat);
  const areas = bookAreas(s, book);
  const findIt = async () => {
    setFinding(true);
    try { setHits(await findBookPlace(s, { name: f.name, area: f.area, kind: [cat?.label, f.sub].filter(Boolean).join(' – ') })); } catch (e) { toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel.' : e.message); } finally { setFinding(false); }
  };
  const save = () => {
    const sub = newSub.trim() || f.sub;
    if (newSub.trim() && f.cat) addBookSub(book, f.cat, newSub.trim());
    if (String(f.area || '').trim()) rememberArea(f.area);
    let url = String(f.url || '').trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const data = { ...f, sub, url };
    let id = item.id;
    if (isNew) id = addBookItem(book, data);
    else updateBookItem(book, item.id, data);
    onSaved?.(id, data);
    toast('Gespeichert');
    setNewSub('');
    onClose();
  };
  return (
    <Sheet open title={isNew ? 'Neuer Ort' : f.name || 'Ort'} onClose={onClose}>
      <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z.B. Coto, Dr. García" /></Field>
      {!f.name.trim() && isNew && <span className="tiny" style={{ marginTop: -4 }}>Name eingeben – dann kann die KI Adresse & Telefon suchen.</span>}
      <Field label="Wo ungefähr?"><input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Viertel oder Straße, z.B. Palermo" /></Field>
      <div className="chips" style={{ marginTop: -4 }}>
        <button type="button" className="chip soft small-chip" disabled={locating} onClick={async () => { setLocating(true); try { const h = await hoodHere(); setF((x) => ({ ...x, area: h })); } catch (e) { toast(e.message); } finally { setLocating(false); } }}>{locating ? '📍 …' : '📍 Mein Standort'}</button>
        {areas.filter((a) => a !== f.area).slice(0, 8).map((a) => <button key={a} type="button" className="chip soft small-chip" onClick={() => setF({ ...f, area: a })}>{a}</button>)}
      </div>
      {f.name.trim() && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="pill" href={mapsSearch(f.name, f.area, s?.profile?.city)} target="_blank" rel="noreferrer">🔍 In Google Maps suchen ↗</a>
          <button type="button" className="pill" disabled={finding || !getAi().apiKey} onClick={findIt}>{finding ? 'Ich suche …' : '✨ KI sucht Adresse & Telefon'}</button>
        </div>
      )}
      {hits && (
        <div className="take-box" style={{ gap: 6 }}>
          {hits.treffer?.length ? <span className="tiny">Antippen zum Übernehmen:</span> : <span className="tiny">{hits.hinweis || 'Nichts gefunden – über Google Maps suchen.'}</span>}
          {(hits.treffer || []).map((h, i) => (
            <button key={i} type="button" className="option" style={{ textAlign: 'left', width: '100%' }} onClick={() => { setF({ ...f, name: f.name || h.name, address: h.adresse || f.address, phone: h.telefon || f.phone, url: h.website || f.url }); setHits(null); toast('Übernommen – bitte kurz prüfen'); }}>
              <span className="row-main">
                <span style={{ fontWeight: 600, fontSize: 15 }}>{h.name}</span>
                <span className="tiny">{[h.adresse, h.telefon, h.info].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="field">
        <span>Kategorie</span>
        {catOpen || !cat ? (
          <div className="chips">{cats.map((c) => <button key={c.id} type="button" className={f.cat === c.id ? 'chip on' : 'chip soft'} onClick={() => { setF({ ...f, cat: c.id, sub: '' }); setCatOpen(false); }}>{c.emoji} {c.label}</button>)}</div>
        ) : (
          <div className="chips" style={{ alignItems: 'center' }}>
            <span className="chip on">{cat.emoji} {cat.label}{f.sub ? ` · ${f.sub}` : ''}</span>
            <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => setCatOpen(true)}>✎ ändern</button>
          </div>
        )}
      </div>
      {cat && (catOpen || !f.sub) && (
        <div className="field">
          <span>Genauer (optional)</span>
          <div className="chips">
            {cat.subs.map((x) => <button key={x} type="button" className={f.sub === x ? 'chip on' : 'chip soft'} onClick={() => { setF({ ...f, sub: f.sub === x ? '' : x }); setNewSub(''); }}>{x}</button>)}
          </div>
          <input className="input" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Eigene Unterkategorie, z.B. Verdulería" aria-label="Eigene Unterkategorie" />
        </div>
      )}
      <Field label="Adresse"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Straße Nr., Viertel, Stadt" /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}><Field label="Telefon"><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+54 11 …" /></Field></div>
        <div style={{ flex: 1, minWidth: 0 }}><Field label="Link"><input className="input" inputMode="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Website, Instagram" /></Field></div>
      </div>
      <div className="field">
        <span>Status</span>
        <div className="chips">{BOOK_STATUS.map((x) => <button key={x.id} type="button" className={f.status === x.id ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, status: f.status === x.id ? '' : x.id })}>{x.id === 'war' ? '✓ ' : '☆ '}{x.label}</button>)}</div>
      </div>
      <div className="field">
        <span>Bewertung</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Stars value={f.rating} onChange={(v) => setF({ ...f, rating: v })} />
          <button type="button" className={f.fav ? 'chip on' : 'chip soft'} onClick={() => setF({ ...f, fav: !f.fav })}>{f.fav ? '♥ Favorit' : '♡ Favorit'}</button>
        </div>
      </div>
      <Field label="Notiz"><textarea className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Öffnungszeiten, was gut ist, Preise …" /></Field>
      {!isNew && (
        <div className="chips">
          <a className="pill" href={bookMaps(f)} target="_blank" rel="noreferrer">📍 Google Maps ↗</a>
          {f.phone && <a className="pill" href={`tel:${telOf(f.phone)}`}>📞 Anrufen</a>}
          {f.url && <a className="pill" href={f.url} target="_blank" rel="noreferrer">🔗 Link ↗</a>}
        </div>
      )}
      <button type="button" className="btn" onClick={save} disabled={!f.name.trim()}>Speichern</button>
      {!isNew && <button type="button" className="btn danger" onClick={() => { if (confirm(`„${item.name}“ löschen?`)) { removeBookItem(book, item.id); onClose(); } }}>Löschen</button>}
    </Sheet>
  );
}

export default function PlaceBook({ s, book, hint }) {
  const cats = bookCats(s, book);
  const items = bookOf(s, book).items;
  const [cat, setCat] = useState('alle');
  const [sub, setSub] = useState('');
  const [edit, setEdit] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [sheet, setSheet] = useState(null);
  const [st, setSt] = useState('alle');
  const [minR, setMinR] = useState(0);
  const [favOnly, setFavOnly] = useState(false);
  const [filt, setFilt] = useState(false);
  const nFilt = (minR ? 1 : 0) + (favOnly ? 1 : 0);
  const cur = cats.find((c) => c.id === cat);
  const list = items.filter((x) => (cat === 'alle' || x.cat === cat) && (!sub || x.sub === sub) && (st === 'alle' || x.status === st) && (!minR || (x.rating || 0) >= minR) && (!favOnly || x.fav)).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name));
  const catOf = (id) => cats.find((c) => c.id === id);
  return (
    <>
      <div className="box-tabs">
        <button type="button" className={cat === 'alle' ? 'chip on' : 'chip soft'} onClick={() => { setCat('alle'); setSub(''); }}>Alle</button>
        {cats.map((c) => { const n = items.filter((x) => x.cat === c.id).length; return <button key={c.id} type="button" className={cat === c.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => { setCat(c.id); setSub(''); }}>{c.emoji} {c.label}{n ? ` · ${n}` : ''}</button>; })}
        <button type="button" className={edit ? 'chip on' : 'chip soft'} onClick={() => setEdit(!edit)} aria-label="Kategorien bearbeiten">{edit ? 'Fertig' : '✎'}</button>
      </div>
      {edit && (
        <section className="card" style={{ gap: 8 }}>
          <span className="label" style={{ padding: 0 }}>Kategorien</span>
          <div className="chips">{cats.map((c) => <button key={c.id} type="button" className="chip soft" onClick={() => confirm(`Kategorie „${c.label}“ entfernen? Gespeicherte Orte bleiben.`) && removeBookCat(book, c.id)}>{c.emoji} {c.label} ✕</button>)}</div>
          <form className="block-add" onSubmit={(e) => { e.preventDefault(); const id = addBookCat(book, newCat); if (id) setCat(id); setNewCat(''); }}>
            <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Neue Kategorie" aria-label="Neue Kategorie" />
            <button type="submit" className="btn small" disabled={!newCat.trim()}>+</button>
          </form>
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => restoreBookCats(book)}>Entfernte Standard-Kategorien zurückholen</button>
        </section>
      )}
      {cur?.subs?.length > 0 && (
        <div className="chips">
          <button type="button" className={!sub ? 'chip on' : 'chip soft'} style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => setSub('')}>Alle</button>
          {cur.subs.map((x) => <button key={x} type="button" className={sub === x ? 'chip on' : 'chip soft'} style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => setSub(sub === x ? '' : x)}>{x}</button>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {BOOK_STATUS.map((x) => <button key={x.id} type="button" className={st === x.id ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setSt(st === x.id ? 'alle' : x.id)}>{x.id === 'war' ? '✓ ' : '☆ '}{x.label}</button>)}
        <button type="button" className={nFilt ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setFilt(true)}>⚙︎ Filter{nFilt ? ` · ${nFilt}` : ''}</button>
      </div>
      <Sheet open={filt} title="Filter" onClose={() => setFilt(false)}>
        <div className="field">
          <span>Bewertung</span>
          <div className="chips">
            {[{ v: 0, l: 'Alle' }, { v: 3, l: '★ 3+' }, { v: 4, l: '★ 4+' }, { v: 5, l: '★ 5' }].map((x) => <button key={x.v} type="button" className={minR === x.v ? 'chip on' : 'chip soft'} onClick={() => setMinR(x.v)}>{x.l}</button>)}
          </div>
        </div>
        <div className="field">
          <span>Favoriten</span>
          <div className="chips">
            <button type="button" className={!favOnly ? 'chip on' : 'chip soft'} onClick={() => setFavOnly(false)}>Alle</button>
            <button type="button" className={favOnly ? 'chip on' : 'chip soft'} onClick={() => setFavOnly(true)}>♥ Nur Favoriten</button>
          </div>
        </div>
        {nFilt > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { setMinR(0); setFavOnly(false); }}>✕ Filter zurücksetzen</button>}
        <button type="button" className="btn" onClick={() => setFilt(false)}>Fertig</button>
      </Sheet>
      <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setSheet({ cat: cat === 'alle' ? cats[0]?.id : cat, sub, status: st === 'alle' ? '' : st, fav: favOnly })}>+ Ort{cur ? ` (${cur.label}${sub ? ` · ${sub}` : ''})` : ''}</button>
      <div className="list">
        {list.length === 0 && <div className="empty">{items.length && (st !== 'alle' || minR || favOnly) ? 'Keine Orte mit diesem Filter.' : hint || 'Noch keine Orte – oben „+ Ort“.'}</div>}
        {list.map((x) => (
          <div key={x.id} className="row compact">
            <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, color: 'inherit', font: 'inherit' }} onClick={() => setSheet(x)}>
              <span className="row-title plain">{x.fav ? '♥ ' : ''}{x.name}</span>
              <span className="row-meta">{[x.rating ? `${'★'.repeat(x.rating)}` : '', x.status === 'will' ? 'Will hin' : '', cat === 'alle' && catOf(x.cat) ? `${catOf(x.cat).emoji} ${catOf(x.cat).label}` : '', x.sub, x.address || x.area].filter(Boolean).join(' · ')}</span>
            </button>
            {x.phone && <a className="x-btn" href={`tel:${telOf(x.phone)}`} aria-label={`${x.name} anrufen`}>📞</a>}
            <a className="x-btn" href={bookMaps(x)} target="_blank" rel="noreferrer" aria-label={`${x.name} in Google Maps`}><Icon name="pin" size={15} color="var(--accent)" /></a>
          </div>
        ))}
      </div>
      <ItemSheet s={s} book={book} cats={cats} item={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
