#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "Iniciando Analiza en Casa en http://localhost:4173"
node scripts/serve.mjs
