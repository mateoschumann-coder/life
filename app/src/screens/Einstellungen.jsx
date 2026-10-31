import { fabOn, setFab } from '../lib/fab';
import { useRef, useState } from 'react';
import { store, useStore } from '../lib/store';
import { today } from '../lib/dates';
import { buildIcs } from '../lib/ics';
import { loadDemo } from '../lib/demo';
import { seed } from '../lib/seed';
import { Back, Chevron, Field, Segmented, TabBar, toast, Info } from '../components/ui';
import { ACCENTS, DARKS, MODES, setTheme, themeOf } from '../lib/theme';
import { autoCopyOn, setAutoCopy } from '../lib/fieldtools';
import { setTdKey, tdKey, testTdKey } from '../lib/markets';
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

const BUILD_ID = document.querySelector('script[src*="main.js"]')?.getAttribute('src')?.match(/v=([^&]+)/)?.[1] || 'dev';
async function forceUpdate() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys?.()) || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {}
  location.replace(location.pathname + '?u=' + Date.now() + location.hash);
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

  // v1.41: „Komplett“ nimmt auch die Geräte-Einstellungen mit (API-Schlüssel, Aussehen, gemerkte Reiter …) – für den Umzug beim neuen App-Symbol
  const [full, setFull] = useState(false);
  const deviceData = () => { const d = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('life-') && k !== 'life-app-v1' && !k.startsWith('life-td-')) d[k] = localStorage.getItem(k); } } catch {} return d; };
  const exportJson = () => shareFile(full ? `life-komplett-${today()}.json` : `life-backup-${today()}.json`, JSON.stringify(full ? { ...s, _device: deviceData() } : s, null, 2), 'application/json');
  const exportIcs = () => shareFile('life-kalender.ics', buildIcs(s), 'text/calendar');
  const importJson = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.areas || !data.pillars) throw new Error('Keine Life-Sicherung');
        if (confirm(data._device ? 'Komplette Sicherung laden? Daten und Einstellungen (inkl. Schlüssel) auf diesem Gerät werden ersetzt.' : 'Sicherung laden? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) {
          const { _device: dev, ...rest } = data;
          store.replace(rest);
          if (dev) { try { Object.entries(dev).forEach(([k, v]) => { if (k.startsWith('life-') && k !== 'life-app-v1' && typeof v === 'string') localStorage.setItem(k, v); }); } catch {} toast('Sicherung geladen – Einstellungen werden übernommen …'); setTimeout(() => location.reload(), 900); }
          else toast('Sicherung geladen');
        }
      } catch {
        alert('Diese Datei ist keine gültige Sicherung.');
      }
      e.target.value = '';
    };
    reader.readAsText(f);
  };

  const costText = `ca. ${usage.cost < 0.01 ? 'unter 0,01' : usage.cost.toFixed(2).replace('.', ',')} $ diesen Monat`;
  return (
    <>
      <main className="screen">
        <Back href="#/heute" label="Heute" />
        <h1 className="h1">Einstellungen</h1>

        {/* v1.47 (Mateo): Wichtiges oben, Rest einklappbar */}
        <section className="card" style={{ gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="row-main"><span style={{ fontWeight: 700 }}>Life · Version 1.48</span><span className="tiny">Stand {BUILD_ID}</span></span>
            <button type="button" className="btn tint small" onClick={forceUpdate}>Neueste Version laden</button>
          </div>
        </section>

        <Group id="ki" title="KI-Assistent" sub={ai.apiKey ? `Schlüssel …${ai.apiKey.slice(-4)} · ${MODELS.find((m) => m.id === ai.model)?.label || ''}` : 'Noch kein Schlüssel'} defaultOpen>
          {ai.apiKey ? (
            <>
              <div className="field">
                <span>Modell</span>
                <Segmented full options={MODELS.map((m) => ({ id: m.id, label: m.label }))} value={ai.model} onChange={(v) => setAi(saveAi({ model: v }))} label="Modell" />
                <span className="tiny" style={{ paddingLeft: 4 }}>{MODELS.find((m) => m.id === ai.model)?.sub}{ai.model === MODELS[0].id ? ' – ideal für Alltagsbefehle' : ' – besser für größere Planungen, etwa 20× teurer'}</span>
              </div>
              <label className="option" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!ai.autoApply} onChange={(e) => setAi(saveAi({ autoApply: e.target.checked }))} />
                <span className="row-main">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Direkt ausführen, ohne Nachfrage</span>
                  <Info>Die KI setzt Änderungen sofort um; mit „Rückgängig“ machst du sie wieder weg</Info>
                </span>
              </label>
              <FabSetting />
            </>
          ) : (
            <>
              <span className="sub" style={{ lineHeight: 1.5 }}>Füge hier deinen API-Schlüssel von console.anthropic.com ein. Er wird nur auf diesem iPhone gespeichert, nicht im Code.</span>
              <input className="input" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="sk-ant-…" aria-label="API-Schlüssel" />
              <button type="button" className="btn" onClick={saveKey} disabled={!keyInput.trim() || testing}>{testing ? 'Prüfe …' : 'Prüfen und speichern'}</button>
            </>
          )}
          <a href="#/gedaechtnis" className="row" style={{ padding: '8px 0', minHeight: 0 }}>
            <span className="row-main"><span className="row-title">Was Life über dich weiß</span><span className="row-meta">{(s.memory || []).length} Einträge · Gedächtnis des Assistenten</span></span>
            <Chevron />
          </a>
        </Group>

        <Group id="backup" title="Sicherung" sub={counts} defaultOpen>
          <span className="sub" style={{ lineHeight: 1.5 }}>Deine Daten liegen nur auf diesem Gerät. Bis die Cloud kommt: ab und zu eine Sicherung in „Dateien“ oder iCloud Drive speichern.</span>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} data-noclear />
            <span>Komplett – auch Einstellungen und API-Schlüssel</span>
            <Info>Für den Umzug, z.B. nach dem Löschen und neu Hinzufügen der App: Dann musst du Schlüssel, Aussehen usw. nicht neu eingeben. Die Datei enthält deinen API-Schlüssel – nur in deinen eigenen Dateien/iCloud speichern, nicht weitergeben.</Info>
          </label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={exportJson}>{full ? 'Komplett speichern' : 'Sicherung speichern'}</button>
            <button type="button" className="btn tint" onClick={() => fileRef.current?.click()}>Sicherung laden</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={importJson} />
        </Group>

        <Group id="look" title="Aussehen & Name" sub="Hell/Dunkel, Farbe, Begrüßung">
          <Field label="Dein Name (für die Begrüßung)">
            <input className="input" value={s.profile?.name || ''} onChange={(e) => store.update((d) => { d.profile = { ...d.profile, name: e.target.value }; })} />
          </Field>
          <Appearance />
        </Group>

        <Group id="costs" title="KI-Kosten" sub={ai.apiKey ? `${usage.requests} Anfragen · ${costText}` : 'Erst mit Schlüssel'}>
          <span className="sub">Diesen Monat: {usage.requests} Anfragen · {usage.searches || 0} Internet-Suchen · {costText}</span>
          {usage.by && Object.keys(usage.by).length > 0 && (
            <div className="list" style={{ boxShadow: 'none', background: 'var(--fill)' }}>
              {Object.entries(usage.by).sort((a, b) => b[1].cost - a[1].cost).map(([k, v]) => (
                <div key={k} className="row" style={{ minHeight: 40 }}>
                  <span className="row-main"><span className="row-title plain" style={{ fontSize: 14.5 }}>{k}</span><span className="row-meta">{v.n}× · {v.searches} Suchen · Ø {((v.cost / v.n) * 100).toFixed(1).replace('.', ',')} Cent</span></span>
                  <span className="tiny" style={{ fontWeight: 600 }}>{(v.cost * 100).toFixed(1).replace('.', ',')} ct</span>
                </div>
              ))}
            </div>
          )}
          <Info>Internet-Suchen kosten je 1 Cent plus den gefundenen Text. Gesucht wird nur, wenn du eine KI-Suche startest oder „Mit Internet“ eingeschaltet ist.</Info>
        </Group>

        <Group id="more" title="Weitere Einstellungen" sub="Links, Börsenkurse, Kalender, Vorlagen, Wünsche">
          <LinkCopy />
          <MarketKey />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Apple-Kalender</span>
            <span className="sub" style={{ lineHeight: 1.5 }}>Kalender-Datei mit Geburtstagen, Aufgaben mit Datum und zugesagten Events. Auf dem iPhone öffnen → „Alle hinzufügen“.</span>
            <button type="button" className="btn tint small" style={{ alignSelf: 'flex-start' }} onClick={exportIcs}>Kalender-Datei erstellen</button>
          </div>
          <div className="list" style={{ boxShadow: 'none', background: 'var(--fill)' }}>
            <a href="#/vorlagen" className="row">
              <span className="row-main"><span className="row-title">Projekt-Vorlagen</span><span className="row-meta">{s.templates.length} Vorlagen</span></span>
              <Chevron />
            </a>
            <a href="#/wuensche" className="row">
              <span className="row-main"><span className="row-title">App-Wünsche</span><span className="row-meta">{s.wishes.filter((w) => !w.done).length} offen · Änderungen für Claude sammeln</span></span>
              <Chevron />
            </a>
          </div>
          {ai.apiKey && <button type="button" className="btn danger small" style={{ alignSelf: 'flex-start' }} onClick={() => confirm('KI-Schlüssel von diesem iPhone entfernen?') && setAi(saveAi({ apiKey: '' }))}>KI-Schlüssel entfernen</button>}
        </Group>

        <Group id="danger" title="Daten zurücksetzen" sub="Beispieldaten · Alles löschen">
          <span className="sub">Beispieldaten fügt Beispiel-Rhythmen, ein Projekt, Personen und ein Event hinzu (mit „Beispiel“ markiert).</span>
          <button type="button" className="btn tint small" style={{ alignSelf: 'flex-start' }} onClick={() => { loadDemo(); toast('Beispieldaten hinzugefügt'); }}>Beispieldaten hinzufügen</button>
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
        </Group>
      </main>
      <TabBar />
    </>
  );
}

// v1.47: einklappbare Gruppe; offen/zu wird pro Gruppe auf diesem Gerät gemerkt
function Group({ id, title, sub, defaultOpen = false, children }) {
  const key = 'life-app-settings-open';
  const [open, setOpenS] = useState(() => { try { const m = JSON.parse(localStorage.getItem(key) || '{}'); return id in m ? !!m[id] : defaultOpen; } catch { return defaultOpen; } });
  const toggle = () => { const v = !open; setOpenS(v); try { const m = JSON.parse(localStorage.getItem(key) || '{}'); m[id] = v; localStorage.setItem(key, JSON.stringify(m)); } catch {} };
  return (
    <section className="card" style={{ gap: 12 }}>
      <button type="button" onClick={toggle} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%' }}>
        <span className="row-main" style={{ gap: 2 }}>
          <span className="h2" style={{ fontSize: 18 }}>{title}</span>
          {sub && !open && <span className="tiny">{sub}</span>}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 15 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && children}
    </section>
  );
}

// v1.15 (Mateo): Aussehen – Modus, Stufen im dunklen Modus, Akzentfarbe
function Appearance() {
  const [t, setT] = useState(themeOf);
  const set = (patch) => { setTheme(patch); setT(themeOf()); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 600, flex: 1 }}>Hell oder dunkel</span><Info>„Schlicht“ macht auch die Bereichs-Symbole grau. Die Wahl gilt nur auf diesem iPhone.</Info></div>
      <Segmented full options={MODES} value={t.mode} onChange={(v) => set({ mode: v })} label="Hell oder dunkel" />
      <span className="label" style={{ padding: 0 }}>Dunkler Modus</span>
      <div className="list">
        {DARKS.map((d) => (
          <button key={d.id} type="button" className="row" style={{ textAlign: 'left', width: '100%', border: 0, background: 'transparent', gap: 12 }} onClick={() => set({ dark: d.id })} aria-pressed={t.dark === d.id}>
            <span className="theme-sw">{d.sw.map((c) => <span key={c} style={{ background: c }} />)}</span>
            <span className="row-main" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{d.label}</span>
              <span className="tiny">{d.hint}</span>
            </span>
            {t.dark === d.id && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>
      <span className="label" style={{ padding: 0 }}>Farbe</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ACCENTS.map((a) => (
          <button key={a.id} type="button" className={t.accent === a.id ? 'chip on' : 'chip'} style={{ gap: 7, display: 'inline-flex', alignItems: 'center', paddingLeft: 8 }} onClick={() => set({ accent: a.id })} aria-pressed={t.accent === a.id}>
            <span className="accent-dot" style={{ background: a.c }} />{a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// v1.29 (Mateo): schwebenden Assistenten an-/ausschalten (nur auf diesem Gerät)
function FabSetting() {
  const [on, setOn] = useState(fabOn);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 600, flex: 1 }}>Schwebender Assistent</span><Info>Ausgeschaltet erreichst du ihn, indem du den Blitz in der Mitte lange drückst (halten, sprechen, loslassen = senden), oder über die KI-Knöpfe in den Formularen.</Info></div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="checkbox" checked={on} onChange={(e) => { setFab(e.target.checked); setOn(e.target.checked); }} />
        <span>✨-Knopf unten rechts auf allen Seiten zeigen</span>
      </label>
    </div>
  );
}

// v1.16 (Mateo): Links, die man aus der App öffnet, automatisch kopieren
function LinkCopy() {
  const [on, setOn] = useState(autoCopyOn);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 600, flex: 1 }}>Links</span><Info>In Link-Feldern erscheint 📋 zum Einfügen. Ist die Zwischenablage leer, wird der zuletzt aus der App geöffnete Link eingesetzt.</Info></div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="checkbox" checked={on} onChange={(e) => { setAutoCopy(e.target.checked); setOn(e.target.checked); }} />
        <span>Geöffnete Links automatisch kopieren</span>
      </label>
    </div>
  );
}

// v1.34 (Mateo): Twelve-Data-Schlüssel für eigene Kurs-Charts in Finanzen (nur auf diesem Gerät)
function MarketKey() {
  const [has, setHas] = useState(() => !!tdKey());
  const [k, setK] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await testTdKey(k); setTdKey(k); setHas(true); setK(''); toast('Gespeichert – Finanzen zeigt jetzt eigene Charts'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 600, flex: 1 }}>Börsenkurse</span><Info>Kostenloser Schlüssel von twelvedata.com (bis 800 Abrufe am Tag, 8 pro Minute). Damit zeigt Finanzen → Märkte eigene Charts mit Veränderung für den gewählten Zeitraum. Indizes (NASDAQ, S&P 500, DAX …) gibt es kostenlos nur über ETFs, die den Index abbilden. Der Schlüssel bleibt nur auf diesem iPhone.</Info></div>
      {has ? (
        <>
          <span className="sub">✓ Twelve-Data-Schlüssel ist gespeichert.</span>
          <button type="button" className="btn danger small" onClick={() => { setTdKey(''); setHas(false); toast('Entfernt – Finanzen zeigt wieder TradingView'); }}>Schlüssel entfernen</button>
        </>
      ) : (
        <>
          <span className="sub" style={{ lineHeight: 1.5 }}>Ohne Schlüssel zeigt Finanzen die TradingView-Kästchen. Mit kostenlosem Schlüssel von <a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer">twelvedata.com</a> gibt es eigene, ruhige Charts.</span>
          <input className="input" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} value={k} onChange={(e) => setK(e.target.value)} placeholder="Twelve-Data-Schlüssel einfügen" aria-label="Twelve-Data-Schlüssel" />
          <button type="button" className="btn" onClick={save} disabled={!k.trim() || busy}>{busy ? 'Prüfe …' : 'Prüfen und speichern'}</button>
        </>
      )}
    </div>
  );
}
