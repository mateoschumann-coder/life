// Alle Änderungen an den Daten an einem Ort.
import { store, uid } from './store';
import { today } from './dates';

const now = () => new Date().toISOString();

// Aufgaben
export function addTask({ title, areaId = null, subId = null, projectId = null, due = null, time = null, idea = false, url = null }) {
  if (!title.trim()) return;
  store.update((s) => {
    s.tasks.push({ id: uid(), title: title.trim(), areaId, subId, projectId, due, time, idea, url: url || undefined, done: false, doneAt: null, createdAt: now() });
  });
}
// Aus einer Idee ein Projekt machen
export function ideaToProject(taskId) {
  let id = null;
  store.update((s) => {
    const t = s.tasks.find((x) => x.id === taskId);
    if (!t) return;
    id = uid();
    s.projects.push({ id, name: t.title, areaId: t.areaId, subId: t.subId || null, due: null, status: 'aktiv', notes: '', createdAt: now() });
    s.tasks = s.tasks.filter((x) => x.id !== taskId);
  });
  return id;
}
export function toggleTask(id) {
  store.update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? today() : null;
  });
}
export function updateTask(id, patch) {
  store.update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}
export function deleteTask(id) {
  store.update((s) => {
    s.tasks = s.tasks.filter((t) => t.id !== id);
  });
}

// Rhythmen
export function addHabit({ name, areaId, subId = null, count, period }) {
  if (!name.trim()) return;
  store.update((s) => {
    s.habits.push({ id: uid(), name: name.trim(), areaId, subId, count: Number(count) || 0, period, createdAt: now() });
  });
}
export function toggleCheckin(habitId, date = today()) {
  store.update((s) => {
    const i = s.checkins.findIndex((c) => c.habitId === habitId && c.date === date);
    if (i >= 0) s.checkins.splice(i, 1);
    else s.checkins.push({ id: uid(), habitId, date });
  });
}
export function deleteHabit(id) {
  store.update((s) => {
    s.habits = s.habits.filter((h) => h.id !== id);
    s.checkins = s.checkins.filter((c) => c.habitId !== id);
  });
}

// Lebensbereiche
export function logActivity(areaId, note = '') {
  store.update((s) => {
    s.activities.push({ id: uid(), areaId, date: today(), note: note.trim() });
  });
}
export function updateArea(id, patch) {
  store.update((s) => {
    Object.assign(s.areas.find((a) => a.id === id), patch);
  });
}
export function addSub(areaId, name) {
  if (!name.trim()) return;
  store.update((s) => {
    const a = s.areas.find((x) => x.id === areaId);
    a.subs.push({ id: uid(), name: name.trim() });
  });
}

// Projekte
export function addProject({ name, areaId, subId = null, due = null, templateId = null, extra = {} }) {
  if (!name.trim()) return null;
  const id = uid();
  store.update((s) => {
    s.projects.push({ id, name: name.trim(), areaId, subId, due, status: 'aktiv', notes: '', createdAt: now(), ...extra });
    const tpl = (s.templates || []).find((t) => t.id === templateId);
    (tpl ? tpl.tasks : []).forEach((title) =>
      s.tasks.push({ id: uid(), title, areaId: null, subId: null, projectId: id, due: null, idea: false, done: false, doneAt: null, createdAt: now() })
    );
  });
  return id;
}

// Projekt-Vorlagen
export function saveTemplate({ id, name, tasks }) {
  if (!name.trim()) return;
  const clean = tasks.map((t) => t.trim()).filter(Boolean);
  store.update((s) => {
    const existing = id && s.templates.find((t) => t.id === id);
    if (existing) Object.assign(existing, { name: name.trim(), tasks: clean });
    else s.templates.push({ id: uid(), name: name.trim(), tasks: clean });
  });
}
export function deleteTemplate(id) {
  store.update((s) => {
    s.templates = s.templates.filter((t) => t.id !== id);
  });
}
// Ein bestehendes Projekt als Vorlage speichern
export function projectToTemplate(projectId) {
  store.update((s) => {
    const p = s.projects.find((x) => x.id === projectId);
    const tasks = s.tasks.filter((t) => t.projectId === projectId).map((t) => t.title);
    s.templates.push({ id: uid(), name: p.name, tasks });
  });
}
export function updateProject(id, patch) {
  store.update((s) => {
    Object.assign(s.projects.find((p) => p.id === id), patch);
  });
}
export function deleteProject(id) {
  store.update((s) => {
    s.projects = s.projects.filter((p) => p.id !== id);
    s.tasks = s.tasks.filter((t) => t.projectId !== id);
    s.resources = s.resources.filter((r) => r.projectId !== id);
  });
}

// Ressourcen
export function addResource({ title, url = '', areaId = null, subId = null, projectId = null, tags = [] }) {
  if (!title.trim()) return;
  store.update((s) => {
    s.resources.push({ id: uid(), title: title.trim(), url: url.trim(), areaId, subId, projectId, tags, createdAt: now() });
  });
}
export function deleteResource(id) {
  store.update((s) => {
    s.resources = s.resources.filter((r) => r.id !== id);
  });
}

// Menschen
export function savePerson(person) {
  let id = person.id;
  store.update((s) => {
    if (id) Object.assign(s.people.find((p) => p.id === id), person);
    else {
      id = uid();
      s.people.push({ contacts: [], createdAt: now(), ...person, id });
    }
  });
  return id;
}
export function logContact(id, date = today()) {
  store.update((s) => {
    const p = s.people.find((x) => x.id === id);
    p.contacts = p.contacts || [];
    if (!p.contacts.includes(date)) p.contacts.push(date);
    if (p.followUp && p.followUp <= date) p.followUp = null;
  });
}
export function deletePerson(id) {
  store.update((s) => {
    s.people = s.people.filter((p) => p.id !== id);
  });
}

// Inbox
export function addInbox(text, type) {
  if (!text.trim()) return;
  store.update((s) => {
    s.inbox.unshift({ id: uid(), text: text.trim(), type, createdAt: now() });
  });
}
export function removeInbox(id) {
  store.update((s) => {
    s.inbox = s.inbox.filter((i) => i.id !== id);
  });
}

// Radar
export function addTopic(name) {
  if (!name.trim()) return;
  store.update((s) => {
    if (!s.radar.topics.includes(name.trim())) s.radar.topics.push(name.trim());
  });
}
export function removeTopic(name) {
  store.update((s) => {
    s.radar.topics = s.radar.topics.filter((t) => t !== name);
  });
}
export function addRadarItem({ title, url = '', why = '', topic = '' }) {
  if (!title.trim()) return;
  store.update((s) => {
    s.radar.items.unshift({ id: uid(), title: title.trim(), url: url.trim(), why: why.trim(), topic, status: 'neu', createdAt: now() });
  });
}
export function decideRadarItem(id, status) {
  store.update((s) => {
    const i = s.radar.items.find((x) => x.id === id);
    i.status = status;
    i.decidedAt = today();
  });
}
export function deleteRadarItem(id) {
  store.update((s) => {
    s.radar.items = s.radar.items.filter((x) => x.id !== id);
  });
}

// Events
export const STAGES = ['entdeckt', 'interessiert', 'zugesagt', 'besucht'];
export const STAGE_LABEL = { entdeckt: 'Entdeckt', interessiert: 'Interessiert', zugesagt: 'Zugesagt', besucht: 'Besucht' };
export function addEvent({ name, date = '', place = '', travel = false, stage = 'entdeckt', url = '', time = '', price = '', note = '', city = '' }) {
  if (!name.trim()) return;
  const id = uid();
  store.update((s) => {
    s.events.push({ id, name: name.trim(), date, place: (place || '').trim(), travel, stage, url, time, price, note, ...(city ? { city } : {}), createdAt: now() });
  });
  return id;
}
export function setEventStage(id, stage) {
  store.update((s) => {
    const e = s.events.find((x) => x.id === id);
    if (e) e.stage = stage;
  });
}

// Orte (Bars, Cafés, Restaurants …) mit Karte
export const PLACE_CATS = ['Café', 'Bar', 'Restaurant', 'Club', 'Kultur', 'Natur', 'Sport', 'Laden', 'Sonstiges'];
// Unterarten pro Art (Vorschläge; eigene sind jederzeit möglich)
// v0.86: eigene Arten (z.B. „Rooftop“, „Coworking“) – Standard-Arten + eigene, „Sonstiges“ immer zuletzt
export const placeCatsOf = (s) => [...new Set([...PLACE_CATS.filter((c) => c !== 'Sonstiges'), ...(s?.profile?.placeCats || []), 'Sonstiges'])];
export function addPlaceCat(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  store.update((s) => { s.profile = s.profile || {}; const l = s.profile.placeCats || []; if (![...PLACE_CATS, ...l].some((c) => c.toLowerCase() === n.toLowerCase())) s.profile.placeCats = [...l, n]; });
  return [...PLACE_CATS, ...(store.get().profile?.placeCats || [])].find((c) => c.toLowerCase() === n.toLowerCase()) || n;
}
export const removePlaceCat = (name) => store.update((s) => { s.profile.placeCats = (s.profile?.placeCats || []).filter((c) => c !== name); });
export const PLACE_SUBCATS = {
  Café: ['Specialty Coffee', 'Zum Arbeiten', 'Brunch', 'Konditorei'],
  Bar: ['Rooftop / Sky Bar', 'Pub', 'Cocktailbar', 'Weinbar', 'Craft Beer', 'Speakeasy', 'Live-Musik'],
  Restaurant: ['Parrilla', 'Bodegón', 'Italienisch', 'Pizza', 'Sushi / Japanisch', 'Peruanisch', 'Vegetarisch', 'Burger', 'Fine Dining'],
  Club: ['Techno', 'Latino / Cumbia', 'Rock / Indie'],
  Kultur: ['Museum', 'Theater', 'Kino', 'Galerie', 'Kulturzentrum'],
  Natur: ['Park', 'Laufstrecke', 'Aussicht', 'Am Wasser'],
  Sport: ['Gym', 'Lauftreff', 'Kletterhalle', 'Padel / Tennis'],
  Laden: ['Kleidung', 'Buchladen', 'Markt', 'Feinkost'],
  Sonstiges: [],
};
export function addPlace({ name, category = 'Sonstiges', subcat = '', note = '', rating = 0, status = 'will', lat = null, lon = null, address = '', url = '', city = '', hood = '', tags = [], price = 0, fav = false }) {
  if (!name || !name.trim()) return;
  const id = uid();
  store.update((s) => {
    s.places.push({ id, name: name.trim(), category: PLACE_CATS.includes(category) || (s.profile?.placeCats || []).includes(category) ? category : 'Sonstiges', subcat: String(subcat || '').trim(), note, rating, status, lat, lon, address, url, city: String(city || '').trim() || 'Buenos Aires', hood: String(hood || '').trim(), tags: Array.isArray(tags) ? tags : [], price: Number(price) || 0, fav: !!fav, createdAt: now() });
  });
  return id;
}
export function updatePlace(id, patch) {
  store.update((s) => {
    const p = s.places.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
}
export function deletePlace(id) {
  store.update((s) => {
    s.places = s.places.filter((x) => x.id !== id);
  });
}
export function advanceEvent(id) {
  store.update((s) => {
    const e = s.events.find((x) => x.id === id);
    const i = STAGES.indexOf(e.stage);
    if (i < STAGES.length - 1) e.stage = STAGES[i + 1];
    if (e.stage === 'besucht' && !e.date) e.date = today();
  });
}
export function deleteEvent(id) {
  store.update((s) => {
    s.events = s.events.filter((e) => e.id !== id);
  });
}

// Wunschliste für die App (Änderungen, die Claude später im Code umsetzt)
export function addWish(text) {
  if (!text.trim()) return;
  store.update((s) => {
    s.wishes.push({ id: uid(), text: text.trim(), done: false, createdAt: now() });
  });
}
export function toggleWish(id) {
  store.update((s) => {
    const w = s.wishes.find((x) => x.id === id);
    if (w) w.done = !w.done;
  });
}
export function deleteWish(id) {
  store.update((s) => {
    s.wishes = s.wishes.filter((x) => x.id !== id);
  });
}

// Gedächtnis: was Life über Mateo weiß (Ziele, Vorlieben, Interessen)
export function addMemory(text, areaId = null) {
  if (!text || !text.trim()) return;
  store.update((s) => {
    const t = text.trim();
    if (s.memory.some((m) => m.text.toLowerCase() === t.toLowerCase())) return;
    s.memory.push({ id: uid(), text: t, areaId, createdAt: now() });
  });
}
export function updateMemory(id, text) {
  store.update((s) => {
    const m = s.memory.find((x) => x.id === id);
    if (m) m.text = text;
  });
}
export function deleteMemory(id) {
  store.update((s) => {
    s.memory = s.memory.filter((x) => x.id !== id);
  });
}
