/// Modelos fiduciarios de valoración multivectorial Pure Dart (§39, §60.2)
library;

/// Acciones fiduciarias recomendadas por la matriz de decisión (§4, §52, §58)
enum FiduciaryAction {
  isolateToQuarantine,
  standardizeAsSkill,
  retainLocalProtected,
  promoteToAxiom,
}

extension FiduciaryActionExtension on FiduciaryAction {
  String get code {
    switch (this) {
      case FiduciaryAction.isolateToQuarantine:
        return 'ISOLATE_TO_QUARANTINE';
      case FiduciaryAction.standardizeAsSkill:
        return 'STANDARDIZE_AS_SKILL';
      case FiduciaryAction.retainLocalProtected:
        return 'RETAIN_LOCAL_PROTECTED';
      case FiduciaryAction.promoteToAxiom:
        return 'PROMOTE_TO_AXIOM';
    }
  }

  static FiduciaryAction fromCode(String code) {
    switch (code) {
      case 'ISOLATE_TO_QUARANTINE':
        return FiduciaryAction.isolateToQuarantine;
      case 'STANDARDIZE_AS_SKILL':
        return FiduciaryAction.standardizeAsSkill;
      case 'RETAIN_LOCAL_PROTECTED':
        return FiduciaryAction.retainLocalProtected;
      case 'PROMOTE_TO_AXIOM':
        return FiduciaryAction.promoteToAxiom;
      default:
        return FiduciaryAction.retainLocalProtected;
    }
  }
}

/// Excepción de cálculo y calibración fiduciaria (§4, §6, §60.7)
class FiduciaryMetricCalculationException implements Exception {
  final String message;
  final String? assetId;
  final dynamic cause;

  const FiduciaryMetricCalculationException(
    this.message, {
    this.assetId,
    this.cause,
  });

  @override
  String toString() =>
      'FiduciaryMetricCalculationException: $message ${assetId != null ? '($assetId)' : ''}';
}

/// Vector Multidimensional de Valoración Fiduciaria (§39, §60.2)
class FiduciaryVector {
  final String assetId;
  final double cc; // Complejidad Ciclomática normalizada [0.0 - 1.0]
  final double id; // Isomorfismo y Deduplicación SimHash [0.0 - 1.0]
  final double spc; // Pureza y Estrictez Contractual Dart/Axioma [0.0 - 1.0]
  final double br; // Radio de Explosión / Acoplamiento Bajo [0.0 - 1.0]
  final double lu; // Utilidad Real en Transcripts/CLI [0.0 - 1.0]
  final double compositeScore; // Ponderación Global Normalizada [0.0 - 1.0]
  final FiduciaryAction recommendedAction;

  const FiduciaryVector({
    required this.assetId,
    required this.cc,
    required this.id,
    required this.spc,
    required this.br,
    required this.lu,
    required this.compositeScore,
    required this.recommendedAction,
  });

  Map<String, dynamic> toJson() => {
    'asset_id': assetId,
    'cc': cc,
    'id': id,
    'spc': spc,
    'br': br,
    'lu': lu,
    'composite_score': compositeScore,
    'recommended_action': recommendedAction.code,
  };

  factory FiduciaryVector.fromJson(Map<String, dynamic> json) {
    return FiduciaryVector(
      assetId: json['asset_id']?.toString() ?? '',
      cc: (json['cc'] as num?)?.toDouble() ?? 0.0,
      id: (json['id'] as num?)?.toDouble() ?? 0.0,
      spc: (json['spc'] as num?)?.toDouble() ?? 0.0,
      br: (json['br'] as num?)?.toDouble() ?? 0.0,
      lu: (json['lu'] as num?)?.toDouble() ?? 0.0,
      compositeScore: (json['composite_score'] as num?)?.toDouble() ?? 0.0,
      recommendedAction: FiduciaryActionExtension.fromCode(
        json['recommended_action']?.toString() ?? 'RETAIN_LOCAL_PROTECTED',
      ),
    );
  }
}
