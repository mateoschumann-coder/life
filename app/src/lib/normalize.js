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
  g.address = g.address || '';
  // v0.91: Phasen Planen / Vorbereiten / Sonstiges, alte lange Vorlagen-Texte kurz
  if (!g.v91) {
    const CAT = { 'Am Tag': 'Vorbereiten', 'Kurz vorher': 'Vorbereiten', Reservieren: 'Planen', Danach: 'Sonstiges' };
    const TXT = { 'Ungefähre Gästezahl festlegen': 'Gästezahl klären', 'Motto / Art des Abends überlegen': 'Motto überlegen', 'Einladung verschicken': 'Leute einladen', 'Essenswünsche und Allergien abfragen': 'Allergien abfragen', 'Genug Teller, Gläser, Besteck und Stühle?': 'Geschirr & Stühle checken', 'Wohnung aufräumen': 'Aufräumen', 'Musik / Playlist': 'Playlist', 'Einschränkungen klären (Essen, Budget, Erreichbarkeit)': 'Einschränkungen klären', 'Orte finden und vergleichen': 'Ort finden', 'Verfügbarkeit und Preise prüfen': 'Preise checken', 'Reservieren (anrufen / online)': 'Reservieren', 'Anzahlung oder Mindestverzehr klären': 'Anzahlung klären', 'Ort, Adresse und Uhrzeit an Gäste schicken': 'Adresse schicken', 'Adresse an Gäste schicken': 'Adresse schicken', 'Gästezahl final durchgeben': 'Gästezahl durchgeben', 'Reservierung am Vortag bestätigen': 'Reservierung bestätigen', 'Rechnung aufteilen': 'Rechnung teilen', 'Kohle kaufen': '', 'Einkaufen': '', 'Einkauf machen': '', 'Deko kaufen': 'Dekorieren', 'Kerzen besorgen': '' };
    g.todos = g.todos.filter((x) => x.done || TXT[x.text] !== '').map((x) => {
      const cat = CAT[x.cat] || x.cat;
      let text = TXT[x.text] || x.text;
      if (x.cat === 'Danach' && text === 'Aufräumen') text = 'Nachher aufräumen';
      if (text.length > 32) text = text.replace(/\s*[(:–—].*$/, '').trim();
      return { ...x, cat, text };
    });
    g.v91 = true;
  }
  // v0.93: lange Einkaufs-Texte (meist von der KI) auf den Artikel kürzen
  if (!g.v93) {
    g.shopping.forEach((x) => {
      if (String(x.text || '').length <= 22) return;
      let t = String(x.text).replace(/\s*\([^)]*\)/g, '').replace(/\s*[:–—].*$/, '').replace(/\s+-\s.*$/, '').replace(/\s+(für|zum|zur|damit|falls|als|wegen)\s.*$/i, '').replace(/[.!]+$/, '').trim();
      const w = t.split(/\s+/);
      if (w.length > 4) t = w.slice(0, 4).join(' ');
      if (t) x.text = t;
    });
    g.v93 = true;
  }
  return g;
}
