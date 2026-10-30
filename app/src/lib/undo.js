// v1.30 (Mateo): Löschen ohne Nachfrage – stattdessen kurz „↶ Rückgängig“ im Hinweis unten.
// askDel(msg) ersetzt confirm(msg): merkt sich den Stand davor und gibt sofort „ja“ zurück.
import { store } from './store';

let pending = null;
export function askDel(msg) {
  const snap = store.get();
  const label = String(msg || '').replace(/\?.*$/s, '').replace(/^(Wirklich\s+)?/, '');
  clearTimeout(pending);
  pending = setTimeout(() => {
    if (store.get() === snap) return; // nichts geändert
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { text: label.match(/löschen|entfernen|auflösen/i) ? `${label.replace(/\s*(endgültig\s+)?(löschen|entfernen|auflösen)$/i, '')} – erledigt` : 'Erledigt', action: '↶ Rückgängig', onAction: () => store.replace(snap) } }));
  }, 30);
  return true;
}
