import '../models/fitment_entity.dart';
import 'fitment_regex_engine.dart';
import 'fallback_fitment_extractor.dart';

/// Servicio Híbrido Local de Fitment
///
/// Coordina la validación y extracción local mediante:
/// - Capa 1: FitmentRegexEngine (Determinista de alta precisión).
/// - Capa 2: FallbackFitmentExtractor (Heurística de caída).
class HybridFitmentService {
  final FitmentRegexEngine _regexEngine;
  final FallbackFitmentExtractor _fallbackExtractor;

  HybridFitmentService({
    FitmentRegexEngine? regexEngine,
    FallbackFitmentExtractor? fallbackExtractor,
  }) : _regexEngine = regexEngine ?? FitmentRegexEngine(),
       _fallbackExtractor = fallbackExtractor ?? FallbackFitmentExtractor();

  /// Evalúa y construye un listado de compatibilidades vehiculares resueltas localmente.
  List<FitmentEntity> resolveLocalFitments(
    String description,
    String partId, {
    String? expectedMake,
    String? expectedModel,
  }) {
    final List<FitmentEntity> results = <FitmentEntity>[];
    final String cleanDesc = description.trim();

    if (cleanDesc.isEmpty) return results;

    // 1. Si tenemos una expectativa de marca y modelo definidos (ej. del catálogo del proveedor)
    if (expectedMake != null &&
        expectedModel != null &&
        expectedModel != 'N/A' &&
        expectedModel.isNotEmpty) {
      // Intentar validación de alta precisión (Capa 1)
      final bool isCompatible = _regexEngine.isCompatible(
        cleanDesc,
        expectedModel,
        brandName: expectedMake,
      );

      if (isCompatible) {
        results.add(
          FitmentEntity(
            id: '${partId}_det_0',
            partId: partId,
            vehicleMake: expectedMake,
            vehicleModel: expectedModel,
            vehicleYear: 'N/A', // Se resolvería por Heurística/API
            isInferred: false,
            confidence: 1.0,
            verificationStatus: 'verified_deterministic',
          ),
        );
        return results;
      }

      // Si falla Capa 1, intentar caída heurística (Capa 2)
      final List<ExtractedFitment> extracted = _fallbackExtractor.extract(
        cleanDesc,
      );
      for (int i = 0; i < extracted.length; i++) {
        final ExtractedFitment ext = extracted[i];
        if (ext.make.toUpperCase() == expectedMake.toUpperCase() &&
            ext.model.toUpperCase() == expectedModel.toUpperCase()) {
          results.add(
            FitmentEntity(
              id: '${partId}_heur_$i',
              partId: partId,
              vehicleMake: ext.make,
              vehicleModel: ext.model,
              vehicleYear: ext.year,
              yearFrom: ext.yearFrom,
              yearTo: ext.yearTo,
              isInferred: true,
              confidence: 0.7,
              verificationStatus: 'inferred_heuristic',
            ),
          );
          return results;
        }
      }
    } else {
      // 2. Extracción a ciegas: no hay expectativa previa, extraemos todo lo posible localmente
      final List<ExtractedFitment> extracted = _fallbackExtractor.extract(
        cleanDesc,
      );
      for (int i = 0; i < extracted.length; i++) {
        final ExtractedFitment ext = extracted[i];

        // Validar cada extracción heurística contra el regex determinista para certificar precisión
        final bool isCertified = _regexEngine.isCompatible(
          cleanDesc,
          ext.model,
          brandName: ext.make,
        );

        results.add(
          FitmentEntity(
            id: '${partId}_local_$i',
            partId: partId,
            vehicleMake: ext.make,
            vehicleModel: ext.model,
            vehicleYear: ext.year,
            yearFrom: ext.yearFrom,
            yearTo: ext.yearTo,
            isInferred: true,
            confidence: isCertified ? 0.85 : 0.60,
            verificationStatus: isCertified
                ? 'verified_local_regex'
                : 'inferred_local_heuristic',
          ),
        );
      }
    }

    return results;
  }
}
