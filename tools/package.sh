#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mkdir -p dist
rm -f dist/rephraser-chrome.zip

python3 - <<'PY'
import json
import zipfile
from pathlib import Path

root = Path.cwd()
version = json.loads((root / "manifest.json").read_text())["version"]

files = ["manifest.json", "popup.html", "popup.css", "popup.js", "background.js"]
files += sorted(str(p.relative_to(root)) for p in (root / "icons").glob("*.png"))

destination = root / "dist" / "rephraser-chrome.zip"
with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)

print(f"built {destination.relative_to(root)} (v{version})")
PY
