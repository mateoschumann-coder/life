import { useRef, useState } from 'react';
import { store, useStore } from '../lib/store';
import { today } from '../lib/dates';
import { buildIcs } from '../lib/ics';
import { loadDemo } from '../lib/demo';
import { seed } from '../lib/seed';
import { Back, Chevron, Field, Segmented, TabBar, toast } from '../components/ui';
import { getAi, MODELS, monthUsage, saveAi, testKey } from '../lib/ai';

// Datei teilen (iPhone: „In Dateien sichern“, AirDrop …) oder herunterladen
async function shareFile(name, content, type) {
  const file = new File([content], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Einstellungen() {
  const s = useStore();
  const fileRef = useRef(null);
  const [ai, setAi] = useState(getAi);
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const usage = monthUsage();
  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setTesting(true);
    try {
      await testKey(key, ai.model);
      setAi(saveAi({ apiKey: key }));
      setKeyInput('');
      toast('Schlüssel funktioniert und ist gespeichert');
    } catch (e) {
      alert(e.message);
    } finally {
      setTesting(false);
    }
  };
  const counts = `${s.habits.length} Rhythmen · ${s.tasks.length} Aufgaben · ${s.projects.length} Projekte · ${s.people.length} Personen`;

  const exportJson = () => shareFile(`life-backup-${today()}.json`, JSON.stringify(s, null, 2), 'application/json');
  const exportIcs = () => shareFile('life-kalender.ics', buildIcs(s), 'text/calendar');
  const importJson = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.areas || !data.pillars) throw new Error('Keine Life-Sicherung');
        if (confirm('Sicherung laden? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) {
          store.replace(data);
          toast('Sicherung geladen');
        }
      } catch {
        alert('Diese Datei ist keine gültige Sicherung.');
      }
      e.target.value = '';
    };
    reader.readAsText(f);
  };

  return (
    <>
      <main className="screen">
        <Back href="#/heute" label="Heute" />
        <h1 className="h1">Einstellungen</h1>

        <section className="card">
          <Field label="Dein Name (für die Begrüßung)">
            <input className="input" value={s.profile?.name || ''} onChange={(e) => store.update((d) => { d.profile = { ...d.profile, name: e.target.value }; })} />
          </Field>
        </section>

        <section className="card">
          <h2 className="h2">KI-Assistent</h2>
          {ai.apiKey ? (
            <>
              <span className="sub">Schlüssel hinterlegt (…{ai.apiKey.slice(-4)}). Er liegt nur auf diesem iPhone.</span>
              <div className="field">
                <span>Modell</span>
                <Segmented full options={MODELS.map((m) => ({ id: m.id, label: m.label }))} value={ai.model} onChange={(v) => setAi(saveAi({ model: v }))} label="Modell" />
                <span className="tiny" style={{ paddingLeft: 4 }}>{MODELS.find((m) => m.id === ai.model)?.sub}{ai.model === MODELS[0].id ? ' – ideal für Alltagsbefehle' : ' – besser für größere Planungen, etwa 20× teurer'}</span>
              </div>
              <label className="option" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!ai.autoApply} onChange={(e) => setAi(saveAi({ autoApply: e.target.checked }))} />
                <span className="row-main">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Direkt ausführen, ohne Nachfrage</span>
                  <span className="tiny">Die KI setzt Änderungen sofort um; mit „Rückgängig“ machst du sie wieder weg</span>
                </span>
              </label>
              <label className="option" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={ai.autoCoach !== false} onChange={(e) => setAi(saveAi({ autoCoach: e.target.checked }))} />
                <span className="row-main">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Coach kommt jeden Tag von selbst</span>
                  <span className="tiny">Beim ersten Öffnen am Tag: Anstöße mit Websuche (ca. 3–5 Cent pro Tag)</span>
                </span>
              </label>
              <span className="sub">Diesen Monat: {usage.requests} Anfragen · ca. {usage.cost < 0.01 ? 'unter 0,01' : usage.cost.toFixed(2).replace('.', ',')} $</span>
              <button type="button" className="btn danger small" onClick={() => confirm('Schlüssel von diesem iPhone entfernen?') && setAi(saveAi({ apiKey: '' }))}>Schlüssel entfernen</button>
            </>
          ) : (
            <>
              <span className="sub" style={{ lineHeight: 1.5 }}>Füge hier deinen API-Schlüssel von console.anthropic.com ein. Er wird nur auf diesem iPhone gespeichert, nicht in Sicherungen und nicht im Code.</span>
              <input className="input" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="sk-ant-…" aria-label="API-Schlüssel" />
              <button type="button" className="btn" onClick={saveKey} disabled={!keyInput.trim() || testing}>{testing ? 'Prüfe …' : 'Prüfen und speichern'}</button>
            </>
          )}
        </section>

        <section className="list">
          <a href="#/gedaechtnis" className="row">
            <span className="row-main"><span className="row-title">Was Life über dich weiß</span><span className="row-meta">{(s.memory || []).length} Einträge · Grundlage für den Coach</span></span>
            <Chevron />
          </a>
          <a href="#/vorlagen" className="row">
            <span className="row-main"><span className="row-title">Projekt-Vorlagen</span><span className="row-meta">{s.templates.length} Vorlagen</span></span>
            <Chevron />
          </a>
          <a href="#/wuensche" className="row">
            <span className="row-main"><span className="row-title">App-Wünsche</span><span className="row-meta">{s.wishes.filter((w) => !w.done).length} offen · Änderungen für Claude sammeln</span></span>
            <Chevron />
          </a>
        </section>

        <section className="card">
          <h2 className="h2">Sicherung</h2>
          <span className="sub" style={{ lineHeight: 1.5 }}>
            Deine Daten liegen im Moment nur auf diesem Gerät ({counts}). Bis die Cloud-Synchronisation kommt: bitte ab und zu eine Sicherung in „Dateien“ oder iCloud Drive speichern.
          </span>
          <div className="btn-row">
            <button type="button" className="btn" onClick={exportJson}>Sicherung speichern</button>
            <button type="button" className="btn tint" onClick={() => fileRef.current?.click()}>Sicherung laden</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={importJson} />
        </section>

        <section className="card">
          <h2 className="h2">Apple-Kalender</h2>
          <span className="sub" style={{ lineHeight: 1.5 }}>
            Erstellt eine Kalender-Datei mit Geburtstagen (jährlich, mit Erinnerung), Aufgaben mit Datum und zugesagten Events. Auf dem iPhone öffnen → „Alle hinzufügen“.
          </span>
          <button type="button" className="btn tint" onClick={exportIcs}>Kalender-Datei erstellen</button>
        </section>

        <section className="card">
          <h2 className="h2">Ausprobieren</h2>
          <span className="sub">Fügt Beispiel-Rhythmen, ein Projekt, Personen und ein Event hinzu (mit „Beispiel“ markiert).</span>
          <button type="button" className="btn tint" onClick={() => { loadDemo(); toast('Beispieldaten hinzugefügt'); }}>Beispieldaten hinzufügen</button>
        </section>

        <section className="card">
          <h2 className="h2">Neu anfangen</h2>
          <span className="sub">Löscht alle Einträge auf diesem Gerät. Die Grundordnung bleibt.</span>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm('Wirklich alle Daten löschen?') && confirm('Sicher? Das lässt sich nicht rückgängig machen.')) {
                const fresh = seed();
                fresh.profile = s.profile;
                store.replace(fresh);
                toast('Alles gelöscht');
              }
            }}
          >
            Alle Daten löschen
          </button>
        </section>

        <span className="tiny" style={{ textAlign: 'center' }}>Life · Version 0.17 · Web-App</span>
      </main>
      <TabBar />
    </>
  );
}
