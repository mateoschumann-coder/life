// Bereiche: die drei Säulen mit ihren Lebensbereichen – direkt antippbar (Mateo, v0.34)
// v1.11: neues Aussehen – Kacheln (2 pro Zeile) mit Symbol, Name und kurzer Zeile, was drin ist; Logik/Links unverändert
import { useStore } from '../lib/store';
import { AreaIcon, Icon, TabBar } from '../components/ui';
import { DIRECT } from './Bereich';

const SOZIAL = [
  { id: 'events', name: 'Events', icon: 'sparkle', href: '#/saeule/sozial' },
  { id: 'menschen', name: 'Menschen', icon: 'users', href: '#/menschen' },
  { id: 'ausgehen', name: 'Ausgehen', icon: 'calendar', href: '#/ausgehen' },
];
const SUB = {
  koerper: 'Sport · Küche · Vorsorge',
  mental: 'Bücher · Podcasts · Videos',
  zuhause: 'Haushalt · Einrichtung · Kleidung',
  freizeit: 'Hobbys · Reisen',
  finanzen: 'Märkte · Rechner',
  events: 'Eigene & Einladungen',
  menschen: 'Kontakte · Geburtstage',
  ausgehen: 'Events · Lieblingsorte',
  karriere: 'Jobsuche · Eigene Projekte',
  entwicklung: 'Sprachen · Skills',
  informiert: 'Zeitungen · Quellen',
};

export default function Bereiche() {
  const s = useStore();
  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Bereiche</h1>
          <a href="#/einstellungen" className="icon-btn" aria-label="Einstellungen"><Icon name="gear" size={20} width={1.8} /></a>
        </div>
        {s.pillars.map((p) => {
          const rows = p.id === 'sozial' ? SOZIAL : s.areas.filter((a) => a.pillarId === p.id).map((a) => ({ id: a.id, name: a.name, icon: a.icon, href: DIRECT[a.id] || `#/bereich/${a.id}` }));
          return (
            <section key={p.id} className="pillar-sec" style={{ '--pc': p.color }}>
              <a href={`#/saeule/${p.id}`} className="pillar-head">
                <span className="pillar-bar" />
                <span className="pillar-name">{p.name}</span>
                <span className="pillar-count">{rows.length}</span>
              </a>
              <div className="area-grid">
                {rows.map((r) => (
                  <a key={r.id} href={r.href} className="area-tile">
                    <AreaIcon icon={r.icon} color={p.color} size={38} />
                    <span className="area-tile-name">{r.name}</span>
                    {SUB[r.id] && <span className="area-tile-sub">{SUB[r.id]}</span>}
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
