import '../axiom_version.dart';

/// AtomicContract: Interfaz para transacciones que requieren atomicidad federada (G26).
///
/// Define el contrato para operaciones que deben ser confirmadas por múltiples nodos
/// antes de considerarse exitosas (ej: Cobro en Caja -> Descuento en CC).
@AxiomVersion('1.0.0')
abstract class AtomicContract {
  /// Identificador único de la transacción.
  String get transactionId;

  /// Lista de nodos involucrados en el contrato.
  List<String> get involvedNodes;

  /// Estado actual del contrato (PENDING, COMMITTED, ROLLED_BACK).
  String get status;

  /// Firma de veracidad del contrato.
  String? get signature;
}
