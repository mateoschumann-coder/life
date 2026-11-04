// v1.57 (Mateo): „Erinnern“ – wann der Eintrag schon vorher auf Heute auftaucht (Standard: 1 Tag vorher, in den Einstellungen änderbar)
import { REMIND_OPTIONS, remindDefault } from '../lib/logic';
import { Field } from './ui';

export const remindLabel = (n) => (REMIND_OPTIONS.find(([v]) => v === Number(n)) || [0, `${n} Tage vorher`])[1];

export default function RemindPicker({ s, value, onChange, label = '🔔 Erinnern' }) {
  const def = remindDefault(s);
  return (
    <Field label={label}>
      <select className="input" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
        <option value="">Standard ({remindLabel(def)})</option>
        {REMIND_OPTIONS.map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}
      </select>
    </Field>
  );
}
