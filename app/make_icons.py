"""Erzeugt die App-Icons im Kai-Stil: Berg mit Sonne auf dunkelblauem Grund."""
from PIL import Image, ImageDraw


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def icon(size, path):
    scale = 4
    s = size * scale
    img = Image.new("RGB", (s, s))
    d = ImageDraw.Draw(img)
    top, bottom = hex2rgb("#2D55B8"), hex2rgb("#1A2F6E")
    for y in range(s):
        d.line([(0, y), (s, y)], fill=lerp(top, bottom, y / s))
    # Sonne
    r = s * 0.115
    cx, cy = s * 0.63, s * 0.30
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hex2rgb("#FCD48A"))

    def ridge(points, c_top, c_bottom, y0, y1):
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).polygon([(x * s, y * s) for x, y in points], fill=255)
        grad = Image.new("RGB", (s, s))
        gd = ImageDraw.Draw(grad)
        for y in range(s):
            t = min(1, max(0, (y / s - y0) / (y1 - y0)))
            gd.line([(0, y), (s, y)], fill=lerp(hex2rgb(c_top), hex2rgb(c_bottom), t))
        img.paste(grad, (0, 0), mask)

    # Bergkette (hell, mit Verlauf) und vordere Hügel (dunkler)
    ridge([(0, 0.80), (0.16, 0.64), (0.38, 0.43), (0.52, 0.56), (0.68, 0.47), (1.0, 0.72), (1.0, 1.0), (0, 1.0)], "#D6E0F4", "#6F8ED2", 0.43, 0.95)
    ridge([(0, 0.86), (0.28, 0.74), (0.55, 0.82), (0.80, 0.72), (1.0, 0.80), (1.0, 1.0), (0, 1.0)], "#5D7CC4", "#2E4C9A", 0.72, 1.0)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)


icon(180, "public/apple-touch-icon.png")
icon(192, "public/icon-192.png")
icon(512, "public/icon-512.png")
print("Icons erstellt")
