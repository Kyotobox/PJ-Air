/// Contrato agnóstico para el motor de emparejamiento canónico (§39).
abstract class ICanonicalMatcher {
  /// Recibe un payload estructurado y devuelve un resultado de emparejamiento canónico.
  Future<Map<String, dynamic>> findCanonicalMatch(Map<String, dynamic> payload);
}
