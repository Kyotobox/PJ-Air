// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'asset_entity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AssetEntityImpl _$$AssetEntityImplFromJson(Map<String, dynamic> json) =>
    _$AssetEntityImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String,
      status: $enumDecode(_$AssetStatusEnumMap, json['status']),
      createdAt: DateTime.parse(json['createdAt'] as String),
      description: json['description'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$AssetEntityImplToJson(_$AssetEntityImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'category': instance.category,
      'status': _$AssetStatusEnumMap[instance.status]!,
      'createdAt': instance.createdAt.toIso8601String(),
      'description': instance.description,
      'metadata': instance.metadata,
    };

const _$AssetStatusEnumMap = {
  AssetStatus.active: 'active',
  AssetStatus.maintenance: 'maintenance',
  AssetStatus.decommissioned: 'decommissioned',
};
