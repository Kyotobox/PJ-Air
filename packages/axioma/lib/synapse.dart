/// synapse: Entry Point Granular para el Primitivo Canónico SYNAPSE Pure Dart (§39, §60.8).
///
/// Expone contratos de soberanía, DTOs de carga inmutable y especificaciones de puente
/// para la delegación segura de tareas inter-nodo hacia Skills especializados.
library;

export 'src/contracts/context_passport.dart';
export 'src/contracts/synapse_bridge.dart';
export 'src/dtos/synapse_task_payload.dart';
export 'src/synapse/catalog_sanitizer_bridge.dart';
export 'src/synapse/queue_adapter_port.dart';
export 'src/synapse/queue_bridge.dart';
export 'src/synapse/studio_synapse_bridge.dart';
export 'src/synapse/task_dispatcher.dart';
