// Gesprächsverläufe der Bereichs-Chats (Sport-Coach, Küche, Hobbys, Lernen) – gespeichert in s.chats
import { store } from './store';

export const chatOf = (s, key) => (s.chats || {})[key] || [];
export const saveChatOf = (key, hist) => store.update((s) => {
  s.chats = { ...(s.chats || {}), [key]: hist };
});
export const memoryOf = (s) => JSON.stringify((s.memory || []).map((m) => m.text));
