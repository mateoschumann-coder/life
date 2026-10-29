// v1.23 (Mateo): Kacheln sortieren wie auf dem iPhone-Homebildschirm –
// lange drücken → alles wackelt → Kachel ziehen; oben/unten „Fertig“. Löschen geht hier bewusst nicht.
// Reihenfolge pro Liste in s.profile.order[orderKey].
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { store } from '../lib/store';

// gemeinsamer Bearbeiten-Zustand für die ganze Seite (mehrere Gitter)
let editing = false;
const subs = new Set();
const setEditing = (v) => { editing = v; subs.forEach((f) => f(v)); };
export function useEditing() {
  const [v, setV] = useState(editing);
  useEffect(() => { subs.add(setV); return () => subs.delete(setV); }, []);
  return v;
}

// „Fertig“-Leiste – einmal pro Seite einbauen
export const startEditing = () => setEditing(true);
export function SortDone({ hint = 'Ziehen zum Verschieben' }) {
  const on = useEditing();
  useEffect(() => () => setEditing(false), []);
  if (!on) return null;
  return createPortal(
    <div className="sort-done">
      <span>{hint}</span>
      <button type="button" className="btn small" onClick={() => setEditing(false)}>Fertig</button>
    </div>,
    document.body,
  );
}

export function ordered(s, orderKey, items) {
  const order = s.profile?.order?.[orderKey] || [];
  const pos = (k) => { const i = order.indexOf(k); return i < 0 ? 1e6 : i; };
  return items.map((x, i) => ({ x, i })).sort((a, b) => pos(a.x.key) - pos(b.x.key) || a.i - b.i).map((o) => o.x);
}
const saveOrder = (orderKey, keys) => store.update((d) => { d.profile = { ...d.profile, order: { ...(d.profile?.order || {}), [orderKey]: keys } }; });

export default function SortGrid({ s, orderKey, items, render, onOpen, onEditTap, className, tileClass, tileStyle }) {
  const on = useEditing();
  const base = ordered(s, orderKey, items);
  const [live, setLive] = useState(null); // Reihenfolge während des Ziehens
  const [drag, setDrag] = useState(null); // { key, x, y, dx, dy, w, h }
  const list = live ? live.map((k) => base.find((b) => b.key === k)).filter(Boolean) : base;
  const refs = useRef({});
  const st = useRef({});
  const suppress = useRef(false);

  const start = (key, x, y) => {
    const el = refs.current[key];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setLive(list.map((b) => b.key));
    setDrag({ key, x, y, dx: x - r.left, dy: y - r.top, w: r.width, h: r.height });
    navigator.vibrate?.(15);
  };
  const move = (x, y) => {
    setDrag((d) => (d ? { ...d, x, y } : d));
    setLive((cur) => {
      if (!cur) return cur;
      let best = null, bd = 1e9;
      for (const k of cur) {
        const el = refs.current[k];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = (r.left + r.width / 2 - x) ** 2 + (r.top + r.height / 2 - y) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      const dk = st.current.key;
      if (!best || best === dk) return cur;
      const next = cur.filter((k) => k !== dk);
      next.splice(cur.indexOf(best), 0, dk);
      return next.join() === cur.join() ? cur : next;
    });
  };
  const end = () => {
    setTimeout(() => { suppress.current = false; }, 400);
    setLive((cur) => { if (cur) saveOrder(orderKey, cur); return null; });
    setDrag(null);
    st.current = {};
  };

  // Touch: lange drücken (oder im Bearbeiten-Modus sofort) → ziehen; Seite scrollt dabei nicht
  useEffect(() => {
    const tm = (e) => {
      const c = st.current;
      if (!c.key) return;
      const t = e.touches[0];
      if (c.dragging) { e.preventDefault(); move(t.clientX, t.clientY); return; }
      if (c.pending) { e.preventDefault(); if (Math.hypot(t.clientX - c.x0, t.clientY - c.y0) > 6) c.go(t.clientX, t.clientY); return; }
      if (Math.hypot(t.clientX - c.x0, t.clientY - c.y0) > 8) { clearTimeout(c.timer); st.current = {}; }
    };
    const te = () => { const c = st.current; clearTimeout(c.timer); if (c.dragging) end(); else st.current = {}; };
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', te);
    document.addEventListener('touchcancel', te);
    return () => { document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', te); document.removeEventListener('touchcancel', te); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (key, x, y) => {
    clearTimeout(st.current.timer);
    suppress.current = false;
    st.current = { key, x0: x, y0: y };
    const go = (mx = x, my = y) => { st.current.pending = false; st.current.dragging = true; suppress.current = true; if (!editing) setEditing(true); start(key, x, y); if (mx !== x || my !== y) move(mx, my); };
    // im Bearbeiten-Modus: erst ziehen, wenn sich der Finger bewegt – sonst ist es ein Tipp (z.B. Austauschen)
    if (editing) { st.current.pending = true; st.current.go = go; } else st.current.timer = setTimeout(go, 450);
  };
  const onTouchStart = (key) => (e) => { const t = e.touches[0]; begin(key, t.clientX, t.clientY); };
  // Maus (Computer)
  const onMouseDown = (key) => (e) => {
    if (e.button !== 0) return;
    begin(key, e.clientX, e.clientY);
    const mm = (ev) => {
      const c = st.current;
      if (c.dragging) move(ev.clientX, ev.clientY);
      else if (c.pending) { if (Math.hypot(ev.clientX - c.x0, ev.clientY - c.y0) > 6) c.go(ev.clientX, ev.clientY); }
      else if (Math.hypot(ev.clientX - c.x0, ev.clientY - c.y0) > 8) { clearTimeout(c.timer); st.current = {}; }
    };
    const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); const c = st.current; clearTimeout(c.timer); if (c.dragging) end(); else st.current = {}; };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  };
  const onClick = (item) => (e) => {
    e.preventDefault();
    if (suppress.current) { suppress.current = false; return; }
    if (editing) { onEditTap?.(item); return; }
    onOpen(item);
  };

  useLayoutEffect(() => { if (!on) setLive(null); }, [on]);
  const dragItem = drag && base.find((b) => b.key === drag.key);

  return (
    <>
      <div className={`${className || ''}${on ? ' sorting' : ''}`}>
        {list.map((item, i) => (
          <div
            key={item.key}
            ref={(el) => { refs.current[item.key] = el; }}
            role="button"
            tabIndex={0}
            className={`${tileClass || ''} sort-tile${on ? ' wiggle' : ''}${drag?.key === item.key ? ' sort-ghost' : ''}`}
            style={{ ...(tileStyle ? tileStyle(item) : {}), animationDelay: `${(i % 3) * -0.09}s` }}
            onTouchStart={onTouchStart(item.key)}
            onMouseDown={onMouseDown(item.key)}
            onClick={onClick(item)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !editing) onOpen(item); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {render(item)}
          </div>
        ))}
      </div>
      {drag && dragItem && createPortal(
        <div className={`${tileClass || ''} sort-float`} style={{ ...(tileStyle ? tileStyle(dragItem) : {}), position: 'fixed', left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, height: drag.h }}>
          {render(dragItem)}
        </div>,
        document.body,
      )}
    </>
  );
}
