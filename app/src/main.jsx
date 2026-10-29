import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { installFieldTools } from './lib/fieldtools';
import { installTheme } from './lib/theme';
installTheme();

createRoot(document.getElementById('root')).render(<App />);
installFieldTools();
// v0.95: Tab-Leiste ausblenden, solange die Tastatur offen ist (iPhone schob sie sonst nach oben über die Tastatur)
{
  const isField = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file)$/.test(el.type)) || el.isContentEditable);
  document.addEventListener('focusin', (e) => { if (isField(e.target)) document.documentElement.classList.add('kb-open'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!isField(document.activeElement)) document.documentElement.classList.remove('kb-open'); }, 50));
}

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
