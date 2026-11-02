#!/usr/bin/env python3
"""Combines docs/screenshots/NN-*.png into a labelled overview.png grid."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

folder = Path(sys.argv[1])
shots = sorted(p for p in folder.glob("[0-9][0-9]-*.png"))
cols, thumb_w = 6, 300
thumb_h = int(thumb_w * 844 / 390)
label_h, pad = 34, 24
rows = (len(shots) + cols - 1) // cols
sheet = Image.new("RGB", (pad + cols * (thumb_w + pad), pad + rows * (thumb_h + label_h + pad)), (233, 237, 245))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 17)
except OSError:
    font = ImageFont.load_default()
for i, shot in enumerate(shots):
    r, c = divmod(i, cols)
    x = pad + c * (thumb_w + pad)
    y = pad + r * (thumb_h + label_h + pad)
    img = Image.open(shot).convert("RGB").resize((thumb_w, thumb_h), Image.LANCZOS)
    sheet.paste(img, (x, y))
    draw.rectangle([x - 1, y - 1, x + thumb_w, y + thumb_h], outline=(200, 207, 220))
    draw.text((x, y + thumb_h + 8), shot.stem.replace("-", " ", 1), fill=(11, 27, 63), font=font)
sheet.save(folder / "overview.png", optimize=True)
print(f"overview.png: {len(shots)} screens")
