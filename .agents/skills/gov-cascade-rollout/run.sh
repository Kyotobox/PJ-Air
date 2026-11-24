#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec dart "$SCRIPT_DIR/scripts/cascade_rollout.dart" "$@"
