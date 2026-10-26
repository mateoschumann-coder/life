// Eigene kleine Spracheingabe für Eingabefelder (z.B. KI-Planer bei Reisen und Events).
// Hört weiter zu, auch wenn das iPhone nach Pausen stoppt – bis man selbst auf Stopp tippt (max. 5 Min).
import { useEffect, useRef, useState } from 'react';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canDictate = !!SR;

export function useDictation(text, setText, lang = 'de-DE') {
  const [on, setOn] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef({ rec: null, want: false, until: 0, base: '' });
  const textRef = useRef(text);
  textRef.current = text;

  const begin = () => {
    const st = ref.current;
    try {
      st.rec?.abort?.();
    } catch {}
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    st.base = textRef.current.trim() ? textRef.current.trim() + ' ' : '';
    rec.onresult = (e) => {
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      if (st.rec !== rec) return;
      setText(st.base + said);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        st.want = false;
        setError('Mikrofon nicht erlaubt – nutze das Mikrofon der Tastatur');
      }
    };
    rec.onend = () => {
      if (st.rec !== rec) return;
      if (st.want && Date.now() < st.until) {
        setTimeout(() => st.want && st.rec === rec && begin(), 150);
        return;
      }
      st.want = false;
      setOn(false);
    };
    st.rec = rec;
    try {
      rec.start();
      setOn(true);
    } catch {
      setOn(false);
    }
  };

  const start = () => {
    setError(null);
    if (!SR) {
      setError('Hier nicht verfügbar – nutze das Mikrofon der Tastatur');
      return;
    }
    ref.current.want = true;
    ref.current.until = Date.now() + 5 * 60 * 1000;
    begin();
  };
  // Stopp: Erkennung sofort abhängen, damit verspätete Ergebnisse den (inzwischen gesendeten/geleerten) Text nicht wieder füllen
  const stop = () => {
    const st = ref.current;
    st.want = false;
    const rec = st.rec;
    st.rec = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
    setOn(false);
  };
  useEffect(() => () => {
    ref.current.want = false;
    try {
      ref.current.rec?.abort();
    } catch {}
  }, []);
  return { on, start, stop, toggle: () => (on ? stop() : start()), error };
}
