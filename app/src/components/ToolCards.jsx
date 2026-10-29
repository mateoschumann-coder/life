import { toolsFor } from '../lib/tools';
import { useStore } from '../lib/store';
import { Chevron, Icon } from './ui';
import SortGrid, { SortDone } from './SortGrid';

// v1.23: Werkzeug-Karten eines Bereichs – lange drücken = verschieben (wie iPhone-Homebildschirm)
export default function ToolCards({ areaId, subName }) {
  const s = useStore();
  const tools = toolsFor(areaId, subName, s);
  if (!tools.length) return null;
  return (
    <>
      <SortGrid
        s={s}
        orderKey={`tools-${areaId}${subName ? `-${subName}` : ''}`}
        className="tool-grid"
        tileClass="card design-cta"
        tileStyle={(t) => (t.soon ? { opacity: 0.6 } : {})}
        items={tools.map((t) => ({ ...t, key: t.title }))}
        onOpen={(t) => { if (!t.soon && t.href) location.hash = t.href; }}
        render={(t) => (<>
          <span className="spark" style={t.soon ? { background: 'var(--fill)', color: 'var(--muted)' } : undefined}><Icon name={t.icon} size={16} color="currentColor" /></span>
          <span className="row-main"><span className="row-title strong">{t.title}</span><span className="row-meta">{t.text}</span></span>
          {!t.soon && <Chevron />}
        </>)}
      />
      <SortDone />
    </>
  );
}
