// KI-Planer im Gespräch: sprechen oder tippen → Antwort + Vorschläge zum Abhaken und Übernehmen
import { useEffect, useRef, useState } from 'react';
import { getAi } from '../lib/ai';
import { useDictation } from '../lib/dictate';
import { Icon, toast } from './ui';

const mid = () => Math.random().toString(36).slice(2, 10);
const PREF_KEY = 'life-app-chatprefs';
const loadPrefs = (k) => {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}')[k] || {};
  } catch {
    return {};
  }
};
const savePrefs = (k, v) => {
  try {
    const all = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    all[k] = v;
    localStorage.setItem(PREF_KEY, JSON.stringify(all));
  } catch {}
};

// groups: [{ key, label, title: (x) => string, meta?: (x) => string, links?: (x) => [{ label, url }] }]
export default function PlanChat({ title = 'Mit KI planen', intro, history = [], onSave, onAsk, groups, onApply, chips = [], webChips = [], placeholder = 'Sag oder schreib, was du brauchst …', prefKey = 'allgemein', lang = 'de-DE', autoSend = null, hideToggles = false, autoWeb = null, compact = false, extra = null, maxChips = 4, sendRef = null }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showAll, setShowAll] = useState(false);
  // Einstellungen pro Chat (bleiben gespeichert): Internet-Suche (kostet extra) und gründliches Modell (Sonnet, teurer)
  const [prefs, setPrefs] = useState(() => loadPrefs(prefKey));
  const { web = false, smart = false } = prefs;
  const setPref = (patch) => { const next = { ...prefs, ...patch }; setPrefs(next); savePrefs(prefKey, next); };
  const [searching, setSearching] = useState(false);
  const mic = useDictation(text, setText, lang);
  const sentAuto = useRef(false);
  useEffect(() => {
    if (autoSend && !sentAuto.current && hasKey) { sentAuto.current = true; send(autoSend); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);
  const say = (t) => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t.split('💡')[0]);
      u.lang = lang;
      const v = speechSynthesis.getVoices().find((x) => x.lang?.replace('_', '-').startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch {}
  };
  const hasKey = !!getAi().apiKey;

  // base = Verlauf, an den angehängt wird (für „Nochmal mit Internet“ ohne die alte Antwort)
  const send = async (msg, forceWeb = false, base = history) => {
    const q = String(msg ?? text).trim();
    // autoWeb (z.B. Reisen): bei Flügen, Unterkünften, Preisen automatisch im Internet suchen – aktuelle Preise kennt die KI sonst nicht
    const useWeb = web || forceWeb || (!hideToggles && !!autoWeb && autoWeb.test(q));
    if (!q || busy) return;
    mic.stop();
    setErr(null);
    const user = { id: mid(), role: 'user', text: q };
    const hist = [...base, user];
    onSave(hist);
    setText('');
    setBusy(true);
    try {
      // fürs Gespräch: nur die letzten 12 Nachrichten, beginnend mit einer eigenen Nachricht
      let ctx = hist.slice(-12);
      while (ctx.length && ctx[0].role !== 'user') ctx = ctx.slice(1);
      setSearching(useWeb);
      const r = await onAsk(ctx, { web: useWeb, smart });
      const { antwort, ...rest } = r || {};
      const proposal = {};
      for (const g of groups) if (Array.isArray(rest[g.key]) && rest[g.key].length) proposal[g.key] = rest[g.key];
        else if (typeof rest[g.key] === 'string' && rest[g.key].trim()) proposal[g.key] = [rest[g.key]];
      const names = Object.entries(proposal).map(([k, list]) => `${groups.find((g) => g.key === k).label}: ${list.map((x) => groups.find((g) => g.key === k).title(x)).join('; ')}`).join(' | ');
      const picked = Object.fromEntries(Object.entries(proposal).map(([k, list]) => [k, list.map(() => false)]));
      onSave([...hist, { id: mid(), role: 'assistant', text: (antwort || 'Hier sind meine Vorschläge.') + (names ? `\n[Vorgeschlagen – ${names}]` : ''), shown: antwort || 'Hier sind meine Vorschläge.', proposal, picked, applied: false, web: useWeb }]);
    } catch (e) {
      onSave(base); // Frage wieder heraus, damit das Gespräch gültig bleibt
      setText(q);
      setErr(e.message === 'KEIN_SCHLUESSEL' ? 'Dafür braucht es einen API-Schlüssel (Einstellungen).' : e.message);
    } finally {
      setBusy(false);
    }
  };

  if (sendRef) sendRef.current = (t) => send(t);

  // Vorschlag selbst umschreiben (Stift): Text-Feld des Vorschlags ersetzen
  const [editing, setEditing] = useState(null); // { id, key, i, val }
  const mainKey = (x) => (typeof x === 'string' ? null : ['text', 'titel', 'name', 'ziel'].find((k) => typeof x?.[k] === 'string'));
  const saveEdit = () => {
    const { id, key, i, val } = editing;
    if (val.trim()) onSave(history.map((m) => (m.id === id ? { ...m, proposal: { ...m.proposal, [key]: m.proposal[key].map((x, j) => (j !== i ? x : typeof x === 'string' ? val.trim() : { ...x, [mainKey(x)]: val.trim() })) } } : m)));
    setEditing(null);
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

  // Nur der letzte Austausch (letzte eigene Nachricht + Antwort) – der Rest über „Ganzen Chat anzeigen“ (v0.44)
  const lastUser = history.map((m) => m.role).lastIndexOf('user');
  const cut = lastUser > 0 ? lastUser : 0;
  const visible = showAll ? history : history.slice(cut);
  const allChips = [...webChips.filter((c) => !chips.includes(c)), ...chips];
  const chipRow = !busy && allChips.length > 0 ? (
    <div className="box-tabs">
      {(compact ? allChips.slice(0, maxChips) : allChips).map((c) => <button key={c} type="button" className={compact ? 'chip soft small-chip' : 'chip soft'} style={{ whiteSpace: 'nowrap' }} disabled={!hasKey} onClick={() => send(c, webChips.includes(c))}>{webChips.includes(c) ? '🔍 ' : ''}{c}</button>)}
    </div>
  ) : null;
  return (
    <section className={compact ? 'card checkin plan-compact' : 'card checkin'} style={{ gap: compact ? 8 : 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: compact ? 'wrap' : undefined }}>
        <span className="spark"><Icon name="sparkle" size={compact ? 13 : 15} color="currentColor" /></span>
        <span style={{ fontWeight: 700, fontSize: compact ? 15 : 17, flex: 1 }}>{title}</span>
        {compact && !hideToggles && (
          <span style={{ display: 'flex', gap: 4 }}>
            <button type="button" className={web ? 'mini-chip on' : 'mini-chip'} aria-pressed={web} disabled={busy} onClick={() => setPref({ web: !web })} title={web ? 'Internet an: aktuelle Infos & Links, ca. 1–3 Cent mehr' : 'Ohne Internet: günstig'}>🔍 {web ? 'an' : 'aus'}</button>
            <button type="button" className={smart ? 'mini-chip on' : 'mini-chip'} aria-pressed={smart} disabled={busy} onClick={() => setPref({ smart: !smart })} title={smart ? 'Gründlich: besseres Modell, teurer' : 'Schnell: günstig'}>🧠 {smart ? 'Gründlich' : 'Schnell'}</button>
          </span>
        )}
        {history.length > 0 && <button type="button" className="link-btn" style={{ fontSize: compact ? 13 : 14 }} onClick={() => confirm('Gespräch löschen? Übernommene Einträge bleiben.') && onSave([])}>{compact ? 'Neu' : 'Neu beginnen'}</button>}
      </div>
      {history.length === 0 && intro && <span className={compact ? 'tiny' : 'sub'}>{intro}</span>}
      {cut > 0 && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Nur die letzte Antwort zeigen' : `Ganzen Chat anzeigen (${history.length} Nachrichten)`}</button>}
      {visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((m, vi) => (m.role === 'user' ? (
            <div key={m.id} className="bubble me" style={{ fontSize: 15 }}>{m.text}</div>
          ) : (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="bubble ai" style={{ fontSize: 15, maxWidth: '100%' }}>{m.shown || m.text}{lang !== 'de-DE' && <button type="button" className="say-btn" onClick={() => say(m.shown || m.text)} aria-label="Vorlesen"><Icon name="speaker" size={14} /></button>}</div>
              {!hideToggles && !m.web && !m.applied && !busy && vi === visible.length - 1 && history.length >= 2 && history[history.length - 2].role === 'user' && (
                <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} disabled={!hasKey} onClick={() => send(history[history.length - 2].text, true, history.slice(0, -2))}>🔍 Nochmal mit Internet suchen (aktuelle Preise & Links)</button>
              )}
              {m.web && <span className="tiny" style={{ paddingLeft: 4 }}>🔍 mit Internet gesucht</span>}
              {Object.keys(m.proposal || {}).length > 0 && (
                <div className="proposal">
                  {groups.filter((g) => m.proposal[g.key]).map((g) => (
                    <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="label" style={{ padding: 0 }}>{g.label}</span>
                      {m.proposal[g.key].map((x, i) => (editing && editing.id === m.id && editing.key === g.key && editing.i === i ? (
                        <form key={i} className="block-add" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                          <input className="input" autoFocus value={editing.val} onChange={(e) => setEditing({ ...editing, val: e.target.value })} aria-label="Vorschlag bearbeiten" />
                          <button type="submit" className="btn small">OK</button>
                        </form>
                      ) : (
                        <label key={i} className="option" style={{ opacity: m.applied ? 0.6 : 1 }}>
                          <input type="checkbox" checked={!!m.picked?.[g.key]?.[i]} disabled={m.applied} onChange={() => toggle(m.id, g.key, i)} />
                          <span className="row-main">
                            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: g.single ? 'pre-wrap' : undefined }}>{g.title(x)}</span>
                            {g.meta && g.meta(x) && <span className="tiny">{g.meta(x)}</span>}
                            {g.links && g.links(x).length > 0 && <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>{g.links(x).map((l) => <a key={l.url} className="pill" style={{ fontSize: 12.5, padding: '3px 9px' }} href={l.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{l.label}</a>)}</span>}
                          </span>
                          {x?.url && <a className="x-btn" href={x.url} target="_blank" rel="noreferrer" aria-label="Link öffnen" onClick={(e) => e.stopPropagation()}><Icon name="link" size={15} color="var(--accent)" /></a>}
                          {!m.applied && (typeof x === 'string' || mainKey(x)) && <button type="button" className="x-btn" aria-label="Vorschlag bearbeiten" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing({ id: m.id, key: g.key, i, val: typeof x === 'string' ? x : x[mainKey(x)] }); }}><Icon name="edit" size={14} color="var(--muted)" /></button>}
                        </label>
                      )))}
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
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">{searching ? 'Ich suche im Internet und plane … (ca. 20–40 Sek.)' : 'Ich denke nach … (ca. 5–10 Sek.)'}</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {mic.error && <span className="sub" style={{ color: 'var(--danger)' }}>{mic.error}</span>}
      {!compact && chipRow}
      {extra}
      {!hideToggles && !compact && <div className="ai-toggles">
        <button type="button" className={web ? 'chip on' : 'chip soft'} aria-pressed={web} disabled={busy} onClick={() => setPref({ web: !web })}>🔍 Internet {web ? 'an' : 'aus'}</button>
        <button type="button" className={smart ? 'chip on' : 'chip soft'} aria-pressed={smart} disabled={busy} onClick={() => setPref({ smart: !smart })}>🧠 {smart ? 'Gründlich' : 'Schnell'}</button>
        <span className="tiny" style={{ flex: 1, minWidth: 140 }}>{[web ? 'Internet: aktuelle Infos & Links, ca. 1–3 Cent mehr' : autoWeb ? 'Ohne Internet: aus KI-Wissen – bei Flügen, Unterkünften und Preisen sucht die KI automatisch im Internet' : 'Ohne Internet: aus KI-Wissen, günstig', smart ? 'Gründlich: besseres Modell, ca. 20× teurer' : null].filter(Boolean).join(' · ')}</span>
      </div>}
      <form className="block-add" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <button type="button" className={mic.on ? 'mic on' : 'mic'} onClick={mic.toggle} aria-label={mic.on ? 'Zuhören beenden' : 'Sprechen'} disabled={busy}>
          <Icon name={mic.on ? 'stop' : 'mic'} size={18} />
        </button>
        <textarea className="input plan-input" rows={1} value={text} ref={(el) => { if (el) { el.style.height = '42px'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; } }} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Nachricht an die KI" />
        <button type="submit" className="btn small" disabled={busy || !text.trim() || !hasKey} aria-label="Senden"><Icon name="send" size={16} color="currentColor" /></button>
      </form>
      {compact && chipRow}
      {!hasKey && <span className="tiny">Für den KI-Planer braucht es einen API-Schlüssel (Einstellungen).</span>}
    </section>
  );
}
