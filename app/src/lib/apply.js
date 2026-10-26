// Übersetzt die Vorschläge der KI in lesbare Sätze und führt sie nach Bestätigung aus.
import { fmtShort, today } from './dates';
import { areaOf, subOf } from './logic';
import {
  addMemory, addPlace, updatePlace,
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

// Liefert { ok, label } – ok=false, wenn die Aktion nicht ausführbar ist (z.B. unbekannte ID)
export function describe(s, a) {
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
      return { ok: !!a.name && !!areaOf(s, a.bereich_id), label: join(`Projekt: ${a.name}`, where(s, a), tpl && `Vorlage ${tpl.name}`, n && `${n} Aufgaben`, a.faellig && `bis ${date(a.faellig)}`) };
    }
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

export function applyAction(s, a) {
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
      (a.aufgaben || []).forEach((title) => addTask({ title, projectId: id }));
      return id;
    }
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
