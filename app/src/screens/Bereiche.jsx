// Bereiche: die drei Säulen mit ihren Lebensbereichen – direkt antippbar, ohne Ampel/Aktivität (Mateo, v0.34)
import { useStore } from '../lib/store';
import { AreaIcon, Chevron, Dot, TabBar } from '../components/ui';
import { DIRECT } from './Bereich';

const SOZIAL = [
  { id: 'events', name: 'Events (eigene & Einladungen)', icon: 'sparkle', href: '#/saeule/sozial' },
  { id: 'menschen', name: 'Menschen', icon: 'users', href: '#/menschen' },
  { id: 'ausgehen', name: 'Ausgehen', icon: 'calendar', href: '#/ausgehen' },
];

export default function Bereiche() {
  const s = useStore();
  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Bereiche</h1>
        </div>
        {s.pillars.map((p) => {
          const rows = p.id === 'sozial' ? SOZIAL : s.areas.filter((a) => a.pillarId === p.id).map((a) => ({ id: a.id, name: a.name, icon: a.icon, href: DIRECT[a.id] || `#/bereich/${a.id}` }));
          return (
            <section key={p.id} className="group">
              <a href={`#/saeule/${p.id}`} className="sec-h" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={p.color} /><span className="h2" style={{ fontSize: 20 }}>{p.name}</span></span>
                <Chevron />
              </a>
              <div className="list" style={{ background: `color-mix(in srgb, ${p.color} 6%, var(--card))` }}>
                {rows.map((r) => (
                  <a key={r.id} href={r.href} className="row" style={{ minHeight: 54 }}>
                    <AreaIcon icon={r.icon} color={p.color} size={30} />
                    <span className="row-main"><span className="row-title strong">{r.name}</span></span>
                    <Chevron />
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
