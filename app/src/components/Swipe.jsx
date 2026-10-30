// v1.30 (Mateo): Wischen wie in iOS-Listen – nach rechts = erledigt, nach links = löschen/rausnehmen
import { useRef, useState } from 'react';

export default function Swipe({ onRight, onLeft, rightLabel = '✓ Erledigt', leftLabel = '🗑 Löschen', children }) {
  const [dx, setDx] = useState(0);
  const st = useRef({});
  if (!onRight && !onLeft) return children;
  const TH = 80;
  const start = (e) => { const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, lock: null }; };
  const move = (e) => {
    const c = st.current; if (c.x == null) return;
    const t = e.touches[0]; const mx = t.clientX - c.x; const my = t.clientY - c.y;
    if (c.lock == null && Math.hypot(mx, my) > 8) c.lock = Math.abs(mx) > Math.abs(my) * 1.3 ? 'h' : 'v';
    if (c.lock !== 'h') return;
    let v = mx;
    if (v > 0 && !onRight) v = 0;
    if (v < 0 && !onLeft) v = 0;
    setDx(Math.max(-140, Math.min(140, v)));
  };
  const end = () => {
    const v = dx; st.current = {}; setDx(0);
    if (v > TH) onRight?.(); else if (v < -TH) onLeft?.();
  };
  const show = dx > 0 ? 'r' : dx < 0 ? 'l' : '';
  return (
    <div className="swipe" onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      {show && (
        <div className={`swipe-bg ${show}`} style={{ opacity: Math.min(1, Math.abs(dx) / TH) }}>
          <span>{show === 'r' ? rightLabel : ''}</span><span>{show === 'l' ? leftLabel : ''}</span>
        </div>
      )}
      <div className="swipe-in" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 0.18s' }}>{children}</div>
    </div>
  );
}
