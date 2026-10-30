// v1.30 (Mateo): Ein KI-Ausfüller für jedes Formular – erzählen/Text/Link → Felder.
// fields: { key: 'Beschreibung' | { d: 'Beschreibung', enum: [...] } }
import { searchWithTool } from './outings';
import { fmtLong, today } from './dates';

export async function fillForm({ title, fields, values = {}, text, hint = '' }) {
  const props = {};
  for (const [k, v] of Object.entries(fields)) {
    const o = typeof v === 'string' ? { d: v } : v;
    props[k] = { type: 'string', description: o.d + (o.enum ? ` – eins von: ${o.enum.join(', ')}` : '') };
  }
  const filled = Object.fromEntries(Object.entries(values || {}).filter(([k, v]) => fields[k] && v != null && String(v).trim()));
  const hasLink = /https?:\/\//.test(text || '');
  const t = today();
  const r = await searchWithTool({
    system: `Mateo füllt in seiner App das Formular „${title}“ aus und hat dazu etwas erzählt, geschrieben oder einen Link eingefügt. Fülle die Felder daraus aus. ${Object.keys(filled).length ? `Schon eingetragen: ${JSON.stringify(filled)} – diese Angaben nutzen und nur ändern, wenn Mateo ausdrücklich etwas anderes sagt; fehlende Felder sinnvoll ergänzen.` : ''} Nichts erfinden: Unbekanntes leer lassen. Datum als YYYY-MM-DD (relative Angaben wie „nächsten Freitag“ umrechnen), Uhrzeit als HH:MM. Heute ist ${t} (${fmtLong(t)}).${hasLink ? ' Ist ein Link dabei: öffne die Seite (web_fetch) und nimm die Details von dort; den Link selbst ins Link-Feld.' : ''} ${hint} Antworte mit "formular_fuellen".`,
    user: (text || '').trim() || '(Kein neuer Text – ergänze nur, was aus den schon eingetragenen Angaben sicher folgt.)',
    tool: { name: 'formular_fuellen', description: `Felder für „${title}“`, input_schema: { type: 'object', properties: props, required: [] } },
    maxUses: 0, maxTokens: hasLink ? 2500 : 900, label: `Ausfüllen: ${title}`, fetch: hasLink, fetchMax: 2,
  });
  const out = {};
  for (const [k, v] of Object.entries(r || {})) {
    if (!fields[k] || v == null || !String(v).trim()) continue;
    const o = typeof fields[k] === 'string' ? {} : fields[k];
    if (o.enum && !o.enum.includes(v)) continue;
    out[k] = String(v).trim();
  }
  return out;
}
