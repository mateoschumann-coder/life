// v1.14 (Mateo): auf die wichtigsten 6 pro Teil beschränkt
// v1.08 (Mateo): Zentrale Stelle – jede Aktion mit einem Tipp direkt auf der richtigen Seite (Knopf in der Mitte der Tab-Leiste)
import { go } from '../lib/router';
import { useState } from 'react';
import { Icon, Sheet, TabBar, toast, TopActions } from '../components/ui';
import { store, useStore } from '../lib/store';
import SortGrid, { SortDone, startEditing, useEditing } from '../components/SortGrid';

const ls = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ss = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
// Erfassen mit vorgewählter Art

// v1.18 (Mateo): alle drei Teile auf einer Seite, je 6, nichts doppelt
// v1.24 (Mateo): pro Teil ein größerer Katalog – angezeigt werden immer genau 6, austauschbar über „✎ Anpassen“
const A = (e, l, run) => ({ key: l.replace(/­/g, ''), e, l, run });
export const ACTIONS = [
  { id: 'eintragen', title: '✍️ Eintragen', items: [
    A('🩺', 'Termin', () => { ss('life-open-new-termin', '1'); ss('life-vorsorge-view', 'termine'); go('/vorsorge'); }),
    A('🛒', 'Einkauf', () => { ls('life-app-kueche-tab', 'einkauf'); go('/kueche'); }),
    A('🎉', 'Veranstal­tung', () => { ls('life-app-sozial-tab', 'eigene'); ls('life-app-veranst-view', 'plan'); ss('life-open-new-event', '1'); go('/treffen'); }),
    A('💌', 'Einladung', () => { ls('life-app-sozial-tab', 'andere'); ss('life-open-new-invite', '1'); go('/treffen'); }),
    A('📍', 'Ort', () => { ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'mine'); ss('life-open-new-place', '1'); go('/ausgehen'); }),
    A('🏃', 'Rennen', () => { ls('life-app-sport-tab', 'meine'); ss('life-open-new-sport', '1'); go('/sport'); }),
    A('✅', 'Aufgabe', () => window.dispatchEvent(new Event('life-quick-task'))),
    A('👤', 'Person', () => go('/person/neu')),
    A('💡', 'Veranstal­tungs-Idee', () => { ls('life-app-sozial-tab', 'eigene'); ls('life-app-veranst-view', 'idee'); ss('life-open-new-event', '1'); go('/treffen'); }),
    A('📖', 'Buch', () => { ss('life-open-new-material', '1'); go('/wissen/buch'); }),
    A('🎧', 'Podcast', () => { ss('life-open-new-material', '1'); go('/wissen/podcast'); }),
    A('🎬', 'Video', () => { ss('life-open-new-material', '1'); go('/wissen/video'); }),
    A('💼', 'Bewerbung', () => go('/karriere')),
    A('🎯', 'Skill-Ziel', () => go('/skills')),
    A('🔔', 'Erinnerung', () => { ls('life-app-zuhause-allgemein', 'erinnern'); go('/zuhause/allgemein'); }),
    A('💸', 'Fixkosten', () => { ls('life-app-fin-tab', 'rechner'); ls('life-app-fin-calc', 'alltag'); go('/finanzen'); }),
    A('🧳', 'Reise-Idee', () => { ls('life-app-reisen-tab', 'ideen'); ls('life-app-reisen-ideen', 'ideen'); ss('life-open-new-trip', 'idee'); go('/reisen'); }),
    A('📝', 'Notiz', () => { ss('life-erfassen-type', 'notiz'); go('/erfassen'); }),
  ] },
  { id: 'finden', title: '🔍 Finden', items: [
    A('🎶', 'Events', () => { ls('life-app-ausgehen-tab', 'events'); ls('life-app-events-view', 'find'); go('/ausgehen'); }),
    A('🍸', 'Neue Orte', () => { ls('life-app-ausgehen-tab', 'orte'); ls('life-app-places-view', 'find'); go('/ausgehen'); }),
    A('🏅', 'Lauf-Events', () => { ls('life-app-sport-tab', 'finden'); go('/sport'); }),
    A('🌍', 'Reiseziel', () => { ls('life-app-reisen-tab', 'ideen'); ls('life-app-reisen-ideen', 'suche'); go('/reisen'); }),
    A('🍳', 'Rezept', () => { ls('life-app-kueche-tab', 'rezepte'); ls('life-app-rezepte-sub', 'neu'); go('/kueche'); }),
    A('💼', 'Jobs', () => go('/karriere')),
    A('🩺', 'Arzt / Praxis', () => { ss('life-vorsorge-view', 'orte'); ls('life-vorsorge-orte', 'finden'); go('/vorsorge'); }),
    A('🛋', 'Einrichtung', () => { ls('life-app-zuhause-einrichtung', 'finden'); go('/zuhause/einrichtung'); }),
    A('👕', 'Kleidung', () => { ls('life-app-zuhause-kleidung', 'finden'); go('/zuhause/kleidung'); }),
    A('🗞', 'Nachrichten', () => go('/news')),
    A('📚', 'Lernen', () => go('/wissen')),
  ] },
  { id: 'planen', title: '🗺 Planen', items: [
    A('✈️', 'Reise', () => { ls('life-app-reisen-tab', 'reisen'); ss('life-open-new-trip', 'geplant'); go('/reisen'); }),
    A('📞', 'Bei wem melden?', () => { ls('life-app-people-tab', 'kontakt'); ls('life-app-people-part', 'melden'); go('/menschen'); }),
    A('🎓', 'Weiter­entwicklung', () => go('/skills')),
    A('🚀', 'Projekt', () => go('/karriere/projekte')),
    A('🧮', 'Finanzen', () => { ls('life-app-fin-tab', 'rechner'); go('/finanzen'); }),
    A('🏠', 'Haushalt', () => go('/zuhause/allgemein')),
    A('🎉', 'Veranstal­tung', () => { ls('life-app-sozial-tab', 'eigene'); go('/treffen'); }),
    A('🛒', 'Einkaufs­liste', () => { ls('life-app-kueche-tab', 'einkauf'); go('/kueche'); }),
    A('💼', 'Jobsuche', () => go('/karriere')),
    A('🎸', 'Hobbys', () => go('/hobbys')),
    A('⏱', 'Zeitrechner', () => { ls('life-app-sport-tab', 'rechner'); go('/sport'); }),
    A('🧳', 'Reise-Ideen', () => { ls('life-app-reisen-tab', 'ideen'); ls('life-app-reisen-ideen', 'ideen'); go('/reisen'); }),
    A('🧠', 'Rentenrechner', () => { ls('life-app-fin-tab', 'rechner'); ls('life-app-fin-calc', 'rente'); go('/finanzen'); }),
  ] },
];
const shownOf = (s, g) => {
  const sel = (s.profile?.losSel?.[g.id] || []).filter((k) => g.items.some((x) => x.key === k));
  for (const x of g.items) { if (sel.length >= 6) break; if (!sel.includes(x.key)) sel.push(x.key); }
  return sel.slice(0, 6).map((k) => g.items.find((x) => x.key === k));
};
const swap = (s, g, oldKey, newKey) => store.update((d) => {
  const sel = shownOf(s, g).map((x) => x.key).map((k) => (k === oldKey ? newKey : k));
  const ord = (d.profile?.order?.[`los-${g.id}`] || []).map((k) => (k === oldKey ? newKey : k));
  d.profile = { ...d.profile, losSel: { ...(d.profile?.losSel || {}), [g.id]: sel }, order: { ...(d.profile?.order || {}), [`los-${g.id}`]: ord } };
});

// Zwischenablage lesen → Erfassen mit „KI sortiert ein“ (bei Links liest die KI die Seite)
export async function pasteAndSort() {
  let txt = '';
  try { txt = (await navigator.clipboard.readText()) || ''; } catch {}
  try {
    if (!txt.trim()) { const l = JSON.parse(localStorage.getItem('life-app-lastlinks') || '[]'); txt = (Array.isArray(l) ? l[0]?.url || l[0] : '') || ''; }
  } catch {}
  try { sessionStorage.setItem('life-erfassen-text', txt.trim()); sessionStorage.setItem('life-erfassen-auto', txt.trim() ? '1' : ''); } catch {}
  if (!txt.trim()) toast('Zwischenablage leer – füg den Link ins Feld ein');
  go('/erfassen');
}

export default function Aktionen() {
  const s = useStore();
  const editing = useEditing();
  const [pick, setPick] = useState(null); // { g, item }
  return (
    <>
      <main className="screen" style={{ gap: 14 }}>
        <div className="top"><h1 className="h1 sm">Was möchtest du tun?</h1><TopActions /></div>
        {/* v1.29 (Mateo): Kopierten Link/Text mit einem Tipp eintragen – KI erkennt, was es ist */}
        {!editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={pasteAndSort}>📋 Kopiertes eintragen</button>
            <button type="button" className="btn tint" style={{ flex: 1 }} onClick={() => go('/erfassen')}>🎙 Erzählen</button>
          </div>
        )}
        {!editing && <button type="button" className="link-btn" style={{ alignSelf: 'flex-end', fontSize: 14, marginTop: -4 }} onClick={startEditing}>✎ Anpassen</button>}
        {ACTIONS.map((g) => (
          <section key={g.id} className="group act-group">
            <h2 className="label" style={{ padding: '0 4px' }}>{g.title}</h2>
            <SortGrid
              s={s}
              orderKey={`los-${g.id}`}
              className="act-grid3"
              tileClass="act-tile"
              items={shownOf(s, g)}
              onOpen={(x) => x.run()}
              onEditTap={(x) => setPick({ g, item: x })}
              render={(x) => (<>{editing && <span className="act-swap" aria-hidden="true">⇄</span>}<span className="act-emoji">{x.e}</span><span lang="de">{x.l}</span></>)}
            />
          </section>
        ))}
      </main>
      <Sheet open={!!pick} title={pick ? `„${pick.item.key}“ austauschen gegen …` : ''} onClose={() => setPick(null)}>
        {pick && (() => {
          const shown = shownOf(s, pick.g).map((x) => x.key);
          const rest = pick.g.items.filter((x) => !shown.includes(x.key));
          return (
            <div className="act-grid3">
              {rest.map((x) => (
                <button key={x.key} type="button" className="act-tile" onClick={() => { swap(s, pick.g, pick.item.key, x.key); setPick(null); toast(`${x.key} statt ${pick.item.key}`); }}>
                  <span className="act-emoji">{x.e}</span><span lang="de">{x.l}</span>
                </button>
              ))}
            </div>
          );
        })()}
      </Sheet>
      <SortDone hidden={!!pick} hint="Ziehen = verschieben · Antippen = austauschen" />
      <TabBar active="los" />
    </>
  );
}
