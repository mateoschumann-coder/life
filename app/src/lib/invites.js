// Events von anderen (v0.42, Mateo): Einladungen zu Geburtstagen, Asados, Hochzeiten … eintragen – Status, wer lädt ein, was bringe ich mit
import { store } from './store';
import { today } from './dates';

export const INVITE_STATUS = { eingeladen: 'Eingeladen', vielleicht: 'Vielleicht', zugesagt: 'Zugesagt', abgesagt: 'Abgesagt' };
export const INVITE_COLOR = { eingeladen: 'var(--accent)', vielleicht: 'var(--warn)', zugesagt: '#2FA36B', abgesagt: 'var(--danger)' };
const uid = () => Math.random().toString(36).slice(2, 10);

export function addInvite({ name, host = '', date = '', time = '', place = '', note = '', bring = '', guests = '', status = 'eingeladen', url = '' }) {
  const t = String(name || '').trim();
  if (!t) return null;
  const id = uid();
  store.update((s) => {
    s.invites = s.invites || [];
    s.invites.push({ id, name: t, host: host.trim(), date, time, place: place.trim(), note, bring, guests, status: INVITE_STATUS[status] ? status : 'eingeladen', url, done: false, createdAt: today() });
  });
  return id;
}
export const updateInvite = (id, patch) => store.update((s) => Object.assign((s.invites || []).find((x) => x.id === id) || {}, patch));
export const removeInvite = (id) => store.update((s) => { s.invites = (s.invites || []).filter((x) => x.id !== id); });
