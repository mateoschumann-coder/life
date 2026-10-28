import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import {
  addRecipe, addShopping, clearBought, deleteRecipe, importRecipe, kitchenChat, stripQty, removeShopping, setRecipeCats, shopCats, shopStructure, shopEdit, shopCatalog, addCatalogItem, shopCatOf, setShoppingCat, shoppingSuggestions, toggleShopping, updateRecipe,
} from '../lib/health';
import { getAi } from '../lib/ai';
import PlaceBook from '../components/PlaceBook';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import SourceLinks, { ModeToggle, useSearchMode } from '../components/SourceLinks';
import { listen } from '../components/Coach';
import { Back, Check, Field, Icon, Segmented, Sheet, TabBar, toast, Info } from '../components/ui';

const TAB_KEY = 'life-app-kueche-tab';
const COLOR = '#2FA36B';

function RecipeSheet({ s, recipe, onClose }) {
  const [edit, setEdit] = useState(false);
  const [noQty, setNoQty] = useState(true);
  const blank = { title: '', category: s.recipeCats[0] || 'Airfryer', ingredients: '', steps: '', url: '', minutes: '' };
  const [f, setF] = useState(blank);
  const isNew = recipe === 'neu';
  const r = !isNew && recipe ? s.recipes.find((x) => x.id === recipe.id) || recipe : null;
  const startEdit = () => {
    setF(r ? { ...r, ingredients: (r.ingredients || []).join('\n'), minutes: r.minutes || '' } : blank);
    setEdit(true);
  };
  const save = () => {
    const data = { title: f.title, category: f.category, ingredients: f.ingredients.split('\n').map((x) => x.trim()).filter(Boolean), steps: f.steps, url: f.url, minutes: Number(f.minutes) || null };
    if (r && !r.temp) updateRecipe(r.id, data);
    else addRecipe(data);
    toast('Rezept gespeichert');
    setEdit(false);
    onClose();
  };
  const open = !!recipe;
  const editing = edit || isNew;
  return (
    <Sheet open={open} title={editing ? (r ? 'Rezept bearbeiten' : 'Neues Rezept') : r?.title} onClose={() => { setEdit(false); setF(blank); onClose(); }}>
      {editing ? (
        <>
          <Field label="Titel"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="z.B. Knusprige Hähnchenschenkel" /></Field>
          <div className="field">
            <span>Kategorie</span>
            <div className="chips">{s.recipeCats.map((c) => <button key={c} type="button" className={f.category === c ? 'chip on' : 'chip'} onClick={() => setF({ ...f, category: c })}>{c}</button>)}</div>
          </div>
          <Field label="Zutaten (eine pro Zeile)"><textarea className="input" style={{ minHeight: 110 }} value={f.ingredients} onChange={(e) => setF({ ...f, ingredients: e.target.value })} placeholder={'4 Hähnchenschenkel\n1 TL Paprika\nSalz, Pfeffer'} /></Field>
          <Field label="Zubereitung"><textarea className="input" style={{ minHeight: 110 }} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} placeholder="1. Würzen  2. Airfryer 200 °C, 20 Min …" /></Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Minuten"><input className="input" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></Field>
            <Field label="Link (optional)"><input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
          </div>
          <button type="button" className="btn" onClick={save} disabled={!f.title.trim()}>Speichern</button>
        </>
      ) : r ? (
        <>
          <span className="tiny">{[r.category, r.minutes && `${r.minutes} Min`].filter(Boolean).join(' · ')}</span>
          {r.why && <span className="sub">{r.why}</span>}
          <div className="field">
            <span>Zutaten</span>
            <div className="list">
              {(r.ingredients || []).map((x, i) => (
                <div key={i} className="row" style={{ minHeight: 44 }}>
                  <span className="row-main"><span className="row-title plain" style={{ fontSize: 16 }}>{x}</span></span>
                  <button type="button" className="x-btn" aria-label={`${x} auf die Einkaufsliste`} onClick={() => { addShopping(noQty ? stripQty(x) || x : x); toast('Auf der Einkaufsliste'); }}><Icon name="cart" size={16} color="var(--accent)" /></button>
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="btn" onClick={() => { const n = addShopping((r.ingredients || []).map((x) => (noQty ? stripQty(x) || x : x))); toast(n ? `${n} Zutaten auf der Einkaufsliste` : 'Steht schon alles auf der Liste'); }}><Icon name="cart" size={16} color="currentColor" /> Zutaten zum Einkauf</button>
          <label className="web-toggle"><input type="checkbox" checked={noQty} onChange={(e) => setNoQty(e.target.checked)} /><span>Ohne Mengen übernehmen <span className="tiny">(z.B. „Mehl“ statt „200 g Mehl“)</span></span></label>
          {r.steps && <div className="field"><span>Zubereitung</span><p className="recipe-steps">{r.steps}</p></div>}
          {r.url && <a className="link-btn" href={r.url} target="_blank" rel="noreferrer">Original öffnen</a>}
          {r.temp ? (
            <button type="button" className="btn" onClick={() => { addRecipe(r); toast('Rezept gespeichert'); onClose(); }}>In meine Rezepte speichern</button>
          ) : (
            <div className="btn-row">
              <button type="button" className="btn sec" onClick={startEdit}>Bearbeiten</button>
              <button type="button" className="btn danger" onClick={() => { if (confirm('Rezept löschen?')) { deleteRecipe(r.id); onClose(); } }}>Löschen</button>
            </div>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

function Recipes({ s }) {
  const [cat, setCat] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editCats, setEditCats] = useState(false);
  const [catText, setCatText] = useState('');
  const [imp, setImp] = useState(null); // { text, cat } – Rezept aus dem Internet einfügen
  const [impBusy, setImpBusy] = useState(false);
  const runImport = async () => {
    setImpBusy(true);
    try {
      const r = await importRecipe(s, imp.text, imp.cat);
      setImp(null);
      setSheet(r);
    } catch (e) {
      toast(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setImpBusy(false);
    }
  };
  const hasKey = !!getAi().apiKey;
  const list = s.recipes.filter((r) => !cat || r.category === cat);
  return (
    <>
      <div className="chips">
        <button type="button" className={!cat ? 'chip on' : 'chip'} onClick={() => setCat(null)}>Alle</button>
        {s.recipeCats.map((c) => (
          <button key={c} type="button" className={editCats ? 'chip editing' : cat === c ? 'chip on' : 'chip'} onClick={() => (editCats ? setRecipeCats(s.recipeCats.filter((x) => x !== c)) : setCat(c))}>
            {c}{editCats && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className={editCats ? 'chip on' : 'chip'} onClick={() => setEditCats(!editCats)} aria-label="Kategorien bearbeiten">{editCats ? 'Fertig' : <Icon name="edit" size={14} />}</button>
      </div>
      {editCats && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = catText.trim(); if (t && !s.recipeCats.includes(t)) setRecipeCats([...s.recipeCats, t]); setCatText(''); }}>
          <input className="input" value={catText} onChange={(e) => setCatText(e.target.value)} placeholder="Neue Kategorie, z.B. Frühstück" aria-label="Neue Kategorie" />
          <button type="submit" className="btn small" disabled={!catText.trim()}>+</button>
        </form>
      )}

      <div className="sec-h" style={{ padding: '0 4px' }}>
        <h2 className="h2" style={{ fontSize: 19 }}>Meine Rezepte</h2>
        <span style={{ display: 'flex', gap: 14 }}>
          <button type="button" className="link-btn" onClick={() => setImp({ text: '', cat: cat || s.recipeCats[0] })}>📥 Übernehmen</button>
          <button type="button" className="link-btn" onClick={() => setNewOpen(true)}>+ Rezept</button>
        </span>
      </div>
      <div className="list">
        {list.length === 0 && <div className="empty">Noch keine Rezepte{cat ? ` in „${cat}“` : ''}. Unter „Neue Rezepte“ welche finden, diktier eins oder füg eigene hinzu.</div>}
        {list.map((r) => (
          <button key={r.id} type="button" className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => setSheet(r)}>
            <span className="block-icon" style={{ background: 'color-mix(in srgb, #2FA36B 14%, transparent)', color: COLOR }}><Icon name="pot" size={16} /></span>
            <span className="row-main">
              <span className="row-title plain">{r.title}</span>
              <span className="row-meta">{[r.category, r.minutes && `${r.minutes} Min`, `${(r.ingredients || []).length} Zutaten`].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        ))}
      </div>

      <Sheet open={!!imp} title="Rezept übernehmen" onClose={() => setImp(null)}>
        <span className="sub">Füg einen <b>Link</b> zu einer Rezeptseite ein oder den <b>Text</b> – z.B. die Beschreibung eines Instagram-Beitrags (dort bei der Beschreibung „mehr“ antippen, Text lange drücken → Kopieren). Die KI macht daraus ein sauberes Rezept.</span>
        <textarea className="input" style={{ minHeight: 160 }} value={imp?.text || ''} onChange={(e) => setImp({ ...imp, text: e.target.value })} placeholder="https://… oder Rezepttext / Instagram-Beschreibung" aria-label="Rezepttext oder Link" />
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setImp({ ...imp, text: t }); } catch { toast('Einfügen ging nicht – lange ins Feld tippen → Einsetzen'); } }}>📋 Aus der Zwischenablage einfügen</button>
        <div className="field"><span>Kategorie</span><div className="chips">{s.recipeCats.map((c) => <button key={c} type="button" className={imp?.cat === c ? 'chip on' : 'chip'} onClick={() => setImp({ ...imp, cat: c })}>{c}</button>)}</div></div>
        <button type="button" className="btn" onClick={runImport} disabled={impBusy || !imp?.text?.trim() || !hasKey}>{impBusy ? 'Ich lese das Rezept …' : '✨ Übernehmen'}</button>
        <Info>Text: unter 0,1 Cent. Link: die KI öffnet die Seite direkt (ca. 0,1–0,3 Cent). Instagram-Links kann sie nicht öffnen – dort den Text kopieren.</Info>
      </Sheet>
      <RecipeSheet s={s} recipe={sheet || (newOpen ? 'neu' : null)} onClose={() => { setSheet(null); setNewOpen(false); }} />
    </>
  );
}

const nrm = (x) => String(x || '').trim().toLowerCase();
// v0.88/0.89: Katalog nach Mateos Kategorien – Hauptkategorie wählen, Unterkategorie für Unterkategorie durchgehen,
// Artikel antippen = auf die Liste. „✎ Bearbeiten“: Haupt- und Unterkategorien umbenennen, verschieben, löschen, neu anlegen; Artikel entfernen.
function StructureSheet({ s, open, onClose }) {
  const st = shopStructure(s);
  const [newGroup, setNewGroup] = useState('');
  const [newCat, setNewCat] = useState({});
  const nameInput = (value, onSave, label, style) => <input className="input" defaultValue={value} key={value} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== value && onSave(e.target.value.trim())} aria-label={label} style={style} />;
  const emojiInput = (value, onSave) => <input className="input" defaultValue={value} key={value} onBlur={(e) => e.target.value.trim() !== value && onSave(e.target.value.trim())} aria-label="Symbol" data-noclear="" style={{ width: 38, flex: 'none', textAlign: 'center', padding: '6px 2px', minHeight: 38, fontSize: 17 }} />;
  return (
    <Sheet open={open} title="Kategorien bearbeiten" onClose={onClose}>
      <span className="tiny">Namen antippen zum Ändern. ↑↓ verschiebt, ✕ löscht. Artikel auf deiner Liste bleiben erhalten (landen sonst unter „Sonstiges“).</span>
      {st.groups.map((g, gi) => (
        <section key={g.id} className="card" style={{ gap: 8, padding: 12 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {emojiInput(g.emoji, (v) => shopEdit.updateGroup(g.id, { emoji: v }))}
            {nameInput(g.label, (v) => shopEdit.updateGroup(g.id, { label: v }), 'Hauptkategorie', { flex: 1, minWidth: 0, fontWeight: 650, padding: '8px 10px', minHeight: 42 })}
            <button type="button" className="mini-btn" disabled={gi === 0} onClick={() => shopEdit.moveGroup(g.id, -1)} aria-label="Nach oben">↑</button>
            <button type="button" className="mini-btn" disabled={gi === st.groups.length - 1} onClick={() => shopEdit.moveGroup(g.id, 1)} aria-label="Nach unten">↓</button>
            {st.groups.length > 1 && <button type="button" className="mini-btn" onClick={() => confirm(`„${g.label}“ mit allen Unterkategorien löschen?`) && shopEdit.removeGroup(g.id)} aria-label="Hauptkategorie löschen"><Icon name="x" size={12} color="var(--danger)" /></button>}
          </div>
          {st.cats.filter((c) => c.group === g.id).map((c, ci, arr) => (
            <div key={c.id} style={{ display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 8 }}>
              {emojiInput(c.emoji, (v) => shopEdit.updateCat(c.id, { emoji: v }))}
              {c.id === 'sonstiges' ? <span style={{ flex: 1, fontSize: 15 }}>{c.label}</span> : nameInput(c.label, (v) => shopEdit.updateCat(c.id, { label: v }), 'Unterkategorie', { flex: 1, minWidth: 0, fontSize: 15, padding: '7px 10px', minHeight: 38 })}
              <button type="button" className="mini-btn" disabled={ci === 0} onClick={() => shopEdit.moveCat(c.id, -1)} aria-label="Nach oben">↑</button>
              <button type="button" className="mini-btn" disabled={ci === arr.length - 1} onClick={() => shopEdit.moveCat(c.id, 1)} aria-label="Nach unten">↓</button>
              {c.id !== 'sonstiges' ? <button type="button" className="mini-btn" onClick={() => confirm(`Unterkategorie „${c.label}“ löschen?`) && shopEdit.removeCat(c.id)} aria-label="Unterkategorie löschen"><Icon name="x" size={11} color="var(--chev)" /></button> : <span className="mini-btn" />}
            </div>
          ))}
          <form className="block-add" style={{ paddingLeft: 14 }} onSubmit={(e) => { e.preventDefault(); shopEdit.addCat(g.id, newCat[g.id]); setNewCat({ ...newCat, [g.id]: '' }); }}>
            <input className="input" value={newCat[g.id] || ''} onChange={(e) => setNewCat({ ...newCat, [g.id]: e.target.value })} placeholder={`+ Unterkategorie in „${g.label}“`} aria-label={`Neue Unterkategorie in ${g.label}`} />
            <button type="submit" className="btn small" disabled={!(newCat[g.id] || '').trim()}>+</button>
          </form>
        </section>
      ))}
      <form className="block-add" onSubmit={(e) => { e.preventDefault(); shopEdit.addGroup(newGroup); setNewGroup(''); }}>
        <input className="input" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="+ Neue Hauptkategorie, z.B. Haustier" aria-label="Neue Hauptkategorie" />
        <button type="submit" className="btn small" disabled={!newGroup.trim()}>+</button>
      </form>
      <button type="button" className="btn" onClick={onClose}>Fertig</button>
      <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => confirm('Alle Kategorien und Katalog-Artikel auf den Standard zurücksetzen?') && shopEdit.reset()}>Auf Standard zurücksetzen</button>
    </Sheet>
  );
}

function ShopCatalog({ s }) {
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem('life-app-shopcat-open') !== '0'; } catch { return true; } });
  const setOpen = (v) => { setOpenState(v); try { localStorage.setItem('life-app-shopcat-open', v ? '1' : '0'); } catch {} };
  const st = shopStructure(s);
  const all = shopCats(s);
  const [catId, setCatId] = useState(all[0]?.id);
  const [own, setOwn] = useState('');
  const [edit, setEdit] = useState(false);
  const [structOpen, setStructOpen] = useState(false);
  const cur = all.find((c) => c.id === catId) || all[0];
  const cats = all.filter((c) => c.group === cur.group);
  const steps = all.filter((c) => c.id !== 'sonstiges');
  const next = steps[steps.findIndex((c) => c.id === cur.id) + 1];
  const onList = new Map(s.shopping.items.filter((x) => !x.done).map((x) => [nrm(x.name), x.id]));
  const list = shopCatalog(s, cur.id);
  const toggle = (name) => {
    const id = onList.get(nrm(name));
    if (id) removeShopping(id);
    else addShopping(name);
  };
  const countIn = (c) => (c.items || []).filter((x) => onList.has(nrm(x.name))).length;
  const groupCount = (g) => all.filter((c) => c.group === g.id).reduce((n, c) => n + countIn(c), 0);
  return (
    <section className="card" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', flex: 1, fontWeight: 650, fontSize: 15, color: 'var(--text)' }} onClick={() => setOpen(!open)} aria-expanded={open}>📋 Aus dem Katalog antippen</button>
        {open && <button type="button" className="pill" onClick={() => setStructOpen(true)}>✎ Bearbeiten</button>}
        <button type="button" className="link-btn" style={{ fontSize: 12.5 }} onClick={() => setOpen(!open)}>{open ? 'Einklappen' : 'Öffnen'}</button>
      </div>
      {open && (<>
        <div className="shop-groups">
          {st.groups.map((g) => {
            const first = all.find((c) => c.group === g.id);
            const n = groupCount(g);
            return (
              <button key={g.id} type="button" className={cur.group === g.id ? 'shop-group on' : 'shop-group'} onClick={() => first && setCatId(first.id)} disabled={!first}>
                <span className="sg-emoji">{g.emoji || '📦'}</span>
                <span className="sg-label">{g.label}</span>
                {n > 0 && <span className="sg-count">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="box-tabs">
          {cats.map((c) => { const n = countIn(c); return <button key={c.id} type="button" className={c.id === cur.id ? 'chip on' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} onClick={() => setCatId(c.id)}>{c.emoji} {c.label}{n ? ` · ${n}` : ''}</button>; })}
        </div>
        <div className="chips">
          {list.length === 0 && <span className="tiny">Noch keine Artikel – füg unten welche hinzu.</span>}
          {list.map((x) => {
            const on = onList.has(nrm(x.name));
            return (
              <button key={x.name} type="button" className={edit ? 'chip soft' : on ? 'chip on' : 'chip'} style={x.optional && !on && !edit ? { opacity: 0.7 } : undefined} onClick={() => (edit ? shopEdit.removeItem(cur.id, x.name) : toggle(x.name))} aria-pressed={on}>
                {!edit && on ? '✓ ' : ''}{x.name}{edit ? ' ✕' : ''}
              </button>
            );
          })}
        </div>
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); if (!own.trim()) return; addCatalogItem(cur.id, own); if (!edit) addShopping(own.trim()); setOwn(''); }}>
          <input className="input" value={own} onChange={(e) => setOwn(e.target.value)} placeholder={`Artikel in „${cur.label}“ ergänzen`} aria-label="Eigenen Katalog-Artikel hinzufügen" />
          <button type="submit" className="btn small" disabled={!own.trim()}>+</button>
        </form>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {list.length > 0 && <button type="button" className={edit ? 'pill on' : 'pill'} onClick={() => setEdit(!edit)}>{edit ? 'Fertig' : 'Artikel entfernen'}</button>}
          <span style={{ flex: 1 }} />
          {next && !edit && <button type="button" className="btn small sec" onClick={() => setCatId(next.id)}>Weiter: {next.emoji} {next.label} ›</button>}
        </div>
        <span className="tiny">{edit ? 'Antippen = Artikel aus dem Katalog entfernen.' : 'Antippen = auf die Liste (nochmal = wieder runter). Helle Artikel sind optional.'}</span>
      </>)}
      <StructureSheet s={s} open={structOpen} onClose={() => setStructOpen(false)} />
    </section>
  );
}

function Shopping({ s }) {
  const [text, setText] = useState('');
  const [move, setMove] = useState(null);
  const open = s.shopping.items.filter((x) => !x.done);
  const done = s.shopping.items.filter((x) => x.done);
  const sugg = shoppingSuggestions(s);
  const add = (e) => {
    e.preventDefault();
    addShopping(text.split(/,|\n/));
    setText('');
  };
  return (
    <>
      <form className="block-add" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. Eier, Haferflocken, Bananen" aria-label="Artikel hinzufügen" />
        <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
      </form>
      <button type="button" className="tell" style={{ alignSelf: 'flex-start' }} onClick={() => listen('Auf die Einkaufsliste: ')}>
        <Icon name="mic" size={16} /> Einkaufsliste einsprechen
      </button>
      <ShopCatalog s={s} />
      {open.length === 0 && <div className="list"><div className="empty">Die Liste ist leer.</div></div>}
      {shopCats(s).map((c) => {
        const items = open.filter((x) => shopCatOf(s, x) === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label" style={{ padding: '0 4px' }}>{c.emoji} {c.label} · {items.length}</span>
            <div className="list">
              {items.map((x) => (
                <div key={x.id} className="row" style={{ minHeight: 48 }}>
                  <Check on={false} color={COLOR} onClick={() => toggleShopping(x.id)} label={`${x.name} gekauft`} />
                  <button type="button" className="row-main" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => setMove(x)} aria-label={`${x.name}: Kategorie ändern`}><span className="row-title plain">{x.name}</span></button>
                  <button type="button" className="x-btn" aria-label={`${x.name} entfernen`} onClick={() => removeShopping(x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {done.length > 0 && (
        <div className="list">
          {done.map((x) => (
            <div key={x.id} className="row" style={{ minHeight: 44 }}>
              <Check on color={COLOR} onClick={() => toggleShopping(x.id)} label={`${x.name} wieder offen`} />
              <span className="row-main"><span className="row-title plain done">{x.name}</span></span>
            </div>
          ))}
        </div>
      )}
      {open.length > 0 && <Info>Artikel antippen = Kategorie ändern (merkt sich die App für das nächste Mal).</Info>}
      <Sheet open={!!move} title={move ? `„${move.name}“ einsortieren` : ''} onClose={() => setMove(null)}>
        {shopStructure(s).groups.map((g) => (
          <div key={g.id} className="field">
            <span>{g.emoji} {g.label}</span>
            <div className="chips">
              {shopCats(s).filter((c) => c.group === g.id).map((c) => <button key={c.id} type="button" className={move && shopCatOf(s, move) === c.id ? 'chip on' : 'chip'} onClick={() => { setShoppingCat(move.id, c.id); setMove(null); }}>{c.emoji} {c.label}</button>)}
            </div>
          </div>
        ))}
      </Sheet>
      {done.length > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={clearBought}>Gekauftes entfernen ({done.length})</button>}
      {sugg.length > 0 && (
        <section className="card" style={{ gap: 10 }}>
          <span className="label" style={{ padding: 0 }}>Schon mal gekauft – antippen zum Hinzufügen</span>
          <div className="chips">{sugg.map((h) => <button key={h.name} type="button" className="chip soft" onClick={() => addShopping(h.name)}>+ {h.name}</button>)}</div>
        </section>
      )}
    </>
  );
}

const KITCHEN_GROUPS = [
  { key: 'rezepte', label: 'Rezepte speichern', title: (x) => x.titel, meta: (x) => [x.minuten && `${x.minuten} Min`, (x.zutaten || []).length && `${x.zutaten.length} Zutaten`, x.warum].filter(Boolean).join(' · ') },
  { key: 'einkaufen', label: 'Auf die Einkaufsliste', title: (x) => x },
];

const MODES = {
  neu: { label: '🍳 Neues Rezept', intro: 'Worauf hast du Lust? Ich schlage Rezepte vor.', placeholder: 'z.B. Airfryer Hähnchen, proteinreich …', chips: ['Was koche ich heute?', 'Proteinreich nach dem Lauf', 'Schnelles Frühstück', 'Wochenplan + Einkauf'] },
  kuehlschrank: { label: '🧊 Aus dem Kühlschrank', intro: 'Oben antippen, was du da hast – oder hier schreiben.', placeholder: 'Was hast du noch da?', chips: [] },
  diktieren: { label: '🎙 Rezept diktieren', intro: 'Mikro antippen und dein Rezept erzählen – ich schreibe es sauber auf.', placeholder: 'Erzähl dein Rezept …', chips: [] },
};
const CUISINES = ['Argentinisch', 'Italienisch', 'Deutsch', 'Mediterran', 'Asiatisch', 'Mexikanisch', 'Indisch', 'Orientalisch'];

// v0.93 (Mateo): Zutaten wie im Einkaufs-Katalog nach Kategorien antippen + Ziel-Küche wählen
function FridgePicker({ s, onAsk, disabled }) {
  const cats = shopCats(s).filter((c) => c && c.group === 'essen');
  const [catId, setCatId] = useState(cats[0]?.id);
  const [sel, setSel] = useState([]);
  const [own, setOwn] = useState('');
  const [cuis, setCuis] = useState([]);
  const cur = cats.find((c) => c.id === catId) || cats[0];
  const items = cur ? shopCatalog(s, cur.id) : [];
  const clean = (n) => String(n).replace(/\s*\([^)]*\)/g, '').replace(/\?$/, '').trim();
  const tog = (n) => setSel(sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]);
  const inCat = (c) => shopCatalog(s, c.id).filter((x) => sel.includes(clean(x.name))).length;
  const ask = () => {
    const extra = own.split(/,|\n/).map((x) => x.trim()).filter(Boolean);
    const all = [...sel, ...extra];
    onAsk(`Ich habe da: ${all.join(', ')}.${cuis.length ? ` Küche: ${cuis.join(' oder ')}.` : ''} Was kann ich daraus kochen?`);
  };
  return (
    <section className="card" style={{ gap: 8, padding: '10px 12px' }}>
      <span style={{ fontWeight: 650, fontSize: 15 }}>Was hast du da?{sel.length ? ` · ${sel.length}` : ''}</span>
      <div className="box-tabs">
        {cats.map((c) => { const n = inCat(c); return <button key={c.id} type="button" className={cur?.id === c.id ? 'chip on small-chip' : 'chip soft small-chip'} style={{ whiteSpace: 'nowrap' }} onClick={() => setCatId(c.id)}>{c.emoji} {c.label}{n ? ` · ${n}` : ''}</button>; })}
      </div>
      <div className="chips">
        {items.map((x) => { const n = clean(x.name); return <button key={x.name} type="button" className={sel.includes(n) ? 'chip on small-chip' : 'chip small-chip'} onClick={() => tog(n)}>{n}</button>; })}
      </div>
      <input className="input" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Sonst noch? z.B. Reste vom Hähnchen" aria-label="Weitere Zutaten" />
      {sel.length > 0 && <span className="tiny">Gewählt: {sel.join(', ')} · <button type="button" className="link-btn" style={{ fontSize: 12, padding: 0 }} onClick={() => setSel([])}>leeren</button></span>}
      <span className="tiny" style={{ marginBottom: -2 }}>Welche Küche? (optional, mehrere möglich)</span>
      <div className="chips">
        {CUISINES.map((c) => <button key={c} type="button" className={cuis.includes(c) ? 'chip on small-chip' : 'chip soft small-chip'} onClick={() => setCuis(cuis.includes(c) ? cuis.filter((x) => x !== c) : [...cuis, c])}>{c}</button>)}
      </div>
      <button type="button" className="btn small" disabled={disabled || (!sel.length && !own.trim())} onClick={ask}>✨ Rezepte daraus</button>
    </section>
  );
}

// Neue Rezepte (v0.65): entweder kostenlose Links zu Rezeptseiten oder der KI-Küchen-Chat
function RecipeFinder({ s }) {
  const [mode, setMode] = useSearchMode('rezepte', 'ki');
  return (
    <>
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === 'links' ? <SourceLinks s={s} area="rezepte" instant /> : <KitchenChat s={s} />}
    </>
  );
}
function KitchenChat({ s }) {
  const [mode, setMode] = useState('neu');
  const [cat, setCat] = useState(s.recipeCats[0] || 'Airfryer');
  const sendRef = useRef(null);
  const m = MODES[mode];
  return (
    <>
      <div className="box-tabs">
        {Object.entries(MODES).map(([id, x]) => <button key={id} type="button" className={mode === id ? 'chip on small-chip' : 'chip soft small-chip'} style={{ whiteSpace: 'nowrap' }} onClick={() => setMode(id)}>{x.label}</button>)}
      </div>
      {mode === 'kuehlschrank' && <FridgePicker s={s} disabled={!getAi().apiKey} onAsk={(t) => sendRef.current?.(t)} />}
      <PlanChat
        key={mode}
        compact
        sendRef={sendRef}
        title="Küchen-Chat"
        intro={m.intro}
        placeholder={m.placeholder}
        history={chatOf(s, 'kueche')}
        onSave={(h) => saveChatOf('kueche', h)}
        onAsk={(hist, o) => kitchenChat(s, hist, { ...o, mode, cat })}
        prefKey="kueche"
        groups={KITCHEN_GROUPS}
        onApply={(sel) => {
          for (const r of sel.rezepte || []) addRecipe({ title: r.titel, category: cat, ingredients: r.zutaten || [], steps: r.schritte || '', url: /^https?:\/\//.test(r.url || '') ? r.url : '', minutes: r.minuten || null });
          if (sel.einkaufen?.length) addShopping(sel.einkaufen);
          if (sel.rezepte?.length) toast(`Gespeichert in „${cat}“`);
        }}
        chips={m.chips}
        extra={s.recipeCats.length > 1 ? (
          <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Rezepte speichern in
            <select className="input" style={{ width: 'auto', minHeight: 30, padding: '2px 8px', fontSize: 13 }} value={cat} onChange={(e) => setCat(e.target.value)}>{s.recipeCats.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
        ) : null}
      />
    </>
  );
}

// v0.93: Rezepte-Reiter mit Umschalter Meine / Neue Rezepte (statt untereinander)
function RecipesTab({ s }) {
  const [sub, setSubState] = useState(() => { try { return localStorage.getItem('life-app-rezepte-sub') || 'meine'; } catch { return 'meine'; } });
  const setSub = (v) => { setSubState(v); try { localStorage.setItem('life-app-rezepte-sub', v); } catch {} };
  return (
    <>
      <div className="seg-mini">
        <button type="button" className={sub === 'meine' ? 'chip on' : 'chip soft'} onClick={() => setSub('meine')}>📖 Meine Rezepte · {s.recipes.length}</button>
        <button type="button" className={sub === 'neu' ? 'chip on' : 'chip soft'} onClick={() => setSub('neu')}>✨ Neue Rezepte</button>
      </div>
      {sub === 'meine' ? <Recipes s={s} /> : <RecipeFinder s={s} />}
    </>
  );
}

export default function Kueche() {
  const s = useStore();
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) || 'rezepte';
    } catch {
      return 'rezepte';
    }
  });
  const choose = (v) => {
    setTab(v);
    try {
      localStorage.setItem(TAB_KEY, v);
    } catch {}
  };
  const openCount = s.shopping.items.filter((x) => !x.done).length;
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereich/koerper" label="Körperliche Gesundheit" />
          <h1 className="h1">Küche</h1>
        </div>
        <Segmented full options={[{ id: 'rezepte', label: 'Rezepte' }, { id: 'einkauf', label: `Einkauf${openCount ? ` (${openCount})` : ''}` }, { id: 'orte', label: 'Orte' }]} value={tab} onChange={choose} label="Ansicht" />
        {tab === 'rezepte' ? <RecipesTab s={s} /> : tab === 'orte' ? <PlaceBook s={s} book="kueche" hint="Deine Läden: Supermarkt, Metzgerei, Bäckerei, Verdulería … – oben „+ Ort“." /> : <Shopping s={s} />}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
