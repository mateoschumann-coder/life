import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { getAi } from '../lib/ai';
import { clearChat, needsRetry, resend, send, setDraft, setMode, setSpeak, startListening, stopListening, stopSpeaking, unlockSpeech, useChat } from '../lib/chat';
import { Back, Icon, Segmented, toast } from '../components/ui';
import Proposal from '../components/Proposal';

const SUGGESTIONS = ['Was steht heute an?', 'Wem sollte ich mal wieder schreiben?', 'Plane meine Woche', 'Neues Projekt: '];

export default function Assistent() {
  const s = useStore();
  const { items, busy, listening, draft, mode } = useChat();
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const ai = getAi();
  const hasKey = !!ai.apiKey;
  // v1.01: nur der letzte Austausch (letzte eigene Nachricht + Antwort), der Rest auf Wunsch
  const [showAll, setShowAll] = useState(false);
  const lastUser = items.map((i) => i.role).lastIndexOf('user');
  const cut = lastUser > 0 ? lastUser : 0;
  const visible = showAll ? items : items.slice(cut);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, busy]);
  // Textfeld wächst mit, auch wenn Text per Sprache eingefügt wird
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [draft]);

  const toggleMic = () => {
    unlockSpeech();
    if (listening) stopListening();
    else if (!startListening({ continuous: true, onError: toast })) inputRef.current?.focus();
  };
  const submit = (text) => {
    stopListening();
    unlockSpeech();
    send(text);
  };

  return (
    <div className="chat">
      <header className="chat-head">
        <Back href="#/heute" label="Heute" actions={false} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Assistent</span>
          <span className="tiny">trägt ein, du bestätigst</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button type="button" className="icon-btn" style={{ width: 34, height: 34, background: ai.speak ? 'var(--accent-bg)' : 'var(--fill)', color: ai.speak ? 'var(--accent)' : 'var(--muted)' }} onClick={() => { unlockSpeech(); setSpeak(!ai.speak); }} aria-label={ai.speak ? 'Vorlesen ausschalten' : 'Antworten vorlesen'} aria-pressed={!!ai.speak}>
            <Icon name={ai.speak ? 'speaker' : 'speakerOff'} size={17} />
          </button>
          <button type="button" className="link-btn" onClick={() => confirm('Neues Gespräch beginnen?') && (stopSpeaking(), clearChat())}>Neu</button>
        </div>
      </header>

      <main className="chat-body">
        {!hasKey && (
          <div className="notice" style={{ lineHeight: 1.5 }}>
            Damit der Assistent arbeiten kann, braucht er einen API-Schlüssel von Anthropic.{' '}
            <a href="#/einstellungen" style={{ color: 'var(--accent)', fontWeight: 600 }}>In den Einstellungen hinterlegen</a>
          </div>
        )}
        {items.length === 0 && hasKey && (
          <div className="notice" style={{ lineHeight: 1.5 }}>
            {'Sag oder schreib mir, was du vorhast, z.B. „Erinnere mich Freitag an den Friseur“, „Ich war heute laufen“ oder „Leg ein Projekt für die Brasilien-Reise an“. Ich schlage dir die Änderungen vor, und du bestätigst.'}
          </div>
        )}
        {cut > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'center', fontSize: 14 }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Nur das letzte Gespräch zeigen' : `Früheren Verlauf anzeigen (${cut} Nachrichten)`}</button>}
        {visible.map((it) =>
          it.role === 'user' ? (
            <div key={it.id} className="bubble me">{it.text}</div>
          ) : (
            <div key={it.id} className="bot">
              {it.text && <div className="bubble ai">{it.text}</div>}
              {it.error && (
                <div className="bubble ai" style={{ color: 'var(--danger)' }}>
                  {it.error} {it.error.includes('Schlüssel') && <a href="#/einstellungen" style={{ color: 'var(--accent)' }}>Zu den Einstellungen</a>}
                </div>
              )}
              {it.actions && it.actions.length > 0 && <Proposal s={s} item={it} />}
            </div>
          )
        )}
        {busy && <div className="bubble ai typing" aria-label="Denkt nach"><span /><span /><span /></div>}
        {!busy && hasKey && needsRetry(items) && (
          <button type="button" className="pill on" style={{ alignSelf: 'flex-start' }} onClick={resend}>Nochmal senden</button>
        )}
        <div ref={endRef} />
      </main>

      <footer className="composer">
        {items.length === 0 && hasKey && (
          <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2 }}>
            {SUGGESTIONS.map((x) => (
              <button key={x} type="button" className="chip" style={{ flexShrink: 0, background: 'var(--card-2)' }} onClick={() => (x.endsWith(': ') ? (setDraft(x), inputRef.current?.focus()) : submit(x))}>
                {x.replace(': ', '')}
              </button>
            ))}
          </div>
        )}
        <form className="composer-row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <button type="button" className={listening ? 'mic on' : 'mic'} onClick={toggleMic} disabled={!hasKey || busy} aria-label={listening ? 'Aufnahme beenden' : 'Sprechen'} aria-pressed={listening}>
            <Icon name={listening ? 'stop' : 'mic'} size={19} color="currentColor" width={2} />
          </button>
          <textarea
            ref={inputRef}
            className="input"
            rows={1}
            value={draft}
            placeholder={listening ? 'Ich höre zu …' : 'Nachricht …'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit(); } }}
            aria-label="Nachricht an den Assistenten"
            disabled={!hasKey}
          />
          <button type="submit" className="send" disabled={!draft.trim() || busy || !hasKey} aria-label="Senden">
            <Icon name="send" size={18} color="currentColor" width={2.2} />
          </button>
        </form>
      </footer>
    </div>
  );
}
