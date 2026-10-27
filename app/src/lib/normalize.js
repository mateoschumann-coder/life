// Bringt ältere gespeicherte Reisen und Events auf das aktuelle Format (ohne Abhängigkeiten, wird beim Laden benutzt)
const nid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Alte Reisen auf das neue Format bringen (wird beim Laden aufgerufen)
export function normalizeTrip(tr) {
  tr.status = tr.status || 'geplant';
  for (const k of ['todo', 'packen', 'stops', 'places', 'transport', 'docs', 'expenses', 'chat', 'variants', 'options', 'spots', 'pool', 'focus']) if (!Array.isArray(tr[k])) tr[k] = [];
  tr.todo.forEach((x) => { x.cat = x.cat || 'Sonstiges'; });
  tr.packen.forEach((x) => { x.cat = x.cat || 'Sonstiges'; });
  if (Array.isArray(tr.ideen) && tr.ideen.length) {
    tr.ideen.forEach((x) => tr.places.push({ id: x.id || nid(), name: x.text, kind: 'aktivitaet', note: x.note || '', url: x.url || '', address: '', stopId: '', status: x.done ? 'fest' : 'option' }));
  }
  delete tr.ideen;
  tr.variants.forEach((v) => { (v.legs || []).forEach((l) => { if (!l.id) l.id = nid(); }); });
  tr.idea = tr.idea || '';
  tr.currency = tr.currency || 'USD';
  return tr;
}

export function normalizeGathering(g) {
  g.kind = g.kind || 'zuhause';
  for (const k of ['guests', 'shopping', 'todos', 'venues', 'bring', 'chat']) if (!Array.isArray(g[k])) g[k] = [];
  g.todos.forEach((x) => { x.cat = x.cat || 'Sonstiges'; });
  g.shopping.forEach((x) => { x.cat = x.cat || 'Sonstiges'; });
  g.expected = g.expected || '';
  g.motto = g.motto || '';
  g.diet = g.diet || '';
  g.budget = g.budget || '';
  g.invite = g.invite || '';
  return g;
}
