// v1.29 (Mateo): Personen-Profil per Sprache/Text ausfüllen
import { searchWithTool } from './outings';
import { fmtLong, today } from './dates';

const TOOL = {
  name: 'person_lesen',
  description: 'Was Mateo über eine Person erzählt, in Profilfelder sortieren.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Voller Name, nur wenn genannt' },
      kategorie: { type: 'string', enum: ['', 'familie', 'freunde', 'neu', 'beruflich'] },
      telefon: { type: 'string', description: 'Mit Ländervorwahl, wenn genannt' },
      geburtstag: { type: 'string', description: 'YYYY-MM-DD; Jahr unbekannt → 1900' },
      rhythmus_tage: { type: 'integer', description: 'Wie oft melden: 7, 14, 30, 60, 90, 180; -1 = läuft von selbst; 0 = nicht genannt' },
      notizen: { type: 'array', items: { type: 'string' }, description: 'Dauerhafte Infos: Interessen, Familie, Arbeit, Geschenkideen – je kurz' },
      vorhaben: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, datum: { type: 'string', description: 'YYYY-MM-DD oder leer' } }, required: ['titel'] }, description: 'Was Mateo mit der Person tun will (anrufen, über X sprechen, treffen …)' },
      termine: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, datum: { type: 'string' }, bis: { type: 'string' } }, required: ['text'] }, description: 'Was bei der Person ansteht (Reise, Prüfung, Umzug …) mit Datum/Zeitraum' },
      kontakt_heute: { type: 'boolean', description: 'Mateo hatte heute Kontakt (gesprochen, getroffen)' },
    },
    required: [],
  },
};

export async function parsePersonText(s, p, text) {
  const t = today();
  return searchWithTool({
    system: `Mateo erzählt etwas über ${p?.name ? `seinen Kontakt „${p.name}“` : 'eine Person'}. Sortiere es in die Felder: dauerhafte Infos → notizen (kurz, keine Wiederholung von schon Bekanntem), Absichten von Mateo → vorhaben, Ereignisse bei der Person mit Zeit → termine. Nichts erfinden, Unbekanntes leer lassen. Heute ist ${t} (${fmtLong(t)}); relative Angaben („nächsten Freitag“) in Daten umrechnen.${p?.notes ? ` Bisherige Notizen: ${p.notes}` : ''} Antworte mit "person_lesen".`,
    user: text, tool: TOOL, maxUses: 0, maxTokens: 900, label: 'Person ausfüllen',
  });
}
