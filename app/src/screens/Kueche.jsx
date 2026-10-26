import { useState } from 'react';
import { useStore } from '../lib/store';
import {
  addRecipe, addShopping, clearBought, deleteRecipe, findRecipes, kitchenChat, removeShopping, setRecipeCats, shoppingSuggestions, toggleShopping, updateRecipe,
} from '../lib/health';
import { getAi } from '../lib/ai';
import { chatOf, saveChatOf } from '../lib/chats';
import PlanChat from '../components/PlanChat';
import { listen } from '../components/Coach';
import { Back, Check, Field, Icon, Segmented, Sheet, TabBar, toast } from '../components/ui';

const TAB_KEY = 'life-app-kueche-tab';
const COLOR = '#2FA36B';

function RecipeSheet({ s, recipe, onClose }) {
  const [edit, setEdit] = useState(false);
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
                  <button type="button" className="x-btn" aria-label={`${x} auf die Einkaufsliste`} onClick={() => { addShopping(x); toast('Auf der Einkaufsliste'); }}><Icon name="cart" size={16} color="var(--accent)" /></button>
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="btn sec" onClick={() => { const n = addShopping(r.ingredients || []); toast(`${n} Zutaten auf der Einkaufsliste`); }}>Alle Zutaten auf die Einkaufsliste</button>
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
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const list = s.recipes.filter((r) => !cat || r.category === cat);
  const ideas = cat === 'Airfryer' || !cat ? ['Airfryer Hähnchen', 'Airfryer Gemüse', 'Airfryer Fisch', 'Proteinreich nach dem Lauf'] : [`${cat}: schnelle Ideen`, `${cat}: vegetarisch`];
  const search = async (query, web = false) => {
    if (!query.trim() || busy) return;
    setBusy(web ? 'web' : 'ki');
    setErr(null);
    try {
      setResults(await findRecipes(s, query.trim(), cat || (/airfryer/i.test(query) ? 'Airfryer' : s.recipeCats[0]), { web }));
      setQ('');
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="chips">
        <button type="button" className={!cat ? 'chip on' : 'chip'} onClick={() => setCat(null)}>Alle</button>
        {s.recipeCats.map((c) => (
          <button key={c} type="button" className={editCats ? 'chip editing' : cat === c ? 'chip on' : 'chip'} onClick={() => (editCats ? setRecipeCats(s.recipeCats.filter((x) => x !== c)) : setCat(c))}>
            {c}{editCats && <Icon name="x" size={11} />}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setEditCats(!editCats)} aria-label="Kategorien bearbeiten">{editCats ? 'Fertig' : <Icon name="edit" size={14} />}</button>
      </div>
      {editCats && (
        <form className="block-add" onSubmit={(e) => { e.preventDefault(); const t = catText.trim(); if (t && !s.recipeCats.includes(t)) setRecipeCats([...s.recipeCats, t]); setCatText(''); }}>
          <input className="input" value={catText} onChange={(e) => setCatText(e.target.value)} placeholder="Neue Kategorie, z.B. Frühstück" aria-label="Neue Kategorie" />
          <button type="submit" className="btn small" disabled={!catText.trim()}>+</button>
        </form>
      )}

      <div className="sec-h" style={{ padding: '0 4px' }}>
        <h2 className="h2" style={{ fontSize: 19 }}>Meine Rezepte</h2>
        <button type="button" className="link-btn" onClick={() => setNewOpen(true)}>+ Rezept</button>
      </div>
      <div className="list">
        {list.length === 0 && <div className="empty">Noch keine Rezepte{cat ? ` in „${cat}“` : ''}. Lass dir unten welche vorschlagen oder füg eigene hinzu.</div>}
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

      <section className="card" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Neue Rezepte finden</span>
        <form onSubmit={(e) => { e.preventDefault(); search(q); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z.B. Airfryer Süßkartoffel" aria-label="Rezept suchen" />
          <div className="search-row">
            <button type="submit" className="btn tint small" style={{ flex: 1 }} disabled={!q.trim() || !!busy || !hasKey}>{busy === 'ki' ? '…' : 'Ohne Internet'}</button>
            <button type="button" className="btn small" style={{ flex: 1 }} disabled={!q.trim() || !!busy || !hasKey} onClick={() => search(q, true)}>{busy === 'web' ? '…' : '🔍 Mit Internet'}</button>
          </div>
        </form>
        <div className="chips">{ideas.map((c) => <button key={c} type="button" className="chip soft" disabled={!!busy || !hasKey} onClick={() => search(c)}>{c}</button>)}</div>
        <span className="tiny">Ohne Internet: Rezepte aus dem KI-Wissen (sehr günstig). Mit Internet: echte Rezepte von Webseiten mit Link (ca. 1–2 Cent). Die Vorschläge oben laufen ohne Internet.</span>
        {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busy === 'web' ? 'Ich suche Rezepte im Internet … (ca. 20 Sek.)' : 'Ich überlege Rezepte … (ca. 10 Sek.)'}</span></div>}
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
        {!busy && results && results.map((r) => (
          <button key={r.id} type="button" className="option" style={{ alignItems: 'center', textAlign: 'left', border: 0, width: '100%', font: 'inherit', color: 'inherit' }} onClick={() => setSheet(r)}>
            <span className="row-main">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{r.title}</span>
              <span className="tiny">{[r.minutes && `${r.minutes} Min`, `${r.ingredients.length} Zutaten`, r.why].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="pill on">Ansehen</span>
          </button>
        ))}
      </section>
      <RecipeSheet s={s} recipe={sheet || (newOpen ? 'neu' : null)} onClose={() => { setSheet(null); setNewOpen(false); }} />
    </>
  );
}

function Shopping({ s }) {
  const [text, setText] = useState('');
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
      <div className="list">
        {open.length === 0 && <div className="empty">Die Liste ist leer.</div>}
        {open.map((x) => (
          <div key={x.id} className="row" style={{ minHeight: 48 }}>
            <Check on={false} color={COLOR} onClick={() => toggleShopping(x.id)} label={`${x.name} gekauft`} />
            <span className="row-main"><span className="row-title plain">{x.name}</span></span>
            <button type="button" className="x-btn" aria-label={`${x.name} entfernen`} onClick={() => removeShopping(x.id)}><Icon name="x" size={12} color="var(--chev)" /></button>
          </div>
        ))}
        {done.map((x) => (
          <div key={x.id} className="row" style={{ minHeight: 44 }}>
            <Check on color={COLOR} onClick={() => toggleShopping(x.id)} label={`${x.name} wieder offen`} />
            <span className="row-main"><span className="row-title plain done">{x.name}</span></span>
          </div>
        ))}
      </div>
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
        <Segmented full options={[{ id: 'rezepte', label: 'Rezepte' }, { id: 'einkauf', label: `Einkaufsliste${openCount ? ` (${openCount})` : ''}` }]} value={tab} onChange={choose} label="Ansicht" />
        {tab === 'rezepte' ? <Recipes s={s} /> : <Shopping s={s} />}
        <PlanChat
          title="Küchen-Chat"
          intro="Sag mir, worauf du Lust hast oder was noch im Kühlschrank ist – ich schlage Rezepte vor und ergänze die Einkaufsliste."
          history={chatOf(s, 'kueche')}
          onSave={(h) => saveChatOf('kueche', h)}
          onAsk={(hist, o) => kitchenChat(s, hist, o)}
          prefKey="kueche"
          groups={KITCHEN_GROUPS}
          onApply={(sel) => {
            for (const r of sel.rezepte || []) addRecipe({ title: r.titel, category: s.recipeCats[0] || 'Airfryer', ingredients: r.zutaten || [], steps: r.schritte || '', url: /^https?:\/\//.test(r.url || '') ? r.url : '', minutes: r.minuten || null });
            if (sel.einkaufen?.length) addShopping(sel.einkaufen);
          }}
          chips={['Was koche ich heute?', 'Wochenplan mit Einkaufsliste', 'Proteinreich nach dem Lauf', 'Resteverwertung']}
        />
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
