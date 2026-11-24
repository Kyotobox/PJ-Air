// 🎯 ContextPassport Contract — Contrato Canónico de Soberanía y Perímetro Sónico (§39, §60.8)
import 'package:axioma/src/platform_guard.dart';

/// Pasaporte de contexto criptográfico y soberano para ejecución de tareas inter-nodo.
///
/// Protege el Perímetro Sónico validando autorizaciones explícitas, identidades
/// de origen/destino y zonas de seguridad antes de permitir cualquier invocación.
class ContextPassport {
  final String passportId;
  final String originNode;
  final String targetNode;
  final String targetSkill;
  final String callerIdentity;
  final String sonicPerimeterZone; // GREEN, AMBER, RED
  final String sovereigntyToken;
  final List<String> allowedPathPrefixes;
  final DateTime issuedAt;
  final DateTime expiresAt;
  final Map<String, dynamic> metadata;

  static const Set<String> validPerimeterZones = <String>{
    'GREEN',
    'AMBER',
    'RED',
  };

  ContextPassport({
    required this.passportId,
    required this.originNode,
    required this.targetNode,
    required this.targetSkill,
    required this.callerIdentity,
    required this.sonicPerimeterZone,
    required this.sovereigntyToken,
    this.allowedPathPrefixes = const <String>[],
    DateTime? issuedAt,
    required DateTime expiresAt,
    this.metadata = const <String, dynamic>{},
  }) : issuedAt = issuedAt ?? DateTime.now().toUtc(),
       expiresAt = expiresAt.isUtc ? expiresAt : expiresAt.toUtc() {
    if (passportId.trim().isEmpty) {
      throw const FormatException('passportId no puede estar vacío');
    }
    if (originNode.trim().isEmpty) {
      throw const FormatException('originNode no puede estar vacío');
    }
    if (targetNode.trim().isEmpty) {
      throw const FormatException('targetNode no puede estar vacío');
    }
    if (targetSkill.trim().isEmpty) {
      throw const FormatException('targetSkill no puede estar vacío');
    }
    if (callerIdentity.trim().isEmpty) {
      throw const FormatException('callerIdentity no puede estar vacío');
    }
    if (sovereigntyToken.trim().isEmpty) {
      throw const FormatException('sovereigntyToken no puede estar vacío');
    }
    final String zone = sonicPerimeterZone.toUpperCase().trim();
    if (!validPerimeterZones.contains(zone)) {
      throw FormatException(
        'sonicPerimeterZone desconocida: $sonicPerimeterZone (Permitidas: GREEN, AMBER, RED)',
      );
    }
    if (!this.expiresAt.isAfter(this.issuedAt)) {
      throw const FormatException(
        'expiresAt debe ser estrictamente posterior a issuedAt',
      );
    }
  }

  /// Indica si el pasaporte ya ha expirado para el instante temporal indicado.
  bool isExpired({DateTime? at}) {
    final DateTime checkTime = (at ?? DateTime.now()).toUtc();
    return checkTime.isAfter(expiresAt);
  }

  /// Indica si el pasaporte es temporalmente válido.
  bool isValid({DateTime? at}) => !isExpired(at: at);

  /// Evalúa si una ruta relativa o absoluta de archivo está permitida por el pasaporte.
  bool permitsPath(String path) {
    if (allowedPathPrefixes.isEmpty) return false;
    final PlatformGuard guard = PlatformGuard();
    final String normalized = guard.toForwardSlashes(path);
    for (final String prefix in allowedPathPrefixes) {
      final String normPrefix = guard.toForwardSlashes(prefix);
      if (normalized == normPrefix || normalized.startsWith(normPrefix)) {
        return true;
      }
    }
    return false;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'passport_id': passportId,
    'origin_node': originNode,
    'target_node': targetNode,
    'target_skill': targetSkill,
    'caller_identity': callerIdentity,
    'sonic_perimeter_zone': sonicPerimeterZone.toUpperCase().trim(),
    'sovereignty_token': sovereigntyToken,
    'allowed_path_prefixes': allowedPathPrefixes,
    'issued_at': issuedAt.toIso8601String(),
    'expires_at': expiresAt.toIso8601String(),
    'metadata': metadata,
  };

  factory ContextPassport.fromJson(Map<String, dynamic> json) {
    final dynamic pId = json['passport_id'];
    final dynamic oNode = json['origin_node'];
    final dynamic tNode = json['target_node'];
    final dynamic tSkill = json['target_skill'];
    final dynamic cIdent = json['caller_identity'];
    final dynamic zone = json['sonic_perimeter_zone'];
    final dynamic sToken = json['sovereignty_token'];
    final dynamic expStr = json['expires_at'];

    if (pId is! String || pId.trim().isEmpty) {
      throw const FormatException('passport_id inválido o ausente');
    }
    if (oNode is! String || oNode.trim().isEmpty) {
      throw const FormatException('origin_node inválido o ausente');
    }
    if (tNode is! String || tNode.trim().isEmpty) {
      throw const FormatException('target_node inválido o ausente');
    }
    if (tSkill is! String || tSkill.trim().isEmpty) {
      throw const FormatException('target_skill inválido o ausente');
    }
    if (cIdent is! String || cIdent.trim().isEmpty) {
      throw const FormatException('caller_identity inválido o ausente');
    }
    if (zone is! String || zone.trim().isEmpty) {
      throw const FormatException('sonic_perimeter_zone inválido o ausente');
    }
    if (sToken is! String || sToken.trim().isEmpty) {
      throw const FormatException('sovereignty_token inválido o ausente');
    }
    if (expStr is! String || expStr.trim().isEmpty) {
      throw const FormatException('expires_at inválido o ausente');
    }

    final DateTime expiresAt;
    try {
      expiresAt = DateTime.parse(expStr).toUtc();
    } catch (_) {
      throw const FormatException('Formato de fecha inválido en expires_at');
    }

    final DateTime? issuedAt = json['issued_at'] is String
        ? DateTime.tryParse(json['issued_at'] as String)?.toUtc()
        : null;

    final List<dynamic>? rawPrefixes =
        json['allowed_path_prefixes'] as List<dynamic>?;
    final List<String> prefixes = rawPrefixes != null
        ? rawPrefixes.map((dynamic e) => e.toString()).toList()
        : <String>[];

    return ContextPassport(
      passportId: pId,
      originNode: oNode,
      targetNode: tNode,
      targetSkill: tSkill,
      callerIdentity: cIdent,
      sonicPerimeterZone: zone,
      sovereigntyToken: sToken,
      allowedPathPrefixes: prefixes,
      issuedAt: issuedAt,
      expiresAt: expiresAt,
      metadata:
          (json['metadata'] as Map<String, dynamic>?) ?? <String, dynamic>{},
    );
  }
}
