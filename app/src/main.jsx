import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// Offline-Fähigkeit (nur in der fertigen Version)
if (!__DEV__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Updates sofort holen: beim Öffnen und beim Zurückkehren in die App nachsehen, ob es eine neue Version gibt
if (!__DEV__) {
  const current = document.querySelector('script[src*="main.js"]')?.getAttribute('src')?.match(/v=([^&]+)/)?.[1];
  const check = async () => {
    try {
      const html = await (await fetch(`./index.html?check=${Date.now()}`, { cache: 'no-store' })).text();
      const latest = html.match(/main\.js\?v=([^"'&]+)/)?.[1];
      if (current && latest && latest !== current) location.reload();
    } catch {}
  };
  setTimeout(check, 2000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}
