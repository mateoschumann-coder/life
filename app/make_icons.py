"""Erzeugt die App-Icons (v1.41, Mateos Wahl „Option 1 dunkel“):
offener Ring mit Verlauf (hell → taupe), goldener Punkt in der Lücke, heller Punkt in der Mitte, schwarzer Grund."""
import math
from PIL import Image, ImageDraw


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def icon(size, path, pad=0.0):
    scale = 4
    s = size * scale
    img = Image.new("RGB", (s, s))
    d = ImageDraw.Draw(img)
    # Grund: fast schwarz, leicht nach unten dunkler
    top, bottom = hex2rgb("#262523"), hex2rgb("#121211")
    for y in range(s):
        d.line([(0, y), (s, y)], fill=lerp(top, bottom, y / s))

    k = 1 - 2 * pad  # für „maskable“ etwas kleiner
    cx, cy = s * 0.5, s * 0.5
    R = s * 0.30 * k       # Mittellinie des Rings
    w = s * 0.075 * k      # Strichstärke
    # Ring: von 68° gegen den Uhrzeigersinn bis 372° (Lücke oben rechts), Verlauf hell → taupe
    c0, c1, c2 = hex2rgb("#E6DDCF"), hex2rgb("#B5A893"), hex2rgb("#5F574D")
    a0, a1 = 68, 372
    steps = 1400
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(a0 + (a1 - a0) * t)
        x = cx + R * math.cos(a)
        y = cy - R * math.sin(a)
        col = lerp(c0, c1, t / 0.55) if t < 0.55 else lerp(c1, c2, (t - 0.55) / 0.45)
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    # goldener Punkt in der Lücke
    ga = math.radians(40)
    gx, gy, gr = cx + R * math.cos(ga), cy - R * math.sin(ga), s * 0.06 * k
    d.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=hex2rgb("#C9A57B"))
    # heller Punkt in der Mitte
    mr = s * 0.095 * k
    d.ellipse([cx - mr, cy - mr, cx + mr, cy + mr], fill=hex2rgb("#F4EFE6"))

    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)


icon(180, "public/apple-touch-icon.png")
icon(192, "public/icon-192.png")
icon(512, "public/icon-512.png")
icon(512, "public/icon-maskable.png", pad=0.08)
print("Icons erstellt")
