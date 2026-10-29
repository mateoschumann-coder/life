// v1.15 (Mateo): Aussehen der App – Hell/Dunkel/Automatisch, Stufen im dunklen Modus, Akzentfarbe
const KEY = 'life-app-theme';
export const MODES = [{ id: 'auto', label: 'Wie iPhone' }, { id: 'light', label: 'Hell' }, { id: 'dark', label: 'Dunkel' }];
export const DARKS = [
  { id: 'stufen', label: 'Abgestuft', hint: 'Grautöne – Karten, Felder und Hintergrund klar unterscheidbar', sw: ['#121417', '#1f2227', '#2c3036'] },
  { id: 'schwarz', label: 'Tiefschwarz', hint: 'Schwarzer Hintergrund wie bei iOS, spart Akku', sw: ['#000000', '#141416', '#232326'] },
  { id: 'blau', label: 'Nachtblau', hint: 'Der bisherige dunkle Stil mit leichtem Blau', sw: ['#0b0d12', '#161a22', '#1e232d'] },
];
export const ACCENTS = [
  { id: 'blau', label: 'Blau', c: '#2f5fd0' },
  { id: 'gruen', label: 'Grün', c: '#1f8a5b' },
  { id: 'lila', label: 'Lila', c: '#6a4bd6' },
  { id: 'orange', label: 'Orange', c: '#c95f2a' },
  { id: 'grau', label: 'Schlicht', c: '#4b5563' },
];
const DEF = { mode: 'auto', dark: 'stufen', accent: 'blau' };
export function themeOf() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } }
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);
export function isDark() { const t = themeOf(); return t.mode === 'dark' || (t.mode === 'auto' && !!mq()?.matches); }
export function applyTheme() {
  const t = themeOf(); const r = document.documentElement; const dark = isDark();
  r.dataset.theme = dark ? 'dark' : 'light'; r.dataset.dark = t.dark; r.dataset.accent = t.accent;
  const bg = getComputedStyle(r).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg || (dark ? '#121417' : '#f9fafb')));
}
export function setTheme(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...themeOf(), ...patch })); } catch {}
  applyTheme(); window.dispatchEvent(new Event('life-theme'));
}
export function installTheme() {
  applyTheme();
  mq()?.addEventListener?.('change', () => { applyTheme(); window.dispatchEvent(new Event('life-theme')); });
}
