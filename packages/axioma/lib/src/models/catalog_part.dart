import 'package:freezed_annotation/freezed_annotation.dart';
import '../shared/enums/catalog_enums.dart';
import 'fitment_entity.dart';

part 'catalog_part.freezed.dart';
part 'catalog_part.g.dart';

@freezed
abstract class CatalogPart with _$CatalogPart {
  const factory CatalogPart({
    required String id,
    required String sku,
    required String name,
    required String brand,
    required double? price,
    required String categoryId,
    required CatalogPartStatus status,
    required DateTime createdAt,
    required List<FitmentEntity> fitments,
    required List<String> tags,
    String? code2,
    String? description2,
    String? sourceHash,
    String? fitmentHash,
    DateTime? lastCertifiedAt,
    List<String>? crossReferences,
    Map<String, dynamic>? techSpecs,
    String? imageRef,
    String? wholesalerId,
    String? originalRaw,
    Map<String, dynamic>? metadata,
  }) = _CatalogPart;

  factory CatalogPart.fromJson(Map<String, dynamic> json) =>
      _$CatalogPartFromJson(json);
}
