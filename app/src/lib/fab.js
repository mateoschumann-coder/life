// v1.29 (Mateo): schwebender Assistent an/aus (localStorage, nur dieses Gerät)
import { useEffect, useState } from 'react';
const KEY = 'life-app-fab-off';
export const fabOn = () => { try { return localStorage.getItem(KEY) !== '1'; } catch { return true; } };
export const setFab = (on) => { try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, '1'); } catch {} window.dispatchEvent(new Event('life-fab')); };
export function useFabOn() {
  const [v, setV] = useState(fabOn);
  useEffect(() => { const f = () => setV(fabOn()); window.addEventListener('life-fab', f); return () => window.removeEventListener('life-fab', f); }, []);
  return v;
}
