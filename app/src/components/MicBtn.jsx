// v1.31 (Mateo): 🎙 direkt neben Suchfeldern – antippen, sprechen, nochmal antippen (= fertig).
// onDone(text): wird nach dem Sprechen aufgerufen (z.B. KI-Suche gleich starten).
import { useEffect, useRef } from 'react';
import { canDictate, useDictation } from '../lib/dictate';
import { Icon, toast } from './ui';

export default function MicBtn({ value, onChange, onDone, lang, size = 40 }) {
  const mic = useDictation(value || '', onChange, lang);
  const was = useRef(false);
  const val = useRef(value); val.current = value;
  useEffect(() => {
    if (was.current && !mic.on && onDone && String(val.current || '').trim()) onDone(String(val.current).trim());
    was.current = mic.on;
  }, [mic.on]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mic.error) toast(mic.error); }, [mic.error]);
  if (!canDictate) return null;
  return (
    <button type="button" className={mic.on ? 'mic on' : 'mic'} style={{ width: size, height: size, flexShrink: 0 }} onClick={() => { if (!mic.on) onChange(''); mic.toggle(); }} aria-label={mic.on ? 'Fertig gesprochen' : 'Suche einsprechen'} aria-pressed={mic.on}>
      <Icon name={mic.on ? 'stop' : 'mic'} size={17} color="currentColor" />
    </button>
  );
}
