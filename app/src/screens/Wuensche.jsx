import { useState } from 'react';
import { useStore } from '../lib/store';
import { fmtShort } from '../lib/dates';
import { addWish, deleteWish, toggleWish } from '../lib/actions';
import { Back, Check, Icon, TabBar, toast } from '../components/ui';

// Wunschliste: Ideen für Änderungen an der App selbst, gesammelt im Alltag
export default function Wuensche() {
  const s = useStore();
  const [text, setText] = useState('');
  const open = s.wishes.filter((w) => !w.done);
  const done = s.wishes.filter((w) => w.done);

  const copy = async () => {
    const list = open.map((w, i) => `${i + 1}. ${w.text}`).join('\n');
    const message = `Wünsche für meine Life-App (Repository mateoschumann-coder/life):\n${list}`;
    try {
      await navigator.clipboard.writeText(message);
      toast('Liste kopiert – jetzt im Claude-Chat einfügen');
    } catch {
      if (navigator.share) navigator.share({ text: message }).catch(() => {});
      else alert(message);
    }
  };

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/einstellungen" label="Einstellungen" />
          <h1 className="h1">App-Wünsche</h1>
        </div>
        <span className="sub" style={{ padding: '0 4px', lineHeight: 1.45 }}>
          Sammle hier, was sich an der App ändern soll – selbst eintragen oder dem Assistenten sagen: „Notier als App-Wunsch: …“. Zum Umsetzen die Liste kopieren und im Chat mit Claude einfügen.
        </span>

        <section className="list">
          {open.length === 0 && <div className="empty">Keine offenen Wünsche.</div>}
          {open.map((w) => (
            <div key={w.id} className="row">
              <Check on={false} onClick={() => toggleWish(w.id)} label={`Als umgesetzt markieren: ${w.text}`} />
              <div className="row-main">
                <span className="row-title">{w.text}</span>
                <span className="row-meta">{fmtShort(w.createdAt.slice(0, 10))}</span>
              </div>
              <button type="button" className="x-btn" aria-label={`${w.text} löschen`} onClick={() => deleteWish(w.id)}>
                <Icon name="x" size={14} color="var(--chev)" />
              </button>
            </div>
          ))}
          <form className="inline-add" onSubmit={(e) => { e.preventDefault(); addWish(text); setText(''); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Neuer Wunsch …" aria-label="Neuer Wunsch" />
            <button type="submit" className="btn small" disabled={!text.trim()}>+</button>
          </form>
        </section>

        <button type="button" className="btn" disabled={open.length === 0} onClick={copy}>Liste für Claude kopieren</button>

        {done.length > 0 && (
          <section className="group">
            <div className="sec-h"><h2 className="label">Umgesetzt</h2></div>
            <div className="list">
              {done.map((w) => (
                <div key={w.id} className="row">
                  <Check on onClick={() => toggleWish(w.id)} color="var(--accent)" label={`Wieder öffnen: ${w.text}`} />
                  <div className="row-main"><span className="row-title done">{w.text}</span></div>
                  <button type="button" className="x-btn" aria-label={`${w.text} löschen`} onClick={() => deleteWish(w.id)}>
                    <Icon name="x" size={14} color="var(--chev)" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <TabBar />
    </>
  );
}
