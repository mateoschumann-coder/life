// Gemeinsame Test-Hilfen: ein nachgebauter Browser-Speicher (localStorage) mit optionaler Speichergrenze.
export class FakeStorage {
  constructor(init = {}, { quota = Infinity } = {}) { this.m = new Map(Object.entries(init)); this.quota = quota; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) {
    const size = [...this.m.entries()].reduce((n, [a, b]) => (a === k ? n : n + a.length + b.length), 0) + k.length + String(v).length;
    if (size > this.quota) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, String(v));
  }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
