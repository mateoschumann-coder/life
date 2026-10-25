// Projekt-Bausteine: frei kombinierbare Inhalte pro Projekt (von Hand oder von der KI vorgeschlagen)
import { store, uid } from './store';
import { today } from './dates';

export const BLOCK_TYPES = {
  kennzahl: { label: 'Kennzahl mit Graph', icon: 'chart', desc: 'z.B. Wochenkilometer, Gewicht, Lernminuten – mit Verlauf' },
  liste: { label: 'Liste', icon: 'list', desc: 'z.B. Ideen, Packliste, Bücher – zum Abhaken' },
  zaehler: { label: 'Zähler', icon: 'plusCircle', desc: 'z.B. Bewerbungen, Treffen – mit Ziel' },
  meilensteine: { label: 'Meilensteine', icon: 'flag', desc: 'Wichtige Etappen mit Datum' },
  budget: { label: 'Budget', icon: 'wallet', desc: 'Ausgaben gegen ein Limit' },
  notiz: { label: 'Notiz', icon: 'edit', desc: 'Freier Text, z.B. Ziel oder Plan' },
};

// Baut einen neuen Baustein aus einer einfachen Beschreibung (auch aus KI-Vorschlägen)
export function makeBlock({ typ, titel, einheit, ziel, punkte, text }) {
  const base = { id: uid(), type: BLOCK_TYPES[typ] ? typ : 'notiz', title: (titel || BLOCK_TYPES[typ]?.label || 'Baustein').trim() };
  switch (base.type) {
    case 'kennzahl':
      return { ...base, unit: einheit || '', goal: Number(ziel) || null, entries: [] };
    case 'zaehler':
      return { ...base, goal: Number(ziel) || null, count: 0, log: [] };
    case 'budget':
      return { ...base, limit: Number(ziel) || 0, unit: einheit || '$', items: [] };
    case 'liste':
      return { ...base, items: (punkte || []).map((p) => ({ id: uid(), text: String(p), done: false })) };
    case 'meilensteine':
      return { ...base, items: (punkte || []).map((p) => ({ id: uid(), text: typeof p === 'string' ? p : p.text, date: typeof p === 'string' ? null : p.datum || null, done: false })) };
    default:
      return { ...base, text: text || '' };
  }
}

export function addBlocks(projectId, blocks) {
  store.update((s) => {
    const p = s.projects.find((x) => x.id === projectId);
    if (!p) return;
    p.blocks = [...(p.blocks || []), ...blocks];
  });
}
// fn bekommt eine veränderbare Kopie des Bausteins
export function editBlock(projectId, blockId, fn) {
  store.update((s) => {
    const p = s.projects.find((x) => x.id === projectId);
    const b = p?.blocks?.find((x) => x.id === blockId);
    if (b) fn(b);
    if (b) p.lastActivity = today();
  });
}
export function removeBlock(projectId, blockId) {
  store.update((s) => {
    const p = s.projects.find((x) => x.id === projectId);
    if (p) p.blocks = (p.blocks || []).filter((x) => x.id !== blockId);
  });
}
export function moveBlock(projectId, blockId, dir) {
  store.update((s) => {
    const p = s.projects.find((x) => x.id === projectId);
    const i = p.blocks.findIndex((x) => x.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.blocks.length) return;
    [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]];
  });
}
