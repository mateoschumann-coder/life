// Beschädigte Daten: die App darf sie NIE mit leeren Daten überschreiben (Rettungsmodus).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeStorage, wait } from './helpers';
import { seed } from '../src/lib/seed';

const broken = '{"areas": [ kaputt';
globalThis.localStorage = new FakeStorage({ 'life-app-v1': broken });
const { store, storage, RESCUE_KEY } = await import('../src/lib/store');

test('startet im Rettungsmodus mit verständlicher Meldung', () => {
  assert.equal(storage.get().mode, 'rescue');
  assert.match(storage.get().loadError, /beschädigt/);
});

test('Rohdaten bleiben unangetastet und werden zusätzlich gesichert', async () => {
  store.update((d) => { d.tasks.push({ id: 'x', title: 'darf nicht gespeichert werden' }); });
  storage.retry();
  await wait(250);
  assert.equal(localStorage.getItem('life-app-v1'), broken);
  assert.equal(localStorage.getItem(RESCUE_KEY), broken);
  assert.equal(storage.rescueRaw(), broken);
});

test('eine Sicherung beendet den Rettungsmodus', () => {
  const backup = seed();
  backup.tasks.push({ id: 'r', title: 'Gerettet', done: false });
  storage.restore(backup);
  assert.equal(storage.get().mode, 'ok');
  assert.ok(JSON.parse(localStorage.getItem('life-app-v1')).tasks.some((t) => t.title === 'Gerettet'));
});
