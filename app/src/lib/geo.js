// v1.08: Land und Region einer Reise erkennen (ohne KI) – für Suche/Filter in Reisen
const R = {
  'Südamerika': ['argentinien', 'brasilien', 'chile', 'uruguay', 'paraguay', 'bolivien', 'peru', 'ecuador', 'kolumbien', 'venezuela', 'patagonien', 'südamerika'],
  'Mittelamerika & Karibik': ['mexiko', 'costa rica', 'panama', 'guatemala', 'belize', 'nicaragua', 'honduras', 'el salvador', 'kuba', 'dominikanische republik', 'jamaika', 'puerto rico', 'karibik', 'aruba', 'curaçao', 'bahamas'],
  'Nordamerika': ['usa', 'vereinigte staaten', 'kanada'],
  'Europa': ['deutschland', 'österreich', 'schweiz', 'italien', 'spanien', 'portugal', 'frankreich', 'griechenland', 'kroatien', 'niederlande', 'belgien', 'england', 'großbritannien', 'vereinigtes königreich', 'schottland', 'irland', 'island', 'norwegen', 'schweden', 'finnland', 'dänemark', 'polen', 'tschechien', 'ungarn', 'slowenien', 'montenegro', 'albanien', 'malta', 'zypern', 'türkei', 'rumänien', 'bulgarien', 'europa'],
  'Asien': ['china', 'japan', 'südkorea', 'korea', 'thailand', 'vietnam', 'kambodscha', 'laos', 'indonesien', 'bali', 'malaysia', 'singapur', 'philippinen', 'indien', 'sri lanka', 'nepal', 'taiwan', 'hongkong', 'mongolei', 'asien', 'südostasien'],
  'Naher Osten': ['vereinigte arabische emirate', 'dubai', 'israel', 'jordanien', 'oman', 'katar', 'saudi-arabien'],
  'Afrika': ['marokko', 'ägypten', 'südafrika', 'kenia', 'tansania', 'namibia', 'botswana', 'kap verde', 'tunesien', 'madagaskar', 'mauritius', 'sansibar', 'afrika'],
  'Ozeanien': ['australien', 'neuseeland', 'fidschi'],
};
const REGION_OF = Object.fromEntries(Object.entries(R).flatMap(([r, l]) => l.map((c) => [c, r])));
// häufige Städte/Orte → Land
const CITY = {
  'buenos aires': 'Argentinien', bariloche: 'Argentinien', mendoza: 'Argentinien', salta: 'Argentinien', ushuaia: 'Argentinien', 'el calafate': 'Argentinien', iguazu: 'Argentinien', córdoba: 'Argentinien', cordoba: 'Argentinien', 'mar del plata': 'Argentinien',
  'rio de janeiro': 'Brasilien', rio: 'Brasilien', florianópolis: 'Brasilien', florianopolis: 'Brasilien', 'são paulo': 'Brasilien', 'sao paulo': 'Brasilien', salvador: 'Brasilien', búzios: 'Brasilien', buzios: 'Brasilien', garopaba: 'Brasilien',
  montevideo: 'Uruguay', 'punta del este': 'Uruguay', 'colonia': 'Uruguay', 'cabo polonio': 'Uruguay', santiago: 'Chile', valparaíso: 'Chile', 'atacama': 'Chile', 'san pedro de atacama': 'Chile', lima: 'Peru', cusco: 'Peru', 'machu picchu': 'Peru', cartagena: 'Kolumbien', medellín: 'Kolumbien', bogotá: 'Kolumbien',
  cancún: 'Mexiko', cancun: 'Mexiko', tulum: 'Mexiko', 'mexiko-stadt': 'Mexiko', 'new york': 'USA', miami: 'USA',
  lissabon: 'Portugal', porto: 'Portugal', madrid: 'Spanien', barcelona: 'Spanien', mallorca: 'Spanien', rom: 'Italien', mailand: 'Italien', florenz: 'Italien', venedig: 'Italien', neapel: 'Italien', sizilien: 'Italien', paris: 'Frankreich', london: 'England', berlin: 'Deutschland', münchen: 'Deutschland', hamburg: 'Deutschland', frankfurt: 'Deutschland', wien: 'Österreich', zürich: 'Schweiz', amsterdam: 'Niederlande', athen: 'Griechenland',
  peking: 'China', beijing: 'China', shanghai: 'China', "xi'an": 'China', xian: 'China', chengdu: 'China', guilin: 'China', tokio: 'Japan', tokyo: 'Japan', kyoto: 'Japan', bangkok: 'Thailand', bali: 'Indonesien', dubai: 'Vereinigte Arabische Emirate', marrakesch: 'Marokko', kapstadt: 'Südafrika', sydney: 'Australien',
};
const cap = (x) => x.replace(/(^|\s|-)\S/g, (m) => m.toUpperCase());
export function tripCountry(tr) {
  const parts = [tr.dest, tr.name, ...(tr.stops || []).map((x) => x.name)].filter(Boolean).flatMap((d) => String(d).split(/,|–|-|\//)).map((x) => x.trim().toLowerCase()).filter(Boolean);
  for (const p of parts) if (REGION_OF[p] && !['europa', 'asien', 'afrika', 'südamerika', 'südostasien', 'karibik', 'patagonien'].includes(p)) return cap(p);
  for (const p of parts) if (CITY[p]) return CITY[p];
  return '';
}
export function tripRegion(tr) {
  const c = tripCountry(tr).toLowerCase();
  if (c && REGION_OF[c]) return REGION_OF[c];
  const parts = [tr.dest, tr.name, tr.group].filter(Boolean).join(' ').toLowerCase();
  for (const [k, r] of Object.entries(REGION_OF)) if (parts.includes(k)) return r;
  return '';
}
export const tripText = (tr) => [tr.name, tr.dest, tr.group, tripCountry(tr), tripRegion(tr), ...(tr.stops || []).map((x) => x.name), ...((tr.variants || []).flatMap((v) => (v.stops || []).map((x) => x.name)))].filter(Boolean).join(' ').toLowerCase();
