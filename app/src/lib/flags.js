// v1.10: Einmal-Signale zwischen Seiten (z.B. „Formular gleich öffnen“) über sessionStorage
export const takeFlag = (k) => { try { const v = sessionStorage.getItem(k); if (v) sessionStorage.removeItem(k); return v; } catch { return null; } };
export const setFlag = (k, v = '1') => { try { sessionStorage.setItem(k, v); } catch {} };
