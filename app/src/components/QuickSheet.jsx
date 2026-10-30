// v1.32 (Mateo): „⚡“-Schnellzugriff – Vorschläge stehen nicht mehr untereinander auf der Seite,
// sondern hinter einem kleinen Knopf in einem Fenster (wie bei Vorsorge).
import { useState } from 'react';
import { Sheet } from './ui';

export default function QuickSheet({ label = '⚡ Schnell', title = 'Schnell auswählen', className = 'btn small tint', style, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} style={{ flexShrink: 0, ...style }} onClick={() => setOpen(true)} aria-label={title}>{label}</button>
      <Sheet open={open} title={title} onClose={() => setOpen(false)}>
        {open && children(() => setOpen(false))}
      </Sheet>
    </>
  );
}
