import { useRoute } from './lib/router';
import { Toaster } from './components/ui';
import Heute from './screens/Heute';
import Bereiche from './screens/Bereiche';
import Saeule, { Missing } from './screens/Saeule';
import Bereich from './screens/Bereich';
import Projekt from './screens/Projekt';
import Erfassen from './screens/Erfassen';
import Menschen from './screens/Menschen';
import Person from './screens/Person';
import Radar from './screens/Radar';
import Einstellungen from './screens/Einstellungen';
import Unterbereich from './screens/Unterbereich';
import Vorlagen from './screens/Vorlagen';
import Assistent from './screens/Assistent';
import Wuensche from './screens/Wuensche';

export default function App() {
  const [page, a, b] = useRoute();
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
    case 'projekt': screen = <Projekt key={a} id={a} />; break;
    case 'erfassen': screen = <Erfassen />; break;
    case 'menschen': screen = <Menschen />; break;
    case 'person': screen = <Person key={a + (b || '')} id={a} metAt={b} />; break;
    case 'radar': screen = <Radar />; break;
    case 'einstellungen': screen = <Einstellungen />; break;
    default: screen = <Missing />;
  }
  return (
    <div className="app">
      {screen}
      <Toaster />
    </div>
  );
}
