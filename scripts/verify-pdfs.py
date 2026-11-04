#!/usr/bin/env python3
"""Validates PDFs with two independent readers: poppler's pdfinfo and pypdf.

Usage: python3 scripts/verify-pdfs.py <dir>
Expected page counts / rotations are asserted for the samples written by
src/services/pdf/__tests__/exportSamples.test.ts.
"""
import shutil
import subprocess
import sys
from pathlib import Path

EXPECTED = {
    "images.pdf": {"pages": 2},
    "merge.pdf": {"pages": 7},
    "extract.pdf": {"pages": 2},
    "rotate.pdf": {"pages": 5, "rotations": [0, 90, 0, 90, 0]},
    "plan.pdf": {"pages": 3, "rotations": [180, 0, 0]},
    "split-1.pdf": {"pages": 1},
    "split-2.pdf": {"pages": 1},
    "split-3.pdf": {"pages": 1},
    "watermark.pdf": {"pages": 5, "text": "CONFIDENTIAL"},
    "numbers-rotated.pdf": {"pages": 2, "text": "Page 2 of 2"},
    "protected.pdf": {"pages": 5, "password": "test1234"},
    "unlocked.pdf": {"pages": 5, "encrypted": False},
    "cropped.pdf": {"pages": 5},
    "overlay-rotated.pdf": {"pages": 1, "text": "Signed here"},
    "searchable.pdf": {"pages": 1, "text": "Invoice number 2048"},
}


def geometry_checks(directory: Path) -> list:
    """Checks positions as a viewer displays them (poppler applies /Rotate)."""
    problems = []
    if shutil.which("pdftotext") is None or shutil.which("pdftoppm") is None:
        return problems
    import re
    from PIL import Image

    def render(name, dpi=36):
        out = directory / f"render-{name}"
        subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-singlefile", "-f", "1", "-l", "1", str(directory / f"{name}.pdf"), str(out)], check=True)
        return Image.open(f"{out}.png").convert("L")

    def dark_bbox(img, threshold=160):
        mask = img.point(lambda v: 255 if v < threshold else 0)
        return mask.getbbox()

    # Page numbers on a 90°-rotated page: ink must appear in the displayed bottom-right corner,
    # and the displayed page must be landscape (300x400 portrait rotated a quarter turn).
    img = render("numbers-rotated", 72)
    w, h = img.size
    corner = img.crop((int(w * 0.6), int(h * 0.85), w, h))
    if w <= h:
        problems.append(f"numbers-rotated.pdf: expected landscape display, got {w}x{h}")
    if dark_bbox(corner) is None:
        problems.append("numbers-rotated.pdf: no page number ink in the displayed bottom-right corner")
    # Watermark should be centred: its ink bbox centre near the page centre.
    wm = render("watermark", 72).point(lambda v: 0 if v < 250 else 255)
    ww, wh = wm.size
    # ignore the "Source page" label at the top
    body = wm.crop((0, int(wh * 0.2), ww, wh))
    bb = body.point(lambda v: 255 - v).getbbox()
    if not bb:
        problems.append("watermark.pdf: watermark not rendered")
    else:
        cx, cy = (bb[0] + bb[2]) / 2 / ww, ((bb[1] + bb[3]) / 2 + wh * 0.2) / wh
        if abs(cx - 0.5) > 0.08 or abs(cy - 0.5) > 0.08:
            problems.append(f"watermark.pdf: watermark centred at ({cx:.2f},{cy:.2f}), expected (0.5,0.5)")
        # Rising diagonal: the left end of the ink is lower on screen than the right end.
        left = body.crop((bb[0], 0, bb[0] + (bb[2] - bb[0]) // 5, body.height)).point(lambda v: 255 - v).getbbox()
        right = body.crop((bb[2] - (bb[2] - bb[0]) // 5, 0, bb[2], body.height)).point(lambda v: 255 - v).getbbox()
        if left and right and not (left[1] > right[1]):
            problems.append("watermark.pdf: watermark should rise from left to right")
    # Red overlay box must render in the displayed top-left of the rotated page.
    out = directory / "overlay"
    subprocess.run(["pdftoppm", "-r", "36", "-png", "-singlefile", str(directory / "overlay-rotated.pdf"), str(out)], check=True)
    img = Image.open(f"{out}.png").convert("RGB")
    w, h = img.size
    r, g, b = img.getpixel((int(w * 0.15), int(h * 0.15)))
    if not (r > 200 and g < 80 and b < 80):
        problems.append(f"overlay-rotated.pdf: expected red at displayed top-left, got {(r, g, b)}")
    r2, g2, b2 = img.getpixel((int(w * 0.85), int(h * 0.85)))
    if r2 > 200 and g2 < 80:
        problems.append("overlay-rotated.pdf: red leaked into bottom-right")
    # Crop: displayed top 25% removed → height 300 of 400.
    info = subprocess.run(["pdfinfo", str(directory / "cropped.pdf")], capture_output=True, text=True).stdout
    size = re.search(r"Page size:\s+([\d.]+) x ([\d.]+)", info)
    if not size or round(float(size.group(2))) != 300:
        problems.append(f"cropped.pdf: unexpected page size {size.groups() if size else None}")
    print("ok  geometry (rotated page numbers, overlays, crop)")
    return problems


def main() -> int:
    directory = Path(sys.argv[1] if len(sys.argv) > 1 else "pdf-samples")
    failures = []
    try:
        from pypdf import PdfReader
    except ImportError:
        PdfReader = None
        print("warning: pypdf not installed; skipping pypdf checks")
    has_pdfinfo = shutil.which("pdfinfo") is not None
    if not has_pdfinfo:
        print("warning: pdfinfo (poppler-utils) not installed; skipping poppler checks")

    for name, expected in EXPECTED.items():
        path = directory / name
        if not path.exists():
            failures.append(f"{name}: missing")
            continue
        pw = ["-upw", expected["password"]] if "password" in expected else []
        if has_pdfinfo:
            if "password" in expected:
                locked = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True)
                if locked.returncode == 0:
                    failures.append(f"{name}: opened without a password")
            result = subprocess.run(["pdfinfo", *pw, str(path)], capture_output=True, text=True)
            if "encrypted" in expected and ("Encrypted:       no" in result.stdout) != (not expected["encrypted"]):
                failures.append(f"{name}: encryption state wrong")
            if "text" in expected:
                text = subprocess.run(["pdftotext", "-raw", *pw, str(path), "-"], capture_output=True, text=True).stdout
                if expected["text"].replace(" ", "") not in "".join(text.split()):
                    failures.append(f"{name}: text {expected['text']!r} not found by pdftotext")
            if result.returncode != 0 or result.stderr.strip():
                failures.append(f"{name}: pdfinfo error {result.stderr.strip()}")
            else:
                pages = next((int(l.split()[-1]) for l in result.stdout.splitlines() if l.startswith("Pages:")), None)
                if pages != expected["pages"]:
                    failures.append(f"{name}: pdfinfo pages {pages} != {expected['pages']}")
        if PdfReader:
            reader = PdfReader(str(path), strict=True)
            if reader.is_encrypted:
                reader.decrypt(expected.get("password", ""))
            if len(reader.pages) != expected["pages"]:
                failures.append(f"{name}: pypdf pages {len(reader.pages)} != {expected['pages']}")
            if "rotations" in expected:
                rotations = [p.rotation % 360 for p in reader.pages]
                if rotations != expected["rotations"]:
                    failures.append(f"{name}: rotations {rotations} != {expected['rotations']}")
            for page in reader.pages:
                page.extract_text()  # forces content-stream parsing
        print(f"ok  {name}")

    failures += geometry_checks(directory)
    if failures:
        print("\nFAILED:\n  " + "\n  ".join(failures))
        return 1
    print(f"\nAll {len(EXPECTED)} sample PDFs passed independent validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
