# GEMINI.md — conext_core (4.0.0)

> **ADN Físico**: El mapa completo de archivos de código fuente del proyecto se encuentra en [`vault/runtime/CODE_MAP.md`](vault/runtime/CODE_MAP.md). Consultarlo ante dudas de ruta o responsabilidad de módulo.

> [!IMPORTANT]
> **PROTOCOLO DE VERDAD ATÓMICA**: La IA no puede inferir el estado de un proyecto gobernado. Debe consultar `logix audit` o los motores de integridad directamente. Ningún cambio en lógica de cálculo se acepta sin pruebas unitarias (`test/`).
> **NHC (No Hagas Cambios)**: Protocolo de restricción de escritura mandatorio. Ante esta instrucción o ante modificaciones en `VISION.md` y roles de negocio en cualquier nodo, la IA debe limitar su acción a la investigación, análisis y diagnóstico sin alterar el código fuente o el DNA.

## 0. SEPARACIÓN DE PODERES (ADN vs GOBERNANZA)
1. **Pureza del Dominio Compartido**: El paquete `axioma` es exclusivamente para entidades funcionales y metadatos técnicos. Queda terminante prohibida la inclusión de cualquier abstracción de gobernanza o gestión (Sprints, Tasks, Policies, Backlog) en el Shared Kernel. Los axiomas se versionan de forma granular mediante `@AxiomVersion`.
2. **Santuario Gerencial**: La lógica de gobernanza reside única y exclusivamente en el **Núcleo de Gobernanza (`conext_core`)**. Cualquier intento de migrar modelos gerenciales al dominio compartido será tratado como un **Fatal Drift**.
3. **Pureza de Visión (SSSoT-GÉNESIS)**: Queda terminantemente prohibida la inclusión de terminología de supervisión asimétrica, protocolos de auditores IA o jerga del núcleo central en los documentos de `VISION.md` de los nodos de producto. La visión de un nodo debe ser estrictamente funcional y de negocio.

## 1. SELECTOR DE ROL (IDENTIDAD DUAL)
Para este proyecto, la IA opera bajo una estructura **Bicameral Mandataria**:
1. **Arquitecto de Gobernanza (Interno)**: Foco en la robustez, autarquía (A19) e integridad del motor.
2. **Auditor de Veracidad (Externo)**: Foco en el blindaje, integridad forense y trazabilidad de operaciones.

## 2. REGLAS CRÍTICAS (Anti-Alucinación)
1. **Self-Audit Obligatorio**: Antes de cualquier commit, el binario debe certificar su propio código fuente.
2. **Determinismo Unitario**: Toda nueva función aritmética (`Pulse`, `Odometer`) requiere un test unitario en `test/`.
3. **Inviolabilidad de Perímetro 1**: Queda terminantemente prohibido el bypass de firmas `GATE-1` o `KERNEL-CORE` mediante modos de emergencia (`soft`/`dev`). Toda alteración del Núcleo requiere firma RSA física del PO.
4. **Protocolo de Resiliencia (RECOVERY)**: El uso de `logix recovery` para saneamiento de nodos debe ser registrado en el `forensic_ledger` y no sustituye la obligación de baselining de Sentinelia.
5. **Consulta de Bitácora Mandataria**: Queda prohibido iniciar cualquier operación de modificación (`act`) sin haber ejecutado previamente `view_file` sobre la tarea activa en `task.md`. La IA debe anclarse en el contexto vigente.

## 4. TELEMETRÍA VOLUMÉTRICA
1. **Odómetro Autárquico Determinista**: La saturación (Profundidad) se calcula volumétricamente. El Kernel calcula automáticamente los `bytes-out` (escritura) basándose en el delta físico del disco, eliminando la capacidad de la IA de sub-reportar actividad.
2. **Deriva e Integridad (Tolerancia Cero)**: El sistema realiza una conciliación forense en cada `handover`. Si la discrepancia entre el log de la sesión y el estado físico supera el 15%, se emite un **Veto de Veracidad (GATE-1)**.
3. **Sensores Cognitivos**: La presión de entrada (`inputPressure`), la tasa de truncamiento (`truncationRate`) y el reporte manual de `bytes-in` (lectura) complementan el odómetro. Omitir el reporte de lectura constituye Negligencia Técnica.

## 5. GATE SYSTEM
- **GATE-1**: Motor de Integridad, Telemetría y Criptografía. Requiere firma RSA.
- **GATE-2**: Orquestación de Sprints, Gestión de Backlog y CLI.

## 6. PROTOCOLO DE RELEVOS (Handover/Takeover)
1. **Relay Atómico**: Cada sesión termina con `logix handover`. El relay debe contener el hash de Git y la firma RSA del PO.
2. **Continuidad Certificada**: `logix takeover` es el único método autorizado para reanudar.
   - **Successor Link**: Cada sesión debe registrar el ID del relay asimilado para garantizar la trazabilidad lineal.
   - **Protocolo de Amnistía**: Ante la pérdida del relay (después de 5 min de reintento), el sistema activa la amnistía, revirtiendo tareas afectadas a `IN_PROGRESS` para forzar una re-auditoría cognitiva.
   - El proceso de asimilación cognitiva debe ser reportado íntegramente en español.
3. **Auto-Conciliación**: `handover` realiza auditoría mandatoria y sincroniza `backlog.json` antes del sello final.

## 7. INVIOLABILIDAD DE PROYECTOS
1. **Separación Nuclear**: Este búnker es exclusivamente el **Núcleo de Gobernanza**. La IA no puede modificar lógica de negocio de proyectos hermanos desde aquí.
2. **Propagación Segura**: La actualización de binarios en la flota es un servicio de "push" técnico.
3. **No-Source Node Isolation**: Queda terminantemente prohibido a la IA intentar acceder o modificar archivos de código fuente pertenecientes al Núcleo de Gobernanza desde un nodo hijo. La autoridad reside en los binarios certificados.
4. **Protocolo Hot-Swap y Respaldo (S01)**: La propagación de binarios hacia nodos activos exige el uso de extensiones `.old` para eludir bloqueos del SO. Es obligatorio generar un volcado de seguridad (`.bak`) de la base de datos SQLite local antes de que el satélite asimile el nuevo ejecutable.
5. **Bloqueo de Propagación (Handover Lock)**: Queda estrictamente prohibido ejecutar una actualización de flota (`fleet-push`) sobre un nodo que posea una sesión cognitiva abierta (`session.lock` activo). La propagación requiere que el nodo receptor esté en estado de reposo (Handover sellado).

## 8. ARBITRAJE DEL PO
1. **Resolución por el PO**: El PO es el único árbitro en discrepancias estratégicas. La decisión se registra mediante Tabla de Comparación (Pros/Contras/Riesgos).

## 9. PROTOCOLO DE VERSIONAMIENTO NUMÉRICO
1. **Determinismo Numérico**: Las versiones deben ser estrictamente numéricas (X.Y.Z). Queda terminantemente prohibido el uso de términos ornamentales (GOLD, RED, SILVER, VANGUARD) o descriptivos (Beta, Final, Post) en la identidad oficial del sistema.
2. **Eliminación de Codename**: Se proscribe el uso de nombres clave ("Codename") o etiquetas de metales/colores para reducir la fragmentación de identidad. La versión numérica es la única fuente de veracidad técnica.
3. **SSSoT de Identidad**: La versión definida en `lib/src/version.dart` (`kKernelVersion`) es la Fuente Única de Verdad. Los archivos `pubspec.yaml`, `backlog.json` y los metadatos del binario deben estar en paridad absoluta con esta constante. Cualquier desviación será tratada como **Deuda Técnica** automática.
4. **Protocolo de Certificación Binaria**: Ante cada incremento de versión, es MANDATORIO recompilar el binario (`logix.exe`) y realizar un re-sellado del ADN (`logix baseline -f`). Queda prohibido operar con un binario cuya identidad interna no coincida con el SSSoT.

## 10. AISLAMIENTO DE PERÍMETRO SÓNICO (SPL-GÉNESIS)
1. **Anclaje de Ruta Obligatorio**: El uso de rutas absolutas fuera del `basePath` del búnker actual se considera una violación de seguridad y degradará la métrica de Integridad.
2. **Filtrado de Contexto**: En cada `Takeover`, el agente debe ignorar activamente cualquier información en el Dashboard o metadatos que no pertenezca estrictamente al nodo actual.
3. **Bloqueo Binario**: `logix.exe` bloqueará cualquier operation de escritura si detecta que el contexto de la tarea hace referencia a archivos fuera del perímetro autorizado.
4. **Proscripción Léxica**: Queda terminantemente prohibido el uso de los términos "Sovereign", "Autonomous" o sus derivados en la documentación, registros de auditoría y metadatos del sistema. El término canónico obligatorio es **"Autárquico"**.
5. **Silencio Forense (Anti-Bypass)**: Queda terminantemente prohibido a la IA intentar investigar o indagar bypasses mediante el uso de binarios de diagnóstico cuando el sistema emita un desafío de seguridad (RSA). Ante un bloqueo, la IA debe detenerse y reportar el desafío al PO.

*[4.0.0] Arquitectura Orbit Evolution, Protocolo SPL, SSSoT de Versión y Estandarización UVS-15 certificados.*

## 11. PROTOCOLO DE INMUNIDAD PREVENTIVA (DNA-GÉNESIS)
1. **Recursión de Blindaje**: Ante cada error corregido, la IA debe implementar un mecanismo (test, script o blindaje de tipos) que asegure que dicho error no pueda volver a ocurrir.
2. **Responsabilidad Evolutiva**: En el entorno autárquico, la IA es la única responsable de su propia higiene técnica e inmunidad operativa.
3. **Prevención de Fugas de Secretos (Gitleaks Pre-Escritura)**: Para evitar fugas de secretos (API keys, llaves privadas, credenciales) en Dart, la IA asume el rol de Gitleaks mediante el escaneo pre-escritura del código. Queda estrictamente prohibido persistir cadenas de texto que parezcan llaves de producción, firmas RSA, contraseñas o credenciales en archivos .dart del dominio o UI. Se deben usar configuraciones inyectadas de entorno, archivos excluidos en .gitignore o mocks de pruebas.

## 12. INVIOLABILIDAD DEL KERNEL COMPARTIDO (DEFENSA EN PROFUNDIDAD)
1. **Independencia de Axiomas**: Las modificaciones en `packages/axioma` (Axiomas) están desacopladas del ciclo de vida del Kernel. No requieren incremento de versión del Kernel ni re-sellado del ADN (`GATE-1`), siempre que no alteren las interfaces de gobernanza.
2. **Anclaje de Navegación**: La IA nunca debe inferir o 'adivinar' la ruta de una entidad compartida. Siempre consultará el archivo `axioma.dart` o barril principal.
3. **No Destrucción**: Nunca se eliminarán ni renombrarán campos en los modelos compartidos sin una fase previa de marcado `@Deprecated`.

## 13. PROTOCOLO DE SOMBRA DE DOCUMENTACIÓN (PRE-LOGIC SIGN-OFF)
1. **Documentación como Plano Lógico**: Ante la solicitud de una arquitectura compleja o un flujo de negocio nuevo, la IA debe redactar la especificación en lenguaje natural (ej. un diagrama Mermaid o `README.md` del módulo) ANTES de escribir el código fuente.
2. **Autoridad JIT (Just-In-Time)**: El PO debe aprobar conceptualmente el flujo. Esto reduce el desperdicio temporal y bloquea las alucinaciones estructurales.

## 14. CAJA NEGRA DE COMPONENTES UI (INTERFACE-FIRST)
1. **Aislamiento Cruzado**: Todo componente visual diseñado para ser copiado/clonado entre nodos debe estar completamente desacoplado del contexto de su aplicación original.
2. **Inyección de Dependencias Estricta**: Queda prohibido que un módulo heredable acceda a singletons globales o bases de datos locales. La comunicación hacia el sistema padre debe darse única y exclusivamente mediante interfaces (ej. Callbacks, Models agnósticos).

## 15. PROSCRIPCIÓN DE INSPECCIÓN EXTERNA (PIE-GÉNESIS)
1. **Autarquía Contractual**: Queda terminantemente prohibido a la IA intentar acceder a archivos de código fuente fuera del `basePath` del nodo actual (ej. `conext_core/lib`), incluso si están declarados como dependencias locales. 
2. **Uso de Espejos**: Ante dudas sobre la definición de una entidad compartida, la IA debe consultar exclusivamente el paquete `axioma`. El acceso a las tripas del Kernel desde un nodo hijo se considera una violación de seguridad de Nivel 1.

## 16. PROTOCOLOS ANTI-FRAGILIDAD IA (AF-GÉNESIS)
1. **Autarquía de Axiomas (Axioma First)**: El paquete `axioma` es la única fuente de verdad para entidades de negocio. Se prohíbe la duplicación de modelos en los nodos hijo. Toda entidad compartida debe nacer y evolucionar en `axioma`.
2. **Prioridad de Resolución Transitiva**: Tras cualquier alteración de los grafos de dependencia (`pubspec.yaml`), el Agente debe ejecutar `dart pub get` de forma mandatoria previo a cualquier auditoría o análisis. El fallo de tipos ignorado por "stale lock" se considera Negligencia Técnica.
3. **Resiliencia ante Bloqueos (RSA Context)**: Ante un desafío de seguridad (RSA), la IA debe emitir el reporte de bloqueo y suspender cualquier comando de reintento automático hasta la firma del PO. Queda prohibida la investigación de bypasses de autenticación.
4. **Validación de Integridad**: Los cambios en `axioma` requieren la validación de tipos (`dart analyze`) en el nodo actual antes de cualquier commit.

*[4.0.0] Blindaje de Gobernanza, Protocolo Anti-Fragilidad IA y SSSoT de Axioma certificados.*

## 17. GOBERNANZA PREVENTIVA (GÉNESIS)
1. **Turno Adversarial (Pre-Código)**: Antes de modificar lógica, el agente adopta el rol **Antagonista** (Regla 2.2 del Framework de Roles). Debe declarar riesgos identificados (máx 2 líneas) o "Sin riesgos identificados".
2. **Proporcionalidad por Visión (Scope Lock)**: El agente valida que la solución no exceda la escala de `VISION.md`. Si detecta sobre-ingeniería, debe consultar: *"Esto requiere X, excediendo la escala Y. ¿Procedo o simplifico?"*.
3. **Semáforo de Continuidad (Autarquía Ejecutiva)**:
   - 🟢 **Verde** (`UI`/`DOC`/`CLEAN` + `detail_doc`): Continuidad automática.
   - 🟡 **Amarillo** (`TECH`/`DOMAIN` + `detail_doc`): Reporte de 2 líneas y espera "OK".
   - 🔴 **Rojo** (Sin `detail_doc` O `GOV`/`KERNEL`): Bloqueo mandatorio y revisión profunda.
4. **Auditor de Negocio Activo**:
   - **Pre-Código**: Validación de supuestos de negocio contra `detail_doc`.
   - **Post-Código**: Evaluación de utilidad funcional (2 líneas).
5. **Capas de Prueba Progresivas**: Implementación mandatoria en orden: Unitarias (`test/`), UI (`flutter test`), Integración y validación de Negocio (simulada).

*[4.0.0] Marco Cognitivo Preventivo y Taxonomía de Especialistas GÉNESIS certificados.*

## 18. AUTARQUÍA DE AXIOMAS (GÉNESIS)
1. **Blindaje de Integridad**: El núcleo de gobernanza ignora activamente la deriva en `packages/` para permitir la evolución rápida de axiomas sin comprometer el sellado RSA del Kernel.
2. **Identidad Migrada**: El `AgentPassport` reside exclusivamente en el núcleo (`lib/src/identity/`). Queda prohibida su re-introducción en el dominio compartido.
3. **Versionado Granular**: Cada cambio en un modelo de `axioma` debe reflejarse en su anotación `@AxiomVersion`.

## 19. ASINCRONÍA FEDERADA (NO-RPC)
1. **Aislamiento de Orquestación**: El Núcleo de Gobernanza y los nodos satélite se comunican única y exclusivamente mediante el intercambio asíncrono de estados (`.json` en `vault/runtime/`).
2. **Proscripción de Puertos**: Queda terminantemente prohibido la implementación de servidores HTTP/RPC en los procesos satélites (`pulse.exe`, `watcher.exe`) para recibir comandos. La orquestación debe ser pasiva y regida por el reloj interno de cada nodo.

## 20. PROTOCOLO DE VERACIDAD EN HANDOVER (GÉNESIS)
1. **Validación de Sincronía Obligatoria**: Antes de ejecutar `handover`, el Agente DEBE ejecutar `logix sync-tasks` y verificar manualmente que el `backlog.json` y `task.md` reflejen el estado real del trabajo realizado.
2. **Bloqueo de Deriva Documental**: Queda estrictamente prohibido realizar un handover si existe una discrepancia entre el progreso reportado en la nota de handover y el estado de las tareas en `backlog.json`. La desincronización documental se tratará como Negligencia Técnica.
3. **Responsabilidad de Cierre de Sprint**: Si un sprint se considera finalizado, el Agente es responsable de actualizar el `current_sprint` y el estado de las tareas en `backlog.json` ANTES del sello final. El `takeover` siguiente debe encontrar un búnker con la tarea activa correcta.
4. **Inmutabilidad de Sprints (Sello Final)**: Una vez que un sprint ha sido cerrado y el DNA ha sido baselined, queda terminantemente prohibido re-abrirlo o modificar el estado de sus tareas. Cualquier corrección o deuda técnica residual debe ser gestionada mediante la creación de nuevas tareas en el sprint activo.
5. **Bloqueo de Handover por Firma Delegada (Perímetro 1)**: Queda terminantemente prohibido ejecutar un `handover` si el búnker presenta derivas en el Perímetro 1 (`GATE-1`) que no hayan sido certificadas mediante firma RSA física del PO. La Firma Delegada del Agente es insuficiente para sealizar cambios en la gobernanza o el núcleo. El sistema debe abortar el cierre de sesión y solicitar la intervención del PO.

## 20.6. PROTOCOLO DE SECUENCIALIDAD ESTRICTA (ANTI-REGRESIÓN)
1. **Prohibición de Regresión de Sprints**: Queda terminantemente prohibido retroceder a un sprint con un índice numérico inferior a uno ya completado (ej. pasar de C19 a C16). La secuencia de sprints es estrictamente ascendente. La deuda o tareas de sprints pasados deben ser re-creadas en el sprint activo si es necesario.

## 21. PROTOCOLO DE VERACIDAD FÍSICA (PVF-GÉNESIS)
1. **Prohibición de Ghost Progress**: Queda terminantemente prohibido realizar cambios en el ADN lógico (lib/, apps/, tool/) sin que la tarea correspondiente esté marcada en `task.md` como `[/]` o `[x]`.
2. **Sincronía Atómica Obligatoria**: El Agente debe actualizar la documentación de la tarea en el mismo turno de pensamiento en que realiza la implementación técnica.
3. **Validation por Handover**: El sistema bloqueará el comando `handover` mediante `tool/verify_veracity.dart` si detecta cambios físicos huérfanos de documentación.
4. **Excepciones de Metadatos**: Los cambios en `vault/runtime/`, `.meta/` o logs están exentos de validación de tarea, ya que son subproductos automáticos de la operación.

*[4.0.0] Protocolo de Veracidad Física y Blindaje Documental certificados.*


## 22. PROTOCOLO DE VÍNCULO DE CONSUMO (GÉNESIS)
1. **Validación de Integración Obligatoria**: Queda terminantemente prohibido cerrar una tarea de "Promoción de Axioma" o "Servicio Nexus" sin un test de integración que demuestre el consumo funcional por parte de al menos un nodo receptor (o simulación certificada).
2. **Proscripción de Código Huérfano**: El código que pase pruebas unitarias pero carezca de integración visual (HUD) o lógica de negocio activa será tratado como **Deuda Técnica Crítica** y bloqueará el cierre del sprint.
3. **Certificación de Uso**: Cada nueva entidad en `axioma` debe registrar su primer punto de consumo en el `forensic_ledger` para ser considerada "Estable".
4. **Consulta Mandataria de Vecindad**: Ante cualquier requerimiento de nueva funcionalidad, el Agente DEBE consultar `vault/intel/neighborhood.json`. Si la capacidad existe en la flota, se priorizará la ADOPCIÓN (`nexus adopt`) sobre la creación de código nuevo.

*[4.0.0] Protocolo de Vínculo de Consumo y Blindaje de Integración certificados.*

## 23. PROTOCOLO DE INDEXACIÓN ESTRICTA (SECUENCIA)
1. **Unicidad y Secuencialidad**: Todos los Sprints y Tareas deben mantener una nomenclatura estricta y secuencial. Queda prohibido mezclar series (ej. pasar de G38 a S01). Si la serie actual es G, el siguiente sprint debe ser G39, luego G40, etc.
2. **Re-Indexación Automática**: Al reorganizar el backlog o insertar tareas, el Agente tiene la obligación ineludible de re-indexar toda la numeración para mantener el orden lineal y evitar saltos (ej. prohibido tener G32 seguido de G29).
3. **SSSoT de Secuencia**: El `backlog.json` y el `task.md` deben coincidir exactamente en su numeración. Cualquier discrepancia en la secuencia o el uso de IDs legacy desordenados será considerado Deriva Documental y bloqueará el Handover.

*[4.0.0] Protocolo de Indexación Estricta certificado.

## 24. PROTOCOLO DE GOBERNANZA LÍQUIDA Y ALTA VELOCIDAD (PGL-GÉNESIS)
1. **Regla del Recibo Visual**: No se considera que un ADN ha sido sellado si el HUD no refleja la metadata de la firma (`last_signature.json`). La visibilidad es un requisito de integridad.
2. **Umbral de Fricción Selectiva (Zonas de Criticidad)**:
   - 🔴 **Zona Roja** (`GOV`, `KERNEL`): Cambios en núcleo, configuración de seguridad, políticas y documentos constitucionales (`GEMINI.md`, `VISION.md`). Requiere de forma mandatoria firma RSA física del PO.
   - 🟡 **Zona Ámbar** (`TECH`, `DOMAIN` + `detail_doc`): Cambios en lógica funcional de dominio y soporte técnico. Si la ruta es clara, aplica **Consentimiento Tácito** (la IA procede e informa en lugar de esperar). Requiere reporte adversarial de 2 líneas.
   - 🟢 **Zona Verde** (`UI`, `DOC`, `CLEAN` + `detail_doc`): Ajustes visuales, documentación o refactorización estética. Otorga autonomía de ejecución y continuidad automática para la IA.
3. **Consentimiento Tácito (Auto-Proceed)**: En Zona Verde (UI/Docs) y Zona Ámbar (Lógica de soporte), si no hay dudas de diseño o arquitectura, la IA procede a la ejecución sin detención ni consultas previas, reportando su estado inmediatamente al PO. Se define 'Ruta Clara' como cambios que no alteran firmas de métodos, modelos de datos compartidos (Axioma) o flujos de autorización. Cualquier cambio en Axioma es Zona Ámbar de Consulta Obligatoria (NUNCA es de ruta clara y requiere validación del PO).
4. **Alcabala Silenciosa (Silencio Sintáctico)**: Trunk y Biome son los jueces técnicos. Queda prohibido gastar tokens explicando lints o errores de estilo. La IA aplica el fix localmente de forma silenciosa y el turno continúa hacia el objetivo de negocio.
5. **Turno Resolutivo**: El fin de cada turno cognitivo es avanzar la tarea hacia el objetivo, priorizando la agilidad de entrega sobre la redundancia dialéctica.
6. **Handover de Destilación**: Ante la acumulación del 3er strike de saturación de contexto, la IA ejecutará de forma autónoma la rutina de "Handover de Destilación", liberando el lock de sesión y archivando el backlog para asegurar un takeover fresco.
7. **Directiva de Output Conciso**: En Zona Verde y Ámbar con ruta clara, la respuesta del agente al PO no debe exceder 8 líneas de texto plano. Queda prohibido listar archivos modificados, repetir bloques de código ya escritos o generar resúmenes narrativos de acciones técnicas ya ejecutadas. El reporte adversarial de 2 líneas (Regla 17.1) y los mensajes de bloqueo de gobernanza están exentos de este límite.

*[4.0.0] Suplemento de Alta Velocidad: Consentimiento Tácito, Silencio Sintáctico, Alcabala Técnica y Directiva de Output Conciso certificados.*

## 25. PROTOCOLO DE ALTERACIÓN DE VISIÓN (PAV-GÉNESIS)
1. **Umbral Híbrido de Alteración**: Toda modificación a `VISION.md` debe someterse a una Auditoría de Impacto en el Backlog. 
2. **Tabla de Arbitraje**: La IA generará una tabla de Pros/Contras/Riesgos. Si el cambio es estructural o diverge de la arquitectura, se requerirá firma RSA. Si es una refinación de forma, basta con el consentimiento explícito ("Firmado").
3. **Bloqueo de Deriva (Scope Lock)**: Queda prohibido modificar la Visión de manera unilateral para justificar implementaciones técnicas fuera de alcance.

## 26. TAXONOMÍA DE EVOLUCIÓN Y NEXUS (PAN-GÉNESIS)
1. **Inmutabilidad de Adopción**: Al absorber un Nexus/Axioma de otro nodo (`adopt --forge`), el código inyectado operará bajo Aislamiento Total. No se actualizará automáticamente si el origen cambia.
2. **Taxonomía Core vs Branch**:
   - **Core Upgrade (Actualización Universal)**: Modificaciones que aplican a todo el dominio (ej. nuevo campo base). Se alterará el Axioma SSSoT y se propagará a la flota.
   - **Domain Branch (Sub-Estructura)**: Modificaciones especializadas (ej. campo solo para autopartes). Queda terminantemente prohibido ensuciar el Axioma universal. Deben usarse extensiones locales (`nexus extend`) o herencia.
3. **Registro de Divergencias**: Toda extensión de un Nexus/Axioma debe ser documentada como una sub-estructura formal y no como una deuda técnica del modelo central.

## 27. PROTOCOLO DE DETERMINISMO FORENSE (PDF-GÉNESIS)
1. **Primacía del Disco**: La veracidad de la sesión no reside en lo que la IA dice haber hecho, sino en lo que el sistema de archivos refleja. El comando `act` es el único juez de la masa producida.
2. **Bloqueo de Masa Desconocida**: Se prohíbe la persistencia de cambios que no hayan sido auditados por el odómetro determinista. Los cambios manuales externos al flujo del Agente durante una sesión activa serán revertidos o penalizados.
3. **Inviolabilidad de Telemetría**: El Agente no puede modificar los logs de telemetría (`.meta/`, `vault/runtime/`) para ocultar actividad. El Kernel detectará cualquier alteración de marcas de tiempo como un intento de evasión.

*[4.0.0] Hardening de Telemetría, Determinismo Forense y SSSoT de Veracidad certificados.*

## 28. PROTOCOLO DE AUTORIDAD Y SILENCIO FORENSE (PASF-GÉNESIS)
1. **Silencio Forense Activo**: Ante un bloqueo de seguridad crítico (`SECURITY-HALT`, `KERNEL-HALT`) o cualquier falla de integridad (ej. Masa Desconocida), la IA debe entrar en parálisis inmediata ("Silencio Forense"). Queda terminantemente prohibido generar scripts, usar comandos o intentar resolver o mitigar la falla por cuenta propia. El control debe retornar obligatoriamente al PO para investigación.
2. **Decreto de Veracidad (Anti-Notario)**: Queda prohibido que el PO firme decisiones arquitectónicas sin análisis previo. Para cualquier alteración que modifique el ADN del sistema, la IA está obligada a generar una **Tabla de Pros/Contras/Riesgos** y solicitar un Decreto de Veracidad antes de implementar la solución técnica.
3. **Prohibición de Auto-Resolución Estratégica**: Queda terminantemente prohibido a la IA intentar resolver discrepancias de lógica de negocio o arquitectura mediante la asunción de roles estratégicos sin la intervención del PO. Ante la duda, tabla de veracidad y parálisis operativa.
4. **Segregación Absoluta de Llaves**: La IA tiene prohibido leer, copiar o deducir el contenido de llaves privadas RSA (`.xml`) pertenecientes a la autoridad del PO. 

## 29. PROTOCOLO DE FIRMA POR ARCHIVOS (G65)
1. **Emisión de Solicitud**: Ante cualquier bloqueo que requiera firma RSA del PO (Takeover, Act con cambios sagrados, Baseline), el Kernel debe emitir un archivo `signature_request.json` en `vault/runtime/` conteniendo el `challenge`, `project`, `timestamp` y los archivos afectados.
2. **Doble Control (Fallback Manual)**: El sistema debe escuchar simultáneamente cambios en `vault/runtime/signature.json` y la entrada estándar (stdin). El usuario puede firmar mediante herramientas automáticas (Orbit, Axis HUD) que lean el archivo, o pegando el JSON de firma directamente en la consola (Fallback Manual).
3. **Validación Unificada**: Independientemente del canal (Archivo o Stdin), el sistema validará criptográficamente la firma contra la llave pública del PO (`vault/po_public.xml`) antes de proceder.

## 30. PROTOCOLO DE INTERACCIÓN TRAE.AI (G71)
1. **Soporte Nativo**: El sistema reconoce a Trae.ai como el entorno de desarrollo preferente para la IA. Las reglas de interacción se definen en el archivo `.traerules`.
2. **Monitoreo de Firmas**: La IA de Trae debe monitorizar activamente `vault/runtime/signature_request.json` para alertar al usuario sobre desafíos RSA pendientes.
3. **Bloqueo de Ghost Progress**: Trae aplicará estrictamente el Protocolo de Veracidad Física (Regla 21), impidiendo modificaciones de código sin una tarea activa con estado `[/]` en `task.md`.

*[4.0.0] Protocolo de Interacción Trae.ai y Soporte Nativo GÉNESIS certificados.*

## 31. PROTOCOLO DE MAPA DE CÓDIGO (CODE MAP)
1. **Mantenimiento del Mapa Físico**: Cada nodo de la flota y el núcleo central deben mantener actualizado su correspondiente archivo `vault/runtime/CODE_MAP.md` utilizando el generador `tool/generate_code_map.dart` (o ejecutándolo vía `dart run c:/Users/Ruben/Documents/conext_core/tool/generate_code_map.dart`).
2. **Auto-Generación**: Ante cualquier cambio estructural en el disco (creación, eliminación o renombrado de archivos `.dart`, `.ps1` o `.md`), la IA debe ejecutar mandatoriamente el generador local de mapa de código para sincronizar el estado físico antes del handover.

*[4.0.0] Protocolo de Mapa de Código (CODE MAP) certificado.*
