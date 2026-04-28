#!/usr/bin/env bash
# Mirrors `.github/workflows/ci.yml` arch-invariants (banned tokens under src/core).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -d src/core ]]; then
  echo 'OK (no src/core)'
  exit 0
fi
if grep -rHnE --include='*.ts' 'process\.|Bun\.|fetch\(|Date\.now|Math\.random' src/core; then
  echo 'Banned pattern in src/core — use ports + runtime instead.'
  exit 1
fi
echo 'OK: no banned patterns under src/core'
