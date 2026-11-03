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
      if (decoded is Map<String, dynamic> && decoded['sealed_ids'] is List) {
        final List<dynamic> list = decoded['sealed_ids'] as List<dynamic>;
        return list
            .map<String>((dynamic e) => e.toString().trim())
            .where((String id) => id.isNotEmpty)
            .toSet();
      }
    } catch (_) {
      // INTENTIONAL: Fallback defensivo ante archivo corrupto o no inicializado.
    }
    return <String>{};
  }

  /// Sella físicamente una conversación en `vault/runtime/sealed_conversations.json`.
  void sealConversation(String conversationId, {required String reason}) {
    final String cleanId = conversationId.trim();
    if (cleanId.isEmpty) {
      throw ArgumentError(
        'No se puede sellar un conversationId vacío o nulo (§6).',
      );
    }

    final File sealedFile = File(
      p.join(rootPath, 'vault', 'runtime', 'sealed_conversations.json'),
    );
    final Set<String> currentSealed = loadSealedConversations();
    currentSealed.add(cleanId);

    final Map<String, dynamic> payload = <String, dynamic>{
      'version': '1.0.0',
      'last_updated': DateTime.now().toUtc().toIso8601String(),
      'last_sealed_id': cleanId,
      'last_sealed_reason': reason,
      'sealed_ids': currentSealed.toList()..sort(),
    };

    if (!sealedFile.parent.existsSync()) {
      sealedFile.parent.createSync(recursive: true);
    }
    sealedFile.writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert(payload),
    );
  }
}
