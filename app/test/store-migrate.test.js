// Umstellungsfehler (Daten lesbar, aber nicht passend) → ebenfalls Rettungsmodus statt leerer App.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeStorage } from './helpers';

const odd = JSON.stringify({ areas: [{ id: 'x' }], pillars: 'kaputt', trips: 'kein Array' });
globalThis.localStorage = new FakeStorage({ 'life-app-v1': odd });
const { storage } = await import('../src/lib/store');

test('Umstellungsfehler führt in den Rettungsmodus, Daten bleiben', () => {
  assert.equal(storage.get().mode, 'rescue');
  assert.match(storage.get().loadError, /umgestellt/);
  assert.equal(localStorage.getItem('life-app-v1'), odd);
});
