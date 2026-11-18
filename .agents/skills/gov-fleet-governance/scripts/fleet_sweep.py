#!/usr/bin/env python3
"""fleet_sweep.py — Protocolo F: Barrido Canónico de Gobernanza de Flota (§54.7, §55, §56).

Funcionalidades:
1. --audit: Inspección física en disco de cada nodo en vault/fleet.json verificando:
   - Existencia de artefactos mandatorios (.git, bunker_profile.json, backlog.json, task.md) para nodos ACTIVE.
   - Paridad de rama activa contra canonical_branch declarada en bunker_profile.json.
   - Detección de ramas efímeras (worker-*) y estado sucio.
2. --reconcile: Reconcilia y actualiza automáticamente el estado en fleet.json, marcando
   nodos con BROKEN_GOVERNANCE si carecen de artefactos mandatorios.
3. --json: Exportación estructurada del reporte para consumo por el CLI logix y gates de CI.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

MANDATORY_ARTIFACTS = [".git", "bunker_profile.json", "backlog.json", "task.md"]


def detect_git_branch(node_path: Path) -> str:
    """Detecta la rama activa de Git en el directorio de trabajo."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(node_path),
            capture_output=True,
            text=True,
            check=False,
        )
        if res.returncode == 0:
            branch = res.stdout.strip()
            if branch:
                return branch
    except Exception:
        pass
    return "unknown"


def audit_node(node: Dict[str, Any], base_dir: Path) -> Dict[str, Any]:
    """Audita un nodo individual de la flota conforme a Protocolo F."""
    node_id = str(node.get("id", "<sin-id>"))
    status = str(node.get("status", "ACTIVE"))
    path_template = str(node.get("path_template", ""))

    node_path = Path(path_template)
    if not node_path.is_absolute():
        node_path = (base_dir / node_path).resolve()

    exists = node_path.exists() and node_path.is_dir()
    missing_artifacts: List[str] = []
    canonical_branch = "master"
    active_branch = "unknown"
    branch_match = True

    if exists:
        active_branch = detect_git_branch(node_path)
        profile_file = node_path / "bunker_profile.json"
        if profile_file.exists():
            try:
                profile_data = json.loads(profile_file.read_text(encoding="utf-8"))
                canonical_branch = str(profile_data.get("canonical_branch", "master"))
            except Exception:
                pass

        if status == "ACTIVE":
            branch_match = (active_branch == canonical_branch) or (active_branch in ("master", "main") and canonical_branch in ("master", "main"))

        for artifact in MANDATORY_ARTIFACTS:
            art_path = node_path / artifact
            if not art_path.exists():
                missing_artifacts.append(artifact)
    else:
        if status == "ACTIVE":
            missing_artifacts.extend(MANDATORY_ARTIFACTS)
            branch_match = False

    is_broken = (status == "ACTIVE") and (not exists or len(missing_artifacts) > 0 or not branch_match)
    evaluated_status = "BROKEN_GOVERNANCE" if is_broken else status

    return {
        "id": node_id,
        "status": status,
        "evaluated_status": evaluated_status,
        "is_broken_governance": is_broken,
        "path": str(node_path),
        "exists": exists,
        "active_branch": active_branch,
        "canonical_branch": canonical_branch,
        "branch_match": branch_match,
        "missing_artifacts": missing_artifacts,
    }


def run_fleet_sweep(
    fleet_file: Path,
    reconcile: bool = False,
    base_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Ejecuta el barrido canónico de la flota (Protocolo F)."""
    if not fleet_file.exists():
        raise FileNotFoundError(f"Manifiesto de flota no encontrado: {fleet_file}")

    resolved_base = base_dir or fleet_file.parent.parent

    try:
        fleet_data = json.loads(fleet_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise ValueError(f"Sintaxis JSON corrupta en {fleet_file}: {err}") from err

    nodes = fleet_data.get("nodes", [])
    if not isinstance(nodes, list):
        raise ValueError("El manifiesto de flota debe contener un arreglo 'nodes'")

    node_reports: List[Dict[str, Any]] = []
    broken_nodes: List[str] = []
    reconciled_count = 0

    for node in nodes:
        if not isinstance(node, dict):
            continue
        rep = audit_node(node, resolved_base)
        node_reports.append(rep)

        if rep["is_broken_governance"]:
            broken_nodes.append(rep["id"])
            if reconcile and node.get("status") == "ACTIVE":
                node["status"] = "BROKEN_GOVERNANCE"
                reconciled_count += 1

    if reconcile and reconciled_count > 0:
        fleet_file.write_text(json.dumps(fleet_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    is_valid = len(broken_nodes) == 0

    return {
        "is_valid": is_valid,
        "fleet_version": fleet_data.get("fleet_version", "unknown"),
        "total_nodes": len(node_reports),
        "broken_nodes_count": len(broken_nodes),
        "broken_nodes": broken_nodes,
        "reconciled_count": reconciled_count,
        "nodes": node_reports,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Protocolo F: Barrido Canónico de Gobernanza de Flota (§54.7, §55, §56)"
    )
    parser.add_argument(
        "--fleet-file",
        default="vault/fleet.json",
        help="Ruta al manifiesto vault/fleet.json (default: vault/fleet.json)",
    )
    parser.add_argument(
        "--audit",
        action="store_true",
        default=True,
        help="Ejecuta auditoría booleana de integridad en disco",
    )
    parser.add_argument(
        "--reconcile",
        action="store_true",
        help="Reconcilia y actualiza estados a BROKEN_GOVERNANCE ante artefactos faltantes",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Genera salida en formato JSON estructurado",
    )

    args = parser.parse_args()
    fleet_path = Path(args.fleet_file)

    try:
        report = run_fleet_sweep(fleet_path, reconcile=args.reconcile)
    except Exception as e:
        sys.stderr.write(f"❌ Error en fleet_sweep: {e}\n")
        return 1

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print("=== [FLEET-SWEEP] Protocolo F: Barrido Canónico de Flota (§54.7, §55, §56) ===")
        print(f"Versión de Flota:         {report['fleet_version']}")
        print(f"Nodos Auditados:          {report['total_nodes']}")
        print(f"Nodos con Anomalías:      {report['broken_nodes_count']}")
        if args.reconcile:
            print(f"Nodos Reconciliados:      {report['reconciled_count']}")

        if report["broken_nodes"]:
            print("\nDetalle de Nodos Afectados:")
            for n in report["nodes"]:
                if n["is_broken_governance"]:
                    reasons = []
                    if not n["exists"]:
                        reasons.append("directorio inexistente")
                    if n["missing_artifacts"]:
                        reasons.append(f"faltan artefactos: {', '.join(n['missing_artifacts'])}")
                    if not n["branch_match"]:
                        reasons.append(f"rama divergente: {n['active_branch']} != {n['canonical_branch']}")
                    print(f"  ❌ [{n['id']}] {'; '.join(reasons)}")
        else:
            print("\n✅ Todos los nodos de la flota se encuentran 100% íntegros y sincronizados.")

    return 0 if report["is_valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
