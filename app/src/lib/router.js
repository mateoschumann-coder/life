// Einfache Navigation über die Adresse (#/heute, #/bereich/koerper, ...)
import { useEffect, useState } from 'react';

const read = () => (location.hash || '#/heute').replace(/^#\/?/, '').split('/').map(decodeURIComponent);

export function useRoute() {
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const f = () => {
      if (read()[0] === 'heute') clearFrom();
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parts;
}

export const go = (path) => {
  location.hash = path;
};

// „Zurück zu Heute“: Wer vom Überblick auf Heute in einen Bereich springt, kommt mit „Zurück“ wieder auf Heute
const FROM = 'life-from-heute';
const norm = (h) => { try { return decodeURIComponent(String(h || '').replace(/^#\/?/, '')); } catch { return String(h || ''); } };
export const markFromHeute = (href) => { try { sessionStorage.setItem(FROM, norm(href)); } catch {} };
export const clearFrom = () => { try { sessionStorage.removeItem(FROM); } catch {} };
export const fromHeute = () => { try { const v = sessionStorage.getItem(FROM); return !!v && v === norm(location.hash); } catch { return false; } };
