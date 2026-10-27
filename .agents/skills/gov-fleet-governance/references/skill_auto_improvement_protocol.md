# Protocolo Lean de Mejora de Skills (Protocolo D)

**Versión**: 1.1.0 | **Estado**: OPERATIVO | **Doctrina**: §1, §4, §6, §26, §36

## 1. Cuándo Activar
- **Umbral**: Fricción recurrente reportada por PO o Agente en un skill durante **≥ 2 sesiones distintas**.
- **Prohibición**: Queda prohibido activar auto-mejora ante anomalías aisladas de una sola sesión.

## 2. Bucle Operativo (4 Fases)
```text
  [1. Reporte de Fricción] ────▶ [2. Tarea en Backlog ([TECH/PURGE] o [GOV/ENHANCE])]
             ▲                                    │
             │                                    ▼
  [4. Sello y Rollout RSA] ◀──── [3. Gate Antagónico Q1-Q7 + AC-1/2/3]
```

## 3. Tipos de Refactorización Permitida
| Tipo | Acción | Destino |
|---|---|---|
| **Extracción Procedural** | Mover lógica interpretativa repetitiva a scripts deterministas | `scripts/` |
| **Poda de Tokens** | Mover documentación extensa de SKILL.md a referencias | `references/` |
| **Consolidación** | Centralizar snippets y ejemplos dispersos | `examples/` |
| **Parametrización** | Reemplazar valores hardcoded por variables de configuración | Config / Env |

*Restricción*: Prohibido eliminar instrucciones de seguridad, sad paths o reglas §AGENTS.md.

## 4. Gate Obligatorio (Anti-Corrupción)
Toda mejora debe superar el Quality Gate en [skill_quality_gate.md](./skill_quality_gate.md) (7/7) más las 3 verificaciones anti-corrupción (§5):
- **AC-1**: Paridad Doctrinal (§26) — sin `DOCTRINAL_DRIFT`.
- **AC-2**: Regresión Funcional — tests existentes del skill pasan al 100%.
- **AC-3**: Delta de Cobertura — sad paths intactos o compensados.

## 5. Estado de Implementación Honesta
| Componente | Estado | Mecanismo |
|---|---|---|
| Detección de Deuda | Manual (≥2 sesiones) | Reporte explícito PO / Agente |
| Refactorización | Regulada | Tareas etiquetadas [TECH/PURGE] o [GOV/ENHANCE] |
| Quality Gate + AC | Operativo | Q1-Q7 + AC-1/2/3 en `skill_quality_gate.md` |
| Sello y Despacho | Operativo | Rollout criptográfico RSA-2048 |
