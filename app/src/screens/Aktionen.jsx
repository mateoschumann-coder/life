// v1.14 (Mateo): auf die wichtigsten 6 pro Teil beschränkt
// v1.08 (Mateo): Zentrale Stelle – jede Aktion mit einem Tipp direkt auf der richtigen Seite (Knopf in der Mitte der Tab-Leiste)
import { go } from '../lib/router';
import { Icon, TabBar } from '../components/ui';

const ls = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ss = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
// Erfassen mit vorgewählter Art

// v1.18 (Mateo): alle drei Teile auf einer Seite, je 6, nichts doppelt
export const ACTIONS = [
  { id: 'eintragen', title: '✍️ Eintragen', items: [
    ['✅', 'Aufgabe', () => { ss('life-focus-task', '1'); go('/heute'); }],
    ['🛒', 'Einkauf', () => { ls('life-app-kueche-tab', 'einkauf'); go('/kueche'); }],
    ['🎉', 'Veranstal­tung', () => { ls('life-app-sozial-tab', 'eigene'); ss('life-open-new-event', '1'); go('/treffen'); }],
    ['💌', 'Einladung', () => { ls('life-app-sozial-tab', 'andere'); ss('life-open-new-invite', '1'); go('/treffen'); }],
    ['📍', 'Ort', () => { ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'mine'); ss('life-open-new-place', '1'); go('/ausgehen'); }],
    ['🏃', 'Rennen', () => { ls('life-app-sport-tab', 'meine'); ss('life-open-new-sport', '1'); go('/sport'); }],
  ] },
  { id: 'finden', title: '🔍 Finden', items: [
    ['🎶', 'Events', () => { ls('life-app-ausgehen-tab', 'events'); ls('life-app-events-view', 'find'); go('/ausgehen'); }],
    ['🍸', 'Neue Orte', () => { ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'find'); go('/ausgehen'); }],
    ['🏅', 'Lauf-Events', () => { ls('life-app-sport-tab', 'finden'); go('/sport'); }],
    ['🌍', 'Reiseziel', () => { ls('life-app-reisen-tab', 'ideen'); ls('life-app-reisen-ideen', 'suche'); go('/reisen'); }],
    ['🍳', 'Rezept', () => { ls('life-app-kueche-tab', 'rezepte'); ls('life-app-rezepte-sub', 'neu'); go('/kueche'); }],
    ['💼', 'Jobs', () => go('/karriere')],
  ] },
  { id: 'planen', title: '🗺 Planen', items: [
    ['✈️', 'Reise', () => { ls('life-app-reisen-tab', 'reisen'); ss('life-open-new-trip', 'geplant'); go('/reisen'); }],
    ['📞', 'Bei wem melden?', () => { ls('life-app-people-tab', 'kontakt'); ls('life-app-people-part', 'melden'); go('/menschen'); }],
    ['🎓', 'Weiter­entwicklung', () => go('/skills')],
    ['🚀', 'Projekt', () => go('/karriere/projekte')],
    ['🧮', 'Finanzen', () => { ls('life-app-fin-tab', 'rechner'); go('/finanzen'); }],
    ['🏠', 'Haushalt', () => go('/zuhause/allgemein')],
  ] },
];

export default function Aktionen() {
  return (
    <>
      <main className="screen" style={{ gap: 14 }}>
        <div className="top"><h1 className="h1 sm">Was möchtest du tun?</h1><a href="#/einstellungen" className="icon-btn" aria-label="Einstellungen"><Icon name="gear" size={20} width={1.8} /></a></div>
        {ACTIONS.map((g) => (
          <section key={g.id} className="group act-group">
            <h2 className="label" style={{ padding: '0 4px' }}>{g.title}</h2>
            <div className="act-grid3">
              {g.items.map(([e, l, run]) => (
                <button key={l} type="button" className="act-tile" onClick={run}><span className="act-emoji">{e}</span><span lang="de">{l}</span></button>
              ))}
            </div>
          </section>
        ))}
      </main>
      <TabBar active="los" />
    </>
  );
}
