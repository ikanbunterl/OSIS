#!/usr/bin/env bash
# Uji logika murni (validasi NIS, pencocokan nama, sensor kata, import CSV).
# Tidak butuh Supabase / database. Butuh koneksi internet sekali untuk esbuild (via npx).
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
mkdir -p "$OUT/node_modules/server-only"
echo '{"name":"server-only","version":"0.0.0","type":"module","main":"index.js"}' > "$OUT/node_modules/server-only/package.json"
echo 'export {};' > "$OUT/node_modules/server-only/index.js"

npx --yes esbuild@0.25.0 \
  lib/validators.js lib/censor.js lib/import-csv.js lib/utils.js \
  --bundle --format=esm --platform=node \
  --external:server-only --external:@supabase/supabase-js \
  --outdir="$OUT" --log-level=error

cp test/smoke.mjs "$OUT/smoke.mjs"
node "$OUT/smoke.mjs"
rm -rf "$OUT"
