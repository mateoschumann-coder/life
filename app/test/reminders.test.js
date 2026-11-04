// v1.57: Vorab-Erinnerung (Standard 1 Tag vorher, pro Eintrag änderbar) und Unterhaltungs-Links ohne Stadt
import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingReminders, remindOf, inDaysText } from '../src/lib/logic';
import { SOURCE_AREAS, sourceUrl } from '../src/lib/sources';
import { runSearch } from '../src/lib/search';
import { seed } from '../src/lib/seed';

const T = '2026-11-10';
const data = () => {
  const s = seed();
  s.gatherings = [
    { id: 'g1', name: 'Eltern zu Besuch', kind: 'besuch', date: '2026-11-11', to: '2026-11-18', guests: [], todos: [{ id: 'x', text: 'Gästebett', done: false }] },
    { id: 'g2', name: 'Asado', kind: 'zuhause', date: '2026-11-14', guests: [], todos: [] },
    { id: 'g3', name: 'Spieleabend', kind: 'zuhause', date: '2026-11-13', remind: 3, guests: [], todos: [] },
  ];
  s.invites = [{ id: 'i1', name: 'Hochzeit Juan', date: '2026-11-11', status: 'abgesagt' }];
  s.shows = [{ id: 'u1', name: 'GP Brasilien', date: '2026-11-11', done: false }];
  return s;
};

test('Standard: einen Tag vorher', () => {
  const ids = upcomingReminders(data(), T).map((x) => x.item.id);
  assert.ok(ids.includes('g1'));
  assert.ok(ids.includes('u1'));
  assert.ok(!ids.includes('g2'), 'in 4 Tagen noch nicht');
  assert.ok(!ids.includes('i1'), 'abgesagte Einladung nicht');
});

test('Eigene Vorlaufzeit pro Eintrag und globaler Standard', () => {
  const s = data();
  assert.ok(upcomingReminders(s, T).some((x) => x.item.id === 'g3' && x.days === 3));
  s.profile = { ...s.profile, remindDefault: 7 };
  assert.ok(upcomingReminders(s, T).some((x) => x.item.id === 'g2'));
  assert.equal(remindOf(s, { remind: 0 }), 0);
  assert.equal(inDaysText(1), 'morgen');
});

test('Unterhaltungs-Links hängen die Stadt nur bei Kinos an', () => {
  const src = Object.fromEntries(SOURCE_AREAS.tv_film.defaults.map((x) => [x.id, x]));
  assert.ok(!decodeURIComponent(sourceUrl(src.justwatch, 'Dune', 'Buenos Aires')).includes('Buenos'));
  assert.ok(decodeURIComponent(sourceUrl(src.cartelera, 'Dune', 'Buenos Aires')).includes('Buenos Aires'));
});

test('Unterhaltung ist in der globalen Suche', () => {
  assert.deepEqual(runSearch(data(), 'brasilien').flatMap((g) => g.hits.map((h) => h.title)), ['GP Brasilien']);
});
