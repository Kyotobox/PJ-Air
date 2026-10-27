/// IsolateThrottle: Límite de Concurrencia de CPU (§33 / Pure Dart §39)
///
/// Impone límites de concurrencia de CPU para isolates y tareas paralelas,
/// restringiendo los workers activos a CPU-1 (dejando al menos 1 núcleo libre
/// para el SO y el hilo principal) e impidiendo la saturación total de núcleos.
library;

import 'dart:async';
import 'dart:io';

import 'resource_guard.dart';

/// Excepción lanzada cuando una solicitud de workers satura todos los núcleos de CPU.
class IsolateThrottleException implements Exception {
  final int requestedWorkers;
  final int maxAllowedWorkers;
  final int totalCores;
  final String message;

  const IsolateThrottleException({
    required this.requestedWorkers,
    required this.maxAllowedWorkers,
    required this.totalCores,
    this.message = 'Saturación de núcleos de CPU detectada.',
  });

  @override
  String toString() =>
      '[ISOLATE_THROTTLE_SATURATION] Solicitud de concurrencia '
      '($requestedWorkers workers) satura los núcleos del CPU '
      '(máximo permitido: $maxAllowedWorkers de $totalCores núcleos): $message';
}

/// Regulador de concurrencia y workers de CPU (§33).
class IsolateThrottle {
  final int? _customProcessorCount;

  const IsolateThrottle({int? processorCount})
    : _customProcessorCount = processorCount;

  /// Retorna la cantidad total de núcleos lógicos del procesador.
  int get totalCores {
    if (_customProcessorCount != null && _customProcessorCount > 0) {
      return _customProcessorCount;
    }
    return Platform.numberOfProcessors;
  }

  /// Retorna la cantidad recomendada de workers en paralelo (CPU - 1).
  ///
  /// Si el sistema posee 1 núcleo, retorna 1 para permitir ejecución mínima.
  /// Si posee 2 o más núcleos, retorna `cores - 1` reservando 1 núcleo
  /// para el sistema operativo y el hilo principal (§33).
  static int getRecommendedWorkers({int? processorCount}) {
    final int cores = (processorCount != null && processorCount > 0)
        ? processorCount
        : Platform.numberOfProcessors;

    if (cores <= 1) return 1;
    return cores - 1;
  }

  /// Retorna la cantidad máxima permitida de workers bajo la configuración actual.
  int getMaxAllowedWorkers() =>
      getRecommendedWorkers(processorCount: _customProcessorCount);

  /// Evalúa si una cantidad solicitada de workers es segura y cumple con §33.
  bool isWorkerCountSafe(int requestedWorkers) {
    if (requestedWorkers <= 0) return false;
    final int cores = totalCores;
    if (cores > 1 && requestedWorkers >= cores) return false;
    return requestedWorkers <= getMaxAllowedWorkers();
  }

  /// Valida la cantidad de workers solicitados y lanza [IsolateThrottleException]
  /// si satura todos los núcleos o excede el límite permitido (§33).
  void validateWorkerCount(int requestedWorkers) {
    if (requestedWorkers <= 0) {
      throw ArgumentError.value(
        requestedWorkers,
        'requestedWorkers',
        'La cantidad de workers debe ser mayor a 0.',
      );
    }

    final int cores = totalCores;
    final int maxAllowed = getMaxAllowedWorkers();

    if (cores > 1 && requestedWorkers >= cores) {
      throw IsolateThrottleException(
        requestedWorkers: requestedWorkers,
        maxAllowedWorkers: maxAllowed,
        totalCores: cores,
        message:
            'Queda estrictamente prohibido saturar todos los núcleos lógicos '
            'de CPU simultáneamente (§33).',
      );
    }

    if (requestedWorkers > maxAllowed) {
      throw IsolateThrottleException(
        requestedWorkers: requestedWorkers,
        maxAllowedWorkers: maxAllowed,
        totalCores: cores,
        message: 'La cantidad de workers solicitada supera el límite recomendado de CPU - 1.',
      );
    }
  }

  /// Ejecuta una colección de elementos de forma controlada limitando la concurrencia
  /// al número recomendado de workers y evaluando opcionalmente [ResourceGuard].
  Future<List<R>> runThrottled<T, R>({
    required List<T> items,
    required Future<R> Function(T item) worker,
    int? maxConcurrent,
    ResourceGuard? resourceGuard,
  }) async {
    final int effectiveLimit = maxConcurrent ?? getMaxAllowedWorkers();
    validateWorkerCount(effectiveLimit);

    if (items.isEmpty) return <R>[];

    final List<R?> results = List<R?>.filled(items.length, null);
    int nextIndex = 0;
    final Completer<void> queueCompleter = Completer<void>();
    int activeWorkers = 0;

    void processNext() {
      while (activeWorkers < effectiveLimit && nextIndex < items.length) {
        final int currentIndex = nextIndex++;
        activeWorkers++;

        // Salvaguarda de RAM en tiempo de despacho (§33)
        resourceGuard?.checkMemoryPressure();

        worker(items[currentIndex])
            .then((R result) {
              results[currentIndex] = result;
            })
            .catchError((Object error, StackTrace stack) {
              if (!queueCompleter.isCompleted) {
                queueCompleter.completeError(error, stack);
              }
            })
            .whenComplete(() {
              activeWorkers--;
              if (nextIndex < items.length && !queueCompleter.isCompleted) {
                processNext();
              } else if (activeWorkers == 0 && !queueCompleter.isCompleted) {
                queueCompleter.complete();
              }
            });
      }
    }

    processNext();
    await queueCompleter.future;

    return results.cast<R>();
  }
}
