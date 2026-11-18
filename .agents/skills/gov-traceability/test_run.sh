#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_OUT="$(mktemp -d /tmp/adr_test_XXXXXX)"

trap 'rm -rf "$TEMP_OUT"' EXIT

"$SCRIPT_DIR/run.sh" --help > /dev/null
"$SCRIPT_DIR/run.sh" --title "Test Validation ADR" --decision "Todos los módulos SHALL implementar tests" --out-dir "$TEMP_OUT" > /dev/null

if [[ ! -f "$TEMP_OUT/0001-test-validation-adr.md" ]]; then
  echo "ERROR: Falló la generación de prueba del ADR." >&2
  exit 1
fi

echo "Validación de la skill gov-traceability completada exitosamente."
exit 0
