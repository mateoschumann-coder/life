// Übersetzt die Vorschläge der KI in lesbare Sätze und führt sie nach Bestätigung aus.
import { fmtShort, today } from './dates';
import { areaOf, subOf } from './logic';
import { addBlocks, makeBlock } from './blocks';
import {
  addMemory, addPlace, updatePlace, addSub, deleteTask, updateProject, addTopic,
  addEvent, addHabit, addWish, addProject, addRadarItem, addResource, addTask, logActivity, logContact, savePerson, toggleCheckin, updateTask,
} from './actions';
import { store } from './store';
import { locate } from './outings';
import { addInvite, updateInvite } from './invites';
import { findGathering, upsertGathering } from './gather';
import { addMaterial, ensureTopic, KINDS } from './library';
import { addHomeItem, addReminder, EVERY, LISTS } from './home';
import { addGathering, addHobby, addHobbyItem, addTrip } from './leisure';
import { addHealthItem, addRecipe, addSession, addShopping, addSport, addSportEvent, findSport, parseDuration } from './health';
import { addSkill, addSkillTodos } from './skills';
import { addJob, addSearch, stageOf, updateJob } from './career';
import { addSource } from './news';
import { addLine, catOf } from './budget';

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
      if (a.name && s.projects.some((p) => p.status === 'aktiv' && norm(p.name) === norm(a.name))) return { ok: false, reason: 'schon vorhanden', label: `Projekt: ${a.name}` };
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
      if (a.name && s.habits.some((h) => norm(h.name) === norm(a.name))) return { ok: false, reason: 'schon vorhanden', label: `Fokus-Thema: ${a.name}` };
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
      return { ok: !!a.name, label: join(`Event (Ausgehen): ${a.name}`, a.datum && date(a.datum), a.uhrzeit, a.ort, a.preis, a.event_status === 'zugesagt' ? 'bin dabei' : 'interessiert', a.reise && 'Reise') };
    case 'radar_eintrag':
      return { ok: !!a.titel, label: join(`Radar: ${a.titel}`, a.thema) };
    case 'app_wunsch':
      return { ok: !!a.titel, label: `App-Wunsch: ${a.titel}` };
    case 'merken':
      if (a.fakt && (s.memory || []).some((m) => norm(m.text) === norm(a.fakt))) return { ok: false, reason: 'schon gemerkt', label: `Merken: ${a.fakt}` };
      return { ok: !!a.fakt, label: `Merken: ${a.fakt}` };
    case 'training_eintragen':
      return { ok: !!(a.sportart || s.sports.length), label: join(`Training: ${findSport(s, a.sportart || 'Laufen')?.name || a.sportart || 'Laufen'}`, a.distanz_km && `${String(a.distanz_km).replace('.', ',')} km`, a.dauer && `${a.dauer}${/^\d+$/.test(String(a.dauer)) ? ' Min' : ''}`, isDate(a.datum) && a.datum !== today() ? date(a.datum) : 'heute', a.notiz) };
    case 'erinnerung_anlegen':
      return { ok: !!a.titel, label: join(`Erinnerung: ${a.titel}`, EVERY[a.wie_oft || 'monat'], isDate(a.datum) && `ab ${date(a.datum)}`) };
    case 'zuhause_eintrag':
      return { ok: !!a.titel && !!LISTS[a.liste || 'haushalt'], label: join(`${LISTS[a.liste || 'haushalt']?.title || 'Zuhause'}: ${a.titel}`, a.zuhause_kategorie, a.weggeben && 'weggeben') };
    case 'hobby_eintrag':
      return { ok: !!a.titel && !!a.hobby, label: join(`${a.hobby}: ${a.titel}`, a.hobby_art) };
    case 'reise_anlegen':
      return { ok: !!a.name, label: join(`Reise: ${a.name}`, isDate(a.datum) && date(a.datum), isDate(a.bis_datum) && `bis ${date(a.bis_datum)}`) };
    case 'einladung_eintragen':
      return { ok: !!a.name, label: join(`Einladung: ${a.name}`, a.gastgeber && `von ${a.gastgeber}`, isDate(a.datum) && date(a.datum), a.uhrzeit, a.ort, a.einladung_status === 'zugesagt' ? 'zugesagt' : a.einladung_status === 'abgesagt' ? 'abgesagt' : null) };
    case 'treffen_anlegen': {
      const ex = findGathering(s, a.name);
      const n = (a.gaeste || []).length;
      return { ok: !!a.name, label: join(`${ex ? 'Event ergänzen' : 'Eigenes Event'}: ${ex?.name || a.name}`, isDate(a.datum) && date(a.datum), a.uhrzeit, a.ort, n && `Gäste: ${a.gaeste.join(', ')}`, !n && a.ungefaehre_gaeste && `ca. ${a.ungefaehre_gaeste} Gäste`, (a.artikel || []).length && `Einkauf: ${a.artikel.join(', ')}`, (a.aufgaben || []).length && `To-dos: ${a.aufgaben.join(', ')}`) };
    }
    case 'material_anlegen':
      if (a.titel && (s.library || []).some((m) => norm(m.title) === norm(a.titel))) return { ok: false, reason: 'schon in der Bibliothek', label: `Bibliothek: ${a.titel}` };
      return { ok: !!a.titel, label: join(`${KINDS[a.material_art]?.label || 'Material'}: ${a.titel}`, a.autor, a.thema && `Thema ${a.thema}`) };
    case 'einkauf_hinzufuegen':
      return { ok: (a.artikel || []).length > 0, label: `Einkaufsliste: ${(a.artikel || []).join(', ')}` };
    case 'rezept_anlegen':
      return { ok: !!a.titel, label: join(`Rezept: ${a.titel}`, a.rezept_kategorie, (a.zutaten || []).length && `${a.zutaten.length} Zutaten`) };
    case 'vorsorge_anlegen':
      return { ok: !!a.titel, label: join(`${a.vorsorge_art === 'verletzung' ? 'Verletzung' : a.vorsorge_art === 'routine' ? 'Vorsorge (regelmäßig)' : 'Termin'}: ${a.titel}`, isDate(a.datum) && date(a.datum), a.alle_monate && `alle ${a.alle_monate} Monate`) };
    case 'thema_anlegen':
      if (a.thema && s.radar.topics.some((t) => norm(t) === norm(a.thema))) return { ok: false, reason: 'schon vorhanden', label: `News-Thema: ${a.thema}` };
      return { ok: !!a.thema, label: `News-Thema: ${a.thema}` };
    case 'ort_anlegen':
      return { ok: !!a.name, label: join(`Ort: ${a.name}`, a.ort_art, a.viertel, a.adresse, a.stadt && a.stadt !== 'Buenos Aires' && a.stadt, a.war_da ? (a.bewertung ? '★'.repeat(Math.min(5, a.bewertung)) : 'war da') : 'will hin') };
    case 'sport_event_anlegen':
      return { ok: !!a.name, label: join(`Sport-Event: ${a.name}`, a.sportart || s.sports[0]?.name, isDate(a.datum) && date(a.datum), a.ort, a.sport_status === 'angemeldet' ? 'angemeldet' : a.sport_status === 'dabei' ? 'dabei gewesen' : 'gemerkt') };
    case 'skill_ziel':
      return { ok: !!a.titel && !!a.skill, label: `${a.skill}: ${a.titel}` };
    case 'bewerbung_eintragen':
      return { ok: !!a.titel, label: join(`Bewerbung: ${a.titel}`, a.firma, stageOf(a.phase || 'interessiert').label) };
    case 'quelle_anlegen':
      return { ok: !!(a.name || a.url), label: join(`Quelle: ${a.name || a.url}`, a.url) };
    case 'fixkosten_anlegen':
      return { ok: !!a.titel, label: join(`Fixkosten: ${a.titel}`, a.betrag && `${a.betrag} ${a.waehrung || ''}`.trim(), catOf(a.kostenart).label) };
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
      return addEvent({ name: a.name, date: d(a.datum) || '', place: a.ort || '', travel: !!a.reise, time: /^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? a.uhrzeit.padStart(5, '0') : '', price: a.preis || '', url: /^https?:\/\//.test(a.url || '') ? a.url : '', note: a.notiz || '', stage: a.event_status === 'zugesagt' ? 'zugesagt' : 'interessiert', city: a.stadt && !/buenos aires/i.test(a.stadt) ? a.stadt : '' });
    case 'app_wunsch':
      return addWish(a.titel);
    case 'merken':
      return addMemory(a.fakt, area);
    case 'thema_anlegen':
      return addTopic(a.thema);
    case 'training_eintragen': {
      const sport = findSport(s, a.sportart || 'Laufen');
      const sportId = sport?.id || addSport(a.sportart || 'Laufen');
      return addSession({ sportId, date: d(a.datum) || today(), distance: a.distanz_km || null, duration: parseDuration(a.dauer), hr: a.puls || null, notes: a.notiz || '', source: 'assistent' });
    }
    case 'einkauf_hinzufuegen':
      return addShopping(a.artikel || []);
    case 'erinnerung_anlegen':
      return addReminder({ title: a.titel, every: a.wie_oft || 'monat', next: d(a.datum) || today(), note: a.notiz || '' });
    case 'zuhause_eintrag':
      return addHomeItem(a.liste || 'haushalt', { text: a.titel, cat: a.zuhause_kategorie, kind: a.weggeben ? 'weggeben' : 'brauche', url: a.url || '', note: a.notiz || '' });
    case 'hobby_eintrag':
      return addHobbyItem(addHobby(a.hobby), { title: a.titel, kind: a.hobby_art || 'idee', url: a.url || '', why: a.notiz || '' });
    case 'reise_anlegen':
      return addTrip({ name: a.name, dest: a.ort || a.name, from: d(a.datum) || '', to: d(a.bis_datum) || '' });
    case 'einladung_eintragen': {
      const ex = (s.invites || []).find((x) => !x.done && norm(x.name) === norm(a.name));
      const time = /^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? a.uhrzeit.padStart(5, '0') : '';
      const guests = (a.gaeste || []).join(', ');
      if (ex) {
        const patch = Object.fromEntries(Object.entries({ host: a.gastgeber, date: d(a.datum), time, place: a.ort, bring: a.mitbringen, status: a.einladung_status, url: a.url, note: a.notiz }).filter(([, v]) => v));
        if (guests) patch.guests = [ex.guests, guests].filter(Boolean).join(', ');
        updateInvite(ex.id, patch);
        return ex.id;
      }
      return addInvite({ guests, name: a.name, host: a.gastgeber || '', date: d(a.datum) || '', time: /^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? a.uhrzeit.padStart(5, '0') : '', place: a.ort || '', note: a.notiz || '', bring: a.mitbringen || '', status: a.einladung_status || 'eingeladen', url: a.url || '' });
    }
    case 'treffen_anlegen':
      return upsertGathering(s, { name: a.name, date: d(a.datum) || '', time: /^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? a.uhrzeit.padStart(5, '0') : '', place: a.ort || '', desc: a.notiz || '', kind: a.event_art, anlass: a.anlass, expected: a.ungefaehre_gaeste || '', guests: a.gaeste, shopping: a.artikel, todos: a.aufgaben, bring: a.mitbringen, motto: a.motto, diet: a.einschraenkungen, budget: a.budget });
    case 'material_anlegen':
      return addMaterial({ title: a.titel, kind: a.material_art || 'buch', subId: ensureTopic(a.thema || 'Allgemein'), author: a.autor || '', url: a.url || '', note: a.notiz || '' });
    case 'rezept_anlegen':
      return addRecipe({ title: a.titel, category: a.rezept_kategorie || 'Airfryer', ingredients: a.zutaten || [], steps: a.schritte || '', url: a.url || '' });
    case 'vorsorge_anlegen':
      return addHealthItem({ title: a.titel, type: a.vorsorge_art || 'termin', date: d(a.datum), everyMonths: a.alle_monate || null, time: /^\d{1,2}:\d{2}$/.test(a.uhrzeit || '') ? a.uhrzeit.padStart(5, '0') : '', notes: a.notiz || '' });
    case 'ort_anlegen': {
      const city = (a.stadt || '').trim() || 'Buenos Aires';
      const id = addPlace({ name: a.name, category: a.ort_art || 'Sonstiges', subcat: a.ort_unterart || '', note: a.notiz || '', address: a.adresse || '', hood: a.viertel || '', status: a.war_da ? 'war' : 'will', rating: a.war_da ? Math.min(5, a.bewertung || 0) : 0, city });
      // Kartenpunkt im Hintergrund suchen
      locate(a.name, a.adresse, city).then((pos) => pos && updatePlace(id, { lat: pos.lat, lon: pos.lon }));
      return id;
    }
    case 'radar_eintrag':
      return addRadarItem({ title: a.titel, url: a.url || '', why: a.warum || '', topic: a.thema || '' });
    case 'sport_event_anlegen': {
      const sportId = findSport(s, a.sportart || '')?.id || (a.sportart ? addSport(a.sportart) : s.sports[0]?.id || addSport('Laufen'));
      return addSportEvent({ sportId, name: a.name, date: d(a.datum) || '', place: a.ort || '', url: a.url || '', note: a.notiz || '', status: a.sport_status || 'interessiert' });
    }
    case 'skill_ziel': {
      const sk = (s.skills || []).find((x) => norm(x.name) === norm(a.skill)) ;
      const id = sk?.id || addSkill(a.skill);
      return addSkillTodos(id, [a.titel]);
    }
    case 'bewerbung_eintragen': {
      const known = (s.jobs || []).find((j) => norm(j.title) === norm(a.titel) && (!a.firma || norm(j.company) === norm(a.firma))) || (a.firma ? (s.jobs || []).find((j) => norm(j.company) === norm(a.firma)) : null);
      if (known) return updateJob(known.id, { status: a.phase || known.status, note: a.notiz ? [known.note, `${today()}: ${a.notiz}`].filter(Boolean).join('\n') : known.note });
      const search = findBy(s.jobSearches || [], a.suche, 'name') || (s.jobSearches || [])[0];
      const searchId = search?.id || addSearch({ name: 'Allgemein' });
      return addJob({ searchId, title: a.titel, company: a.firma || '', url: a.url || '', note: a.notiz ? `${today()}: ${a.notiz}` : '', status: a.phase || 'interessiert' });
    }
    case 'quelle_anlegen':
      return addSource({ name: a.name || '', url: a.url || '', note: a.notiz || '' });
    case 'fixkosten_anlegen':
      return addLine('costs', { name: a.titel, amount: Number(a.betrag) || 0, currency: a.waehrung || 'ARS', cat: a.kostenart || 'sonstiges' });
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
