// Sicherung: Export → Import muss alles unverändert zurückbringen; falsche Dateien werden verständlich abgelehnt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceData, makeBackup, parseBackup, summarize, writeDevice } from '../src/lib/backup';
import { seed } from '../src/lib/seed';
import { FakeStorage } from './helpers';

const bigState = () => {
  const s = seed();
  for (let i = 0; i < 3000; i++) s.tasks.push({ id: `t${i}`, title: `Aufgabe ${i} – Ümlaut ñ 🙂`, done: i % 3 === 0, due: null });
  for (let i = 0; i < 500; i++) s.people.push({ id: `p${i}`, name: `Person ${i}`, notes: 'x'.repeat(200) });
  return s;
};

test('Export und Import ergeben exakt denselben Datenstand (auch bei vielen Daten)', () => {
  const s = bigState();
  const { state, device, meta } = parseBackup(makeBackup(s));
  assert.deepEqual(state, s);
  assert.equal(device, null);
  assert.equal(meta.app, 'life');
});

test('Komplette Sicherung nimmt Geräte-Einstellungen mit, aber keine Zwischenspeicher/Rettungskopien', () => {
  const ls = new FakeStorage({ 'life-app-v1': '{}', 'life-app-ai': '{"apiKey":"x"}', 'life-td-cache': '1', 'life-app-v1-rescue': 'raw', 'life-app-theme': 'dark', fremd: '1' });
  const dev = deviceData(ls);
  assert.deepEqual(Object.keys(dev).sort(), ['life-app-ai', 'life-app-theme']);
  const { device } = parseBackup(makeBackup(seed(), { device: dev }));
  const target = new FakeStorage();
  assert.equal(writeDevice(target, device), 2);
  assert.equal(target.getItem('life-app-ai'), '{"apiKey":"x"}');
});

test('Falsche Dateien werden mit verständlicher Meldung abgelehnt', () => {
  assert.throws(() => parseBackup('kein json'), /kein lesbares JSON/);
  assert.throws(() => parseBackup('[]'), /keine Life-Daten/);
  assert.throws(() => parseBackup('{"tasks":[]}'), /keine Life-Sicherung/);
});

test('Zusammenfassung zeigt die wichtigsten Zahlen', () => {
  assert.match(summarize(bigState()), /3000 Aufgaben · 500 Personen/);
});
