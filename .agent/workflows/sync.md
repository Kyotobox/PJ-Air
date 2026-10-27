# /sync — Sincronización Bidireccional In-Session

> **Tipo**: Workflow de Gobernanza  
> **Gate**: GATE-2  
> **Alcance**: Sincronizar cambios entre GitHub (PRs mergeados por Jules/PO) y el búnker local sin necesidad de un ciclo completo de `/takeover`.

## Prerequisitos

- Git configurado y autenticado con el repositorio remoto.
- No hay cambios locales sin commitear (`git status` limpio) o stasheados.

## Flujo de Ejecución

### Fase 1: Pull Seguro (Remoto → Local)

```bash
# 1. Verificar árbol limpio:
git status --porcelain
# → Si hay cambios, abortar con mensaje "[SYNC_BLOCKED] Árbol sucio. Commitear o stashear antes de sincronizar."

# 2. Fetch remoto y resolución dinámica de rama:
git -c http.timeout=10 fetch origin --quiet
current_branch=$(git branch --show-current)
if [ -z "$current_branch" ]; then current_branch=$(git rev-parse --abbrev-ref HEAD); fi

# 3. Detectar divergencia:
behind=$(git rev-list --count "HEAD..origin/$current_branch")
# → Si 0: reportar "Ya sincronizado" y saltar a Fase 2 si hay commits locales pendientes.
# → Si >0: ejecutar pull ff-only.

# 4. Pull fast-forward only:
git pull --ff-only origin "$current_branch"
# → Si falla (divergencia): abortar con "[SYNC_CONFLICT] Se requiere merge manual o rebase."

# 5. Verificar integridad post-pull:
# - Leer task.md y backlog.json actualizados.
# - Reportar tareas completadas por Jules desde el último sync.
# - Si logix está disponible: ejecutar `bin/logix check` para validar estado.
```

### Fase 2: Push Seguro (Local → Remoto)

```bash
# 1. Detectar commits locales no pusheados:
ahead=$(git rev-list --count "origin/$current_branch..HEAD")
# → Si 0: reportar "Nada que pushear" y terminar.

# 2. Verificar que los tests pasen (obligatorio según stack):
# Pure Dart / HUB: dart test
# Flutter: flutter test
# Python: pytest
# → Si fallan: abortar con "[SYNC_BLOCKED] Tests fallidos. No se pushea código roto."

# 3. Push dinámico:
git push origin "$current_branch"
# → Si falla por detrás de remoto: volver a Fase 1 y re-intentar una vez.

# 4. Reportar resultado:
# "[SYNC_COMPLETE] Pull: N commits recibidos. Push: M commits enviados."
```

### Fase 3: Reconciliación de Estado (Opcional)

```
Si se detectaron cambios en task.md o backlog.json durante el pull:
  - Comparar estado local vs. remoto de tareas.
  - Reportar tareas que cambiaron de estado (PENDING → DONE, etc.).
  - NO modificar archivos automáticamente: solo informar al PO.
```

## Reglas de Seguridad

1. **Zero-Force**: Prohibido `git push --force` o `git reset --hard` en este workflow. Solo operaciones non-destructivas.
2. **FF-Only**: Si no se puede hacer fast-forward, el workflow aborta y delega al PO.
3. **Tests Gate**: No se pushea sin tests verdes. Sin excepción.
4. **Idempotencia**: Ejecutar `/sync` múltiples veces es seguro — si no hay cambios, no hace nada.

## Ejemplo de Uso

```
/sync              # Pull + Push completo
/sync --pull-only  # Solo traer cambios de remoto
/sync --push-only  # Solo enviar commits locales
/sync --status     # Reportar diferencias sin actuar
```
