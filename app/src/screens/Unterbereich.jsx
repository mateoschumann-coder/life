import { useStore } from '../lib/store';
import { areaOf, pillarOf, subOf } from '../lib/logic';
import { AreaIcon, Back, TabBar } from '../components/ui';
import AreaContent from '../components/AreaContent';
import { Missing } from './Saeule';

export default function Unterbereich({ areaId, subId }) {
  const s = useStore();
  const area = areaOf(s, areaId);
  const sub = subOf(area, subId);
  if (!area || !sub) return <Missing />;
  const pillar = pillarOf(s, area.pillarId);
  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href={`#/bereich/${area.id}`} label={area.name} />
          <div className="title-row">
            <AreaIcon icon={area.icon} color={pillar.color} size={40} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="eyebrow">{area.name}</span>
              <h1 className="h1 sm">{sub.name}</h1>
            </div>
          </div>
        </div>
        <AreaContent s={s} area={area} subId={sub.id} />
      </main>
      <TabBar active="bereiche" />
    </>
  );
}
