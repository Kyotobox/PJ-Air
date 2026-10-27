---
description: Workflow: /deploy (Proceso de Liberación). Incrementa versión, compila y sella el ADN del núcleo.
Regla: Toda comunicación en español.
---

1. **Evaluación de Intención**:
   - Este workflow solo debe ejecutarse por orden explícita del usuario (`/deploy` o petición directa de compilar y desplegar).
   - Sirve para empaquetar y sellar los cambios realizados en el núcleo de gobernanza.

2. **Incremento de Versión (Identity Bump)**:
   - Ejecutar: `bin/logix bump --type patch`
   - Si el usuario pide un cambio mayor, usar `--type minor` o `--type major`.
   - *Este paso es vital para que los nodos satélites detecten que hay un nuevo binario.*

3. **Compilación Estática**:
   - Ejecutar: `dart compile exe lib/src/kernel/logix.dart -o bin/logix.exe`
   - Esperar a que finalice con éxito.

4. **Sellado Criptográfico (Baseline)**:
   - Ejecutar: `bin/logix baseline -f`
   - **Nota de Fricción**: Al invocar `baseline`, se emitirá un desafío `GATE-1`. Gracias al *Smart Soft Mode*, el sistema pedirá firma RSA para certificar la nueva versión. Informar al PO que apruebe la firma en Conext Signer.

5. **Notificación**:
   - Confirmar al PO: "Binario compilado, versión incrementada y desafío de baseline emitido. El Kernel está listo para propagación."
