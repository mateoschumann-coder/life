// v1.53: Fängt Anzeigefehler einer Seite ab – statt weißem Bildschirm eine Meldung mit Ausweg.
// Deine Daten sind davon nicht betroffen (gespeichert wird unabhängig von der Anzeige).
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Anzeigefehler', error, info?.componentStack); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error);
    return (
      <main className="screen" style={{ gap: 12 }}>
        <h1 className="h1">Diese Seite hat einen Fehler</h1>
        <section className="card" style={{ gap: 8 }}>
          <span className="sub">Deine Daten sind sicher – nur die Anzeige dieser Seite ist hängen geblieben.</span>
          <code style={{ fontSize: 12, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{msg}</code>
          <a className="btn" href="#/heute" onClick={() => this.setState({ error: null })}>Zu Heute</a>
          <button type="button" className="btn tint" onClick={() => location.reload()}>Neu laden</button>
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { try { navigator.clipboard.writeText(`Life-Fehler (${location.hash}): ${msg}`); } catch {} }}>Fehlertext für Claude kopieren</button>
        </section>
      </main>
    );
  }
}
