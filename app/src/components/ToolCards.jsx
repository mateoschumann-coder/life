import { toolsFor } from '../lib/tools';
import { Chevron, Icon } from './ui';

export default function ToolCards({ areaId, subName }) {
  const tools = toolsFor(areaId, subName);
  if (!tools.length) return null;
  return (
    <div className="tool-grid">
      {tools.map((t) =>
        t.soon ? (
          <div key={t.title} className="card design-cta" style={{ opacity: 0.6 }}>
            <span className="spark" style={{ background: 'var(--fill)', color: 'var(--muted)' }}><Icon name={t.icon} size={16} color="currentColor" /></span>
            <span className="row-main"><span className="row-title strong">{t.title}</span><span className="row-meta">{t.text}</span></span>
          </div>
        ) : (
          <a key={t.title} href={t.href} className="card design-cta">
            <span className="spark"><Icon name={t.icon} size={16} color="currentColor" /></span>
            <span className="row-main"><span className="row-title strong">{t.title}</span><span className="row-meta">{t.text}</span></span>
            <Chevron />
          </a>
        ),
      )}
    </div>
  );
}
