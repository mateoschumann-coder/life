// Globale Suche: findet alles, was gespeichert ist – auch Zuhause-Einträge; Erledigtes/Archiv nur auf Wunsch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSearch, searchIndex } from '../src/lib/search';
import { seed } from '../src/lib/seed';

const data = () => {
  const s = seed();
  s.home = { haushalt: { cats: ['Putzen'], items: [{ id: 'h1', text: 'Fenster putzen', cat: 'Putzen', done: false }] }, einrichtung: { cats: ['Bad'], items: [{ id: 'e1', text: 'Spiegelschrank', cat: 'Bad', kind: 'brauche' }] } };
  s.tasks.push({ id: 't1', title: 'Steuer erledigen', done: true }, { id: 't2', title: 'Steuer Termin', done: false });
  s.removedTasks = [{ id: 't3', title: 'Steuer alt' }];
  s.recipes = [{ id: 'r1', title: 'Airfryer Pommes', ingredients: ['Kartoffeln'] }];
  s.memory = [{ id: 'm1', text: 'Mag Rockmusik' }];
  return s;
};
const titles = (res) => res.flatMap((g) => g.hits.map((h) => h.title));

test('Zuhause-Einträge (Feld text) werden gefunden', () => {
  assert.deepEqual(titles(runSearch(data(), 'fenster')), ['Fenster putzen']);
  assert.deepEqual(titles(runSearch(data(), 'spiegel')), ['Spiegelschrank']);
});

test('Erledigtes und Rausgenommenes nur mit „Auch Erledigtes & Archiv“', () => {
  assert.deepEqual(titles(runSearch(data(), 'steuer')), ['Steuer Termin']);
  const all = titles(runSearch(data(), 'steuer', { all: true }));
  assert.ok(all.includes('Steuer erledigen') && all.includes('Steuer alt'));
  assert.equal(all[0], 'Steuer Termin'); // Aktuelles zuerst
});

test('Suche in Zutaten, Akzente und Groß/klein egal', () => {
  assert.deepEqual(titles(runSearch(data(), 'KARTOFFELN')), ['Airfryer Pommes']);
  assert.deepEqual(titles(runSearch(data(), 'rockmusik')), ['Mag Rockmusik']);
});

test('Rezept-Treffer öffnet das Rezept direkt', () => {
  const r = runSearch(data(), 'pommes')[0].hits[0];
  assert.equal(r.to.ss['life-open-recipe'], 'r1');
});

test('jeder Treffer hat ein Ziel', () => {
  for (const g of searchIndex(data(), { all: true })) for (const x of g.items) assert.ok(x.to?.route, `${g.key}: ${x.title}`);
});
