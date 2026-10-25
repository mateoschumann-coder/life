import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { askClaude, getAi, loadChat, saveChat } from '../lib/ai';
import { applyActions, describe } from '../lib/apply';
import { Back, Icon, toast } from '../components/ui';

const SUGGESTIONS = ['Was steht heute an?', 'Wem sollte ich mal wieder schreiben?', 'Plane meine Woche', 'Neues Projekt: '];
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export default function Assistent() {
  const s = useStore();
  const [items, setItems] = useState(loadChat);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const hasKey = !!getAi().apiKey;
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  // Spracheingabe: antippen, sprechen, Text erscheint im Feld (vor dem Senden noch änderbar)
  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!SR) {
      toast('Hier nicht verfügbar – nutze das Mikrofon der Tastatur');
      inputRef.current?.focus();
      return;
    }
    const rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;
    const base = text.trim() ? text.trim() + ' ' : '';
    rec.onresult = (e) => {
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setText(base + said);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Mikrofon nicht erlaubt – nutze das Mikrofon der Tastatur');
      else if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Spracheingabe fehlgeschlagen – nutze das Mikrofon der Tastatur');
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };
  useEffect(() => () => recRef.current?.abort?.(), []);
  // Textfeld wächst mit, auch wenn Text per Sprache eingefügt wird
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [text]);

  const update = (next) => {
    setItems(next);
    saveChat(next);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, busy]);

  const send = async (msg) => {
    const content = (msg ?? text).trim();
    if (!content || busy) return;
    setText('');
    // offene Vorschläge gelten als übersprungen, sobald weitergeschrieben wird
    const base = items.map((it) => (it.status === 'open' ? { ...it, status: 'skipped' } : it));
    const withUser = [...base, { id: newId(), role: 'user', text: content }];
    update(withUser);
    setBusy(true);
    try {
      const r = await askClaude(s, withUser);
      const reply = {
        id: newId(), role: 'assistant', text: r.text, toolUseId: r.toolUseId, actions: r.actions,
        selected: r.actions.map(() => true), status: r.toolUseId ? 'open' : null,
      };
      update([...withUser, reply]);
    } catch (e) {
      const msgText = e.message === 'KEIN_SCHLUESSEL' ? 'Es ist noch kein API-Schlüssel hinterlegt.' : e.message;
      update([...withUser, { id: newId(), role: 'assistant', text: '', error: msgText }]);
    } finally {
      setBusy(false);
    }
  };

  const decide = (itemId, apply) => {
    const next = items.map((it) => {
      if (it.id !== itemId) return it;
      if (!apply) return { ...it, status: 'rejected' };
      const chosen = it.actions.filter((a, i) => it.selected[i] && describe(s, a).ok);
      const labels = applyActions(chosen);
      toast(labels.length === 1 ? '1 Änderung gespeichert' : `${labels.length} Änderungen gespeichert`);
      return { ...it, status: 'applied', appliedLabels: labels };
    });
    update(next);
  };

  const toggleSel = (itemId, idx) => {
    update(items.map((it) => (it.id === itemId ? { ...it, selected: it.selected.map((v, i) => (i === idx ? !v : v)) } : it)));
  };

  return (
    <div className="chat">
      <header className="chat-head">
        <Back href="#/heute" label="Heute" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Assistent</span>
          <span className="tiny">macht Vorschläge, du bestätigst</span>
        </div>
        <button type="button" className="link-btn" style={{ minWidth: 60, textAlign: 'right' }} onClick={() => confirm('Neues Gespräch beginnen?') && update([])}>Neu</button>
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
            Sag oder schreib mir, was du vorhast, z.B. „Erinnere mich Freitag an den Friseur“, „Ich war heute laufen“ oder „Leg ein Projekt für die Brasilien-Reise an“. Ich schlage dir die Änderungen vor, und du bestätigst.
          </div>
        )}

        {items.map((it) =>
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
              {it.actions && it.actions.length > 0 && (
                <div className="proposal">
                  <span className="eyebrow" style={{ color: 'var(--accent)' }}>Vorschlag</span>
                  {it.actions.map((a, i) => {
                    const info = describe(s, a);
                    const open = it.status === 'open';
                    return (
                      <label key={i} className="prop-row" style={{ opacity: info.ok ? 1 : 0.5 }}>
                        <input type="checkbox" checked={!!it.selected?.[i] && info.ok} disabled={!open || !info.ok} onChange={() => toggleSel(it.id, i)} />
                        <span>{info.label}{!info.ok && ' (nicht möglich)'}</span>
                      </label>
                    );
                  })}
                  {it.status === 'open' && (
                    <div className="btn-row">
                      <button type="button" className="btn small" onClick={() => decide(it.id, true)} disabled={!it.actions.some((a, i) => it.selected[i] && describe(s, a).ok)}>
                        Übernehmen
                      </button>
                      <button type="button" className="btn small sec" style={{ background: 'var(--card-2)' }} onClick={() => decide(it.id, false)}>Verwerfen</button>
                    </div>
                  )}
                  {it.status === 'applied' && <span className="sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Übernommen</span>}
                  {it.status === 'rejected' && <span className="sub">Verworfen</span>}
                  {it.status === 'skipped' && <span className="sub">Nicht übernommen</span>}
                </div>
              )}
            </div>
          )
        )}
        {busy && <div className="bubble ai typing" aria-label="Denkt nach"><span /><span /><span /></div>}
        <div ref={endRef} />
      </main>

      <footer className="composer">
        {items.length === 0 && hasKey && (
          <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2 }}>
            {SUGGESTIONS.map((x) => (
              <button key={x} type="button" className="chip" style={{ flexShrink: 0, background: 'var(--card-2)' }} onClick={() => (x.endsWith(': ') ? (setText(x), inputRef.current?.focus()) : send(x))}>
                {x.replace(': ', '')}
              </button>
            ))}
          </div>
        )}
        <form className="composer-row" onSubmit={(e) => { e.preventDefault(); recRef.current?.stop(); send(); }}>
          <button type="button" className={listening ? 'mic on' : 'mic'} onClick={toggleMic} disabled={!hasKey || busy} aria-label={listening ? 'Aufnahme beenden' : 'Sprechen'} aria-pressed={listening}>
            <Icon name={listening ? 'stop' : 'mic'} size={19} color="currentColor" width={2} />
          </button>
          <textarea
            ref={inputRef}
            className="input"
            rows={1}
            value={text}
            placeholder={listening ? 'Ich höre zu …' : 'Nachricht …'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); } }}
            aria-label="Nachricht an den Assistenten"
            disabled={!hasKey}
          />
          <button type="submit" className="send" disabled={!text.trim() || busy || !hasKey} aria-label="Senden">
            <Icon name="send" size={18} color="currentColor" width={2.2} />
          </button>
        </form>
      </footer>
    </div>
  );
}
