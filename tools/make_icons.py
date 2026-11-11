"""Erzeugt die PWA-Icons (PNG) aus einem einfachen Design: Blau + weißes Epsilon."""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "icons")
BLUE = (31, 78, 140)
CREAM = (246, 241, 231)
FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def icon(size, maskable=False, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=BLUE)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=BLUE)
    glyph = "Ε"
    fsize = int(size * (0.5 if maskable else 0.62))
    font = ImageFont.truetype(FONT, fsize)
    bbox = d.textbbox((0, 0), glyph, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]
    d.text((x, y), glyph, font=font, fill=CREAM)
    return img


os.makedirs(OUT, exist_ok=True)
icon(192).save(os.path.join(OUT, "icon-192.png"))
icon(512).save(os.path.join(OUT, "icon-512.png"))
icon(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
icon(180, radius_ratio=0).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
print("Icons erzeugt in", os.path.abspath(OUT))
