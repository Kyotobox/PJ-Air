// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'wholesaler_entity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WholesalerEntityImpl _$$WholesalerEntityImplFromJson(
  Map<String, dynamic> json,
) => _$WholesalerEntityImpl(
  id: json['id'] as String,
  name: json['name'] as String,
  currency: json['currency'] as String,
  formula: json['formula'] as String,
  metadata: json['metadata'] as Map<String, dynamic>?,
);

Map<String, dynamic> _$$WholesalerEntityImplToJson(
  _$WholesalerEntityImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'currency': instance.currency,
  'formula': instance.formula,
  'metadata': instance.metadata,
};
