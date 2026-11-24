// active_commitment.dart — Compromiso Comercial Activo Pure Dart (§39, §60.2)
library;

/// Estado del ciclo de vida de un compromiso comercial.
enum CommitmentStatus {
  pending('PENDING'),
  fulfilled('FULFILLED'),
  cancelled('CANCELLED'),
  expired('EXPIRED');

  final String wireName;

  const CommitmentStatus(this.wireName);

  static CommitmentStatus fromString(String val) {
    final String clean = val.trim().toUpperCase();
    for (final CommitmentStatus s in CommitmentStatus.values) {
      if (s.name.toUpperCase() == clean || s.wireName == clean) {
        return s;
      }
    }
    throw ArgumentError.value(
      val,
      'val',
      'Estado de compromiso desconocido: "$val". Esperado: PENDING, FULFILLED, CANCELLED o EXPIRED.',
    );
  }
}

/// Representación inmutable de un compromiso comercial o promesa activa.
class ActiveCommitment {
  final String id;
  final String clientId;
  final String commitmentType;
  final String description;
  final DateTime? dueDate;
  final CommitmentStatus status;
  final double? amount;
  final String currency;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;
  final DateTime updatedAt;

  ActiveCommitment({
    required this.id,
    required this.clientId,
    required this.commitmentType,
    required this.description,
    this.dueDate,
    this.status = CommitmentStatus.pending,
    this.amount,
    this.currency = 'USD',
    Map<String, dynamic>? metadata,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) : metadata = Map<String, dynamic>.unmodifiable(
         metadata ?? <String, dynamic>{},
       ),
       createdAt = createdAt ?? DateTime.now().toUtc(),
       updatedAt = updatedAt ?? DateTime.now().toUtc() {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(
        id,
        'id',
        'El ID del compromiso no puede estar vacío.',
      );
    }
    if (clientId.trim().isEmpty) {
      throw ArgumentError.value(
        clientId,
        'clientId',
        'El clientId no puede estar vacío.',
      );
    }
    if (commitmentType.trim().isEmpty) {
      throw ArgumentError.value(
        commitmentType,
        'commitmentType',
        'El commitmentType no puede estar vacío.',
      );
    }
    if (description.trim().isEmpty) {
      throw ArgumentError.value(
        description,
        'description',
        'La descripción no puede estar vacía.',
      );
    }
    if (amount != null && amount! < 0) {
      throw ArgumentError.value(
        amount,
        'amount',
        'El monto no puede ser negativo.',
      );
    }
  }

  /// Verifica si el compromiso se encuentra vencido frente a una fecha dada.
  bool isExpired(DateTime now) {
    if (status == CommitmentStatus.expired) return true;
    if (status != CommitmentStatus.pending) return false;
    if (dueDate == null) return false;
    return now.isAfter(dueDate!);
  }

  /// Retorna una copia cumplida del compromiso.
  ActiveCommitment fulfill() {
    return ActiveCommitment(
      id: id,
      clientId: clientId,
      commitmentType: commitmentType,
      description: description,
      dueDate: dueDate,
      status: CommitmentStatus.fulfilled,
      amount: amount,
      currency: currency,
      metadata: metadata,
      createdAt: createdAt,
      updatedAt: DateTime.now().toUtc(),
    );
  }

  /// Retorna una copia cancelada del compromiso.
  ActiveCommitment cancel({String? reason}) {
    final Map<String, dynamic> newMeta = Map<String, dynamic>.from(metadata);
    if (reason != null && reason.trim().isNotEmpty) {
      newMeta['cancel_reason'] = reason.trim();
    }
    return ActiveCommitment(
      id: id,
      clientId: clientId,
      commitmentType: commitmentType,
      description: description,
      dueDate: dueDate,
      status: CommitmentStatus.cancelled,
      amount: amount,
      currency: currency,
      metadata: newMeta,
      createdAt: createdAt,
      updatedAt: DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'client_id': clientId,
    'commitment_type': commitmentType,
    'description': description,
    'due_date': dueDate?.toIso8601String(),
    'status': status.wireName,
    'amount': amount,
    'currency': currency,
    'metadata': metadata,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
  };

  factory ActiveCommitment.fromJson(Map<String, dynamic> json) {
    return ActiveCommitment(
      id: json['id'] as String? ?? '',
      clientId: json['client_id'] as String? ?? '',
      commitmentType: json['commitment_type'] as String? ?? '',
      description: json['description'] as String? ?? '',
      dueDate: json['due_date'] != null
          ? DateTime.parse(json['due_date'] as String)
          : null,
      status: json['status'] != null
          ? CommitmentStatus.fromString(json['status'] as String)
          : CommitmentStatus.pending,
      amount: (json['amount'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      metadata: json['metadata'] != null
          ? Map<String, dynamic>.from(json['metadata'] as Map<Object?, Object?>)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }
}
