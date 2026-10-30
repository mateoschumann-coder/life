// Schwebender Assistent: auf jedem Bildschirm unten rechts.
// 1. Tipp: zuhören · 2. Tipp: absenden · Antwort erscheint im kleinen Fenster (und wird auf Wunsch vorgelesen).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { getAi } from '../lib/ai';
import { getDraft, needsRetry, resend, send, setDraft, setMode, setSpeak, speechAvailable, startListening, stopListening, stopSpeaking, unlockSpeech, useChat } from '../lib/chat';
import { Icon, toast } from './ui';
import Proposal from './Proposal';

export default function FloatingAssistant({ hideFab = false }) {
  const s = useStore();
  const { items, busy, listening, draft, mode } = useChat();
  const [open, setOpen] = useState(false);
  const [sentAt, setSentAt] = useState(null); // Index der letzten eigenen Nachricht in diesem Fenster
  const ai = getAi();
  const hasKey = !!ai.apiKey;

  // Position des Knopfs (verschiebbar, wird gemerkt) und Verschiebung des Fensters
  const [pos, setPos] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem('life-app-fab') || 'null');
      // gemerkte Position immer in den sichtbaren Bereich holen (Bildschirm kann sich geändert haben)
      return p && { x: Math.max(8, Math.min(window.innerWidth - 62, p.x)), y: Math.max(60, Math.min(window.innerHeight - 144, p.y)) };
    } catch {
      return null;
    }
  });
  const [panelOff, setPanelOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const panelRef = useRef(null);
  // Nach jedem Neuzeichnen prüfen: wächst das Fenster (z.B. durch einen Vorschlag), darf die Kopfleiste nicht aus dem Bild rutschen
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || drag.current?.panel) return;
    const b = el.getBoundingClientRect();
    let dy = 0;
    if (b.top < 12) dy = 12 - b.top;
    else if (b.top > window.innerHeight - 90) dy = window.innerHeight - 90 - b.top;
    if (dy) setPanelOff((o) => ({ ...o, y: o.y + dy }));
  });
  const FAB = 54;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const onFabDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onFabMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    setPos({ x: clamp(d.ox + dx, 8, window.innerWidth - FAB - 8), y: clamp(d.oy + dy, 60, window.innerHeight - FAB - 90) });
  };
  const onFabUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      tap();
      return;
    }
    // an den nächsten Rand schnappen und merken
    setPos((p) => {
      if (!p) return p;
      const snapped = { x: p.x + FAB / 2 < window.innerWidth / 2 ? 16 : window.innerWidth - FAB - 16, y: p.y };
      try {
        localStorage.setItem('life-app-fab', JSON.stringify(snapped));
      } catch {}
      return snapped;
    });
  };

  const onHeadDown = (e) => {
    if (e.target.closest('button, a')) return;
    const box = e.currentTarget.parentElement.getBoundingClientRect();
    drag.current = { panel: true, sx: e.clientX, sy: e.clientY, ox: panelOff.x, oy: panelOff.y, box };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHeadMove = (e) => {
    const d = drag.current;
    if (!d || !d.panel) return;
    // Fenster darf nicht aus dem Bildschirm: die Kopfleiste (zum Zurückziehen) bleibt immer sichtbar (v0.43)
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dx = clamp(e.clientX - d.sx, 4 - d.box.left, Math.max(4 - d.box.left, W - 4 - d.box.right));
    const dy = clamp(e.clientY - d.sy, 12 - d.box.top, H - 90 - d.box.top);
    setPanelOff({ x: d.ox + dx, y: d.oy + dy });
  };
  const onHeadUp = () => {
    drag.current = null;
  };

  // Fenster über oder unter dem Knopf, je nachdem wo er steht
  const fabStyle = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined;
  const fabTop = pos ? pos.y : null;
  const panelBelow = fabTop !== null && fabTop < window.innerHeight / 2;
  // v1.26: Fenster immer fest unten über der Tab-Leiste (der Knopf ist dann ausgeblendet, Senden sitzt im Fenster)
  const panelStyle = {
    transform: `translate(${panelOff.x}px, ${panelOff.y}px)`,
  };

  // Wenn die Spracherkennung von selbst stoppt (Pause), bleibt der Text als Entwurf stehen
  useEffect(() => {
    if (!open) stopListening();
    setPanelOff({ x: 0, y: 0 }); // beim Öffnen/Schließen wieder an den Ausgangsplatz
  }, [open]);

  const tap = () => {
    unlockSpeech();
    if (!hasKey) {
      setOpen(true);
      return;
    }
    if (busy) {
      setOpen(true);
      return;
    }
    if (listening || (open && draft.trim())) {
      // zweiter Tipp: absenden
      stopListening();
      if (draft.trim()) {
        setSentAt(items.length);
        send();
      }
      return;
    }
    setOpen(true);
    stopSpeaking();
    if (!startListening({ continuous: true, onError: toast }) && !speechAvailable) {
      toast('Spracheingabe nicht verfügbar – tippe im Fenster');
    }
  };

  // „Erzähl mir, wie es läuft“ (Coach-Karte): Fenster öffnen und zuhören
  const tapRef = useRef(null);
  tapRef.current = (prefix) => {
    if (prefix && !listening) setDraft(prefix);
    if (listening) return;
    setSentAt(items.length);
    if (draft.trim() && open) return;
    tap();
  };
  useEffect(() => {
    const f = (e) => tapRef.current?.(e.detail?.prefix);
    window.addEventListener('life-listen', f);
    return () => window.removeEventListener('life-listen', f);
  }, []);

  // v1.30: Blitz lange drücken → zuhören, loslassen → senden
  const itemsRef = useRef(items); itemsRef.current = items;
  useEffect(() => {
    const st = () => { unlockSpeech(); stopSpeaking(); setDraft(''); setOpen(true); setSentAt(itemsRef.current.length); if (!startListening({ continuous: true, onError: toast })) toast('Spracheingabe nicht verfügbar – tippe im Fenster'); };
    const sd = () => { stopListening(); setTimeout(() => { if (getDraft().trim()) { setSentAt(itemsRef.current.length); send(); } }, 250); };
    window.addEventListener('life-voice-start', st);
    window.addEventListener('life-voice-send', sd);
    return () => { window.removeEventListener('life-voice-start', st); window.removeEventListener('life-voice-send', sd); };
  }, []);

  const close = () => {
    stopListening();
    stopSpeaking();
    setOpen(false);
    setSentAt(null);
    setPanelOff({ x: 0, y: 0 });
  };

  // Was im kleinen Fenster gezeigt wird: die eigene letzte Nachricht und die Antwort darauf
  const recent = sentAt !== null ? items.slice(sentAt) : [];
  const userMsg = recent.find((i) => i.role === 'user');
  const reply = [...recent].reverse().find((i) => i.role === 'assistant');

  return (
    <>
      {open && (
        <div className="mini" role="dialog" aria-label="Assistent" style={panelStyle} ref={panelRef}>
          <div className="mini-head" onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp} onPointerCancel={onHeadUp} style={{ touchAction: 'none', cursor: 'grab' }}>
            <span className="grip" aria-hidden="true" />
            <span style={{ fontWeight: 650, fontSize: 15 }}>Assistent</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32, background: ai.speak ? 'var(--accent-bg)' : 'var(--fill)', color: ai.speak ? 'var(--accent)' : 'var(--muted)' }} onClick={() => setSpeak(!ai.speak)} aria-label={ai.speak ? 'Vorlesen ausschalten' : 'Antworten vorlesen'} aria-pressed={!!ai.speak}>
                <Icon name={ai.speak ? 'speaker' : 'speakerOff'} size={16} />
              </button>
              <a href="#/assistent" className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Ganzen Chat öffnen" onClick={close}>
                <Icon name="expand" size={15} />
              </a>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={close} aria-label="Schließen">
                <Icon name="x" size={14} width={2.6} />
              </button>
            </div>
          </div>

          <div className="mini-body">
            {!hasKey && <span className="sub">Zuerst in den Einstellungen einen API-Schlüssel hinterlegen. <a href="#/einstellungen" onClick={close} style={{ color: 'var(--accent)' }}>Öffnen</a></span>}
            {hasKey && userMsg && <div className="mini-me">{userMsg.text}</div>}
            {hasKey && busy && <div className="bubble ai typing" aria-label="Denkt nach"><span /><span /><span /></div>}
            {hasKey && reply && !busy && (
              <>
                {reply.text && <div className="mini-ai">{reply.text}</div>}
                {reply.error && <div className="mini-ai" style={{ color: 'var(--danger)' }}>{reply.error}</div>}
                {reply.actions?.length > 0 && <Proposal s={s} item={reply} />}
              </>
            )}
            {hasKey && !busy && sentAt !== null && needsRetry(items) && (
              <button type="button" className="pill on" style={{ alignSelf: 'flex-start' }} onClick={resend}>Nochmal senden</button>
            )}
            {hasKey && !busy && (
              <textarea
                className="input mini-draft"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={listening ? 'Ich höre zu … tippe unten noch einmal, um zu senden' : reply ? 'Antworten: sprechen oder tippen …' : 'Sprich oder tippe …'}
                aria-label="Nachricht an den Assistenten"
              />
            )}
            {hasKey && !busy && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className={listening ? 'mic on' : 'mic'} style={{ width: 38, height: 38, flexShrink: 0 }} onClick={() => { unlockSpeech(); if (listening) stopListening(); else startListening({ continuous: true, onError: toast }); }} aria-label={listening ? 'Zuhören beenden' : 'Wieder sprechen'} aria-pressed={listening}>
                  <Icon name={listening ? 'stop' : 'mic'} size={17} color="currentColor" />
                </button>
                <span className="tiny" style={{ flex: 1 }}>{listening ? 'Ich höre zu. Rechts ➤ = senden.' : draft.trim() ? 'Rechts ➤ = senden.' : reply ? 'Mikro = wieder sprechen.' : 'Sprich oder tippe.'}</span>
                {/* v1.26 (Mateo): Senden-Knopf fest unten rechts am Text – der schwebende Knopf ist bei offenem Fenster ausgeblendet */}
                <button type="button" className="mini-send" disabled={!draft.trim() && !listening} onClick={() => { stopListening(); setTimeout(() => { if (getDraft().trim()) { setSentAt(items.length); send(); } }, 60); }} aria-label="Senden">
                  <Icon name="send" size={18} color="currentColor" width={2} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {!open && !hideFab && <button
        type="button"
        className={listening ? 'fab on' : busy ? 'fab busy' : open && draft.trim() ? 'fab ready' : 'fab'}
        style={fabStyle}
        onPointerDown={onFabDown}
        onPointerMove={onFabMove}
        onPointerUp={onFabUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tap())}
        aria-label={listening ? 'Senden' : open && draft.trim() ? 'Senden' : 'Assistent: sprechen'}
      >
        <Icon name={listening || (open && draft.trim()) ? 'send' : 'sparkle'} size={22} color="currentColor" width={2} />
      </button>}
    </>
  );
}
