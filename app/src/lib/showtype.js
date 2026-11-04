// Art eines Unterhaltungs-Eintrags (Filme · Fernsehen · Sport) – reine Funktion, auch für Suche/Tests ohne Speicher
export const showType = (x) => (['film', 'tv', 'sport'].includes(x?.type) ? x.type : /kino|film|cine/i.test(`${x?.cat} ${x?.where}`) ? 'film' : /serie|doku|staffel|show|netflix|stream/i.test(`${x?.cat} ${x?.note}`) ? 'tv' : 'sport');
