import 'package:freezed_annotation/freezed_annotation.dart';

part 'fitment_entity.freezed.dart';
part 'fitment_entity.g.dart';

@freezed
abstract class FitmentEntity with _$FitmentEntity {
  const factory FitmentEntity({
    required String id,
    required String partId,
    String? vehicleId,
    required String vehicleMake, // TODO: Deprecar gradualmente
    required String vehicleModel, // TODO: Deprecar gradualmente
    required String vehicleYear, // TODO: Deprecar gradualmente
    String? vehicleSubModel, // TODO: Deprecar gradualmente
    String? engineCode,
    String? driveType,
    int? yearFrom, // TODO: Deprecar gradualmente
    int? yearTo, // TODO: Deprecar gradualmente
    String? engineCc, // TODO: Deprecar gradualmente
    String? fuelType, // TODO: Deprecar gradualmente
    String? bodyType, // TODO: Deprecar gradualmente
    @Default('ai_extracted') String verificationStatus,
    String? verificationSource,
    @Default(false) bool isOemValidated,
    String? oemPartNumber,
    required bool isInferred,
    required double confidence,
    String? notes,
  }) = _FitmentEntity;

  factory FitmentEntity.fromJson(Map<String, dynamic> json) =>
      _$FitmentEntityFromJson(json);
}
