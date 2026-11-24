#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="$(basename "$SCRIPT_DIR")"

echo "[PREFLIGHT] Validando skill canónico: $SKILL_NAME"

# 1. Validación de existencia física de SKILL.md (§55.1)
if [[ ! -f "$SCRIPT_DIR/SKILL.md" ]]; then
  echo "ERROR: Manifiesto SKILL.md faltante en $SCRIPT_DIR" >&2
  exit 1
fi

# 2. Validación de intérprete Python y compilación AST
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 no está disponible en el entorno." >&2
  exit 1
fi

for script in "$SCRIPT_DIR"/scripts/*.py; do
  if [[ -f "$script" ]]; then
    python3 -m py_compile "$script" >/dev/null 2>&1 || {
      echo "ERROR: Fallo de compilación sintáctica en $script" >&2
      exit 1
    }
  fi
done

# 3. Comprobación de ejecutable principal run.sh
if [[ -f "$SCRIPT_DIR/run.sh" ]]; then
  if [[ ! -x "$SCRIPT_DIR/run.sh" ]]; then
    chmod +x "$SCRIPT_DIR/run.sh" 2>/dev/null || true
  fi
fi

echo "[OK] Preflight exitoso para $SKILL_NAME"
exit 0
