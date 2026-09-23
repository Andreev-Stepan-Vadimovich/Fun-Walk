#!/usr/bin/env bash
# Build Fun-Walk coursework as Word (.docx) via Pandoc

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " Fun-Walk: build coursework (DOCX only)"
echo "========================================"
echo

mkdir -p build

if ! command -v pandoc &>/dev/null; then
  echo "[ERROR] pandoc not found."
  echo "        sudo apt install pandoc"
  exit 1
fi

FLAT=build/flat.tex
echo "[1/2] Flattening LaTeX inputs..."
if command -v latexpand &>/dev/null; then
  latexpand main.tex --encoding=utf8 > "$FLAT"
else
  cp main.tex "$FLAT"
fi

echo "[2/2] Building DOCX (Pandoc)..."
pandoc "$FLAT" -o build/fun-walk-coursework.docx \
  --from=latex \
  --resource-path=".:chapters:appendices" \
  --bibliography=bibliography.bib \
  --citeproc \
  --metadata lang=ru-RU \
  --metadata title="Fun-Walk - coursework"

echo "[OK] DOCX: build/fun-walk-coursework.docx"
echo
echo "Done."
