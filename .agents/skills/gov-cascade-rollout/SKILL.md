---
name: gov-cascade-rollout
description: Orquestación de compilación cruzada binaria (Windows PE y Linux ELF), firma criptográfica asimétrica RSA-2048 y propagación atómica en cascada hacia la flota de satélites mediante manifiestos de ADN y rollback transaccional (§14, §19, §48, §55).
version: 1.0.0
category: governance
origin_node: conext_core
contracts:
  protocol: CLI/JSON
  interface_type: agent_skill
  governance_gate: logix audit skills
---

# gov-cascade-rollout: Despliegue en Cascada y Rollout Criptográfico de Gobernanza

## 1. Declaración de Misión y Filosofía
El Skill `gov-cascade-rollout` provee el estándar de ingeniería y gobernanza para la distribución de binarios compilados (`logix`, `vanguard`), sincronización de ADN arquitectónico y propagación de políticas inmutables desde el nodo Núcleo (`conext_core`) hacia todos los satélites de la flota.

Bajo la doctrina de **Autarquía y Aislamiento Sónico**, los satélites jamás compilan el motor de gobernanza por su cuenta ni descargan ejecutables de repositorios remotos no autenticados. Toda actualización debe ser compilada determinísticamente, sellada con criptografía asimétrica RSA-2048 y adoptada de forma transaccional con garantía de reversión ante cualquier inconsistencia de hash.

---

## 2. Topología y Arquitectura del Despliegue

```mermaid
flowchart TD
    subgraph Core [conext_core (Núcleo)]
        Src[Código Fuente Dart] --> CompileWin[Compilación logix.exe]
        Src --> CompileLin[Compilación logix ELF]
        Key[(RSA Private Key XML)] --> SignEngine[Motor de Firma PointyCastle]
        CompileWin --> SignEngine
        CompileLin --> SignEngine
        SignEngine --> SigFiles[Binarios Firmados + .sig]
        DnaGen[tmp/sync_dna.dart] --> Hashes[kernel.hashes & self.hashes]
    end

    subgraph Staging [Canal de Distribución Atómica]
        SigFiles --> StagingDir[bin/*.update + *.sig]
        Hashes --> ManifestStream[Manifiesto de ADN]
    end

    subgraph Satellite [Nodo Satélite]
        StagingDir --> VerifySign[Verificación RSA Pública]
        ManifestStream --> VerifyDna[Auditoría de Hashes]
        VerifySign --> Adopt{¿Firma Válida y Hash OK?}
        VerifyDna --> Adopt
        Adopt -- Sí --> AtomicSwap[Reemplazo Atómico de Binario + Resello ADN]
        Adopt -- No --> Rollback[Abortar y Restaurar Backup Invariable]
    end
```

---

## 3. Especificación Formal de Interfaces (TypeScript Contracts)

```typescript
export interface RolloutArtifact {
  readonly binaryName: 'logix' | 'vanguard';
  readonly targetPlatform: 'windows-x64' | 'linux-x64';
  readonly version: string;
  readonly binarySha256: string;
  readonly signatureBase64: string;
  readonly compiledAt: string;
}

export interface DnaManifest {
  readonly kernelHash: string;
  readonly selfHash: string;
  readonly sourceFilesCount: number;
  readonly generatedAt: string;
  readonly schemaVersion: string;
}

export interface CascadeTarget {
  readonly nodeId: string;
  readonly localPath: string;
  readonly currentKernelVersion: string;
  readonly autarchicLevel: 'full' | 'satellite';
}

export interface RolloutPolicy {
  readonly requireZeroDrift: boolean;
  readonly atomicSwapTimeoutMs: number;
  readonly autoRollbackOnFailure: boolean;
  readonly minimumRsaBits: number;
}

export interface RolloutResult {
  readonly targetNodeId: string;
  readonly success: boolean;
  readonly previousVersion: string;
  readonly appliedVersion: string;
  readonly verificationLatencyMs: number;
  readonly rollbackExecuted: boolean;
  readonly errorReason?: string;
}

export interface ICascadeRolloutService {
  compileBinaries(version: string): Promise<RolloutArtifact[]>;
  signArtifacts(artifacts: RolloutArtifact[], privateKeyXml: string): Promise<RolloutArtifact[]>;
  deployToFleet(targets: CascadeTarget[], policy: RolloutPolicy): Promise<RolloutResult[]>;
  verifySatelliteDna(target: CascadeTarget): Promise<DnaManifest>;
}
```

---

## 4. Herramientas y Scripts Ejecutables (`scripts/`)

* **Punto de Entrada Primario**: `.agents/skills/gov-cascade-rollout/scripts/cascade_rollout.dart`
* **Entrypoint Alternativo**: `dart run tools/fleet/serialize_and_enqueue_inoculation.py`
* **Entorno**: Dart SDK / Pure Dart (Agnóstico, Multi-OS vía `PlatformGuard`, criptografía PointyCastle).

### Modos de Operación CLI

#### 1. Compilación y Sellado Criptográfico RSA-2048
```bash
dart run .agents/skills/gov-cascade-rollout/scripts/cascade_rollout.dart \
  --compile \
  --sign \
  --key-path="vault/keys/rsa_governance.xml" \
  --version="5.4.0"
```

#### 2. Despliegue en Cascada hacia Nodos Satélites
```bash
dart run .agents/skills/gov-cascade-rollout/scripts/cascade_rollout.dart \
  --deploy \
  --targets-config="vault/fleet.json" \
  --atomic-swap \
  --timeout-ms=5000 \
  --json
```

#### 3. Auditoría y Sincronización Dual de ADN
```bash
dart run .agents/skills/gov-cascade-rollout/scripts/cascade_rollout.dart \
  --verify-dna \
  --node="ruedas" \
  --strict
```

### Tabla Determinista de Códigos de Salida
| Código | Estado | Significado Técnico |
| :---: | :--- | :--- |
| `0` | `ROLLOUT_SUCCESS` | Despliegue completado, firma verificada y ADN resellado. |
| `1` | `WEAK_RSA_KEY` | Intento de firma con clave RSA < 2048 bits (S19-FORTRESS). |
| `2` | `SIGNATURE_MISMATCH` | Verificación de firma criptográfica RSA fallida. |
| `3` | `DNA_DRIFT_DETECTED` | Deriva o incompatibilidad de hashes en `kernel.hashes`. |
| `4` | `ATOMIC_SWAP_FAILURE`| Falla en reemplazo atómico; rollback transaccional ejecutado. |

---

## 5. Especificaciones de Tests Unitarios y Certificación Física (`test/`)

La suite de certificación valida el ciclo de vida sin simulaciones ni stubs (§4):
- **Happy Path 1 (Firma y Verificación Válida)**: Par de claves RSA-2048 firma artefacto temporal `.update` y su verificación pública es conforme.
- **Happy Path 2 (Reemplazo Atómico con Backup)**: Sustitución de ejecutable genera archivo `.bak` invariable y muta el target de forma transaccional.
- **Sad Path 1 (§6 con throwsA)**: Clave RSA menor a 2048 bits arroja `WeakCryptographicKeyException`.
- **Sad Path 2 (§6 con throwsA)**: Modificación de 1 solo byte en el binario staged activa `CryptographicSignatureMismatchException` y restaura el estado previo.

---

## 6. Paridad Multi-OS y Resello de ADN
- **Sufijos Binarios Polimórficos**: Manejo determinista de `logix.exe` en Windows y binario ELF `logix` en Linux gestionado mediante `PlatformGuard`.
- **Resello Dual de ADN**: La adopción exige recalcular `vault/self.hashes` y `vault/kernel.hashes` mediante `tmp/sync_dna.dart` de forma inmediata.
