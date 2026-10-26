// „Dein Überblick“ auf Heute: pro Bereich eine kurze, strukturierte Text-Übersicht (KI ohne Internet, einmal am Tag automatisch)
import { useEffect, useState } from 'react';
import { askOverview, loadOverview, localOverview, secOf } from '../lib/overview';
import { getAi } from '../lib/ai';
import { today } from '../lib/dates';
import { Chevron, Icon } from './ui';

let running = null;

export default function Overview({ s }) {
  const [v, setV] = useState(loadOverview);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const hasKey = !!getAi().apiKey;
  const fresh = v && v.date === today() && v.kind === 'text';
  const run = async () => {
    if (running) return;
    setBusy(true);
    setErr(null);
    running = askOverview(s);
    try {
      setV(await running);
    } catch (e) {
      setErr(e.message === 'KEIN_SCHLUESSEL' ? null : e.message);
    } finally {
      running = null;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (hasKey && getAi().autoCoach !== false && !fresh) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const data = fresh ? v : localOverview(s);
  const sections = (data.sections || []).filter((x) => secOf(x.key) && x.text);

  return (
    <section className="card checkin" style={{ gap: 10 }}>
      <div className="sec-h" style={{ padding: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <span className="spark"><Icon name="sparkle" size={16} color="currentColor" /></span> Dein Überblick
        </span>
        {hasKey && <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={run} disabled={busy} aria-label="Überblick aktualisieren"><Icon name="refresh" size={15} /></button>}
      </div>
      {busy && <div className="coach-busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="sub">Ich gehe deine Bereiche durch …</span></div>}
      {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      {!busy && data.lage && <p className="coach-summary">{data.lage}</p>}
      {!busy && sections.map((x) => {
        const info = secOf(x.key);
        return (
          <div key={x.key} className="ov-sec">
            <a href={info.link} className="ov-head"><Icon name={info.icon} size={15} color="var(--accent)" /><span style={{ flex: 1 }}>{info.name}</span><Chevron /></a>
            <p className="ov-text">{x.text}</p>
          </div>
        );
      })}
      {!busy && !sections.length && <span className="sub">Gerade ist nichts eingetragen, das ansteht.</span>}
      {!busy && fresh && <span className="tiny">Stand {new Date(v.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Pfeil oben für eine neue Übersicht (ohne Internet, unter 0,5 Cent)</span>}
      {!hasKey && <span className="tiny">Ohne API-Schlüssel listet die App die offenen Punkte selbst auf.</span>}
    </section>
  );
}
