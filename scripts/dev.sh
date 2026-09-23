#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Установка зависимостей..."
npm install --prefix "$ROOT"
npm install --prefix "$ROOT/backend"
npm install --prefix "$ROOT/frontend"

if [[ ! -f "$ROOT/backend/.env" ]]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "==> Создан backend/.env из .env.example"
fi

echo "==> Запуск backend и frontend..."
npm run dev --prefix "$ROOT"
