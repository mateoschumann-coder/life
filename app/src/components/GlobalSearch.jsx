// v1.35 (Mateo, Punkt 4): Lupe oben auf jeder Seite → findet alles, was in Life gespeichert ist (ohne KI, kostenlos).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store } from '../lib/store';
import { go } from '../lib/router';
import { runSearch } from '../lib/search';
import { Info, Sheet } from './ui';
import MicBtn from './MicBtn';

const ls = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ss = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
const ALL_KEY = 'life-app-search-all';
// Ziel eines Treffers ausführen (Merk-Schlüssel setzen, ggf. Stadt wechseln, dann springen)
function openTarget(to) {
  Object.entries(to.ls || {}).forEach(([k, v]) => ls(k, v));
  Object.entries(to.ss || {}).forEach(([k, v]) => ss(k, v));
  if (to.city && to.city !== store.get().profile?.city) store.update((d) => { d.profile = { ...(d.profile || {}), city: to.city }; });
  go(to.route);
}

// Wenn nichts gefunden: gleich weitersuchen bzw. anlegen
const FALLBACKS = [
  ['🎶 Event suchen', (q) => { ss('life-search-q', q); ls('life-app-ausgehen-tab', 'events'); ls('life-app-events-view', 'find'); go('/ausgehen'); }],
  ['📍 Neue Orte', (q) => { ss('life-search-q', q); ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'find'); go('/ausgehen'); }],
  ['🍳 Rezept', (q) => { ss('life-search-q', q); ls('life-app-kueche-tab', 'rezepte'); ls('life-app-rezepte-sub', 'neu'); go('/kueche'); }],
  ['🏅 Lauf-Event', (q) => { ss('life-search-q', q); ls('life-app-sport-tab', 'finden'); go('/sport'); }],
];

export default function GlobalSearch() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [more, setMore] = useState({});
  const ref = useRef(null);
  useEffect(() => {
    const h = () => { setQ(''); setMore({}); setOpen(true); setTimeout(() => ref.current?.focus(), 250); };
    const hc = () => setOpen(false);
    window.addEventListener('life-search', h);
    window.addEventListener('hashchange', hc);
    return () => { window.removeEventListener('life-search', h); window.removeEventListener('hashchange', hc); };
  }, []);
  const [all, setAll] = useState(() => { try { return localStorage.getItem(ALL_KEY) === '1'; } catch { return false; } });
  const toggleAll = () => { setAll(!all); ls(ALL_KEY, all ? '0' : '1'); };
  const words = q.trim().split(/\s+/).filter(Boolean);
  const res = useMemo(() => (open ? runSearch(s, q, { all }) : []), [s, open, q, all]);
  const total = res.reduce((n, g) => n + g.hits.length, 0);
  const jump = (f) => { const h = location.hash; setOpen(false); setTimeout(() => { f(); setTimeout(() => { if (location.hash === h) window.dispatchEvent(new Event('life-remount')); }, 30); }, 0); };
  const pick = (x) => jump(() => openTarget(x.to));
  return (
    <Sheet open={open} title="Suchen" onClose={() => setOpen(false)}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <MicBtn value={q} onChange={setQ} />
        <input ref={ref} className="input" type="search" style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Ort, Rezept, Aufgabe …" aria-label="In Life suchen" />
        <Info>Sucht in allem, was du gespeichert hast: Personen, Aufgaben, Events, Orte, Rezepte, Termine, Reisen, Stellen, Zuhause … – kostenlos, ohne KI. „Auch Erledigtes & Archiv“ durchsucht zusätzlich Erledigtes, Archiviertes und Rausgenommenes.</Info>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <span className="tiny" style={{ flex: 1 }}>{words.length > 0 ? (total ? `${total} Treffer` : all ? 'Nichts gefunden – auch nicht im Erledigten.' : 'Nichts gefunden.') : ''}</span>
        <button type="button" className={all ? 'chip on small-chip' : 'chip soft small-chip'} onClick={toggleAll} aria-pressed={all}>{all ? '✓ ' : ''}Auch Erledigtes & Archiv</button>
      </div>
      {res.map((g) => {
        const list = more[g.key] ? g.hits : g.hits.slice(0, 5);
        return (
          <section key={g.key} className="group" style={{ gap: 4 }}>
            <h2 className="label" style={{ padding: '0 4px' }}>{g.label} · {g.hits.length}</h2>
            <div className="list">
              {list.map((x, i) => (
                <button key={i} type="button" className="row compact gs-row" onClick={() => pick(x)}>
                  <span className="row-main"><span className="row-title plain" style={x.old ? { color: 'var(--muted)' } : undefined}>{x.title}</span>{x.sub && <span className="row-meta">{x.sub}</span>}</span>
                  <span className="chev" aria-hidden="true">›</span>
                </button>
              ))}
              {g.hits.length > 5 && !more[g.key] && <button type="button" className="link-btn" style={{ fontSize: 13, padding: 8 }} onClick={() => setMore({ ...more, [g.key]: true })}>Alle {g.hits.length} zeigen</button>}
            </div>
          </section>
        );
      })}
      {words.length > 0 && (
        <section className="group" style={{ gap: 6 }}>
          <h2 className="label" style={{ padding: '0 4px' }}>{total ? 'Oder weiter' : 'Stattdessen'}</h2>
          <div className="chips">
            <button type="button" className="chip soft small-chip" onClick={() => { setOpen(false); setTimeout(() => window.dispatchEvent(new CustomEvent('life-quick-task', { detail: { title: q.trim() } })), 50); }}>＋ Als Aufgabe</button>
            {FALLBACKS.map(([l, f]) => <button key={l} type="button" className="chip soft small-chip" onClick={() => jump(() => f(q.trim()))}>{l}</button>)}
          </div>
        </section>
      )}
    </Sheet>
  );
}
