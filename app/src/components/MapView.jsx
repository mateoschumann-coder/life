// Einfache Karte ohne Zusatzbibliothek: Kacheln von CARTO (OpenStreetMap-Daten), verschiebbar, zoombar
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui';

const TILE = 256;
const BA = { lat: -34.6037, lon: -58.3816 };
const world = (lat, lon, z) => {
  const n = TILE * 2 ** z;
  const r = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
};
export const CAT_COLOR = {
  Café: '#B7791F', Bar: '#C2410C', Restaurant: '#E8775A', Club: '#7C3AED', Kultur: '#3B6FE0',
  Natur: '#2FA36B', Sport: '#0E9F9A', Laden: '#DB2777', Sonstiges: '#6B7280', Unterkunft: '#1E3A8A', Station: '#111827',
};

function fit(points, w, h) {
  if (!points.length) return { z: 12, ...world(BA.lat, BA.lon, 12) };
  for (let z = 16; z >= 3; z--) {
    const ps = points.map((p) => world(p.lat, p.lon, z));
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (maxX - minX < w - 80 && maxY - minY < h - 80) return { z: Math.min(z, 15), ...world((Math.max(...points.map((p) => p.lat)) + Math.min(...points.map((p) => p.lat))) / 2, (Math.max(...points.map((p) => p.lon)) + Math.min(...points.map((p) => p.lon))) / 2, Math.min(z, 15)) };
  }
  return { z: 3, ...world(BA.lat, BA.lon, 3) };
}

export default function MapView({ places, selectedId, onSelect, height = 300 }) {
  const ref = useRef(null);
  const [w, setW] = useState(360);
  const pts = useMemo(() => places.filter((p) => p.lat != null && p.lon != null), [places]);
  const [view, setView] = useState(null); // { z, x, y } = Mittelpunkt in Welt-Pixeln
  const drag = useRef(null);
  const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 360);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // Neu ausrichten, wenn Orte dazukommen oder wegfallen
  const key = pts.map((p) => p.id).join(',');
  useEffect(() => {
    setView(fit(pts, w, height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, w]);
  // Ausgewählten Ort in die Mitte holen
  useEffect(() => {
    const p = pts.find((x) => x.id === selectedId);
    if (p && view) setView((v) => ({ z: Math.max(v.z, 14), ...world(p.lat, p.lon, Math.max(v.z, 14)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!view) return <div ref={ref} className="map" style={{ height }} />;
  const { z, x: cx, y: cy } = view;
  const left = cx - w / 2;
  const top = cy - height / 2;
  const n = 2 ** z;
  const tiles = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      const sub = 'abcd'[(tx + ty) & 3];
      tiles.push(
        <img
          key={`${z}-${tx}-${ty}`}
          alt=""
          draggable={false}
          src={`https://${sub}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/${z}/${wx}/${ty}@2x.png`}
          style={{ position: 'absolute', left: tx * TILE - left, top: ty * TILE - top, width: TILE, height: TILE }}
        />,
      );
    }
  }
  const zoom = (d) => setView((v) => {
    const nz = Math.max(3, Math.min(18, v.z + d));
    const f = 2 ** (nz - v.z);
    return { z: nz, x: v.x * f, y: v.y * f };
  });

  return (
    <div
      ref={ref}
      className="map"
      style={{ height }}
      onPointerDown={(e) => {
        if (e.target.closest('button')) return;
        drag.current = { sx: e.clientX, sy: e.clientY, x: cx, y: cy };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setView((v) => ({ ...v, x: d.x - (e.clientX - d.sx), y: d.y - (e.clientY - d.sy) }));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => zoom(1)}
    >
      {tiles}
      {pts.map((p) => {
        const pos = world(p.lat, p.lon, z);
        const on = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            className={on ? 'pin on' : 'pin'}
            style={{ left: pos.x - left, top: pos.y - top, '--c': CAT_COLOR[p.category] || CAT_COLOR.Sonstiges, opacity: p.status === 'war' ? 1 : 0.92 }}
            onClick={() => onSelect?.(p.id)}
            aria-label={p.name}
          >
            {on && <span className="pin-label">{p.name}</span>}
          </button>
        );
      })}
      <div className="map-zoom">
        <button type="button" onClick={() => zoom(1)} aria-label="Hineinzoomen"><Icon name="plus" size={16} /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Herauszoomen"><Icon name="minus" size={16} /></button>
      </div>
      <span className="map-attr">© OpenStreetMap · © CARTO</span>
      {!pts.length && <span className="map-empty">Noch keine Orte mit Adresse</span>}
    </div>
  );
}
