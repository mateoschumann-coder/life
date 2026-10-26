// Finanzen: einfacher Monatsrechner – Einnahmen, Sparziel, Fixkosten (mit Kategorien und Währungen)
// → wie viel bleibt im Monat und pro Tag. Wechselkurse von Hand oder per Knopf (open.er-api.com, kostenlos).
import { store, uid } from './store';

export const CURRENCIES = ['ARS', 'EUR', 'USD'];
export const SYMBOL = { ARS: '$', EUR: '€', USD: 'US$' };
export const COST_CATS = [
  { id: 'miete', label: 'Miete', icon: 'home' },
  { id: 'nebenkosten', label: 'Nebenkosten / Expensas', icon: 'home' },
  { id: 'energie', label: 'Strom, Gas, Wasser', icon: 'sparkle' },
  { id: 'telefon', label: 'Internet & Handy', icon: 'link' },
  { id: 'versicherung', label: 'Versicherungen', icon: 'heart' },
  { id: 'abos', label: 'Abos (Streaming, Apps, KI)', icon: 'play' },
  { id: 'transport', label: 'Transport', icon: 'run' },
  { id: 'sport', label: 'Sport & Fitness', icon: 'run' },
  { id: 'kredit', label: 'Kredite & Raten', icon: 'wallet' },
  { id: 'sonstiges', label: 'Sonstiges', icon: 'circle' },
];
export const catOf = (id) => COST_CATS.find((c) => c.id === id) || COST_CATS[COST_CATS.length - 1];

const DEFAULT = () => ({
  base: 'ARS', // Anzeige-Währung
  rates: { USD: 1, EUR: 0.92, ARS: 1200 }, // Einheiten pro 1 US$
  ratesAt: null,
  incomes: [],
  savings: { amount: 0, currency: 'ARS' },
  costs: [],
});
export const budgetOf = (s) => ({ ...DEFAULT(), ...(s.budget || {}) });
const upd = (fn) => store.update((s) => { s.budget = budgetOf(s); fn(s.budget); });

export const setBudget = (patch) => upd((b) => Object.assign(b, patch));
export const setRate = (cur, val) => upd((b) => { b.rates = { ...b.rates, [cur]: Number(val) || b.rates[cur] }; });
export const addLine = (list, line) => upd((b) => { b[list].push({ id: uid(), name: '', amount: 0, currency: b.base, ...line }); });
export const updateLine = (list, id, patch) => upd((b) => Object.assign(b[list].find((x) => x.id === id) || {}, patch));
export const removeLine = (list, id) => upd((b) => { b[list] = b[list].filter((x) => x.id !== id); });

export function convert(b, amount, from, to = b.base) {
  const r = b.rates;
  if (!r[from] || !r[to]) return Number(amount) || 0;
  return ((Number(amount) || 0) / r[from]) * r[to];
}
export function money(x, cur) {
  const n = Math.round(x);
  return `${SYMBOL[cur] || ''} ${n.toLocaleString('de-DE')}`.trim() + (cur === 'ARS' ? ' ARS' : '');
}
export const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

export function calc(b, date = new Date()) {
  const income = b.incomes.reduce((n, x) => n + convert(b, x.amount, x.currency), 0);
  const fixed = b.costs.reduce((n, x) => n + convert(b, x.amount, x.currency), 0);
  const save = convert(b, b.savings.amount, b.savings.currency);
  const free = income - fixed - save;
  const days = daysInMonth(date);
  const left = days - date.getDate() + 1;
  const byCat = COST_CATS.map((c) => ({ ...c, sum: b.costs.filter((x) => (x.cat || 'sonstiges') === c.id).reduce((n, x) => n + convert(b, x.amount, x.currency), 0) })).filter((c) => c.sum > 0).sort((a, b2) => b2.sum - a.sum);
  return { income, fixed, save, free, days, left, perDay: free / days, perWeek: (free / days) * 7, byCat };
}

// Aktuelle Kurse (offizieller Kurs; für den argentinischen „Blue“-Kurs von Hand anpassen)
export async function fetchRates() {
  const r = await fetch('https://open.er-api.com/v6/latest/USD');
  const j = await r.json();
  if (!j?.rates) throw new Error('Kurse gerade nicht erreichbar');
  setBudget({ rates: { USD: 1, EUR: j.rates.EUR, ARS: j.rates.ARS }, ratesAt: new Date().toISOString() });
}
