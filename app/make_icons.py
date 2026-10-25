"""Erzeugt die App-Icons: drei Säulen (Persönlich, Sozial, Professionell) auf Sandgrund."""
from PIL import Image, ImageDraw

BG = "#F1EDE4"
BARS = [("#7A8F6A", 0.44), ("#C4876B", 0.62), ("#5F7C99", 0.52)]  # Farbe, Höhe relativ


def icon(size, path):
    scale = 4
    s = size * scale
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    w = s * 0.15
    gap = s * 0.055
    total = 3 * w + 2 * gap
    x0 = (s - total) / 2
    base = s * 0.76
    for i, (color, h) in enumerate(BARS):
        x = x0 + i * (w + gap)
        d.rounded_rectangle([x, base - s * h, x + w, base], radius=w / 2, fill=color)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)


icon(180, "public/apple-touch-icon.png")
icon(192, "public/icon-192.png")
icon(512, "public/icon-512.png")
print("Icons erstellt")
