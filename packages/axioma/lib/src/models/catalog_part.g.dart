// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalog_part.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CatalogPartImpl _$$CatalogPartImplFromJson(Map<String, dynamic> json) =>
    _$CatalogPartImpl(
      id: json['id'] as String,
      sku: json['sku'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String,
      price: (json['price'] as num?)?.toDouble(),
      categoryId: json['categoryId'] as String,
      status: $enumDecode(_$CatalogPartStatusEnumMap, json['status']),
      createdAt: DateTime.parse(json['createdAt'] as String),
      fitments: (json['fitments'] as List<dynamic>)
          .map((e) => FitmentEntity.fromJson(e as Map<String, dynamic>))
          .toList(),
      tags: (json['tags'] as List<dynamic>).map((e) => e as String).toList(),
      code2: json['code2'] as String?,
      description2: json['description2'] as String?,
      sourceHash: json['sourceHash'] as String?,
      fitmentHash: json['fitmentHash'] as String?,
      lastCertifiedAt: json['lastCertifiedAt'] == null
          ? null
          : DateTime.parse(json['lastCertifiedAt'] as String),
      crossReferences: (json['crossReferences'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      techSpecs: json['techSpecs'] as Map<String, dynamic>?,
      imageRef: json['imageRef'] as String?,
      wholesalerId: json['wholesalerId'] as String?,
      originalRaw: json['originalRaw'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$CatalogPartImplToJson(_$CatalogPartImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sku': instance.sku,
      'name': instance.name,
      'brand': instance.brand,
      'price': instance.price,
      'categoryId': instance.categoryId,
      'status': _$CatalogPartStatusEnumMap[instance.status]!,
      'createdAt': instance.createdAt.toIso8601String(),
      'fitments': instance.fitments,
      'tags': instance.tags,
      'code2': instance.code2,
      'description2': instance.description2,
      'sourceHash': instance.sourceHash,
      'fitmentHash': instance.fitmentHash,
      'lastCertifiedAt': instance.lastCertifiedAt?.toIso8601String(),
      'crossReferences': instance.crossReferences,
      'techSpecs': instance.techSpecs,
      'imageRef': instance.imageRef,
      'wholesalerId': instance.wholesalerId,
      'originalRaw': instance.originalRaw,
      'metadata': instance.metadata,
    };

const _$CatalogPartStatusEnumMap = {
  CatalogPartStatus.extracted: 'extracted',
  CatalogPartStatus.pendingReview: 'pending_review',
  CatalogPartStatus.nominal: 'nominal',
  CatalogPartStatus.discarded: 'discarded',
};
