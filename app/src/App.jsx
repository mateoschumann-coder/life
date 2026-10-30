import { Fragment, useEffect, useState } from 'react';
import { useRoute } from './lib/router';
import { Toaster } from './components/ui';
import Heute from './screens/Heute';
import Bereiche from './screens/Bereiche';
import Saeule, { Missing } from './screens/Saeule';
import Bereich from './screens/Bereich';
import Projekt from './screens/Projekt';
import Erfassen from './screens/Erfassen';
import Aktionen from './screens/Aktionen';
import Menschen from './screens/Menschen';
import Person from './screens/Person';
import Radar from './screens/Radar';
import Einstellungen from './screens/Einstellungen';
import Unterbereich from './screens/Unterbereich';
import Vorlagen from './screens/Vorlagen';
import Assistent from './screens/Assistent';
import Wuensche from './screens/Wuensche';
import Gedaechtnis from './screens/Gedaechtnis';
import Ausgehen from './screens/Ausgehen';
import Sport from './screens/Sport';
import Kueche from './screens/Kueche';
import Vorsorge from './screens/Vorsorge';
import Karriere from './screens/Karriere';
import Skills from './screens/Skills';
import News from './screens/News';
import Finanzen from './screens/Finanzen';
import Wissen from './screens/Wissen';
import Zuhause from './screens/Zuhause';
import Hobbys from './screens/Hobbys';
import Reisen from './screens/Reisen';
import Treffen from './screens/Treffen';
import FloatingAssistant from './components/FloatingAssistant';
import { useFabOn } from './lib/fab';
import QuickTask from './components/QuickTask';
import GlobalSearch from './components/GlobalSearch';

export default function App() {
  const [page, a, b] = useRoute();
  const fab = useFabOn();
  // v1.35: Sprung auf dieselbe Seite (z.B. aus der Suche) → Seite neu aufbauen, damit Reiter/Filter greifen
  const [nonce, setNonce] = useState(0);
  useEffect(() => { const h = () => setNonce((n) => n + 1); window.addEventListener('life-remount', h); return () => window.removeEventListener('life-remount', h); }, []);

  let screen;
  switch (page) {
    case '':
    case 'heute': screen = <Heute />; break;
    case 'bereiche': screen = <Bereiche />; break;
    case 'saeule': screen = <Saeule id={a} />; break;
    case 'bereich': screen = <Bereich key={a} id={a} />; break;
    case 'unterbereich': screen = <Unterbereich key={a + b} areaId={a} subId={b} />; break;
    case 'vorlagen': screen = <Vorlagen />; break;
    case 'assistent': screen = <Assistent />; break;
    case 'wuensche': screen = <Wuensche />; break;
    case 'gedaechtnis': screen = <Gedaechtnis />; break;
    case 'ausgehen': screen = <Ausgehen />; break;
    case 'sport': screen = <Sport key={a || 'liste'} id={a} />; break;
    case 'kueche': screen = <Kueche />; break;
    case 'vorsorge': screen = <Vorsorge />; break;
    case 'karriere': screen = <Karriere key={(a || '') + (b || '')} view={a} id={b} />; break;
    case 'news': screen = <News />; break;
    case 'finanzen': screen = <Finanzen />; break;
    case 'skills': screen = <Skills key={a || 'liste'} id={a} />; break;
    case 'wissen': screen = <Wissen key={a || 'bibliothek'} catId={a} />; break;
    case 'zuhause': screen = <Zuhause tab={a} />; break;
    case 'hobbys': screen = <Hobbys key={a || 'liste'} id={a} />; break;
    case 'reisen': screen = <Reisen key={a || 'liste'} id={a} />; break;
    case 'treffen': screen = <Treffen key={a || 'liste'} id={a} />; break;
    case 'projekt': screen = <Projekt key={a} id={a} />; break;
    case 'erfassen': screen = <Erfassen />; break;
    case 'los': screen = <Aktionen />; break;
    case 'menschen': screen = <Menschen />; break;
    case 'person': screen = <Person key={a + (b || '')} id={a} metAt={b} />; break;
    case 'radar': screen = <Radar />; break;
    case 'einstellungen': screen = <Einstellungen />; break;
    default: screen = <Missing />;
  }
  return (
    <div className="app">
      <Fragment key={nonce}>{screen}</Fragment>
      {page !== 'assistent' && <FloatingAssistant hideFab={!fab || (page === 'reisen' && !!a)} />}
      <QuickTask />
      <GlobalSearch />
      <Toaster />
    </div>
  );
}
