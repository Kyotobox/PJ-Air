// 🎯 Canonical Creative Order Contract — Pure Dart (§39)
// Conforme a: §4 Cero Mocks, §6 Sad Paths, §39 Pure Dart Core, §45 Soberanía Offline.

import 'dart:convert';

/// Contrato canónico Pure Dart para pedidos y órdenes de producción creativa publicitaria (§39).
/// Representa el requerimiento generado tras el brief con el comerciante.
class CreativeOrderDTO {
  /// Identificador único del pedido creativo (ej. 'ord_cr_01H...').
  final String id;

  /// Identificador del inquilino / comerciante solicitante.
  final String tenantId;

  /// Descripción o brief comercial del arte / campaña requerida.
  final String brief;

  /// Lista de prompts visuales, instrucciones de estilo o directivas generativas.
  final List<String> visualPrompts;

  /// Relación de aspecto objetivo para el lienzo (ej. '1:1', '9:16', '16:9').
  final String aspectRatio;

  /// Estado actual del pedido creativo (ej. 'pending', 'processing', 'completed', 'failed', 'cancelled').
  final String status;

  /// Timestamp UTC de creación del pedido.
  final DateTime createdAt;

  CreativeOrderDTO({
    required this.id,
    required this.tenantId,
    required this.brief,
    List<String> visualPrompts = const <String>[],
    this.aspectRatio = '1:1',
    this.status = 'pending',
    DateTime? createdAt,
  }) : visualPrompts = List<String>.unmodifiable(visualPrompts),
       createdAt = (createdAt ?? DateTime.now()).toUtc() {
    _validate();
  }

  void _validate() {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(
        id,
        'id',
        'El identificador del pedido creativo no puede estar vacío.',
      );
    }
    if (tenantId.trim().isEmpty) {
      throw ArgumentError.value(
        tenantId,
        'tenantId',
        'El identificador del tenant/comercio no puede estar vacío.',
      );
    }
    if (brief.trim().isEmpty) {
      throw ArgumentError.value(
        brief,
        'brief',
        'El brief o descripción creativa no puede estar vacío.',
      );
    }
    if (aspectRatio.trim().isEmpty) {
      throw ArgumentError.value(
        aspectRatio,
        'aspectRatio',
        'El aspectRatio no puede estar vacío.',
      );
    }
    if (status.trim().isEmpty) {
      throw ArgumentError.value(
        status,
        'status',
        'El status del pedido creativo no puede estar vacío.',
      );
    }
  }

  /// Serialización estándar a Map JSON.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id.trim(),
    'tenant_id': tenantId.trim(),
    'brief': brief.trim(),
    'visual_prompts': visualPrompts,
    'aspect_ratio': aspectRatio.trim(),
    'status': status.trim(),
    'created_at': createdAt.toIso8601String(),
  };

  /// Deserialización desde Map JSON con validación estricta ante corrupción (§6).
  factory CreativeOrderDTO.fromJson(Map<String, dynamic> json) {
    final dynamic rawId = json['id'];
    if (rawId == null || rawId is! String || rawId.trim().isEmpty) {
      throw const FormatException(
        'Campo obligatorio "id" ausente, corrupto o vacío en CreativeOrderDTO.',
      );
    }

    final dynamic rawTenantId = json['tenant_id'] ?? json['tenantId'];
    if (rawTenantId == null ||
        rawTenantId is! String ||
        rawTenantId.trim().isEmpty) {
      throw const FormatException(
        'Campo obligatorio "tenant_id" ausente, corrupto o vacío en CreativeOrderDTO.',
      );
    }

    final dynamic rawBrief = json['brief'];
    if (rawBrief == null || rawBrief is! String || rawBrief.trim().isEmpty) {
      throw const FormatException(
        'Campo obligatorio "brief" ausente, corrupto o vacío en CreativeOrderDTO.',
      );
    }

    final dynamic rawPrompts = json['visual_prompts'] ?? json['visualPrompts'];
    final List<String> prompts = <String>[];
    if (rawPrompts != null) {
      if (rawPrompts is! List) {
        throw const FormatException(
          'El campo "visual_prompts" debe ser una lista en CreativeOrderDTO.',
        );
      }
      for (final dynamic item in rawPrompts) {
        if (item is! String) {
          throw FormatException(
            'Elemento no textual en "visual_prompts": $item.',
          );
        }
        prompts.add(item);
      }
    }

    final dynamic rawRatio = json['aspect_ratio'] ?? json['aspectRatio'];
    final String parsedAspectRatio;
    if (rawRatio == null) {
      parsedAspectRatio = '1:1';
    } else if (rawRatio is String && rawRatio.trim().isNotEmpty) {
      parsedAspectRatio = rawRatio.trim();
    } else {
      throw const FormatException(
        'El campo "aspect_ratio" es inválido o no textual en CreativeOrderDTO.',
      );
    }

    final dynamic rawStatus = json['status'];
    final String parsedStatus;
    if (rawStatus == null) {
      parsedStatus = 'pending';
    } else if (rawStatus is String && rawStatus.trim().isNotEmpty) {
      parsedStatus = rawStatus.trim();
    } else {
      throw const FormatException(
        'El campo "status" es inválido o no textual en CreativeOrderDTO.',
      );
    }

    final dynamic rawCreatedAt = json['created_at'] ?? json['createdAt'];
    DateTime? parsedCreatedAt;
    if (rawCreatedAt != null) {
      if (rawCreatedAt is! String) {
        throw const FormatException(
          'El campo "created_at" debe ser una cadena ISO-8601 en CreativeOrderDTO.',
        );
      }
      parsedCreatedAt = DateTime.tryParse(rawCreatedAt);
      if (parsedCreatedAt == null) {
        throw FormatException(
          'Fecha "created_at" con formato inválido o corrupto: $rawCreatedAt',
        );
      }
    }

    return CreativeOrderDTO(
      id: rawId.trim(),
      tenantId: rawTenantId.trim(),
      brief: rawBrief.trim(),
      visualPrompts: prompts,
      aspectRatio: parsedAspectRatio,
      status: parsedStatus,
      createdAt: parsedCreatedAt,
    );
  }

  /// Deserialización desde cadena JSON cruda.
  factory CreativeOrderDTO.fromJsonString(String source) {
    final dynamic decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException(
        'El contenido decodificado debe ser un objeto JSON (Map<String, dynamic>).',
      );
    }
    return CreativeOrderDTO.fromJson(decoded);
  }

  /// Serialización a cadena JSON formateada o compacta.
  String toJsonString({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }

  /// Creación de copias inmutables con campos modificados.
  CreativeOrderDTO copyWith({
    String? id,
    String? tenantId,
    String? brief,
    List<String>? visualPrompts,
    String? aspectRatio,
    String? status,
    DateTime? createdAt,
  }) {
    return CreativeOrderDTO(
      id: id ?? this.id,
      tenantId: tenantId ?? this.tenantId,
      brief: brief ?? this.brief,
      visualPrompts: visualPrompts ?? this.visualPrompts,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreativeOrderDTO &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          tenantId == other.tenantId &&
          brief == other.brief &&
          aspectRatio == other.aspectRatio &&
          status == other.status &&
          createdAt == other.createdAt &&
          _listEquals(visualPrompts, other.visualPrompts);

  @override
  int get hashCode => Object.hash(
    id,
    tenantId,
    brief,
    aspectRatio,
    status,
    createdAt,
    Object.hashAll(visualPrompts),
  );

  @override
  String toString() =>
      'CreativeOrderDTO(id: $id, tenantId: $tenantId, status: $status, ratio: $aspectRatio, prompts: ${visualPrompts.length})';

  static bool _listEquals(List<String> a, List<String> b) {
    if (identical(a, b)) return true;
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
