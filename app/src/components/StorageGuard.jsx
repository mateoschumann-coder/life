// v1.52: Schutz für deine Daten.
// 1) Rettungsmodus (Laden ging schief): ganze Seite mit klaren Wegen – nichts wird überschrieben.
// 2) Speicherfehler: rote Leiste oben, bis das Speichern wieder klappt.
import { useRef, useState } from 'react';
import { storage, useStorageStatus } from '../lib/store';
import { parseBackup, summarize, writeDevice } from '../lib/backup';
import { shareFile } from '../lib/share';
import { today } from '../lib/dates';

export function SaveErrorBar() {
  const st = useStorageStatus();
  if (st.mode === 'rescue' || !st.saveError) return null;
  return (
    <div className="save-error" role="alert">
      <span style={{ flex: 1 }}>⚠️ {st.saveError} Deine letzten Änderungen sind evtl. nicht gesichert.</span>
      <button type="button" className="pill" onClick={() => storage.retry()}>Nochmal</button>
      <a className="pill" href="#/einstellungen">Sicherung</a>
    </div>
  );
}

export default function StorageGuard({ children }) {
  const st = useStorageStatus();
  const fileRef = useRef(null);
  const [err, setErr] = useState('');
  if (st.mode !== 'rescue') return children;
  const auto = storage.autoBackup();
  const loadText = (text, label) => {
    try {
      const { state, device } = parseBackup(text);
      if (!confirm(`${label} laden?\n\n${summarize(state)}`)) return;
      storage.restore(state);
      if (device) { writeDevice(localStorage, device); setTimeout(() => location.reload(), 300); }
    } catch (e) { setErr(e.message); }
  };
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => loadText(r.result, 'Diese Sicherung');
    r.readAsText(f);
    e.target.value = '';
  };
  return (
    <main className="screen" style={{ gap: 14 }}>
      <h1 className="h1">Deine Daten sind sicher – aber noch nicht geladen</h1>
      <section className="card" style={{ gap: 8 }}>
        <span style={{ fontWeight: 650 }}>Was ist passiert?</span>
        <span className="sub">{st.loadError}. Damit nichts verloren geht, speichert die App gerade <b>nichts</b> und lässt deinen alten Stand unangetastet.</span>
      </section>
      <section className="card" style={{ gap: 10 }}>
        <span style={{ fontWeight: 650 }}>So geht es weiter</span>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>📂 Sicherungsdatei laden</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFile} />
        {auto?.raw && <button type="button" className="btn tint" onClick={() => loadText(auto.raw, `Automatische Sicherung vom ${auto.day}`)}>🕓 Automatische Sicherung vom {auto.day} laden</button>}
        <button type="button" className="btn tint" onClick={() => shareFile(`life-rohdaten-${today()}.json`, storage.rescueRaw(), 'application/json')}>💾 Alte Rohdaten als Datei sichern</button>
        <button type="button" className="btn sec" onClick={() => location.reload()}>↻ Nochmal versuchen</button>
        <button type="button" className="link-btn" style={{ color: 'var(--danger)', alignSelf: 'flex-start' }} onClick={() => { if (confirm('Wirklich leer neu starten? Die alten Rohdaten bleiben auf dem Gerät aufbewahrt und lassen sich weiterhin als Datei sichern.')) storage.startFresh(); }}>Leer neu starten</button>
        {err && <span className="sub" style={{ color: 'var(--danger)' }}>{err}</span>}
      </section>
      <span className="tiny">Tipp: Die Rohdaten-Datei kannst du Claude schicken – daraus lässt sich der Stand meist reparieren.</span>
    </main>
  );
}
