// Übersetzt die Vorschläge der KI in lesbare Sätze und führt sie nach Bestätigung aus.
import { fmtShort, today } from './dates';
import { areaOf, subOf } from './logic';
import { addBlocks, makeBlock } from './blocks';
import {
  addMemory, addPlace, updatePlace, addSub, deleteTask, updateProject,
  addEvent, addHabit, addWish, addProject, addRadarItem, addResource, addTask, logActivity, logContact, savePerson, toggleCheckin, updateTask,
} from './actions';
import { store } from './store';
import { locate } from './outings';

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const date = (d) => (isDate(d) ? fmtShort(d) : null);
const CAT = { familie: 'Familie', freunde: 'Freunde', neu: 'Neue Kontakte', beruflich: 'Beruflich' };

function where(s, a) {
  const area = areaOf(s, a.bereich_id);
  const sub = subOf(area, a.unterbereich_id);
  const proj = a.projekt_id && s.projects.find((p) => p.id === a.projekt_id);
  if (proj) return `Projekt ${proj.name}`;
  return [area?.name, sub?.name].filter(Boolean).join(' › ');
}

// Die KI nennt manchmal Namen statt IDs („Weiterentwicklung“ statt „entwicklung“): hier großzügig zuordnen
const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
function findBy(list, val, ...keys) {
  if (!val) return null;
  const v = norm(val);
  return list.find((x) => x.id === val) || list.find((x) => keys.some((k) => norm(x[k]) === v)) || list.find((x) => keys.some((k) => v.length > 3 && (norm(x[k]).includes(v) || v.includes(norm(x[k])))));
}
export function normalize(s, a) {
  const b = { ...a };
  if (b.bereich_id) {
    let area = findBy(s.areas, b.bereich_id, 'name');
    if (!area) area = s.areas.find((x) => x.subs.some((u) => norm(u.name) === norm(b.bereich_id)));
    b.bereich_id = area?.id || b.bereich_id;
  }
  const area = areaOf(s, b.bereich_id);
  if (b.unterbereich_id && area) b.unterbereich_id = findBy(area.subs, b.unterbereich_id, 'name')?.id || null;
  if (b.projekt_id) {
    const p = findBy(s.projects, b.projekt_id, 'name');
    b.projekt_id = p?.id || b.projekt_id;
    if (p && !b.bereich_id) b.bereich_id = p.areaId;
  }
  if (b.aufgabe_id) b.aufgabe_id = findBy(s.tasks.filter((x) => !x.done || x.id === b.aufgabe_id), b.aufgabe_id, 'title')?.id || b.aufgabe_id;
  if (b.person_id) b.person_id = findBy(s.people, b.person_id, 'name')?.id || b.person_id;
  if (b.rhythmus_id) b.rhythmus_id = findBy(s.habits, b.rhythmus_id, 'name')?.id || b.rhythmus_id;
  if (b.vorlage_id) b.vorlage_id = findBy(s.templates, b.vorlage_id, 'name')?.id || null;
  // Neues Projekt/Fokus-Thema ohne erkennbaren Bereich: über die Unterbereiche oder den Namen raten, sonst „Weiterentwicklung“
  if ((b.typ === 'projekt_anlegen' || b.typ === 'rhythmus_anlegen') && !areaOf(s, b.bereich_id)) {
    b.bereich_id = (findBy(s.areas, b.name, 'name') || s.areas.find((x) => x.subs.some((u) => norm(b.name).includes(norm(u.name)))) || s.areas.find((x) => x.id === 'entwicklung') || s.areas[0]).id;
    b.geraten = true;
  }
  return b;
}
const blocksText = (list) => (list || []).map((x) => x.titel).filter(Boolean).join(', ');

// Liefert { ok, label } – ok=false, wenn die Aktion nicht ausführbar ist (z.B. unbekannte ID)
export function describe(s, raw) {
  const a = normalize(s, raw);
  const join = (...p) => p.filter(Boolean).join(' · ');
  const task = a.aufgabe_id && s.tasks.find((x) => x.id === a.aufgabe_id);
  const habit = a.rhythmus_id && s.habits.find((x) => x.id === a.rhythmus_id);
  const person = a.person_id && s.people.find((x) => x.id === a.person_id);
  switch (a.typ) {
    case 'aufgabe_anlegen':
      return { ok: !!a.titel, label: join(`${a.idee ? 'Idee' : 'Aufgabe'}: ${a.titel}`, where(s, a), a.faellig && `fällig ${date(a.faellig)}${/^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? `, ${a.uhrzeit} Uhr` : ''}`) };
    case 'aufgabe_erledigen':
      return { ok: !!task, label: `Erledigt: ${task?.title || 'unbekannte Aufgabe'}` };
    case 'aufgabe_aendern':
      return { ok: !!task, label: join(`Ändern: ${task?.title || 'unbekannte Aufgabe'}`, a.titel && `neuer Titel „${a.titel}“`, a.faellig && `fällig ${date(a.faellig)}`) };
    case 'projekt_anlegen': {
      const tpl = a.vorlage_id && s.templates.find((x) => x.id === a.vorlage_id);
      const n = (a.aufgaben || []).length;
      return { ok: !!a.name && !!areaOf(s, a.bereich_id), label: join(`Projekt: ${a.name}`, where(s, a), tpl && `Vorlage ${tpl.name}`, n && `${n} Aufgaben`, (a.bausteine || []).length && `Bausteine: ${blocksText(a.bausteine)}`, a.faellig && `bis ${date(a.faellig)}`) };
    }
    case 'projekt_aendern': {
      const p = s.projects.find((x) => x.id === a.projekt_id);
      return { ok: !!p, label: join(`Projekt ändern: ${p?.name || 'unbekanntes Projekt'}`, a.name && `neuer Name „${a.name}“`, a.faellig && `bis ${date(a.faellig)}`, a.archivieren && 'archivieren') };
    }
    case 'bausteine_hinzufuegen': {
      const p = s.projects.find((x) => x.id === a.projekt_id);
      return { ok: !!p && (a.bausteine || []).length > 0, label: join(`Bausteine für ${p?.name || 'unbekanntes Projekt'}`, blocksText(a.bausteine)) };
    }
    case 'unterbereich_anlegen':
      return { ok: !!areaOf(s, a.bereich_id) && !!a.name, label: `Unterbereich: ${a.name} in ${areaOf(s, a.bereich_id)?.name || '?'}` };
    case 'aufgabe_loeschen':
      return { ok: !!task, label: `Löschen: ${task?.title || 'unbekannte Aufgabe'}` };
    case 'rhythmus_anlegen':
      return { ok: !!a.name && !!areaOf(s, a.bereich_id), label: join(`${a.anzahl ? 'Rhythmus' : 'Fokus-Thema'}: ${a.name}`, a.anzahl ? `${a.anzahl}× pro ${a.zeitraum === 'monat' ? 'Monat' : 'Woche'}` : 'ohne feste Zahl', where(s, a)) };
    case 'rhythmus_abhaken':
      return { ok: !!habit, label: join(`Abhaken: ${habit?.name || 'unbekannter Rhythmus'}`, isDate(a.datum) && a.datum !== today() ? date(a.datum) : 'heute') };
    case 'person_anlegen':
      return { ok: !!a.name, label: join(`Person: ${a.name}`, CAT[a.kategorie], a.geburtstag && `Geburtstag ${date(a.geburtstag)}`, a.kontakt_alle_tage && `melden alle ${a.kontakt_alle_tage} Tage`, a.nachfassen_am && `nachfassen ${date(a.nachfassen_am)}`) };
    case 'person_aendern':
      return { ok: !!person, label: join(`Ändern: ${person?.name || 'unbekannte Person'}`, a.geburtstag && `Geburtstag ${date(a.geburtstag)}`, a.telefon && 'Telefon', a.kontakt_alle_tage && `melden alle ${a.kontakt_alle_tage} Tage`, a.nachfassen_am && `nachfassen ${date(a.nachfassen_am)}`, a.notiz && 'Notiz') };
    case 'kontakt_notieren':
      return { ok: !!person, label: join(`Kontakt notiert: ${person?.name || 'unbekannte Person'}`, isDate(a.datum) && a.datum !== today() ? date(a.datum) : 'heute') };
    case 'aktivitaet_eintragen':
      return { ok: !!areaOf(s, a.bereich_id), label: join(`Aktivität: ${areaOf(s, a.bereich_id)?.name || '?'}`, a.notiz) };
    case 'ressource_anlegen':
      return { ok: !!a.titel, label: join(`Ressource: ${a.titel}`, where(s, a), a.url && 'mit Link') };
    case 'event_anlegen':
      return { ok: !!a.name, label: join(`Event: ${a.name}`, a.datum && date(a.datum), a.ort, a.reise && 'Reise') };
    case 'radar_eintrag':
      return { ok: !!a.titel, label: join(`Radar: ${a.titel}`, a.thema) };
    case 'app_wunsch':
      return { ok: !!a.titel, label: `App-Wunsch: ${a.titel}` };
    case 'merken':
      return { ok: !!a.fakt, label: `Merken: ${a.fakt}` };
    case 'ort_anlegen':
      return { ok: !!a.name, label: join(`Ort: ${a.name}`, a.ort_art, a.adresse, a.war_da ? (a.bewertung ? '★'.repeat(Math.min(5, a.bewertung)) : 'war da') : 'will hin') };
    default:
      return { ok: false, label: `Unbekannte Aktion (${a.typ})` };
  }
}

export let lastProjectId = null;
export function applyAction(s, raw) {
  const a = normalize(s, raw);
  const area = areaOf(s, a.bereich_id) ? a.bereich_id : null;
  const sub = area && subOf(areaOf(s, area), a.unterbereich_id) ? a.unterbereich_id : null;
  const proj = a.projekt_id && s.projects.some((p) => p.id === a.projekt_id) ? a.projekt_id : null;
  const d = (x) => (isDate(x) ? x : null);
  switch (a.typ) {
    case 'aufgabe_anlegen':
      return addTask({ title: a.titel, areaId: proj ? null : area, subId: proj ? null : sub, projectId: proj, due: d(a.faellig), time: /^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? a.uhrzeit.padStart(5, '0') : null, idea: !!a.idee });
    case 'aufgabe_erledigen':
      return updateTask(a.aufgabe_id, { done: true, doneAt: today() });
    case 'aufgabe_aendern': {
      const patch = {};
      if (a.titel) patch.title = a.titel;
      if (d(a.faellig)) patch.due = a.faellig;
      return updateTask(a.aufgabe_id, patch);
    }
    case 'projekt_anlegen': {
      const id = addProject({ name: a.name, areaId: area, subId: sub, due: d(a.faellig), templateId: a.vorlage_id || null });
      (a.aufgaben || []).forEach((title) => addTask({ title: typeof title === 'string' ? title : title?.titel || '', projectId: id }));
      if ((a.bausteine || []).length) addBlocks(id, a.bausteine.map(makeBlock));
      lastProjectId = id;
      return id;
    }
    case 'projekt_aendern': {
      const patch = {};
      if (a.name) patch.name = a.name;
      if (d(a.faellig)) patch.due = a.faellig;
      if (a.archivieren) patch.status = 'archiviert';
      return updateProject(a.projekt_id, patch);
    }
    case 'bausteine_hinzufuegen':
      lastProjectId = a.projekt_id;
      return addBlocks(a.projekt_id, a.bausteine.map(makeBlock));
    case 'unterbereich_anlegen':
      return addSub(a.bereich_id, a.name);
    case 'aufgabe_loeschen':
      return deleteTask(a.aufgabe_id);
    case 'rhythmus_anlegen':
      return addHabit({ name: a.name, areaId: area, subId: sub, count: a.anzahl || 0, period: a.zeitraum === 'monat' ? 'monat' : 'woche' });
    case 'rhythmus_abhaken': {
      const dt = d(a.datum) || today();
      const done = s.checkins.some((c) => c.habitId === a.rhythmus_id && c.date === dt);
      if (!done) toggleCheckin(a.rhythmus_id, dt);
      return true;
    }
    case 'person_anlegen':
      return savePerson({
        name: a.name, category: a.kategorie || 'freunde', birthday: d(a.geburtstag) || '', phone: a.telefon || '',
        contactEvery: a.kontakt_alle_tage || null, metAt: a.kennengelernt_bei || '', followUp: d(a.nachfassen_am), notes: a.notiz || '',
      });
    case 'person_aendern': {
      const p = s.people.find((x) => x.id === a.person_id);
      const patch = { id: p.id };
      if (d(a.geburtstag)) patch.birthday = a.geburtstag;
      if (a.telefon) patch.phone = a.telefon;
      if (a.kontakt_alle_tage) patch.contactEvery = a.kontakt_alle_tage;
      if (d(a.nachfassen_am)) patch.followUp = a.nachfassen_am;
      if (a.kennengelernt_bei) patch.metAt = a.kennengelernt_bei;
      if (a.notiz) patch.notes = [p.notes, a.notiz].filter(Boolean).join('\n');
      if (a.kategorie) patch.category = a.kategorie;
      return savePerson(patch);
    }
    case 'kontakt_notieren':
      return logContact(a.person_id, d(a.datum) || today());
    case 'aktivitaet_eintragen':
      return logActivity(area, a.notiz || '');
    case 'ressource_anlegen':
      return addResource({ title: a.titel, url: a.url || '', areaId: area, subId: sub, projectId: proj, tags: a.tags || [] });
    case 'event_anlegen':
      return addEvent({ name: a.name, date: d(a.datum) || '', place: a.ort || '', travel: !!a.reise });
    case 'app_wunsch':
      return addWish(a.titel);
    case 'merken':
      return addMemory(a.fakt, area);
    case 'ort_anlegen': {
      const id = addPlace({ name: a.name, category: a.ort_art || 'Sonstiges', note: a.notiz || '', address: a.adresse || '', status: a.war_da ? 'war' : 'will', rating: a.war_da ? Math.min(5, a.bewertung || 0) : 0 });
      // Kartenpunkt im Hintergrund suchen
      locate(a.name, a.adresse).then((pos) => pos && updatePlace(id, { lat: pos.lat, lon: pos.lon }));
      return id;
    }
    case 'radar_eintrag':
      return addRadarItem({ title: a.titel, url: a.url || '', why: a.warum || '', topic: a.thema || '' });
    default:
      return null;
  }
}

// Führt die ausgewählten Aktionen aus und gibt die gespeicherten Beschreibungen zurück
export function applyActions(actions) {
  lastProjectId = null;
  const labels = [];
  actions.forEach((a) => {
    const s = store.get();
    const info = describe(s, a);
    if (!info.ok) return;
    applyAction(s, a);
    labels.push(info.label);
  });
  return labels;
}
