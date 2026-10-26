// KI-Planer im Gespräch: sprechen oder tippen → Antwort + Vorschläge zum Abhaken und Übernehmen
import { useState } from 'react';
import { getAi } from '../lib/ai';
import { useDictation } from '../lib/dictate';
import { Icon, toast } from './ui';

const mid = () => Math.random().toString(36).slice(2, 10);

// groups: [{ key, label, title: (x) => string, meta?: (x) => string }]
export default function PlanChat({ title = 'Mit KI planen', intro, history = [], onSave, onAsk, groups, onApply, chips = [], placeholder = 'Sag oder schreib, was du brauchst …', busyText = 'Ich denke nach und recherchiere … (ca. 20–40 Sek.)' }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const mic = useDictation(text, setText);
  const hasKey = !!getAi().apiKey;

  const send = async (msg) => {
    const q = String(msg ?? text).trim();
    if (!q || busy) return;
    mic.stop();
    setErr(null);
    const user = { id: mid(), role: 'user', text: q };
    const hist = [...history, user];
    onSave(hist);
    setText('');
    setBusy(true);
    try {
      // fürs Gespräch: nur die letzten 12 Nachrichten, beginnend mit einer eigenen Nachricht
      let ctx = hist.slice(-12);
      while (ctx.length && ctx[0].role !== 'user') ctx = ctx.slice(1);
      const r = await onAsk(ctx);
      const { antwort, ...rest } = r || {};
      const proposal = {};
      for (const g of groups) if (Array.isArray(rest[g.key]) && rest[g.key].length) proposal[g.key] = rest[g.key];
        else if (typeof rest[g.key] === 'string' && rest[g.key].trim()) proposal[g.key] = [rest[g.key]];
      const names = Object.entries(proposal).map(([k, list]) => `${groups.find((g) => g.key === k).label}: ${list.map((x) => groups.find((g) => g.key === k).title(x)).join('; ')}`).join(' | ');
      const picked = Object.fromEntries(Object.entries(proposal).map(([k, list]) => [k, list.map(() => true)]));
      onSave([...hist, { id: mid(), role: 'assistant', text: (antwort || 'Hier sind meine Vorschläge.') + (names ? `\n[Vorgeschlagen – ${names}]` : ''), shown: antwort || 'Hier sind meine Vorschläge.', proposal, picked, applied: false }]);
    } catch (e) {
      onSave(history); // Frage wieder heraus, damit das Gespräch gültig bleibt
      setText(q);
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (msgId, key, i) => onSave(history.map((m) => (m.id === msgId ? { ...m, picked: { ...m.picked, [key]: m.picked[key].map((v, j) => (j === i ? !v : v)) } } : m)));
  const apply = (m) => {
    const sel = Object.fromEntries(Object.entries(m.proposal).map(([k, list]) => [k, list.filter((_, i) => m.picked[k][i])]));
    const isText = (k) => typeof m.proposal[k][0] === 'string' && groups.find((g) => g.key === k)?.single;
    for (const k of Object.keys(sel)) if (isText(k)) sel[k] = sel[k][0] || '';
    onApply(sel);
    onSave(history.map((x) => (x.id === m.id ? { ...x, applied: true } : x)));
    toast('Übernommen');
  };

  const visible = showAll ? history : history.slice(-4);
  return (
    <section className="card checkin" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="spark"><Icon name="sparkle" size={15} color="currentColor" /></span>
        <span style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>{title}</span>
        {history.length > 0 && <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => confirm('Gespräch löschen? Übernommene Einträge bleiben.') && onSave([])}>Neu beginnen</button>}
      </div>
      {history.length === 0 && intro && <span className="sub">{intro}</span>}
      {history.length > 4 && !showAll && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowAll(true)}>Ältere Nachrichten zeigen</button>}
      {visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((m) => (m.role === 'user' ? (
            <div key={m.id} className="bubble me" style={{ fontSize: 15 }}>{m.text}</div>
          ) : (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="bubble ai" style={{ fontSize: 15, maxWidth: '100%' }}>{m.shown || m.text}</div>
              {Object.keys(m.proposal || {}).length > 0 && (
                <div className="proposal">
                  {groups.filter((g) => m.proposal[g.key]).map((g) => (
                    <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="label" style={{ padding: 0 }}>{g.label}</span>
                      {m.proposal[g.key].map((x, i) => (
                        <label key={i} className="option" style={{ opacity: m.applied ? 0.6 : 1 }}>
                          <input type="checkbox" checked={!!m.picked?.[g.key]?.[i]} disabled={m.applied} onChange={() => toggle(m.id, g.key, i)} />
                          <span className="row-main">
                            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: g.single ? 'pre-wrap' : undefined }}>{g.title(x)}</span>
                            {g.meta && g.meta(x) && <span className="tiny">{g.meta(x)}</span>}
                          </span>
                          {x?.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen" onClick={(e) => e.stopPropagation()}><Icon name="link" size={15} color="var(--accent)" /></a>}
                        </label>
                      ))}
                    </div>
                  ))}
                  {m.applied ? <span className="tiny" style={{ color: '#2FA36B', fontWeight: 600 }}>✓ Übernommen</span> : (
                    <button type="button" className="btn small" onClick={() => apply(m)} disabled={!Object.values(m.picked || {}).some((l) => l.some(Boolean))}>
                      Ausgewählte übernehmen ({Object.values(m.picked || {}).reduce((n, l) => n + l.filter(Boolean).length, 0)})
                    </button>
                  )}
                </div>
              )}
            </div>
          )))}
        </div>
      )}
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{busyText}</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {mic.error && <span className="sub" style={{ color: 'var(--danger)' }}>{mic.error}</span>}
      {!busy && chips.length > 0 && (
        <div className="box-tabs">
          {chips.map((c) => <button key={c} type="button" className="chip soft" style={{ whiteSpace: 'nowrap' }} disabled={!hasKey} onClick={() => send(c)}>{c}</button>)}
        </div>
      )}
      <form className="block-add" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <button type="button" className={mic.on ? 'mic on' : 'mic'} onClick={mic.toggle} aria-label={mic.on ? 'Zuhören beenden' : 'Sprechen'} disabled={busy}>
          <Icon name={mic.on ? 'stop' : 'mic'} size={18} />
        </button>
        <textarea className="input plan-input" rows={1} value={text} ref={(el) => { if (el) { el.style.height = '42px'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; } }} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Nachricht an die KI" />
        <button type="submit" className="btn small" disabled={busy || !text.trim() || !hasKey} aria-label="Senden"><Icon name="send" size={16} color="currentColor" /></button>
      </form>
      {!hasKey && <span className="tiny">Für den KI-Planer braucht es einen API-Schlüssel (Einstellungen).</span>}
    </section>
  );
}
