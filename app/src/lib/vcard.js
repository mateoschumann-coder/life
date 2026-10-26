// Kontakte aus dem iPhone übernehmen: .vcf-Datei (vCard) lesen – Name, Telefon, Geburtstag
const unfold = (txt) => String(txt || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
const decodeQP = (v) => v.replace(/=\n/g, '').replace(/(=[0-9A-F]{2})+/gi, (m) => {
  try {
    return decodeURIComponent(m.replace(/=/g, '%'));
  } catch {
    return m;
  }
});
const unescape = (v) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

function bday(v) {
  const x = v.replace(/T.*$/, '').trim();
  let m = x.match(/^(\d{4}|--)-?(\d{2})-?(\d{2})$/);
  if (!m) return '';
  const y = m[1] === '--' || m[1] === '1604' ? '' : m[1];
  // ohne Jahr: Platzhalterjahr 1900 (Geburtstagsrechnung braucht nur Monat/Tag)
  return `${y || '1900'}-${m[2]}-${m[3]}`;
}

export function parseVcf(text) {
  const out = [];
  for (const card of unfold(text).split(/BEGIN:VCARD/i).slice(1)) {
    let name = '';
    let n = '';
    let phone = '';
    let birthday = '';
    for (const line of card.split('\n')) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const head = line.slice(0, i);
      let val = line.slice(i + 1);
      if (/ENCODING=QUOTED-PRINTABLE/i.test(head)) val = decodeQP(val);
      const key = head.split(';')[0].replace(/^item\d+\./i, '').toUpperCase();
      if (key === 'FN') name = unescape(val);
      else if (key === 'N') n = val.split(';').slice(0, 2).reverse().map(unescape).filter(Boolean).join(' ');
      else if (key === 'TEL' && (!phone || /CELL|MOBILE|IPHONE|pref/i.test(head))) phone = val.replace(/^tel:/i, '').trim();
      else if (key === 'BDAY') birthday = bday(val);
    }
    const nm = name || n;
    if (nm) out.push({ name: nm, phone, birthday });
  }
  return out;
}

// Kontakt-Auswahl des Browsers (nur manche Android-Browser; auf dem iPhone meist nicht verfügbar)
export const canPickContacts = () => typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function';
export async function pickContacts() {
  const list = await navigator.contacts.select(['name', 'tel'], { multiple: true });
  return list.map((c) => ({ name: (c.name || [])[0] || '', phone: (c.tel || [])[0] || '', birthday: '' })).filter((c) => c.name);
}
