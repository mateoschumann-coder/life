// v1.08 (Mateo): Zentrale Stelle – jede Aktion mit einem Tipp direkt auf der richtigen Seite (Knopf in der Mitte der Tab-Leiste)
import { useState } from 'react';
import { go } from '../lib/router';
import { Segmented, TabBar } from '../components/ui';

const ls = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ss = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
// Erfassen mit vorgewählter Art
const capture = (type) => () => { ss('life-erfassen-type', type); go('/erfassen'); };

export const ACTIONS = [
  { id: 'eintragen', title: '✍️ Eintragen', hint: 'Schnell etwas festhalten', items: [
    ['✅', 'Aufgabe', capture('aufgabe')],
    ['💡', 'Idee', capture('idee')],
    ['🛒', 'Einkauf', capture('einkauf')],
    ['📍', 'Ort (Bar, Restaurant …)', capture('ort')],
    ['👤', 'Person', () => go('/person/neu')],
    ['🎉', 'Eigenes Event', () => { ss('life-open-new-event', '1'); go('/treffen'); }],
    ['💌', 'Einladung von anderen', () => { ls('life-app-sozial-tab', 'andere'); ss('life-open-new-invite', '1'); go('/treffen'); }],
    ['🏃', 'Sport-Event / Rennen', capture('sport')],
    ['🩺', 'Arzttermin', () => { ss('life-vorsorge-view', 'finden'); go('/vorsorge'); }],
    ['💼', 'Bewerbung', capture('bewerbung')],
    ['📚', 'Buch, Podcast, Video …', capture('lernen')],
    ['🎯', 'Skill-Ziel', capture('skill')],
    ['🔔', 'Erinnerung', capture('erinnerung')],
    ['💸', 'Fixkosten', capture('fixkosten')],
    ['🔗', 'Notiz / Link', capture('notiz')],
  ] },
  { id: 'finden', title: '🔍 Finden & Suchen', hint: 'Direkt zur passenden Suche', items: [
    ['🎶', 'Event suchen', () => { ls('life-app-ausgehen-tab', 'events'); ls('life-app-events-view', 'find'); go('/ausgehen'); }],
    ['🍸', 'Neue Orte finden', () => { ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'find'); go('/ausgehen'); }],
    ['🏃', 'Lauf- / Sport-Event suchen', () => { ls('life-app-sport-tab', 'finden'); go('/sport'); }],
    ['🌍', 'Reiseziel finden', () => { ls('life-app-reisen-tab', 'ideen'); ls('life-app-reisen-ideen', 'suche'); go('/reisen'); }],
    ['🍳', 'Rezept finden', () => { ls('life-app-kueche-tab', 'rezepte'); ls('life-app-rezepte-sub', 'neu'); go('/kueche'); }],
    ['🩺', 'Arzt / Praxis finden', () => { ss('life-vorsorge-view', 'finden'); go('/vorsorge'); }],
    ['🛋', 'Einrichtung finden', () => { ls('life-app-zuhause-einrichtung', 'finden'); go('/zuhause/einrichtung'); }],
    ['👕', 'Kleidung finden', () => { ls('life-app-zuhause-kleidung', 'finden'); go('/zuhause/kleidung'); }],
    ['💼', 'Job finden', () => go('/karriere')],
    ['🗞', 'Nachrichten lesen', () => go('/news')],
    ['📚', 'Etwas zum Lernen finden', () => go('/wissen')],
  ] },
  { id: 'planen', title: '🗺 Planen & Organisieren', hint: 'Größere Vorhaben', items: [
    ['✈️', 'Reise planen', () => { ls('life-app-reisen-tab', 'reisen'); ss('life-open-new-trip', 'geplant'); go('/reisen'); }],
    ['🧭', 'Reise-Idee anlegen', () => { ls('life-app-reisen-tab', 'ideen'); ls('life-app-reisen-ideen', 'ideen'); ss('life-open-new-trip', 'idee'); go('/reisen'); }],
    ['🎉', 'Event organisieren', () => { ss('life-open-new-event', '1'); go('/treffen'); }],
    ['🛒', 'Einkaufsliste', () => { ls('life-app-kueche-tab', 'einkauf'); go('/kueche'); }],
    ['📞', 'Bei wem melden?', () => { ls('life-app-people-tab', 'kontakt'); ls('life-app-people-part', 'melden'); go('/menschen'); }],
    ['💼', 'Jobsuche', () => go('/karriere')],
    ['🚀', 'Eigenes Projekt', () => go('/karriere/projekte')],
    ['🎓', 'Weiterentwicklung', () => go('/skills')],
    ['🎸', 'Hobbys', () => go('/hobbys')],
    ['🧮', 'Finanzen rechnen', () => { ls('life-app-fin-tab', 'rechner'); go('/finanzen'); }],
    ['⏱', 'Lauf-Zeitrechner', () => { ls('life-app-sport-tab', 'rechner'); go('/sport'); }],
    ['🏠', 'Haushalt', () => go('/zuhause/allgemein')],
  ] },
];

export default function Aktionen() {
  const [q, setQ] = useState('');
  const [part, setPartS] = useState(() => { try { return localStorage.getItem('life-app-aktionen-tab') || 'eintragen'; } catch { return 'eintragen'; } });
  const setPart = (v) => { setPartS(v); try { localStorage.setItem('life-app-aktionen-tab', v); } catch {} };
  const n = q.trim().toLowerCase();
  // Mit Suchbegriff: Treffer aus allen drei Teilen, sonst nur der gewählte Teil
  const groups = ACTIONS.filter((g) => n || g.id === part).map((g) => ({ ...g, items: g.items.filter(([, l]) => !n || l.toLowerCase().includes(n)) })).filter((g) => g.items.length);
  return (
    <>
      <main className="screen">
        <h1 className="h1">Was möchtest du tun?</h1>
        <Segmented full options={[{ id: 'eintragen', label: '✍️ Eintragen' }, { id: 'finden', label: '🔍 Finden' }, { id: 'planen', label: '🗺 Planen' }]} value={part} onChange={(v) => { setPart(v); setQ(''); }} label="Bereich" />
        <input className="input small-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Alle Aktionen durchsuchen …" aria-label="Aktion suchen" />
        {groups.map((g) => (
          <section key={g.id} className="group act-group">
            {n ? <div className="act-head"><h2 className="label" style={{ padding: 0 }}>{g.title}</h2></div> : <span className="tiny" style={{ padding: '0 4px' }}>{g.hint}</span>}
            <div className="act-grid">
              {g.items.map(([e, l, run]) => (
                <button key={l} type="button" className="act-btn" onClick={run}><span className="act-emoji">{e}</span><span>{l}</span></button>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <div className="empty">Nichts gefunden – anders formulieren?</div>}
      </main>
      <TabBar active="los" />
    </>
  );
}
