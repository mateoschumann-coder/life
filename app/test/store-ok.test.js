// Normaler Start: vorhandene Daten werden geladen, Änderungen werden gespeichert, Tagessicherung wird angelegt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeStorage, wait } from './helpers';
import { seed } from '../src/lib/seed';

const saved = seed();
saved.tasks.push({ id: 'a1', title: 'Bestehende Aufgabe', done: false });
globalThis.localStorage = new FakeStorage({ 'life-app-v1': JSON.stringify(saved) });
const { store, storage, AUTO_KEY } = await import('../src/lib/store');

test('lädt den gespeicherten Stand', () => {
  assert.equal(storage.get().mode, 'ok');
  assert.ok(store.get().tasks.some((t) => t.title === 'Bestehende Aufgabe'));
});

test('legt eine automatische Tagessicherung an', () => {
  const auto = JSON.parse(localStorage.getItem(AUTO_KEY));
  assert.ok(auto.raw.includes('Bestehende Aufgabe'));
});

test('speichert Änderungen dauerhaft', async () => {
  store.update((d) => { d.tasks.push({ id: 'a2', title: 'Neu', done: false }); });
  await wait(250);
  const disk = JSON.parse(localStorage.getItem('life-app-v1'));
  assert.ok(disk.tasks.some((t) => t.title === 'Neu'));
  assert.equal(storage.get().saveError, '');
});

test('Sicherung laden ersetzt den Stand und speichert ihn', () => {
  const backup = seed();
  backup.people.push({ id: 'x', name: 'Aus der Sicherung' });
  storage.restore(backup);
  assert.ok(store.get().people.some((p) => p.name === 'Aus der Sicherung'));
  assert.ok(localStorage.getItem('life-app-v1').includes('Aus der Sicherung'));
});
