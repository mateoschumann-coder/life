// v1.35 (Mateo, Punkt 4): Lupe oben auf jeder Seite → findet alles, was in Life gespeichert ist (ohne KI, kostenlos).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, store } from '../lib/store';
import { go } from '../lib/router';
import { fmtShort } from '../lib/dates';
import { Info, Sheet } from './ui';
import MicBtn from './MicBtn';

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ls = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ss = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
const short = (d) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? fmtShort(d.slice(0, 10)) : '');
const meta = (...x) => x.filter(Boolean).join(' · ');

// Jede Gruppe: Einträge mit Titel, Zusatztext zum Durchsuchen, Unterzeile, Sprung
function groups(s) {
  const G = [];
  const add = (key, label, items) => G.push({ key, label, items: items.filter((x) => x.title) });
  add('people', '👤 Personen', (s.people || []).map((p) => ({ title: p.name, extra: [p.notes, p.phone], sub: meta(p.category && { familie: 'Familie', freunde: 'Freunde', neu: 'Neue Kontakte', beruflich: 'Beruflich' }[p.category]), open: () => go(`/person/${p.id}`) })));
  add('tasks', '✅ Aufgaben', (s.tasks || []).filter((t) => !t.done).map((t) => ({ title: t.title, extra: [t.notes], sub: meta(t.due ? short(t.due) : 'ohne Datum', t.time), open: () => (t.personId ? go(`/person/${t.personId}`) : t.projectId ? go(`/projekt/${t.projectId}`) : (ls('life-app-heute-view', 'todos'), go('/heute'))) })));
  add('events', '🎶 Events (Ausgehen)', (s.events || []).map((e) => ({ title: e.name, extra: [e.place, e.note, e.city], sub: meta(short(e.date), e.place), open: () => { ls('life-app-ausgehen-tab', 'events'); ls('life-app-events-view', 'mine'); ls('life-app-events-stage', e.stage === 'zugesagt' ? 'zugesagt' : 'interessiert'); go('/ausgehen'); } })));
  add('gatherings', '🎉 Treffen', (s.gatherings || []).map((g) => ({ title: g.name, extra: [g.place, g.motto, g.address], sub: meta(g.idea ? 'Idee' : '', short(g.date), g.place), open: () => go(`/treffen/${g.id}`) })));
  add('invites', '💌 Einladungen', (s.invites || []).map((v) => ({ title: v.name, extra: [v.host, v.place, v.note], sub: meta(v.host && `von ${v.host}`, short(v.date)), open: () => { ls('life-app-sozial-tab', 'andere'); go('/treffen'); } })));
  add('places', '📍 Orte (Ausgehen)', (s.places || []).map((p) => ({ title: p.name, extra: [p.address, p.note, p.hood, p.subcat, p.city, ...(p.tags || [])], sub: meta(p.subcat || p.category, p.hood, p.city), open: () => { ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'mine'); ss('life-place-q', p.name); if (p.city) store.update((d) => { d.profile = { ...(d.profile || {}), city: p.city }; }); go('/ausgehen'); } })));
  const books = { vorsorge: ['🩺 Praxen & Gesundheits-Orte', () => { ss('life-vorsorge-view', 'orte'); ls('life-vorsorge-orte', 'meine'); go('/vorsorge'); }], kueche: ['🛒 Geschäfte (Küche)', () => { ls('life-app-kueche-tab', 'orte'); go('/kueche'); }], einrichtung: ['🛋 Geschäfte (Einrichtung)', () => { ls('life-app-zuhause-einrichtung', 'orte'); go('/zuhause/einrichtung'); }], kleidung: ['👕 Geschäfte (Kleidung)', () => { ls('life-app-zuhause-kleidung', 'orte'); go('/zuhause/kleidung'); }] };
  for (const [b, [label, open]] of Object.entries(books)) add(`book-${b}`, label, (s.placeBook?.[b]?.items || []).map((x) => ({ title: x.name, extra: [x.address, x.area, x.note, x.sub], sub: meta(x.sub, x.area || x.address), open })));
  add('health', '🩺 Termine', (s.healthItems || []).filter((h) => h.status !== 'erledigt').map((h) => ({ title: h.title, extra: [h.notes, h.address], sub: meta(short(h.date), h.time && `${h.time} Uhr`), open: () => { ss('life-vorsorge-view', h.type === 'routine' ? 'routine' : 'termine'); go('/vorsorge'); } })));
  add('sport', '🏃 Sport-Events', (s.sportEvents || []).map((e) => ({ title: e.name, extra: [e.place, e.note], sub: meta(short(e.date), e.place, e.dist), open: () => { ls('life-app-sport-tab', 'meine'); go('/sport'); } })));
  add('recipes', '🍳 Rezepte', (s.recipes || []).map((r) => ({ title: r.title, extra: [...(r.ingredients || []), r.note], sub: r.category || '', open: () => { ls('life-app-kueche-tab', 'rezepte'); ls('life-app-rezepte-sub', 'meine'); go('/kueche'); } })));
  const shop = s.shopping || {};
  add('shop', '🛒 Einkauf', [...(shop.items || []).filter((x) => !x.done).map((x) => ({ title: x.name, sub: `auf „${shop.listName || 'Einkaufsliste'}“`, open: () => { ls('life-app-kueche-tab', 'einkauf'); go('/kueche'); } })), ...(shop.lists || []).map((l) => ({ title: l.name, extra: (l.items || []).map((x) => x.name), sub: `Einkaufsliste · ${(l.items || []).length} Artikel`, open: () => { ls('life-app-kueche-tab', 'einkauf'); go('/kueche'); } }))]);
  add('library', '📚 Bibliothek', (s.library || []).map((m) => ({ title: m.title, extra: [m.author, m.about, ...(m.notes || []).map((n) => n.text || n)], sub: meta(m.author, m.kind), open: () => go(`/wissen/${m.kind || 'buch'}`) })));
  add('skills', '🎯 Weiterentwicklung', (s.skills || []).map((k) => ({ title: k.name, extra: (k.todos || []).map((t) => t.title || t.text), sub: 'Skill', open: () => go(`/skills/${k.id}`) })));
  add('hobbies', '🎸 Hobbys', (s.hobbies || []).map((h) => ({ title: h.name, extra: (h.todos || []).map((t) => t.title || t.text), sub: 'Hobby', open: () => go(`/hobbys/${h.id}`) })));
  add('jobs', '💼 Stellen', (s.jobs || []).map((j) => ({ title: j.title, extra: [j.company, j.location, j.notes], sub: meta(j.company, j.stage), open: () => go(`/karriere/job/${j.id}`) })));
  add('trips', '🧳 Reisen & Ideen', (s.trips || []).map((t) => ({ title: t.name, extra: [t.dest, t.region, t.group, t.info, ...(t.stops || []).map((x) => x.name)], sub: meta(t.status === 'idee' ? 'Idee' : 'Reise', t.dest !== t.name && t.dest, short(t.start)), open: () => go(`/reisen/${t.id}`) })));
  add('projects', '📁 Projekte', (s.projects || []).filter((p) => !p.archived).map((p) => ({ title: p.name, extra: [p.goal, p.notes], sub: 'Projekt', open: () => go(`/projekt/${p.id}`) })));
  add('side', '🚀 Eigene Projekte', (s.sideProjects || []).map((p) => ({ title: p.name, extra: [p.goal], sub: p.status || '', open: () => go(`/karriere/projekt/${p.id}`) })));
  add('reminders', '🔔 Erinnerungen', (s.reminders || []).map((r) => ({ title: r.title, extra: [r.note], sub: meta(r.every, short(r.next || r.due)), open: () => { ls('life-app-zuhause-allgemein', 'erinnern'); go('/zuhause/allgemein'); } })));
  for (const [k, label] of [['haushalt', '🏠 Haushalt'], ['einrichtung', '🛋 Einrichtung'], ['kleidung', '👕 Kleidung']]) add(`home-${k}`, label, (s.home?.[k]?.items || []).filter((x) => !x.done).map((x) => ({ title: x.title || x.name, extra: [x.note, x.cat], sub: x.cat || '', open: () => { if (k === 'haushalt') { ls('life-app-zuhause-allgemein', 'todos'); go('/zuhause/allgemein'); } else { ls(`life-app-zuhause-${k}`, 'liste'); go(`/zuhause/${k}`); } } })));
  add('sources', '🗞 Quellen', (s.newsSources || []).map((q) => ({ title: q.name, extra: [q.note, q.url, q.type], sub: q.type || '', open: () => go('/news') })));
  add('memory', '🧠 Was Life über dich weiß', (s.memory || []).map((m) => ({ title: m.text || m.fakt || m, sub: '', open: () => go('/gedaechtnis') })));
  return G;
}

function score(x, words) {
  const t = norm(x.title);
  const hay = norm([x.title, x.sub, ...(x.extra || [])].join(' '));
  if (!words.every((w) => hay.includes(w))) return 0;
  const q = words.join(' ');
  return t.startsWith(q) ? 4 : t.includes(q) ? 3 : words.every((w) => t.includes(w)) ? 2 : 1;
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
  const all = useMemo(() => (open ? groups(s) : []), [s, open]);
  const words = norm(q).split(/\s+/).filter(Boolean);
  const res = words.length ? all.map((g) => ({ ...g, hits: g.items.map((x) => [x, score(x, words)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([x]) => x) })).filter((g) => g.hits.length).sort((a, b) => Math.max(...b.hits.map((x) => score(x, words))) - Math.max(...a.hits.map((x) => score(x, words)))) : [];
  const total = res.reduce((n, g) => n + g.hits.length, 0);
  const jump = (f) => { const h = location.hash; setOpen(false); setTimeout(() => { f(); setTimeout(() => { if (location.hash === h) window.dispatchEvent(new Event('life-remount')); }, 30); }, 0); };
  const pick = (x) => jump(x.open);
  return (
    <Sheet open={open} title="Suchen" onClose={() => setOpen(false)}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <MicBtn value={q} onChange={setQ} />
        <input ref={ref} className="input" type="search" style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Ort, Rezept, Aufgabe …" aria-label="In Life suchen" />
        <Info>Sucht in allem, was du gespeichert hast: Personen, Aufgaben, Events, Orte, Rezepte, Termine, Reisen, Stellen … – kostenlos, ohne KI.</Info>
      </div>
      {words.length > 0 && <span className="tiny" style={{ padding: '0 4px' }}>{total ? `${total} Treffer` : 'Nichts gefunden.'}</span>}
      {res.map((g) => {
        const list = more[g.key] ? g.hits : g.hits.slice(0, 5);
        return (
          <section key={g.key} className="group" style={{ gap: 4 }}>
            <h2 className="label" style={{ padding: '0 4px' }}>{g.label} · {g.hits.length}</h2>
            <div className="list">
              {list.map((x, i) => (
                <button key={i} type="button" className="row compact gs-row" onClick={() => pick(x)}>
                  <span className="row-main"><span className="row-title plain">{x.title}</span>{x.sub && <span className="row-meta">{x.sub}</span>}</span>
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
