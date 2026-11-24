/// takeover_rebound_gate.dart — Candado Físico Anti-Rebote y Sellado de Compactación (§4, §6, §39, §50).
///
/// Previene la elusión sintética del odómetro telemétrico bloqueando físicamente cualquier
/// intento de ejecutar `takeover` dentro del mismo hilo de conversación que ejecutó el `handover`,
/// o reanudar una sesión que fue penalizada/sellada por compactación de contexto.
library;

import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

/// Excepción arrojada cuando se detecta un intento de takeover con el mismo ID de conversación
/// que acaba de realizar handover (rebote intra-sesión prohibido por §50).
class TakeoverReboundException implements Exception {
  final String conversationId;
  final String message;

  TakeoverReboundException({required this.conversationId, String? customMessage})
    : message =
          customMessage ??
          '🚨 [FATAL-GATE §50] Intento de takeover sobre la misma conversación ($conversationId) '
              'que ejecutó el handover. Queda prohibida la elusión sintética del odómetro. '
              'Acción bloqueada. Es obligatorio rotar físicamente a una nueva ventana de chat limpia.';

  @override
  String toString() => 'TakeoverReboundException: $message';
}

/// Excepción arrojada cuando se intenta ejecutar takeover sobre una conversación
/// que ya fue sellada permanentemente por compactación o saturación previa.
class SealedSessionException implements Exception {
  final String conversationId;
  final String reason;
  final String message;

  SealedSessionException({
    required this.conversationId,
    required this.reason,
    String? customMessage,
  }) : message =
           customMessage ??
           '🚨 [FATAL-GATE §50] La conversación ($conversationId) está sellada '
               'permanentemente por: $reason. Prohibido re-usar una sesión viciada.';

  @override
  String toString() => 'SealedSessionException: $message';
}

/// Resultado de la validación del gate anti-rebote.
class TakeoverGateResult {
  final bool isAllowed;
  final String conversationId;
  final String? previousConversationId;
  final String? rejectionReason;

  const TakeoverGateResult({
    required this.isAllowed,
    required this.conversationId,
    this.previousConversationId,
    this.rejectionReason,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_allowed': isAllowed,
    'conversation_id': conversationId,
    'previous_conversation_id': previousConversationId,
    'rejection_reason': rejectionReason,
  };

  @override
  String toString() =>
      'TakeoverGateResult(isAllowed: $isAllowed, conv: $conversationId, prev: $previousConversationId, reason: $rejectionReason)';
}

/// Candado y sensor de integridad para el ciclo de vida Takeover/Handover (§50, Regla 11).
class TakeoverReboundGate {
  final String rootPath;

  const TakeoverReboundGate({required this.rootPath});

  /// Valida en memoria si un intento de takeover es lícito (§50).
  ///
  /// Arroja [ArgumentError] si [incomingConversationId] es nulo o vacío.
  /// Arroja [TakeoverReboundException] si [incomingConversationId] coincide con [relayPreviousConversationId].
  /// Arroja [SealedSessionException] si [incomingConversationId] se encuentra en [sealedConversations].
  static TakeoverGateResult validate({
    required String incomingConversationId,
    String? relayPreviousConversationId,
    Set<String> sealedConversations = const <String>{},
    bool throwOnError = true,
  }) {
    final String cleanIncoming = incomingConversationId.trim();
    if (cleanIncoming.isEmpty) {
      throw ArgumentError(
        'El conversationId para takeover no puede estar vacío (§6).',
      );
    }

    // 1. Verificación de sesión sellada permanentemente
    if (sealedConversations.contains(cleanIncoming)) {
      final String reason = 'CONVERSATION_ALREADY_SEALED';
      if (throwOnError) {
        throw SealedSessionException(
          conversationId: cleanIncoming,
          reason: 'Sesión registrada en la lista negra de sesiones selladas',
        );
      }
      return TakeoverGateResult(
        isAllowed: false,
        conversationId: cleanIncoming,
        previousConversationId: relayPreviousConversationId,
        rejectionReason: reason,
      );
    }

    // 2. Verificación de rebote intra-sesión (§50)
    if (relayPreviousConversationId != null &&
        relayPreviousConversationId.trim().isNotEmpty) {
      final String cleanPrev = relayPreviousConversationId.trim();
      if (cleanIncoming == cleanPrev) {
        final String reason = 'REBOUND_SAME_CONVERSATION';
        if (throwOnError) {
          throw TakeoverReboundException(conversationId: cleanIncoming);
        }
        return TakeoverGateResult(
          isAllowed: false,
          conversationId: cleanIncoming,
          previousConversationId: cleanPrev,
          rejectionReason: reason,
        );
      }
    }

    return TakeoverGateResult(
      isAllowed: true,
      conversationId: cleanIncoming,
      previousConversationId: relayPreviousConversationId,
    );
  }

  /// Límite máximo de sesiones selladas retenidas para evitar O(n) desbocado y acotar búsquedas (GAP-2).
  static const int maxRetentionSessions = 50;

  /// Evalúa el estado físico del disco en [rootPath] contra el [incomingConversationId].
  TakeoverGateResult validateDiskState(
    String incomingConversationId, {
    bool throwOnError = true,
  }) {
    final String? previousId = extractPreviousConversationIdFromRelay();
    final Set<String> sealed = loadSealedConversations();

    return validate(
      incomingConversationId: incomingConversationId,
      relayPreviousConversationId: previousId,
      sealedConversations: sealed,
      throwOnError: throwOnError,
    );
  }

  /// Verifica si existe el cerrojo de detención de emergencia `handover_halt.lock`.
  bool isHandoverHaltLocked() {
    final File lockFile = File(
      p.join(rootPath, 'vault', 'runtime', 'handover_halt.lock'),
    );
    return lockFile.existsSync();
  }

  /// Lee el estado de `session_odometer.json` manejando cold-start y JSON corrupto (SAD-B).
  Map<String, dynamic>? readSessionOdometer() {
    final File odoFile = File(
      p.join(rootPath, 'vault', 'runtime', 'session_odometer.json'),
    );
    if (!odoFile.existsSync()) return null;

    try {
      final String raw = odoFile.readAsStringSync().trim();
      if (raw.isEmpty) return null;
      final dynamic decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // INTENTIONAL: Fallback ante corrupción física del archivo del odómetro (SAD-B, §45).
    }
    return null;
  }

  /// Determina si la sesión anterior cerró su ciclo con el marcador atómico `hwc_complete: true` (GAP-1).
  bool isOdometerHandoverComplete() {
    final Map<String, dynamic>? odo = readSessionOdometer();
    if (odo == null) return false;
    return odo['hwc_complete'] == true;
  }

  /// Lee el `previous_conversation_id` almacenado en `.meta/session.relay`.
  String? extractPreviousConversationIdFromRelay() {
    final File relayFile = File(p.join(rootPath, '.meta', 'session.relay'));
    if (!relayFile.existsSync()) return null;

    try {
      final String raw = relayFile.readAsStringSync().trim();
      if (raw.isEmpty) return null;
      final dynamic decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final dynamic prev = decoded['previous_conversation_id'];
        if (prev is String && prev.trim().isNotEmpty) {
          return prev.trim();
        }
      }
    } catch (_) {
      // INTENTIONAL: Fallback defensivo ante corrupción de archivo relay (§45).
    }
    return null;
  }

  /// Carga el conjunto de IDs de conversaciones selladas permanentemente.
  Set<String> loadSealedConversations() {
    final File sealedFile = File(
      p.join(rootPath, 'vault', 'runtime', 'sealed_conversations.json'),
    );
    if (!sealedFile.existsSync()) return <String>{};

    try {
      final String raw = sealedFile.readAsStringSync().trim();
      if (raw.isEmpty) return <String>{};
      final dynamic decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        if (decoded['sealed_ids'] is List) {
          final List<dynamic> list = decoded['sealed_ids'] as List<dynamic>;
          return list
              .map<String>((dynamic e) => e.toString().trim())
              .where((String id) => id.isNotEmpty)
              .toSet();
        }
      }
    } catch (_) {
      // INTENTIONAL: Fallback defensivo ante archivo corrupto o no inicializado (SAD-B).
    }
    return <String>{};
  }

  /// Sella físicamente una conversación en `vault/runtime/sealed_conversations.json` con
  /// poda atómica rotacional acotada a [maxEntries] (GAP-2) y escritura atómica en dos fases (.tmp + rename).
  void sealConversation(
    String conversationId, {
    required String reason,
    int maxEntries = maxRetentionSessions,
  }) {
    final String cleanId = conversationId.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError(
        'No se puede sellar un conversationId vacío o nulo (§6).',
      );
    }

    final File sealedFile = File(
      p.join(rootPath, 'vault', 'runtime', 'sealed_conversations.json'),
    );
    final List<Map<String, dynamic>> entries = _loadSealedEntries(sealedFile);

    // Evitar duplicados del mismo ID conservando el más reciente
    entries.removeWhere((Map<String, dynamic> e) => e['id'] == cleanId);

    final String nowIso = DateTime.now().toUtc().toIso8601String();
    entries.add(<String, dynamic>{
      'id': cleanId,
      'reason': reason,
      'sealed_at': nowIso,
    });

    // Poda rotacional FIFO acotada a maxEntries (GAP-2)
    while (entries.length > maxEntries) {
      entries.removeAt(0);
    }

    final List<String> sealedIds = entries
        .map<String>((Map<String, dynamic> e) => e['id'] as String)
        .toList();

    final Map<String, dynamic> payload = <String, dynamic>{
      'version': '1.1.0',
      'last_updated': nowIso,
      'last_sealed_id': cleanId,
      'last_sealed_reason': reason,
      'max_retention': maxEntries,
      'sealed_ids': sealedIds,
      'entries': entries,
    };

    if (!sealedFile.parent.existsSync()) {
      sealedFile.parent.createSync(recursive: true);
    }

    // Escritura atómica en dos fases (.tmp + rename) para prevenir torn-writes (GAP-1, SAD-A)
    final File tempFile = File('${sealedFile.path}.tmp');
    tempFile.writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert(payload),
      flush: true,
    );
    tempFile.renameSync(sealedFile.path);
  }

  List<Map<String, dynamic>> _loadSealedEntries(File sealedFile) {
    if (!sealedFile.existsSync()) return <Map<String, dynamic>>[];
    try {
      final String raw = sealedFile.readAsStringSync().trim();
      if (raw.isEmpty) return <Map<String, dynamic>>[];
      final dynamic decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        if (decoded['entries'] is List) {
          final List<dynamic> list = decoded['entries'] as List<dynamic>;
          return list
              .whereType<Map<String, dynamic>>()
              .map((Map<String, dynamic> m) => Map<String, dynamic>.from(m))
              .toList();
        } else if (decoded['sealed_ids'] is List) {
          // Retrocompatibilidad con versión previa sin array 'entries'
          final List<dynamic> list = decoded['sealed_ids'] as List<dynamic>;
          final String stamp =
              decoded['last_updated'] as String? ??
              DateTime.now().toUtc().toIso8601String();
          return list
              .map<String>((dynamic e) => e.toString().trim())
              .where((String id) => id.isNotEmpty)
              .map(
                (String id) => <String, dynamic>{
                  'id': id,
                  'reason': 'HISTORICAL_SEAL',
                  'sealed_at': stamp,
                },
              )
              .toList();
        }
      }
    } catch (_) {
      // INTENTIONAL: Fallback defensivo ante archivo corrupto (SAD-B).
    }
    return <Map<String, dynamic>>[];
  }
}
