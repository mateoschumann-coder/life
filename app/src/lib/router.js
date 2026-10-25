// Einfache Navigation über die Adresse (#/heute, #/bereich/koerper, ...)
import { useEffect, useState } from 'react';

const read = () => (location.hash || '#/heute').replace(/^#\/?/, '').split('/').map(decodeURIComponent);

export function useRoute() {
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const f = () => {
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
