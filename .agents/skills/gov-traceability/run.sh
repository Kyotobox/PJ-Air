#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$(which python3 || echo "python3")"

if [[ $# -eq 0 ]] || [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
  echo "Uso: .agents/skills/gov-traceability/run.sh [opciones de generate_adr.py]"
  echo "Ejemplo: ./run.sh --title 'Decisión Arquitectónica' --decision 'El kernel MUST verificar firmas'"
  exit 0
fi

"$PYTHON_BIN" "$SCRIPT_DIR/scripts/generate_adr.py" "$@"
exit 0
