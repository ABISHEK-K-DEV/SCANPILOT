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
}


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
        if has_pdfinfo:
            result = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True)
            if result.returncode != 0 or result.stderr.strip():
                failures.append(f"{name}: pdfinfo error {result.stderr.strip()}")
            else:
                pages = next((int(l.split()[-1]) for l in result.stdout.splitlines() if l.startswith("Pages:")), None)
                if pages != expected["pages"]:
                    failures.append(f"{name}: pdfinfo pages {pages} != {expected['pages']}")
        if PdfReader:
            reader = PdfReader(str(path), strict=True)
            if len(reader.pages) != expected["pages"]:
                failures.append(f"{name}: pypdf pages {len(reader.pages)} != {expected['pages']}")
            if "rotations" in expected:
                rotations = [p.rotation % 360 for p in reader.pages]
                if rotations != expected["rotations"]:
                    failures.append(f"{name}: rotations {rotations} != {expected['rotations']}")
            for page in reader.pages:
                page.extract_text()  # forces content-stream parsing
        print(f"ok  {name}")

    if failures:
        print("\nFAILED:\n  " + "\n  ".join(failures))
        return 1
    print(f"\nAll {len(EXPECTED)} sample PDFs passed independent validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
