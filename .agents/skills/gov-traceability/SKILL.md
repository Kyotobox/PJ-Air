---
name: gov-traceability
description: Generador autónomo de Registros de Decisión Arquitectónica (ADR) MADR y RFC 2119.
version: 1.0.0
owner_node: conext_core
category: governance_documentation
---

# Gov-Traceability & MADR Architecture Decision Records

## 1. Visión y Propósito
Este skill normativo estandariza el registro inmutable de decisiones técnicas y acuerdos del Consejo de Flota (CMMI-5). Todo cambio arquitectónico de alto impacto o resolución de disputa técnica se documenta como un ADR (Architectural Decision Record) conforme a la plantilla MADR (Markdown Architectural Decision Records) y los términos normativos de RFC 2119 (`MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHOULD`, `RECOMMENDED`).

## 2. Contrato de Ejecución
Ejecute `./run.sh` o `scripts/generate_adr.py` pasando los parámetros correspondientes.

```bash
./run.sh --title "Adopción de Protocolo Sónico" --status ACCEPTED --context "Aislamiento de búnkers" --decision "Todos los nodos MUST respetar §2"
```

Los artefactos resultantes se persisten de forma inmutable en `docs/adr/NNNN-<slug>.md`.
