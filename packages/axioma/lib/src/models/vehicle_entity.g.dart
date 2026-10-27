// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vehicle_entity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$VehicleEntityImpl _$$VehicleEntityImplFromJson(Map<String, dynamic> json) =>
    _$VehicleEntityImpl(
      id: json['id'] as String,
      make: json['make'] as String,
      model: json['model'] as String,
      yearFrom: (json['yearFrom'] as num).toInt(),
      yearTo: (json['yearTo'] as num?)?.toInt(),
      engineDisplacement: (json['engineDisplacement'] as num?)?.toDouble(),
      cylinders: (json['cylinders'] as num?)?.toInt(),
      subModel: json['subModel'] as String?,
      fuelType: json['fuelType'] as String?,
      canonicalSlug: json['canonicalSlug'] as String,
    );

Map<String, dynamic> _$$VehicleEntityImplToJson(_$VehicleEntityImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'make': instance.make,
      'model': instance.model,
      'yearFrom': instance.yearFrom,
      'yearTo': instance.yearTo,
      'engineDisplacement': instance.engineDisplacement,
      'cylinders': instance.cylinders,
      'subModel': instance.subModel,
      'fuelType': instance.fuelType,
      'canonicalSlug': instance.canonicalSlug,
    };
