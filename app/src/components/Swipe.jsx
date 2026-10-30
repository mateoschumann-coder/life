// v1.30 (Mateo): Wischen wie in iOS-Listen – nach rechts = erledigt, nach links = löschen/rausnehmen
// v1.38: eigene (nicht passive) Touch-Listener, damit iPhone-Safari das waagerechte Wischen nicht selbst übernimmt;
// zusätzlich Maus/Stift über Pointer-Events (Test am Rechner).
import { useEffect, useRef, useState } from 'react';

export default function Swipe({ onRight, onLeft, rightLabel = '✓ Erledigt', leftLabel = '🗑 Löschen', children }) {
  const [dx, setDx] = useState(0);
  const ref = useRef(null);
  const st = useRef({});
  const cb = useRef({}); cb.current = { onRight, onLeft };
  const dxRef = useRef(0);
  const active = !!(onRight || onLeft);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return undefined;
    const TH = 80;
    const set = (v) => { dxRef.current = v; setDx(v); };
    const begin = (x, y) => { st.current = { x, y, lock: null }; };
    const moveTo = (x, y, e) => {
      const c = st.current; if (c.x == null) return;
      const mx = x - c.x; const my = y - c.y;
      if (c.lock == null && Math.hypot(mx, my) > 8) c.lock = Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v';
      if (c.lock !== 'h') return;
      if (e?.cancelable) e.preventDefault();
      let v = mx;
      if (v > 0 && !cb.current.onRight) v = 0;
      if (v < 0 && !cb.current.onLeft) v = 0;
      set(Math.max(-150, Math.min(150, v)));
    };
    const finish = () => {
      const v = dxRef.current; const wasH = st.current.lock === 'h'; st.current = { blockClick: wasH }; set(0); setTimeout(() => { st.current.blockClick = false; }, 350);
      if (!wasH) return;
      if (v > TH) cb.current.onRight?.(); else if (v < -TH) cb.current.onLeft?.();
    };
    const ts = (e) => { const t = e.touches[0]; begin(t.clientX, t.clientY); };
    const tm = (e) => { const t = e.touches[0]; moveTo(t.clientX, t.clientY, e); };
    const pd = (e) => { if (e.pointerType === 'mouse' && e.button === 0) begin(e.clientX, e.clientY); };
    const pm = (e) => { if (e.pointerType === 'mouse' && st.current.x != null) moveTo(e.clientX, e.clientY, e); };
    const pu = (e) => { if (e.pointerType === 'mouse') finish(); };
    // Klick nach dem Wischen nicht als Antippen werten
    const clk = (e) => { if (st.current.blockClick) { e.stopPropagation(); e.preventDefault(); st.current.blockClick = false; } };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', finish);
    el.addEventListener('touchcancel', finish);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    el.addEventListener('click', clk, true);
    return () => {
      el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', finish); el.removeEventListener('touchcancel', finish);
      el.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); el.removeEventListener('click', clk, true);
    };
  }, [active]);
  if (!active) return children;
  const TH = 80;
  const show = dx > 0 ? 'r' : dx < 0 ? 'l' : '';
  return (
    <div className="swipe" ref={ref}>
      {show && (
        <div className={`swipe-bg ${show}`} style={{ opacity: Math.min(1, Math.abs(dx) / TH) }}>
          <span>{show === 'r' ? rightLabel : ''}</span><span>{show === 'l' ? leftLabel : ''}</span>
        </div>
      )}
      <div className="swipe-in" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 0.18s' }}>{children}</div>
    </div>
  );
}
