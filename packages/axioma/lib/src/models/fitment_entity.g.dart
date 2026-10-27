// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'fitment_entity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$FitmentEntityImpl _$$FitmentEntityImplFromJson(Map<String, dynamic> json) =>
    _$FitmentEntityImpl(
      id: json['id'] as String,
      partId: json['partId'] as String,
      vehicleId: json['vehicleId'] as String?,
      vehicleMake: json['vehicleMake'] as String,
      vehicleModel: json['vehicleModel'] as String,
      vehicleYear: json['vehicleYear'] as String,
      vehicleSubModel: json['vehicleSubModel'] as String?,
      engineCode: json['engineCode'] as String?,
      driveType: json['driveType'] as String?,
      yearFrom: (json['yearFrom'] as num?)?.toInt(),
      yearTo: (json['yearTo'] as num?)?.toInt(),
      engineCc: json['engineCc'] as String?,
      fuelType: json['fuelType'] as String?,
      bodyType: json['bodyType'] as String?,
      verificationStatus:
          json['verificationStatus'] as String? ?? 'ai_extracted',
      verificationSource: json['verificationSource'] as String?,
      isOemValidated: json['isOemValidated'] as bool? ?? false,
      oemPartNumber: json['oemPartNumber'] as String?,
      isInferred: json['isInferred'] as bool,
      confidence: (json['confidence'] as num).toDouble(),
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$FitmentEntityImplToJson(_$FitmentEntityImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'partId': instance.partId,
      'vehicleId': instance.vehicleId,
      'vehicleMake': instance.vehicleMake,
      'vehicleModel': instance.vehicleModel,
      'vehicleYear': instance.vehicleYear,
      'vehicleSubModel': instance.vehicleSubModel,
      'engineCode': instance.engineCode,
      'driveType': instance.driveType,
      'yearFrom': instance.yearFrom,
      'yearTo': instance.yearTo,
      'engineCc': instance.engineCc,
      'fuelType': instance.fuelType,
      'bodyType': instance.bodyType,
      'verificationStatus': instance.verificationStatus,
      'verificationSource': instance.verificationSource,
      'isOemValidated': instance.isOemValidated,
      'oemPartNumber': instance.oemPartNumber,
      'isInferred': instance.isInferred,
      'confidence': instance.confidence,
      'notes': instance.notes,
    };
