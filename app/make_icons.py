"""Erzeugt die App-Icons (dunkler Hintergrund, drei Punkte für die drei Säulen)."""
from PIL import Image, ImageDraw

COLORS = ["#6E62D6", "#D2642E", "#13805F"]


def icon(size, path):
    scale = 4
    s = size * scale
    img = Image.new("RGB", (s, s), "#1C1C1E")
    d = ImageDraw.Draw(img)
    r = s * 0.11
    gap = s * 0.27
    cy = s / 2
    for i, c in enumerate(COLORS):
        cx = s / 2 + (i - 1) * gap
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)


icon(180, "public/apple-touch-icon.png")
icon(192, "public/icon-192.png")
icon(512, "public/icon-512.png")
print("Icons erstellt")
