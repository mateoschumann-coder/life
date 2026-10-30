// v1.35 (Mateo, Punkt 7): überall dieselbe Suchkarte
//   🎙 [ Suchfeld ] ⚡        ← sprechen · tippen · Schnellwahl
//   Filter (Stadt, Zeit …)    ← nur wo nötig
//   [🔗 Links · gratis] [✨ KI · ~3 ct]   ← man entscheidet beim Suchen, kein Umschalter vorher
// Darunter zeigt die Seite das Ergebnis der zuletzt gewählten Art (mode).
import { getAi } from '../lib/ai';
import MicBtn from './MicBtn';
import QuickSheet from './QuickSheet';
import { Info } from './ui';

export default function SearchCard({ title, q, setQ, placeholder, quick, filters, mode, onLinks, onAi, aiLabel = '✨ KI', aiCost, linksLabel = '🔗 Links', kiPlaceholder, busy, hint, children, emptyOk = true }) {
  const hasKey = !!getAi().apiKey;
  const canAi = hasKey && !busy && (emptyOk || q.trim());
  const doLinks = (t = q) => onLinks?.(t);
  const doAi = (t = q) => { if (hasKey && !busy) onAi?.(t); };
  return (
    <section className="card search-card" style={{ gap: 8, padding: 12 }}>
      {title && <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>}
      <form className="search-row1" onSubmit={(e) => { e.preventDefault(); if (mode === 'ki' && hasKey) doAi(); else doLinks(); }}>
        <MicBtn value={q} onChange={setQ} onDone={(t) => (mode === 'ki' && hasKey ? doAi(t) : doLinks(t))} />
        <input className="input" type="search" enterKeyHint="search" style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'ki' && kiPlaceholder ? kiPlaceholder : placeholder} aria-label="Wonach suchen" />
        {quick}
      </form>
      {filters}
      <div className="search-acts">
        <button type="button" className={mode === 'links' ? 'btn small' : 'btn small tint'} onClick={() => doLinks()}>{linksLabel}</button>
        <button type="button" className={mode === 'ki' ? 'btn small' : 'btn small tint'} disabled={!canAi} onClick={() => doAi()}>{busy ? '…' : aiLabel}</button>
        {hint && <Info>{hint}</Info>}
      </div>
      {!hasKey && <a href="#/einstellungen" className="link-btn" style={{ fontSize: 13 }}>Für die KI: Schlüssel hinterlegen</a>}
      {children}
    </section>
  );
}

// ⚡ mit den Vorschlägen eines Seiten-Bereichs (SOURCE_AREAS[area].chips) bzw. eigener Liste
export function QuickChips({ chips, q, setQ, title = 'Schnell suchen' }) {
  if (!chips?.length) return null;
  return <QuickSheet label="⚡" title={title}>{(close) => <div className="chips">{chips.map((c) => <button key={c} type="button" className={q === c ? 'chip on' : 'chip soft'} onClick={() => { setQ(c); close(); }}>{c}</button>)}</div>}</QuickSheet>;
}
