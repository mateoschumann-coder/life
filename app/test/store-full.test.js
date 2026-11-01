// Speicher voll: der Fehler muss sichtbar werden (nicht nur in der Entwicklerkonsole).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeStorage, wait } from './helpers';

globalThis.localStorage = new FakeStorage({}, { quota: 60_000 });
const { store, storage } = await import('../src/lib/store');

test('Speicherfehler wird gemeldet und verschwindet, sobald Speichern wieder klappt', async () => {
  store.update((d) => { d.tasks.push({ id: 'big', title: 'x'.repeat(200_000) }); });
  await wait(250);
  assert.match(storage.get().saveError, /Speicher .* voll/);
  store.update((d) => { d.tasks = d.tasks.filter((t) => t.id !== 'big'); });
  await wait(250);
  assert.equal(storage.get().saveError, '');
});
