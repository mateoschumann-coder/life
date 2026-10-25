import { useStore } from '../lib/store';
import { today } from '../lib/dates';
import { allAreaStatuses, byUrgency, LEVEL_COLOR, LEVEL_WORD } from '../lib/logic';
import { AreaIcon, Chevron, Dot, TabBar } from '../components/ui';

export default function Bereiche() {
  const s = useStore();
  const t = today();
  const statuses = allAreaStatuses(s, t);

  return (
    <>
      <main className="screen">
        <div className="top">
          <h1 className="h1">Bereiche</h1>
        </div>
        {s.pillars.map((p) => {
          const mine = statuses.filter((x) => x.area.pillarId === p.id);
          const counts = ['gruen', 'gelb', 'rot', 'grau'].map((l) => ({ l, n: mine.filter((x) => x.status.level === l).length })).filter((c) => c.n);
          const summary = counts.map((c) => `${c.n} ${LEVEL_WORD[c.l]}`).join(' · ');
          const top = [...mine].sort(byUrgency).slice(0, 2);
          return (
            <a key={p.id} href={`#/saeule/${p.id}`} className="pillar-card">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Dot color={p.color} />
                <span style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{p.name}</span>
                <span className="sub">{mine.length} Bereiche</span>
                <Chevron />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="statusbar" aria-label={`Status: ${summary}`} role="img">
                  {counts.map((c) => <span key={c.l} style={{ flex: `${c.n} 1 0`, background: LEVEL_COLOR[c.l] }} />)}
                </span>
                <span className="tiny">{summary}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                {top.map(({ area, status }) => (
                  <span key={area.id} className="mini-row">
                    <AreaIcon icon={area.icon} color={p.color} size={24} />
                    <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{area.name}</span>
                    <span className="tiny" style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}><Dot small level={status.level} />{status.text}</span>
                  </span>
                ))}
              </span>
            </a>
          );
        })}
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
