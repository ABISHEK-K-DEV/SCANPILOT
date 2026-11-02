#!/usr/bin/env python3
"""Generates the sample page images used by the screenshot/demo build.

Usage: python3 scripts/screenshots/make_demo_assets.py <out-dir>
All content is synthetic (no real documents)."""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(sys.argv[1])
random.seed(7)
NAVY = (11, 27, 63)
GREY = (120, 130, 150)
LIGHT = (225, 230, 240)
BLUE = (45, 91, 255)
W, H = 620, 877  # A4 aspect at preview resolution


def page(bg=(255, 255, 255)):
    im = Image.new("RGB", (W, H), bg)
    return im, ImageDraw.Draw(im)


def text_lines(d, x, y, width, count, gap=18, h=7, colour=GREY, ragged=True):
    for i in range(count):
        w = width * (random.uniform(0.55, 1.0) if ragged and i % 5 == 4 else random.uniform(0.85, 1.0))
        d.rounded_rectangle([x, y, x + w, y + h], radius=3, fill=colour)
        y += gap
    return y


def heading(d, x, y, w, h=16, colour=NAVY):
    d.rounded_rectangle([x, y, x + w, y + h], radius=4, fill=colour)


def lease(n):
    im, d = page()
    heading(d, 60, 70, 300, 22)
    text_lines(d, 60, 110, 200, 1, colour=LIGHT)
    y = 160
    for _ in range(4 if n == 1 else 5):
        heading(d, 60, y, 160, 11)
        y = text_lines(d, 60, y + 28, 500, 6) + 22
    if n == 1:
        d.line([60, 800, 250, 800], fill=NAVY, width=2)
        d.line([370, 800, 560, 800], fill=NAVY, width=2)
    return im


def bill(n):
    im, d = page()
    d.rectangle([0, 0, W, 110], fill=(255, 196, 0))
    heading(d, 50, 40, 220, 26, NAVY)
    heading(d, 430, 46, 140, 14, NAVY)
    y = 150
    for i in range(14):
        fill = (246, 248, 252) if i % 2 else (255, 255, 255)
        d.rectangle([50, y, 570, y + 34], fill=fill)
        text_lines(d, 64, y + 13, 220, 1, ragged=False)
        d.rounded_rectangle([470, y + 13, 550, y + 20], radius=3, fill=NAVY if i == 13 else GREY)
        y += 34
    d.rounded_rectangle([370, 700, 570, 760], radius=10, fill=(255, 243, 210))
    heading(d, 390, 722, 160, 16)
    return im


def receipt(n):
    im, d = page((236, 238, 242))
    d.rectangle([190, 30, 430, 850], fill=(255, 255, 255))
    heading(d, 250, 60, 120, 16)
    y = text_lines(d, 215, 100, 190, 2, colour=LIGHT, ragged=False) + 20
    for _ in range(16):
        text_lines(d, 215, y, 110, 1, ragged=False)
        d.rounded_rectangle([355, y, 405, y + 7], radius=3, fill=GREY)
        y += 24
    d.line([215, y + 10, 405, y + 10], fill=NAVY, width=2)
    heading(d, 215, y + 30, 70, 14)
    heading(d, 345, y + 30, 60, 14)
    for i in range(30):
        d.rectangle([225 + i * 6, 790, 228 + i * 6, 830], fill=NAVY if random.random() > 0.35 else (255, 255, 255))
    return im


def notes(n):
    im, d = page((255, 253, 240))
    for y in range(110, H, 32):
        d.line([0, y, W, y], fill=(190, 215, 240), width=1)
    d.line([80, 0, 80, H], fill=(240, 160, 160), width=2)
    y = 118
    for i in range(22):
        x = 100
        while x < 560:
            w = random.randint(25, 90)
            d.line([x, y + 14, x + w, y + 12 + random.randint(-2, 2)], fill=(30, 50, 140), width=3)
            x += w + random.randint(10, 18)
        y += 32
    return im


def passport(n):
    im, d = page()
    d.rounded_rectangle([100, 120, 520, 400], radius=16, fill=(232, 238, 250), outline=(180, 190, 210), width=2)
    d.rectangle([130, 170, 240, 310], fill=(200, 208, 225))
    d.ellipse([160, 190, 210, 240], fill=(160, 170, 190))
    d.pieslice([140, 240, 230, 330], 180, 360, fill=(160, 170, 190))
    for i in range(5):
        heading(d, 270, 180 + i * 26, random.randint(120, 200), 9, GREY)
    for i in range(2):
        text_lines(d, 130, 340 + i * 20, 360, 1, h=8, colour=NAVY, ragged=False)
    text_lines(d, 100, 470, 420, 3, colour=LIGHT)
    return im


def invoice(n):
    im, d = page()
    d.rounded_rectangle([50, 60, 110, 120], radius=12, fill=BLUE)
    heading(d, 380, 70, 190, 24)
    text_lines(d, 380, 110, 190, 3, ragged=False)
    text_lines(d, 50, 200, 200, 4)
    d.rectangle([50, 320, 570, 352], fill=NAVY)
    y = 370
    for _ in range(6):
        text_lines(d, 64, y, 260, 1, ragged=False)
        d.rounded_rectangle([480, y, 556, y + 7], radius=3, fill=GREY)
        y += 36
    d.rounded_rectangle([360, y + 20, 570, y + 80], radius=10, fill=(229, 236, 255))
    heading(d, 380, y + 42, 170, 16, BLUE)
    return im


def card(n):
    im, d = page((240, 242, 246))
    d.rounded_rectangle([90, 300, 530, 560], radius=14, fill=(255, 255, 255), outline=(210, 215, 225), width=2)
    d.rectangle([90, 300, 140, 560], fill=BLUE)
    heading(d, 170, 340, 200, 20)
    heading(d, 170, 372, 140, 10, GREY)
    text_lines(d, 170, 440, 280, 4, gap=20, ragged=False)
    return im


def tax(n):
    im, d = page()
    heading(d, 60, 60, 340, 20)
    d.rectangle([60, 100, 560, 104], fill=NAVY)
    y = 130
    for i in range(12):
        text_lines(d, 60, y + 8, 200, 1, ragged=False)
        d.rectangle([300, y, 560, y + 26], outline=(170, 180, 200), width=1)
        for j in range(random.randint(3, 9)):
            d.rectangle([306 + j * 22, y + 8, 318 + j * 22, y + 18], fill=NAVY)
        y += 44
    return im


DOCS = {
    "doc-lease": lease,
    "doc-bill": bill,
    "doc-receipt": receipt,
    "doc-notes": notes,
    "doc-id": passport,
    "doc-invoice": invoice,
    "doc-card": card,
    "doc-tax": tax,
}

for name, fn in DOCS.items():
    folder = OUT / name
    folder.mkdir(parents=True, exist_ok=True)
    for n in (1, 2):
        fn(n).save(folder / f"page-{n}.png")

# Scan session pages (as they come out of the scanner) and a raw photo for the crop editor.
scan = OUT / "scan"
scan.mkdir(parents=True, exist_ok=True)
for n, fn in ((1, lease), (2, invoice)):
    fn(n).resize((1240, 1754)).save(scan / f"page-{n}.jpg", quality=88)
rec = receipt(1).crop((150, 0, 470, 877)).resize((900, 1200))
rec.save(scan / "page-3.jpg", quality=88)

photo = Image.new("RGB", (900, 1200), (92, 74, 60))  # wooden desk
pd = ImageDraw.Draw(photo)
for y in range(0, 1200, 9):
    pd.line([0, y, 900, y + random.randint(-6, 6)], fill=(98 + random.randint(-8, 8), 79, 63), width=4)
paper = invoice(1).resize((560, 792))
quad = [(170, 170), (760, 120), (820, 1060), (110, 1110)]
coeffs = []
src = [(0, 0), (560, 0), (560, 792), (0, 792)]
# Perspective-transform the page onto the desk.
import numpy as np  # noqa: E402

A, B = [], []
for (x, y), (u, v) in zip(quad, src):
    A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
    A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
coeffs = np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()
warped = paper.transform((900, 1200), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
mask = Image.new("L", (900, 1200), 0)
ImageDraw.Draw(mask).polygon(quad, fill=255)
shadow = Image.new("L", (900, 1200), 0)
ImageDraw.Draw(shadow).polygon([(x + 14, y + 18) for x, y in quad], fill=110)
photo.paste((40, 30, 25), (0, 0), shadow.filter(ImageFilter.GaussianBlur(14)))
photo.paste(warped, (0, 0), mask)
photo.save(scan / "photo-3.jpg", quality=88)
print(f"demo assets written to {OUT}")
